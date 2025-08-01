/**
 * Bugment 主模块导出
 * 提供所有公共 API 和类型定义
 */

// 主入口
export { BugmentAction, run } from "./action";

// 核心模块
export * from "./core";

// 服务模块 (排除冲突的 ReviewOptions)
export {
  GitHubService,
  GitService,
  AugmentService,
  ReviewService,
  AugmentIPCClient,
  performCodeReview,
  AugmentReviewOptions,
} from "./services";

// 解析器模块
export * from "./parsers";

// 格式化器模块
export * from "./formatters";

// 工具模块
export * from "./utils";

// 模板模块
export * from "./templates";
