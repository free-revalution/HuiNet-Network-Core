/**
 * Per-agent mailbox — durable inbox for MCP clients that cannot receive WS push.
 */

import * as fs from 'fs';
import type { HuiNetPaths } from '../paths';
import type { BusMessage } from './bus';

export interface MailItem {
  id: string;
  agentId: string;
  message: BusMessage;
  read: boolean;
  deliveredAt: number;
}

interface MailboxState {
  items: MailItem[];
}

const MAX_PER_AGENT = 100;
const MAX_TOTAL = 500;

function mailboxPath(paths: HuiNetPaths): string {
  return `${paths.root}/mailbox.json`;
}

function load(paths: HuiNetPaths): MailboxState {
  try {
    const raw = fs.readFileSync(mailboxPath(paths), 'utf-8');
    const parsed = JSON.parse(raw) as MailboxState;
    if (Array.isArray(parsed.items)) return parsed;
  } catch {
    // ignore
  }
  return { items: [] };
}

function save(state: MailboxState, paths: HuiNetPaths): void {
  fs.mkdirSync(paths.root, { recursive: true });
  fs.writeFileSync(mailboxPath(paths), JSON.stringify(state, null, 2), 'utf-8');
}

export class Mailbox {
  constructor(private paths: HuiNetPaths) {}

  deposit(msg: BusMessage, recipientIds: string[]): MailItem[] {
    if (!recipientIds.length) return [];
    const state = load(this.paths);
    const created: MailItem[] = [];
    const now = Date.now();

    for (const agentId of recipientIds) {
      if (agentId === msg.from) continue;
      const item: MailItem = {
        id: `mail-${now}-${Math.random().toString(36).slice(2, 8)}`,
        agentId,
        message: msg,
        read: false,
        deliveredAt: now,
      };
      state.items.unshift(item);
      created.push(item);
    }

    // Cap per agent + total
    const byAgent = new Map<string, number>();
    state.items = state.items.filter((item) => {
      const n = byAgent.get(item.agentId) || 0;
      if (n >= MAX_PER_AGENT) return false;
      byAgent.set(item.agentId, n + 1);
      return true;
    });
    if (state.items.length > MAX_TOTAL) {
      state.items.length = MAX_TOTAL;
    }

    save(state, this.paths);
    return created;
  }

  list(
    agentId: string,
    options?: { unreadOnly?: boolean; limit?: number }
  ): MailItem[] {
    const state = load(this.paths);
    const limit = options?.limit ?? 50;
    return state.items
      .filter((i) => i.agentId === agentId)
      .filter((i) => (options?.unreadOnly ? !i.read : true))
      .slice(0, limit);
  }

  unreadCount(agentId?: string): number {
    const state = load(this.paths);
    return state.items.filter(
      (i) => !i.read && (agentId ? i.agentId === agentId : true)
    ).length;
  }

  markRead(ids: string[], agentId?: string): number {
    const state = load(this.paths);
    let n = 0;
    for (const item of state.items) {
      if (!ids.includes(item.id)) continue;
      if (agentId && item.agentId !== agentId) continue;
      if (!item.read) {
        item.read = true;
        n++;
      }
    }
    save(state, this.paths);
    return n;
  }

  markAllRead(agentId: string): number {
    const state = load(this.paths);
    let n = 0;
    for (const item of state.items) {
      if (item.agentId !== agentId || item.read) continue;
      item.read = true;
      n++;
    }
    save(state, this.paths);
    return n;
  }
}

export function createMailbox(paths: HuiNetPaths): Mailbox {
  return new Mailbox(paths);
}
