/**
 * Unit Tests - MessageHistory
 */

import { MessageHistory } from '../../src/modules/MessageHistory';

describe('MessageHistory', () => {
  let history: MessageHistory;

  beforeEach(() => {
    history = new MessageHistory({
      maxEntries: 100,
      maxAge: 60000, // 1 minute
    });
  });

  describe('adding messages', () => {
    it('should add message and return ID', () => {
      const id = history.add({
        from: 'node1',
        to: 'node2',
        data: { test: 'data' },
        timestamp: Date.now(),
        direction: 'outbound',
      });

      expect(id).toMatch(/^msg_/);
      expect(history.getAll()).toHaveLength(1);
    });

    it('should store message correctly', () => {
      const now = Date.now();
      const entry = {
        from: 'node1',
        to: 'node2',
        data: { hello: 'world' },
        timestamp: now,
        direction: 'outbound' as const,
      };

      const id = history.add(entry);

      const retrieved = history.get(id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.from).toBe('node1');
      expect(retrieved?.to).toBe('node2');
      expect(retrieved?.data).toEqual({ hello: 'world' });
    });
  });

  describe('querying messages', () => {
    beforeEach(() => {
      const now = Date.now();
      // Add some test messages
      history.add({
        from: 'node1',
        to: 'node2',
        data: { msg: 1 },
        timestamp: now - 5000,
        direction: 'outbound',
      });
      history.add({
        from: 'node2',
        data: { msg: 2 },
        timestamp: now - 4000,
        direction: 'inbound',
      });
      history.add({
        from: 'node1',
        to: 'node3',
        data: { msg: 3 },
        timestamp: now - 3000,
        direction: 'outbound',
      });
    });

    it('should return all messages when no filters', () => {
      const results = history.query();
      expect(results).toHaveLength(3);
    });

    it('should filter by "since" timestamp', () => {
      const now = Date.now();
      const results = history.query({ since: now - 3500 });
      expect(results).toHaveLength(1); // Only msg 3
    });

    it('should filter by "before" timestamp', () => {
      const now = Date.now();
      const results = history.query({ before: now - 4500 });
      expect(results).toHaveLength(1); // Only msg 1
    });

    it('should filter by "from"', () => {
      const results = history.query({ from: 'node1' });
      expect(results).toHaveLength(2);
    });

    it('should filter by "to"', () => {
      const results = history.query({ to: 'node2' });
      expect(results).toHaveLength(1);
    });

    it('should filter by "direction"', () => {
      const results = history.query({ direction: 'inbound' });
      expect(results).toHaveLength(1);
    });

    it('should apply limit', () => {
      const results = history.query({ limit: 2 });
      expect(results).toHaveLength(2);
    });

    it('should combine multiple filters', () => {
      const results = history.query({
        from: 'node1',
        direction: 'outbound',
      });
      expect(results).toHaveLength(2);
    });

    it('should sort by timestamp newest first', () => {
      const results = history.query();
      expect(results[0].timestamp).toBeGreaterThan(results[1].timestamp);
      expect(results[1].timestamp).toBeGreaterThan(results[2].timestamp);
    });
  });

  describe('cleanup', () => {
    it('should remove old entries based on maxAge', () => {
      const now = Date.now();
      const oldHistory = new MessageHistory({
        maxEntries: 100,
        maxAge: 5000, // 5 seconds
      });

      // Add old message
      oldHistory.add({
        from: 'node1',
        data: { old: true },
        timestamp: now - 10000, // 10 seconds ago
        direction: 'inbound',
      });

      // Add recent message
      oldHistory.add({
        from: 'node2',
        data: { new: true },
        timestamp: now - 1000, // 1 second ago
        direction: 'inbound',
      });

      // Trigger cleanup by adding another message
      oldHistory.add({
        from: 'node3',
        data: { trigger: true },
        timestamp: now,
        direction: 'inbound',
      });

      const results = oldHistory.getAll();
      expect(results.length).toBeLessThanOrEqual(2);
      expect(results.every(e => e.timestamp >= now - 5000)).toBe(true);
    });

    it('should limit entries by maxEntries', () => {
      const smallHistory = new MessageHistory({
        maxEntries: 3,
        maxAge: 60000,
      });

      // Add 5 messages
      for (let i = 0; i < 5; i++) {
        smallHistory.add({
          from: `node${i}`,
          data: { index: i },
          timestamp: Date.now() + i,
          direction: 'inbound',
        });
      }

      expect(smallHistory.getAll().length).toBe(3);
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      history.add({
        from: 'node1',
        data: {},
        timestamp: Date.now() - 3000,
        direction: 'inbound',
      });
      history.add({
        from: 'node2',
        to: 'node3',
        data: {},
        timestamp: Date.now() - 2000,
        direction: 'outbound',
      });
      history.add({
        from: 'node3',
        data: {},
        timestamp: Date.now() - 1000,
        direction: 'inbound',
      });
    });

    it('should calculate correct stats', () => {
      const stats = history.getStats();

      expect(stats.total).toBe(3);
      expect(stats.inbound).toBe(2);
      expect(stats.outbound).toBe(1);
      expect(stats.oldest).toBeDefined();
      expect(stats.newest).toBeDefined();
      expect(stats.newest).toBeGreaterThan(stats.oldest!);
    });
  });

  describe('clear', () => {
    it('should clear all messages', () => {
      history.add({
        from: 'node1',
        data: {},
        timestamp: Date.now(),
        direction: 'inbound',
      });

      expect(history.getAll().length).toBeGreaterThan(0);

      history.clear();

      expect(history.getAll()).toHaveLength(0);
    });
  });
});
