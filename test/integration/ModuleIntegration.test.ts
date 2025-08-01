// Mock external dependencies first, before any imports
jest.mock("@actions/core", () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("@actions/github", () => ({
  context: {
    repo: { owner: "test-owner", repo: "test-repo" },
    payload: {
      pull_request: {
        number: 123,
        title: "Test PR",
        body: "Test PR body",
        base: { sha: "base-sha" },
        head: { sha: "head-sha" },
      },
    },
  },
  getOctokit: jest.fn(() => ({
    rest: {
      repos: { compareCommits: jest.fn() },
      pulls: { listReviews: jest.fn(), createReview: jest.fn() },
    },
  })),
}));

jest.mock("child_process", () => ({
  spawn: jest.fn(() => ({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event, callback) => {
      if (event === "close") callback(0);
    }),
  })),
}));

jest.mock("fs", () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(),
  },
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => "mock file content"),
}));

import { ActionInputs, PullRequestInfo } from "../../src/core/types";
import { BugmentCore } from "../../src/core/BugmentCore";
import { GitHubService } from "../../src/services/GitHubService";
import { DiffParser } from "../../src/parsers/DiffParser";
import { CommentFormatter } from "../../src/formatters/CommentFormatter";
import { ValidationUtils } from "../../src/utils/ValidationUtils";

describe("Module Integration Tests", () => {
  const mockInputs: ActionInputs = {
    augmentAccessToken: "test-token",
    augmentTenantUrl: "https://test.augment.com",
    githubToken: "github-token",
  };

  const mockPrInfo: PullRequestInfo = {
    number: 123,
    title: "Test PR",
    body: "Test PR body",
    baseSha: "a".repeat(40),
    headSha: "b".repeat(40),
    owner: "test-owner",
    repo: "test-repo",
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe("Core Module Integration", () => {
    test("should integrate BugmentCore with inputs and PR info", () => {
      const core = new BugmentCore(mockInputs, mockPrInfo);

      expect(core.actionInputs).toEqual(mockInputs);
      expect(core.pullRequestInfo).toEqual(mockPrInfo);
      expect(core.diffData).toBeUndefined();
    });

    test("should allow setting and getting diff data", () => {
      const core = new BugmentCore(mockInputs, mockPrInfo);
      const mockDiffData = {
        files: new Map([["test.ts", []]]),
      };

      core.diffData = mockDiffData;
      expect(core.diffData).toEqual(mockDiffData);
    });
  });

  describe("Service Module Integration", () => {
    test("should integrate GitHubService with inputs", () => {
      const githubService = new GitHubService(
        mockInputs.githubToken,
        mockPrInfo
      );

      expect(githubService).toBeDefined();
      // Test that the service can be instantiated without errors
    });
  });

  describe("Parser Module Integration", () => {
    test("should integrate DiffParser with sample data", () => {
      const diffParser = new DiffParser();
      const sampleDiff = `diff --git a/test.ts b/test.ts
index 1234567..abcdefg 100644
--- a/test.ts
+++ b/test.ts
@@ -1,3 +1,3 @@
 function test() {
-  console.log('old');
+  console.log('new');
 }`;

      const parsedDiff = diffParser.parseDiffContent(sampleDiff);
      expect(parsedDiff.files.size).toBe(1);
      expect(parsedDiff.files.has("test.ts")).toBe(true);
    });
  });

  describe("Formatter Module Integration", () => {
    test("should integrate CommentFormatter with review data", () => {
      const formatter = new CommentFormatter();
      const mockIssue = {
        id: "issue-1",
        type: "bug" as const,
        severity: "high" as const,
        title: "Test Issue",
        description: "Test description",
        location: "test.ts:10",
      };

      const comment = formatter.formatLineComment(mockIssue);
      expect(comment).toContain("🐛 潜在 Bug");
      expect(comment).toContain("Test description");
    });
  });

  describe("Validation Module Integration", () => {
    test("should integrate ValidationUtils with various inputs", () => {
      // Test input validation
      expect(ValidationUtils.validateActionInputs(mockInputs)).toBe(true);
      expect(ValidationUtils.validatePullRequestInfo(mockPrInfo)).toBe(true);

      // Test invalid inputs
      const invalidInputs = { ...mockInputs, augmentAccessToken: "" };
      expect(ValidationUtils.validateActionInputs(invalidInputs)).toBe(false);
    });
  });

  describe("Cross-Module Integration", () => {
    test("should work together across multiple modules", () => {
      // Test that modules can work together
      const core = new BugmentCore(mockInputs, mockPrInfo);
      const diffParser = new DiffParser();
      const formatter = new CommentFormatter();

      // Simulate a workflow
      const sampleDiff = `diff --git a/test.ts b/test.ts
@@ -1,1 +1,1 @@
-old line
+new line`;

      const parsedDiff = diffParser.parseDiffContent(sampleDiff);
      core.diffData = parsedDiff;

      const mockIssue = {
        id: "issue-1",
        type: "bug" as const,
        severity: "medium" as const,
        title: "Cross-module test",
        description: "Testing module integration",
        location: "test.ts:1",
      };

      const comment = formatter.formatLineComment(mockIssue);

      // Verify the workflow worked
      expect(core.diffData).toEqual(parsedDiff);
      expect(comment).toContain("Testing module integration");
      expect(parsedDiff.files.size).toBe(1);
    });
  });
});
