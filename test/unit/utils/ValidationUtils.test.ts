import { ValidationUtils } from "../../../src/utils/ValidationUtils";
import {
  ActionInputs,
  PullRequestInfo,
  ReviewResult,
  ReviewIssue,
} from "../../../src/core/types";

describe("ValidationUtils", () => {
  describe("validateActionInputs", () => {
    const validInputs: ActionInputs = {
      augmentAccessToken: "test-token",
      augmentTenantUrl: "https://test.augment.com",
      githubToken: "github-token",
    };

    test("should validate correct inputs", () => {
      const isValid = ValidationUtils.validateActionInputs(validInputs);
      expect(isValid).toBe(true);
    });

    test("should reject empty access token", () => {
      const invalidInputs = { ...validInputs, augmentAccessToken: "" };
      const isValid = ValidationUtils.validateActionInputs(invalidInputs);
      expect(isValid).toBe(false);
    });

    test("should reject empty tenant URL", () => {
      const invalidInputs = { ...validInputs, augmentTenantUrl: "" };
      const isValid = ValidationUtils.validateActionInputs(invalidInputs);
      expect(isValid).toBe(false);
    });

    test("should reject invalid URL format", () => {
      const invalidInputs = { ...validInputs, augmentTenantUrl: "not-a-url" };
      const isValid = ValidationUtils.validateActionInputs(invalidInputs);
      expect(isValid).toBe(false);
    });

    test("should reject empty GitHub token", () => {
      const invalidInputs = { ...validInputs, githubToken: "" };
      const isValid = ValidationUtils.validateActionInputs(invalidInputs);
      expect(isValid).toBe(false);
    });
  });

  describe("validatePullRequestInfo", () => {
    const validPrInfo: PullRequestInfo = {
      number: 123,
      title: "Test PR",
      body: "Test body",
      baseSha: "a".repeat(40),
      headSha: "b".repeat(40),
      owner: "test-owner",
      repo: "test-repo",
    };

    test("should validate correct PR info", () => {
      const isValid = ValidationUtils.validatePullRequestInfo(validPrInfo);
      expect(isValid).toBe(true);
    });

    test("should reject invalid PR number", () => {
      const invalidPrInfo = { ...validPrInfo, number: 0 };
      const isValid = ValidationUtils.validatePullRequestInfo(invalidPrInfo);
      expect(isValid).toBe(false);
    });

    test("should reject empty title", () => {
      const invalidPrInfo = { ...validPrInfo, title: "" };
      const isValid = ValidationUtils.validatePullRequestInfo(invalidPrInfo);
      expect(isValid).toBe(false);
    });

    test("should reject empty SHA", () => {
      const invalidPrInfo = { ...validPrInfo, baseSha: "" };
      const isValid = ValidationUtils.validatePullRequestInfo(invalidPrInfo);
      expect(isValid).toBe(false);
    });

    test("should reject empty owner", () => {
      const invalidPrInfo = { ...validPrInfo, owner: "" };
      const isValid = ValidationUtils.validatePullRequestInfo(invalidPrInfo);
      expect(isValid).toBe(false);
    });

    test("should reject empty repo", () => {
      const invalidPrInfo = { ...validPrInfo, repo: "" };
      const isValid = ValidationUtils.validatePullRequestInfo(invalidPrInfo);
      expect(isValid).toBe(false);
    });
  });

  describe("validateReviewIssue", () => {
    const validIssue: ReviewIssue = {
      id: "issue-1",
      type: "bug",
      severity: "high",
      title: "Test Issue",
      description: "Test description",
      location: "test.ts:10",
      filePath: "test.ts",
      startLine: 10,
    };

    test("should validate correct issue", () => {
      const isValid = ValidationUtils.validateReviewIssue(validIssue);
      expect(isValid).toBe(true);
    });

    test("should reject empty ID", () => {
      const invalidIssue = { ...validIssue, id: "" };
      const isValid = ValidationUtils.validateReviewIssue(invalidIssue);
      expect(isValid).toBe(false);
    });

    test("should reject invalid type", () => {
      const invalidIssue = { ...validIssue, type: "invalid" as any };
      const isValid = ValidationUtils.validateReviewIssue(invalidIssue);
      expect(isValid).toBe(false);
    });

    test("should reject invalid severity", () => {
      const invalidIssue = { ...validIssue, severity: "invalid" as any };
      const isValid = ValidationUtils.validateReviewIssue(invalidIssue);
      expect(isValid).toBe(false);
    });

    test("should reject empty title", () => {
      const invalidIssue = { ...validIssue, title: "" };
      const isValid = ValidationUtils.validateReviewIssue(invalidIssue);
      expect(isValid).toBe(false);
    });

    test("should reject empty description", () => {
      const invalidIssue = { ...validIssue, description: "" };
      const isValid = ValidationUtils.validateReviewIssue(invalidIssue);
      expect(isValid).toBe(false);
    });

    test("should reject invalid line numbers", () => {
      const invalidIssue1 = { ...validIssue, startLine: 0 };
      const invalidIssue2 = { ...validIssue, endLine: 0 };
      const invalidIssue3 = { ...validIssue, startLine: 10, endLine: 5 };

      expect(ValidationUtils.validateReviewIssue(invalidIssue1)).toBe(false);
      expect(ValidationUtils.validateReviewIssue(invalidIssue2)).toBe(false);
      expect(ValidationUtils.validateReviewIssue(invalidIssue3)).toBe(false);
    });
  });

  describe("validateReviewResult", () => {
    const validResult: ReviewResult = {
      reviewId: "review-123",
      timestamp: "2024-01-01T00:00:00Z",
      commitSha: "a".repeat(40),
      summary: "Test summary",
      issues: [],
      totalIssues: 0,
    };

    test("should validate correct review result", () => {
      const isValid = ValidationUtils.validateReviewResult(validResult);
      expect(isValid).toBe(true);
    });

    test("should reject empty review ID", () => {
      const invalidResult = { ...validResult, reviewId: "" };
      const isValid = ValidationUtils.validateReviewResult(invalidResult);
      expect(isValid).toBe(false);
    });

    test("should reject empty timestamp", () => {
      const invalidResult = { ...validResult, timestamp: "" };
      const isValid = ValidationUtils.validateReviewResult(invalidResult);
      expect(isValid).toBe(false);
    });

    test("should reject invalid timestamp format", () => {
      const invalidResult = { ...validResult, timestamp: "invalid-date" };
      const isValid = ValidationUtils.validateReviewResult(invalidResult);
      expect(isValid).toBe(false);
    });

    test("should correct mismatched issue count", () => {
      const resultWithMismatch = {
        ...validResult,
        totalIssues: 5,
        issues: [
          {
            id: "issue-1",
            type: "bug" as const,
            severity: "high" as const,
            title: "Test",
            description: "Test",
            location: "test.ts:1",
          },
        ],
      };

      const isValid = ValidationUtils.validateReviewResult(resultWithMismatch);
      expect(isValid).toBe(true);
      expect(resultWithMismatch.totalIssues).toBe(1); // Should be corrected
    });
  });

  describe("validateFilePath", () => {
    test("should validate normal file paths", () => {
      expect(ValidationUtils.validateFilePath("src/test.ts")).toBe(true);
      expect(ValidationUtils.validateFilePath("./src/test.ts")).toBe(true);
      expect(ValidationUtils.validateFilePath("/absolute/path.ts")).toBe(true);
    });

    test("should reject empty paths", () => {
      expect(ValidationUtils.validateFilePath("")).toBe(false);
      expect(ValidationUtils.validateFilePath("   ")).toBe(false);
    });

    test("should reject paths with dangerous characters", () => {
      expect(ValidationUtils.validateFilePath("test\0file.ts")).toBe(false);
      expect(ValidationUtils.validateFilePath("test\rfile.ts")).toBe(false);
      expect(ValidationUtils.validateFilePath("test\nfile.ts")).toBe(false);
    });
  });

  describe("validateDiffContent", () => {
    test("should validate correct diff content", () => {
      const validDiff = `diff --git a/test.ts b/test.ts
@@ -1,3 +1,3 @@
 line 1
-old line
+new line
 line 3`;

      const isValid = ValidationUtils.validateDiffContent(validDiff);
      expect(isValid).toBe(true);
    });

    test("should reject empty diff", () => {
      const isValid = ValidationUtils.validateDiffContent("");
      expect(isValid).toBe(false);
    });

    test("should reject diff without headers", () => {
      const invalidDiff = "just some text";
      const isValid = ValidationUtils.validateDiffContent(invalidDiff);
      expect(isValid).toBe(false);
    });
  });
});
