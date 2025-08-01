# Bugment 架构文档

## 📁 项目结构

```
src/
├── action.ts                 # 主入口文件 (249 行)
├── index.ts                  # 模块导出索引
├── core/                     # 核心业务逻辑
│   ├── BugmentCore.ts       # 主要业务流程控制
│   ├── ReviewWorkflow.ts    # 审查工作流管理
│   ├── types.ts             # 核心类型定义
│   └── index.ts             # 核心模块导出
├── services/                 # 外部服务集成
│   ├── GitHubService.ts     # GitHub API 集成
│   ├── GitService.ts        # Git 操作封装
│   ├── AugmentService.ts    # Augment 认证服务
│   ├── ReviewService.ts     # 审查执行服务
│   ├── AugmentClient.ts     # Augment IPC 客户端
│   └── index.ts             # 服务模块导出
├── parsers/                  # 数据解析模块
│   ├── DiffParser.ts        # Diff 内容解析
│   ├── ReviewResultParser.ts # 审查结果解析
│   ├── IssueParser.ts       # 问题数据解析
│   ├── LocationParser.ts    # 位置信息解析
│   └── index.ts             # 解析器模块导出
├── formatters/               # UI 格式化模块
│   ├── CommentFormatter.ts  # 评论格式化
│   ├── ReviewFormatter.ts   # 审查结果格式化
│   ├── MarkdownFormatter.ts # Markdown 输出格式化
│   └── index.ts             # 格式化器模块导出
├── utils/                    # 工具模块
│   ├── ValidationUtils.ts   # 验证工具
│   ├── ComparisonUtils.ts   # 比较工具
│   ├── FormatUtils.ts       # 格式化工具
│   ├── IgnoreManager.ts     # 忽略文件管理
│   └── index.ts             # 工具模块导出
└── templates/                # 模板文件
    ├── prompt.md            # 审查提示模板
    └── index.ts             # 模板模块导出
```

## 🏗️ 架构设计

### 设计原则

1. **单一职责原则**：每个模块只负责一个特定的功能
2. **依赖注入**：通过构造函数注入依赖，便于测试
3. **接口分离**：定义清晰的接口，降低模块间耦合
4. **开闭原则**：对扩展开放，对修改封闭

### 模块依赖关系

```
action.ts (协调器)
    ↓
BugmentCore (核心逻辑)
    ↓
├── GitHubService (GitHub 集成)
├── GitService (Git 操作)  
├── AugmentService (Augment 集成)
├── ReviewService (审查执行)
├── DiffParser (Diff 解析)
├── ReviewResultParser (结果解析)
├── CommentFormatter (评论格式化)
├── ReviewFormatter (审查格式化)
└── ValidationUtils (验证工具)
```

## 📊 重构成果

### 代码量对比

| 指标 | 重构前 | 重构后 | 改进 |
|------|--------|--------|------|
| 主文件行数 | 1831 行 | 249 行 | **减少 86%** |
| 文件数量 | 1 个巨型文件 | 20+ 个模块文件 | **模块化** |
| 平均文件大小 | 1831 行 | ~150 行 | **易于维护** |

### 主要改进

1. **可维护性**：代码结构清晰，易于理解和修改
2. **可测试性**：每个模块可以独立测试
3. **可扩展性**：新功能可以轻松添加到相应模块
4. **代码复用**：工具模块可以被多处使用
5. **错误处理**：完善的验证和错误处理机制

## 🔧 使用方式

### 基本使用

```typescript
import { BugmentAction } from './src/action';

// 创建并运行 Action
const action = new BugmentAction();
await action.run();
```

### 模块化使用

```typescript
import { GitHubService, DiffParser, ReviewFormatter } from './src';

// 使用特定模块
const githubService = new GitHubService(token, prInfo);
const diffParser = new DiffParser();
const formatter = new ReviewFormatter();
```

## 🧪 测试策略

每个模块都可以独立测试：

```typescript
// 测试 DiffParser
import { DiffParser } from '../src/parsers/DiffParser';

describe('DiffParser', () => {
  test('should parse diff content correctly', () => {
    const parser = new DiffParser();
    const result = parser.parseDiffContent(sampleDiff);
    expect(result.files.size).toBeGreaterThan(0);
  });
});
```

## 🚀 扩展指南

### 添加新的解析器

1. 在 `src/parsers/` 目录创建新文件
2. 实现解析逻辑
3. 在 `src/parsers/index.ts` 中导出
4. 在需要的地方导入使用

### 添加新的服务

1. 在 `src/services/` 目录创建新文件
2. 实现服务逻辑
3. 在 `src/services/index.ts` 中导出
4. 在 `BugmentAction` 中集成

## 📝 注意事项

1. 所有模块都应该有完善的 TypeScript 类型定义
2. 公共接口应该在 `src/core/types.ts` 中定义
3. 工具函数应该是纯函数，便于测试
4. 错误处理应该统一，使用 `@actions/core` 记录日志
