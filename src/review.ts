#!/usr/bin/env node

import * as fs from "fs";
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import * as path from "path";
import pRetry from "p-retry";
import pTimeout from "p-timeout";
interface ReviewOptions {
  projectPath: string;
  prTitle: string;
  prDescription: string;
  diffPath?: string;
  repoOwner?: string;
  repoName?: string;
  commitSha?: string;
}

interface StatusResponse {
  loggedIn: boolean;
  syncPercentage?: number;
}

interface LSPMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

interface InitializeParams {
  processId: number;
  capabilities: object;
  initializationOptions: {
    editor: string;
    vimVersion: string;
    pluginVersion: string;
  };
  workspaceFolders: any[];
}

export class AugmentIPCClient extends EventEmitter {
  private static readonly VIM_VERSION = "9.1.754";
  private static readonly PLUGIN_VERSION = "0.25.1";

  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: any) => void;
      reject: (error: any) => void;
      timestamp: number;
    }
  >();
  private serverProcess: ChildProcess | null = null;
  private serverPath: string;
  private isInitialized = false;
  private connectionTimeout = 60000;
  private requestTimeout = 120000;

  constructor(serverPath: string = "./dist/server.js") {
    super();
    this.serverPath = path.resolve(serverPath);
  }

  // ========================================================================
  // Server Management
  // ========================================================================

  async startServer(basePath: string): Promise<void> {
    if (this.serverProcess) {
      throw new Error("Server is already running");
    }

    // Starting Augment server with Node IPC

    return pTimeout(
      pRetry(
        async () => {
          await this._spawnServerProcess();
          await this._initializeServer(basePath);
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 5000,
          onFailedAttempt: (error) => {
            console.warn(
              `⚠️ Attempt ${error.attemptNumber} failed: ${error.message}`
            );
            this._cleanup();
          },
        }
      ),
      {
        milliseconds: this.connectionTimeout,
        message: "Server startup timeout",
      }
    );
  }

  private async _spawnServerProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 使用 node-ipc 模式启动服务器
      this.serverProcess = spawn("node", [this.serverPath, "--node-ipc"], {
        stdio: ["pipe", "pipe", "pipe", "ipc"],
        env: process.env,
      });

      // 错误处理
      this.serverProcess.on("error", (error) => {
        console.error("❌ Failed to start server process:", error);
        reject(new Error(`Server spawn failed: ${error.message}`));
      });

      this.serverProcess.on("exit", (code, signal) => {
        // Server exited
        this.emit("serverExit", { code, signal });
        this._cleanup();
      });

      // IPC 消息监听
      this.serverProcess.on("message", (message: LSPMessage) => {
        this._handleMessage(message);
      });

      // 标准错误输出监听
      this.serverProcess.stderr?.on("data", (data) => {
        const errorText = data.toString().trim();
        if (errorText) {
          // Suppress normal stderr output unless it's an actual error
        }
      });

      // 标准输出监听（用于调试）
      this.serverProcess.stdout?.on("data", () => {
        // Suppress stdout output for cleaner logs
      });

      // 等待进程启动
      setTimeout(() => {
        if (this.serverProcess && !this.serverProcess.killed) {
          // Server process started successfully
          resolve();
        } else {
          reject(new Error("Server process failed to start"));
        }
      }, 1000);
    });
  }

  private async _initializeServer(basePath: string): Promise<void> {
    const initParams: InitializeParams = {
      processId: process.pid,
      capabilities: {},
      initializationOptions: {
        editor: "vim",
        vimVersion: AugmentIPCClient.VIM_VERSION,
        pluginVersion: AugmentIPCClient.PLUGIN_VERSION,
      },
      workspaceFolders: [
        {
          uri: `file://${basePath}`,
          name: path.basename(basePath),
        },
      ],
    };

    await this._sendRequest("initialize", initParams);
    this.isInitialized = true;
    // Server initialized successfully
  }

  stopServer(): void {
    this._cleanup();
  }

  private _cleanup(): void {
    if (this.serverProcess) {
      if (!this.serverProcess.killed) {
        this.serverProcess.kill("SIGTERM");

        // 强制终止超时
        setTimeout(() => {
          if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill("SIGKILL");
          }
        }, 5000);
      }
      this.serverProcess = null;
    }

    // 清理待处理的请求
    for (const [, request] of this.pendingRequests) {
      request.reject(new Error("Server connection closed"));
    }
    this.pendingRequests.clear();

    this.isInitialized = false;
  }

  // ========================================================================
  // IPC Communication
  // ========================================================================

  private async _sendRequest(method: string, params?: any): Promise<any> {
    if (!this.serverProcess) {
      throw new Error("Server is not running");
    }

    const id = ++this.requestId;
    const message: LSPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return pTimeout(
      new Promise((resolve, reject) => {
        this.pendingRequests.set(id, {
          resolve,
          reject,
          timestamp: Date.now(),
        });

        // 发送 IPC 消息
        this.serverProcess!.send(message, (error) => {
          if (error) {
            this.pendingRequests.delete(id);
            reject(new Error(`IPC send failed: ${error.message}`));
          }
        });
      }),
      {
        milliseconds: this.requestTimeout,
        message: `Request timeout: ${method}`,
      }
    );
  }

  private _handleMessage(message: LSPMessage): void {
    if (message.id !== undefined) {
      // 处理响应
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);

        if (message.error) {
          const error = new Error(message.error.message);
          (error as any).code = message.error.code;
          (error as any).data = message.error.data;
          pending.reject(error);
        } else {
          pending.resolve(message.result);
        }
      }
    } else if (message.method) {
      // 处理通知
      this.handleNotification(message.method, message.params);
    }
  }

  private handleNotification(method: string, params: any): void {
    switch (method) {
      case "augment/chatChunk":
        this.emit("chatChunk", params);
        break;
      case "window/logMessage":
        console.log("Server log:", params);
        break;
      default:
        console.log("Unknown notification:", method, params);
    }
  }

  // ========================================================================
  // Status API
  // ========================================================================

  async getStatus(): Promise<StatusResponse> {
    if (!this.isInitialized) {
      throw new Error("Server is not initialized. Call startServer() first.");
    }

    try {
      const result = await this._sendRequest("augment/status");

      const enhancedStatus: StatusResponse = {
        loggedIn: result.loggedIn || false,
        syncPercentage: result.syncPercentage,
      };

      return enhancedStatus;
    } catch (error) {
      console.error("❌ Failed to get status:", error);
      throw error;
    }
  }

  async sendMessage(message: string, filePath: string): Promise<any> {
    if (!this.isInitialized) {
      throw new Error("Server is not initialized. Call startServer() first.");
    }

    try {
      const result = await this._sendRequest("augment/chat", {
        textDocumentPosition: {
          textDocument: {
            uri: `file:///${filePath}`,
          },
          position: { line: 0, character: 0 },
        },
        message,
      });

      // Message sent successfully
      return result;
    } catch (error) {
      console.error("❌ Failed to send message:", error);
      throw error;
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  isRunning(): boolean {
    return this.serverProcess !== null && !this.serverProcess.killed;
  }

  isReady(): boolean {
    return this.isRunning() && this.isInitialized;
  }
}

async function loadPromptTemplate(): Promise<string> {
  const promptPath = path.join(__dirname, "prompt.txt");
  return fs.readFileSync(promptPath, "utf-8");
}

async function readDiffFile(diffPath: string): Promise<string> {
  if (!fs.existsSync(diffPath)) {
    throw new Error(`Diff file not found: ${diffPath}`);
  }
  return fs.readFileSync(diffPath, "utf-8");
}

function formatPrompt(
  template: string,
  options: ReviewOptions,
  diffContent: string
): string {
  // 构建 GitHub 仓库链接信息
  const githubInfo =
    options.repoOwner && options.repoName && options.commitSha
      ? `\n\n## GitHub 仓库信息\n- 仓库: ${options.repoOwner}/${options.repoName}\n- 提交: ${options.commitSha}\n- 基础链接: https://github.com/${options.repoOwner}/${options.repoName}/blob/${options.commitSha}/`
      : "";

  return (
    template
      .replace("{PR_TITLE}", options.prTitle || "No title provided")
      .replace(
        "{PR_DESCRIPTION}",
        options.prDescription || "No description provided"
      )
      .replace("{DIFF_CONTENT}", diffContent || "No diff content available") +
    githubInfo
  );
}

async function performCodeReview(options: ReviewOptions): Promise<string> {
  const client = new AugmentIPCClient();

  try {
    await client.startServer(options.projectPath);

    // 等待同步完成
    for (let attempt = 0; attempt < 300; attempt++) {
      const status = await client.getStatus();

      if (status.syncPercentage === 100) {
        break;
      }

      if (attempt === 299) {
        throw new Error("Server synchronization timeout after 300 attempts");
      }

      // 等待1秒后重试
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const promptTemplate = await loadPromptTemplate();
    const diffContent = options.diffPath
      ? await readDiffFile(options.diffPath)
      : "";
    const reviewPrompt = formatPrompt(promptTemplate, options, diffContent);

    const reviewResult = await client.sendMessage(
      reviewPrompt,
      options.projectPath
    );

    return reviewResult.text;
  } catch (error) {
    console.error("❌ Code review failed:", error);
    throw error;
  } finally {
    client.stopServer();
  }
}

export { performCodeReview, ReviewOptions };
