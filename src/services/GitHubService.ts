import * as core from "@actions/core";
import * as github from "@actions/github";
import {
  PullRequestInfo,
  ReviewResult,
  LineComment,
  ActionInputs,
} from "../core/types";

/**
 * GitHub API 服务类
 * 负责所有与 GitHub API 的交互
 */
export class GitHubService {
  private octokit: ReturnType<typeof github.getOctokit>;
  private prInfo: PullRequestInfo;

  constructor(githubToken: string, prInfo: PullRequestInfo) {
    this.octokit = github.getOctokit(githubToken);
    this.prInfo = prInfo;
  }

  /**
   * 从 GitHub Actions 上下文提取 PR 信息
   */
  static extractPRInfo(): PullRequestInfo {
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

  /**
   * 解析 GitHub Actions 输入
   */
  static parseInputs(): ActionInputs {
    return {
      augmentAccessToken: core.getInput("augment_access_token", {
        required: true,
      }),
      augmentTenantUrl: core.getInput("augment_tenant_url", { required: true }),
      githubToken: core.getInput("github_token", { required: true }),
    };
  }

  /**
   * 通过 API 生成 diff
   */
  async generateDiff(baseSha?: string): Promise<string> {
    const base = baseSha || this.prInfo.baseSha;

    const diffResponse = await this.octokit.rest.repos.compareCommits({
      owner: this.prInfo.owner,
      repo: this.prInfo.repo,
      base: base,
      head: this.prInfo.headSha,
      mediaType: {
        format: "diff",
      },
    });

    return diffResponse.data as unknown as string;
  }

  /**
   * 隐藏之前的 Bugment 评论
   */
  async getPreviousReviewsAndHideOld(): Promise<void> {
    try {
      core.info("🔍 Hiding previous Bugment comments...");
      await this.hidePreviousBugmentComments();
      core.info("✅ Previous comments hidden");
    } catch (error) {
      core.warning(`Failed to hide previous comments: ${error}`);
    }
  }

  /**
   * 隐藏之前的 Bugment 评论
   */
  private async hidePreviousBugmentComments(): Promise<void> {
    try {
      core.info("🔍 Looking for previous Bugment reviews to hide...");

      // 获取当前时间，避免隐藏最近 30 秒内的评论
      const cutoffTime = new Date(Date.now() - 30000);

      // 获取 PR 上的所有审查
      const reviews = await this.octokit.rest.pulls.listReviews({
        owner: this.prInfo.owner,
        repo: this.prInfo.repo,
        pull_number: this.prInfo.number,
      });

      const reviewsToHide: Array<{
        id: string;
        nodeId: string;
        url: string;
        createdAt: string;
        state: string;
      }> = [];

      // 检查审查是否包含 Bugment 签名
      for (const review of reviews.data) {
        const reviewDate = new Date(
          review.submitted_at || new Date().toISOString()
        );
        if (
          this.isBugmentReview(review.body || "") &&
          reviewDate < cutoffTime &&
          review.state !== "DISMISSED"
        ) {
          reviewsToHide.push({
            id: review.id.toString(),
            nodeId: review.node_id,
            url: review.html_url,
            createdAt: review.submitted_at || new Date().toISOString(),
            state: review.state,
          });
        }
      }

      if (reviewsToHide.length > 0) {
        core.info(
          `📝 Found ${reviewsToHide.length} previous Bugment reviews to hide`
        );

        let hiddenCount = 0;
        for (const review of reviewsToHide) {
          try {
            await this.minimizeComment(review.nodeId);
            hiddenCount++;
            core.info(
              `✅ Hidden review (${review.state}) from ${review.createdAt}: ${review.url}`
            );
          } catch (error) {
            core.warning(`⚠️ Failed to hide review ${review.id}: ${error}`);
          }
        }

        core.info(
          `🎯 Successfully hidden ${hiddenCount}/${reviewsToHide.length} previous Bugment reviews`
        );
      } else {
        core.info("ℹ️ No previous Bugment reviews found to hide");
      }
    } catch (error) {
      core.warning(`Failed to hide previous Bugment reviews: ${error}`);
    }
  }

  /**
   * 检查是否为 Bugment 审查
   */
  private isBugmentReview(body: string): boolean {
    const bugmentReviewSignature =
      "🤖 Powered by [Bugment AI Code Review](https://github.com/J3n5en/Bugment)";

    const bugmentSignatures = [
      bugmentReviewSignature,
      "Bugment Code Review",
      "Bugment AI Code Review",
      "🤖 Powered by Bugment",
    ];

    return bugmentSignatures.some((signature) => body.includes(signature));
  }

  /**
   * 最小化评论
   */
  private async minimizeComment(commentNodeId: string): Promise<void> {
    const mutation = `
      mutation minimizeComment($id: ID!) {
        minimizeComment(input: { classifier: OUTDATED, subjectId: $id }) {
          clientMutationId
        }
      }
    `;

    await this.octokit.graphql(mutation, {
      id: commentNodeId,
    });
  }

  /**
   * 创建统一的 Pull Request 审查
   */
  async createUnifiedPullRequestReview(
    commentBody: string,
    lineComments: LineComment[],
    event: "REQUEST_CHANGES" | "COMMENT"
  ): Promise<void> {
    const reviewParams: any = {
      owner: this.prInfo.owner,
      repo: this.prInfo.repo,
      pull_number: this.prInfo.number,
      body: commentBody,
      event: event,
      commit_id: this.prInfo.headSha,
    };

    // 添加行评论（如果存在）
    if (lineComments.length > 0) {
      reviewParams.comments = lineComments;
      core.info(
        `📝 Creating unified review with ${lineComments.length} line comments`
      );
    } else {
      core.info(`📝 Creating review with overview only (no line comments)`);
    }

    await this.octokit.rest.pulls.createReview(reviewParams);
  }
}
