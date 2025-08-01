# Bugment 测试指南

## 📋 测试概述

Bugment 项目采用分层测试策略，包含单元测试、集成测试和端到端测试，确保代码质量和功能正确性。

## 🏗️ 测试架构

```
test/
├── unit/                    # 单元测试
│   ├── core/               # 核心模块测试
│   ├── services/           # 服务模块测试
│   ├── parsers/            # 解析器模块测试
│   ├── formatters/         # 格式化器模块测试
│   ├── utils/              # 工具模块测试
│   └── index.test.ts       # 测试套件入口
├── integration/            # 集成测试
│   └── BugmentAction.integration.test.ts
├── setup.ts               # 测试环境设置
└── run-tests.sh          # 测试运行脚本
```

## 🧪 测试类型

### 1. 单元测试 (Unit Tests)

测试单个模块或函数的功能，确保每个组件独立工作正常。

**覆盖的模块：**
- ✅ `BugmentCore` - 核心业务逻辑
- ✅ `ReviewWorkflow` - 审查工作流
- ✅ `DiffParser` - Diff 解析器
- ✅ `ValidationUtils` - 验证工具
- ✅ `CommentFormatter` - 评论格式化器

**运行单元测试：**
```bash
npm test -- --testPathPattern="test/unit"
```

### 2. 集成测试 (Integration Tests)

测试多个模块之间的交互，确保整个系统协同工作。

**覆盖的场景：**
- ✅ `BugmentAction` 完整工作流
- ✅ 模块间依赖关系
- ✅ 错误处理和恢复
- ✅ 外部依赖模拟

**运行集成测试：**
```bash
npm test -- --testPathPattern="test/integration"
```

## 🔧 测试配置

### Jest 配置 (`jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  }
};
```

### 测试设置 (`test/setup.ts`)

- 模拟 GitHub Actions 环境
- 模拟外部依赖 (`@actions/core`, `@actions/github`)
- 模拟文件系统和子进程
- 设置全局测试环境

## 🚀 运行测试

### 快速开始

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- BugmentCore.test.ts

# 运行测试并生成覆盖率报告
npm test -- --coverage

# 监听模式（开发时使用）
npm test -- --watch
```

### 使用测试脚本

```bash
# 运行完整测试套件
./test/run-tests.sh
```

### 测试选项

```bash
# 只运行单元测试
npm test -- --testPathPattern="unit"

# 只运行集成测试
npm test -- --testPathPattern="integration"

# 运行特定模块的测试
npm test -- --testPathPattern="core"

# 详细输出
npm test -- --verbose

# 静默模式
npm test -- --silent
```

## 📊 覆盖率报告

### 查看覆盖率

测试完成后，覆盖率报告会生成在 `coverage/` 目录：

```bash
# 在浏览器中查看详细报告
open coverage/lcov-report/index.html

# 查看终端摘要
cat coverage/lcov.info
```

### 覆盖率目标

| 指标 | 目标 | 当前状态 |
|------|------|----------|
| 行覆盖率 | ≥ 70% | 🎯 |
| 函数覆盖率 | ≥ 70% | 🎯 |
| 分支覆盖率 | ≥ 70% | 🎯 |
| 语句覆盖率 | ≥ 70% | 🎯 |

## 🧩 编写测试

### 单元测试示例

```typescript
import { DiffParser } from '../../../src/parsers/DiffParser';

describe('DiffParser', () => {
  let parser: DiffParser;

  beforeEach(() => {
    parser = new DiffParser();
  });

  test('should parse diff content correctly', () => {
    const sampleDiff = `diff --git a/test.ts b/test.ts...`;
    const result = parser.parseDiffContent(sampleDiff);
    
    expect(result.files.size).toBe(1);
    expect(result.files.has('test.ts')).toBe(true);
  });
});
```

### 集成测试示例

```typescript
import { BugmentAction } from '../../src/action';

describe('BugmentAction Integration', () => {
  test('should handle complete workflow', async () => {
    const action = new BugmentAction();
    
    // 模拟外部依赖
    jest.mock('../../src/services/GitHubService');
    
    await expect(action.run()).resolves.not.toThrow();
  });
});
```

## 🔍 测试最佳实践

### 1. 测试命名

- 使用描述性的测试名称
- 遵循 "should [expected behavior] when [condition]" 格式
- 分组相关测试到 `describe` 块中

### 2. 测试结构

```typescript
describe('ModuleName', () => {
  // 设置和清理
  beforeEach(() => {
    // 初始化
  });

  afterEach(() => {
    // 清理
  });

  describe('methodName', () => {
    test('should handle normal case', () => {
      // 测试正常情况
    });

    test('should handle edge case', () => {
      // 测试边界情况
    });

    test('should handle error case', () => {
      // 测试错误情况
    });
  });
});
```

### 3. 模拟 (Mocking)

- 模拟外部依赖
- 使用 `jest.fn()` 创建模拟函数
- 验证模拟函数的调用

### 4. 断言

- 使用具体的断言而不是通用的 `toBeTruthy()`
- 测试预期的行为而不是实现细节
- 包含正面和负面测试用例

## 🐛 调试测试

### 调试失败的测试

```bash
# 运行特定测试并显示详细输出
npm test -- --testNamePattern="specific test" --verbose

# 在调试模式下运行
node --inspect-brk node_modules/.bin/jest --runInBand

# 查看测试覆盖率详情
npm test -- --coverage --coverageReporters=text-lcov
```

### 常见问题

1. **模拟未生效**：确保模拟在测试文件顶部
2. **异步测试失败**：使用 `async/await` 或返回 Promise
3. **覆盖率不足**：检查未测试的分支和函数

## 📈 持续集成

测试会在以下情况自动运行：

- 每次 `git push` 到远程仓库
- 创建或更新 Pull Request
- 合并到主分支前

### GitHub Actions 配置

```yaml
- name: Run Tests
  run: |
    npm test -- --coverage
    npm run test:integration
```

## 🎯 测试目标

- [ ] 达到 80% 以上的代码覆盖率
- [ ] 所有核心模块都有完整的单元测试
- [ ] 关键工作流都有集成测试
- [ ] 错误处理路径都有测试覆盖
- [ ] 性能关键路径有基准测试

## 📚 相关资源

- [Jest 官方文档](https://jestjs.io/docs/getting-started)
- [TypeScript Jest 配置](https://jestjs.io/docs/getting-started#using-typescript)
- [测试最佳实践](https://github.com/goldbergyoni/javascript-testing-best-practices)
