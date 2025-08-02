// Simple unit tests for core functionality
import {
  ReviewIssue,
  ReviewResult,
  ReviewComparison,
} from "../../../src/core/types";
import { ComparisonUtils } from "../../../src/utils/ComparisonUtils";
import { IssueUtils } from "../../../src/utils/IssueUtils";

describe("Bugment Review System", () => {
  // Use utility functions from the new modules
  function getIssueSignature(issue: ReviewIssue): string {
    return IssueUtils.createIssueSignature(issue);
  }

  function issuesAreSimilar(issue1: ReviewIssue, issue2: ReviewIssue): boolean {
    return IssueUtils.areIssuesSimilar(issue1, issue2);
  }

  function compareReviews(
    currentReview: ReviewResult,
    previousReviews: ReviewResult[]
  ): ReviewComparison {
    return ComparisonUtils.compareReviews(currentReview, previousReviews);
  }

  // Legacy implementation for testing (can be removed later)
  function compareReviewsLegacy(
    currentReview: ReviewResult,
    previousReviews: ReviewResult[]
  ): ReviewComparison {
    if (previousReviews.length === 0) {
      return {
        newIssues: currentReview.issues,
        fixedIssues: [],
        persistentIssues: [],
        modifiedIssues: [],
        fixedCount: 0,
        newCount: currentReview.issues.length,
        persistentCount: 0,
      };
    }

    const latestPreviousReview = previousReviews[0];
    if (!latestPreviousReview) {
      return {
        newIssues: currentReview.issues,
        fixedIssues: [],
        persistentIssues: [],
        modifiedIssues: [],
        fixedCount: 0,
        newCount: currentReview.issues.length,
        persistentCount: 0,
      };
    }

    const newIssues: ReviewIssue[] = [];
    const fixedIssues: ReviewIssue[] = [];
    const persistentIssues: ReviewIssue[] = [];
    const modifiedIssues: { previous: ReviewIssue; current: ReviewIssue }[] =
      [];

    const currentIssueMap = new Map(
      currentReview.issues.map((issue) => [getIssueSignature(issue), issue])
    );
    const previousIssueMap = new Map(
      latestPreviousReview.issues.map((issue) => [
        getIssueSignature(issue),
        issue,
      ])
    );

    for (const currentIssue of currentReview.issues) {
      const signature = getIssueSignature(currentIssue);
      const previousIssue = previousIssueMap.get(signature);

      if (!previousIssue) {
        newIssues.push(currentIssue);
      } else if (issuesAreSimilar(currentIssue, previousIssue)) {
        if (currentIssue.description !== previousIssue.description) {
          modifiedIssues.push({
            previous: previousIssue,
            current: currentIssue,
          });
        } else {
          persistentIssues.push(currentIssue);
        }
      }
    }

    for (const previousIssue of latestPreviousReview.issues) {
      const signature = getIssueSignature(previousIssue);
      if (!currentIssueMap.has(signature)) {
        fixedIssues.push(previousIssue);
      }
    }

    return {
      newIssues,
      fixedIssues,
      persistentIssues,
      modifiedIssues,
      fixedCount: fixedIssues.length,
      newCount: newIssues.length,
      persistentCount: persistentIssues.length,
    };
  }

  describe("Issue Signature Generation", () => {
    it("should generate consistent signatures for similar issues", () => {
      const issue1: ReviewIssue = {
        id: "test1",
        type: "bug",
        severity: "high",
        title: "Test Bug",
        description: "This is a test bug with some description",
        location: "src/test.ts:10",
      };

      const issue2: ReviewIssue = {
        id: "test2",
        type: "bug",
        severity: "high",
        title: "Test Bug",
        description: "This is a test bug with some description",
        location: "src/test.ts:10",
      };

      const signature1 = getIssueSignature(issue1);
      const signature2 = getIssueSignature(issue2);

      expect(signature1).toBe(signature2);
      expect(signature1).toContain(
        "bug_src/test.ts:10_This_is_a_test_bug_with_some_description"
      );
    });

    it("should generate different signatures for different issues", () => {
      const issue1: ReviewIssue = {
        id: "test1",
        type: "bug",
        severity: "high",
        title: "Test Bug",
        description: "First bug description",
        location: "src/test.ts:10",
      };

      const issue2: ReviewIssue = {
        id: "test2",
        type: "code_smell",
        severity: "medium",
        title: "Test Smell",
        description: "Second smell description",
        location: "src/other.ts:20",
      };

      const signature1 = getIssueSignature(issue1);
      const signature2 = getIssueSignature(issue2);

      expect(signature1).not.toBe(signature2);
    });
  });

  describe("Review Comparison", () => {
    it("should identify fixed and new issues correctly", () => {
      const previousReview: ReviewResult = {
        reviewId: "pr123_old_123456",
        timestamp: "2023-01-01T00:00:00Z",
        commitSha: "old-sha",
        summary: "Previous review",
        issues: [
          {
            id: "bug_1",
            type: "bug",
            severity: "high",
            title: "Null pointer risk",
            description: "Potential null pointer exception",
            location: "src/utils.ts:45",
          },
          {
            id: "smell_1",
            type: "code_smell",
            severity: "medium",
            title: "Code duplication",
            description: "Duplicate validation logic",
            location: "src/validator.ts:20-30",
          },
        ],
        totalIssues: 2,
      };

      const currentReview: ReviewResult = {
        reviewId: "pr123_new_789012",
        timestamp: "2023-01-02T00:00:00Z",
        commitSha: "new-sha",
        summary: "Current review",
        issues: [
          {
            id: "smell_1",
            type: "code_smell",
            severity: "medium",
            title: "Code duplication",
            description: "Duplicate validation logic",
            location: "src/validator.ts:20-30",
          },
          {
            id: "bug_2",
            type: "bug",
            severity: "low",
            title: "New issue",
            description: "A new bug found",
            location: "src/new.ts:10",
          },
        ],
        totalIssues: 2,
      };

      const comparison = compareReviews(currentReview, [previousReview]);

      expect(comparison.fixedCount).toBe(1); // bug_1 was fixed
      expect(comparison.newCount).toBe(1); // bug_2 is new
      expect(comparison.persistentCount).toBe(1); // smell_1 persists
      expect(comparison.fixedIssues).toHaveLength(1);
      expect(comparison.newIssues).toHaveLength(1);
      expect(comparison.persistentIssues).toHaveLength(1);
      expect(comparison.fixedIssues[0]?.id).toBe("bug_1");
      expect(comparison.newIssues[0]?.id).toBe("bug_2");
      expect(comparison.persistentIssues[0]?.id).toBe("smell_1");
    });

    it("should handle first review correctly", () => {
      const currentReview: ReviewResult = {
        reviewId: "pr123_first_123456",
        timestamp: "2023-01-01T00:00:00Z",
        commitSha: "first-sha",
        summary: "First review",
        issues: [
          {
            id: "bug_1",
            type: "bug",
            severity: "high",
            title: "First bug",
            description: "First bug found",
            location: "src/test.ts:10",
          },
        ],
        totalIssues: 1,
      };

      const comparison = compareReviews(currentReview, []);

      expect(comparison.fixedCount).toBe(0);
      expect(comparison.newCount).toBe(1);
      expect(comparison.persistentCount).toBe(0);
      expect(comparison.newIssues).toHaveLength(1);
    });
  });

  describe("Issue Similarity Check", () => {
    it("should identify similar issues correctly", () => {
      const issue1: ReviewIssue = {
        id: "test1",
        type: "bug",
        severity: "high",
        title: "Test Bug",
        description: "Different description",
        location: "src/test.ts:10",
        filePath: "src/test.ts",
        lineNumber: 10,
      };

      const issue2: ReviewIssue = {
        id: "test2",
        type: "bug",
        severity: "medium",
        title: "Another Bug",
        description: "Another description",
        location: "src/test.ts:10",
        filePath: "src/test.ts",
        lineNumber: 10,
      };

      const issue3: ReviewIssue = {
        id: "test3",
        type: "code_smell",
        severity: "low",
        title: "Different Issue",
        description: "Different description",
        location: "src/other.ts:20",
        filePath: "src/other.ts",
        lineNumber: 20,
      };

      expect(issuesAreSimilar(issue1, issue2)).toBe(true);
      expect(issuesAreSimilar(issue1, issue3)).toBe(false);
      expect(issuesAreSimilar(issue2, issue3)).toBe(false);
    });
  });

  describe("Perfect PR Scenarios", () => {
    it("should handle perfect PR with no issues", () => {
      const perfectReview: ReviewResult = {
        reviewId: "pr123_perfect_123456",
        timestamp: "2023-01-01T00:00:00Z",
        commitSha: "perfect-sha",
        summary: "## 总体评价\n代码质量优秀",
        issues: [],
        totalIssues: 0,
      };

      const comparison = compareReviews(perfectReview, []);

      expect(comparison.fixedCount).toBe(0);
      expect(comparison.newCount).toBe(0);
      expect(comparison.persistentCount).toBe(0);
      expect(comparison.newIssues).toHaveLength(0);
      expect(comparison.fixedIssues).toHaveLength(0);
      expect(comparison.persistentIssues).toHaveLength(0);
    });

    it("should handle all issues fixed scenario", () => {
      const previousReview: ReviewResult = {
        reviewId: "pr123_with_issues_123456",
        timestamp: "2023-01-01T00:00:00Z",
        commitSha: "old-sha",
        summary: "Previous review with issues",
        issues: [
          {
            id: "bug_1",
            type: "bug",
            severity: "high",
            title: "Critical Bug",
            description: "A critical bug that needs fixing",
            location: "src/critical.ts:10",
          },
          {
            id: "smell_1",
            type: "code_smell",
            severity: "medium",
            title: "Code Smell",
            description: "Some code smell",
            location: "src/smell.ts:20",
          },
        ],
        totalIssues: 2,
      };

      const fixedReview: ReviewResult = {
        reviewId: "pr123_fixed_789012",
        timestamp: "2023-01-02T00:00:00Z",
        commitSha: "fixed-sha",
        summary: "## 总体评价\n所有问题已修复",
        issues: [],
        totalIssues: 0,
      };

      const comparison = compareReviews(fixedReview, [previousReview]);

      expect(comparison.fixedCount).toBe(2);
      expect(comparison.newCount).toBe(0);
      expect(comparison.persistentCount).toBe(0);
      expect(comparison.fixedIssues).toHaveLength(2);
      expect(comparison.fixedIssues[0]?.title).toBe("Critical Bug");
      expect(comparison.fixedIssues[1]?.title).toBe("Code Smell");
    });
  });
});
