import { FileWithIssues, ReviewIssue, ReviewResult } from "../core/types";
import { FormatUtils } from "../utils/FormatUtils";

/**
 * 评论格式化器类
 * 负责格式化 GitHub 评论内容
 */
export class CommentFormatter {
  /**
   * 格式化主要审查评论
   */
  formatMainReviewComment(reviewResult: ReviewResult): string {
    let content = `## Bugment Code Review\n\n`;

    // 基于原始审查添加 PR 摘要
    if (reviewResult.summary && reviewResult.summary.trim()) {
      content += `${reviewResult.summary}\n\n`;
    }

    // 添加审查变更部分
    content += `### 审查结果\n\n`;
    content += `Bugment 审查了代码变更并生成了 ${reviewResult.totalIssues} 条评论。\n\n`;

    // 检查这是否是一个干净的 PR（未发现问题）
    const hasAnyIssues = reviewResult.totalIssues > 0;

    // 如果有文件位置的问题，创建文件摘要表
    const filesWithIssues = this.getFilesWithIssues(reviewResult.issues);
    if (filesWithIssues.length > 0) {
      content += `| 文件 | 发现的问题 |\n`;
      content += `| ---- | ---------- |\n`;

      filesWithIssues.forEach(({ filePath, issues, description }) => {
        const issueCount = issues.length;
        const severityDistribution =
          FormatUtils.getSeverityDistribution(issues);
        content += `| ${filePath} | ${issueCount} 个问题 (${severityDistribution}) - ${description} |\n`;
      });
      content += `\n`;
    }

    // 移除变更摘要功能

    // 为干净的 PR 显示成功消息
    if (!hasAnyIssues) {
      content += `### 🎉 优秀的工作！\n\n`;
      content += `此 Pull Request 未发现任何问题，代码符合质量标准。\n\n`;
    }

    // 添加带有操作源的页脚
    content += `\n---\n*🤖 Powered by [Bugment AI Code Review](https://github.com/J3n5en/Bugment)*\n\n`;

    return content;
  }

  /**
   * 格式化行评论
   */
  formatLineComment(issue: ReviewIssue): string {
    return FormatUtils.formatBasicLineComment(issue);
  }

  /**
   * 格式化 GitHub 问题
   */
  formatIssueForGitHub(issue: ReviewIssue, index: number): string {
    let formatted = `#### ${index}. ${issue.title}\n\n`;

    // 使用 GitHub 警告语法以获得更好的可见性
    const alertType =
      issue.severity === "critical" || issue.severity === "high"
        ? "WARNING"
        : "NOTE";
    formatted += `> [!${alertType}]\n`;
    formatted += `> **严重程度:** ${FormatUtils.getSeverityEmoji(issue.severity)} ${FormatUtils.getSeverityText(issue.severity)}`;

    if (issue.confidence) {
      formatted += ` | **置信度:** ${FormatUtils.getConfidenceDisplay(issue.confidence)}`;
    }
    formatted += `\n\n`;

    formatted += `**📝 问题描述:**\n`;
    formatted += `${issue.description}\n\n`;

    if (issue.location) {
      formatted += `**📍 问题位置:**\n`;
      formatted += `\`${issue.location}\`\n\n`;
    }

    if (issue.fixPrompt) {
      formatted += `**🔧 修复建议:**\n`;
      formatted += `\`\`\`\n${issue.fixPrompt}\n\`\`\`\n\n`;
    }

    formatted += `---\n\n`;
    return formatted;
  }

  /**
   * 格式化原始审查内容
   */
  formatOriginalReviewContent(reviewResult: ReviewResult): string {
    let content = "";

    // 如果存在摘要则添加
    if (reviewResult.summary && reviewResult.summary.trim()) {
      content += reviewResult.summary + "\n\n";
    }

    if (reviewResult.issues.length > 0) {
      // 按类型分组问题
      const issuesByType = {
        bug: reviewResult.issues.filter((i) => i.type === "bug"),
        security: reviewResult.issues.filter((i) => i.type === "security"),
        performance: reviewResult.issues.filter(
          (i) => i.type === "performance"
        ),
        code_smell: reviewResult.issues.filter((i) => i.type === "code_smell"),
      };

      // 首先创建摘要表
      content += `### 📋 问题统计\n\n`;
      content += `| 类型 | 数量 | 严重程度分布 |\n`;
      content += `|------|------|-------------|\n`;

      Object.entries(issuesByType).forEach(([type, issues]) => {
        if (issues.length > 0) {
          const typeEmoji = FormatUtils.getTypeEmoji(
            type as ReviewIssue["type"]
          );
          const typeName = FormatUtils.getTypeName(type as ReviewIssue["type"]);
          const severityCount = FormatUtils.getSeverityDistribution(issues);
          content += `| ${typeEmoji} ${typeName} | ${issues.length} | ${severityCount} |\n`;
        }
      });
      content += `\n`;

      // 在可折叠部分中按类型显示问题
      if (issuesByType.bug.length > 0) {
        content += `<details>\n`;
        content += `<summary>🐛 潜在 Bug (${issuesByType.bug.length} 个) - 点击展开详情</summary>\n\n`;
        issuesByType.bug.forEach((issue, index) => {
          content += this.formatIssueForGitHub(issue, index + 1);
        });
        content += `</details>\n\n`;
      }

      if (issuesByType.security.length > 0) {
        content += `<details>\n`;
        content += `<summary>🔒 安全问题 (${issuesByType.security.length} 个) - 点击展开详情</summary>\n\n`;
        issuesByType.security.forEach((issue, index) => {
          content += this.formatIssueForGitHub(issue, index + 1);
        });
        content += `</details>\n\n`;
      }

      if (issuesByType.performance.length > 0) {
        content += `<details>\n`;
        content += `<summary>⚡ 性能问题 (${issuesByType.performance.length} 个) - 点击展开详情</summary>\n\n`;
        issuesByType.performance.forEach((issue, index) => {
          content += this.formatIssueForGitHub(issue, index + 1);
        });
        content += `</details>\n\n`;
      }

      if (issuesByType.code_smell.length > 0) {
        content += `<details>\n`;
        content += `<summary>🔍 代码异味 (${issuesByType.code_smell.length} 个) - 点击展开详情</summary>\n\n`;
        issuesByType.code_smell.forEach((issue, index) => {
          content += this.formatIssueForGitHub(issue, index + 1);
        });
        content += `</details>\n\n`;
      }
    }

    return content;
  }

  /**
   * 获取带有问题的文件
   */
  private getFilesWithIssues(issues: ReviewIssue[]): FileWithIssues[] {
    // 按文件路径分组问题
    const fileMap = new Map<string, ReviewIssue[]>();

    issues.forEach((issue) => {
      if (issue.filePath) {
        if (!fileMap.has(issue.filePath)) {
          fileMap.set(issue.filePath, []);
        }
        fileMap.get(issue.filePath)!.push(issue);
      }
    });

    // 转换为带有描述的数组
    return Array.from(fileMap.entries())
      .map(([filePath, fileIssues]) => {
        const issueTypes = [
          ...new Set(
            fileIssues.map((issue) => FormatUtils.getTypeName(issue.type))
          ),
        ];
        const description =
          issueTypes.length > 1
            ? `${issueTypes.slice(0, -1).join(", ")}和${issueTypes.slice(-1)[0]}问题`
            : `${issueTypes[0]}问题`;

        return {
          filePath,
          issues: fileIssues,
          description,
        };
      })
      .sort((a, b) => a.filePath.localeCompare(b.filePath));
  }
}
