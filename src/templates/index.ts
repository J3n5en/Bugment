/**
 * 模板模块导出
 * 包含审查提示模板和其他模板文件
 */

import * as fs from "fs";
import * as path from "path";

/**
 * 获取审查提示模板
 */
export function getReviewPromptTemplate(): string {
  const promptPath = path.join(__dirname, "prompt.md");
  return fs.readFileSync(promptPath, "utf-8");
}

/**
 * 模板文件路径
 */
export const TEMPLATE_PATHS = {
  REVIEW_PROMPT: path.join(__dirname, "prompt.md"),
} as const;
