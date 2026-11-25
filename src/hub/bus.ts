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
  /** Approximate LLM tokens for this hop (explicit or estimated from payload). */
  tokens: number;
  timestamp: number;
}

export function estimateTokens(payload: unknown, explicit?: number): number {
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 0) {
    return Math.floor(explicit);
  }
  const text =
    typeof payload === 'string'
      ? payload
      : payload && typeof payload === 'object' && 'text' in (payload as object)
        ? String((payload as { text: unknown }).text ?? '')
        : JSON.stringify(payload ?? '');
  // Rough chars→tokens heuristic until agents report real usage
  return Math.max(1, Math.ceil(text.length / 4));
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

  publish(
    msg: Omit<BusMessage, 'id' | 'timestamp' | 'tokens'> & {
      id?: string;
      tokens?: number;
    }
  ): BusMessage {
    const full: BusMessage = {
      id: msg.id ?? `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: msg.from,
      to: msg.to,
      type: msg.type,
      payload: msg.payload,
      tokens: estimateTokens(msg.payload, msg.tokens),
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
