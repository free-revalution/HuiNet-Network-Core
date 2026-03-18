/**
 * Agent Configuration Management
 *
 * Manages agent configurations stored in YAML files.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Unique agent identifier */
  id: string;

  /** Display name */
  name: string;

  /** Command to execute */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Working directory */
  workdir?: string;

  /** Environment variables */
  env?: Record<string, string>;

  /** Auto-start with daemon? */
  autoStart?: boolean;
}

/**
 * Network configuration
 */
export interface NetworkConfig {
  /** Network name */
  name: string;

  /** Network key for authentication */
  key: string;

  /** Is this the active network? */
  active?: boolean;
}

/**
 * HuiNet configuration file
 */
export interface HuiNetConfig {
  /** Version of config format */
  version: string;

  /** Configured agents */
  agents?: AgentConfig[];

  /** Configured networks */
  networks?: NetworkConfig[];

  /** Daemon settings */
  daemon?: {
    /** P2P listen port */
    listenPort?: number;

    /** Enable mDNS discovery */
    enableMDNS?: boolean;

    /** Bootstrap nodes */
    bootstrapNodes?: string[];

    /** Proxy port range */
    proxyPortRange?: [number, number];
  };
}

/**
 * Configuration file locations
 */
export interface ConfigPaths {
  /** Global config directory */
  global: string;

  /** User config directory */
  user: string;

  /** Global config file */
  globalConfig: string;

  /** User config file */
  userConfig: string;

  /** User agents file */
  agentsConfig: string;
}

/**
 * Get configuration file paths
 */
export function getConfigPaths(): ConfigPaths {
  const homeDir = os.homedir();
  const userDir = path.join(homeDir, '.huinet');

  return {
    global: '/etc/huinet',
    user: userDir,
    globalConfig: '/etc/huinet/config.yaml',
    userConfig: path.join(userDir, 'config.yaml'),
    agentsConfig: path.join(userDir, 'agents.yaml'),
  };
}

/**
 * Agent Configuration Manager
 */
export class AgentConfigManager {
  private paths: ConfigPaths;
  private agentsConfig: AgentConfig[] = [];
  private userConfig: HuiNetConfig | null = null;

  constructor(paths?: ConfigPaths) {
    this.paths = paths || getConfigPaths();
  }

  /**
   * Load configuration from files
   */
  async load(): Promise<void> {
    // Load agents config
    try {
      const content = await readFile(this.paths.agentsConfig, 'utf-8');
      this.agentsConfig = this.parseAgentsConfig(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load agents config:', (error as Error).message);
      }
      this.agentsConfig = [];
    }

    // Load user config
    try {
      const content = await readFile(this.paths.userConfig, 'utf-8');
      this.userConfig = this.parseConfig(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load user config:', (error as Error).message);
      }
      this.userConfig = null;
    }
  }

  /**
   * Save configuration to files
   */
  async save(): Promise<void> {
    // Ensure config directory exists
    try {
      await mkdir(this.paths.user, { recursive: true });
    } catch {
      // Directory might already exist
    }

    // Save agents config
    const agentsContent = this.stringifyAgentsConfig(this.agentsConfig);
    await writeFile(this.paths.agentsConfig, agentsContent, 'utf-8');

    // Save user config if it exists
    if (this.userConfig) {
      const userContent = this.stringifyConfig(this.userConfig);
      await writeFile(this.paths.userConfig, userContent, 'utf-8');
    }
  }

  /**
   * Get all configured agents
   */
  getAgents(): AgentConfig[] {
    return [...this.agentsConfig];
  }

  /**
   * Get agent by ID
   */
  getAgent(id: string): AgentConfig | undefined {
    return this.agentsConfig.find((a) => a.id === id);
  }

  /**
   * Add or update an agent
   */
  async setAgent(agent: AgentConfig): Promise<void> {
    const existingIndex = this.agentsConfig.findIndex((a) => a.id === agent.id);

    if (existingIndex >= 0) {
      this.agentsConfig[existingIndex] = agent;
    } else {
      this.agentsConfig.push(agent);
    }

    await this.save();
  }

  /**
   * Remove an agent
   */
  async removeAgent(id: string): Promise<boolean> {
    const initialLength = this.agentsConfig.length;
    this.agentsConfig = this.agentsConfig.filter((a) => a.id !== id);

    if (this.agentsConfig.length < initialLength) {
      await this.save();
      return true;
    }

    return false;
  }

  /**
   * Get daemon configuration
   */
  getDaemonConfig(): HuiNetConfig['daemon'] {
    return this.userConfig?.daemon || {};
  }

  /**
   * Get network configuration
   */
  getNetworks(): NetworkConfig[] {
    return this.userConfig?.networks || [];
  }

  /**
   * Get active network
   */
  getActiveNetwork(): NetworkConfig | undefined {
    const networks = this.getNetworks();
    return networks.find((n) => n.active) || networks[0];
  }

