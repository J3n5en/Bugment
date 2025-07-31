#!/usr/bin/env node

import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { performCodeReview, ReviewOptions } from "./review";

interface ActionInputs {
  augmentAccessToken: string;
  augmentTenantUrl: string;
  githubToken: string;
}

interface PullRequestInfo {
  number: number;
  title: string;
  body: string;
  baseSha: string;
  headSha: string;
  owner: string;
  repo: string;
}

interface ReviewIssue {
  id: string;
  type: 'bug' | 'code_smell' | 'security' | 'performance';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  location: string;
  filePath?: string;
  lineNumber?: number;
  startLine?: number;
  endLine?: number;
  fixPrompt?: string;
  suggestion?: string;
  diffHunk?: string;
}

interface DiffHunk {
  filePath: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

interface ParsedDiff {
  files: Map<string, DiffHunk[]>;
}

interface ReviewResult {
  reviewId: string;
  timestamp: string;
  commitSha: string;
  summary: string;
  issues: ReviewIssue[];
  totalIssues: number;
}



interface ReviewComparison {
  newIssues: ReviewIssue[];
  fixedIssues: ReviewIssue[];
  persistentIssues: ReviewIssue[];
  modifiedIssues: { previous: ReviewIssue; current: ReviewIssue }[];
  fixedCount: number;
  newCount: number;
  persistentCount: number;
}

class BugmentAction {
  private inputs: ActionInputs;
  private octokit: ReturnType<typeof github.getOctokit>;
  private prInfo: PullRequestInfo;
  private parsedDiff?: ParsedDiff;

  constructor() {
    this.inputs = this.parseInputs();
    this.octokit = github.getOctokit(this.inputs.githubToken);
    this.prInfo = this.extractPRInfo();
  }

  private parseInputs(): ActionInputs {
    return {
      augmentAccessToken: core.getInput("augment_access_token", {
        required: true,
      }),
      augmentTenantUrl: core.getInput("augment_tenant_url", { required: true }),
      githubToken: core.getInput("github_token", { required: true }),
    };
  }

  private extractPRInfo(): PullRequestInfo {
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

  async run(): Promise<void> {
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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      core.setFailed(`❌ Code review failed: ${errorMessage}`);
      core.setOutput("review_status", "failed");
    }
  }

  private async setupAugmentAuth(): Promise<void> {
    core.info("🔐 Setting up Augment authentication...");

    const configDir = path.join(
      process.env.HOME || "~",
      ".local/share/vim-augment"
    );
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

    await fs.promises.writeFile(
      configFile,
      JSON.stringify(authConfig, null, 2)
    );
    core.info("✅ Augment authentication configured");
  }

  private getWorkspaceDirectory(): string {
    // GitHub Actions sets GITHUB_WORKSPACE to the user's repository directory
    return process.env.GITHUB_WORKSPACE || process.cwd();
  }

