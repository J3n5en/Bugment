# Bugment AI 代码审查 - 完整使用示例

这是一个完整的 Bugment AI Code Review GitHub Action 使用示例，展示如何在您的项目中集成 AI 代码审查功能。

## 📋 前置要求

1. **Augment 账户**: 您需要有一个 Augment 账户并获取访问凭据
2. **GitHub 仓库**: 启用了 GitHub Actions 的仓库
3. **权限设置**: 确保 Actions 有读取代码和写入评论的权限

## 🔧 步骤 1: 获取 Augment 凭据

1. 登录您的 Augment 账户
2. 导航到 API 设置页面
3. 获取以下信息：
   - **Access Token**: 您的访问令牌
   - **Tenant URL**: 您的租户 URL（例如：`https://your-company.augment.com`）

## 🔐 步骤 2: 配置 GitHub Secrets

在您的 GitHub 仓库中设置以下 Secrets：

1. 进入仓库 → `Settings` → `Secrets and variables` → `Actions`
2. 点击 `New repository secret`
3. 添加以下 secrets：

| Secret 名称            | 值                    | 说明                  |
| ---------------------- | --------------------- | --------------------- |
| `AUGMENT_ACCESS_TOKEN` | 您的 Augment 访问令牌 | 用于 Augment API 认证 |
| `AUGMENT_TENANT_URL`   | 您的 Augment 租户 URL | Augment 服务地址      |

## 📝 步骤 3: 创建工作流文件

在您的仓库中创建 `.github/workflows/ai-code-review.yml` 文件：

```yaml
name: AI 代码审查

# 触发条件：PR 创建、更新或重新打开时
on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ai-code-review:
    name: AI 代码审查
    runs-on: ubuntu-latest

    # 设置必要的权限
    permissions:
      contents: read # 读取代码
      pull-requests: write # 写入 PR 评论

    steps:
      # 运行 AI 代码审查（Action 会自动检出代码）
      - name: 运行 AI 代码审查
        uses: J3n5en/bugment@main
        with:
          # 必需参数：Augment 认证信息
          augment_access_token: ${{ secrets.AUGMENT_ACCESS_TOKEN }}
          augment_tenant_url: ${{ secrets.AUGMENT_TENANT_URL }}
```

## 🎯 步骤 4: 测试设置

1. **创建测试 PR**: 在您的仓库中创建一个新的 Pull Request
2. **查看 Actions**: 进入 `Actions` 标签页，查看工作流是否正常运行
3. **检查评论**: 工作流完成后，在 PR 中查看 AI 生成的代码审查评论

## 📊 预期结果

当 PR 创建或更新时，您将看到：

1. **GitHub Actions 运行**: 在 Actions 页面看到 "AI 代码审查" 工作流运行
2. **自动评论**: 在 PR 中看到 Bugment 发布的详细代码审查评论，包括：
   - 📝 **整体评价**: PR 的总体质量评估
   - 🔍 **Code Smells**: 代码可维护性和可读性问题
   - 🐛 **潜在 Bug**: 可能导致功能错误的代码
   - 🔒 **安全问题**: 安全漏洞和风险点
   - ⚡ **性能问题**: 性能优化建议

## 🔄 工作流程说明

1. **触发**: 当 PR 被创建、更新或重新打开时自动触发
2. **检出代码**: Action 自动检出用户的代码到工作区
3. **生成差异**: 智能生成 PR 的代码差异文件
4. **认证**: 使用您提供的 Augment 凭据进行身份验证
5. **分析**: 将代码差异发送给 Augment AI 进行分析
6. **评论**: 将 AI 生成的审查结果作为评论发布到 PR 中
7. **更新**: 如果 PR 再次更新，会替换之前的评论（避免重复）

## 🛠️ 故障排除

### 常见问题

**问题 1: 认证失败**

```
Error: Authentication failed
```

**解决方案**: 检查 `AUGMENT_ACCESS_TOKEN` 和 `AUGMENT_TENANT_URL` 是否正确设置

**问题 2: 权限不足**

```
Error: Resource not accessible by integration
```

**解决方案**: 确保工作流文件中包含了正确的权限设置：

```yaml
permissions:
  contents: read
  pull-requests: write
```

**问题 3: 没有评论出现**

```
工作流运行成功但没有评论
```

**解决方案**:

- 检查 PR 是否有代码变更
- 确认 `github_token` 有写入权限
- 查看 Actions 日志获取详细错误信息

**问题 4: 工作目录错误**

```
分析的是错误的代码
```

**解决方案**:

- Action 会自动检出用户代码，无需手动 checkout
- 检查 `GITHUB_WORKSPACE` 环境变量是否正确

### 调试技巧

1. **启用调试日志**: 在仓库 Secrets 中添加 `ACTIONS_STEP_DEBUG` = `true`
2. **查看详细日志**: 在 Actions 运行页面查看每个步骤的详细输出
3. **测试连接**: 确保 Augment 服务可以正常访问

## 🎉 成功示例

以下是一个成功的 AI 代码审查评论示例：

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
**位置**:

<details>
<summary><code>src/utils.js#L15-L45</code></summary>

https://github.com/owner/repo/blob/commit_sha/src/utils.js#L15-L45

</details>

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

## 📚 更多资源

- [Bugment GitHub Repository](https://github.com/J3n5en/bugment)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Augment 官方文档](https://augment.com/docs)

## 💡 最佳实践

1. **定期更新**: 保持 Action 版本为最新
2. **权限最小化**: 只授予必要的权限
3. **监控使用**: 定期检查 Actions 使用情况
4. **团队培训**: 确保团队了解如何解读 AI 审查结果

---

现在您已经成功设置了 Bugment AI Code Review！每次创建或更新 PR 时，都会自动获得专业的 AI 代码审查反馈。