  /**
   * Parse YAML config (simple implementation)
   */
  private parseConfig(content: string): HuiNetConfig {
    // Simple YAML parser for our specific format
    const lines = content.split('\n');
    const config: any = { version: '1.0' };

    let currentSection: string | null = null;
    let currentItem: any = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Top-level section
      if (trimmed.endsWith(':') && !trimmed.startsWith(' ')) {
        currentSection = trimmed.slice(0, -1);
        if (!(currentSection in config)) {
          config[currentSection] = [];
        }
        currentItem = null;
        continue;
      }

      // Section entry
      if (currentSection) {
        // Agent entry
        if (trimmed.startsWith('- id:')) {
          currentItem = { id: this.parseValue(trimmed.slice(6).trim()) };
          config[currentSection].push(currentItem);
          continue;
        }

        // Agent properties
        if (currentItem && trimmed.includes(':')) {
          const [key, ...valueParts] = trimmed.split(':');
          const value = valueParts.join(':').trim();
          currentItem[key.trim()] = this.parseValue(value);
          continue;
        }
      }
    }

    return config as HuiNetConfig;
  }

  /**
   * Parse agents config section
   */
  private parseAgentsConfig(content: string): AgentConfig[] {
    const lines = content.split('\n');
    const agents: AgentConfig[] = [];
    let currentAgent: any = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // New agent entry
      if (trimmed.startsWith('- id:')) {
        currentAgent = {
          id: this.parseValue(trimmed.slice(5).trim()),
        };
        agents.push(currentAgent);
        continue;
      }

      // Agent properties
      if (currentAgent && trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        currentAgent[key] = this.parseValue(value);

        // Parse args as array
        if (key === 'args' && typeof currentAgent[key] === 'string') {
          // Simple YAML array format: [arg1, arg2]
          if (value.startsWith('[') && value.endsWith(']')) {
            currentAgent[key] = value
              .slice(1, -1)
              .split(',')
              .map((s: string) => s.trim().replace(/^['"]|['"]$/g, ''));
          } else {
            currentAgent[key] = [currentAgent[key]];
          }
        }
        continue;
      }
    }

    return agents;
  }

  /**
   * Parse a YAML value
   */
  private parseValue(value: string): string | boolean | number {
    value = value.trim();

    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Number
    if (/^\d+$/.test(value)) return parseInt(value, 10);
    if (/^\d+\.\d+$/.test(value)) return parseFloat(value);

    // String (remove quotes)
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    return value;
  }

  /**
   * Stringify config to YAML
   */
  private stringifyConfig(config: HuiNetConfig): string {
    const lines: string[] = [];

    lines.push(`version: "${config.version}"`);
    lines.push('');

    if (config.networks && config.networks.length > 0) {
      lines.push('networks:');
      for (const network of config.networks) {
        lines.push(`  - name: "${network.name}"`);
        lines.push(`    key: "${network.key}"`);
        if (network.active) {
          lines.push(`    active: true`);
        }
      }
      lines.push('');
    }

    if (config.daemon) {
      lines.push('daemon:');
      if (config.daemon.listenPort) {
        lines.push(`  listenPort: ${config.daemon.listenPort}`);
      }
      if (config.daemon.enableMDNS !== undefined) {
        lines.push(`  enableMDNS: ${config.daemon.enableMDNS}`);
      }
      if (config.daemon.bootstrapNodes) {
        lines.push(`  bootstrapNodes:`);
        for (const node of config.daemon.bootstrapNodes) {
          lines.push(`    - "${node}"`);
        }
      }
      if (config.daemon.proxyPortRange) {
        lines.push(`  proxyPortRange: [${config.daemon.proxyPortRange[0]}, ${config.daemon.proxyPortRange[1]}]`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Stringify agents config to YAML
   */
  private stringifyAgentsConfig(agents: AgentConfig[]): string {
    const lines: string[] = [];

    lines.push('# HuiNet Agent Configuration');
    lines.push('# Edit this file to add or modify agents');
    lines.push('');

    for (const agent of agents) {
      lines.push(`- id: "${agent.id}"`);
      lines.push(`  name: "${agent.name}"`);
      lines.push(`  command: "${agent.command}"`);

      if (agent.args && agent.args.length > 0) {
        lines.push(`  args: [${agent.args.map((a) => `"${a}"`).join(', ')}]`);
      }

      if (agent.workdir) {
        lines.push(`  workdir: "${agent.workdir}"`);
      }

      if (agent.env) {
        lines.push(`  env:`);
        for (const [key, value] of Object.entries(agent.env)) {
          lines.push(`    ${key}: "${value}"`);
        }
      }

      if (agent.autoStart) {
        lines.push(`  autoStart: true`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Create config manager instance
 */
export function createConfigManager(): AgentConfigManager {
  return new AgentConfigManager();
}
