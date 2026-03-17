/**
 * HuiNet Proxy Server - Persistent Message Queue
 *
 * Provides a persistent message queue that survives restarts
 * and supports reliable message delivery with acknowledgments.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { MessageHistory, HistoryEntry, MessageHistoryConfig } from './MessageHistory';

export interface QueuedMessage extends HistoryEntry {
  attempts: number;
  maxAttempts: number;
  nextRetryTime: number;
  acknowledged: boolean;
  priority: number; // 0 = highest, 9 = lowest
}

export interface MessageQueueConfig extends MessageHistoryConfig {
  persistencePath?: string; // Path to store queued messages
  enablePersistence: boolean;
  maxAttempts: number;
  retryDelay: number; // Base retry delay in milliseconds
  retryMultiplier: number; // Exponential backoff multiplier
  maxQueueSize: number; // Maximum messages in queue
}

export interface EnqueueOptions {
  priority?: number;
  maxAttempts?: number;
}

export class MessageQueue extends MessageHistory {
  private queueConfig: MessageQueueConfig;
  private queuedMessages: Map<string, QueuedMessage> = new Map();
  private persistencePath: string;
  private enablePersistence: boolean;
  private processingInterval?: NodeJS.Timeout;
  private isProcessing = false;
  private isStopped = false;

  constructor(config: MessageQueueConfig) {
    super(config);
    this.queueConfig = {
      maxEntries: config.maxEntries,
      maxAge: config.maxAge,
      enablePersistence: config.enablePersistence ?? false,
      persistencePath: config.persistencePath ?? './data/queue',
      maxAttempts: config.maxAttempts ?? 3,
      retryDelay: config.retryDelay ?? 1000,
      retryMultiplier: config.retryMultiplier ?? 2,
      maxQueueSize: config.maxQueueSize ?? 10000,
    };
    this.enablePersistence = this.queueConfig.enablePersistence;
    this.persistencePath = this.queueConfig.persistencePath!;
  }

  /**
   * Start the queue processor
   */
  async start(): Promise<void> {
    this.isStopped = false;

    if (this.enablePersistence) {
      await this.loadFromDisk();
    }

    // Start processing interval (every 5 seconds)
    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing && !this.isStopped) {
        await this.processPendingMessages();
      }
    }, 5000);

    this.log('info', 'Message queue started');
  }

  /**
   * Stop the queue processor
   */
  async stop(): Promise<void> {
    this.isStopped = true;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    if (this.enablePersistence) {
      await this.saveToDisk();
    }

    this.log('info', 'Message queue stopped');
  }

  /**
   * Enqueue a message for delivery
   */
  enqueue(
    entry: Omit<HistoryEntry, 'id'>,
    options: EnqueueOptions = {}
  ): string {
    const id = super.add(entry);

    // Create queued message
    const queued: QueuedMessage = {
      ...this.get(id)!,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? this.queueConfig.maxAttempts,
      nextRetryTime: Date.now(),
      acknowledged: false,
      priority: options.priority ?? 5,
    };

    this.queuedMessages.set(id, queued);

    this.log('debug', `Message enqueued: ${id}`);

    return id;
  }

  /**
   * Acknowledge a message as delivered
   */
  acknowledge(messageId: string): boolean {
    const queued = this.queuedMessages.get(messageId);
    if (!queued) {
      return false;
    }

    queued.acknowledged = true;
    this.queuedMessages.delete(messageId);
    this.log('debug', `Message acknowledged: ${messageId}`);

    return true;
  }

  /**
   * Get pending messages (not yet acknowledged)
   */
  getPendingMessages(): QueuedMessage[] {
    const now = Date.now();
    return Array.from(this.queuedMessages.values())
      .filter(msg => !msg.acknowledged && msg.nextRetryTime <= now)
      .sort((a, b) => {
        // Sort by priority first, then by next retry time
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.nextRetryTime - b.nextRetryTime;
      });
  }

  /**
   * Get all queued messages
   */
  getAllQueued(): QueuedMessage[] {
    return Array.from(this.queuedMessages.values());
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    pending: number;
    acknowledged: number;
    failed: number;
    total: number;
  } {
    const all = this.getAllQueued();
    return {
      pending: all.filter(m => !m.acknowledged && m.attempts < m.maxAttempts).length,
      acknowledged: all.filter(m => m.acknowledged).length,
      failed: all.filter(m => !m.acknowledged && m.attempts >= m.maxAttempts).length,
      total: all.length,
    };
  }

  /**
   * Process pending messages
   * This should be called by the message delivery system
   */
  async processPendingMessages(): Promise<void> {
    if (this.isStopped) {
      return;
    }

    this.isProcessing = true;

    try {
      // Get all queued messages (not just pending)
      const allMessages = Array.from(this.queuedMessages.values());
      const now = Date.now();

      for (const message of allMessages) {
        // Skip if already acknowledged
        if (message.acknowledged) {
          continue;
        }

        // Check if max attempts already reached BEFORE processing
        if (message.attempts >= message.maxAttempts) {
          // Max attempts reached, mark as failed and remove from queue
          this.queuedMessages.delete(message.id);
          this.log('warn', `Message failed after ${message.attempts} attempts: ${message.id}`);
          continue;
        }

        // Skip if not ready for retry (only if this isn't the first attempt)
        if (message.attempts > 0 && message.nextRetryTime > now) {
          continue;
        }

        // Increment attempts
        message.attempts++;

        // Check if max attempts exceeded AFTER incrementing
        if (message.attempts > message.maxAttempts) {
          // Max attempts exceeded, mark as failed and remove from queue
          this.queuedMessages.delete(message.id);
          this.log('warn', `Message failed after ${message.attempts - 1} attempts: ${message.id}`);
          continue;
        }

        // Calculate next retry time with exponential backoff
        const delay = this.queueConfig.retryDelay *
          Math.pow(this.queueConfig.retryMultiplier, message.attempts - 1);
        message.nextRetryTime = now + delay;

        // Update in map
        this.queuedMessages.set(message.id, message);

        this.log('debug', `Processing message ${message.id}, attempt ${message.attempts}`);
      }

      // Persist after processing
      if (this.enablePersistence) {
        await this.saveToDisk();
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Retry a specific message
   */
  retryMessage(messageId: string): boolean {
    const queued = this.queuedMessages.get(messageId);
    if (!queued) {
      return false;
    }

    queued.nextRetryTime = Date.now();
    queued.attempts = 0;

    this.log('debug', `Message retry scheduled: ${messageId}`);
    return true;
  }

  /**
   * Clear all queued messages
   */
  clearQueue(): void {
    this.queuedMessages.clear();
    this.log('info', 'Queue cleared');
  }

  /**
   * Save queue to disk
   */
  private async saveToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this.persistencePath);
      await fs.mkdir(dir, { recursive: true });

      const data = {
        version: 1,
        timestamp: Date.now(),
        messages: Array.from(this.queuedMessages.entries()),
      };

      const tempPath = `${this.persistencePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
      await fs.rename(tempPath, this.persistencePath);

      this.log('debug', `Queue saved to disk: ${this.queuedMessages.size} messages`);
    } catch (error) {
      this.log('error', `Failed to save queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load queue from disk
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf-8');
      const parsed = JSON.parse(data);

      if (parsed.version === 1 && Array.isArray(parsed.messages)) {
        this.queuedMessages = new Map(parsed.messages);
        this.log('info', `Queue loaded from disk: ${this.queuedMessages.size} messages`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.log('error', `Failed to load queue: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      // Start fresh if file doesn't exist
    }
  }

  /**
   * Get failed messages (for manual inspection)
   */
  getFailedMessages(): QueuedMessage[] {
    return this.getAllQueued().filter(
      m => !m.acknowledged && m.attempts >= m.maxAttempts
    );
  }

  /**
   * Clean up old messages (called automatically by base class)
   */
  cleanup(): void {
    super.cleanup();

    // Also clean up queued messages
    const now = Date.now();
    const maxAge = this.queueConfig.maxAge;

    for (const [id, message] of this.queuedMessages) {
      const isOld = (now - message.timestamp) > maxAge;
      const isFailed = !message.acknowledged && message.attempts >= message.maxAttempts;
      const isAcknowledged = message.acknowledged;

      if (isOld || isFailed || isAcknowledged) {
        this.queuedMessages.delete(id);
      }
    }

    // Enforce max queue size (keep newest messages)
    const all = Array.from(this.queuedMessages.entries());
    if (all.length > this.queueConfig.maxQueueSize) {
      // Sort by timestamp (oldest first)
      all.sort((a, b) => a[1].timestamp - b[1].timestamp);

      // Remove oldest messages
      const toRemove = all.slice(0, all.length - this.queueConfig.maxQueueSize);
      for (const [id] of toRemove) {
        this.queuedMessages.delete(id);
      }
    }
  }

  /**
   * Log message based on log level
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [MessageQueue] [${level.toUpperCase()}] ${message}`);
  }
}
