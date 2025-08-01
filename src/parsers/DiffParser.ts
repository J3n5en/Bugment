import * as core from "@actions/core";
import { DiffHunk, ParsedDiff } from "../core/types";
import { IgnoreManager } from "../ignore-manager";

/**
 * Diff 解析器类
 * 负责解析 Git diff 内容
 */
export class DiffParser {
  private ignoreManager?: IgnoreManager;

  constructor(ignoreManager?: IgnoreManager) {
    this.ignoreManager = ignoreManager;
  }

  /**
   * 解析 diff 内容
   */
  parseDiffContent(diffContent: string): ParsedDiff {
    const files = new Map<string, DiffHunk[]>();
    const lines = diffContent.split("\n");

    let currentFile = "";
    let currentHunk: DiffHunk | null = null;
    let isIgnoringFile = false;
    let i = 0;

    core.info(`📄 Parsing diff content with ${lines.length} lines`);

    while (i < lines.length) {
      const line = lines[i];

      if (!line) {
        i++;
        continue;
      }

      // 文件头: diff --git a/file b/file
      if (line.startsWith("diff --git")) {
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        if (match && match[2]) {
          const filePath = match[2]; // 使用新文件路径

          // 检查文件是否应该被忽略
          if (this.ignoreManager && this.ignoreManager.shouldIgnore(filePath)) {
            // 标记此文件为忽略并跳过所有内容
            isIgnoringFile = true;
            currentFile = "";
            currentHunk = null;
            i++;
            continue;
          }

          // 文件未被忽略
          isIgnoringFile = false;
          currentFile = filePath;
          currentHunk = null;

          core.info(`📁 Found file in diff: ${currentFile}`);
          if (!files.has(currentFile)) {
            files.set(currentFile, []);
          }
        } else {
          core.warning(`⚠️ Failed to parse git diff header: ${line}`);
        }
      }
      // Hunk 头: @@ -oldStart,oldLines +newStart,newLines @@
      else if (line.startsWith("@@")) {
        // 跳过被忽略文件的 hunk 头
        if (isIgnoringFile) {
          i++;
          continue;
        }

        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match && currentFile && match[1] && match[3]) {
          const oldStart = parseInt(match[1], 10);
          const oldLines = match[2] ? parseInt(match[2], 10) : 1;
          const newStart = parseInt(match[3], 10);
          const newLines = match[4] ? parseInt(match[4], 10) : 1;

          currentHunk = {
            filePath: currentFile,
            oldStart,
            oldLines,
            newStart,
            newLines,
            lines: [],
          };

          core.info(
            `📊 Found hunk for ${currentFile}: lines ${newStart}-${newStart + newLines - 1}`
          );
          files.get(currentFile)!.push(currentHunk);
        } else {
          core.warning(`⚠️ Failed to parse hunk header: ${line}`);
        }
      }
      // 内容行
      else if (
        !isIgnoringFile && // 跳过被忽略文件的内容行
        currentHunk &&
        currentFile &&
        (line.startsWith("+") || line.startsWith("-") || line.startsWith(" "))
      ) {
        currentHunk.lines.push(line);
      }

      i++;
    }

    // 记录解析摘要
    const fileCount = files.size;
    const totalHunks = Array.from(files.values()).reduce(
      (sum, hunks) => sum + hunks.length,
      0
    );
    core.info(
      `📊 Diff parsing complete: ${fileCount} files, ${totalHunks} hunks (after applying ignore filters)`
    );

    // 记录每个文件及其 hunks 用于调试
    for (const [filePath, hunks] of files.entries()) {
      core.info(`📁 File: ${filePath} has ${hunks.length} hunks`);
      hunks.forEach((hunk, index) => {
        core.info(
          `  📊 Hunk ${index + 1}: lines ${hunk.newStart}-${hunk.newStart + hunk.newLines - 1} (${hunk.lines.length} diff lines)`
        );
      });
    }

