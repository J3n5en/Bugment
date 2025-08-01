import { ReviewResult, ReviewIssue, ReviewComparison } from "../core/types";

/**
 * Markdown 格式化器类
 * 负责生成 Markdown 格式的输出
 */
export class MarkdownFormatter {

  /**
   * 创建审查报告的 Markdown
   */
  createReviewReport(
    reviewResult: ReviewResult,
    comparison?: ReviewComparison
  ): string {
    let markdown = `# 🤖 Bugment 代码审查报告\n\n`;

    // 添加基本信息
    markdown += `**审查 ID:** ${reviewResult.reviewId}\n`;
    markdown += `**时间戳:** ${new Date(reviewResult.timestamp).toLocaleString('zh-CN')}\n`;
    markdown += `**提交 SHA:** \`${reviewResult.commitSha}\`\n`;
    markdown += `**发现问题:** ${reviewResult.totalIssues} 个\n\n`;

    // 添加摘要
    if (reviewResult.summary && reviewResult.summary.trim()) {
      markdown += `## 📋 审查摘要\n\n`;
      markdown += `${reviewResult.summary}\n\n`;
    }

    // 添加变更比较（如果有）
    if (comparison) {
      markdown += this.formatComparisonSection(comparison);
    }

    // 添加问题统计
    markdown += this.formatIssueStatistics(reviewResult.issues);

    // 添加详细问题列表
    if (reviewResult.issues.length > 0) {
      markdown += this.formatDetailedIssues(reviewResult.issues);
    } else {
      markdown += `## 🎉 恭喜！\n\n`;
      markdown += `此次代码审查未发现任何问题，代码质量良好！\n\n`;
    }

    // 添加页脚
    markdown += `---\n`;
    markdown += `*由 [Bugment AI Code Review](https://github.com/J3n5en/Bugment) 生成*\n`;

    return markdown;
  }

  /**
   * 格式化比较部分
   */
  private formatComparisonSection(comparison: ReviewComparison): string {
    let section = `## 📊 变更对比\n\n`;

    if (comparison.fixedCount > 0) {
      section += `- ✅ **已修复问题:** ${comparison.fixedCount} 个\n`;
    }
    if (comparison.newCount > 0) {
      section += `- 🆕 **新发现问题:** ${comparison.newCount} 个\n`;
    }
    if (comparison.persistentCount > 0) {
      section += `- ⚠️ **持续存在问题:** ${comparison.persistentCount} 个\n`;
    }

    section += `\n`;
    return section;
  }

  /**
   * 格式化问题统计
   */
  private formatIssueStatistics(issues: ReviewIssue[]): string {
    if (issues.length === 0) {
      return "";
    }

    let section = `## 📈 问题统计\n\n`;

    // 按类型统计
    const typeStats = this.getTypeStatistics(issues);
    section += `### 按类型分布\n\n`;
    section += `| 类型 | 数量 | 百分比 |\n`;
    section += `|------|------|--------|\n`;

    Object.entries(typeStats).forEach(([type, count]) => {
      if (count > 0) {
        const percentage = ((count / issues.length) * 100).toFixed(1);
        const emoji = this.getTypeEmoji(type as ReviewIssue["type"]);
        const name = this.getTypeName(type as ReviewIssue["type"]);
        section += `| ${emoji} ${name} | ${count} | ${percentage}% |\n`;
      }
    });

    section += `\n`;

    // 按严重程度统计
    const severityStats = this.getSeverityStatistics(issues);
    section += `### 按严重程度分布\n\n`;
    section += `| 严重程度 | 数量 | 百分比 |\n`;
    section += `|----------|------|--------|\n`;

    Object.entries(severityStats).forEach(([severity, count]) => {
      if (count > 0) {
        const percentage = ((count / issues.length) * 100).toFixed(1);
        const emoji = this.getSeverityEmoji(severity as ReviewIssue["severity"]);
        const text = this.getSeverityText(severity as ReviewIssue["severity"]);
        section += `| ${emoji} ${text} | ${count} | ${percentage}% |\n`;
      }
    });

    section += `\n`;
    return section;
  }

  /**
   * 格式化详细问题列表
   */
  private formatDetailedIssues(issues: ReviewIssue[]): string {
    let section = `## 🔍 详细问题列表\n\n`;

    // 按类型分组
    const issuesByType = this.groupIssuesByType(issues);

    // 按严重程度排序（严重的在前）
    const severityOrder = ["critical", "high", "medium", "low"];
    
    Object.entries(issuesByType).forEach(([type, typeIssues]) => {
      if (typeIssues.length === 0) return;

      const emoji = this.getTypeEmoji(type as ReviewIssue["type"]);
      const name = this.getTypeName(type as ReviewIssue["type"]);
      
      section += `### ${emoji} ${name} (${typeIssues.length} 个)\n\n`;

      // 按严重程度排序
      const sortedIssues = typeIssues.sort((a, b) => {
        return severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity);
      });

      sortedIssues.forEach((issue, index) => {
        section += this.formatSingleIssue(issue, index + 1);
      });

      section += `\n`;
    });

    return section;
  }

  /**
   * 格式化单个问题
   */
  private formatSingleIssue(issue: ReviewIssue, index: number): string {
    let issueMarkdown = `#### ${index}. ${issue.title}\n\n`;

    // 添加严重程度标签
    const severityEmoji = this.getSeverityEmoji(issue.severity);
    const severityText = this.getSeverityText(issue.severity);
    issueMarkdown += `**严重程度:** ${severityEmoji} ${severityText}\n\n`;

    // 添加位置信息
    if (issue.location) {
      issueMarkdown += `**位置:** \`${issue.location}\`\n\n`;
    }

    // 添加描述
    issueMarkdown += `**描述:**\n${issue.description}\n\n`;

    // 添加修复建议
    if (issue.fixPrompt) {
      issueMarkdown += `**修复建议:**\n\`\`\`\n${issue.fixPrompt}\n\`\`\`\n\n`;
    }

    // 添加代码建议
    if (issue.suggestion) {
      issueMarkdown += `**代码建议:**\n\`\`\`\n${issue.suggestion}\n\`\`\`\n\n`;
    }

    issueMarkdown += `---\n\n`;
    return issueMarkdown;
  }

  /**
   * 按类型分组问题
   */
  private groupIssuesByType(issues: ReviewIssue[]): {
    [key: string]: ReviewIssue[];
  } {
    return {
      bug: issues.filter((i) => i.type === "bug"),
      security: issues.filter((i) => i.type === "security"),
      performance: issues.filter((i) => i.type === "performance"),
      code_smell: issues.filter((i) => i.type === "code_smell"),
    };
  }

  /**
   * 获取类型统计
   */
  private getTypeStatistics(issues: ReviewIssue[]): { [key: string]: number } {
    const stats = {
      bug: 0,
      security: 0,
      performance: 0,
      code_smell: 0,
    };

    issues.forEach((issue) => {
      stats[issue.type]++;
    });

    return stats;
  }

  /**
   * 获取严重程度统计
   */
  private getSeverityStatistics(issues: ReviewIssue[]): { [key: string]: number } {
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    issues.forEach((issue) => {
      stats[issue.severity]++;
    });

    return stats;
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
}
