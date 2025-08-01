import * as core from "@actions/core";
import { ReviewIssue, LocationInfo } from "../core/types";
import { LocationParser } from "./LocationParser";

/**
 * 问题解析器类
 * 负责解析单个审查问题
 */
export class IssueParser {
  private locationParser: LocationParser;

  constructor() {
    this.locationParser = new LocationParser();
  }

  /**
   * 从文本解析问题
   */
  parseIssueFromText(
    text: string,
    type: ReviewIssue["type"],
    id: string
  ): ReviewIssue | null {
    core.info(`🔍 Parsing ${type} issue text: ${text.substring(0, 200)}...`);

    // 从问题标题中提取标题
    const titleMatch = text.match(/## \d+\. (.+?)(?:\n|$)/);
    if (!titleMatch) {
      core.warning(`⚠️ No title found in ${type} issue text`);
      return null;
    }

    const title = titleMatch[1]?.trim() || "Unknown Issue";
    core.info(`📝 Found ${type} issue title: ${title}`);

    // 从文本中提取严重程度、描述、位置等
    const severityMatch = text.match(
      /\*\*严重程度\*\*[：:]\s*🟡\s*\*\*(\w+)\*\*|\*\*严重程度\*\*[：:]\s*🟢\s*\*\*(\w+)\*\*|\*\*严重程度\*\*[：:]\s*🔴\s*\*\*(\w+)\*\*/
    );
    const locationMatch = text.match(/\*\*位置\*\*[：:]\s*(.+?)(?:\n|$)/);
    const descriptionMatch = text.match(
      /\*\*描述\*\*[：:]\s*([\s\S]*?)(?=\*\*位置\*\*|\*\*建议修改\*\*|\*\*AI修复Prompt\*\*|$)/
    );
    const suggestionMatch = text.match(
      /\*\*建议修改\*\*[：:]\s*([\s\S]*?)(?=\*\*AI修复Prompt\*\*|$)/
    );
    const fixPromptMatch = text.match(
      /\*\*AI修复Prompt\*\*[：:]\s*```\s*([\s\S]*?)\s*```/
    );

    if (!descriptionMatch || !descriptionMatch[1]) {
      core.warning(`⚠️ No description found in ${type} issue: ${title}`);
      return null;
    }

    const severityText =
      severityMatch?.[1] ||
      severityMatch?.[2] ||
      severityMatch?.[3] ||
      "medium";
    const severity = this.mapSeverity(severityText);
    const description = descriptionMatch[1].trim();
    const location = locationMatch?.[1]?.trim() || "";

    // 解析文件路径和行号
    const { filePath, lineNumber, startLine, endLine } =
      this.locationParser.parseLocationInfo(location);

    return {
      id,
      type,
      severity,
      title,
      description,
      location,
      filePath,
      lineNumber,
      startLine,
      endLine,
      fixPrompt: fixPromptMatch?.[1]?.trim(),
      suggestion: suggestionMatch?.[1]?.trim(),
    };
  }

  /**
   * 映射严重程度
   */
  private mapSeverity(severityText: string): ReviewIssue["severity"] {
    const lowerText = severityText.toLowerCase();
    if (lowerText.includes("高") || lowerText.includes("critical"))
      return "critical";
    if (lowerText.includes("中") || lowerText.includes("medium"))
      return "medium";
    if (lowerText.includes("低") || lowerText.includes("low")) return "low";
    return "medium";
  }

  /**
   * 验证问题数据
   */
  validateIssue(issue: ReviewIssue): boolean {
    if (!issue.id || !issue.type || !issue.severity || !issue.title || !issue.description) {
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
  getIssueSummary(issue: ReviewIssue): string {
    const typeEmoji = this.getTypeEmoji(issue.type);
    const severityEmoji = this.getSeverityEmoji(issue.severity);
    
    return `${typeEmoji} ${issue.title} (${severityEmoji} ${issue.severity})`;
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
   * 获取类型名称
   */
  getTypeName(type: ReviewIssue["type"]): string {
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
  getSeverityText(severity: ReviewIssue["severity"]): string {
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
  extractTitleFromDescription(description: string): string {
    // 提取第一句话或前 50 个字符作为标题
    const firstLine = description.split("\n")[0] || "";
    return firstLine.length > 50
      ? firstLine.substring(0, 47) + "..."
      : firstLine;
  }

  /**
   * 创建问题签名用于比较
   */
  createIssueSignature(issue: ReviewIssue): string {
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
  areIssuesSimilar(issue1: ReviewIssue, issue2: ReviewIssue): boolean {
    return (
      issue1.type === issue2.type &&
      issue1.location === issue2.location &&
      issue1.filePath === issue2.filePath &&
      issue1.lineNumber === issue2.lineNumber
    );
  }
}
