#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AugmentIPCClient = void 0;
exports.performCodeReview = performCodeReview;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const events_1 = require("events");
const path = __importStar(require("path"));
const p_retry_1 = __importDefault(require("p-retry"));
const p_timeout_1 = __importDefault(require("p-timeout"));
class AugmentIPCClient extends events_1.EventEmitter {
    constructor(serverPath = "./dist/server.js") {
        super();
        this.requestId = 0;
        this.pendingRequests = new Map();
        this.serverProcess = null;
        this.isInitialized = false;
        this.connectionTimeout = 30000;
        this.requestTimeout = 60000;
        this.serverPath = path.resolve(serverPath);
    }
    // ========================================================================
    // Server Management
    // ========================================================================
    async startServer(basePath) {
        if (this.serverProcess) {
            throw new Error("Server is already running");
        }
        // Starting Augment server with Node IPC
        return (0, p_timeout_1.default)((0, p_retry_1.default)(async () => {
            await this._spawnServerProcess();
            await this._initializeServer(basePath);
        }, {
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 5000,
            onFailedAttempt: (error) => {
                console.warn(`⚠️ Attempt ${error.attemptNumber} failed: ${error.message}`);
                this._cleanup();
            },
        }), {
            milliseconds: this.connectionTimeout,
            message: "Server startup timeout",
        });
    }
    async _spawnServerProcess() {
        return new Promise((resolve, reject) => {
            // 使用 node-ipc 模式启动服务器
            this.serverProcess = (0, child_process_1.spawn)("node", [this.serverPath, "--node-ipc"], {
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
            this.serverProcess.on("message", (message) => {
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
                }
                else {
                    reject(new Error("Server process failed to start"));
                }
            }, 1000);
        });
    }
    async _initializeServer(basePath) {
        const initParams = {
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
    stopServer() {
        this._cleanup();
    }
    _cleanup() {
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
    async _sendRequest(method, params) {
        if (!this.serverProcess) {
            throw new Error("Server is not running");
        }
        const id = ++this.requestId;
        const message = {
            jsonrpc: "2.0",
            id,
            method,
            params,
        };
        return (0, p_timeout_1.default)(new Promise((resolve, reject) => {
            this.pendingRequests.set(id, {
                resolve,
                reject,
                timestamp: Date.now(),
            });
            // 发送 IPC 消息
            this.serverProcess.send(message, (error) => {
                if (error) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`IPC send failed: ${error.message}`));
                }
            });
        }), {
            milliseconds: this.requestTimeout,
            message: `Request timeout: ${method}`,
        });
    }
    _handleMessage(message) {
        if (message.id !== undefined) {
            // 处理响应
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    const error = new Error(message.error.message);
                    error.code = message.error.code;
                    error.data = message.error.data;
                    pending.reject(error);
                }
                else {
                    pending.resolve(message.result);
                }
            }
        }
        else if (message.method) {
            // 处理通知
            this.handleNotification(message.method, message.params);
        }
    }
    handleNotification(method, params) {
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
    async getStatus() {
        if (!this.isInitialized) {
            throw new Error("Server is not initialized. Call startServer() first.");
        }
        try {
            const result = await this._sendRequest("augment/status");
            const enhancedStatus = {
                loggedIn: result.loggedIn || false,
                syncPercentage: result.syncPercentage,
            };
            return enhancedStatus;
        }
        catch (error) {
            console.error("❌ Failed to get status:", error);
            throw error;
        }
    }
    async sendMessage(message, filePath) {
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
        }
        catch (error) {
            console.error("❌ Failed to send message:", error);
            throw error;
        }
    }
    // ========================================================================
    // Utility Methods
    // ========================================================================
    isRunning() {
        return this.serverProcess !== null && !this.serverProcess.killed;
    }
    isReady() {
        return this.isRunning() && this.isInitialized;
    }
}
exports.AugmentIPCClient = AugmentIPCClient;
AugmentIPCClient.VIM_VERSION = "9.1.754";
AugmentIPCClient.PLUGIN_VERSION = "0.25.1";
async function loadPromptTemplate() {
    const promptPath = path.join(__dirname, "prompt.txt");
    return fs.readFileSync(promptPath, "utf-8");
}
async function readDiffFile(diffPath) {
    if (!fs.existsSync(diffPath)) {
        throw new Error(`Diff file not found: ${diffPath}`);
    }
    return fs.readFileSync(diffPath, "utf-8");
}
function formatPrompt(template, options, diffContent) {
    // 构建 GitHub 仓库链接信息
    const githubInfo = options.repoOwner && options.repoName && options.commitSha
        ? `\n\n## GitHub 仓库信息\n- 仓库: ${options.repoOwner}/${options.repoName}\n- 提交: ${options.commitSha}\n- 基础链接: https://github.com/${options.repoOwner}/${options.repoName}/blob/${options.commitSha}/`
        : "";
    return (template
        .replace("{PR_TITLE}", options.prTitle || "No title provided")
        .replace("{PR_DESCRIPTION}", options.prDescription || "No description provided")
        .replace("{DIFF_CONTENT}", diffContent || "No diff content available") +
        githubInfo);
}
async function performCodeReview(options) {
    const client = new AugmentIPCClient();
    try {
        await client.startServer(options.projectPath);
        // 等待同步完成
        for (let attempt = 0; attempt < 30; attempt++) {
            const status = await client.getStatus();
            if (status.syncPercentage === 100) {
                break;
            }
            if (attempt === 29) {
                throw new Error("Server synchronization timeout after 30 attempts");
            }
            // 等待1秒后重试
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        const promptTemplate = await loadPromptTemplate();
        const diffContent = options.diffPath
            ? await readDiffFile(options.diffPath)
            : "";
        const reviewPrompt = formatPrompt(promptTemplate, options, diffContent);
        const reviewResult = await client.sendMessage(reviewPrompt, options.projectPath);
        return reviewResult.text;
    }
    catch (error) {
        console.error("❌ Code review failed:", error);
        throw error;
    }
    finally {
        client.stopServer();
    }
}
function parseArguments() {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        switch (key) {
            case "--path":
                options.projectPath = value;
                break;
            case "--title":
                options.prTitle = value;
                break;
            case "--body":
                options.prDescription = value;
                break;
            case "--diff":
                options.diffPath = value;
                break;
            case "--repo-owner":
                options.repoOwner = value;
                break;
            case "--repo-name":
                options.repoName = value;
                break;
            case "--commit-sha":
                options.commitSha = value;
                break;
            default:
                console.warn(`Unknown argument: ${key}`);
        }
    }
    if (!options.projectPath) {
        throw new Error("Project path is required. Use --path argument.");
    }
    return options;
}
//# sourceMappingURL=review.js.map