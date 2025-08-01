import * as core from "@actions/core";
import {
  ReviewIssue,
  ReviewResult,
  ActionInputs,
  PullRequestInfo,
  LocationInfo,
} from "../core/types";

/**
 * 验证工具类
 * 提供各种数据验证功能
 */
export class ValidationUtils {
  /**
   * 验证 Action 输入
   */
  static validateActionInputs(inputs: ActionInputs): boolean {
    if (!inputs.augmentAccessToken || inputs.augmentAccessToken.trim() === "") {
      core.error("Augment access token is required");
      return false;
    }

    if (!inputs.augmentTenantUrl || inputs.augmentTenantUrl.trim() === "") {
      core.error("Augment tenant URL is required");
      return false;
    }

    if (!inputs.githubToken || inputs.githubToken.trim() === "") {
      core.error("GitHub token is required");
      return false;
    }

    // 验证 URL 格式
    try {
      new URL(inputs.augmentTenantUrl);
    } catch (error) {
      core.error(`Invalid Augment tenant URL: ${inputs.augmentTenantUrl}`);
      return false;
    }

    core.info("✅ Action inputs validation passed");
    return true;
  }

  /**
   * 验证 PR 信息
   */
  static validatePullRequestInfo(prInfo: PullRequestInfo): boolean {
    if (!prInfo.number || prInfo.number <= 0) {
      core.error("Invalid PR number");
      return false;
    }

    if (!prInfo.title || prInfo.title.trim() === "") {
      core.error("PR title is required");
      return false;
    }

    if (!prInfo.baseSha || prInfo.baseSha.trim() === "") {
      core.error("Base SHA is required");
      return false;
    }

    if (!prInfo.headSha || prInfo.headSha.trim() === "") {
      core.error("Head SHA is required");
      return false;
    }

    if (!prInfo.owner || prInfo.owner.trim() === "") {
      core.error("Repository owner is required");
      return false;
    }

    if (!prInfo.repo || prInfo.repo.trim() === "") {
      core.error("Repository name is required");
      return false;
    }

    // 验证 SHA 格式（应该是 40 个字符的十六进制字符串）
    const shaPattern = /^[a-f0-9]{40}$/i;
    if (!shaPattern.test(prInfo.baseSha)) {
      core.warning(`Base SHA format may be invalid: ${prInfo.baseSha}`);
    }

    if (!shaPattern.test(prInfo.headSha)) {
      core.warning(`Head SHA format may be invalid: ${prInfo.headSha}`);
    }

    core.info("✅ Pull request info validation passed");
    return true;
  }

  /**
   * 验证审查问题
   */
  static validateReviewIssue(issue: ReviewIssue): boolean {
    if (!issue.id || issue.id.trim() === "") {
      core.warning("Issue ID is missing");
      return false;
    }

    if (!issue.type) {
      core.warning("Issue type is missing");
      return false;
    }

    const validTypes = ["bug", "code_smell", "security", "performance"];
    if (!validTypes.includes(issue.type)) {
      core.warning(`Invalid issue type: ${issue.type}`);
      return false;
    }

    if (!issue.severity) {
      core.warning("Issue severity is missing");
      return false;
    }

    const validSeverities = ["low", "medium", "high", "critical"];
    if (!validSeverities.includes(issue.severity)) {
      core.warning(`Invalid issue severity: ${issue.severity}`);
      return false;
    }

    if (!issue.title || issue.title.trim() === "") {
      core.warning("Issue title is missing");
      return false;
    }

    if (!issue.description || issue.description.trim() === "") {
      core.warning("Issue description is missing");
      return false;
    }

    // 验证行号（如果存在）
    if (issue.lineNumber !== undefined && issue.lineNumber <= 0) {
      core.warning(`Invalid line number: ${issue.lineNumber}`);
      return false;
    }

    if (issue.startLine !== undefined && issue.startLine <= 0) {
      core.warning(`Invalid start line: ${issue.startLine}`);
      return false;
    }

    if (issue.endLine !== undefined && issue.endLine <= 0) {
      core.warning(`Invalid end line: ${issue.endLine}`);
      return false;
    }

    if (
      issue.startLine !== undefined &&
      issue.endLine !== undefined &&
      issue.startLine > issue.endLine
    ) {
      core.warning(
        `Start line (${issue.startLine}) is greater than end line (${issue.endLine})`
      );
      return false;
    }

    return true;
  }

