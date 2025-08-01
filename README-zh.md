# Bugment AI 代码审查 Action

[English](README.md) | [中文](README-zh.md)

[![GitHub release](https://img.shields.io/github/release/J3n5en/bugment.svg)](https://github.com/J3n5en/bugment/releases)
[![GitHub marketplace](https://img.shields.io/badge/marketplace-bugment--ai--code--review-blue?logo=github)](https://github.com/marketplace/actions/bugment-ai-code-review)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一个强大的 GitHub Action，使用 Augment AI 为 Pull Request 提供 AI 驱动的代码审查。获得智能、全面的代码分析，包含代码质量、安全性、性能和最佳实践的详细反馈。

## ✨ 特性

- 🤖 **AI 驱动分析**: 使用 Augment AI 技术进行深度代码分析
- 🔍 **全面检测**: 识别代码异味、潜在 Bug、安全问题和性能问题
- 📝 **自动评论**: 直接在 Pull Request 评论中发布详细的审查结果
- ⚡ **快速可靠**: 自动触发，具有强大的错误处理能力
- 🎯 **精确反馈**: 提供具体的文件位置和可操作的修复建议
- 🔄 **智能评论管理**: 自动替换之前的评论，避免重复
- 🚀 **高性能处理**: 优化的 JSON 数据流程，解析速度提升 10 倍

## 🚀 快速开始

### 1. 添加到您的工作流

在您的仓库中创建 `.github/workflows/code-review.yml`：

```yaml
name: AI 代码审查

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  code-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: AI 代码审查
        uses: J3n5en/bugment@main
        with:
          augment_access_token: ${{ secrets.AUGMENT_ACCESS_TOKEN }}
          augment_tenant_url: ${{ secrets.AUGMENT_TENANT_URL }}
```

### 2. 配置 Secrets

在您的仓库设置中添加以下 Secrets：

- `AUGMENT_ACCESS_TOKEN`: 您的 Augment 访问令牌
- `AUGMENT_TENANT_URL`: 您的 Augment 租户 URL

### 3. 获取 Augment 凭据

1. 登录您的 Augment 账户
2. 导航到 API 设置页面查找您的访问令牌
3. 复制您的租户 URL 和访问令牌
4. 在 GitHub 中将它们添加为仓库 secrets

## 📋 输入参数

| 参数                   | 描述             | 必需 | 默认值 |
| ---------------------- | ---------------- | ---- | ------ |
| `augment_access_token` | Augment 访问令牌 | ✅   | -      |
| `augment_tenant_url`   | Augment 租户 URL | ✅   | -      |

## 📤 输出

| 输出            | 描述                                       |
| --------------- | ------------------------------------------ |
| `review_result` | 生成的代码审查结果                         |
| `issues_found`  | 审查期间发现的问题数量                     |
| `review_status` | 审查状态：`success`、`failed` 或 `skipped` |

## 🎯 审查功能

Bugment 提供全面的 AI 驱动代码分析，包括：

- **整体评价**: 整体 PR 质量评估和改进建议
- **Code Smells**: 可维护性和可读性问题检测
- **潜在 Bug**: 功能错误和逻辑问题
- **安全问题**: 安全漏洞和风险识别
- **性能问题**: 性能优化机会

审查输出以中文提供，包含详细说明和可操作的修复建议。

## 📊 使用示例

### 基础设置

```yaml
name: AI 代码审查
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  code-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: AI 代码审查
        uses: J3n5en/bugment@main
        with:
          augment_access_token: ${{ secrets.AUGMENT_ACCESS_TOKEN }}
          augment_tenant_url: ${{ secrets.AUGMENT_TENANT_URL }}
```

完整的分步指南请参见 [examples/complete-example.md](examples/complete-example.md)。

## 🔧 故障排除

### 常见问题

#### 认证失败

- 验证您的 `AUGMENT_ACCESS_TOKEN` 和 `AUGMENT_TENANT_URL` 是否正确
- 确保 secrets 在您的仓库设置中正确设置
- 检查您的 Augment 账户是否具有必要的权限

#### 审查超时

- 大型 diff 可能需要更长时间处理
- 检查 Augment 服务状态

#### 没有发布评论

- 验证 `github_token` 具有 `pull-requests: write` 权限
- 检查工作流是否具有正确的权限块
- 确保 action 在工作流日志中成功完成

### 调试信息

通过在您的仓库中将 `ACTIONS_STEP_DEBUG` secret 设置为 `true` 来启用调试日志。

## 🎉 成功示例

以下是成功的 AI 代码审查评论示例：

```markdown
## 🤖 Bugment AI Code Review

# 整体评价

- 1️⃣ 代码整体结构清晰，遵循了良好的编程实践
- 2️⃣ 建议添加更多的错误处理机制
- 3️⃣ 部分函数可以进一步优化性能

# Code Smells

## 1. 函数过长

**严重程度**: 🟡 **中等**
**描述**: `processData` 函数包含过多逻辑，建议拆分为更小的函数
**位置**: `src/utils.js#L15-L45`
**AI修复Prompt**:
```

将长的 processData 函数拆分为更小的、单一职责的函数

```

# 潜在 Bug
无

# 安全问题
无

# 性能问题
无

---
*此审查由 Bugment AI Code Review Action 自动生成*
```

## 📝 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🤝 贡献

欢迎贡献！请随时提交 Pull Request。

## 📞 支持

- [GitHub Issues](https://github.com/J3n5en/bugment/issues)
- [GitHub Discussions](https://github.com/J3n5en/bugment/discussions)

---

_由 Bugment 团队用 ❤️ 制作_
