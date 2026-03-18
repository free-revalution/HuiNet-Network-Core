/**
 * Network Manager
 *
 * Manages network configuration and joining
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Network configuration
 */
export interface NetworkInfo {
  /** Network name */
  name: string;

  /** Network key (32 char hex) */
  key: string;

  /** Is this the active network */
  active: boolean;

  /** Created at timestamp */
  createdAt?: number;

  /** Machine ID */
  machineId?: string;
}

/**
 * Network Manager
 */
export class NetworkManager {
  private configPath: string;
  private networks: NetworkInfo[] = [];
  private activeNetwork: NetworkInfo | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(os.homedir(), '.huinet', 'networks.yaml');
  }

  /**
   * Load network configuration
   */
  async load(): Promise<void> {
    try {
      const content = await readFile(this.configPath, 'utf-8');
      this.networks = this.parseNetworks(content);

      // Find active network
      this.activeNetwork = this.networks.find(n => n.active) || null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('Failed to load networks config:', (error as Error).message);
      }
      this.networks = [];
      this.activeNetwork = null;
    }
  }

  /**
   * Save network configuration
   */
  async save(): Promise<void> {
    // Ensure directory exists
    const dir = path.dirname(this.configPath);
    try {
      await mkdir(dir, { recursive: true });
    } catch {
      // Directory might exist
    }

    const content = this.stringifyNetworks();
    await writeFile(this.configPath, content, 'utf-8');
  }

  /**
   * Create a new network
   */
  async createNetwork(name: string): Promise<NetworkInfo> {
    // Generate network key
    const key = crypto.randomBytes(16).toString('hex');

    const network: NetworkInfo = {
      name,
      key,
      active: true,
      createdAt: Date.now(),
      machineId: this.generateMachineId(),
    };

    // Deactivate other networks
    for (const n of this.networks) {
      n.active = false;
    }

    this.networks.push(network);
    this.activeNetwork = network;

    await this.save();

    return network;
  }

  /**
   * Join an existing network
   */
  async joinNetwork(name: string, key: string): Promise<NetworkInfo> {
    // Check if network already exists
    const existing = this.networks.find(n => n.name === name);

    if (existing) {
      // Update existing network
      existing.key = key;
      existing.active = true;
      existing.machineId = this.generateMachineId();

      // Deactivate other networks
      for (const n of this.networks) {
        if (n !== existing) {
          n.active = false;
        }
      }

      this.activeNetwork = existing;
    } else {
      // Add new network
      const network: NetworkInfo = {
        name,
        key,
        active: true,
        createdAt: Date.now(),
        machineId: this.generateMachineId(),
      };

      // Deactivate other networks
      for (const n of this.networks) {
        n.active = false;
      }

      this.networks.push(network);
      this.activeNetwork = network;
    }

    await this.save();

    return this.activeNetwork;
  }

  /**
   * Get active network
   */
  getActiveNetwork(): NetworkInfo | null {
    return this.activeNetwork;
  }

  /**
   * Get all networks
   */
  getAllNetworks(): NetworkInfo[] {
    return [...this.networks];
  }

  /**
   * Remove a network
   */
  async removeNetwork(name: string): Promise<boolean> {
    const index = this.networks.findIndex(n => n.name === name);

    if (index >= 0) {
      const wasActive = this.networks[index].active;
      this.networks.splice(index, 1);

      if (wasActive && this.networks.length > 0) {
        this.networks[0].active = true;
        this.activeNetwork = this.networks[0];
      } else {
        this.activeNetwork = null;
      }

      await this.save();
      return true;
    }

    return false;
  }

  /**
   * Verify network key
   */
  verifyKey(key: string): boolean {
    return /^[a-f0-9]{32}$/.test(key);
  }

  /**
   * Generate machine ID
   */
  private generateMachineId(): string {
    const hostname = os.hostname();
    const mac = this.getFirstMacAddress();
    const hash = crypto.createHash('sha256').update(hostname + mac).digest('hex');

    return `machine-${hash.substring(0, 12)}`;
  }

  /**
   * Get first MAC address
   */
  private getFirstMacAddress(): string {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (iface) {
        for (const config of iface) {
          if (!config.internal && config.mac && config.mac !== '00:00:00:00:00:00') {
            return config.mac;
          }
        }
      }
    }

    return '00:00:00:00:00:00';
  }

  /**
   * Parse networks from YAML
   */
  private parseNetworks(content: string): NetworkInfo[] {
    const lines = content.split('\n');
    const networks: NetworkInfo[] = [];
    let currentNetwork: any = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // New network entry
      if (trimmed.startsWith('- name:')) {
        currentNetwork = {
          name: this.parseValue(trimmed.slice(7).trim()),
        };
        networks.push(currentNetwork);
        continue;
      }

      // Network properties
      if (currentNetwork && trimmed.includes(':')) {
        const colonIndex = trimmed.indexOf(':');
        const key = trimmed.slice(0, colonIndex).trim();
        const value = trimmed.slice(colonIndex + 1).trim();
        currentNetwork[key] = this.parseValue(value);
        continue;
      }
    }

    return networks;
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
   * Stringify networks to YAML
   */
  private stringifyNetworks(): string {
    const lines: string[] = [];

    lines.push('# HuiNet Network Configuration');
    lines.push('# Networks are used for agent authentication and discovery');
    lines.push('');

    if (this.networks.length === 0) {
      lines.push('# No networks configured');
      lines.push('# Use: huinet network create <name>');
      lines.push('');
      return lines.join('\n');
    }

    for (const network of this.networks) {
      lines.push(`- name: "${network.name}"`);
      lines.push(`  key: "${network.key}"`);
      lines.push(`  active: ${network.active}`);

      if (network.machineId) {
        lines.push(`  machineId: "${network.machineId}"`);
      }

      if (network.createdAt) {
        lines.push(`  createdAt: ${network.createdAt}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}

/**
 * Create network manager
 */
export function createNetworkManager(): NetworkManager {
  return new NetworkManager();
}
