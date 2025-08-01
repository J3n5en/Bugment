import { BugmentCore } from "../../../src/core/BugmentCore";
import { ActionInputs, PullRequestInfo } from "../../../src/core/types";

describe("BugmentCore", () => {
  const mockInputs: ActionInputs = {
    augmentAccessToken: "test-token",
    augmentTenantUrl: "https://test.augment.com",
    githubToken: "github-token",
  };

  const mockPrInfo: PullRequestInfo = {
    number: 123,
    title: "Test PR",
    body: "Test PR body",
    baseSha: "base123",
    headSha: "head456",
    owner: "test-owner",
    repo: "test-repo",
  };

  let core: BugmentCore;

  beforeEach(() => {
    core = new BugmentCore(mockInputs, mockPrInfo);
  });

  describe("constructor", () => {
    test("should initialize with correct inputs and PR info", () => {
      expect(core.actionInputs).toEqual(mockInputs);
      expect(core.pullRequestInfo).toEqual(mockPrInfo);
    });

    test("should initialize with undefined diff data", () => {
      expect(core.diffData).toBeUndefined();
    });
  });

  describe("getters and setters", () => {
    test("should return correct action inputs", () => {
      expect(core.actionInputs).toEqual(mockInputs);
    });

    test("should return correct PR info", () => {
      expect(core.pullRequestInfo).toEqual(mockPrInfo);
    });

    test("should set and get diff data", () => {
      const mockDiffData = {
        files: new Map([["test.ts", []]]),
      };

      core.diffData = mockDiffData;
      expect(core.diffData).toEqual(mockDiffData);
    });
  });

  describe("executeReview", () => {
    test("should handle errors gracefully", async () => {
      // Mock console methods to avoid noise in test output
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      // This will not throw because executeReview has try-catch
      await expect(core.executeReview()).resolves.not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});
