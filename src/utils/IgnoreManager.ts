import * as fs from "fs";
import * as path from "path";
import * as core from "@actions/core";

/**
 * 文件忽略管理器
 * 支持类似 .gitignore 的模式匹配
 */
export class IgnoreManager {
  private patterns: string[] = [];
  private defaultPatterns: string[] = [
    // 依赖锁定文件
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "composer.lock",
    "Pipfile.lock",
    "poetry.lock",
    "Cargo.lock",

    // 依赖目录
    "node_modules/**",
    "vendor/**",
    ".pnp/**",

    // 构建输出
    "dist/**",
    "build/**",
    "out/**",
    "target/**",
    ".next/**",
    ".nuxt/**",
    ".output/**",

    // 系统文件
    ".DS_Store",
    "Thumbs.db",
    "desktop.ini",

    // 日志文件
    "*.log",
    "logs/**",
    "npm-debug.log*",
    "yarn-debug.log*",
    "yarn-error.log*",

    // 环境变量文件
    ".env.local",
    ".env.development.local",
    ".env.test.local",
    ".env.production.local",

    // 缓存目录
    ".cache/**",
    ".tmp/**",
    ".temp/**",
    "tmp/**",
    "temp/**",

    // IDE 文件
    ".vscode/**",
    ".idea/**",
    "*.swp",
    "*.swo",
    "*~",

    // 测试覆盖率
    "coverage/**",
    ".nyc_output/**",
    "*.lcov",

    // 其他常见忽略
    "*.tsbuildinfo",
    ".eslintcache",
    ".stylelintcache",
  ];

  constructor(projectPath: string, useDefaults: boolean = true) {
    if (useDefaults) {
      this.patterns = [...this.defaultPatterns];
    }

    this.loadIgnoreFile(projectPath);
  }

  /**
   * 从项目根目录加载 .bugmentignore 文件
   */
  private loadIgnoreFile(projectPath: string): void {
    const ignoreFilePath = path.join(projectPath, ".bugmentignore");

    try {
      if (fs.existsSync(ignoreFilePath)) {
        const content = fs.readFileSync(ignoreFilePath, "utf-8");
        const filePatterns = this.parseIgnoreFile(content);
        this.patterns.push(...filePatterns);
        core.info(
          `📋 Loaded ${filePatterns.length} patterns from .bugmentignore`
        );
      } else {
        core.info(
          "📋 No .bugmentignore file found, using default patterns only"
        );
      }
    } catch (error) {
      core.warning(`⚠️ Failed to load .bugmentignore: ${error}`);
    }
  }

  /**
   * 解析忽略文件内容
   */
  private parseIgnoreFile(content: string): string[] {
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#")) // 过滤空行和注释
      .map((line) => line.replace(/\r$/, "")); // 移除Windows换行符
  }

  /**
   * 检查文件是否应该被忽略
   */
  public shouldIgnore(filePath: string): boolean {
    // 标准化文件路径（移除开头的 ./ 或 /）
    const normalizedPath = filePath.replace(/^\.?\/+/, "");

    for (const pattern of this.patterns) {
      if (this.matchPattern(normalizedPath, pattern)) {
        core.info(
          `🚫 Ignoring file: ${filePath} (matched pattern: ${pattern})`
        );
        return true;
      }
    }

    return false;
  }

  /**
   * 模式匹配逻辑
   * 支持基本的 glob 模式：*, **, ?
   */
  private matchPattern(filePath: string, pattern: string): boolean {
    // 标准化模式（移除开头的 ./ 或 /）
    const normalizedPattern = pattern.replace(/^\.?\/+/, "");

    // 转换 glob 模式为正则表达式
    const regexPattern = this.globToRegex(normalizedPattern);
    const regex = new RegExp(regexPattern);

    return regex.test(filePath);
  }

  /**
   * 将 glob 模式转换为正则表达式
   */
  private globToRegex(pattern: string): string {
    let regex = pattern
      // 转义特殊字符（但保留 * 和 ?）
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      // 先处理 ** 匹配任意深度的目录（使用占位符避免与单个 * 冲突）
      .replace(/\*\*/g, "__DOUBLE_STAR__")
      // * 匹配除路径分隔符外的任意字符
      .replace(/\*/g, "[^/]*")
      // 恢复 ** 为正确的正则表达式
      .replace(/__DOUBLE_STAR__/g, ".*")
      // ? 匹配单个字符（除路径分隔符）
      .replace(/\?/g, "[^/]");

    // 如果模式以 / 结尾，匹配目录及其所有内容
    if (pattern.endsWith("/")) {
      regex += ".*";
    }

    // 完整匹配
    return `^${regex}$`;
  }

  /**
   * 获取所有忽略模式（用于调试）
   */
  public getPatterns(): string[] {
    return [...this.patterns];
  }

  /**
   * 添加自定义忽略模式
   */
  public addPattern(pattern: string): void {
    this.patterns.push(pattern);
  }

  /**
   * 批量过滤文件列表
   */
  public filterFiles(files: string[]): string[] {
    return files.filter((file) => !this.shouldIgnore(file));
  }
}
