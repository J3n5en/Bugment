import * as core from "@actions/core";
import { LocationInfo } from "../core/types";

/**
 * 位置解析器类
 * 负责解析代码位置信息
 */
export class LocationParser {

  /**
   * 解析位置信息
   */
  parseLocationInfo(location: string): LocationInfo {
    core.info(`🔍 Parsing location info: "${location}"`);

    // 解析格式如：
    // "src/components/Button.tsx:45"
    // "src/utils/helper.js:12-18"
    // "README.md#L25-L30"
    // "https://github.com/owner/repo/blob/sha/src/index.ts#L129-L133"
    // "[index.ts:16" (需要处理的格式错误)

    // 处理带有前导括号的格式错误
    let cleanLocation = location.trim();
    if (cleanLocation.startsWith("[")) {
      cleanLocation = cleanLocation.substring(1);
      core.info(`🔧 Cleaned malformed location: "${cleanLocation}"`);
    }

    // 处理用逗号分隔的多个位置 - 使用更新的提示时不应该发生这种情况
    if (cleanLocation.includes(",")) {
      const firstLocation = cleanLocation.split(",")[0]?.trim();
      if (firstLocation) {
        core.warning(
          `⚠️ Multiple locations found (this should not happen with updated prompt), using first: "${firstLocation}"`
        );
        cleanLocation = firstLocation;
      }
    }

    // 解析 GitHub URL 格式: https://github.com/owner/repo/blob/sha/path/to/file.ext#L123-L456
    const githubUrlMatch = cleanLocation.match(
      /^https:\/\/github\.com\/[^\/]+\/[^\/]+\/blob\/[^\/]+\/(.+?)#L(\d+)(?:-L(\d+))?$/
    );

    if (githubUrlMatch) {
      const [, filePath, startLineStr, endLineStr] = githubUrlMatch;
      if (filePath && startLineStr) {
        const startLine = parseInt(startLineStr, 10);
        const endLine = endLineStr ? parseInt(endLineStr, 10) : undefined;

        const result = {
          filePath: filePath.trim(),
          lineNumber: endLine || startLine,
          startLine,
          endLine,
        };

        core.info(`✅ Parsed GitHub URL format: ${JSON.stringify(result)}`);
        return result;
      }
    }

    // 解析简单的 file:line 格式
    const fileLineMatch = cleanLocation.match(/^([^:]+):(\d+)(?:-(\d+))?/);
    if (fileLineMatch) {
      const [, filePath, startLineStr, endLineStr] = fileLineMatch;
      if (filePath && startLineStr) {
        const startLine = parseInt(startLineStr, 10);
        const endLine = endLineStr ? parseInt(endLineStr, 10) : undefined;

        const result = {
          filePath: filePath.trim(),
          lineNumber: endLine || startLine, // 如果有结束行则使用结束行，否则使用开始行
          startLine,
          endLine,
        };

        core.info(`✅ Parsed file:line format: ${JSON.stringify(result)}`);
        return result;
      }
    }

    // 解析 GitHub 样式格式: file#L123-L456
    const githubLineMatch = cleanLocation.match(/^([^#]+)#L(\d+)(?:-L(\d+))?/);
    if (githubLineMatch) {
      const [, filePath, startLineStr, endLineStr] = githubLineMatch;
      if (filePath && startLineStr) {
        const startLine = parseInt(startLineStr, 10);
        const endLine = endLineStr ? parseInt(endLineStr, 10) : undefined;

        const result = {
          filePath: filePath.trim(),
          lineNumber: endLine || startLine,
          startLine,
          endLine,
        };

        core.info(`✅ Parsed GitHub format: ${JSON.stringify(result)}`);
        return result;
      }
    }

    core.warning(`⚠️ Failed to parse location: "${location}"`);
    return {};
  }

  /**
   * 验证位置信息
   */
  validateLocationInfo(locationInfo: LocationInfo): boolean {
    if (!locationInfo.filePath) {
      core.warning("Location info missing file path");
      return false;
    }

    if (locationInfo.lineNumber && locationInfo.lineNumber <= 0) {
      core.warning("Invalid line number in location info");
      return false;
    }

    if (locationInfo.startLine && locationInfo.startLine <= 0) {
      core.warning("Invalid start line in location info");
      return false;
    }

    if (locationInfo.endLine && locationInfo.endLine <= 0) {
      core.warning("Invalid end line in location info");
      return false;
    }

    if (
      locationInfo.startLine &&
      locationInfo.endLine &&
      locationInfo.startLine > locationInfo.endLine
    ) {
      core.warning("Start line is greater than end line");
      return false;
    }

    return true;
  }

  /**
   * 格式化位置信息为字符串
   */
  formatLocationInfo(locationInfo: LocationInfo): string {
    if (!locationInfo.filePath) {
      return "";
    }

    let result = locationInfo.filePath;

    if (locationInfo.startLine && locationInfo.endLine && locationInfo.startLine !== locationInfo.endLine) {
      result += `#L${locationInfo.startLine}-L${locationInfo.endLine}`;
    } else if (locationInfo.lineNumber) {
      result += `#L${locationInfo.lineNumber}`;
    } else if (locationInfo.startLine) {
      result += `#L${locationInfo.startLine}`;
    }

    return result;
  }

  /**
   * 创建 GitHub URL 格式的位置
   */
  createGitHubUrl(
    locationInfo: LocationInfo,
    owner: string,
    repo: string,
    sha: string
  ): string {
    if (!locationInfo.filePath) {
      return "";
    }

    let url = `https://github.com/${owner}/${repo}/blob/${sha}/${locationInfo.filePath}`;

    if (locationInfo.startLine && locationInfo.endLine && locationInfo.startLine !== locationInfo.endLine) {
      url += `#L${locationInfo.startLine}-L${locationInfo.endLine}`;
    } else if (locationInfo.lineNumber) {
      url += `#L${locationInfo.lineNumber}`;
    } else if (locationInfo.startLine) {
      url += `#L${locationInfo.startLine}`;
    }

    return url;
  }

  /**
   * 检查位置是否为多行
   */
  isMultiLine(locationInfo: LocationInfo): boolean {
    return !!(
      locationInfo.startLine &&
      locationInfo.endLine &&
      locationInfo.startLine !== locationInfo.endLine
    );
  }

  /**
   * 获取行数范围
   */
  getLineRange(locationInfo: LocationInfo): { start: number; end: number } | null {
    if (locationInfo.startLine && locationInfo.endLine) {
      return {
        start: locationInfo.startLine,
        end: locationInfo.endLine,
      };
    }

    if (locationInfo.lineNumber) {
      return {
        start: locationInfo.lineNumber,
        end: locationInfo.lineNumber,
      };
    }

    if (locationInfo.startLine) {
      return {
        start: locationInfo.startLine,
        end: locationInfo.startLine,
      };
    }

    return null;
  }

  /**
   * 规范化文件路径
   */
  normalizeFilePath(filePath: string): string {
    // 移除前导斜杠
    let normalized = filePath.replace(/^\/+/, "");
    
    // 规范化路径分隔符
    normalized = normalized.replace(/\\/g, "/");
    
    // 移除多余的斜杠
    normalized = normalized.replace(/\/+/g, "/");
    
    return normalized;
  }

  /**
   * 检查两个位置是否相同
   */
  areLocationsEqual(loc1: LocationInfo, loc2: LocationInfo): boolean {
    const normalizedPath1 = loc1.filePath ? this.normalizeFilePath(loc1.filePath) : "";
    const normalizedPath2 = loc2.filePath ? this.normalizeFilePath(loc2.filePath) : "";

    return (
      normalizedPath1 === normalizedPath2 &&
      loc1.lineNumber === loc2.lineNumber &&
      loc1.startLine === loc2.startLine &&
      loc1.endLine === loc2.endLine
    );
  }
}