  private async getActualBaseSha(workspaceDir: string): Promise<string> {
    // For PR events, github.sha is the merge commit
    // We need to get the first parent (base branch SHA) of this merge commit
    return new Promise((resolve, reject) => {
      const gitProcess = spawn(
        "git",
        ["rev-parse", `${process.env.GITHUB_SHA}^1`],
        {
          cwd: workspaceDir,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      let stdout = "";
      let stderr = "";

      gitProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on("close", (code: number) => {
        if (code === 0) {
          const actualBaseSha = stdout.trim();
          resolve(actualBaseSha);
        } else {
          core.warning(`Failed to get actual base SHA: ${stderr}`);
          // Fallback to original base SHA
          resolve(this.prInfo.baseSha);
        }
      });

      gitProcess.on("error", (error: Error) => {
        core.warning(`Error getting actual base SHA: ${error.message}`);
        // Fallback to original base SHA
        resolve(this.prInfo.baseSha);
      });
    });
  }

  private async generateDiffFile(): Promise<string> {
    core.info("📄 Generating PR diff file...");

    const workspaceDir = this.getWorkspaceDirectory();
    const diffPath = path.join(workspaceDir, "pr_diff.patch");

    core.info(`📁 Using workspace directory: ${workspaceDir}`);

    // Get the correct base SHA for the PR diff
    const actualBaseSha = await this.getActualBaseSha(workspaceDir);
    core.info(`🔍 Comparing ${actualBaseSha}...${this.prInfo.headSha}`);
    core.info(`📝 Original base SHA: ${this.prInfo.baseSha} (PR creation time)`);
    core.info(`📝 Actual base SHA: ${actualBaseSha} (merge commit base)`);

    let diffContent: string;
    try {
      // Method 1: Try to use git diff locally (most accurate)
      diffContent = await this.generateLocalDiffWithCorrectBase(workspaceDir, actualBaseSha);
      await fs.promises.writeFile(diffPath, diffContent);
      core.info(`✅ Diff file generated using local git: ${diffPath}`);
    } catch (localError) {
      const errorMessage =
        localError instanceof Error ? localError.message : String(localError);
      core.warning(`Local git diff failed: ${errorMessage}`);

      // Method 2: Fallback to GitHub API with correct base
      try {
        diffContent = await this.generateApiDiffWithCorrectBase(actualBaseSha);
        await fs.promises.writeFile(diffPath, diffContent);
        core.info(`✅ Diff file generated using GitHub API: ${diffPath}`);
      } catch (apiError) {
        const apiErrorMessage =
          apiError instanceof Error ? apiError.message : String(apiError);
        core.error(`GitHub API diff failed: ${apiErrorMessage}`);
        throw new Error(`Failed to generate diff: ${apiErrorMessage}`);
      }
    }

    // Parse the diff content for line validation
    this.parsedDiff = this.parseDiffContent(diffContent);
    core.info(`📊 Parsed diff for ${this.parsedDiff.files.size} files`);

    return diffPath;
  }

  private async generateLocalDiffWithCorrectBase(workspaceDir: string, baseSha: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn(
        "git",
        ["diff", `${baseSha}...${this.prInfo.headSha}`],
        {
          cwd: workspaceDir,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      let stdout = "";
      let stderr = "";

      gitProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on("close", (code: number) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git diff failed with code ${code}: ${stderr}`));
        }
      });

      gitProcess.on("error", (error: Error) => {
        reject(error);
      });
    });
  }

  private async generateLocalDiff(workspaceDir: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn(
        "git",
        ["diff", `${this.prInfo.baseSha}...${this.prInfo.headSha}`],
        {
          cwd: workspaceDir,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      let stdout = "";
      let stderr = "";

      gitProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on("close", (code: number) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git diff failed with code ${code}: ${stderr}`));
        }
      });

      gitProcess.on("error", (error: Error) => {
        reject(error);
      });
    });
  }

  private async generateApiDiffWithCorrectBase(baseSha: string): Promise<string> {
    const diffResponse = await this.octokit.rest.repos.compareCommits({
      owner: this.prInfo.owner,
      repo: this.prInfo.repo,
      base: baseSha,
      head: this.prInfo.headSha,
      mediaType: {
        format: "diff",
      },
    });

    return diffResponse.data as unknown as string;
  }

  private async generateApiDiff(): Promise<string> {
    const diffResponse = await this.octokit.rest.repos.compareCommits({
      owner: this.prInfo.owner,
      repo: this.prInfo.repo,
      base: this.prInfo.baseSha,
      head: this.prInfo.headSha,
      mediaType: {
        format: "diff",
      },
    });

    return diffResponse.data as unknown as string;
  }

  private parseDiffContent(diffContent: string): ParsedDiff {
    const files = new Map<string, DiffHunk[]>();
    const lines = diffContent.split('\n');

    let currentFile = '';
    let currentHunk: DiffHunk | null = null;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (!line) {
        i++;
        continue;
      }

      // File header: diff --git a/file b/file
      if (line.startsWith('diff --git')) {
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (match && match[2]) {
          currentFile = match[2]; // Use the new file path
          if (!files.has(currentFile)) {
            files.set(currentFile, []);
          }
        }
      }
      // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
      else if (line.startsWith('@@')) {
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match && currentFile && match[1] && match[3]) {
          const oldStart = parseInt(match[1], 10);
          const oldLines = match[2] ? parseInt(match[2], 10) : 1;
          const newStart = parseInt(match[3], 10);
          const newLines = match[4] ? parseInt(match[4], 10) : 1;

          currentHunk = {
            filePath: currentFile,
            oldStart,
            oldLines,
            newStart,
            newLines,
            lines: []
          };

          files.get(currentFile)!.push(currentHunk);
        }
      }
      // Content lines
      else if (currentHunk && (line.startsWith('+') || line.startsWith('-') || line.startsWith(' '))) {
        currentHunk.lines.push(line);
      }

      i++;
    }

    return { files };
  }

  private async performReview(diffPath: string): Promise<string> {
    core.info("🤖 Performing AI code review...");

    const workspaceDir = this.getWorkspaceDirectory();
    const reviewOptions: ReviewOptions = {
      projectPath: workspaceDir,
      prTitle: this.prInfo.title,
      prDescription: this.prInfo.body,
      diffPath: diffPath,
      repoOwner: this.prInfo.owner,
      repoName: this.prInfo.repo,
      commitSha: this.prInfo.headSha,
    };

    core.info(`🔍 Analyzing project at: ${workspaceDir}`);
    const result = await performCodeReview(reviewOptions);
    core.info("✅ Code review completed");

    return result;
  }

  private async postReviewComment(reviewResult: string): Promise<void> {
    core.info("💬 Posting review comment...");

    // Parse the review result to extract structured data
    const parsedResult = this.parseReviewResult(reviewResult);

    // Get previous review results for comparison and dismiss old reviews
    const previousReviews = await this.getPreviousReviewsAndDismissOld();

    // Compare with previous reviews to identify fixed/new issues
    const comparison = this.compareReviews(parsedResult, previousReviews);

    // Create a unified review with both overview and line comments
    const commentBody = this.formatMainReviewComment(parsedResult, comparison);
    await this.createUnifiedPullRequestReview(commentBody, parsedResult);

    core.info("✅ Review posted");
  }

  private parseReviewResult(reviewResult: string): ReviewResult {
    core.info("🔍 Starting to parse review result...");

    // Generate a unique review ID with PR association
    const prId = `pr${this.prInfo.number}`;
    const commitShort = this.prInfo.headSha.substring(0, 8);
    const timestampShort = Date.now().toString().slice(-6); // Last 6 digits for brevity
    const reviewId = `${prId}_${commitShort}_${timestampShort}`;
    const timestamp = new Date().toISOString();

    // Log the review result for debugging (first 500 chars)
    core.info(`📝 Review result preview: ${reviewResult.substring(0, 500)}...`);

    // Extract issues from the review result using regex patterns
    const issues: ReviewIssue[] = [];

    // Parse different types of issues from the review text
    // Updated patterns to match the prompt.txt format exactly
    const bugPattern = /# Bugs\s*\n([\s\S]*?)(?=\n# |$)/g;
    const smellPattern = /# Code Smells\s*\n([\s\S]*?)(?=\n# |$)/g;
    const securityPattern = /# Security Issues\s*\n([\s\S]*?)(?=\n# |$)/g;
    const performancePattern = /# Performance Issues\s*\n([\s\S]*?)(?=\n# |$)/g;

    let issueId = 1;

    // Parse different issue types
    core.info("🔍 Parsing bugs...");
    this.parseIssuesFromSection(reviewResult, bugPattern, 'bug', issues, issueId);

    core.info("🔍 Parsing code smells...");
    this.parseIssuesFromSection(reviewResult, smellPattern, 'code_smell', issues, issueId);

    core.info("🔍 Parsing security issues...");
    this.parseIssuesFromSection(reviewResult, securityPattern, 'security', issues, issueId);

    core.info("🔍 Parsing performance issues...");
    this.parseIssuesFromSection(reviewResult, performancePattern, 'performance', issues, issueId);

    const result = {
      reviewId,
      timestamp,
      commitSha: this.prInfo.headSha,
      summary: this.extractSummaryFromReview(reviewResult),
      issues,
      totalIssues: issues.length
    };

    core.info(`✅ Parsing complete. Found ${result.totalIssues} total issues`);
    return result;
  }

  private parseIssuesFromSection(reviewResult: string, pattern: RegExp, type: ReviewIssue['type'], issues: ReviewIssue[], issueId: number): void {
    const matches = reviewResult.match(pattern);
    if (matches && matches.length > 0) {
      // The pattern now captures the content after the header, so we use matches[1] if it exists
      const sectionContent = matches[0];
      core.info(`🔍 Found ${type} section: ${sectionContent.substring(0, 100)}...`);

      // Extract individual issues from the section content
      const issueMatches = sectionContent.match(/## \d+\. .+?(?=## \d+\.|$)/gs);
      if (issueMatches && issueMatches.length > 0) {
        core.info(`📝 Found ${issueMatches.length} ${type} issues`);
        issueMatches.forEach((issueText, index) => {
          const issue = this.parseIssueFromText(issueText, type, `${type}_${issueId + index}`);
          if (issue) {
            issues.push(issue);
            core.info(`✅ Parsed ${type} issue: ${issue.title}`);
          } else {
            core.warning(`⚠️ Failed to parse ${type} issue from text: ${issueText.substring(0, 100)}...`);
          }
        });
      } else {
        core.info(`ℹ️ No individual issues found in ${type} section`);
      }
    } else {
      core.info(`ℹ️ No ${type} section found in review result`);
    }
  }

  private parseIssueFromText(text: string, type: ReviewIssue['type'], id: string): ReviewIssue | null {
    core.info(`🔍 Parsing ${type} issue text: ${text.substring(0, 200)}...`);

    // Extract title from the issue heading
    const titleMatch = text.match(/## \d+\. (.+?)(?:\n|$)/);
    if (!titleMatch) {
      core.warning(`⚠️ No title found in ${type} issue text`);
      return null;
    }

    const title = titleMatch[1]?.trim() || 'Unknown Issue';
    core.info(`📝 Found ${type} issue title: ${title}`);

    // Extract severity, description, location, etc. from the text
    const severityMatch = text.match(/\*\*严重程度\*\*[：:]\s*🟡\s*\*\*(\w+)\*\*|\*\*严重程度\*\*[：:]\s*🟢\s*\*\*(\w+)\*\*|\*\*严重程度\*\*[：:]\s*🔴\s*\*\*(\w+)\*\*/);
    const locationMatch = text.match(/\*\*位置\*\*[：:]\s*(.+?)(?:\n|$)/);
    const descriptionMatch = text.match(/\*\*描述\*\*[：:]\s*([\s\S]*?)(?=\*\*位置\*\*|\*\*建议修改\*\*|\*\*AI修复Prompt\*\*|$)/);
    const suggestionMatch = text.match(/\*\*建议修改\*\*[：:]\s*([\s\S]*?)(?=\*\*AI修复Prompt\*\*|$)/);
    const fixPromptMatch = text.match(/\*\*AI修复Prompt\*\*[：:]\s*```\s*([\s\S]*?)\s*```/);

    if (!descriptionMatch || !descriptionMatch[1]) {
      core.warning(`⚠️ No description found in ${type} issue: ${title}`);
      return null;
    }

    const severityText = severityMatch?.[1] || severityMatch?.[2] || severityMatch?.[3] || 'medium';
    const severity = this.mapSeverity(severityText);
    const description = descriptionMatch[1].trim();
    const location = locationMatch?.[1]?.trim() || '';

    // Parse file path and line number from location
    const { filePath, lineNumber, startLine, endLine } = this.parseLocationInfo(location);

    return {
      id,
      type,
      severity,
      title,
      description,
      location,
      filePath,
      lineNumber,
      startLine,
      endLine,
      fixPrompt: fixPromptMatch?.[1]?.trim(),
      suggestion: suggestionMatch?.[1]?.trim()
    };
  }

  private parseLocationInfo(location: string): {
    filePath?: string;
    lineNumber?: number;
    startLine?: number;
    endLine?: number;
  } {
    // Parse formats like:
    // "src/components/Button.tsx:45"
    // "src/utils/helper.js:12-18"
    // "README.md#L25-L30"
    const fileLineMatch = location.match(/^([^:]+):(\d+)(?:-(\d+))?/);
    const githubLineMatch = location.match(/^([^#]+)#L(\d+)(?:-L(\d+))?/);
    
    if (fileLineMatch) {
      const [, filePath, startLineStr, endLineStr] = fileLineMatch;
      if (filePath && startLineStr) {
        const startLine = parseInt(startLineStr, 10);
        const endLine = endLineStr ? parseInt(endLineStr, 10) : undefined;

        return {
          filePath: filePath.trim(),
          lineNumber: endLine || startLine, // Use end line if available, otherwise start line
          startLine,
          endLine
        };
      }
    }

    if (githubLineMatch) {
      const [, filePath, startLineStr, endLineStr] = githubLineMatch;
      if (filePath && startLineStr) {
        const startLine = parseInt(startLineStr, 10);
        const endLine = endLineStr ? parseInt(endLineStr, 10) : undefined;

        return {
          filePath: filePath.trim(),
          lineNumber: endLine || startLine,
          startLine,
          endLine
        };
      }
    }
    
    return {};
  }

  private isLineInDiff(filePath: string, lineNumber: number): boolean {
    core.info(`🔍 Checking line ${filePath}:${lineNumber} - validation enabled for PR commit range`);

    if (!this.parsedDiff || !filePath || !lineNumber) {
      core.info(`❌ Missing diff data or invalid parameters`);
      return false;
    }

    const hunks = this.parsedDiff.files.get(filePath);
    if (!hunks || hunks.length === 0) {
      core.info(`❌ No hunks found for file: ${filePath}`);
      return false;
    }

    // Check if the line number falls within any hunk's new line range
    for (const hunk of hunks) {
      const hunkEndLine = hunk.newStart + hunk.newLines - 1;
      core.info(`🔍 Checking hunk range: ${hunk.newStart}-${hunkEndLine} for line ${lineNumber}`);

      if (lineNumber >= hunk.newStart && lineNumber <= hunkEndLine) {
        // For PR review, we want to allow comments on any line within the diff range
        // This includes added lines (+), removed lines (-), and context lines ( )
        let currentNewLine = hunk.newStart;
        for (const hunkLine of hunk.lines) {
          if (hunkLine.startsWith('+') || hunkLine.startsWith(' ')) {
            if (currentNewLine === lineNumber) {
              core.info(`✅ Line ${lineNumber} found in diff range`);
              return true; // Allow comments on any line in the PR diff
            }
            currentNewLine++;
          }
        }
      }
    }

    core.info(`❌ Line ${lineNumber} not found in any diff hunk for ${filePath}`);
    return false;
  }

  private mapSeverity(severityText: string): ReviewIssue['severity'] {
    const lowerText = severityText.toLowerCase();
    if (lowerText.includes('高') || lowerText.includes('critical')) return 'critical';
    if (lowerText.includes('中') || lowerText.includes('medium')) return 'medium';
    if (lowerText.includes('低') || lowerText.includes('low')) return 'low';
    return 'medium';
  }

  private extractTitleFromDescription(description: string): string {
    // Extract the first sentence or first 50 characters as title
    const firstLine = description.split('\n')[0] || '';
    return firstLine.length > 50 ? firstLine.substring(0, 47) + '...' : firstLine;
  }

  private getFilesWithIssues(issues: ReviewIssue[]): Array<{
    filePath: string;
    issues: ReviewIssue[];
    description: string;
  }> {
    const fileMap = new Map<string, ReviewIssue[]>();
    
    // Group issues by file
    issues.forEach(issue => {
      if (issue.filePath) {
        if (!fileMap.has(issue.filePath)) {
          fileMap.set(issue.filePath, []);
        }
        fileMap.get(issue.filePath)!.push(issue);
      }
    });

    // Convert to array with descriptions
    return Array.from(fileMap.entries()).map(([filePath, fileIssues]) => {
      const issueTypes = [...new Set(fileIssues.map(issue => this.getTypeName(issue.type)))];
      const description = issueTypes.length > 1 
        ? `${issueTypes.slice(0, -1).join(', ')}和${issueTypes.slice(-1)[0]}问题`
        : `${issueTypes[0]}问题`;
      
      return {
        filePath,
        issues: fileIssues,
        description
      };
    }).sort((a, b) => a.filePath.localeCompare(b.filePath));
  }

  private getSeverityEmoji(severity: ReviewIssue['severity']): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  private getTypeEmoji(type: ReviewIssue['type']): string {
    switch (type) {
      case 'bug': return '🐛';
      case 'security': return '🔒';
      case 'performance': return '⚡';
      case 'code_smell': return '🔍';
      default: return '❓';
    }
  }

  private getTypeName(type: ReviewIssue['type']): string {
    switch (type) {
      case 'bug': return '潜在 Bug';
      case 'security': return '安全问题';
      case 'performance': return '性能问题';
      case 'code_smell': return '代码异味';
      default: return '其他问题';
    }
  }

  private getSeverityDistribution(issues: ReviewIssue[]): string {
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    issues.forEach(issue => {
      counts[issue.severity]++;
    });

    const parts: string[] = [];
    if (counts.critical > 0) parts.push(`🔴${counts.critical}`);
    if (counts.high > 0) parts.push(`🟠${counts.high}`);
    if (counts.medium > 0) parts.push(`🟡${counts.medium}`);
    if (counts.low > 0) parts.push(`🟢${counts.low}`);

    return parts.join(' ');
  }

  private formatIssueForGitHub(issue: ReviewIssue, index: number): string {
    let formatted = `#### ${index}. ${issue.title}\n\n`;

    // Use GitHub alert syntax for better visibility
    const alertType = issue.severity === 'critical' || issue.severity === 'high' ? 'WARNING' : 'NOTE';
    formatted += `> [!${alertType}]\n`;
    formatted += `> **严重程度:** ${this.getSeverityEmoji(issue.severity)} ${this.getSeverityText(issue.severity)}\n\n`;

    formatted += `**📝 问题描述:**\n`;
    formatted += `${issue.description}\n\n`;

    if (issue.location) {
      formatted += `**📍 问题位置:**\n`;
      formatted += `\`${issue.location}\`\n\n`;
    }

    if (issue.fixPrompt) {
      formatted += `**🔧 修复建议:**\n`;
      formatted += `\`\`\`\n${issue.fixPrompt}\n\`\`\`\n\n`;
    }

    formatted += `---\n\n`;
    return formatted;
  }

  private extractSummaryFromReview(reviewResult: string): string {
    // Extract the summary section from the review
    const summaryMatch = reviewResult.match(/# Overall Comments[\s\S]*?(?=# |$)/);
    if (summaryMatch && summaryMatch[0]) {
      // Clean up the summary
      return summaryMatch[0].replace(/# Overall Comments\s*/, '').trim();
    }
    return '';
  }

  private async getPreviousReviewsAndDismissOld(): Promise<ReviewResult[]> {
    try {
      // Get all reviews on this PR
      const reviews = await this.octokit.rest.pulls.listReviews({
        owner: this.prInfo.owner,
        repo: this.prInfo.repo,
        pull_number: this.prInfo.number,
      });

      const reviewResults: ReviewResult[] = [];
      const reviewsToDismiss: { id: number; nodeId: string; state: string }[] = [];

      // Parse previous AI Code Review reviews and collect them for dismissing
      for (const review of reviews.data) {
        if (review.body?.includes("Bugment Code Review") &&
            review.body?.includes("REVIEW_DATA:") &&
            review.state !== 'DISMISSED') {
          try {
            const reviewDataMatch = review.body.match(/REVIEW_DATA:\s*```json\s*([\s\S]*?)\s*```/);
            if (reviewDataMatch && reviewDataMatch[1]) {
              const reviewData = JSON.parse(reviewDataMatch[1]);
              reviewResults.push(reviewData);

              // Only collect reviews that can be dismissed
              // According to GitHub API docs, only PENDING reviews can be dismissed
              // COMMENTED and REQUEST_CHANGES reviews cannot be dismissed
              if (review.state === 'PENDING') {
                reviewsToDismiss.push({ id: review.id, nodeId: review.node_id, state: review.state });
              } else {
                core.info(`Skipping dismiss for review ${review.id} with state: ${review.state} (cannot be dismissed)`);
              }
            }
          } catch (error) {
            core.warning(`Failed to parse previous review data: ${error}`);
          }
        }
      }

      // Get previous line-level comments and mark resolved issues
      await this.markResolvedLineComments(reviewResults);

      // Dismiss all previous AI Code Review reviews that can be dismissed
      if (reviewsToDismiss.length > 0) {
        core.info(`🗑️ Attempting to dismiss ${reviewsToDismiss.length} previous reviews`);
        for (const review of reviewsToDismiss) {
          try {
            await this.octokit.rest.pulls.dismissReview({
              owner: this.prInfo.owner,
              repo: this.prInfo.repo,
              pull_number: this.prInfo.number,
              review_id: review.id,
              message: "Superseded by newer AI Code Review"
            });
            core.info(`✅ Dismissed previous review: ${review.id} (state: ${review.state})`);
          } catch (error) {
            core.warning(`⚠️ Failed to dismiss review ${review.id}: ${error}`);
          }
        }
      } else {
        core.info(`ℹ️ No previous reviews to dismiss`);
      }

      // Sort by timestamp (newest first)
      return reviewResults.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      core.warning(`Failed to get previous reviews: ${error}`);
      return [];
    }
  }

  private async markResolvedLineComments(previousReviews: ReviewResult[]): Promise<void> {
    try {
      // Use GraphQL to get review threads and resolve them
      const reviewThreads = await this.getReviewThreadsWithComments();

      let resolvedCount = 0;
      let processedCount = 0;

      // Find previous AI-generated comments that are no longer relevant
      for (const thread of reviewThreads) {
        if (thread.isResolved) {
          continue; // Skip already resolved threads
        }

        // Check if this thread contains AI-generated comments
        const hasAIComment = thread.comments.some((comment: any) =>
          comment.body?.includes('**🐛') || comment.body?.includes('**🔍') ||
          comment.body?.includes('**🔒') || comment.body?.includes('**⚡')
        );

        if (hasAIComment) {
          processedCount++;

          // Check if the issue is still relevant based on the first comment in the thread
          const firstComment = thread.comments[0];
          const isStillRelevant = this.isCommentStillRelevant(firstComment, previousReviews);

          if (!isStillRelevant) {
            // Use GraphQL to resolve the conversation
            try {
              await this.resolveReviewThread(thread.id);
              resolvedCount++;
              core.info(`✅ Resolved conversation thread ${thread.id}`);
            } catch (error) {
              core.warning(`Failed to resolve thread ${thread.id}: ${error}`);
            }
          }
        }
      }

      if (processedCount > 0) {
        core.info(`📝 Processed ${processedCount} review threads, resolved ${resolvedCount} conversations`);
      }
    } catch (error) {
      core.warning(`Failed to process review threads: ${error}`);
    }
  }

  private async getReviewThreadsWithComments(): Promise<any[]> {
    const query = `
      query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) {
            reviewThreads(first: 100) {
              nodes {
                id
                isResolved
                comments(first: 50) {
                  nodes {
                    id
                    body
                    path
                    line
                    author {
                      login
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await this.octokit.graphql(query, {
        owner: this.prInfo.owner,
        name: this.prInfo.repo,
        number: this.prInfo.number,
      });

      return (response as any).repository.pullRequest.reviewThreads.nodes || [];
    } catch (error) {
      core.warning(`Failed to fetch review threads: ${error}`);
      return [];
    }
  }

  private async resolveReviewThread(threadId: string): Promise<void> {
    const mutation = `
      mutation($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
          thread {
            id
            isResolved
          }
        }
      }
    `;

    await this.octokit.graphql(mutation, {
      threadId: threadId,
    });
  }

  private isCommentStillRelevant(comment: any, previousReviews: ReviewResult[]): boolean {
    // Skip if already marked as resolved (for backward compatibility)
    if (comment.body?.includes('✅ **已解决**') || comment.body?.includes('~~')) {
      return true; // Don't process already resolved comments
    }

    const filePath = comment.path;
    const lineNumber = comment.line;

    // Check if the current review (latest) still has issues at this location
    if (previousReviews.length > 0) {
      const latestReview = previousReviews[0]; // Reviews are sorted by timestamp (newest first)
      if (latestReview && latestReview.issues) {
        const hasCurrentIssueAtLocation = latestReview.issues.some(issue =>
          issue.filePath === filePath && issue.lineNumber === lineNumber
        );

        // If the latest review still has an issue at this location, the comment is still relevant
        return hasCurrentIssueAtLocation;
      }
    }

    return true; // Assume still relevant if we can't determine otherwise
  }



  private compareReviews(currentReview: ReviewResult, previousReviews: ReviewResult[]): ReviewComparison {
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

    const newIssues: ReviewIssue[] = [];
    const fixedIssues: ReviewIssue[] = [];
    const persistentIssues: ReviewIssue[] = [];
    const modifiedIssues: { previous: ReviewIssue; current: ReviewIssue }[] = [];

    // Create maps for easier lookup
    const currentIssueMap = new Map(currentReview.issues.map(issue => [this.getIssueSignature(issue), issue]));
    const previousIssueMap = new Map(latestPreviousReview.issues.map(issue => [this.getIssueSignature(issue), issue]));

    // Find new and persistent issues
    for (const currentIssue of currentReview.issues) {
      const signature = this.getIssueSignature(currentIssue);
      const previousIssue = previousIssueMap.get(signature);

      if (!previousIssue) {
        newIssues.push(currentIssue);
      } else if (this.issuesAreSimilar(currentIssue, previousIssue)) {
        if (currentIssue.description !== previousIssue.description) {
          modifiedIssues.push({ previous: previousIssue, current: currentIssue });
        } else {
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

  private getIssueSignature(issue: ReviewIssue): string {
    // Create a signature based on type, location, and key parts of description
    const locationPart = issue.location || issue.filePath || '';
    const descriptionPart = issue.description.substring(0, 100);
    return `${issue.type}_${locationPart}_${descriptionPart}`.replace(/\s+/g, '_');
  }

  private issuesAreSimilar(issue1: ReviewIssue, issue2: ReviewIssue): boolean {
    return issue1.type === issue2.type &&
           issue1.location === issue2.location &&
           issue1.filePath === issue2.filePath &&
           issue1.lineNumber === issue2.lineNumber;
  }

  private formatMainReviewComment(reviewResult: ReviewResult, comparison: ReviewComparison): string {
    let content = `## Bugment Code Review\n\n`;
    
    // Add PR summary based on the original review
    if (reviewResult.summary && reviewResult.summary.trim()) {
      content += `${reviewResult.summary}\n\n`;
    }

    // Add reviewed changes section
    content += `### 审查结果\n\n`;
    content += `Bugment 审查了代码变更并生成了 ${reviewResult.totalIssues} 条评论。\n\n`;

    // Check if this is a clean PR (no issues found)
    const hasAnyIssues = reviewResult.totalIssues > 0;
    // Create file summary table if there are issues with file locations
    const filesWithIssues = this.getFilesWithIssues(reviewResult.issues);
    if (filesWithIssues.length > 0) {
      content += `| 文件 | 发现的问题 |\n`;
      content += `| ---- | ---------- |\n`;
      
      filesWithIssues.forEach(({ filePath, issues, description }) => {
        const issueCount = issues.length;
        const severityDistribution = this.getSeverityDistribution(issues);
        content += `| ${filePath} | ${issueCount} 个问题 (${severityDistribution}) - ${description} |\n`;
      });
      content += `\n`;
    }

    // Add status information if there are changes
    const hasStatusChanges = comparison.fixedCount > 0 || comparison.newCount > 0 || comparison.persistentCount > 0;
    if (hasStatusChanges) {
      content += `### 变更摘要\n\n`;
      if (comparison.fixedCount > 0) {
        content += `- ✅ **${comparison.fixedCount}** 个问题已修复\n`;
      }
      if (comparison.newCount > 0) {
        content += `- 🆕 **${comparison.newCount}** 个新问题发现\n`;
      }
      if (comparison.persistentCount > 0) {
        content += `- ⚠️ **${comparison.persistentCount}** 个问题仍需关注\n`;
      }
      content += `\n`;
    }

    // Show success message for clean PRs
    if (!hasAnyIssues && !hasStatusChanges) {
      content += `### 🎉 优秀的工作！\n\n`;
      content += `此 Pull Request 未发现任何问题，代码符合质量标准。\n\n`;
    }

    // Add issues summary for low confidence issues (if any)
    const lowConfidenceIssues = reviewResult.issues.filter(issue => issue.severity === 'low');
    if (lowConfidenceIssues.length > 0) {
      content += `<details>\n`;
      content += `<summary>由于置信度较低而抑制的评论 (${lowConfidenceIssues.length})</summary>\n\n`;
      content += `这些问题已被识别，但可能是误报或轻微建议。\n\n`;
      content += `</details>\n\n`;
    }

    // Add footer with action source
    content += `\n---\n*🤖 Powered by [Bugment AI Code Review](https://github.com/J3n5en/Bugment)*\n\n`;

    // Add hidden review data for future parsing
    const reviewDataJson = JSON.stringify(reviewResult, null, 2);
    const hiddenData = `<!-- REVIEW_DATA:\n\`\`\`json\n${reviewDataJson}\n\`\`\`\n-->`;

    return content + hiddenData;
  }

  private formatOriginalReviewContent(reviewResult: ReviewResult): string {
    let content = '';

    // Add summary if exists
    if (reviewResult.summary && reviewResult.summary.trim()) {
      content += reviewResult.summary + '\n\n';
    }

    if (reviewResult.issues.length > 0) {
      // Group issues by type
      const issuesByType = {
        bug: reviewResult.issues.filter(i => i.type === 'bug'),
        security: reviewResult.issues.filter(i => i.type === 'security'),
        performance: reviewResult.issues.filter(i => i.type === 'performance'),
        code_smell: reviewResult.issues.filter(i => i.type === 'code_smell')
      };

      // Create a summary table first
      content += `### 📋 问题统计\n\n`;
      content += `| 类型 | 数量 | 严重程度分布 |\n`;
      content += `|------|------|-------------|\n`;

      Object.entries(issuesByType).forEach(([type, issues]) => {
        if (issues.length > 0) {
          const typeEmoji = this.getTypeEmoji(type as ReviewIssue['type']);
          const typeName = this.getTypeName(type as ReviewIssue['type']);
          const severityCount = this.getSeverityDistribution(issues);
          content += `| ${typeEmoji} ${typeName} | ${issues.length} | ${severityCount} |\n`;
        }
      });
      content += `\n`;

      // Show issues by type in collapsible sections
      if (issuesByType.bug.length > 0) {
        content += `<details>\n`;
        content += `<summary>🐛 潜在 Bug (${issuesByType.bug.length} 个) - 点击展开详情</summary>\n\n`;
        issuesByType.bug.forEach((issue, index) => {
          content += this.formatIssueForGitHub(issue, index + 1);
        });
        content += `</details>\n\n`;
      }

      if (issuesByType.security.length > 0) {
        content += `<details>\n`;
        content += `<summary>🔒 安全问题 (${issuesByType.security.length} 个) - 点击展开详情</summary>\n\n`;
        issuesByType.security.forEach((issue, index) => {
          content += this.formatIssueForGitHub(issue, index + 1);
        });
        content += `</details>\n\n`;
      }

      if (issuesByType.performance.length > 0) {
        content += `<details>\n`;
        content += `<summary>⚡ 性能问题 (${issuesByType.performance.length} 个) - 点击展开详情</summary>\n\n`;
        issuesByType.performance.forEach((issue, index) => {
          content += this.formatIssueForGitHub(issue, index + 1);
        });
        content += `</details>\n\n`;
      }

      if (issuesByType.code_smell.length > 0) {
        content += `<details>\n`;
        content += `<summary>🔍 代码异味 (${issuesByType.code_smell.length} 个) - 点击展开详情</summary>\n\n`;
        issuesByType.code_smell.forEach((issue, index) => {
          content += this.formatIssueForGitHub(issue, index + 1);
        });
        content += `</details>\n\n`;
      }
    }

    return content;
  }





  private formatLineComment(issue: ReviewIssue): string {
    const severityText = this.getSeverityText(issue.severity);
    let comment = `**${this.getTypeEmoji(issue.type)} ${this.getTypeName(issue.type)}** - ${this.getSeverityEmoji(issue.severity)} ${severityText}\n\n`;
    
    comment += `${issue.description}\n\n`;
    
    if (issue.suggestion) {
      comment += '```suggestion\n';
      comment += issue.suggestion;
      comment += '\n```\n\n';
    }
    
    if (issue.fixPrompt) {
      comment += `**🔧 修复建议:**\n\`\`\`\n${issue.fixPrompt}\n\`\`\``;
    }
    
    return comment;
  }

  private getSeverityText(severity: ReviewIssue['severity']): string {
    switch (severity) {
      case 'critical': return '严重';
      case 'high': return '高';
      case 'medium': return '中等';
      case 'low': return '轻微';
      default: return '中等';
    }
  }

  private determineReviewEvent(reviewResult: ReviewResult): 'REQUEST_CHANGES' | 'COMMENT' {
    if (reviewResult.totalIssues > 0) {
      const hasCriticalOrHighIssues = reviewResult.issues.some(
        issue => issue.severity === 'critical' || issue.severity === 'high'
      );

      if (hasCriticalOrHighIssues) {
        return 'REQUEST_CHANGES';
      }
    }
    return 'COMMENT';
  }

  private async createUnifiedPullRequestReview(commentBody: string, reviewResult: ReviewResult): Promise<void> {
    // Create line-level comments for issues with file locations
    const lineComments: Array<{
      path: string;
      line: number;
      body: string;
      start_line?: number;
      start_side?: 'LEFT' | 'RIGHT';
      side?: 'LEFT' | 'RIGHT';
    }> = [];

    let validLineComments = 0;
    let invalidLineComments = 0;

    // Create line-level comments for each issue
    for (const issue of reviewResult.issues) {
      if (issue.filePath && issue.lineNumber) {
        // Validate that the line is within the diff
        if (!this.isLineInDiff(issue.filePath, issue.lineNumber)) {
          core.warning(`⚠️ Skipping line comment for ${issue.filePath}:${issue.lineNumber} - not in diff range`);
          invalidLineComments++;
          continue;
        }

        const lineCommentBody = this.formatLineComment(issue);

        const lineComment: any = {
          path: issue.filePath,
          line: issue.lineNumber,
          body: lineCommentBody,
          side: 'RIGHT' as const
        };

        // Disable multi-line comments to avoid GitHub API errors
        // Multi-line comments require start_line and line to be in the same hunk
        // which is complex to validate, so we use single-line comments only
        if (issue.startLine && issue.endLine && issue.startLine !== issue.endLine) {
          core.info(`📝 Converting multi-line comment (${issue.startLine}-${issue.endLine}) to single-line comment at line ${issue.lineNumber}`);
        }

        lineComments.push(lineComment);
        validLineComments++;
      }
    }

    core.info(`📊 Line comments: ${validLineComments} valid, ${invalidLineComments} skipped (not in diff)`);

    // Determine the review event based on issues found
    const event = this.determineReviewEvent(reviewResult);

    // Create a single unified review with both overview and line comments
    const reviewParams: any = {
      owner: this.prInfo.owner,
      repo: this.prInfo.repo,
      pull_number: this.prInfo.number,
      body: commentBody,
      event: event,
      commit_id: this.prInfo.headSha
    };

    // Add line comments if any exist
    if (lineComments.length > 0) {
      reviewParams.comments = lineComments;
      core.info(`📝 Creating unified review with ${lineComments.length} line comments`);
    } else {
      core.info(`📝 Creating review with overview only (no line comments)`);
    }

    await this.octokit.rest.pulls.createReview(reviewParams);
  }


}

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

export { BugmentAction };
