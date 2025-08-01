/**
 * 核心类型定义
 * 包含所有模块共享的接口和类型
 */

export interface ActionInputs {
  augmentAccessToken: string;
  augmentTenantUrl: string;
  githubToken: string;
}

export interface PullRequestInfo {
  number: number;
  title: string;
  body: string;
  baseSha: string;
  headSha: string;
  owner: string;
  repo: string;
}

export interface ReviewIssue {
  id: string;
  type: "bug" | "code_smell" | "security" | "performance";
  severity: "low" | "medium" | "high" | "critical";
  confidence?: number; // 0.0 - 1.0 的数值
  title: string;
  description: string;
  location: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  fixPrompt?: string;
  diffHunk?: string;
}

export interface DiffHunk {
  filePath: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface ParsedDiff {
  files: Map<string, DiffHunk[]>;
}

export interface ReviewResult {
  reviewId: string;
  timestamp: string;
  commitSha: string;
  summary: string;
  issues: ReviewIssue[];
  totalIssues: number;
}

export interface ReviewComparison {
  newIssues: ReviewIssue[];
  fixedIssues: ReviewIssue[];
  persistentIssues: ReviewIssue[];
  modifiedIssues: { previous: ReviewIssue; current: ReviewIssue }[];
  fixedCount: number;
  newCount: number;
  persistentCount: number;
}

export interface ReviewOptions {
  projectPath: string;
  prTitle: string;
  prDescription: string;
  diffPath?: string;
  repoOwner?: string;
  repoName?: string;
  commitSha?: string;
}

export interface FileWithIssues {
  filePath: string;
  issues: ReviewIssue[];
  description: string;
}

export interface LineComment {
  path: string;
  line: number;
  body: string;
  start_line?: number;
  start_side?: "LEFT" | "RIGHT";
  side?: "LEFT" | "RIGHT";
}

export interface ReviewEvent {
  type: "REQUEST_CHANGES" | "COMMENT";
  body: string;
  lineComments: LineComment[];
}

export interface LocationInfo {
  filePath?: string;
  startLine?: number;
  endLine?: number;
}

export interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export type ReviewIssueType = ReviewIssue["type"];
export type ReviewIssueSeverity = ReviewIssue["severity"];

// JSON 解析相关接口
export interface JsonReviewData {
  summary: {
    overallComments: string[];
  };
  issues: JsonIssueData[];
}

export interface JsonIssueData {
  id: string;
  type: ReviewIssueType;
  severity: ReviewIssueSeverity;
  confidence?: number; // 0.0 - 1.0 的数值
  title: string;
  description: string;
  location: string;
  filePath: string;
  startLine?: number;
  endLine?: number;
  fixPrompt?: string;
}

// 解析统计信息
export interface ParsingStats {
  isValidJson: boolean;
  hasIssues: boolean;
  hasSummary: boolean;
  estimatedIssueCount: number;
}

// 问题统计信息
export interface IssueStatistics {
  totalIssues: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
}
