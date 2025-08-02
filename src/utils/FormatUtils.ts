import { ReviewIssue } from "../core/types";

/**
 * 格式化工具类
 * 提供通用的格式化功能
 */
export class FormatUtils {
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
   * 格式化时间戳
   */
  static formatTimestamp(timestamp: string): string {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (error) {
      return timestamp;
    }
  }

  /**
   * 格式化文件路径
   */
  static formatFilePath(filePath: string, maxLength: number = 50): string {
    if (!filePath) return "";

    if (filePath.length <= maxLength) {
      return filePath;
    }

    // 如果路径太长，显示开头和结尾
    const start = filePath.substring(0, Math.floor(maxLength / 2) - 2);
    const end = filePath.substring(
      filePath.length - Math.floor(maxLength / 2) + 2
    );
    return `${start}...${end}`;
  }

  /**
   * 格式化行号范围
   */
  static formatLineRange(startLine?: number, endLine?: number): string {
    if (!startLine && !endLine) return "";

    if (startLine && endLine && startLine !== endLine) {
      return `L${startLine}-L${endLine}`;
    }

    if (startLine) {
      return `L${startLine}`;
    }

    if (endLine) {
      return `L${endLine}`;
    }

    return "";
  }

  /**
   * 格式化位置信息
   */
  static formatLocation(
    filePath?: string,
    lineNumber?: number,
    startLine?: number,
    endLine?: number
  ): string {
    if (!filePath) return "";

    let location = filePath;
    const lineRange = this.formatLineRange(startLine || lineNumber, endLine);

    if (lineRange) {
      location += `#${lineRange}`;
    }

    return location;
  }

  /**
   * 截断文本
   */
  static truncateText(
    text: string,
    maxLength: number,
    suffix: string = "..."
  ): string {
    if (!text || text.length <= maxLength) {
      return text;
    }

    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * 转义 Markdown 特殊字符
   */
  static escapeMarkdown(text: string): string {
    if (!text) return "";

    // 转义 Markdown 特殊字符
    return text
      .replace(/\\/g, "\\\\")
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_")
      .replace(/`/g, "\\`")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/#/g, "\\#")
      .replace(/\+/g, "\\+")
      .replace(/-/g, "\\-")
      .replace(/\./g, "\\.")
      .replace(/!/g, "\\!");
  }

  /**
   * 格式化代码块
   */
  static formatCodeBlock(code: string, language: string = ""): string {
    if (!code) return "";

    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  /**
   * 格式化内联代码
   */
  static formatInlineCode(code: string): string {
    if (!code) return "";

    return `\`${code}\``;
  }

  /**
   * 创建 Markdown 链接
   */
  static createMarkdownLink(text: string, url: string): string {
    if (!text || !url) return text || "";

    return `[${text}](${url})`;
  }

  /**
   * 创建 GitHub 文件链接
   */
  static createGitHubFileLink(
    owner: string,
    repo: string,
    sha: string,
    filePath: string,
    lineNumber?: number,
    startLine?: number,
    endLine?: number
  ): string {
    if (!owner || !repo || !sha || !filePath) return "";

    let url = `https://github.com/${owner}/${repo}/blob/${sha}/${filePath}`;

    const lineRange = this.formatLineRange(startLine || lineNumber, endLine);
    if (lineRange) {
      url += `#${lineRange}`;
    }

    return url;
  }

  /**
   * 格式化百分比
   */
  static formatPercentage(
    value: number,
    total: number,
    decimals: number = 1
  ): string {
    if (total === 0) return "0%";

    const percentage = (value / total) * 100;
    return `${percentage.toFixed(decimals)}%`;
  }

  /**
   * 格式化数字
   */
  static formatNumber(num: number): string {
    return num.toLocaleString("zh-CN");
  }

  /**
   * 创建进度条
   */
  static createProgressBar(
    current: number,
    total: number,
    width: number = 20,
    fillChar: string = "█",
    emptyChar: string = "░"
  ): string {
    if (total === 0) return emptyChar.repeat(width);

    const progress = Math.min(current / total, 1);
    const filled = Math.round(progress * width);
    const empty = width - filled;

    return fillChar.repeat(filled) + emptyChar.repeat(empty);
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 格式化持续时间
   */
  static formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * 规范化路径
   */
  static normalizePath(path: string): string {
    if (!path) return "";

    // 移除前导斜杠
    let normalized = path.replace(/^\/+/, "");

    // 规范化路径分隔符
    normalized = normalized.replace(/\\/g, "/");

    // 移除多余的斜杠
    normalized = normalized.replace(/\/+/g, "/");

    return normalized;
  }

  /**
   * 创建表格行
   */
  static createTableRow(cells: string[]): string {
    return `| ${cells.join(" | ")} |`;
  }

  /**
   * 创建表格分隔符
   */
  static createTableSeparator(columnCount: number): string {
    const separators = Array(columnCount).fill("----");
    return `| ${separators.join(" | ")} |`;
  }

  /**
   * 格式化 JSON
   */
  static formatJSON(obj: any, indent: number = 2): string {
    try {
      return JSON.stringify(obj, null, indent);
    } catch (error) {
      return String(obj);
    }
  }

  /**
   * 获取置信度显示（百分比 + 进度条）
   */
  static getConfidenceDisplay(confidence: number): string {
    const percentage = Math.round(confidence * 100);
    const progressBar = FormatUtils.getProgressBar(confidence);
    return `${percentage}% ${progressBar}`;
  }

  /**
   * 生成置信度进度条
   */
  static getProgressBar(confidence: number): string {
    const totalBars = 5;
    const filledBars = Math.round(confidence * totalBars);
    const emptyBars = totalBars - filledBars;

    return "█".repeat(filledBars) + "░".repeat(emptyBars);
  }

  /**
   * 获取严重程度分布字符串
   */
  static getSeverityDistribution(issues: ReviewIssue[]): string {
    const counts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    issues.forEach((issue) => {
      counts[issue.severity]++;
    });

    const parts: string[] = [];
    if (counts.critical > 0) parts.push(`🔴${counts.critical}`);
    if (counts.high > 0) parts.push(`🟠${counts.high}`);
    if (counts.medium > 0) parts.push(`🟡${counts.medium}`);
    if (counts.low > 0) parts.push(`🟢${counts.low}`);

    return parts.join(" ");
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
   * 格式化基础行评论内容
   */
  static formatBasicLineComment(issue: ReviewIssue): string {
    const severityText = FormatUtils.getSeverityText(issue.severity);
    const confidenceText = issue.confidence
      ? ` (置信度: ${FormatUtils.getConfidenceDisplay(issue.confidence)})`
      : "";
    let comment = `**${FormatUtils.getTypeEmoji(issue.type)} ${FormatUtils.getTypeName(issue.type)}** - ${FormatUtils.getSeverityEmoji(issue.severity)} ${severityText}${confidenceText}\n\n`;

    comment += `${issue.description}\n\n`;

    if (issue.fixPrompt) {
      comment += `**🔧 修复建议:**\n\`\`\`\n${issue.fixPrompt}\n\`\`\``;
    }

    return comment;
  }
}
