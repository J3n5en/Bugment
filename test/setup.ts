/**
 * Jest 测试设置文件
 * 配置全局测试环境和模拟
 */

// 模拟 @actions/core
jest.mock("@actions/core", () => ({
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  debug: jest.fn(),
}));

// 模拟 @actions/github
jest.mock("@actions/github", () => ({
  context: {
    repo: { owner: "test-owner", repo: "test-repo" },
    payload: {
      pull_request: {
        number: 123,
        title: "Test PR",
        body: "Test PR body",
        base: { sha: "base-sha" },
        head: { sha: "head-sha" },
      },
    },
  },
  getOctokit: jest.fn(() => ({
    rest: {
      repos: {
        compareCommits: jest.fn(),
      },
      pulls: {
        listReviews: jest.fn(),
        createReview: jest.fn(),
      },
    },
    graphql: jest.fn(),
  })),
}));

// 模拟文件系统
jest.mock("fs", () => ({
  promises: {
    mkdir: jest.fn(),
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    access: jest.fn(), // 添加 access 方法
  },
  existsSync: jest.fn(() => true),
  readFileSync: jest.fn(() => "mock file content"),
}));

// 模拟子进程
jest.mock("child_process", () => ({
  spawn: jest.fn(() => ({
    stdout: {
      on: jest.fn((event, callback) => {
        if (event === "data") {
          callback(Buffer.from("mock output"));
        }
      }),
    },
    stderr: {
      on: jest.fn(),
    },
    on: jest.fn((event, callback) => {
      if (event === "close") {
        callback(0);
      }
    }),
  })),
}));

// 设置环境变量
process.env.GITHUB_WORKSPACE = "/test/workspace";
process.env.GITHUB_SHA = "test-sha";
process.env.HOME = "/test/home";

// 全局测试超时
jest.setTimeout(30000);

// 清理控制台输出（可选）
global.console = {
  ...console,
  // 在测试中静默某些日志
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
