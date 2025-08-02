/**
 * JSON 解析器测试
 * 验证新的 JSON 处理流程是否正常工作
 */

import { JsonReviewResultParser } from "../../../src/parsers/JsonReviewResultParser";
import { PullRequestInfo } from "../../../src/core/types";

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
const testJsonData = {
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
      description: "在访问对象属性前未进行空值检查，可能导致运行时错误",
      location: "src/utils/helper.js#L15",
      filePath: "src/utils/helper.js",
      startLine: 15,
      endLine: 15,
      fixPrompt: "Add null check before accessing object properties",
    },
    {
      id: "code_smell_1",
      type: "code_smell",
      severity: "low",
      title: "函数过长",
      description: "processData 函数包含过多逻辑，建议拆分为更小的函数",
      location: "src/utils/processor.js#L25-L65",
      filePath: "src/utils/processor.js",
      startLine: 25,
      endLine: 65,
      fixPrompt:
        "Split long function into smaller, single-responsibility functions",
    },
    {
      id: "security_1",
      type: "security",
      severity: "high",
      title: "SQL 注入风险",
      description: "直接拼接 SQL 查询字符串，存在 SQL 注入风险",
      location: "src/database/query.js#L42",
      filePath: "src/database/query.js",
      startLine: 42,
      fixPrompt: "Use parameterized queries to prevent SQL injection",
    },
  ],
};

describe("JsonReviewResultParser", () => {
  let parser: JsonReviewResultParser;

  beforeEach(() => {
    parser = new JsonReviewResultParser(mockPrInfo);
  });

  describe("parseReviewResult", () => {
    it("should parse valid JSON correctly", () => {
      const jsonString = JSON.stringify(testJsonData);
      const result = parser.parseReviewResult(jsonString);

      expect(result.reviewId).toMatch(/^pr123_head456_\d{6}$/);
      expect(result.commitSha).toBe(mockPrInfo.headSha);
      expect(result.totalIssues).toBe(3);
      expect(result.issues).toHaveLength(3);
      expect(result.summary).toContain("代码整体结构清晰");
    });

    it("should handle Markdown-wrapped JSON", () => {
      const wrappedJson = `\`\`\`json\n${JSON.stringify(testJsonData, null, 2)}\n\`\`\``;
      const result = parser.parseReviewResult(wrappedJson);

      expect(result.totalIssues).toBe(3);
      expect(result.issues).toHaveLength(3);
    });

    it("should handle invalid JSON gracefully", () => {
      const invalidJson = "{ invalid json }";
      const result = parser.parseReviewResult(invalidJson);

      expect(result.totalIssues).toBe(0);
      expect(result.issues).toHaveLength(0);
      expect(result.summary).toBe("解析审查结果时发生错误");
    });

    it("should handle empty string", () => {
      const result = parser.parseReviewResult("");

      expect(result.totalIssues).toBe(0);
      expect(result.issues).toHaveLength(0);
    });

    it("should validate issue types and severities", () => {
      const invalidData = {
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
            startLine: 1,
          },
        ],
      };

      const result = parser.parseReviewResult(JSON.stringify(invalidData));

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.type).toBe("code_smell"); // 默认值
      expect(result.issues[0]?.severity).toBe("medium"); // 默认值
    });
  });

  describe("getParsingStats", () => {
    it("should return correct stats for valid JSON", () => {
      const jsonString = JSON.stringify(testJsonData);
      const stats = parser.getParsingStats(jsonString);

      expect(stats.isValidJson).toBe(true);
      expect(stats.hasIssues).toBe(true);
      expect(stats.hasSummary).toBe(true);
      expect(stats.estimatedIssueCount).toBe(3);
    });

    it("should return correct stats for invalid JSON", () => {
      const stats = parser.getParsingStats("invalid json");

      expect(stats.isValidJson).toBe(false);
      expect(stats.hasIssues).toBe(false);
      expect(stats.hasSummary).toBe(false);
      expect(stats.estimatedIssueCount).toBe(0);
    });
  });

  describe("calculateStatistics", () => {
    it("should calculate issue statistics correctly", () => {
      const jsonString = JSON.stringify(testJsonData);
      const result = parser.parseReviewResult(jsonString);
      const stats = parser.calculateStatistics(result.issues);

      expect(stats.totalIssues).toBe(3);
      expect(stats.byType).toEqual({
        bug: 1,
        code_smell: 1,
        security: 1,
      });
      expect(stats.bySeverity).toEqual({
        medium: 1,
        low: 1,
        high: 1,
      });
    });

    it("should handle empty issues array", () => {
      const stats = parser.calculateStatistics([]);

      expect(stats.totalIssues).toBe(0);
      expect(stats.byType).toEqual({});
      expect(stats.bySeverity).toEqual({});
    });
  });

  describe("JSON cleaning with extra content", () => {
    it("should handle JSON with trailing content", () => {
      const jsonWithTrailing = `
---
head xxxx
----
\`\`\`json
{
  "summary": {
    "overallComments": ["Test comment"]
  },
  "issues": [
    {
      "id": "test_1",
      "type": "bug",
      "severity": "medium",
      "title": "Test Issue",
      "description": "Test description",
      "location": "test.js#L1",
      "filePath": "test.js",
      "startLine": 1
    }
  ]
}
\`\`\`
---
*Your access expires in 2 days.*`;

      const result = parser.parseReviewResult(jsonWithTrailing);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.title).toBe("Test Issue");
      expect(result.summary).toContain("Test comment");
    });

    it("should handle JSON with markdown wrapper and trailing content", () => {
      const jsonWithWrapper = `\`\`\`json
{
  "summary": {
    "overallComments": ["Wrapped test"]
  },
  "issues": []
}
\`\`\`

Additional text that should be ignored.`;

      const result = parser.parseReviewResult(jsonWithWrapper);

      expect(result.issues).toHaveLength(0);
      expect(result.summary).toContain("Wrapped test");
    });
  });
});
