/**
 * Local Agent Directory — who is on this machine hub
 */

import { EventEmitter } from 'events';
import type { DiscoveredAgent } from '../inventory/types';

export interface ConnectedAgent {
  id: string;
  name: string;
  transport: 'ws' | 'mcp' | 'api';
  connectedAt: number;
  lastHeartbeat: number;
  metadata?: Record<string, unknown>;
}

export class AgentDirectory extends EventEmitter {
  private connected = new Map<string, ConnectedAgent>();
  private inventory: DiscoveredAgent[] = [];

  setInventory(agents: DiscoveredAgent[]): void {
    this.inventory = agents;
    this.emit('inventoryUpdated', agents);
  }

  getInventory(): DiscoveredAgent[] {
    return this.inventory.map((a) => ({
      ...a,
      connected: this.connected.has(a.id),
      presence: this.connected.has(a.id) ? 'connected' : a.presence,
    }));
  }

  register(agent: ConnectedAgent): void {
    const isNew = !this.connected.has(agent.id);
    this.connected.set(agent.id, agent);
    if (isNew) this.emit('agentJoined', agent);
    else this.emit('agentUpdated', agent);
  }

  unregister(agentId: string): void {
    if (this.connected.delete(agentId)) {
      this.emit('agentLeft', agentId);
    }
  }

  heartbeat(agentId: string): boolean {
    const a = this.connected.get(agentId);
    if (!a) return false;
    a.lastHeartbeat = Date.now();
    return true;
  }

  getConnected(): ConnectedAgent[] {
    return Array.from(this.connected.values());
  }

  get(agentId: string): ConnectedAgent | undefined {
    return this.connected.get(agentId);
  }

  listAll(): Array<DiscoveredAgent & { online: boolean }> {
    const onlineIds = new Set(this.connected.keys());
    const fromInv = this.getInventory().map((a) => ({
      ...a,
      online: onlineIds.has(a.id),
    }));

    // Include connected agents not in inventory
    for (const c of this.connected.values()) {
      if (!fromInv.find((a) => a.id === c.id)) {
        fromInv.push({
          id: c.id,
          name: c.name,
          presence: 'connected',
          capabilities: [],
          signals: ['hub'],
          scannedAt: c.connectedAt,
          connected: true,
          online: true,
        });
      }
    }
    return fromInv;
  }
}
