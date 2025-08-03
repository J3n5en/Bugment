import { GitService } from "../../../src/services/GitService";
import { IgnoreManager } from "../../../src/utils/IgnoreManager";
import { PullRequestInfo } from "../../../src/core/types";

describe("GitService - Diff Filtering", () => {
  let gitService: GitService;
  let ignoreManager: IgnoreManager;
  let mockPrInfo: PullRequestInfo;

  beforeEach(() => {
    mockPrInfo = {
      number: 123,
      title: "Test PR",
      body: "Test description",
      baseSha: "base123",
      headSha: "head456",
      owner: "test-owner",
      repo: "test-repo",
    };

    // 创建 IgnoreManager 实例（使用默认模式）
    ignoreManager = new IgnoreManager("/tmp/test", true);
    gitService = new GitService(mockPrInfo, "/tmp/test", ignoreManager);
  });

  describe("filterDiffContent", () => {
    test("should filter out package-lock.json from diff", () => {
      const diffContent = `diff --git a/package.json b/package.json
index 1234567..abcdefg 100644
--- a/package.json
+++ b/package.json
@@ -1,5 +1,6 @@
 {
   "name": "test-project",
+  "description": "Added description",
   "version": "1.0.0"
 }
diff --git a/package-lock.json b/package-lock.json
index 7890abc..def1234 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,10 +1,15 @@
 {
   "name": "test-project",
   "version": "1.0.0",
+  "lockfileVersion": 3,
   "requires": true
 }
diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
+import express from 'express';
 
 console.log('Hello World');`;

      const filteredContent = (gitService as any).filterDiffContent(diffContent);

      // package-lock.json 应该被过滤掉
      expect(filteredContent).not.toContain("package-lock.json");
      expect(filteredContent).not.toContain("lockfileVersion");

      // 其他文件应该保留
      expect(filteredContent).toContain("package.json");
      expect(filteredContent).toContain("src/index.ts");
      expect(filteredContent).toContain("Added description");
      expect(filteredContent).toContain("import express");
    });

    test("should filter out multiple ignored files", () => {
      const diffContent = `diff --git a/package.json b/package.json
index 1234567..abcdefg 100644
--- a/package.json
+++ b/package.json
@@ -1,3 +1,4 @@
 {
   "name": "test-project"
+  "description": "Test"
 }
diff --git a/package-lock.json b/package-lock.json
index 1111111..2222222 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5 +1,6 @@
 {
   "name": "test-project",
+  "lockfileVersion": 3
 }
diff --git a/yarn.lock b/yarn.lock
index 3333333..4444444 100644
--- a/yarn.lock
+++ b/yarn.lock
@@ -1,3 +1,4 @@
 # yarn lockfile v1
+express@^4.18.0:
   version "4.18.0"
diff --git a/src/app.ts b/src/app.ts
index 5555555..6666666 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,2 +1,3 @@
 export class App {
+  name = 'test';
 }`;

      const filteredContent = (gitService as any).filterDiffContent(diffContent);

      // 被忽略的文件应该被过滤掉
      expect(filteredContent).not.toContain("package-lock.json");
      expect(filteredContent).not.toContain("yarn.lock");
      expect(filteredContent).not.toContain("lockfileVersion");
      expect(filteredContent).not.toContain("yarn lockfile v1");

      // 未被忽略的文件应该保留
      expect(filteredContent).toContain("package.json");
      expect(filteredContent).toContain("src/app.ts");
      expect(filteredContent).toContain("Test");
      expect(filteredContent).toContain("name = 'test'");
    });

    test("should preserve diff when no ignored files present", () => {
      const diffContent = `diff --git a/src/index.ts b/src/index.ts
index abc1234..def5678 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
+import express from 'express';
 
 console.log('Hello World');
diff --git a/README.md b/README.md
index 1111111..2222222 100644
--- a/README.md
+++ b/README.md
@@ -1,2 +1,3 @@
 # Test Project
+
 This is a test project.`;

      const filteredContent = (gitService as any).filterDiffContent(diffContent);

      // 内容应该完全保留
      expect(filteredContent).toBe(diffContent);
      expect(filteredContent).toContain("src/index.ts");
      expect(filteredContent).toContain("README.md");
      expect(filteredContent).toContain("import express");
      expect(filteredContent).toContain("This is a test project");
    });

    test("should handle empty diff content", () => {
      const diffContent = "";
      const filteredContent = (gitService as any).filterDiffContent(diffContent);
      expect(filteredContent).toBe("");
    });

    test("should handle diff with only ignored files", () => {
      const diffContent = `diff --git a/package-lock.json b/package-lock.json
index 1111111..2222222 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5 +1,6 @@
 {
   "name": "test-project",
+  "lockfileVersion": 3
 }
diff --git a/yarn.lock b/yarn.lock
index 3333333..4444444 100644
--- a/yarn.lock
+++ b/yarn.lock
@@ -1,3 +1,4 @@
 # yarn lockfile v1
+express@^4.18.0:
   version "4.18.0"`;

      const filteredContent = (gitService as any).filterDiffContent(diffContent);

      // 所有内容都应该被过滤掉，只剩下空行
      expect(filteredContent.trim()).toBe("");
      expect(filteredContent).not.toContain("package-lock.json");
      expect(filteredContent).not.toContain("yarn.lock");
    });

    test("should work without ignore manager", () => {
      const gitServiceWithoutIgnore = new GitService(mockPrInfo, "/tmp/test");
      const diffContent = `diff --git a/package-lock.json b/package-lock.json
index 1111111..2222222 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -1,5 +1,6 @@
 {
   "name": "test-project"
+  "lockfileVersion": 3
 }`;

      const filteredContent = (gitServiceWithoutIgnore as any).filterDiffContent(diffContent);

      // 没有 ignore manager 时，内容应该保持不变
      expect(filteredContent).toBe(diffContent);
      expect(filteredContent).toContain("package-lock.json");
    });

    test("should handle malformed diff headers gracefully", () => {
      const diffContent = `diff --git invalid header
some content
diff --git a/valid.ts b/valid.ts
index abc..def 100644
--- a/valid.ts
+++ b/valid.ts
@@ -1,2 +1,3 @@
 const x = 1;
+const y = 2;`;

      const filteredContent = (gitService as any).filterDiffContent(diffContent);

      // 应该处理有效的部分，忽略无效的部分
      expect(filteredContent).toContain("valid.ts");
      expect(filteredContent).toContain("const y = 2");
      expect(filteredContent).toContain("some content"); // 无效头部后的内容应该保留
    });
  });
});
