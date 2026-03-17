/**
 * HuiNet Proxy Server - Configuration Manager
 */

import { ProxyConfig, LogLevel } from '../types';

export class ConfigManager {
  private config: ProxyConfig;

  constructor(userConfig: Partial<ProxyConfig> = {}) {
    this.config = this.loadConfig(userConfig);
  }

  /**
   * Load configuration with priority: env vars > user config > defaults
   */
  private loadConfig(userConfig: Partial<ProxyConfig>): ProxyConfig {
    const defaultConfig: ProxyConfig = {
      httpPort: 3000,
      wsPort: 3001,
      host: process.env.HUINET_HOST || '0.0.0.0',
      apiKey: process.env.HUINET_API_KEY || this.generateApiKey(),
      huinet: {
        listenPort: parseInt(process.env.HUINET_PORT || '8000', 10),
        enableMDNS: process.env.HUINET_ENABLE_MDNS !== 'false',
        bootstrapNodes: this.parseBootstrapNodes(process.env.HUINET_BOOTSTRAP),
      },
      logLevel: (process.env.HUINET_LOG_LEVEL as LogLevel) || 'info',
      maxConnections: parseInt(process.env.HUINET_MAX_CONNECTIONS || '100', 10),
    };

    return {
      httpPort: userConfig.httpPort ?? defaultConfig.httpPort,
      wsPort: userConfig.wsPort ?? defaultConfig.wsPort,
      host: userConfig.host ?? defaultConfig.host,
      apiKey: userConfig.apiKey ?? defaultConfig.apiKey,
      huinet: {
        ...defaultConfig.huinet,
        ...userConfig.huinet,
      },
      logLevel: userConfig.logLevel ?? defaultConfig.logLevel,
      maxConnections: userConfig.maxConnections ?? defaultConfig.maxConnections,
    };
  }

  /**
   * Parse bootstrap nodes from environment variable
   */
  private parseBootstrapNodes(envValue?: string): string[] {
    if (!envValue) return [];
    return envValue.split(',').map(s => s.trim()).filter(Boolean);
  }

  /**
   * Generate a random API key
   */
  private generateApiKey(): string {
    return `hk_${Buffer.from(Date.now().toString() + Math.random().toString())
      .toString('base64')
      .substring(0, 32)}`;
  }

  /**
   * Get current configuration
   */
  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  /**
   * Get specific config value
   */
  get<K extends keyof ProxyConfig>(key: K): ProxyConfig[K] {
    return this.config[key];
  }

  /**
   * Validate configuration
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.config.httpPort < 1 || this.config.httpPort > 65535) {
      errors.push('httpPort must be between 1 and 65535');
    }

    if (this.config.wsPort < 1 || this.config.wsPort > 65535) {
      errors.push('wsPort must be between 1 and 65535');
    }

    if (this.config.httpPort === this.config.wsPort) {
      errors.push('httpPort and wsPort must be different');
    }

    if (!this.config.apiKey || this.config.apiKey.length < 8) {
      errors.push('apiKey must be at least 8 characters');
    }

    if (this.config.huinet.listenPort < 1 || this.config.huinet.listenPort > 65535) {
      errors.push('huinet.listenPort must be between 1 and 65535');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
