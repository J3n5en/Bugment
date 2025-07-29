#!/usr/bin/env node

import * as core from "@actions/core";
import * as github from "@actions/github";
import * as fs from "fs";
import * as path from "path";
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

class BugmentAction {
  private inputs: ActionInputs;
  private octokit: ReturnType<typeof github.getOctokit>;
  private prInfo: PullRequestInfo;

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

  private async generateDiffFile(): Promise<string> {
    core.info("📄 Generating PR diff file...");

    const diffResponse = await this.octokit.rest.repos.compareCommits({
      owner: this.prInfo.owner,
      repo: this.prInfo.repo,
      base: this.prInfo.baseSha,
      head: this.prInfo.headSha,
    });

    const diffPath = path.join(process.cwd(), "pr_diff.patch");
    await fs.promises.writeFile(
      diffPath,
      diffResponse.data.diff_url
        ? await this.fetchDiffContent(diffResponse.data.diff_url)
        : "No diff available"
    );

    core.info(`✅ Diff file generated: ${diffPath}`);
    return diffPath;
  }

  private async fetchDiffContent(diffUrl: string): Promise<string> {
    const response = await fetch(diffUrl);
    return await response.text();
  }

  private async performReview(diffPath: string): Promise<string> {
    core.info("🤖 Performing AI code review...");

    const reviewOptions: ReviewOptions = {
      projectPath: process.cwd(),
      prTitle: this.prInfo.title,
      prDescription: this.prInfo.body,
      diffPath: diffPath,
      repoOwner: this.prInfo.owner,
      repoName: this.prInfo.repo,
      commitSha: this.prInfo.headSha,
    };

    const result = await performCodeReview(reviewOptions);
    core.info("✅ Code review completed");

    return result;
  }

  private async postReviewComment(reviewResult: string): Promise<void> {
    core.info("💬 Posting review comment...");

    const commentBody = this.formatReviewComment(reviewResult);

    await this.replaceExistingComment(commentBody);

    core.info("✅ Review comment posted");
  }

  private formatReviewComment(reviewResult: string): string {
    const header = `## 🤖 Bugment AI Code Review\n\n`;
    const footer = `\n\n---\n*This review was generated by [Bugment](https://github.com/J3n5en/bugment) AI Code Review Action*`;

    return header + reviewResult + footer;
  }

  private async replaceExistingComment(commentBody: string): Promise<void> {
    // Find existing Bugment comment
    const comments = await this.octokit.rest.issues.listComments({
      owner: this.prInfo.owner,
      repo: this.prInfo.repo,
      issue_number: this.prInfo.number,
    });

    const existingComment = comments.data.find((comment) =>
      comment.body?.includes("Bugment AI Code Review")
    );

    if (existingComment) {
      await this.octokit.rest.issues.updateComment({
        owner: this.prInfo.owner,
        repo: this.prInfo.repo,
        comment_id: existingComment.id,
        body: commentBody,
      });
    } else {
      await this.createNewComment(commentBody);
    }
  }

  private async createNewComment(commentBody: string): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner: this.prInfo.owner,
      repo: this.prInfo.repo,
      issue_number: this.prInfo.number,
      body: commentBody,
    });
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
