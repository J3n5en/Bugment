import * as core from "@actions/core";
import {
  ReviewResult,
  ReviewComparison,
  ReviewIssue,
  ReviewEvent,
  LineComment,
} from "./types";

/**
 * 审查工作流管理类
 * 负责管理审查的状态和流程控制
 */
export class ReviewWorkflow {
  /**
   * 比较当前审查与历史审查结果
   */
  static compareReviews(
    currentReview: ReviewResult,
    previousReviews: ReviewResult[]
  ): ReviewComparison {
    if (previousReviews.length === 0) {
      // 首次审查 - 所有问题都是新的
      return {
        newIssues: currentReview.issues,
        fixedIssues: [],
        persistentIssues: [],
        modifiedIssues: [],
        fixedCount: 0,
        newCount: currentReview.issues.length,
        persistentCount: 0,
      };
    }

    const latestPreviousReview = previousReviews[0];
    if (!latestPreviousReview) {
      // 没有找到之前的审查，视为首次审查
      return {
        newIssues: currentReview.issues,
        fixedIssues: [],
        persistentIssues: [],
        modifiedIssues: [],
        fixedCount: 0,
        newCount: currentReview.issues.length,
        persistentCount: 0,
      };
    }

    const newIssues: ReviewIssue[] = [];
    const fixedIssues: ReviewIssue[] = [];
    const persistentIssues: ReviewIssue[] = [];
    const modifiedIssues: { previous: ReviewIssue; current: ReviewIssue }[] =
      [];

    // 创建映射以便快速查找
    const currentIssueMap = new Map(
      currentReview.issues.map((issue) => [
        this.getIssueSignature(issue),
        issue,
      ])
    );
    const previousIssueMap = new Map(
      latestPreviousReview.issues.map((issue) => [
        this.getIssueSignature(issue),
        issue,
      ])
    );

    // 查找新问题和持续存在的问题
    for (const currentIssue of currentReview.issues) {
      const signature = this.getIssueSignature(currentIssue);
      const previousIssue = previousIssueMap.get(signature);

      if (!previousIssue) {
        newIssues.push(currentIssue);
      } else if (this.issuesAreSimilar(currentIssue, previousIssue)) {
        if (currentIssue.description !== previousIssue.description) {
          modifiedIssues.push({
            previous: previousIssue,
            current: currentIssue,
          });
        } else {
          persistentIssues.push(currentIssue);
        }
      }
    }

    // 查找已修复的问题
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
      persistentCount: persistentIssues.length,
    };
  }

  /**
   * 生成问题签名用于比较
   */
  private static getIssueSignature(issue: ReviewIssue): string {
    const locationPart = issue.location || issue.filePath || "";
    const descriptionPart = issue.description.substring(0, 100);
    return `${issue.type}_${locationPart}_${descriptionPart}`.replace(
      /\s+/g,
      "_"
    );
  }

  /**
   * 判断两个问题是否相似
   */
  private static issuesAreSimilar(
    issue1: ReviewIssue,
    issue2: ReviewIssue
  ): boolean {
    return (
      issue1.type === issue2.type &&
      issue1.location === issue2.location &&
      issue1.filePath === issue2.filePath &&
      issue1.lineNumber === issue2.lineNumber
    );
  }

  /**
   * 确定审查事件类型
   */
  static determineReviewEvent(
    reviewResult: ReviewResult
  ): "REQUEST_CHANGES" | "COMMENT" {
    if (reviewResult.totalIssues > 0) {
      const hasCriticalOrHighIssues = reviewResult.issues.some(
        (issue) => issue.severity === "critical" || issue.severity === "high"
      );

      if (hasCriticalOrHighIssues) {
        return "REQUEST_CHANGES";
      }
    }
    return "COMMENT";
  }

  /**
   * 验证行评论是否在 diff 范围内
   */
  static validateLineComments(
    lineComments: LineComment[],
    diffData: any
  ): { valid: LineComment[]; invalid: LineComment[] } {
    const valid: LineComment[] = [];
    const invalid: LineComment[] = [];

    for (const comment of lineComments) {
      if (this.isLineInDiff(comment.path, comment.line, diffData)) {
        valid.push(comment);
      } else {
        invalid.push(comment);
        core.warning(
          `⚠️ Skipping line comment for ${comment.path}:${comment.line} - not in diff range`
        );
      }
    }

    return { valid, invalid };
  }

  /**
   * 检查行是否在 diff 范围内
   */
  private static isLineInDiff(
    filePath: string,
    lineNumber: number,
    diffData: any
  ): boolean {
    // 这里将调用 DiffParser 的验证逻辑
    // 临时返回 true
    return true;
  }

  /**
   * 生成审查事件
   */
  static createReviewEvent(
    reviewResult: ReviewResult,
    comparison: ReviewComparison,
    lineComments: LineComment[]
  ): ReviewEvent {
    const eventType = this.determineReviewEvent(reviewResult);

    return {
      type: eventType,
      body: "", // 这里将调用 CommentFormatter 生成
      lineComments,
    };
  }
}
