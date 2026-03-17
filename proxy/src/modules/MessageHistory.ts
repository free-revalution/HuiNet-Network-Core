/**
 * HuiNet Proxy Server - Message History Module
 */

export interface HistoryEntry {
  id: string;
  from: string;
  to?: string;
  data: unknown;
  timestamp: number;
  direction: 'inbound' | 'outbound';
}

export interface MessageHistoryConfig {
  maxEntries: number;
  maxAge: number; // milliseconds
}

export class MessageHistory {
  private entries: Map<string, HistoryEntry> = new Map();
  private config: MessageHistoryConfig;
  private orderedIds: string[] = []; // Maintain insertion order

  constructor(config: MessageHistoryConfig) {
    this.config = config;
  }

  /**
   * Add a message to history
   */
  add(entry: Omit<HistoryEntry, 'id'>): string {
    const id = this.generateId();
    const historyEntry: HistoryEntry = {
      ...entry,
      id,
    };

    this.entries.set(id, historyEntry);
    this.orderedIds.push(id);

    // Cleanup old entries
    this.cleanup();

    return id;
  }

  /**
   * Get messages with optional filters
   */
  query(filters?: {
    since?: number;
    before?: number;
    from?: string;
    to?: string;
    direction?: 'inbound' | 'outbound';
    limit?: number;
  }): HistoryEntry[] {
    let results = this.orderedIds
      .map(id => this.entries.get(id)!)
      .filter(entry => {
        // Timestamp filters
        if (filters?.since && entry.timestamp < filters.since) {
          return false;
        }
        if (filters?.before && entry.timestamp > filters.before) {
          return false;
        }
        // From filter
        if (filters?.from && entry.from !== filters.from) {
          return false;
        }
        // To filter
        if (filters?.to && entry.to !== filters.to) {
          return false;
        }
        // Direction filter
        if (filters?.direction && entry.direction !== filters.direction) {
          return false;
        }
        return true;
      });

    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp - a.timestamp);

    // Apply limit
    if (filters?.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Get a specific message by ID
   */
  get(id: string): HistoryEntry | undefined {
    return this.entries.get(id);
  }

  /**
   * Get all messages
   */
  getAll(): HistoryEntry[] {
    return this.orderedIds.map(id => this.entries.get(id)!);
  }

  /**
   * Clear all history
   */
  clear(): void {
    this.entries.clear();
    this.orderedIds = [];
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    inbound: number;
    outbound: number;
    oldest?: number;
    newest?: number;
  } {
    const entries = this.getAll();
    const inbound = entries.filter(e => e.direction === 'inbound').length;
    const outbound = entries.filter(e => e.direction === 'outbound').length;

    // orderedIds is in insertion order (oldest first)
    return {
      total: entries.length,
      inbound,
      outbound,
      oldest: entries.length > 0 ? entries[0].timestamp : undefined,
      newest: entries.length > 0 ? entries[entries.length - 1].timestamp : undefined,
    };
  }

  /**
   * Cleanup old entries
   */
  protected cleanup(): void {
    const now = Date.now();
    const maxAge = this.config.maxAge;
    const maxEntries = this.config.maxEntries;

    // Remove entries older than maxAge
    const validIds = this.orderedIds.filter(id => {
      const entry = this.entries.get(id);
      if (!entry) return false;
      return (now - entry.timestamp) <= maxAge;
    });

    // Keep only the most recent maxEntries
    if (validIds.length > maxEntries) {
      validIds.splice(maxEntries);
    }

    // Update state
    for (const id of this.orderedIds) {
      if (!validIds.includes(id)) {
        this.entries.delete(id);
      }
    }

    this.orderedIds = validIds;
  }

  /**
   * Generate unique message ID
   */
  private generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}
