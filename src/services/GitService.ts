import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { PullRequestInfo } from "../core/types";
import { IgnoreManager } from "../utils/IgnoreManager";

/**
 * Git 操作服务类
 * 负责所有与 Git 相关的操作
 */
export class GitService {
  private prInfo: PullRequestInfo;
  private workspaceDir: string;
  private ignoreManager?: IgnoreManager;

  constructor(
    prInfo: PullRequestInfo,
    workspaceDir?: string,
    ignoreManager?: IgnoreManager
  ) {
    this.prInfo = prInfo;
    this.workspaceDir = workspaceDir || this.getWorkspaceDirectory();
    this.ignoreManager = ignoreManager;
  }

  /**
   * 获取工作空间目录
   */
  private getWorkspaceDirectory(): string {
    // GitHub Actions 设置 GITHUB_WORKSPACE 为用户的仓库目录
    return process.env.GITHUB_WORKSPACE || process.cwd();
  }

  /**
   * 生成 diff 文件
   */
  async generateDiffFile(): Promise<string> {
    core.info("📄 Generating PR diff file...");

    const diffPath = path.join(this.workspaceDir, "pr_diff.patch");

    core.info(`📁 Using workspace directory: ${this.workspaceDir}`);

    // 获取正确的 base SHA
    const actualBaseSha = await this.getActualBaseSha();
    core.info(`🔍 Comparing ${actualBaseSha}...${this.prInfo.headSha}`);
    core.info(
      `📝 Original base SHA: ${this.prInfo.baseSha} (PR creation time)`
    );
    core.info(`📝 Actual base SHA: ${actualBaseSha} (merge commit base)`);

    let diffContent: string;
    try {
      // 方法 1: 尝试使用本地 git diff（最准确）
      diffContent = await this.generateLocalDiff(actualBaseSha);
      await fs.promises.writeFile(diffPath, diffContent);
      core.info(`✅ Diff file generated using local git: ${diffPath}`);
    } catch (localError) {
      const errorMessage =
        localError instanceof Error ? localError.message : String(localError);
      core.warning(`Local git diff failed: ${errorMessage}`);
      throw new Error(`Failed to generate diff: ${errorMessage}`);
    }

    // 过滤 diff 内容，移除被忽略的文件
    if (this.ignoreManager) {
      diffContent = this.filterDiffContent(diffContent);
      await fs.promises.writeFile(diffPath, diffContent);
      core.info(`🔧 Diff content filtered to remove ignored files`);
    }

    // 调试：记录 diff 内容的前 1000 个字符用于故障排除
    core.info(`📄 Diff content preview: ${diffContent.substring(0, 1000)}...`);

    return diffPath;
  }

