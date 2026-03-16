import { ConnectionPool, ConnectionType, ConnectionState } from '../pool';
import { NodeState } from '../../types/connection';

describe('ConnectionPool', () => {
  let pool: ConnectionPool;

  beforeEach(() => {
    pool = new ConnectionPool({
      maxCoreConnections: 3,
      maxActiveConnections: 10,
    });
  });

  afterEach(async () => {
    await pool.disconnectAll();
  });

  describe('addConnection', () => {
    it('should add a new connection', async () => {
      const mockConnection = {
        nodeID: 'Node1',
        send: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
      };

      await pool.addConnection('Node1', mockConnection as any, ConnectionType.CORE);

      expect(pool.hasConnection('Node1')).toBe(true);
    });

    it('should enforce max connections limit', async () => {
      const pool = new ConnectionPool({
        maxCoreConnections: 2,
        maxActiveConnections: 5,
      });

      // Add max core connections
      for (let i = 0; i < 2; i++) {
        const mockConn = {
          nodeID: `Core${i}`,
          send: jest.fn().mockResolvedValue(undefined),
          close: jest.fn().mockResolvedValue(undefined),
          isConnected: jest.fn().mockReturnValue(true),
        };
        await pool.addConnection(`Core${i}`, mockConn as any, ConnectionType.CORE);
      }

      // Try to add one more - should use LRU eviction
      const mockConn3 = {
        nodeID: 'Core3',
        send: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
      };

      await pool.addConnection('Core3', mockConn3 as any, ConnectionType.CORE);

      // Should have evicted least recently used
      expect(pool.getCoreConnectionCount()).toBeLessThanOrEqual(2);
    });
  });

  describe('getConnection', () => {
    it('should return existing connection', async () => {
      const mockConnection = {
        nodeID: 'Node1',
        send: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
      };

      await pool.addConnection('Node1', mockConnection as any, ConnectionType.CORE);

      const retrieved = pool.getConnection('Node1');
      expect(retrieved).toBe(mockConnection);
    });

    it('should return undefined for non-existent connection', () => {
      expect(pool.getConnection('NonExistent')).toBeUndefined();
    });
  });

  describe('removeConnection', () => {
    it('should remove connection', async () => {
      const mockConnection = {
        nodeID: 'Node1',
        send: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
      };

      await pool.addConnection('Node1', mockConnection as any, ConnectionType.CORE);
      expect(pool.hasConnection('Node1')).toBe(true);

      await pool.removeConnection('Node1');
      expect(pool.hasConnection('Node1')).toBe(false);
    });
  });

  describe('send', () => {
    it('should send message through existing connection', async () => {
      const mockConnection = {
        nodeID: 'Node1',
        send: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        isConnected: jest.fn().mockReturnValue(true),
      };

      await pool.addConnection('Node1', mockConnection as any, ConnectionType.CORE);

      const message = { type: 'test', data: 'hello' };
      await pool.send('Node1', message);

      expect(mockConnection.send).toHaveBeenCalledWith(message);
    });

    it('should throw error if no connection exists', async () => {
      await expect(pool.send('NonExistent', {})).rejects.toThrow();
    });
  });
});
