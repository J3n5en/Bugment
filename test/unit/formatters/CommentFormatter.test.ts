import { CommentFormatter } from "../../../src/formatters/CommentFormatter";
import {
  ReviewResult,
  ReviewComparison,
  ReviewIssue,
} from "../../../src/core/types";

describe("CommentFormatter", () => {
  let formatter: CommentFormatter;

  beforeEach(() => {
    formatter = new CommentFormatter();
  });

  const mockIssue: ReviewIssue = {
    id: "issue-1",
    type: "bug",
    severity: "high",
    title: "Test Bug",
    description: "This is a test bug description",
    location: "test.ts:10",
    filePath: "test.ts",
    lineNumber: 10,
    fixPrompt: "Fix this by doing X",
  };

  const mockReviewResult: ReviewResult = {
    reviewId: "review-123",
    timestamp: "2024-01-01T00:00:00Z",
    commitSha: "commit123",
    summary: "This is a test review summary",
    issues: [mockIssue],
    totalIssues: 1,
  };

  const mockComparison: ReviewComparison = {
    newIssues: [mockIssue],
    fixedIssues: [],
    persistentIssues: [],
    modifiedIssues: [],
    fixedCount: 0,
    newCount: 1,
    persistentCount: 0,
  };

  describe("formatMainReviewComment", () => {
    test("should format main review comment with issues", () => {
      const comment = formatter.formatMainReviewComment(mockReviewResult);

      expect(comment).toContain("Bugment Code Review");
      expect(comment).toContain("This is a test review summary");
      expect(comment).toContain("1 条评论");
      expect(comment).toContain("test.ts");
      expect(comment).toContain("🤖 Powered by [Bugment AI Code Review]");
    });

    test("should format clean PR comment (no issues)", () => {
      const cleanReview: ReviewResult = {
        ...mockReviewResult,
        issues: [],
        totalIssues: 0,
      };

      const comment = formatter.formatMainReviewComment(cleanReview);

      expect(comment).toContain("优秀的工作");
      expect(comment).toContain("未发现任何问题");
    });

    test("should not include status changes (feature removed)", () => {
      const comment = formatter.formatMainReviewComment(mockReviewResult);

      expect(comment).not.toContain("变更摘要");
      expect(comment).not.toContain("个问题已修复");
      expect(comment).not.toContain("个问题仍需关注");
    });
  });

  describe("formatLineComment", () => {
    test("should format line comment with all fields", () => {
      const comment = formatter.formatLineComment(mockIssue);

      expect(comment).toContain("🐛 潜在 Bug");
      expect(comment).toContain("🟠 高");
      expect(comment).toContain("This is a test bug description");
      expect(comment).toContain("🔧 修复建议");
      expect(comment).toContain("Fix this by doing X");
    });

    test("should handle missing optional fields", () => {
      const minimalIssue: ReviewIssue = {
        id: "issue-1",
        type: "code_smell",
        severity: "medium",
        title: "Code Smell",
        description: "This is a code smell",
        location: "test.ts:5",
      };

      const comment = formatter.formatLineComment(minimalIssue);

      expect(comment).toContain("🔍 代码异味");
      expect(comment).toContain("🟡 中等");
      expect(comment).toContain("This is a code smell");

      expect(comment).not.toContain("🔧 修复建议");
    });
  });

  describe("formatIssueForGitHub", () => {
    test("should format issue for GitHub with warning alert", () => {
      const formatted = formatter.formatIssueForGitHub(mockIssue, 1);

      expect(formatted).toContain("#### 1. Test Bug");
      expect(formatted).toContain("> [!WARNING]");
      expect(formatted).toContain("**严重程度:** 🟠 高");
      expect(formatted).toContain("**📝 问题描述:**");
      expect(formatted).toContain("This is a test bug description");
      expect(formatted).toContain("**📍 问题位置:**");
      expect(formatted).toContain("`test.ts:10`");
      expect(formatted).toContain("**🔧 修复建议:**");
      expect(formatted).toContain("Fix this by doing X");
    });

    test("should use NOTE alert for low/medium severity", () => {
      const lowSeverityIssue: ReviewIssue = {
        ...mockIssue,
        severity: "medium",
      };

      const formatted = formatter.formatIssueForGitHub(lowSeverityIssue, 1);

      expect(formatted).toContain("> [!NOTE]");
    });

    test("should handle missing location and fix prompt", () => {
      const minimalIssue: ReviewIssue = {
        id: "issue-1",
        type: "performance",
        severity: "low",
        title: "Performance Issue",
        description: "This could be faster",
        location: "",
      };

      const formatted = formatter.formatIssueForGitHub(minimalIssue, 2);

      expect(formatted).toContain("#### 2. Performance Issue");
      expect(formatted).toContain("This could be faster");
      expect(formatted).not.toContain("**📍 问题位置:**");
      expect(formatted).not.toContain("**🔧 修复建议:**");
    });
  });

  describe("formatOriginalReviewContent", () => {
    test("should format original review content with grouped issues", () => {
      const multiIssueReview: ReviewResult = {
        ...mockReviewResult,
        issues: [
          mockIssue,
          {
            id: "issue-2",
            type: "security",
            severity: "critical",
            title: "Security Issue",
            description: "This is a security issue",
            location: "auth.ts:25",
          },
          {
            id: "issue-3",
            type: "performance",
            severity: "medium",
            title: "Performance Issue",
            description: "This could be faster",
            location: "slow.ts:100",
          },
        ],
        totalIssues: 3,
      };

      const content = formatter.formatOriginalReviewContent(multiIssueReview);

      expect(content).toContain("### 📋 问题统计");
      expect(content).toContain("| 类型 | 数量 | 严重程度分布 |");
      expect(content).toContain("🐛 潜在 Bug");
      expect(content).toContain("🔒 安全问题");
      expect(content).toContain("⚡ 性能问题");
      expect(content).toContain("<details>");
      expect(content).toContain("<summary>");
    });

    test("should include summary when present", () => {
      const content = formatter.formatOriginalReviewContent(mockReviewResult);

      expect(content).toContain("This is a test review summary");
    });

    test("should handle empty issues", () => {
      const emptyReview: ReviewResult = {
        ...mockReviewResult,
        issues: [],
        totalIssues: 0,
        summary: "No issues found",
      };

      const content = formatter.formatOriginalReviewContent(emptyReview);

      expect(content).toContain("No issues found");
      expect(content).not.toContain("### 📋 问题统计");
    });
  });
});