  /**
   * 获取实际的 base SHA
   */
  async getActualBaseSha(): Promise<string> {
    const githubSha = process.env.GITHUB_SHA;
    if (!githubSha) {
      core.info("📝 No GITHUB_SHA found, using original base SHA");
      return this.prInfo.baseSha;
    }

    // 首先检查这是否是合并提交
    const isMergeCommit = await this.checkIfMergeCommit(githubSha);
    if (!isMergeCommit) {
      core.info("📝 GITHUB_SHA is not a merge commit, using original base SHA");
      return this.prInfo.baseSha;
    }

    // 尝试获取合并提交的第一个父提交
    return new Promise((resolve) => {
      const gitProcess = spawn("git", ["rev-parse", `${githubSha}^1`], {
        cwd: this.workspaceDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      gitProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on("close", (code: number) => {
        if (code === 0) {
          const actualBaseSha = stdout.trim();
          core.info(
            `📝 Successfully extracted actual base SHA: ${actualBaseSha}`
          );
          resolve(actualBaseSha);
        } else {
          core.info(
            `📝 Could not extract base SHA from merge commit, using original base SHA`
          );
          core.debug(`Git error: ${stderr}`);
          resolve(this.prInfo.baseSha);
        }
      });

      gitProcess.on("error", (error: Error) => {
        core.info(`📝 Git command failed, using original base SHA`);
        core.debug(`Git error: ${error.message}`);
        resolve(this.prInfo.baseSha);
      });
    });
  }

  /**
   * 检查是否为合并提交
   */
  private async checkIfMergeCommit(sha: string): Promise<boolean> {
    return new Promise((resolve) => {
      const gitProcess = spawn("git", ["cat-file", "-p", sha], {
        cwd: this.workspaceDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";

      gitProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.on("close", (code: number) => {
        if (code === 0) {
          // 计算父提交行数 - 合并提交有多个父提交行
          const parentLines = stdout
            .split("\n")
            .filter((line) => line.startsWith("parent "));
          const isMerge = parentLines.length > 1;
          core.debug(
            `📝 Commit ${sha} has ${parentLines.length} parents, is merge: ${isMerge}`
          );
          resolve(isMerge);
        } else {
          core.debug(`📝 Could not check commit type for ${sha}`);
          resolve(false);
        }
      });

      gitProcess.on("error", () => {
        resolve(false);
      });
    });
  }

  /**
   * 生成本地 diff
   */
  private async generateLocalDiff(baseSha: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn(
        "git",
        ["diff", `${baseSha}...${this.prInfo.headSha}`],
        {
          cwd: this.workspaceDir,
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      let stdout = "";
      let stderr = "";

      gitProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on("close", (code: number) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Git diff failed with code ${code}: ${stderr}`));
        }
      });

      gitProcess.on("error", (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * 过滤 diff 内容，移除被忽略的文件
   */
  private filterDiffContent(diffContent: string): string {
    if (!this.ignoreManager) {
      return diffContent;
    }

    const lines = diffContent.split("\n");
    const filteredLines: string[] = [];
    let currentFile = "";
    let isIgnoringFile = false;
    let i = 0;

    core.info(`🔧 Filtering diff content with ${lines.length} lines`);

    while (i < lines.length) {
      const line = lines[i];

      if (!line) {
        if (!isIgnoringFile) {
          filteredLines.push(line || "");
        }
        i++;
        continue;
      }

      // 文件头: diff --git a/file b/file
      if (line.startsWith("diff --git")) {
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (match && match[2]) {
          const filePath = match[2]; // 使用新文件路径

          // 检查文件是否应该被忽略
          if (this.ignoreManager.shouldIgnore(filePath)) {
            // 标记此文件为忽略并跳过所有内容
            isIgnoringFile = true;
            currentFile = filePath;
            core.info(`🚫 Filtering out ignored file from diff: ${filePath}`);
            i++;
            continue;
          } else {
            // 文件未被忽略
            isIgnoringFile = false;
            currentFile = filePath;
            filteredLines.push(line);
          }
        } else {
          if (!isIgnoringFile) {
            filteredLines.push(line);
          }
        }
      }
      // 其他行：如果当前不在忽略文件中，则保留
      else {
        if (!isIgnoringFile) {
          filteredLines.push(line);
        }
      }

      i++;
    }

    const originalLineCount = lines.length;
    const filteredLineCount = filteredLines.length;
    core.info(
      `🔧 Diff filtering complete: ${originalLineCount} -> ${filteredLineCount} lines (removed ${originalLineCount - filteredLineCount} lines)`
    );

    return filteredLines.join("\n");
  }

  /**
   * 执行 Git 命令
   */
  async executeGitCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const gitProcess = spawn("git", args, {
        cwd: this.workspaceDir,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      gitProcess.stdout.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      gitProcess.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      gitProcess.on("close", (code: number) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Git command failed with code ${code}: ${stderr}`));
        }
      });

      gitProcess.on("error", (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * 获取提交信息
   */
  async getCommitInfo(sha: string): Promise<{
    message: string;
    author: string;
    date: string;
  }> {
    const message = await this.executeGitCommand([
      "log",
      "-1",
      "--pretty=format:%s",
      sha,
    ]);
    const author = await this.executeGitCommand([
      "log",
      "-1",
      "--pretty=format:%an",
      sha,
    ]);
    const date = await this.executeGitCommand([
      "log",
      "-1",
      "--pretty=format:%ci",
      sha,
    ]);

    return { message, author, date };
  }

  /**
   * 检查文件是否存在于指定提交中
   */
  async fileExistsInCommit(filePath: string, sha: string): Promise<boolean> {
    try {
      await this.executeGitCommand(["cat-file", "-e", `${sha}:${filePath}`]);
      return true;
    } catch {
      return false;
    }
  }
}
