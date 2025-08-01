import * as core from "@actions/core";
import { ReviewResult, ReviewComparison, ReviewIssue } from "../core/types";

/**
 * 比较工具类
 * 提供审查结果比较功能
 */
export class ComparisonUtils {

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
    const modifiedIssues: { previous: ReviewIssue; current: ReviewIssue }[] = [];

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

    const comparison = {
      newIssues,
      fixedIssues,
      persistentIssues,
      modifiedIssues,
      fixedCount: fixedIssues.length,
      newCount: newIssues.length,
      persistentCount: persistentIssues.length,
    };

    core.info(
      `📊 Review comparison: ${comparison.newCount} new, ${comparison.fixedCount} fixed, ${comparison.persistentCount} persistent`
    );

    return comparison;
  }

  /**
   * 生成问题签名用于比较
   */
  static getIssueSignature(issue: ReviewIssue): string {
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
  static issuesAreSimilar(issue1: ReviewIssue, issue2: ReviewIssue): boolean {
    return (
      issue1.type === issue2.type &&
      issue1.location === issue2.location &&
      issue1.filePath === issue2.filePath &&
      issue1.lineNumber === issue2.lineNumber
    );
  }

  /**
   * 比较问题严重程度
   */
  static compareSeverity(
    severity1: ReviewIssue["severity"],
    severity2: ReviewIssue["severity"]
  ): number {
    const severityOrder = ["low", "medium", "high", "critical"];
    const index1 = severityOrder.indexOf(severity1);
    const index2 = severityOrder.indexOf(severity2);
    return index1 - index2;
  }

  /**
   * 检查审查结果是否有改进
   */
  static hasImprovement(comparison: ReviewComparison): boolean {
    return comparison.fixedCount > 0 || comparison.newCount === 0;
  }

  /**
   * 检查审查结果是否有恶化
   */
  static hasRegression(comparison: ReviewComparison): boolean {
    return comparison.newCount > comparison.fixedCount;
  }

  /**
   * 计算改进分数
   */
  static calculateImprovementScore(comparison: ReviewComparison): number {
    // 简单的改进分数计算：修复的问题数 - 新问题数
    return comparison.fixedCount - comparison.newCount;
  }

  /**
   * 获取比较摘要
   */
  static getComparisonSummary(comparison: ReviewComparison): string {
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
    if (comparison.modifiedIssues.length > 0) {
      parts.push(`🔄 ${comparison.modifiedIssues.length} 个问题已修改`);
    }

    return parts.length > 0 ? parts.join("，") : "无变更";
  }

  /**
   * 按严重程度分组问题
   */
  static groupIssuesBySeverity(issues: ReviewIssue[]): {
    critical: ReviewIssue[];
    high: ReviewIssue[];
    medium: ReviewIssue[];
    low: ReviewIssue[];
  } {
    return {
      critical: issues.filter((i) => i.severity === "critical"),
      high: issues.filter((i) => i.severity === "high"),
      medium: issues.filter((i) => i.severity === "medium"),
      low: issues.filter((i) => i.severity === "low"),
    };
  }

  /**
   * 按类型分组问题
   */
  static groupIssuesByType(issues: ReviewIssue[]): {
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
   * 查找最严重的问题
   */
  static findMostSevereIssue(issues: ReviewIssue[]): ReviewIssue | null {
    if (issues.length === 0) return null;

    const severityOrder = ["critical", "high", "medium", "low"];
    
    for (const severity of severityOrder) {
      const issuesWithSeverity = issues.filter((i) => i.severity === severity);
      if (issuesWithSeverity.length > 0) {
        return issuesWithSeverity[0];
      }
    }

    return issues[0];
  }

  /**
   * 计算严重程度分布
   */
  static calculateSeverityDistribution(issues: ReviewIssue[]): {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  } {
    const distribution = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      total: issues.length,
    };

    issues.forEach((issue) => {
      distribution[issue.severity]++;
    });

    return distribution;
  }

  /**
   * 计算类型分布
   */
  static calculateTypeDistribution(issues: ReviewIssue[]): {
    bug: number;
    security: number;
    performance: number;
    code_smell: number;
    total: number;
  } {
    const distribution = {
      bug: 0,
      security: 0,
      performance: 0,
      code_smell: 0,
      total: issues.length,
    };

    issues.forEach((issue) => {
      distribution[issue.type]++;
    });

    return distribution;
  }

  /**
   * 检查是否有高优先级问题
   */
  static hasHighPriorityIssues(issues: ReviewIssue[]): boolean {
    return issues.some(
      (issue) => issue.severity === "critical" || issue.severity === "high"
    );
  }

  /**
   * 过滤问题按严重程度
   */
  static filterIssuesBySeverity(
    issues: ReviewIssue[],
    minSeverity: ReviewIssue["severity"]
  ): ReviewIssue[] {
    const severityOrder = ["low", "medium", "high", "critical"];
    const minIndex = severityOrder.indexOf(minSeverity);
    
    return issues.filter((issue) => {
      const issueIndex = severityOrder.indexOf(issue.severity);
      return issueIndex >= minIndex;
    });
  }

  /**
   * 过滤问题按类型
   */
  static filterIssuesByType(
    issues: ReviewIssue[],
    types: ReviewIssue["type"][]
  ): ReviewIssue[] {
    return issues.filter((issue) => types.includes(issue.type));
  }
}
