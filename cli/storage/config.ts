/**
 * Configuration manager
 *
 * Manages user configuration, aliases, message history, etc.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  validateConfigData,
  sanitizeConfigData,
  ValidationError,
} from '../../src/utils/validation';

export interface ConfigData {
  name: string;
  nodeID?: string;
  aliases: Record<string, string>;
  messageHistory?: Array<{
    direction: 'sent' | 'received';
    target: string;
    message: string;
    timestamp: number;
  }>;
  settings: {
    mdns: boolean;
    autoConnect: string[];
  };
}

/**
 * 配置管理器（单例）
 */
export class ConfigManager {
  private static instance: ConfigManager;
  private configPath: string;
  private data: ConfigData;
  private dirty: boolean = false;

  private constructor() {
    // 配置文件路径 ~/.huinet/config.json
    const configDir = path.join(os.homedir(), '.huinet');
    this.configPath = path.join(configDir, 'config.json');

    // 确保配置目录存在
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    // 加载配置
    this.data = this.load();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Load configuration
   */
  private load(): ConfigData {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const data = JSON.parse(content);

        // Validate configuration
        try {
          validateConfigData(data);
          return data;
        } catch (error) {
          if (error instanceof ValidationError) {
            console.warn(`⚠️  Configuration validation failed: ${error.message}`);
            console.warn('⚠️  Sanitizing configuration and using defaults for invalid values');
            return sanitizeConfigData(data);
          }
          throw error;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️  Failed to load configuration file: ${errorMessage}`);
      console.warn('⚠️  Using default configuration');
    }

    // Return default configuration
    return {
      name: 'MyAgent',
      aliases: {},
      settings: {
        mdns: true,
        autoConnect: []
      }
    };
  }

  /**
   * 保存配置
   */
  save(): void {
    try {
      fs.writeFileSync(
        this.configPath,
        JSON.stringify(this.data, null, 2),
        'utf-8'
      );
      this.dirty = false;
    } catch (error) {
      console.error('❌ 配置保存失败:', (error as Error).message);
    }
  }

  /**
   * 获取配置值
   */
  get<K extends keyof ConfigData>(key: K): ConfigData[K] {
    return this.data[key];
  }

  /**
   * 设置配置值
   */
  set<K extends keyof ConfigData>(key: K, value: ConfigData[K]): void {
    this.data[key] = value;
    this.dirty = true;
  }

  /**
   * 获取嵌套配置值（支持点号路径）
   */
  getNested(path: string): any {
    const parts = path.split('.');
    let value: any = this.data;

    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * 设置嵌套配置值
   */
  setNested(path: string, value: any): void {
    const parts = path.split('.');
    let obj: any = this.data;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in obj) || typeof obj[part] !== 'object') {
        obj[part] = {};
      }
      obj = obj[part];
    }

    obj[parts[parts.length - 1]] = value;
    this.dirty = true;
  }

  /**
   * 获取所有别名
   */
  getAliases(): Record<string, string> {
    return this.data.aliases || {};
  }

  /**
   * 通过别名解析 NodeID
   */
  resolveAlias(alias: string): string | null {
    return this.data.aliases[alias] || null;
  }

  /**
   * 添加别名
   */
  addAlias(alias: string, nodeID: string): void {
    this.data.aliases[alias] = nodeID;
    this.dirty = true;
  }

  /**
   * 删除别名
   */
  removeAlias(alias: string): void {
    delete this.data.aliases[alias];
    this.dirty = true;
  }

  /**
   * 添加消息历史
   */
  addMessage(
    direction: 'sent' | 'received',
    target: string,
    message: string
  ): void {
    if (!this.data.messageHistory) {
      this.data.messageHistory = [];
    }

    this.data.messageHistory.push({
      direction,
      target,
      message,
      timestamp: Date.now()
    });

    // 只保留最近 100 条
    if (this.data.messageHistory.length > 100) {
      this.data.messageHistory.shift();
    }

    this.dirty = true;
  }

  /**
   * 获取消息历史
   */
  getMessages(limit?: number): ConfigData['messageHistory'] {
    const history = this.data.messageHistory || [];
    return limit ? history.slice(-limit) : history;
  }

  /**
   * 清空消息历史
   */
  clearHistory(): void {
    this.data.messageHistory = [];
    this.dirty = true;
  }
}
