import * as core from "@actions/core";
import { LocationInfo } from "../core/types";
import { FormatUtils } from "./FormatUtils";

/**
 * 位置工具类
 * 提供位置相关的工具函数
 */
export class LocationUtils {
  /**
   * 验证位置信息
   */
  static validateLocationInfo(locationInfo: LocationInfo): boolean {
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
  static formatLocationInfo(locationInfo: LocationInfo): string {
    if (!locationInfo.filePath) {
      return "";
    }

    let result = locationInfo.filePath;

    if (
      locationInfo.startLine &&
      locationInfo.endLine &&
      locationInfo.startLine !== locationInfo.endLine
    ) {
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
  static createGitHubUrl(
    locationInfo: LocationInfo,
    owner: string,
    repo: string,
    sha: string
  ): string {
    if (!locationInfo.filePath) {
      return "";
    }

    let url = `https://github.com/${owner}/${repo}/blob/${sha}/${locationInfo.filePath}`;

    if (
      locationInfo.startLine &&
      locationInfo.endLine &&
      locationInfo.startLine !== locationInfo.endLine
    ) {
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
  static isMultiLine(locationInfo: LocationInfo): boolean {
    return !!(
      locationInfo.startLine &&
      locationInfo.endLine &&
      locationInfo.startLine !== locationInfo.endLine
    );
  }

  /**
   * 获取行数范围
   */
  static getLineRange(
    locationInfo: LocationInfo
  ): { start: number; end: number } | null {
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
   * @deprecated 使用 FormatUtils.normalizePath 替代
   */
  static normalizeFilePath(filePath: string): string {
    return FormatUtils.normalizePath(filePath);
  }

  /**
   * 检查两个位置是否相同
   */
  static areLocationsEqual(loc1: LocationInfo, loc2: LocationInfo): boolean {
    const normalizedPath1 = loc1.filePath
      ? FormatUtils.normalizePath(loc1.filePath)
      : "";
    const normalizedPath2 = loc2.filePath
      ? FormatUtils.normalizePath(loc2.filePath)
      : "";

    return (
      normalizedPath1 === normalizedPath2 &&
      loc1.lineNumber === loc2.lineNumber &&
      loc1.startLine === loc2.startLine &&
      loc1.endLine === loc2.endLine
    );
  }

  /**
   * 从位置字符串创建 LocationInfo 对象
   * 这是一个简化版本，只处理基本格式
   */
  static createLocationInfo(
    filePath: string,
    lineNumber?: number,
    startLine?: number,
    endLine?: number
  ): LocationInfo {
    return {
      filePath: FormatUtils.normalizePath(filePath),
      lineNumber,
      startLine,
      endLine,
    };
  }

  /**
   * 检查位置是否在指定文件中
   */
  static isInFile(locationInfo: LocationInfo, filePath: string): boolean {
    if (!locationInfo.filePath) return false;

    const normalizedLocation = FormatUtils.normalizePath(locationInfo.filePath);
    const normalizedFile = FormatUtils.normalizePath(filePath);

    return normalizedLocation === normalizedFile;
  }

  /**
   * 检查位置是否在指定行范围内
   */
  static isInLineRange(
    locationInfo: LocationInfo,
    startLine: number,
    endLine: number
  ): boolean {
    const range = this.getLineRange(locationInfo);
    if (!range) return false;

    return range.start >= startLine && range.end <= endLine;
  }

  /**
   * 获取位置的简短描述
   */
  static getShortDescription(locationInfo: LocationInfo): string {
    if (!locationInfo.filePath) return "Unknown location";

    const fileName =
      locationInfo.filePath.split("/").pop() || locationInfo.filePath;

    if (
      locationInfo.startLine &&
      locationInfo.endLine &&
      locationInfo.startLine !== locationInfo.endLine
    ) {
      return `${fileName}:${locationInfo.startLine}-${locationInfo.endLine}`;
    } else if (locationInfo.lineNumber) {
      return `${fileName}:${locationInfo.lineNumber}`;
    } else if (locationInfo.startLine) {
      return `${fileName}:${locationInfo.startLine}`;
    }

    return fileName;
  }

  /**
   * 合并两个位置信息（取范围的并集）
   */
  static mergeLocations(
    loc1: LocationInfo,
    loc2: LocationInfo
  ): LocationInfo | null {
    // 只有在同一文件中才能合并
    if (
      !this.areLocationsEqual(
        { filePath: loc1.filePath },
        { filePath: loc2.filePath }
      )
    ) {
      return null;
    }

    const range1 = this.getLineRange(loc1);
    const range2 = this.getLineRange(loc2);

    if (!range1 || !range2) return null;

    const mergedStart = Math.min(range1.start, range2.start);
    const mergedEnd = Math.max(range1.end, range2.end);

    return this.createLocationInfo(
      loc1.filePath || "",
      mergedEnd,
      mergedStart,
      mergedEnd
    );
  }
}
