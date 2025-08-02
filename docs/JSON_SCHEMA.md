# JSON 数据结构设计

## 优化后的 LLM 输出 JSON 格式

### 完整示例

```json
{
  "reviewId": "pr123_abc12345_678901",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "commitSha": "abc123456789",
  "summary": {
    "overallComments": [
      "代码整体结构清晰，遵循了良好的编程实践",
      "建议添加更多的错误处理机制",
      "部分函数可以进一步优化性能"
    ]
  },
  "issues": [
    {
      "id": "bug_1",
      "type": "bug",
      "severity": "medium",
      "title": "潜在的空指针异常",
      "description": "在访问对象属性前未进行空值检查，可能导致运行时错误",
      "location": "src/utils/helper.js#L15",
      "filePath": "src/utils/helper.js",
      "lineNumber": 15,
      "startLine": 15,
      "endLine": 15,
      "fixPrompt": "Add null check before accessing object properties"
    },
    {
      "id": "code_smell_1",
      "type": "code_smell",
      "severity": "low",
      "title": "函数过长",
      "description": "processData 函数包含过多逻辑，建议拆分为更小的函数",
      "location": "src/utils/processor.js#L25-L65",
      "filePath": "src/utils/processor.js",
      "lineNumber": 25,
      "startLine": 25,
      "endLine": 65,
      "fixPrompt": "Split long function into smaller, single-responsibility functions"
    }
  ]
}
```

### 字段说明

#### 根级别字段

- `reviewId`: 审查唯一标识符
- `timestamp`: ISO 8601 格式的时间戳
- `commitSha`: Git 提交哈希
- `summary`: 审查摘要信息
- `issues`: 发现的问题数组

#### Summary 对象

- `overallComments`: 字符串数组，包含总体评价

#### Issue 对象

- `id`: 问题唯一标识符
- `type`: 问题类型 ("bug" | "code_smell" | "security" | "performance")
- `severity`: 严重程度 ("low" | "medium" | "high" | "critical")
- `title`: 问题标题
- `description`: 详细描述
- `location`: 位置字符串（用于显示）
- `filePath`: 文件路径
- `lineNumber`: 主要行号
- `startLine`: 起始行号（可选）
- `endLine`: 结束行号（可选）
- `fixPrompt`: AI 修复提示（英文）

### 优势

1. **性能提升**: 直接 JSON 解析，避免复杂的正则表达式
2. **类型安全**: 结构化数据便于类型检查
3. **易于处理**: 程序化处理更简单
4. **可扩展**: 容易添加新字段
5. **统计计算**: statistics 可以从 issues 数组动态计算

### 动态统计计算示例

```typescript
function calculateStatistics(issues: ReviewIssue[]) {
  const byType = issues.reduce(
    (acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const bySeverity = issues.reduce(
    (acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    totalIssues: issues.length,
    byType,
    bySeverity,
  };
}
```
