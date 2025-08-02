# JSON 解析器调试指南

## 概述

为了排查 JSON 解析器的问题，我们在 `JsonReviewResultParser` 中添加了详细的调试输出功能。

## 调试信息说明

当 JSON 解析器运行时，会输出以下调试信息：

### 1. 原始 LLM 输出

```
📝 Raw LLM output (first 500 chars):
[LLM 输出的前 500 个字符]

📝 Raw LLM output (last 500 chars):
[LLM 输出的后 500 个字符]

📏 Total output length: [总字符数] characters
```

### 2. 清理后的内容

```
🧹 Cleaned result (first 500 chars):
[清理后内容的前 500 个字符]

🧹 Cleaned result (last 500 chars):
[清理后内容的后 500 个字符]

📏 Cleaned length: [清理后字符数] characters
```

### 3. 错误详情（如果解析失败）

```
❌ Failed to parse JSON review result: [错误信息]

🔍 JSON Syntax Error Details:
   Error message: [详细错误信息]
   Context around position [位置]:
   "[错误位置周围的内容]"
     ^
```

## 使用方法

1. **运行 Bugment**：正常运行 Bugment 进行代码审查
2. **查看日志**：在 GitHub Actions 日志中查找上述调试信息
3. **分析问题**：根据调试信息分析 LLM 输出格式问题

## 常见问题排查

### 问题 1：LLM 输出包含额外内容

**症状**：错误信息显示 "Unexpected non-whitespace character after JSON"
**解决**：检查 LLM 输出的后 500 字符，看是否在 JSON 后面有额外的文本

### 问题 2：LLM 输出仍然是 Markdown 格式

**症状**：原始输出显示 Markdown 格式而不是 JSON
**解决**：检查 prompt.md 模板是否正确更新，或者 LLM 是否需要更多时间适应新格式

### 问题 3：JSON 格式错误

**症状**：语法错误，如缺少引号、逗号等
**解决**：查看错误位置的上下文，检查 JSON 格式是否正确

## 问题解决方案

如果 JSON 解析器出现问题，可以：

1. 检查 LLM 输出格式是否正确
2. 查看调试信息定位具体问题
3. 根据错误信息调整 prompt 模板

## 调试信息示例

### 成功解析的示例

```
🔍 Starting to parse JSON review result...
📝 Raw LLM output (first 500 chars):
{
  "summary": {
    "overallComments": [
      "代码整体结构清晰，遵循了良好的编程实践"
    ]
  },
  "issues": [
    {
      "id": "bug_1",
      "type": "bug",
      "severity": "medium",
      "title": "潜在的空指针异常"
    }
  ]
}

✅ JSON parsing complete. Found 1 total issues
```

### 解析失败的示例

```
🔍 Starting to parse JSON review result...
📝 Raw LLM output (first 500 chars):
{
  "summary": {
    "overallComments": [
      "代码整体结构清晰"
    ]
  },
  "issues": []
}

这是一些额外的文本内容...

❌ Failed to parse JSON review result: SyntaxError: Unexpected non-whitespace character after JSON at position 123
🔍 JSON Syntax Error Details:
   Error message: Unexpected non-whitespace character after JSON at position 123
   Context around position 123:
   "}

这是一些额外的文本内容..."
     ^
```

## 移除调试信息

当问题解决后，可以移除调试输出以减少日志噪音。只需要删除 `JsonReviewResultParser.ts` 中的调试相关代码即可。

## 注意事项

- 调试信息会增加日志输出量，建议问题解决后及时移除
- 敏感信息可能会出现在调试输出中，注意保护隐私
- 调试信息有助于快速定位问题，但不应在生产环境长期保留
