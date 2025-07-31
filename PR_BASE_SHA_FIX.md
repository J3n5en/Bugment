# PR Base SHA 修复说明

## 问题描述

在GitHub Actions的PR事件中，`github.event.pull_request.base.sha` 并不是当前base分支的最新commit，而是**PR创建时**base分支的commit SHA。这导致：

1. **Diff范围不正确**：无法获取PR的完整变更范围
2. **Line comments错误**：基于错误的diff范围创建的line comments会失败
3. **审查不完整**：可能遗漏PR中的某些变更

## 具体案例

以PR #67为例：
- 日志显示对比范围：`a980ac456f61b24adf07d4a7efb4e1392384480b...b5de893696d1a112cd9ef1630bce42c6bc9ce0c6`
- `a980ac456f61b24adf07d4a7efb4e1392384480b` 是PR创建时的base SHA
- 但GitHub Actions实际运行在merge commit上，该commit基于**当前**base分支的最新commit

## 解决方案

### 1. 获取实际的Base SHA

使用git命令获取merge commit的第一个parent：
```bash
git rev-parse ${GITHUB_SHA}^1
```

这个命令返回的是用于构建merge commit的实际base分支SHA。

### 2. 代码实现

```typescript
private async getActualBaseSha(workspaceDir: string): Promise<string> {
  // For PR events, github.sha is the merge commit
  // We need to get the first parent (base branch SHA) of this merge commit
  return new Promise((resolve, reject) => {
    const gitProcess = spawn(
      "git",
      ["rev-parse", `${process.env.GITHUB_SHA}^1`],
      {
        cwd: workspaceDir,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );
    // ... 处理结果
  });
}
```

### 3. 使用正确的Base SHA生成Diff

```typescript
// 获取正确的base SHA
const actualBaseSha = await this.getActualBaseSha(workspaceDir);

// 使用正确的base SHA生成diff
const diffContent = await this.generateLocalDiffWithCorrectBase(workspaceDir, actualBaseSha);
```

## 效果

### 修复前
- 使用PR创建时的base SHA
- Diff范围可能不包含完整的PR变更
- Line comments可能失败

### 修复后
- 使用merge commit的实际base SHA
- Diff范围包含PR的完整变更
- Line comments基于正确的diff范围创建
- 审查覆盖PR的所有commits

## 日志输出

修复后的日志会显示：
```
📝 Original base SHA: a980ac456f61b24adf07d4a7efb4e1392384480b (PR creation time)
📝 Actual base SHA: bdd12cacd1acacce2b37138b01d8167da53bb0fb (merge commit base)
🔍 Comparing bdd12cacd1acacce2b37138b01d8167da53bb0fb...b5de893696d1a112cd9ef1630bce42c6bc9ce0c6
```

## 容错处理

如果git命令失败，会自动回退到原始的base SHA：
```typescript
gitProcess.on("close", (code: number) => {
  if (code === 0) {
    const actualBaseSha = stdout.trim();
    resolve(actualBaseSha);
  } else {
    core.warning(`Failed to get actual base SHA: ${stderr}`);
    // Fallback to original base SHA
    resolve(this.prInfo.baseSha);
  }
});
```

## 参考资料

- [The Many SHAs of a GitHub Pull Request](https://www.kenmuse.com/blog/the-many-shas-of-a-github-pull-request/)
- [GitHub Community Discussion #59677](https://github.com/orgs/community/discussions/59677)
- [GitHub Actions Context Reference](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts)

这个修复确保了PR代码审查能够覆盖完整的PR变更范围，包含PR中的所有commits。
