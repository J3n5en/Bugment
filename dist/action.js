#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BugmentAction = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const review_1 = require("./review");
class BugmentAction {
    constructor() {
        this.inputs = this.parseInputs();
        this.octokit = github.getOctokit(this.inputs.githubToken);
        this.prInfo = this.extractPRInfo();
    }
    parseInputs() {
        return {
            augmentAccessToken: core.getInput("augment_access_token", {
                required: true,
            }),
            augmentTenantUrl: core.getInput("augment_tenant_url", { required: true }),
            githubToken: core.getInput("github_token", { required: true }),
        };
    }
    extractPRInfo() {
        const context = github.context;
        if (!context.payload.pull_request) {
            throw new Error("This action can only be run on pull request events");
        }
        const pr = context.payload.pull_request;
        return {
            number: pr.number,
            title: pr.title || "",
            body: pr.body || "",
            baseSha: pr.base.sha,
            headSha: pr.head.sha,
            owner: context.repo.owner,
            repo: context.repo.repo,
        };
    }
    async run() {
        try {
            core.info("🚀 Starting Bugment AI Code Review...");
            // Setup Augment authentication
            await this.setupAugmentAuth();
            // Generate diff file
            const diffPath = await this.generateDiffFile();
            // Perform code review
            const reviewResult = await this.performReview(diffPath);
            // Post review comment
            await this.postReviewComment(reviewResult);
            // Set outputs
            core.setOutput("review_result", reviewResult);
            core.setOutput("review_status", "success");
            core.info("✅ Code review completed successfully");
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            core.setFailed(`❌ Code review failed: ${errorMessage}`);
            core.setOutput("review_status", "failed");
        }
    }
    async setupAugmentAuth() {
        core.info("🔐 Setting up Augment authentication...");
        const configDir = path.join(process.env.HOME || "~", ".local/share/vim-augment");
        const configFile = path.join(configDir, "secrets.json");
        // Create config directory
        await fs.promises.mkdir(configDir, { recursive: true });
        // Create auth config
        const authConfig = {
            "augment.sessions": JSON.stringify({
                accessToken: this.inputs.augmentAccessToken,
                tenantURL: this.inputs.augmentTenantUrl,
                scopes: ["email"],
            }),
        };
        await fs.promises.writeFile(configFile, JSON.stringify(authConfig, null, 2));
        core.info("✅ Augment authentication configured");
    }
    getWorkspaceDirectory() {
        // GitHub Actions sets GITHUB_WORKSPACE to the user's repository directory
        return process.env.GITHUB_WORKSPACE || process.cwd();
    }
    async generateDiffFile() {
        core.info("📄 Generating PR diff file...");
        const workspaceDir = this.getWorkspaceDirectory();
        const diffPath = path.join(workspaceDir, "pr_diff.patch");
        core.info(`📁 Using workspace directory: ${workspaceDir}`);
        core.info(`🔍 Comparing ${this.prInfo.baseSha}...${this.prInfo.headSha}`);
        try {
            // Method 1: Try to use git diff locally (most accurate)
            const diffContent = await this.generateLocalDiff(workspaceDir);
            await fs.promises.writeFile(diffPath, diffContent);
            core.info(`✅ Diff file generated using local git: ${diffPath}`);
            return diffPath;
        }
        catch (localError) {
            const errorMessage = localError instanceof Error ? localError.message : String(localError);
            core.warning(`Local git diff failed: ${errorMessage}`);
            // Method 2: Fallback to GitHub API
            try {
                const diffContent = await this.generateApiDiff();
                await fs.promises.writeFile(diffPath, diffContent);
                core.info(`✅ Diff file generated using GitHub API: ${diffPath}`);
                return diffPath;
            }
            catch (apiError) {
                const apiErrorMessage = apiError instanceof Error ? apiError.message : String(apiError);
                core.error(`GitHub API diff failed: ${apiErrorMessage}`);
                throw new Error(`Failed to generate diff: ${apiErrorMessage}`);
            }
        }
    }
    async generateLocalDiff(workspaceDir) {
        return new Promise((resolve, reject) => {
            const gitProcess = (0, child_process_1.spawn)("git", ["diff", `${this.prInfo.baseSha}...${this.prInfo.headSha}`], {
                cwd: workspaceDir,
                stdio: ["pipe", "pipe", "pipe"],
            });
            let stdout = "";
            let stderr = "";
            gitProcess.stdout.on("data", (data) => {
                stdout += data.toString();
            });
            gitProcess.stderr.on("data", (data) => {
                stderr += data.toString();
            });
            gitProcess.on("close", (code) => {
                if (code === 0) {
                    resolve(stdout);
                }
                else {
                    reject(new Error(`Git diff failed with code ${code}: ${stderr}`));
                }
            });
            gitProcess.on("error", (error) => {
                reject(error);
            });
        });
    }
    async generateApiDiff() {
        const diffResponse = await this.octokit.rest.repos.compareCommits({
            owner: this.prInfo.owner,
            repo: this.prInfo.repo,
            base: this.prInfo.baseSha,
            head: this.prInfo.headSha,
            mediaType: {
                format: "diff",
            },
        });
        return diffResponse.data;
    }
    async performReview(diffPath) {
        core.info("🤖 Performing AI code review...");
        const workspaceDir = this.getWorkspaceDirectory();
        const reviewOptions = {
            projectPath: workspaceDir,
            prTitle: this.prInfo.title,
            prDescription: this.prInfo.body,
            diffPath: diffPath,
            repoOwner: this.prInfo.owner,
            repoName: this.prInfo.repo,
            commitSha: this.prInfo.headSha,
        };
        core.info(`🔍 Analyzing project at: ${workspaceDir}`);
        const result = await (0, review_1.performCodeReview)(reviewOptions);
        core.info("✅ Code review completed");
        return result;
    }
    async postReviewComment(reviewResult) {
        core.info("💬 Posting review comment...");
        // Parse the review result to extract structured data
        const parsedResult = this.parseReviewResult(reviewResult);
        // Get previous review results for comparison
        const previousReviews = await this.getPreviousReviews();
        // Compare with previous reviews to identify fixed/new issues
        const comparison = this.compareReviews(parsedResult, previousReviews);
        // Format comment with status information
        const commentBody = this.formatReviewCommentWithStatus(parsedResult, comparison);
        // Always create a new comment instead of replacing
        await this.createNewReviewComment(commentBody);
        core.info("✅ Review comment posted");
    }
    parseReviewResult(reviewResult) {
        // Generate a unique review ID with PR association
        const prId = `pr${this.prInfo.number}`;
        const commitShort = this.prInfo.headSha.substring(0, 8);
        const timestampShort = Date.now().toString().slice(-6); // Last 6 digits for brevity
        const reviewId = `${prId}_${commitShort}_${timestampShort}`;
        const timestamp = new Date().toISOString();
        // Extract issues from the review result using regex patterns
        const issues = [];
        // Parse different types of issues from the review text
        // This is a simplified parser - in production, you might want more sophisticated parsing
        const bugPattern = /### 🐛 潜在 Bug[\s\S]*?(?=###|$)/g;
        const smellPattern = /### 🔍 Code Smell[\s\S]*?(?=###|$)/g;
        const securityPattern = /### 🔒 安全问题[\s\S]*?(?=###|$)/g;
        const performancePattern = /### ⚡ 性能问题[\s\S]*?(?=###|$)/g;
        let issueId = 1;
        // Parse bugs
        const bugMatches = reviewResult.match(bugPattern);
        if (bugMatches) {
            bugMatches.forEach(match => {
                const issue = this.parseIssueFromText(match, 'bug', `bug_${issueId++}`);
                if (issue)
                    issues.push(issue);
            });
        }
        // Parse code smells
        const smellMatches = reviewResult.match(smellPattern);
        if (smellMatches) {
            smellMatches.forEach(match => {
                const issue = this.parseIssueFromText(match, 'code_smell', `smell_${issueId++}`);
                if (issue)
                    issues.push(issue);
            });
        }
        // Parse security issues
        const securityMatches = reviewResult.match(securityPattern);
        if (securityMatches) {
            securityMatches.forEach(match => {
                const issue = this.parseIssueFromText(match, 'security', `security_${issueId++}`);
                if (issue)
                    issues.push(issue);
            });
        }
        // Parse performance issues
        const performanceMatches = reviewResult.match(performancePattern);
        if (performanceMatches) {
            performanceMatches.forEach(match => {
                const issue = this.parseIssueFromText(match, 'performance', `perf_${issueId++}`);
                if (issue)
                    issues.push(issue);
            });
        }
        return {
            reviewId,
            timestamp,
            commitSha: this.prInfo.headSha,
            summary: this.extractSummaryFromReview(reviewResult),
            issues,
            totalIssues: issues.length
        };
    }
    parseIssueFromText(text, type, id) {
        // Extract severity, description, location, etc. from the text
        // This is a simplified implementation
        const severityMatch = text.match(/严重程度[：:]\s*(\w+)/);
        const locationMatch = text.match(/位置[：:]\s*(.+?)(?:\n|$)/);
        const descriptionMatch = text.match(/描述[：:]\s*([\s\S]*?)(?=位置|AI修复|$)/);
        const fixPromptMatch = text.match(/AI修复Prompt[：:]\s*(.+?)(?:\n|$)/);
        if (!descriptionMatch || !descriptionMatch[1])
            return null;
        const severity = this.mapSeverity(severityMatch?.[1] || 'medium');
        const description = descriptionMatch[1].trim();
        return {
            id,
            type,
            severity,
            title: this.extractTitleFromDescription(description),
            description,
            location: locationMatch?.[1]?.trim() || '',
            fixPrompt: fixPromptMatch?.[1]?.trim()
        };
    }
    mapSeverity(severityText) {
        const lowerText = severityText.toLowerCase();
        if (lowerText.includes('高') || lowerText.includes('critical'))
            return 'critical';
        if (lowerText.includes('中') || lowerText.includes('medium'))
            return 'medium';
        if (lowerText.includes('低') || lowerText.includes('low'))
            return 'low';
        return 'medium';
    }
    extractTitleFromDescription(description) {
        // Extract the first sentence or first 50 characters as title
        const firstLine = description.split('\n')[0] || '';
        return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
    }
    extractSummaryFromReview(reviewResult) {
        // Extract the summary section from the review
        const summaryMatch = reviewResult.match(/## 总体评价[\s\S]*?(?=##|$)/);
        return summaryMatch?.[0] || '';
    }
    async getPreviousReviews() {
        try {
            // Get all comments on this PR
            const comments = await this.octokit.rest.issues.listComments({
                owner: this.prInfo.owner,
                repo: this.prInfo.repo,
                issue_number: this.prInfo.number,
            });
            const reviewResults = [];
            // Parse previous Bugment review comments
            for (const comment of comments.data) {
                if (comment.body?.includes("Bugment AI Code Review") &&
                    comment.body?.includes("REVIEW_DATA:")) {
                    try {
                        const reviewDataMatch = comment.body.match(/REVIEW_DATA:\s*```json\s*([\s\S]*?)\s*```/);
                        if (reviewDataMatch && reviewDataMatch[1]) {
                            const reviewData = JSON.parse(reviewDataMatch[1]);
                            reviewResults.push(reviewData);
                        }
                    }
                    catch (error) {
                        core.warning(`Failed to parse previous review data: ${error}`);
                    }
                }
            }
            // Sort by timestamp (newest first)
            return reviewResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        catch (error) {
            core.warning(`Failed to get previous reviews: ${error}`);
            return [];
        }
    }
    compareReviews(currentReview, previousReviews) {
        if (previousReviews.length === 0) {
            // First review - all issues are new
            return {
                newIssues: currentReview.issues,
                fixedIssues: [],
                persistentIssues: [],
                modifiedIssues: [],
                fixedCount: 0,
                newCount: currentReview.issues.length,
                persistentCount: 0
            };
        }
        const latestPreviousReview = previousReviews[0];
        if (!latestPreviousReview) {
            // No previous review found, treat all as new
            return {
                newIssues: currentReview.issues,
                fixedIssues: [],
                persistentIssues: [],
                modifiedIssues: [],
                fixedCount: 0,
                newCount: currentReview.issues.length,
                persistentCount: 0
            };
        }
        const newIssues = [];
        const fixedIssues = [];
        const persistentIssues = [];
        const modifiedIssues = [];
        // Create maps for easier lookup
        const currentIssueMap = new Map(currentReview.issues.map(issue => [this.getIssueSignature(issue), issue]));
        const previousIssueMap = new Map(latestPreviousReview.issues.map(issue => [this.getIssueSignature(issue), issue]));
        // Find new and persistent issues
        for (const currentIssue of currentReview.issues) {
            const signature = this.getIssueSignature(currentIssue);
            const previousIssue = previousIssueMap.get(signature);
            if (!previousIssue) {
                newIssues.push(currentIssue);
            }
            else if (this.issuesAreSimilar(currentIssue, previousIssue)) {
                if (currentIssue.description !== previousIssue.description) {
                    modifiedIssues.push({ previous: previousIssue, current: currentIssue });
                }
                else {
                    persistentIssues.push(currentIssue);
                }
            }
        }
        // Find fixed issues
        for (const previousIssue of latestPreviousReview.issues) {
            const signature = this.getIssueSignature(previousIssue);
            if (!currentIssueMap.has(signature)) {
                fixedIssues.push(previousIssue);
            }
        }
        return {
            newIssues,
            fixedIssues,
            persistentIssues,
            modifiedIssues,
            fixedCount: fixedIssues.length,
            newCount: newIssues.length,
            persistentCount: persistentIssues.length
        };
    }
    getIssueSignature(issue) {
        // Create a signature based on type, location, and key parts of description
        const locationPart = issue.location || issue.filePath || '';
        const descriptionPart = issue.description.substring(0, 100);
        return `${issue.type}_${locationPart}_${descriptionPart}`.replace(/\s+/g, '_');
    }
    issuesAreSimilar(issue1, issue2) {
        return issue1.type === issue2.type &&
            issue1.location === issue2.location &&
            issue1.filePath === issue2.filePath &&
            issue1.lineNumber === issue2.lineNumber;
    }
    formatReviewCommentWithStatus(reviewResult, comparison) {
        const timestamp = new Date(reviewResult.timestamp).toLocaleString('zh-CN');
        const commitShort = reviewResult.commitSha.substring(0, 8);
        let header = `## 🤖 Bugment AI Code Review\n\n`;
        header += `**📅 Review Time:** ${timestamp}\n`;
        header += `**📝 Commit:** \`${commitShort}\`\n`;
        header += `**🔍 Review ID:** \`${reviewResult.reviewId}\`\n\n`;
        // Add status summary if there are previous reviews
        if (comparison.fixedCount > 0 || comparison.newCount > 0 || comparison.persistentCount > 0) {
            header += `### 📊 修复状态总览\n\n`;
            if (comparison.fixedCount > 0) {
                header += `✅ **已修复问题:** ${comparison.fixedCount} 个\n`;
            }
            if (comparison.newCount > 0) {
                header += `🆕 **新发现问题:** ${comparison.newCount} 个\n`;
            }
            if (comparison.persistentCount > 0) {
                header += `⚠️ **仍存在问题:** ${comparison.persistentCount} 个\n`;
            }
            if (comparison.modifiedIssues.length > 0) {
                header += `🔄 **已修改问题:** ${comparison.modifiedIssues.length} 个\n`;
            }
            header += `\n`;
            // Show fixed issues
            if (comparison.fixedIssues.length > 0) {
                header += `### ✅ 已修复的问题\n\n`;
                comparison.fixedIssues.forEach((issue, index) => {
                    header += `${index + 1}. **${issue.title}** (${issue.type})\n`;
                    header += `   - 位置: ${issue.location}\n`;
                    header += `   - 严重程度: ${issue.severity}\n\n`;
                });
            }
        }
        // Add current review content
        header += `### 🔍 当前Review结果\n\n`;
        // Extract and format the original review content
        const reviewContent = this.formatOriginalReviewContent(reviewResult);
        let footer = `\n\n---\n`;
        footer += `*This review was generated by [Bugment](https://github.com/J3n5en/bugment) AI Code Review Action*\n\n`;
        // Add hidden review data for future parsing
        const reviewDataJson = JSON.stringify(reviewResult, null, 2);
        const hiddenData = `<!-- REVIEW_DATA:\n\`\`\`json\n${reviewDataJson}\n\`\`\`\n-->`;
        return header + reviewContent + footer + hiddenData;
    }
    formatOriginalReviewContent(reviewResult) {
        let content = reviewResult.summary + '\n\n';
        if (reviewResult.issues.length > 0) {
            // Group issues by type
            const issuesByType = {
                bug: reviewResult.issues.filter(i => i.type === 'bug'),
                code_smell: reviewResult.issues.filter(i => i.type === 'code_smell'),
                security: reviewResult.issues.filter(i => i.type === 'security'),
                performance: reviewResult.issues.filter(i => i.type === 'performance')
            };
            if (issuesByType.bug.length > 0) {
                content += `### 🐛 潜在 Bug (${issuesByType.bug.length})\n\n`;
                issuesByType.bug.forEach((issue, index) => {
                    content += this.formatIssue(issue, index + 1);
                });
            }
            if (issuesByType.code_smell.length > 0) {
                content += `### 🔍 Code Smell (${issuesByType.code_smell.length})\n\n`;
                issuesByType.code_smell.forEach((issue, index) => {
                    content += this.formatIssue(issue, index + 1);
                });
            }
            if (issuesByType.security.length > 0) {
                content += `### 🔒 安全问题 (${issuesByType.security.length})\n\n`;
                issuesByType.security.forEach((issue, index) => {
                    content += this.formatIssue(issue, index + 1);
                });
            }
            if (issuesByType.performance.length > 0) {
                content += `### ⚡ 性能问题 (${issuesByType.performance.length})\n\n`;
                issuesByType.performance.forEach((issue, index) => {
                    content += this.formatIssue(issue, index + 1);
                });
            }
        }
        return content;
    }
    formatIssue(issue, index) {
        let formatted = `#### ${index}. ${issue.title}\n\n`;
        formatted += `**严重程度:** ${issue.severity}\n\n`;
        formatted += `**描述:** ${issue.description}\n\n`;
        if (issue.location) {
            formatted += `**位置:** ${issue.location}\n\n`;
        }
        if (issue.fixPrompt) {
            formatted += `**AI修复Prompt:** ${issue.fixPrompt}\n\n`;
        }
        formatted += `---\n\n`;
        return formatted;
    }
    async createNewReviewComment(commentBody) {
        await this.octokit.rest.issues.createComment({
            owner: this.prInfo.owner,
            repo: this.prInfo.repo,
            issue_number: this.prInfo.number,
            body: commentBody,
        });
    }
}
exports.BugmentAction = BugmentAction;
// Main execution
async function main() {
    const action = new BugmentAction();
    await action.run();
}
if (require.main === module) {
    main().catch((error) => {
        core.setFailed(error.message);
        process.exit(1);
    });
}
//# sourceMappingURL=action.js.map