    return { files };
  }

  /**
   * 检查行是否在 diff 范围内
   */
  isLineInDiff(filePath: string, lineNumber: number, parsedDiff: ParsedDiff): boolean {
    core.info(
      `🔍 Checking line ${filePath}:${lineNumber} - validation enabled for PR commit range`
    );

    if (!parsedDiff || !filePath || !lineNumber) {
      core.info(`❌ Missing diff data or invalid parameters`);
      return false;
    }

    // 调试：记录解析的 diff 中所有可用文件
    const availableFiles = Array.from(parsedDiff.files.keys());
    core.info(`📁 Available files in diff: ${availableFiles.join(", ")}`);

    // 首先尝试精确匹配
    let hunks = parsedDiff.files.get(filePath);

    // 如果精确匹配失败，尝试查找具有不同路径格式的匹配文件
    if (!hunks || hunks.length === 0) {
      core.info(`❌ No exact match for file: ${filePath}`);

      // 尝试查找以相同路径结尾的文件
      const normalizedPath = filePath.replace(/^\/+/, ""); // 移除前导斜杠
      const matchingFile = availableFiles.find((file) => {
        const normalizedFile = file.replace(/^\/+/, "");
        return (
          normalizedFile === normalizedPath ||
          file.endsWith("/" + normalizedPath) ||
          normalizedFile.endsWith("/" + filePath) ||
          file === normalizedPath
        );
      });

      if (matchingFile) {
        core.info(`✅ Found matching file: ${matchingFile} for ${filePath}`);
        hunks = parsedDiff.files.get(matchingFile);
      } else {
        core.info(`❌ No matching file found for: ${filePath}`);
        core.info(`📝 Tried to match against: ${availableFiles.join(", ")}`);
        return false;
      }
    }

    if (!hunks || hunks.length === 0) {
      core.info(`❌ No hunks found for file: ${filePath}`);
      return false;
    }

    core.info(`📊 Found ${hunks.length} hunks for file: ${filePath}`);

    // 检查行号是否在任何 hunk 的新行范围内
    for (const hunk of hunks) {
      const hunkEndLine = hunk.newStart + hunk.newLines - 1;
      core.info(
        `🔍 Checking hunk range: ${hunk.newStart}-${hunkEndLine} for line ${lineNumber}`
      );

      if (lineNumber >= hunk.newStart && lineNumber <= hunkEndLine) {
        // 对于 PR 审查，我们希望允许在 diff 范围内的任何行上进行评论
        // 这包括添加的行 (+)、删除的行 (-) 和上下文行 ( )
        let currentNewLine = hunk.newStart;
        for (const hunkLine of hunk.lines) {
          if (hunkLine.startsWith("+") || hunkLine.startsWith(" ")) {
            if (currentNewLine === lineNumber) {
              core.info(`✅ Line ${lineNumber} found in diff range`);
              return true; // 允许在 PR diff 中的任何行上进行评论
            }
            currentNewLine++;
          }
        }
      }
    }

    core.info(
      `❌ Line ${lineNumber} not found in any diff hunk for ${filePath}`
    );
    return false;
  }

  /**
   * 获取 diff 统计信息
   */
  getDiffStats(parsedDiff: ParsedDiff): {
    fileCount: number;
    totalHunks: number;
    addedLines: number;
    removedLines: number;
    modifiedFiles: string[];
  } {
    const fileCount = parsedDiff.files.size;
    let totalHunks = 0;
    let addedLines = 0;
    let removedLines = 0;
    const modifiedFiles: string[] = [];

    for (const [filePath, hunks] of parsedDiff.files.entries()) {
      totalHunks += hunks.length;
      modifiedFiles.push(filePath);

      for (const hunk of hunks) {
        for (const line of hunk.lines) {
          if (line.startsWith("+")) {
            addedLines++;
          } else if (line.startsWith("-")) {
            removedLines++;
          }
        }
      }
    }

    return {
      fileCount,
      totalHunks,
      addedLines,
      removedLines,
      modifiedFiles,
    };
  }

  /**
   * 验证 diff 内容
   */
  validateDiffContent(diffContent: string): boolean {
    if (!diffContent || diffContent.trim().length === 0) {
      core.warning("Diff content is empty");
      return false;
    }

    // 检查是否包含基本的 diff 标记
    const hasDiffHeader = diffContent.includes("diff --git");
    const hasHunkHeader = diffContent.includes("@@");

    if (!hasDiffHeader) {
      core.warning("Diff content does not contain git diff headers");
      return false;
    }

    if (!hasHunkHeader) {
      core.warning("Diff content does not contain hunk headers");
      return false;
    }

    core.info("✅ Diff content validation passed");
    return true;
  }
}
