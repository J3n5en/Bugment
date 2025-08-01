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
   * 获取之前的审查结果并隐藏旧评论
   */
  async getPreviousReviewsAndHideOld(): Promise<ReviewResult[]> {
    try {
      // 获取 PR 上的所有审查
      const reviews = await this.octokit.rest.pulls.listReviews({
        owner: this.prInfo.owner,
        repo: this.prInfo.repo,
        pull_number: this.prInfo.number,
      });

      const reviewResults: ReviewResult[] = [];

      // 解析之前的 AI 代码审查结果
      for (const review of reviews.data) {
        if (
          review.body?.includes("Bugment Code Review") &&
          review.body?.includes("REVIEW_DATA:") &&
          review.state !== "DISMISSED"
        ) {
          try {
            const reviewDataMatch = review.body.match(
              /REVIEW_DATA:\s*```json\s*([\s\S]*?)\s*```/
            );
            if (reviewDataMatch && reviewDataMatch[1]) {
              const reviewData = JSON.parse(reviewDataMatch[1]);
              reviewResults.push(reviewData);
            }
          } catch (error) {
            core.warning(`Failed to parse previous review data: ${error}`);
          }
        }
      }

      // 隐藏之前的 Bugment 评论
      await this.hidePreviousBugmentComments();

      // 标记已解决的行评论
      await this.markResolvedLineComments(reviewResults);

      // 按时间戳排序（最新的在前）
      return reviewResults.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    } catch (error) {
      core.warning(`Failed to get previous reviews: ${error}`);
      return [];
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
      "REVIEW_DATA:",
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
   * 标记已解决的行评论
   */
  private async markResolvedLineComments(
    previousReviews: ReviewResult[]
  ): Promise<void> {
    try {
      // 使用 GraphQL 获取审查线程并解决它们
      const reviewThreads = await this.getReviewThreadsWithComments();

      let resolvedCount = 0;
      let processedCount = 0;

      // 查找之前 AI 生成的不再相关的评论
      for (const thread of reviewThreads) {
        if (thread.isResolved) {
          continue; // 跳过已解决的线程
        }

        // 检查此线程是否包含 AI 生成的评论
        const hasAIComment = thread.comments?.some(
          (comment: any) =>
            comment.body?.includes("**🐛") ||
            comment.body?.includes("**🔍") ||
            comment.body?.includes("**🔒") ||
            comment.body?.includes("**⚡")
        );

        if (hasAIComment) {
          processedCount++;

          // 基于线程中的第一个评论检查问题是否仍然相关
          const firstComment = thread.comments[0];
          const isStillRelevant = this.isCommentStillRelevant(
            firstComment,
            previousReviews
          );

          if (!isStillRelevant) {
            // 使用 GraphQL 解决对话
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
        core.info(
          `📝 Processed ${processedCount} review threads, resolved ${resolvedCount} conversations`
        );
      }
    } catch (error) {
      core.warning(`Failed to process review threads: ${error}`);
    }
  }

  /**
   * 获取审查线程和评论
   */
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

  /**
   * 解决审查线程
   */
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

  /**
   * 检查评论是否仍然相关
   */
  private isCommentStillRelevant(
    comment: any,
    previousReviews: ReviewResult[]
  ): boolean {
    // 跳过已标记为已解决的评论（向后兼容）
    if (
      comment.body?.includes("✅ **已解决**") ||
      comment.body?.includes("~~")
    ) {
      return true; // 不处理已解决的评论
    }

    const filePath = comment.path;
    const lineNumber = comment.line;

    // 检查当前审查（最新）是否在此位置仍有问题
    if (previousReviews.length > 0) {
      const latestReview = previousReviews[0]; // 审查按时间戳排序（最新在前）
      if (latestReview && latestReview.issues) {
        const hasCurrentIssueAtLocation = latestReview.issues.some(
          (issue) =>
            issue.filePath === filePath && issue.lineNumber === lineNumber
        );

        // 如果最新审查在此位置仍有问题，则评论仍然相关
        return hasCurrentIssueAtLocation;
      }
    }

    return true; // 如果无法确定，则假设仍然相关
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
