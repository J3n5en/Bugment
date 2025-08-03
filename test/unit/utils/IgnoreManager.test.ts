import { IgnoreManager } from "../../../src/utils/IgnoreManager";
import * as fs from "fs";
import * as path from "path";

// Mock fs module
jest.mock("fs", () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

// Mock @actions/core to avoid fs.promises issues
jest.mock("@actions/core", () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe("IgnoreManager", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = "/tmp/test-bugment";
    jest.clearAllMocks();

    // Mock fs.existsSync to return false by default (no .bugmentignore file)
    mockFs.existsSync.mockReturnValue(false);
  });

  describe("Default patterns", () => {
    test("should ignore package-lock.json by default", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      expect(ignoreManager.shouldIgnore("package-lock.json")).toBe(true);
      expect(ignoreManager.shouldIgnore("./package-lock.json")).toBe(true);
      expect(ignoreManager.shouldIgnore("/package-lock.json")).toBe(true);
    });

    test("should ignore other lock files by default", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      expect(ignoreManager.shouldIgnore("yarn.lock")).toBe(true);
      expect(ignoreManager.shouldIgnore("pnpm-lock.yaml")).toBe(true);
      expect(ignoreManager.shouldIgnore("composer.lock")).toBe(true);
      expect(ignoreManager.shouldIgnore("Pipfile.lock")).toBe(true);
      expect(ignoreManager.shouldIgnore("poetry.lock")).toBe(true);
      expect(ignoreManager.shouldIgnore("Cargo.lock")).toBe(true);
    });

    test("should ignore node_modules directory by default", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      expect(ignoreManager.shouldIgnore("node_modules/express/index.js")).toBe(
        true
      );
      expect(ignoreManager.shouldIgnore("node_modules/package.json")).toBe(
        true
      );
      expect(ignoreManager.shouldIgnore("./node_modules/test.js")).toBe(true);
    });

    test("should ignore build directories by default", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      expect(ignoreManager.shouldIgnore("dist/index.js")).toBe(true);
      expect(ignoreManager.shouldIgnore("build/app.js")).toBe(true);
      expect(ignoreManager.shouldIgnore("out/main.js")).toBe(true);
      expect(ignoreManager.shouldIgnore("target/release/app")).toBe(true);
      expect(ignoreManager.shouldIgnore(".next/static/chunks/main.js")).toBe(
        true
      );
    });

    test("should ignore log files by default", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      expect(ignoreManager.shouldIgnore("app.log")).toBe(true);
      expect(ignoreManager.shouldIgnore("error.log")).toBe(true);
      expect(ignoreManager.shouldIgnore("npm-debug.log")).toBe(true);
      expect(ignoreManager.shouldIgnore("yarn-error.log")).toBe(true);
      expect(ignoreManager.shouldIgnore("logs/app.log")).toBe(true);
    });

    test("should not ignore source files by default", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      expect(ignoreManager.shouldIgnore("src/index.ts")).toBe(false);
      expect(ignoreManager.shouldIgnore("package.json")).toBe(false);
      expect(ignoreManager.shouldIgnore("README.md")).toBe(false);
      expect(ignoreManager.shouldIgnore("tsconfig.json")).toBe(false);
      expect(ignoreManager.shouldIgnore("jest.config.js")).toBe(false);
    });
  });

  describe("Custom .bugmentignore file", () => {
    test("should load patterns from .bugmentignore file", () => {
      const customIgnoreContent = `# Custom ignore patterns
*.temp
test-data/**
custom-file.txt`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(customIgnoreContent);

      const ignoreManager = new IgnoreManager(tempDir);

      // Should still have default patterns
      expect(ignoreManager.shouldIgnore("package-lock.json")).toBe(true);

      // Should also have custom patterns
      expect(ignoreManager.shouldIgnore("file.temp")).toBe(true);
      expect(ignoreManager.shouldIgnore("test-data/sample.json")).toBe(true);
      expect(ignoreManager.shouldIgnore("custom-file.txt")).toBe(true);
    });

    test("should handle comments and empty lines in .bugmentignore", () => {
      const customIgnoreContent = `# This is a comment
*.temp

# Another comment
test-file.txt
# End comment`;

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(customIgnoreContent);

      const ignoreManager = new IgnoreManager(tempDir);

      expect(ignoreManager.shouldIgnore("file.temp")).toBe(true);
      expect(ignoreManager.shouldIgnore("test-file.txt")).toBe(true);

      // Comments should not be treated as patterns
      expect(ignoreManager.shouldIgnore("# This is a comment")).toBe(false);
    });

    test("should handle Windows line endings", () => {
      const customIgnoreContent = "*.temp\r\ntest-file.txt\r\n";

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(customIgnoreContent);

      const ignoreManager = new IgnoreManager(tempDir);

      expect(ignoreManager.shouldIgnore("file.temp")).toBe(true);
      expect(ignoreManager.shouldIgnore("test-file.txt")).toBe(true);
    });
  });

  describe("Pattern matching", () => {
    test("should handle glob patterns correctly", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      // Test wildcard patterns (from default patterns)
      expect(ignoreManager.shouldIgnore("app.log")).toBe(true);
      expect(ignoreManager.shouldIgnore("error.log")).toBe(true);
      expect(ignoreManager.shouldIgnore("debug.log")).toBe(true);
    });

    test("should handle directory patterns correctly", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      // Test directory patterns (from default patterns)
      expect(ignoreManager.shouldIgnore("node_modules/express/index.js")).toBe(
        true
      );
      expect(ignoreManager.shouldIgnore("dist/js/app.js")).toBe(true);
      expect(
        ignoreManager.shouldIgnore("coverage/lcov-report/index.html")
      ).toBe(true);
    });

    test("should normalize file paths correctly", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      // All these should be treated the same
      expect(ignoreManager.shouldIgnore("package-lock.json")).toBe(true);
      expect(ignoreManager.shouldIgnore("./package-lock.json")).toBe(true);
      expect(ignoreManager.shouldIgnore("/package-lock.json")).toBe(true);
      expect(ignoreManager.shouldIgnore("///package-lock.json")).toBe(true);
    });
  });

  describe("Utility methods", () => {
    test("should return all patterns", () => {
      const ignoreManager = new IgnoreManager(tempDir);
      const patterns = ignoreManager.getPatterns();

      expect(patterns).toContain("package-lock.json");
      expect(patterns).toContain("yarn.lock");
      expect(patterns).toContain("node_modules/**");
      expect(patterns.length).toBeGreaterThan(0);
    });

    test("should allow adding custom patterns", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      ignoreManager.addPattern("custom-pattern.txt");

      expect(ignoreManager.shouldIgnore("custom-pattern.txt")).toBe(true);
    });

    test("should filter file lists correctly", () => {
      const ignoreManager = new IgnoreManager(tempDir);

      const files = [
        "src/index.ts",
        "package.json",
        "package-lock.json",
        "node_modules/express/index.js",
        "dist/app.js",
        "README.md",
      ];

      const filteredFiles = ignoreManager.filterFiles(files);

      expect(filteredFiles).toContain("src/index.ts");
      expect(filteredFiles).toContain("package.json");
      expect(filteredFiles).toContain("README.md");

      expect(filteredFiles).not.toContain("package-lock.json");
      expect(filteredFiles).not.toContain("node_modules/express/index.js");
      expect(filteredFiles).not.toContain("dist/app.js");
    });
  });

  describe("Constructor options", () => {
    test("should work without default patterns when useDefaults is false", () => {
      const ignoreManager = new IgnoreManager(tempDir, false);

      // Should not ignore default patterns
      expect(ignoreManager.shouldIgnore("package-lock.json")).toBe(false);
      expect(ignoreManager.shouldIgnore("node_modules/test.js")).toBe(false);
    });

    test("should still load .bugmentignore when useDefaults is false", () => {
      const customIgnoreContent = "custom-file.txt";

      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(customIgnoreContent);

      const ignoreManager = new IgnoreManager(tempDir, false);

      // Should not have default patterns
      expect(ignoreManager.shouldIgnore("package-lock.json")).toBe(false);

      // Should have custom patterns
      expect(ignoreManager.shouldIgnore("custom-file.txt")).toBe(true);
    });
  });
});
