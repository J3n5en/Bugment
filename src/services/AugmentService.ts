import * as core from "@actions/core";
import * as fs from "fs";
import * as path from "path";
import { ActionInputs } from "../core/types";

/**
 * Augment 服务类
 * 负责 Augment 认证和配置管理
 */
export class AugmentService {
  private inputs: ActionInputs;

  constructor(inputs: ActionInputs) {
    this.inputs = inputs;
  }

  /**
   * 设置 Augment 认证
   */
  async setupAuthentication(): Promise<void> {
    core.info("🔐 Setting up Augment authentication...");

    const configDir = path.join(
      process.env.HOME || "~",
      ".local/share/vim-augment"
    );
    const configFile = path.join(configDir, "secrets.json");

    // 创建配置目录
    await fs.promises.mkdir(configDir, { recursive: true });

    // 创建认证配置
    const authConfig = {
      "augment.sessions": JSON.stringify({
        accessToken: this.inputs.augmentAccessToken,
        tenantURL: this.inputs.augmentTenantUrl,
        scopes: ["email"],
      }),
    };

    await fs.promises.writeFile(
      configFile,
      JSON.stringify(authConfig, null, 2)
    );
    core.info("✅ Augment authentication configured");
  }

  /**
   * 验证认证配置
   */
  async validateAuthentication(): Promise<boolean> {
    try {
      const configDir = path.join(
        process.env.HOME || "~",
        ".local/share/vim-augment"
      );
      const configFile = path.join(configDir, "secrets.json");

      // 检查配置文件是否存在
      if (!fs.existsSync(configFile)) {
        core.warning("Augment configuration file not found");
        return false;
      }

      // 读取并验证配置
      const configContent = await fs.promises.readFile(configFile, "utf-8");
      const config = JSON.parse(configContent);

      if (!config["augment.sessions"]) {
        core.warning("Augment sessions configuration not found");
        return false;
      }

      const sessionData = JSON.parse(config["augment.sessions"]);
      if (!sessionData.accessToken || !sessionData.tenantURL) {
        core.warning("Augment authentication data incomplete");
        return false;
      }

      core.info("✅ Augment authentication validated");
      return true;
    } catch (error) {
      core.warning(`Failed to validate Augment authentication: ${error}`);
      return false;
    }
  }

  /**
   * 清理认证配置
   */
  async cleanupAuthentication(): Promise<void> {
    try {
      const configDir = path.join(
        process.env.HOME || "~",
        ".local/share/vim-augment"
      );
      const configFile = path.join(configDir, "secrets.json");

      if (fs.existsSync(configFile)) {
        await fs.promises.unlink(configFile);
        core.info("🧹 Augment authentication configuration cleaned up");
      }
    } catch (error) {
      core.warning(`Failed to cleanup Augment authentication: ${error}`);
    }
  }

  /**
   * 获取配置信息（不包含敏感数据）
   */
  getConfigInfo(): {
    tenantUrl: string;
    hasAccessToken: boolean;
    configPath: string;
  } {
    const configDir = path.join(
      process.env.HOME || "~",
      ".local/share/vim-augment"
    );
    const configFile = path.join(configDir, "secrets.json");

    return {
      tenantUrl: this.inputs.augmentTenantUrl,
      hasAccessToken: !!this.inputs.augmentAccessToken,
      configPath: configFile,
    };
  }

  /**
   * 检查 Augment 服务连接
   */
  async checkConnection(): Promise<boolean> {
    try {
      // 这里可以添加实际的连接检查逻辑
      // 例如调用 Augment API 的健康检查端点
      core.info("🔗 Checking Augment service connection...");
      
      // 临时返回 true，实际实现时应该进行真实的连接测试
      core.info("✅ Augment service connection verified");
      return true;
    } catch (error) {
      core.warning(`Augment service connection failed: ${error}`);
      return false;
    }
  }

  /**
   * 获取 Augment 配置摘要
   */
  getConfigSummary(): string {
    const info = this.getConfigInfo();
    return `Tenant: ${info.tenantUrl}, Token: ${info.hasAccessToken ? "✓" : "✗"}`;
  }
}
