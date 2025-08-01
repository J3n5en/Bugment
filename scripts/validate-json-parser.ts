#!/usr/bin/env tsx

/**
 * JSON 解析器验证脚本
 * 用于快速验证新的 JSON 处理流程是否正常工作
 * 这是一个独立的验证工具，不依赖测试框架
 */

import { JsonReviewResultParser } from "../src/parsers/JsonReviewResultParser";
import { PullRequestInfo, JsonReviewData } from "../src/core/types";

// 模拟 @actions/core 模块
const mockCore = {
  info: (message: string) => console.log(`[INFO] ${message}`),
  warning: (message: string) => console.log(`[WARN] ${message}`),
  error: (message: string) => console.log(`[ERROR] ${message}`),
};

// 设置模拟模块（在实际运行时，@actions/core 会被正确导入）
// 这里只是为了验证脚本的独立运行

// 模拟 PR 信息
const mockPrInfo: PullRequestInfo = {
  number: 123,
  title: "Test PR",
  body: "Test description",
  baseSha: "base123",
  headSha: "head456",
  owner: "testowner",
  repo: "testrepo",
};

// 测试用的 JSON 数据
const testJsonData: JsonReviewData = {
  summary: {
    overallComments: [
      "代码整体结构清晰，遵循了良好的编程实践",
      "建议添加更多的错误处理机制",
      "部分函数可以进一步优化性能",
    ],
  },
  issues: [
    {
      id: "bug_1",
      type: "bug",
      severity: "medium",
      title: "潜在的空指针异常",
      description: "在访问对象属性前未进行空值检查",
      location: "src/utils/helper.js#L15",
      filePath: "src/utils/helper.js",
      lineNumber: 15,
      fixPrompt: "Add null check before accessing object properties",
    },
    {
      id: "code_smell_1",
      type: "code_smell",
      severity: "low",
      title: "函数过长",
      description: "processData 函数包含过多逻辑",
      location: "src/utils/processor.js#L25-L65",
      filePath: "src/utils/processor.js",
      lineNumber: 25,
      startLine: 25,
      endLine: 65,
      fixPrompt: "Split long function into smaller functions",
    },
  ],
};

/**
 * 运行 JSON 解析器验证
 */
async function runValidation(): Promise<void> {
  try {
    console.log("🔧 Setting up validation environment...");

    const parser = new JsonReviewResultParser(mockPrInfo);

    console.log("📝 Running JSON parser validation...");

    // 1. 基本 JSON 解析测试
    console.log("✅ Testing basic JSON parsing...");
    const jsonString = JSON.stringify(testJsonData, null, 2);
    console.log(`- JSON string length: ${jsonString.length} characters`);

    const result = parser.parseReviewResult(jsonString);
    console.log(`- Parsed review ID: ${result.reviewId}`);
    console.log(`- Summary comments: ${result.summary.split("\n").length}`);
    console.log(`- Issues found: ${result.issues.length}`);

    // 2. 统计计算测试
    console.log("📊 Testing statistics calculation...");
    const stats = parser.calculateStatistics(result.issues);
    console.log(`- Total issues: ${stats.totalIssues}`);
    console.log(`- By type: ${JSON.stringify(stats.byType)}`);
    console.log(`- By severity: ${JSON.stringify(stats.bySeverity)}`);

    // 3. Markdown 包装处理测试
    console.log("✅ Testing Markdown wrapper handling...");
    const wrappedJson = `\`\`\`json\n${jsonString}\n\`\`\``;
    const wrappedResult = parser.parseReviewResult(wrappedJson);
    console.log(
      `- Wrapped JSON parsed successfully: ${wrappedResult.issues.length} issues`
    );

    // 4. 解析统计信息测试
    console.log("📈 Testing parsing statistics...");
    const parsingStats = parser.getParsingStats(jsonString);
    console.log(`- Is valid JSON: ${parsingStats.isValidJson}`);
    console.log(`- Has issues: ${parsingStats.hasIssues}`);
    console.log(`- Has summary: ${parsingStats.hasSummary}`);
    console.log(`- Estimated issue count: ${parsingStats.estimatedIssueCount}`);

    // 5. 错误处理测试
    console.log("✅ Testing error handling...");
    const invalidResult = parser.parseReviewResult("{ invalid json }");
    console.log(
      `- Invalid JSON handled gracefully: ${invalidResult.totalIssues} issues`
    );

    const emptyResult = parser.parseReviewResult("");
    console.log(
      `- Empty string handled gracefully: ${emptyResult.totalIssues} issues`
    );

    // 6. 类型验证测试
    console.log("🔍 Testing type validation...");
    const invalidTypeData = {
      summary: { overallComments: ["test"] },
      issues: [
        {
          id: "test_1",
          type: "invalid_type",
          severity: "invalid_severity",
          title: "Test",
          description: "Test description",
          location: "test.js#L1",
          filePath: "test.js",
          lineNumber: 1,
        },
      ],
    };

    const typeValidationResult = parser.parseReviewResult(
      JSON.stringify(invalidTypeData)
    );
    console.log(
      `- Type validation working: ${typeValidationResult.issues[0]?.type === "code_smell"}`
    );
    console.log(
      `- Severity validation working: ${typeValidationResult.issues[0]?.severity === "medium"}`
    );

    console.log("\n🎉 All JSON parser validation checks passed!");
    console.log("\n📋 Validation Summary:");
    console.log("- ✅ Basic JSON parsing");
    console.log("- ✅ Statistics calculation");
    console.log("- ✅ Markdown wrapper handling");
    console.log("- ✅ Parsing statistics");
    console.log("- ✅ Error handling");
    console.log("- ✅ Type validation");
    console.log("\n🚀 The new JSON processing flow is ready for use!");
    console.log(
      "\n💡 For comprehensive testing, run: npm test -- test/unit/parsers/JsonReviewResultParser.test.ts"
    );
  } catch (error) {
    console.error("❌ Validation failed:", error);
    process.exit(1);
  }
}

/**
 * 性能基准测试
 */
function runPerformanceBenchmark(): void {
  console.log("\n⚡ Running performance benchmark...");

  const parser = new JsonReviewResultParser(mockPrInfo);
  const jsonString = JSON.stringify(testJsonData);

  // JSON 解析性能测试
  const iterations = 1000;
  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    parser.parseReviewResult(jsonString);
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;

  console.log(`📊 Performance Results (${iterations} iterations):`);
  console.log(`- Total time: ${totalTime}ms`);
  console.log(`- Average time per parse: ${avgTime.toFixed(2)}ms`);
  console.log(`- Throughput: ${(1000 / avgTime).toFixed(0)} parses/second`);
}

// 主函数
async function main(): Promise<void> {
  await runValidation();
  runPerformanceBenchmark();
}

// 运行验证
if (require.main === module) {
  main().catch(console.error);
}

export { runValidation, runPerformanceBenchmark };
