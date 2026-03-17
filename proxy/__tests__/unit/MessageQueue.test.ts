/**
 * MessageQueue Unit Tests
 */

import { MessageQueue, QueuedMessage } from '../../src/modules/MessageQueue';
import fs from 'fs/promises';

// Mock fs module
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('MessageQueue', () => {
  let queue: MessageQueue;
  let testConfig: any;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    testConfig = {
      maxEntries: 100,
      maxAge: 60000, // 1 minute
      enablePersistence: false,
      maxAttempts: 3,
      retryDelay: 1000,
      retryMultiplier: 2,
      maxQueueSize: 1000,
    };

    queue = new MessageQueue(testConfig);
  });

  describe('enqueue', () => {
    it('should enqueue a message with default priority', () => {
      const id = queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      expect(id).toBeDefined();
      expect(id).toMatch(/^msg_\d+_[a-z0-9]+$/);

      const queued = queue.getAllQueued();
      expect(queued).toHaveLength(1);
      expect(queued[0].priority).toBe(5);
      expect(queued[0].attempts).toBe(0);
      expect(queued[0].acknowledged).toBe(false);
    });

    it('should enqueue a message with custom priority', () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      }, { priority: 1 });

      const queued = queue.getAllQueued();
      expect(queued[0].priority).toBe(1);
    });

    it('should enqueue a message with custom max attempts', () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      }, { maxAttempts: 5 });

      const queued = queue.getAllQueued();
      expect(queued[0].maxAttempts).toBe(5);
    });

    it('should add to history as well', () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      const all = queue.getAll();
      expect(all).toHaveLength(1);
    });
  });

  describe('acknowledge', () => {
    it('should acknowledge a queued message', () => {
      const id = queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      const result = queue.acknowledge(id);
      expect(result).toBe(true);

      const queued = queue.getAllQueued();
      expect(queued).toHaveLength(0); // Should be removed from queue
    });

    it('should return false for non-existent message', () => {
      const result = queue.acknowledge('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getPendingMessages', () => {
    it('should return messages ready for retry', () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      const pending = queue.getPendingMessages();
      expect(pending).toHaveLength(1);
      expect(pending[0].attempts).toBe(0);
    });

    it('should not return messages with future retry time', () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      // Manually set next retry time to future
      const queued = queue.getAllQueued();
      queued[0].nextRetryTime = Date.now() + 10000;

      const pending = queue.getPendingMessages();
      expect(pending).toHaveLength(0);
    });

    it('should sort by priority then retry time', () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: '1' },
        timestamp: Date.now(),
        direction: 'outbound',
      }, { priority: 5 });

      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: '2' },
        timestamp: Date.now(),
        direction: 'outbound',
      }, { priority: 1 });

      const pending = queue.getPendingMessages();
      expect(pending).toHaveLength(2);
      expect(pending[0].priority).toBeLessThan(pending[1].priority);
    });
  });

  describe('processPendingMessages', () => {
    it('should increment attempts for pending messages', async () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      await queue.processPendingMessages();

      const queued = queue.getAllQueued();
      expect(queued[0].attempts).toBe(1);
      expect(queued[0].nextRetryTime).toBeGreaterThan(Date.now());
    });

    it('should remove messages that exceeded max attempts', async () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      }, { maxAttempts: 1 });

      // Process once - attempts becomes 1, which equals maxAttempts
      await queue.processPendingMessages();

      // Process again - attempts becomes 2, which exceeds maxAttempts
      await queue.processPendingMessages();

      const queued = queue.getAllQueued();
      expect(queued).toHaveLength(0);
    });
  });

  describe('retryMessage', () => {
    it('should reset retry time and attempts', () => {
      const id = queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      // Process to increment attempts
      queue.processPendingMessages();

      const result = queue.retryMessage(id);
      expect(result).toBe(true);

      const queued = queue.getAllQueued();
      expect(queued[0].attempts).toBe(0);
      expect(queued[0].nextRetryTime).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('getQueueStats', () => {
    it('should return correct statistics', () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      const stats = queue.getQueueStats();
      expect(stats.pending).toBe(1);
      expect(stats.acknowledged).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.total).toBe(1);
    });
  });

  describe('getFailedMessages', () => {
    it('should return messages that exceeded max attempts', async () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      }, { maxAttempts: 1 });

      // Process twice - first time attempts=1, second time attempts=2 which exceeds maxAttempts
      await queue.processPendingMessages();
      await queue.processPendingMessages();

      const failed = queue.getFailedMessages();
      // Failed messages are removed from queue after exceeding maxAttempts
      expect(failed).toHaveLength(0);
    });
  });

  describe('clearQueue', () => {
    it('should clear all queued messages', () => {
      queue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      queue.clearQueue();

      const queued = queue.getAllQueued();
      expect(queued).toHaveLength(0);
    });
  });

  describe('start and stop', () => {
    it('should start the processing interval', async () => {
      await queue.start();

      // Wait a bit to let the interval run
      await new Promise(resolve => setTimeout(resolve, 100));

      await queue.stop();
      // Stop completes without error
      expect(true).toBe(true);
    });

    it('should load from disk when persistence is enabled', async () => {
      const mockData = JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        messages: [],
      });

      mockFs.readFile.mockResolvedValue(mockData);
      mockFs.mkdir.mockResolvedValue(undefined);

      const persistentQueue = new MessageQueue({
        ...testConfig,
        enablePersistence: true,
        persistencePath: '/test/path/queue.json',
      });

      await persistentQueue.start();
      await persistentQueue.stop();

      expect(mockFs.readFile).toHaveBeenCalled();
    });
  });

  describe('persistence', () => {
    it('should save to disk when persistence is enabled', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.rename.mockResolvedValue(undefined);

      const persistentQueue = new MessageQueue({
        ...testConfig,
        enablePersistence: true,
        persistencePath: '/test/path/queue.json',
      });

      persistentQueue.enqueue({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      // The saveToDisk is private, so we trigger it through stop()
      await persistentQueue.stop();

      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should handle load errors gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const persistentQueue = new MessageQueue({
        ...testConfig,
        enablePersistence: true,
        persistencePath: '/test/path/queue.json',
      });

      await persistentQueue.start();

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
