import * as core from "@actions/core";
import {
  ReviewResult,
  ReviewIssue,
  PullRequestInfo,
  JsonReviewData,
  JsonIssueData,
  ParsingStats,
  IssueStatistics,
} from "../core/types";

/**
 * JSON 格式审查结果解析器
 * 替代原有的 Markdown 解析器，直接处理 LLM 输出的 JSON 格式
 */
export class JsonReviewResultParser {
  private prInfo: PullRequestInfo;

  constructor(prInfo: PullRequestInfo) {
    this.prInfo = prInfo;
  }

  /**
   * 解析 JSON 格式的审查结果
   */
  parseReviewResult(reviewResult: string): ReviewResult {
    core.info("🔍 Starting to parse JSON review result...");

    // 生成唯一的审查 ID
    const prId = `pr${this.prInfo.number}`;
    const commitShort = this.prInfo.headSha.substring(0, 8);
    const timestampShort = Date.now().toString().slice(-6);
    const reviewId = `${prId}_${commitShort}_${timestampShort}`;
    const timestamp = new Date().toISOString();

    try {
      // 清理可能的 JSON 包装（如果 LLM 输出包含 ```json 标记）
      const cleanedResult = this.cleanJsonString(reviewResult);

      // 解析 JSON
      const parsedData = JSON.parse(cleanedResult);

      // 验证 JSON 结构
      this.validateJsonStructure(parsedData);

      // 提取摘要
      const summary = this.extractSummary(parsedData);

      // 处理问题列表
      const issues = this.processIssues(parsedData.issues || []);

      const result: ReviewResult = {
        reviewId,
        timestamp,
        commitSha: this.prInfo.headSha,
        summary,
        issues,
        totalIssues: issues.length,
      };

      core.info(
        `✅ JSON parsing complete. Found ${result.totalIssues} total issues`
      );
      return result;
    } catch (error) {
      core.error(`❌ Failed to parse JSON review result: ${error}`);

      // 回退到空结果
      return {
        reviewId,
        timestamp,
        commitSha: this.prInfo.headSha,
        summary: "解析审查结果时发生错误",
        issues: [],
        totalIssues: 0,
      };
    }
  }

  /**
   * 清理 JSON 字符串，移除可能的 Markdown 包装
   */
  private cleanJsonString(jsonString: string): string {
    let cleaned = jsonString.trim();

    // 移除 ```json 和 ``` 包装
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.replace(/^```json\s*/, "");
    }
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```\s*/, "");
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.replace(/\s*```$/, "");
    }

    return cleaned.trim();
  }

  /**
   * 验证 JSON 结构
   */
  private validateJsonStructure(data: any): void {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid JSON: root must be an object");
    }

    if (!data.summary || typeof data.summary !== "object") {
      core.warning("Missing or invalid summary object");
    }

    if (!Array.isArray(data.issues)) {
      core.warning("Missing or invalid issues array");
      data.issues = [];
    }
  }

  /**
   * 提取摘要信息
   */
  private extractSummary(data: any): string {
    try {
      if (data.summary && Array.isArray(data.summary.overallComments)) {
        return data.summary.overallComments
          .map(
            (comment: string, index: number) => `- ${index + 1}️⃣ ${comment}`
          )
          .join("\n");
      }
    } catch (error) {
      core.warning(`Failed to extract summary: ${error}`);
    }

    return "";
  }

  /**
   * 处理问题列表
   */
  private processIssues(issuesData: any[]): ReviewIssue[] {
    const issues: ReviewIssue[] = [];

    issuesData.forEach((issueData, index) => {
      try {
        const issue = this.parseIssueFromJson(issueData, index);
        if (issue && this.validateIssue(issue)) {
          issues.push(issue);
          core.info(`✅ Parsed issue: ${issue.title}`);
        } else {
          core.warning(`⚠️ Invalid issue data at index ${index}`);
        }
      } catch (error) {
        core.warning(`⚠️ Failed to parse issue at index ${index}: ${error}`);
      }
    });

    return issues;
  }

  /**
   * 从 JSON 对象解析单个问题
   */
  private parseIssueFromJson(data: any, index: number): ReviewIssue | null {
    if (!data || typeof data !== "object") {
      return null;
    }

    // 确保必需字段存在
    const id = data.id || `issue_${index + 1}`;
    const type = this.validateIssueType(data.type);
    const severity = this.validateSeverity(data.severity);
    const title = data.title || "Unknown Issue";
    const description = data.description || "";
    const location = data.location || "";
    const filePath = data.filePath || "";

    return {
      id,
      type,
      severity,
      title,
      description,
      location,
      filePath,
      lineNumber: this.parseNumber(data.lineNumber),
      startLine: this.parseNumber(data.startLine),
      endLine: this.parseNumber(data.endLine),
      fixPrompt: data.fixPrompt || "",
      suggestion: data.suggestion || "",
    };
  }

  /**
   * 验证问题类型
   */
  private validateIssueType(type: any): ReviewIssue["type"] {
    const validTypes: ReviewIssue["type"][] = [
      "bug",
      "code_smell",
      "security",
      "performance",
    ];
    if (validTypes.includes(type)) {
      return type;
    }
    core.warning(`Invalid issue type: ${type}, defaulting to 'code_smell'`);
    return "code_smell";
  }

  /**
   * 验证严重程度
   */
  private validateSeverity(severity: any): ReviewIssue["severity"] {
    const validSeverities: ReviewIssue["severity"][] = [
      "low",
      "medium",
      "high",
      "critical",
    ];
    if (validSeverities.includes(severity)) {
      return severity;
    }
    core.warning(`Invalid severity: ${severity}, defaulting to 'medium'`);
    return "medium";
  }

  /**
   * 解析数字字段
   */
  private parseNumber(value: any): number | undefined {
    if (typeof value === "number" && !isNaN(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseInt(value, 10);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  /**
   * 验证问题数据
   */
  private validateIssue(issue: ReviewIssue): boolean {
    if (!issue.id || !issue.type || !issue.severity || !issue.title) {
      return false;
    }

    const validTypes = ["bug", "code_smell", "security", "performance"];
    const validSeverities = ["low", "medium", "high", "critical"];

    return (
      validTypes.includes(issue.type) &&
      validSeverities.includes(issue.severity)
    );
  }

  /**
   * 获取解析统计信息
   */
  getParsingStats(reviewResult: string): ParsingStats {
    try {
      const cleanedResult = this.cleanJsonString(reviewResult);
      const parsedData = JSON.parse(cleanedResult);

      return {
        isValidJson: true,
        hasIssues:
          Array.isArray(parsedData.issues) && parsedData.issues.length > 0,
        hasSummary: !!(
          parsedData.summary && parsedData.summary.overallComments
        ),
        estimatedIssueCount: Array.isArray(parsedData.issues)
          ? parsedData.issues.length
          : 0,
      };
    } catch (error) {
      return {
        isValidJson: false,
        hasIssues: false,
        hasSummary: false,
        estimatedIssueCount: 0,
      };
    }
  }

  /**
   * 计算问题统计信息
   */
  calculateStatistics(issues: ReviewIssue[]): IssueStatistics {
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
}
