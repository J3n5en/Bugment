import * as core from "@actions/core";
import { BugmentCore } from "./core/BugmentCore";
import { GitHubService } from "./services/GitHubService";
import { GitService } from "./services/GitService";
import { AugmentService } from "./services/AugmentService";
import { ReviewService } from "./services/ReviewService";
import { DiffParser } from "./parsers/DiffParser";
import { ReviewResultParser } from "./parsers/ReviewResultParser";
import { CommentFormatter } from "./formatters/CommentFormatter";
import { ReviewFormatter } from "./formatters/ReviewFormatter";
import { ReviewWorkflow } from "./core/ReviewWorkflow";
import { ValidationUtils } from "./utils/ValidationUtils";
import { ComparisonUtils } from "./utils/ComparisonUtils";
import { IgnoreManager } from "./utils/IgnoreManager";

/**
 * 重构后的 Bugment Action 类
 * 现在只负责协调各个模块的工作
 */
export class BugmentAction {
  private core: BugmentCore;
  private githubService: GitHubService;
  private gitService: GitService;
  private augmentService: AugmentService;
  private reviewService: ReviewService;
  private diffParser: DiffParser;
  private reviewResultParser: ReviewResultParser;
  private commentFormatter: CommentFormatter;
  private reviewFormatter: ReviewFormatter;
  private ignoreManager: IgnoreManager;

  constructor() {
    // 解析输入和 PR 信息
    const inputs = GitHubService.parseInputs();
    const prInfo = GitHubService.extractPRInfo();

    // 验证输入
    if (!ValidationUtils.validateActionInputs(inputs)) {
      throw new Error("Invalid action inputs");
    }

    if (!ValidationUtils.validatePullRequestInfo(prInfo)) {
      throw new Error("Invalid pull request info");
    }

    // 初始化核心组件
    this.core = new BugmentCore(inputs, prInfo);
    this.githubService = new GitHubService(inputs.githubToken, prInfo);
    this.gitService = new GitService(prInfo);
    this.augmentService = new AugmentService(inputs);
    this.reviewService = new ReviewService(prInfo, process.cwd());
    this.ignoreManager = new IgnoreManager(process.cwd());
    this.diffParser = new DiffParser(this.ignoreManager);
    this.reviewResultParser = new ReviewResultParser(prInfo);
    this.commentFormatter = new CommentFormatter();
    this.reviewFormatter = new ReviewFormatter();
  }

  /**
   * 执行完整的代码审查流程
   */
  async run(): Promise<void> {
    try {
      core.info("🚀 Starting Bugment AI Code Review...");

      // 1. 初始化忽略管理器
      await this.initializeIgnoreManager();

      // 2. 设置 Augment 认证
      await this.setupAuthentication();

      // 3. 生成 diff 文件
      const diffPath = await this.generateDiff();

      // 4. 执行代码审查
      const reviewResult = await this.performReview(diffPath);

      // 5. 发布审查评论
      await this.publishReview(reviewResult, diffPath);

      // 6. 设置输出
      this.setOutputs(reviewResult);

      core.info("✅ Code review completed successfully");
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * 初始化忽略管理器
   */
  private async initializeIgnoreManager(): Promise<void> {
    core.info("📋 Initializing ignore manager...");
    // IgnoreManager 在构造时已经初始化，这里只是记录日志
    core.info("✅ Ignore manager initialized");
  }

  /**
   * 设置认证
   */
  private async setupAuthentication(): Promise<void> {
    core.info("🔐 Setting up authentication...");
    await this.augmentService.setupAuthentication();

    // 验证认证
    const isValid = await this.augmentService.validateAuthentication();
    if (!isValid) {
      throw new Error("Failed to validate Augment authentication");
    }

    core.info("✅ Authentication setup completed");
  }

  /**
   * 生成 diff
   */
  private async generateDiff(): Promise<string> {
    core.info("📄 Generating diff...");
    const diffPath = await this.gitService.generateDiffFile();
    core.info(`✅ Diff generated: ${diffPath}`);
    return diffPath;
  }

  /**
   * 执行审查
   */
  private async performReview(diffPath: string): Promise<any> {
    core.info("🤖 Performing review...");

    // 验证审查选项
    const isValid = this.reviewService.validateReviewOptions(diffPath);
    if (!isValid) {
      throw new Error("Invalid review options");
    }

    // 准备审查环境
    await this.reviewService.prepareReviewEnvironment();

    // 执行审查
    const reviewResultText = await this.reviewService.performReview(diffPath);

    // 解析审查结果
    const reviewResult =
      this.reviewResultParser.parseReviewResult(reviewResultText);

    // 验证审查结果
    if (!ValidationUtils.validateReviewResult(reviewResult)) {
      core.warning("Review result validation failed, but continuing...");
    }

    core.info(
      `✅ Review completed with ${reviewResult.totalIssues} issues found`
    );
    return reviewResult;
  }

  /**
   * 发布审查结果
   */
  private async publishReview(
    reviewResult: any,
    diffPath: string
  ): Promise<void> {
    core.info("💬 Publishing review...");

    // 读取并解析 diff 内容
    const fs = await import("fs");
    const diffContent = await fs.promises.readFile(diffPath, "utf-8");

    if (!this.diffParser.validateDiffContent(diffContent)) {
      throw new Error("Invalid diff content");
    }

    const parsedDiff = this.diffParser.parseDiffContent(diffContent);
    this.core.diffData = parsedDiff;

    // 获取之前的审查结果
    const previousReviews =
      await this.githubService.getPreviousReviewsAndHideOld();

    // 比较审查结果
    const comparison = ComparisonUtils.compareReviews(
      reviewResult,
      previousReviews
    );

    // 创建行评论
    const { valid: lineComments } = this.reviewFormatter.createLineComments(
      reviewResult,
      parsedDiff,
      (filePath: string, lineNumber: number) =>
        this.diffParser.isLineInDiff(filePath, lineNumber, parsedDiff)
    );

    // 格式化主评论
    const commentBody = this.commentFormatter.formatMainReviewComment(
      reviewResult,
      comparison
    );

    // 确定审查事件类型
    const eventType = ReviewWorkflow.determineReviewEvent(reviewResult);

    // 创建统一的 PR 审查
    await this.githubService.createUnifiedPullRequestReview(
      commentBody,
      lineComments,
      eventType
    );

    core.info("✅ Review published successfully");
  }

  /**
   * 设置输出
   */
  private setOutputs(reviewResult: any): void {
    core.setOutput("review_result", JSON.stringify(reviewResult));
    core.setOutput("review_status", "success");
    core.setOutput("total_issues", reviewResult.totalIssues.toString());
    core.setOutput("review_id", reviewResult.reviewId);
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown): void {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`❌ Code review failed: ${errorMessage}`);
    core.setOutput("review_status", "failed");
    core.setOutput("total_issues", "0");
  }
}

/**
 * 主入口函数
 */
export async function run(): Promise<void> {
  const action = new BugmentAction();
  await action.run();
}

// 如果直接运行此文件，执行主函数
if (require.main === module) {
  run().catch((error) => {
    core.setFailed(error.message);
  });
}
