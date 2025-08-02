import * as core from "@actions/core";
import { ReviewIssue } from "../core/types";

/**
 * 问题工具类
 * 提供问题相关的工具函数
 */
export class IssueUtils {
  /**
   * 验证问题数据
   */
  static validateIssue(issue: ReviewIssue): boolean {
    if (
      !issue.id ||
      !issue.type ||
      !issue.severity ||
      !issue.title ||
      !issue.description
    ) {
      core.warning(`Invalid issue data: missing required fields`);
      return false;
    }

    // 检查类型是否有效
    const validTypes = ["bug", "code_smell", "security", "performance"];
    if (!validTypes.includes(issue.type)) {
      core.warning(`Invalid issue type: ${issue.type}`);
      return false;
    }

    // 检查严重程度是否有效
    const validSeverities = ["low", "medium", "high", "critical"];
    if (!validSeverities.includes(issue.severity)) {
      core.warning(`Invalid issue severity: ${issue.severity}`);
      return false;
    }

    return true;
  }

  /**
   * 获取问题摘要
   */
  static getIssueSummary(issue: ReviewIssue): string {
    const typeEmoji = this.getTypeEmoji(issue.type);
    const severityEmoji = this.getSeverityEmoji(issue.severity);

    return `${typeEmoji} ${issue.title} (${severityEmoji} ${issue.severity})`;
  }

  /**
   * 获取类型表情符号
   */
  static getTypeEmoji(type: ReviewIssue["type"]): string {
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
   * 获取严重程度表情符号
   */
  static getSeverityEmoji(severity: ReviewIssue["severity"]): string {
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
   * 获取类型名称
   */
  static getTypeName(type: ReviewIssue["type"]): string {
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
  static getSeverityText(severity: ReviewIssue["severity"]): string {
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
   * 从描述中提取标题
   */
  static extractTitleFromDescription(description: string): string {
    // 提取第一句话或前 50 个字符作为标题
    const firstLine = description.split("\n")[0] || "";
    return firstLine.length > 50
      ? firstLine.substring(0, 47) + "..."
      : firstLine;
  }

  /**
   * 创建问题签名用于比较
   */
  static createIssueSignature(issue: ReviewIssue): string {
    const locationPart = issue.location || issue.filePath || "";
    const descriptionPart = issue.description.substring(0, 100);
    return `${issue.type}_${locationPart}_${descriptionPart}`.replace(
      /\s+/g,
      "_"
    );
  }

  /**
   * 检查两个问题是否相似
   */
  static areIssuesSimilar(issue1: ReviewIssue, issue2: ReviewIssue): boolean {
    return (
      issue1.type === issue2.type &&
      issue1.location === issue2.location &&
      issue1.filePath === issue2.filePath &&
      issue1.lineNumber === issue2.lineNumber
    );
  }

  /**
   * 按类型分组问题
   */
  static groupIssuesByType(
    issues: ReviewIssue[]
  ): Record<string, ReviewIssue[]> {
    return issues.reduce(
      (groups, issue) => {
        const type = issue.type;
        if (!groups[type]) {
          groups[type] = [];
        }
        groups[type].push(issue);
        return groups;
      },
      {} as Record<string, ReviewIssue[]>
    );
  }

  /**
   * 按严重程度分组问题
   */
  static groupIssuesBySeverity(
    issues: ReviewIssue[]
  ): Record<string, ReviewIssue[]> {
    return issues.reduce(
      (groups, issue) => {
        const severity = issue.severity;
        if (!groups[severity]) {
          groups[severity] = [];
        }
        groups[severity].push(issue);
        return groups;
      },
      {} as Record<string, ReviewIssue[]>
    );
  }

  /**
   * 计算问题统计信息
   */
  static calculateStatistics(issues: ReviewIssue[]) {
    const byType = issues.reduce(
      (acc, issue) => {
        acc[issue.type] = (acc[issue.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const bySeverity = issues.reduce(
      (acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalIssues: issues.length,
      byType,
      bySeverity,
    };
  }

  /**
   * 排序问题（按严重程度和类型）
   */
  static sortIssues(issues: ReviewIssue[]): ReviewIssue[] {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const typeOrder = { security: 0, bug: 1, performance: 2, code_smell: 3 };

    return [...issues].sort((a, b) => {
      // 首先按严重程度排序
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;

      // 然后按类型排序
      const typeDiff = typeOrder[a.type] - typeOrder[b.type];
      if (typeDiff !== 0) return typeDiff;

      // 最后按标题排序
      return a.title.localeCompare(b.title);
    });
  }
}
