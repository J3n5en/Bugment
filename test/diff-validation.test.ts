import { DiffParser } from '../src/parsers/DiffParser';

// Test diff parsing and validation
describe('Diff Validation', () => {
  test('should parse diff content correctly', () => {
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

    // Use the new DiffParser module
    const diffParser = new DiffParser();
    const parsedDiff = diffParser.parseDiffContent(sampleDiff);
    
    expect(parsedDiff.files.has('src/test.ts')).toBe(true);
    
    const hunks = parsedDiff.files.get('src/test.ts');
    expect(hunks).toBeDefined();
    expect(hunks!.length).toBe(2);
    
    // First hunk: lines 1-7
    const firstHunk = hunks![0];
    expect(firstHunk.oldStart).toBe(1);
    expect(firstHunk.oldLines).toBe(5);
    expect(firstHunk.newStart).toBe(1);
    expect(firstHunk.newLines).toBe(7);
    
    // Second hunk: lines 12-15
    const secondHunk = hunks![1];
    expect(secondHunk.oldStart).toBe(10);
    expect(secondHunk.newStart).toBe(12);
  });

  test('should validate lines in diff correctly', () => {
    const action = new BugmentAction();
    
    // Mock the parsedDiff
    (action as any).parsedDiff = {
      files: new Map([
        ['src/test.ts', [
          {
            filePath: 'src/test.ts',
            oldStart: 1,
            oldLines: 5,
            newStart: 1,
            newLines: 7,
            lines: [
              ' function test() {',
              '-  console.log(\'old\');',
              '+  console.log(\'new\');',
              '+  console.log(\'added line\');',
              ' }',
              ' ',
              ' function another() {'
            ]
          }
        ]]
      )
    };
    
    // Test line validation
    expect((action as any).isLineInDiff('src/test.ts', 1)).toBe(true);  // Context line
    expect((action as any).isLineInDiff('src/test.ts', 2)).toBe(true);  // Modified line
    expect((action as any).isLineInDiff('src/test.ts', 3)).toBe(true);  // Added line
    expect((action as any).isLineInDiff('src/test.ts', 10)).toBe(false); // Not in diff
    expect((action as any).isLineInDiff('nonexistent.ts', 1)).toBe(false); // File not in diff
  });
});
