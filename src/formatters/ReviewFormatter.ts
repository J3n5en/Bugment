import * as core from "@actions/core";
import {
  ReviewResult,
  ReviewComparison,
  ReviewIssue,
  LineComment,
  ParsedDiff,
} from "../core/types";

/**
 * 审查格式化器类
 * 负责格式化审查结果和创建行评论
 */
export class ReviewFormatter {
  /**
   * 创建行评论
   */
  createLineComments(
    reviewResult: ReviewResult,
    isLineInDiffFn: (filePath: string, lineNumber: number) => boolean
  ): { valid: LineComment[]; invalid: number } {
    const lineComments: LineComment[] = [];
    let validLineComments = 0;
    let invalidLineComments = 0;

    core.info(
      `📝 Creating line comments for ${reviewResult.issues.length} issues...`
    );

    // 为每个问题创建行级评论
    for (const issue of reviewResult.issues) {
      if (issue.filePath && issue.lineNumber) {
        // 验证行是否在 diff 内
        if (!isLineInDiffFn(issue.filePath, issue.lineNumber)) {
          core.warning(
            `⚠️ Skipping line comment for ${issue.filePath}:${issue.lineNumber} - not in diff range`
          );
          invalidLineComments++;
          continue;
        }

        const lineCommentBody = this.formatLineComment(issue);

        const lineComment: LineComment = {
          path: issue.filePath,
          line: issue.lineNumber,
          body: lineCommentBody,
          side: "RIGHT",
        };

        // 禁用多行评论以避免 GitHub API 错误
        // 多行评论需要 start_line 和 line 在同一个 hunk 中
        // 这很难验证，所以我们只使用单行评论
        if (
          issue.startLine &&
          issue.endLine &&
          issue.startLine !== issue.endLine
        ) {
          core.info(
            `📝 Converting multi-line comment (${issue.startLine}-${issue.endLine}) to single-line comment at line ${issue.lineNumber}`
          );
        }

        lineComments.push(lineComment);
        validLineComments++;
      }
    }

    core.info(
      `📊 Line comments: ${validLineComments} valid, ${invalidLineComments} skipped (not in diff)`
    );

    return {
      valid: lineComments,
      invalid: invalidLineComments,
    };
  }

  /**
   * 格式化行评论
   */
  private formatLineComment(issue: ReviewIssue): string {
    const severityText = this.getSeverityText(issue.severity);
    let comment = `**${this.getTypeEmoji(issue.type)} ${this.getTypeName(issue.type)}** - ${this.getSeverityEmoji(issue.severity)} ${severityText}\n\n`;

    comment += `${issue.description}\n\n`;

    if (issue.suggestion) {
      comment += "```suggestion\n";
      comment += issue.suggestion;
      comment += "\n```\n\n";
    }

    if (issue.fixPrompt) {
      comment += `**🔧 修复建议:**\n\`\`\`\n${issue.fixPrompt}\n\`\`\``;
    }

    return comment;
  }

  /**
   * 验证行评论
   */
  validateLineComments(
    lineComments: LineComment[],
    parsedDiff: ParsedDiff,
    isLineInDiffFn: (filePath: string, lineNumber: number) => boolean
  ): { valid: LineComment[]; invalid: LineComment[] } {
    const valid: LineComment[] = [];
    const invalid: LineComment[] = [];

    for (const comment of lineComments) {
      if (isLineInDiffFn(comment.path, comment.line)) {
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
   * 格式化审查摘要
   */
  formatReviewSummary(reviewResult: ReviewResult): string {
    if (reviewResult.totalIssues === 0) {
      return "🎉 代码审查完成，未发现任何问题！";
    }

    const issuesByType = this.groupIssuesByType(reviewResult.issues);
    const parts: string[] = [];

    if (issuesByType.bug.length > 0) {
      parts.push(`${issuesByType.bug.length} 个潜在 Bug`);
    }
    if (issuesByType.security.length > 0) {
      parts.push(`${issuesByType.security.length} 个安全问题`);
    }
    if (issuesByType.performance.length > 0) {
      parts.push(`${issuesByType.performance.length} 个性能问题`);
    }
    if (issuesByType.code_smell.length > 0) {
      parts.push(`${issuesByType.code_smell.length} 个代码异味`);
    }

    return `🤖 代码审查完成，发现 ${reviewResult.totalIssues} 个问题：${parts.join("、")}`;
  }

  /**
   * 格式化比较结果
   */
  formatComparisonSummary(comparison: ReviewComparison): string {
    const parts: string[] = [];

    if (comparison.fixedCount > 0) {
      parts.push(`✅ ${comparison.fixedCount} 个问题已修复`);
    }
    if (comparison.newCount > 0) {
      parts.push(`🆕 ${comparison.newCount} 个新问题`);
    }
    if (comparison.persistentCount > 0) {
      parts.push(`⚠️ ${comparison.persistentCount} 个问题仍需关注`);
    }

    return parts.length > 0 ? parts.join("，") : "无变更";
  }

  /**
   * 按类型分组问题
   */
  private groupIssuesByType(issues: ReviewIssue[]): {
    bug: ReviewIssue[];
    security: ReviewIssue[];
    performance: ReviewIssue[];
    code_smell: ReviewIssue[];
  } {
    return {
      bug: issues.filter((i) => i.type === "bug"),
      security: issues.filter((i) => i.type === "security"),
      performance: issues.filter((i) => i.type === "performance"),
      code_smell: issues.filter((i) => i.type === "code_smell"),
    };
  }

  /**
   * 获取严重程度表情符号
   */
  private getSeverityEmoji(severity: ReviewIssue["severity"]): string {
    switch (severity) {
      case "critical":
        return "🔴";
      case "high":
        return "🟠";
      case "medium":
        return "🟡";
      case "low":
        return "🟢";
      default:
        return "⚪";
    }
  }

  /**
   * 获取类型表情符号
   */
  private getTypeEmoji(type: ReviewIssue["type"]): string {
    switch (type) {
      case "bug":
        return "🐛";
      case "security":
        return "🔒";
      case "performance":
        return "⚡";
      case "code_smell":
        return "🔍";
      default:
        return "❓";
    }
  }

  /**
   * 获取类型名称
   */
  private getTypeName(type: ReviewIssue["type"]): string {
    switch (type) {
      case "bug":
        return "潜在 Bug";
      case "security":
        return "安全问题";
      case "performance":
        return "性能问题";
      case "code_smell":
        return "代码异味";
      default:
        return "其他问题";
    }
  }

  /**
   * 获取严重程度文本
   */
  private getSeverityText(severity: ReviewIssue["severity"]): string {
    switch (severity) {
      case "critical":
        return "严重";
      case "high":
        return "高";
      case "medium":
        return "中等";
      case "low":
        return "轻微";
      default:
        return "中等";
    }
  }

  /**
   * 创建审查统计信息
   */
  createReviewStats(reviewResult: ReviewResult): {
    totalIssues: number;
    severityDistribution: { [key: string]: number };
    typeDistribution: { [key: string]: number };
    filesAffected: number;
  } {
    const severityDistribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    const typeDistribution = {
      bug: 0,
      security: 0,
      performance: 0,
      code_smell: 0,
    };

    const affectedFiles = new Set<string>();

    reviewResult.issues.forEach((issue) => {
      severityDistribution[issue.severity]++;
      typeDistribution[issue.type]++;
      if (issue.filePath) {
        affectedFiles.add(issue.filePath);
      }
    });

    return {
      totalIssues: reviewResult.totalIssues,
      severityDistribution,
      typeDistribution,
      filesAffected: affectedFiles.size,
    };
  }
}
