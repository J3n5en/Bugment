/**
 * 单元测试套件入口
 * 导入所有单元测试模块
 */

// 核心模块测试
import "./core/ReviewWorkflow.test";
import "./core/ReviewComparison.test";

// 服务模块测试
import "./services/GitService.test";

// 解析器模块测试
import "./parsers/DiffParser.test";
import "./parsers/DiffValidation.test";

// 格式化器模块测试
import "./formatters/CommentFormatter.test";

// 工具模块测试
import "./utils/ValidationUtils.test";

describe("Bugment Unit Tests", () => {
  test("should load all test modules", () => {
    // This test ensures all test modules are properly imported
    expect(true).toBe(true);
  });
});
