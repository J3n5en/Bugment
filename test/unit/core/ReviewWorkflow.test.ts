import { ReviewWorkflow } from "../../../src/core/ReviewWorkflow";
import {
  ReviewResult,
  ReviewComparison,
  ReviewIssue,
} from "../../../src/core/types";

describe("ReviewWorkflow", () => {
  const mockIssue1: ReviewIssue = {
    id: "issue-1",
    type: "bug",
    severity: "high",
    title: "Test Bug",
    description: "This is a test bug",
    location: "test.ts:10",
    filePath: "test.ts",
    lineNumber: 10,
  };

  const mockIssue2: ReviewIssue = {
    id: "issue-2",
    type: "security",
    severity: "critical",
    title: "Security Issue",
    description: "This is a security issue",
    location: "auth.ts:25",
    filePath: "auth.ts",
    lineNumber: 25,
  };

  const mockCurrentReview: ReviewResult = {
    reviewId: "review-123",
    timestamp: "2024-01-01T00:00:00Z",
    commitSha: "commit123",
    summary: "Test review",
    issues: [mockIssue1, mockIssue2],
    totalIssues: 2,
  };

  describe("compareReviews", () => {
    test("should handle first review (no previous reviews)", () => {
      const comparison = ReviewWorkflow.compareReviews(mockCurrentReview, []);

      expect(comparison.newIssues).toEqual([mockIssue1, mockIssue2]);
      expect(comparison.fixedIssues).toEqual([]);
      expect(comparison.persistentIssues).toEqual([]);
      expect(comparison.modifiedIssues).toEqual([]);
      expect(comparison.newCount).toBe(2);
      expect(comparison.fixedCount).toBe(0);
      expect(comparison.persistentCount).toBe(0);
    });

    test("should detect fixed issues", () => {
      const previousReview: ReviewResult = {
        ...mockCurrentReview,
        reviewId: "review-122",
        issues: [
          mockIssue1,
          mockIssue2,
          {
            id: "issue-3",
            type: "code_smell",
            severity: "low",
            title: "Code Smell",
            description: "This was fixed",
            location: "old.ts:5",
            filePath: "old.ts",
            lineNumber: 5,
          },
        ],
      };

      const currentReviewWithoutIssue3: ReviewResult = {
        ...mockCurrentReview,
        issues: [mockIssue1, mockIssue2],
      };

      const comparison = ReviewWorkflow.compareReviews(
        currentReviewWithoutIssue3,
        [previousReview]
      );

      expect(comparison.fixedCount).toBe(1);
      expect(comparison.persistentCount).toBe(2);
      expect(comparison.newCount).toBe(0);
    });

    test("should detect new issues", () => {
      const previousReview: ReviewResult = {
        ...mockCurrentReview,
        reviewId: "review-122",
        issues: [mockIssue1],
      };

      const comparison = ReviewWorkflow.compareReviews(mockCurrentReview, [
        previousReview,
      ]);

      expect(comparison.newCount).toBe(1);
      expect(comparison.persistentCount).toBe(1);
      expect(comparison.fixedCount).toBe(0);
    });
  });

  describe("determineReviewEvent", () => {
    test("should return REQUEST_CHANGES for critical issues", () => {
      const reviewWithCritical: ReviewResult = {
        ...mockCurrentReview,
        issues: [mockIssue2], // critical severity
      };

      const eventType = ReviewWorkflow.determineReviewEvent(reviewWithCritical);
      expect(eventType).toBe("REQUEST_CHANGES");
    });

    test("should return REQUEST_CHANGES for high severity issues", () => {
      const reviewWithHigh: ReviewResult = {
        ...mockCurrentReview,
        issues: [mockIssue1], // high severity
      };

      const eventType = ReviewWorkflow.determineReviewEvent(reviewWithHigh);
      expect(eventType).toBe("REQUEST_CHANGES");
    });

    test("should return COMMENT for medium/low severity issues", () => {
      const reviewWithMedium: ReviewResult = {
        ...mockCurrentReview,
        issues: [
          {
            ...mockIssue1,
            severity: "medium",
          },
        ],
      };

      const eventType = ReviewWorkflow.determineReviewEvent(reviewWithMedium);
      expect(eventType).toBe("COMMENT");
    });

    test("should return COMMENT for no issues", () => {
      const reviewWithNoIssues: ReviewResult = {
        ...mockCurrentReview,
        issues: [],
        totalIssues: 0,
      };

      const eventType = ReviewWorkflow.determineReviewEvent(reviewWithNoIssues);
      expect(eventType).toBe("COMMENT");
    });
  });

  describe("validateLineComments", () => {
    const mockLineComments = [
      {
        path: "test.ts",
        line: 10,
        body: "Test comment",
      },
      {
        path: "invalid.ts",
        line: 999,
        body: "Invalid comment",
      },
    ];

    test("should validate line comments against diff", () => {
      const mockDiffData = {}; // Mock diff data

      // Mock the isLineInDiff method to return true for test.ts:10
      const mockIsLineInDiff = jest
        .fn()
        .mockReturnValueOnce(true) // test.ts:10 is valid
        .mockReturnValueOnce(false); // invalid.ts:999 is invalid

      // We need to mock the private method for testing
      const originalIsLineInDiff = (ReviewWorkflow as any).isLineInDiff;
      (ReviewWorkflow as any).isLineInDiff = mockIsLineInDiff;

      const result = ReviewWorkflow.validateLineComments(
        mockLineComments,
        mockDiffData
      );

      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
      expect(result.valid[0]?.path).toBe("test.ts");
      expect(result.invalid[0]?.path).toBe("invalid.ts");

      // Restore original method
      (ReviewWorkflow as any).isLineInDiff = originalIsLineInDiff;
    });
  });
});