  /**
   * 验证审查结果
   */
  static validateReviewResult(reviewResult: ReviewResult): boolean {
    if (!reviewResult.reviewId || reviewResult.reviewId.trim() === "") {
      core.error("Review ID is missing");
      return false;
    }

    if (!reviewResult.timestamp || reviewResult.timestamp.trim() === "") {
      core.error("Review timestamp is missing");
      return false;
    }

    if (!reviewResult.commitSha || reviewResult.commitSha.trim() === "") {
      core.error("Commit SHA is missing");
      return false;
    }

    // 验证时间戳格式
    const date = new Date(reviewResult.timestamp);
    if (isNaN(date.getTime())) {
      core.error(`Invalid timestamp format: ${reviewResult.timestamp}`);
      return false;
    }

    // 验证问题数量一致性
    if (reviewResult.totalIssues !== reviewResult.issues.length) {
      core.warning(
        `Total issues count (${reviewResult.totalIssues}) does not match actual issues array length (${reviewResult.issues.length})`
      );
      // 修正计数
      reviewResult.totalIssues = reviewResult.issues.length;
    }

    // 验证每个问题
    let validIssues = 0;
    for (const issue of reviewResult.issues) {
      if (this.validateReviewIssue(issue)) {
        validIssues++;
      }
    }

    if (validIssues !== reviewResult.issues.length) {
      core.warning(
        `Only ${validIssues} out of ${reviewResult.issues.length} issues are valid`
      );
    }

    core.info("✅ Review result validation passed");
    return true;
  }

  /**
   * 验证位置信息
   */
  static validateLocationInfo(locationInfo: LocationInfo): boolean {
    if (!locationInfo.filePath || locationInfo.filePath.trim() === "") {
      core.warning("File path is missing in location info");
      return false;
    }

    if (locationInfo.lineNumber !== undefined && locationInfo.lineNumber <= 0) {
      core.warning(`Invalid line number: ${locationInfo.lineNumber}`);
      return false;
    }

    if (locationInfo.startLine !== undefined && locationInfo.startLine <= 0) {
      core.warning(`Invalid start line: ${locationInfo.startLine}`);
      return false;
    }

    if (locationInfo.endLine !== undefined && locationInfo.endLine <= 0) {
      core.warning(`Invalid end line: ${locationInfo.endLine}`);
      return false;
    }

    if (
      locationInfo.startLine !== undefined &&
      locationInfo.endLine !== undefined &&
      locationInfo.startLine > locationInfo.endLine
    ) {
      core.warning(
        `Start line (${locationInfo.startLine}) is greater than end line (${locationInfo.endLine})`
      );
      return false;
    }

    return true;
  }

  /**
   * 验证文件路径
   */
  static validateFilePath(filePath: string): boolean {
    if (!filePath || filePath.trim() === "") {
      return false;
    }

    // 检查是否包含危险字符
    const dangerousChars = ["\0", "\r", "\n"];
    for (const char of dangerousChars) {
      if (filePath.includes(char)) {
        core.warning(`File path contains dangerous character: ${filePath}`);
        return false;
      }
    }

    // 检查是否为绝对路径（在某些情况下可能不合适）
    if (filePath.startsWith("/") && filePath.length > 1) {
      core.info(`File path is absolute: ${filePath}`);
    }

    return true;
  }

  /**
   * 验证 diff 内容
   */
  static validateDiffContent(diffContent: string): boolean {
    if (!diffContent || diffContent.trim() === "") {
      core.warning("Diff content is empty");
      return false;
    }

    // 检查是否包含基本的 diff 标记
    const hasDiffHeader = diffContent.includes("diff --git");
    const hasHunkHeader = diffContent.includes("@@");

    if (!hasDiffHeader) {
      core.warning("Diff content does not contain git diff headers");
      return false;
    }

    if (!hasHunkHeader) {
      core.warning("Diff content does not contain hunk headers");
      return false;
    }

    return true;
  }

  /**
   * 验证审查选项
   */
  static validateReviewOptions(options: {
    projectPath: string;
    prTitle: string;
    prDescription: string;
    diffPath?: string;
    repoOwner?: string;
    repoName?: string;
    commitSha?: string;
  }): boolean {
    if (!options.projectPath || options.projectPath.trim() === "") {
      core.error("Project path is required");
      return false;
    }

    if (!options.prTitle || options.prTitle.trim() === "") {
      core.error("PR title is required");
      return false;
    }

    if (options.diffPath && !this.validateFilePath(options.diffPath)) {
      core.error("Invalid diff path");
      return false;
    }

    return true;
  }
}
