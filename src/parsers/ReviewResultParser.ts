import * as core from "@actions/core";
import { ReviewResult, ReviewIssue, PullRequestInfo } from "../core/types";
import { IssueParser } from "./IssueParser";

/**
 * 审查结果解析器类
 * 负责解析 AI 审查结果
 */
export class ReviewResultParser {
  private prInfo: PullRequestInfo;
  private issueParser: IssueParser;

  constructor(prInfo: PullRequestInfo) {
    this.prInfo = prInfo;
    this.issueParser = new IssueParser();
  }

  /**
   * 解析审查结果
   */
  parseReviewResult(reviewResult: string): ReviewResult {
    core.info("🔍 Starting to parse review result...");

    // 生成唯一的审查 ID
    const prId = `pr${this.prInfo.number}`;
    const commitShort = this.prInfo.headSha.substring(0, 8);
    const timestampShort = Date.now().toString().slice(-6); // 最后 6 位数字用于简洁
    const reviewId = `${prId}_${commitShort}_${timestampShort}`;
    const timestamp = new Date().toISOString();

    // 记录审查结果用于调试（前 500 个字符）
    core.info(`📝 Review result preview: ${reviewResult.substring(0, 500)}...`);

    // 从审查结果中提取问题
    const issues: ReviewIssue[] = [];

    // 解析不同类型的问题
    // 更新模式以完全匹配 prompt.md 格式
    const bugPattern = /# Bugs\s*\n([\s\S]*?)(?=\n# |$)/g;
    const smellPattern = /# Code Smells\s*\n([\s\S]*?)(?=\n# |$)/g;
    const securityPattern = /# Security Issues\s*\n([\s\S]*?)(?=\n# |$)/g;
    const performancePattern = /# Performance Issues\s*\n([\s\S]*?)(?=\n# |$)/g;

    let issueId = 1;

    // 解析不同问题类型
    core.info("🔍 Parsing bugs...");
    this.parseIssuesFromSection(
      reviewResult,
      bugPattern,
      "bug",
      issues,
      issueId
    );

    core.info("🔍 Parsing code smells...");
    this.parseIssuesFromSection(
      reviewResult,
      smellPattern,
      "code_smell",
      issues,
      issueId
    );

    core.info("🔍 Parsing security issues...");
    this.parseIssuesFromSection(
      reviewResult,
      securityPattern,
      "security",
      issues,
      issueId
    );

    core.info("🔍 Parsing performance issues...");
    this.parseIssuesFromSection(
      reviewResult,
      performancePattern,
      "performance",
      issues,
      issueId
    );

    const result = {
      reviewId,
      timestamp,
      commitSha: this.prInfo.headSha,
      summary: this.extractSummaryFromReview(reviewResult),
      issues,
      totalIssues: issues.length,
    };

    core.info(`✅ Parsing complete. Found ${result.totalIssues} total issues`);
    return result;
  }

  /**
   * 从部分解析问题
   */
  private parseIssuesFromSection(
    reviewResult: string,
    pattern: RegExp,
    type: ReviewIssue["type"],
    issues: ReviewIssue[],
    issueId: number
  ): void {
    const matches = reviewResult.match(pattern);
    if (matches && matches.length > 0) {
      // 模式现在捕获标题后的内容，所以如果存在，我们使用 matches[1]
      const sectionContent = matches[0];
      core.info(
        `🔍 Found ${type} section: ${sectionContent.substring(0, 100)}...`
      );

      // 从部分内容中提取单个问题
      const issueMatches = sectionContent.match(/## \d+\. .+?(?=## \d+\.|$)/gs);
      if (issueMatches && issueMatches.length > 0) {
        core.info(`📝 Found ${issueMatches.length} ${type} issues`);
        issueMatches.forEach((issueText, index) => {
          const issue = this.issueParser.parseIssueFromText(
            issueText,
            type,
            `${type}_${issueId + index}`
          );
          if (issue) {
            issues.push(issue);
            core.info(`✅ Parsed ${type} issue: ${issue.title}`);
          } else {
            core.warning(
              `⚠️ Failed to parse ${type} issue from text: ${issueText.substring(0, 100)}...`
            );
          }
        });
      } else {
        core.info(`ℹ️ No individual issues found in ${type} section`);
      }
    } else {
      core.info(`ℹ️ No ${type} section found in review result`);
    }
  }

  /**
   * 从审查中提取摘要
   */
  private extractSummaryFromReview(reviewResult: string): string {
    // 从审查中提取摘要部分
    const summaryMatch = reviewResult.match(
      /# Overall Comments[\s\S]*?(?=# |$)/
    );
    if (summaryMatch && summaryMatch[0]) {
      // 清理摘要
      return summaryMatch[0].replace(/# Overall Comments\s*/, "").trim();
    }
    return "";
  }

  /**
   * 验证审查结果格式
   */
  validateReviewResult(reviewResult: string): boolean {
    if (!reviewResult || reviewResult.trim().length === 0) {
      core.warning("Review result is empty");
      return false;
    }

    // 检查是否包含基本的审查部分
    const hasOverallComments = reviewResult.includes("# Overall Comments") || 
                              reviewResult.includes("# 整体评价");
    
    if (!hasOverallComments) {
      core.warning("Review result does not contain overall comments section");
      return false;
    }

    // 检查是否包含至少一个问题类型部分
    const hasBugs = reviewResult.includes("# Bugs");
    const hasCodeSmells = reviewResult.includes("# Code Smells");
    const hasSecurity = reviewResult.includes("# Security Issues");
    const hasPerformance = reviewResult.includes("# Performance Issues");

    if (!hasBugs && !hasCodeSmells && !hasSecurity && !hasPerformance) {
      core.warning("Review result does not contain any issue sections");
      return false;
    }

    core.info("✅ Review result validation passed");
    return true;
  }

  /**
   * 获取审查结果统计信息
   */
  getReviewStats(reviewResult: string): {
    hasOverallComments: boolean;
    hasBugs: boolean;
    hasCodeSmells: boolean;
    hasSecurity: boolean;
    hasPerformance: boolean;
    estimatedIssueCount: number;
  } {
    const hasOverallComments = reviewResult.includes("# Overall Comments") || 
                              reviewResult.includes("# 整体评价");
    const hasBugs = reviewResult.includes("# Bugs");
    const hasCodeSmells = reviewResult.includes("# Code Smells");
    const hasSecurity = reviewResult.includes("# Security Issues");
    const hasPerformance = reviewResult.includes("# Performance Issues");

    // 估算问题数量（通过计算 ## 数字. 模式）
    const issuePattern = /## \d+\./g;
    const issueMatches = reviewResult.match(issuePattern);
    const estimatedIssueCount = issueMatches ? issueMatches.length : 0;

    return {
      hasOverallComments,
      hasBugs,
      hasCodeSmells,
      hasSecurity,
      hasPerformance,
      estimatedIssueCount,
    };
  }
}
