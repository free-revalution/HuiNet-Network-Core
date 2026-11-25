/**
 * Daemon compatibility layer — delegates to LocalHub
 *
 * Prefer `huinet start` / createLocalHub() for new code.
 */

import { EventEmitter } from 'events';
import {
  createLocalHub,
  type LocalHub,
  type LocalHubStatus,
} from '../../src/hub';
import type { AgentInfo } from '../types';

export interface DaemonConfig {
  httpPort?: number;
  wsPort?: number;
  host?: string;
  /** @deprecated Ignored — P2P removed from local hub */
  huinet?: {
    listenPort?: number;
    enableMDNS?: boolean;
    bootstrapNodes?: string[];
  };
  proxy?: unknown;
  router?: unknown;
}

export class HuiNetDaemon extends EventEmitter {
  private hub: LocalHub;
  private running = false;

  constructor(config?: Partial<DaemonConfig>) {
    super();
    this.hub = createLocalHub({
      config: {
        httpPort: config?.httpPort ?? config?.huinet?.listenPort ?? 19527,
        wsPort: config?.wsPort ?? 19528,
        host: config?.host ?? '127.0.0.1',
      },
    });
  }

  async start(): Promise<void> {
    if (this.running) return;
    await this.hub.start();
    this.running = true;
    this.emit('ready');
  }

  async stop(): Promise<void> {
    if (!this.running) return;
    await this.hub.stop();
    this.running = false;
    this.emit('stopped');
  }

  async allocateAgent(
    agentId: string
  ): Promise<{ port: number; wsUrl: string }> {
    const status = this.hub.getStatus();
    // Local hub uses a shared WS port; agents register with a2a.register
    return {
      port: this.hub.getConfig().wsPort,
      wsUrl: status.wsUrl + `?agent=${encodeURIComponent(agentId)}`,
    };
  }

  async releaseAgent(agentId: string): Promise<void> {
    this.hub.getDirectory().unregister(agentId);
  }

  getConnectedAgents(): AgentInfo[] {
    return this.hub.getDirectory().getConnected().map((a) => ({
      id: a.id,
      name: a.name,
      wsUrl: this.hub.getStatus().wsUrl,
      proxyPort: this.hub.getConfig().wsPort,
      registeredAt: a.connectedAt,
      lastHeartbeat: a.lastHeartbeat,
    }));
  }

  getStatus(): LocalHubStatus & { nodeID?: string; peerCount: number } {
    const s = this.hub.getStatus();
    return { ...s, nodeID: 'local', peerCount: 0 };
  }

  getHuiNet(): null {
    return null;
  }

  getHub(): LocalHub {
    return this.hub;
  }
}

export function createDaemon(config?: Partial<DaemonConfig>): HuiNetDaemon {
  return new HuiNetDaemon(config);
}

export { createLocalHub } from '../../src/hub';
