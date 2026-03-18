/**
 * HuiNet Daemon
 *
 * Background service that manages agent communication.
 */

import { EventEmitter } from 'events';
import { HuiNet } from '../../src';
import { AgentProxyPool, type AgentProxyConfig } from './agent-proxy';
import { MessageRouter, type RouterConfig } from './router';
import type { AgentInfo } from '../types';

/**
 * Daemon configuration
 */
export interface DaemonConfig {
  /** HuiNet P2P configuration */
  huinet: {
    listenPort: number;
    enableMDNS: boolean;
    bootstrapNodes?: string[];
  };

  /** Agent proxy configuration */
  proxy: AgentProxyConfig;

  /** Router configuration */
  router: RouterConfig;
}

/**
 * HuiNet Daemon
 */
export class HuiNetDaemon extends EventEmitter {
  private huinet: HuiNet | null = null;
  private proxyPool: AgentProxyPool | null = null;
  private router: MessageRouter | null = null;
  private config: DaemonConfig;
  private running = false;

  constructor(config: DaemonConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the daemon
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    // Start HuiNet P2P node
    this.huinet = new HuiNet({
      listenPort: this.config.huinet.listenPort,
      enableMDNS: this.config.huinet.enableMDNS,
      bootstrapNodes: this.config.huinet.bootstrapNodes,
    });

    await this.huinet.start();

    // Create agent proxy pool
    this.proxyPool = new AgentProxyPool(this.config.proxy);

    // Create message router
    this.router = new MessageRouter(this.huinet, this.config.router);

    // Forward events
    this.proxyPool.on('agentConnected', (agentId: string) => {
      const proxy = this.proxyPool!.getProxy(agentId);
      if (proxy) {
        this.router!.registerAgentProxy(agentId, proxy);
      }
      this.emit('agentConnected', agentId);
    });

    this.proxyPool.on('agentDisconnected', (agentId: string) => {
      this.router!.unregisterAgentProxy(agentId);
      this.emit('agentDisconnected', agentId);
    });

    this.proxyPool.on('message', (agentId: string, request: any) => {
      this.emit('message', agentId, request);
    });

    this.router.on('agentConnected', (info: AgentInfo) => {
      this.emit('agentRegistered', info);
    });

    this.router.on('agentDisconnected', (agentId: string) => {
      this.emit('agentUnregistered', agentId);
    });

    this.running = true;
    this.emit('ready');
  }

  /**
   * Stop the daemon
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    // Stop router
    if (this.router) {
      this.router.destroy();
      this.router = null;
    }

    // Stop proxy pool
    if (this.proxyPool) {
      await this.proxyPool.stopAll();
      this.proxyPool = null;
    }

    // Stop HuiNet
    if (this.huinet) {
      await this.huinet.stop();
      this.huinet = null;
    }

    this.running = false;
    this.emit('stopped');
  }

  /**
   * Allocate a proxy for an agent
   */
  async allocateAgent(agentId: string): Promise<{ port: number; wsUrl: string }> {
    if (!this.proxyPool) {
      throw new Error('Daemon not running');
    }

    const proxy = await this.proxyPool.allocateProxy(agentId);
    const info = proxy.getInfo();

    return {
      port: info.proxyPort,
      wsUrl: info.wsUrl,
    };
  }

  /**
   * Release an agent proxy
   */
  async releaseAgent(agentId: string): Promise<void> {
    if (!this.proxyPool) {
      return;
    }

    await this.proxyPool.releaseProxy(agentId);
  }

  /**
   * Get all connected agents
   */
  getConnectedAgents(): AgentInfo[] {
    if (!this.proxyPool) {
      return [];
    }

    return this.proxyPool.getConnectedAgents();
  }

  /**
   * Get daemon status
   */
  getStatus(): {
    running: boolean;
    nodeID?: string;
    connectedAgents: number;
    peerCount: number;
  } {
    return {
      running: this.running,
      nodeID: this.huinet?.getNodeID(),
      connectedAgents: this.proxyPool?.getConnectedAgents().length || 0,
      peerCount: this.huinet?.getConnectedNodes().length || 0,
    };
  }

  /**
   * Get HuiNet instance (for advanced use)
   */
  getHuiNet(): HuiNet | null {
    return this.huinet;
  }
}

/**
 * Create a daemon with default configuration
 */
export function createDaemon(config?: Partial<DaemonConfig>): HuiNetDaemon {
  const defaultConfig: DaemonConfig = {
    huinet: {
      listenPort: 8000,
      enableMDNS: true,
    },
    proxy: {
      portRange: [8080, 9000],
      host: '127.0.0.1',
      messageTimeout: 30000,
    },
    router: {
      machineId: generateMachineId(),
      messageTimeout: 30000,
      maxRetries: 3,
    },
  };

  return new HuiNetDaemon(
    config ? mergeConfig(defaultConfig, config) : defaultConfig
  );
}

/**
 * Generate a unique machine ID
 */
function generateMachineId(): string {
  const os = require('os');
  const crypto = require('crypto');

  const hostname = os.hostname();
  const mac = getFirstMacAddress();

  const hash = crypto.createHash('sha256').update(hostname + mac).digest('hex');

  return `machine-${hash.substring(0, 12)}`;
}

/**
 * Get first MAC address
 */
function getFirstMacAddress(): string {
  const os = require('os');
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
 * Deep merge configuration
 */
function mergeConfig<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = mergeConfig(targetValue, sourceValue);
    } else {
      (result as any)[key] = sourceValue;
    }
  }

  return result;
}
