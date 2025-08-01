import * as core from "@actions/core";
import { performCodeReview, ReviewOptions } from "../review";
import { PullRequestInfo, ReviewOptions as CoreReviewOptions } from "../core/types";

/**
 * 代码审查服务类
 * 负责执行实际的代码审查
 */
export class ReviewService {
  private prInfo: PullRequestInfo;
  private workspaceDir: string;

  constructor(prInfo: PullRequestInfo, workspaceDir: string) {
    this.prInfo = prInfo;
    this.workspaceDir = workspaceDir;
  }

  /**
   * 执行代码审查
   */
  async performReview(diffPath: string): Promise<string> {
    core.info("🤖 Performing AI code review...");

    const reviewOptions: ReviewOptions = {
      projectPath: this.workspaceDir,
      prTitle: this.prInfo.title,
      prDescription: this.prInfo.body,
      diffPath: diffPath,
      repoOwner: this.prInfo.owner,
      repoName: this.prInfo.repo,
      commitSha: this.prInfo.headSha,
    };

    core.info(`🔍 Analyzing project at: ${this.workspaceDir}`);
    const result = await performCodeReview(reviewOptions);
    core.info("✅ Code review completed");

    return result;
  }

  /**
   * 验证审查选项
   */
  validateReviewOptions(diffPath: string): boolean {
    try {
      // 检查必需的参数
      if (!this.prInfo.title) {
        core.warning("PR title is missing");
        return false;
      }

      if (!this.prInfo.owner || !this.prInfo.repo) {
        core.warning("Repository information is incomplete");
        return false;
      }

      if (!this.prInfo.headSha) {
        core.warning("Head SHA is missing");
        return false;
      }

      if (!diffPath) {
        core.warning("Diff path is missing");
        return false;
      }

      if (!this.workspaceDir) {
        core.warning("Workspace directory is missing");
        return false;
      }

      core.info("✅ Review options validated");
      return true;
    } catch (error) {
      core.warning(`Failed to validate review options: ${error}`);
      return false;
    }
  }

  /**
   * 获取审查选项摘要
   */
  getReviewOptionsSummary(diffPath: string): string {
    return `
Review Options Summary:
- Project: ${this.prInfo.owner}/${this.prInfo.repo}
- PR: #${this.prInfo.number} - ${this.prInfo.title}
- Commit: ${this.prInfo.headSha}
- Workspace: ${this.workspaceDir}
- Diff: ${diffPath}
    `.trim();
  }

  /**
   * 准备审查环境
   */
  async prepareReviewEnvironment(): Promise<boolean> {
    try {
      core.info("🔧 Preparing review environment...");

      // 检查工作空间目录是否存在
      const fs = await import("fs");
      if (!fs.existsSync(this.workspaceDir)) {
        core.error(`Workspace directory does not exist: ${this.workspaceDir}`);
        return false;
      }

      // 检查是否为 Git 仓库
      const path = await import("path");
      const gitDir = path.join(this.workspaceDir, ".git");
      if (!fs.existsSync(gitDir)) {
        core.warning("Workspace is not a Git repository");
        // 不返回 false，因为某些情况下可能不需要 .git 目录
      }

      core.info("✅ Review environment prepared");
      return true;
    } catch (error) {
      core.error(`Failed to prepare review environment: ${error}`);
      return false;
    }
  }

  /**
   * 清理审查环境
   */
  async cleanupReviewEnvironment(): Promise<void> {
    try {
      core.info("🧹 Cleaning up review environment...");
      
      // 这里可以添加清理逻辑，例如删除临时文件
      // 目前只是记录日志
      
      core.info("✅ Review environment cleaned up");
    } catch (error) {
      core.warning(`Failed to cleanup review environment: ${error}`);
    }
  }

  /**
   * 获取审查统计信息
   */
  getReviewStats(): {
    prNumber: number;
    repoFullName: string;
    commitSha: string;
    workspaceSize?: number;
  } {
    return {
      prNumber: this.prInfo.number,
      repoFullName: `${this.prInfo.owner}/${this.prInfo.repo}`,
      commitSha: this.prInfo.headSha,
      // workspaceSize 可以在需要时计算
    };
  }
}
