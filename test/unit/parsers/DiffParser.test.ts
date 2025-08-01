import { DiffParser } from "../../../src/parsers/DiffParser";

describe("DiffParser", () => {
  let diffParser: DiffParser;

  beforeEach(() => {
    diffParser = new DiffParser();
  });

  const sampleDiff = `diff --git a/src/test.ts b/src/test.ts
index 1234567..abcdefg 100644
--- a/src/test.ts
+++ b/src/test.ts
@@ -1,5 +1,7 @@
 function test() {
-  console.log('old');
+  console.log('new');
+  console.log('added line');
 }
 
 function another() {
@@ -10,3 +12,4 @@ function another() {
 }
 
 export { test };
+// New comment
`;

  describe("parseDiffContent", () => {
    test("should parse diff content correctly", () => {
      const parsedDiff = diffParser.parseDiffContent(sampleDiff);

      expect(parsedDiff.files.size).toBe(1);
      expect(parsedDiff.files.has("src/test.ts")).toBe(true);

      const hunks = parsedDiff.files.get("src/test.ts");
      expect(hunks).toBeDefined();
      expect(hunks!.length).toBeGreaterThan(0);

      const firstHunk = hunks![0];
      expect(firstHunk).toBeDefined();
      if (firstHunk) {
        expect(firstHunk.filePath).toBe("src/test.ts");
        expect(firstHunk.oldStart).toBe(1);
        expect(firstHunk.newStart).toBe(1);
        expect(firstHunk.lines.length).toBeGreaterThan(0);
      }
    });

    test("should handle empty diff", () => {
      const parsedDiff = diffParser.parseDiffContent("");
      expect(parsedDiff.files.size).toBe(0);
    });

    test("should handle malformed diff gracefully", () => {
      const malformedDiff = "not a valid diff";
      const parsedDiff = diffParser.parseDiffContent(malformedDiff);
      expect(parsedDiff.files.size).toBe(0);
    });
  });

  describe("isLineInDiff", () => {
    test("should return true for lines in diff range", () => {
      const parsedDiff = diffParser.parseDiffContent(sampleDiff);

      // Line 1 should be in the diff
      const isInDiff = diffParser.isLineInDiff("src/test.ts", 1, parsedDiff);
      expect(isInDiff).toBe(true);
    });

    test("should return false for lines not in diff", () => {
      const parsedDiff = diffParser.parseDiffContent(sampleDiff);

      // Line 999 should not be in the diff
      const isInDiff = diffParser.isLineInDiff("src/test.ts", 999, parsedDiff);
      expect(isInDiff).toBe(false);
    });

    test("should return false for non-existent files", () => {
      const parsedDiff = diffParser.parseDiffContent(sampleDiff);

      const isInDiff = diffParser.isLineInDiff(
        "non-existent.ts",
        1,
        parsedDiff
      );
      expect(isInDiff).toBe(false);
    });

    test("should handle path variations", () => {
      const parsedDiff = diffParser.parseDiffContent(sampleDiff);

      // Should match with different path formats
      const isInDiff1 = diffParser.isLineInDiff("./src/test.ts", 1, parsedDiff);
      const isInDiff2 = diffParser.isLineInDiff("/src/test.ts", 1, parsedDiff);

      // At least one should work (depending on implementation)
      expect(isInDiff1 || isInDiff2).toBe(true);
    });
  });

  describe("validateDiffContent", () => {
    test("should validate correct diff content", () => {
      const isValid = diffParser.validateDiffContent(sampleDiff);
      expect(isValid).toBe(true);
    });

    test("should reject empty diff content", () => {
      const isValid = diffParser.validateDiffContent("");
      expect(isValid).toBe(false);
    });

    test("should reject invalid diff content", () => {
      const isValid = diffParser.validateDiffContent("not a diff");
      expect(isValid).toBe(false);
    });

    test("should require both diff and hunk headers", () => {
      const diffWithoutHunk = `diff --git a/test.ts b/test.ts
index 1234567..abcdefg 100644
--- a/test.ts
+++ b/test.ts
 function test() {
   console.log('test');
 }`;

      const isValid = diffParser.validateDiffContent(diffWithoutHunk);
      expect(isValid).toBe(false);
    });
  });

  describe("getDiffStats", () => {
    test("should calculate diff statistics correctly", () => {
      const parsedDiff = diffParser.parseDiffContent(sampleDiff);
      const stats = diffParser.getDiffStats(parsedDiff);

      expect(stats.fileCount).toBe(1);
      expect(stats.totalHunks).toBeGreaterThan(0);
      expect(stats.modifiedFiles).toContain("src/test.ts");
      expect(stats.addedLines).toBeGreaterThan(0);
      expect(stats.removedLines).toBeGreaterThan(0);
    });

    test("should handle empty diff stats", () => {
      const emptyDiff = { files: new Map() };
      const stats = diffParser.getDiffStats(emptyDiff);

      expect(stats.fileCount).toBe(0);
      expect(stats.totalHunks).toBe(0);
      expect(stats.addedLines).toBe(0);
      expect(stats.removedLines).toBe(0);
      expect(stats.modifiedFiles).toEqual([]);
    });
  });
});
