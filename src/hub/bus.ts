/**
 * Local A2A message bus (same-machine only)
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import type { HuiNetPaths } from '../paths';
import type { AgentDirectory } from './directory';

export interface BusMessage {
  id: string;
  from: string;
  to: string; // agentId or '*'
  type: string;
  payload: unknown;
  timestamp: number;
}

export class MessageBus extends EventEmitter {
  private recent: BusMessage[] = [];
  private maxRecent = 200;
  private paths?: HuiNetPaths;

  constructor(directory: AgentDirectory, paths?: HuiNetPaths) {
    super();
    this.paths = paths;
    // keep directory ref for validation
    void directory;
  }

  publish(msg: Omit<BusMessage, 'id' | 'timestamp'> & { id?: string }): BusMessage {
    const full: BusMessage = {
      id: msg.id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: msg.from,
      to: msg.to,
      type: msg.type,
      payload: msg.payload,
      timestamp: Date.now(),
    };

    this.recent.unshift(full);
    if (this.recent.length > this.maxRecent) {
      this.recent.length = this.maxRecent;
    }

    this.appendLog(full);
    this.emit('message', full);

    if (full.to === '*') {
      this.emit('broadcast', full);
    } else {
      this.emit(`message:${full.to}`, full);
    }

    return full;
  }

  getRecent(limit = 50): BusMessage[] {
    return this.recent.slice(0, limit);
  }

  private appendLog(msg: BusMessage): void {
    if (!this.paths) return;
    try {
      fs.appendFileSync(
        this.paths.busLog,
        JSON.stringify(msg) + '\n',
        'utf-8'
      );
    } catch {
      // ignore
    }
  }
}
