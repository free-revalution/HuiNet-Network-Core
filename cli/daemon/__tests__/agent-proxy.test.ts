/**
 * Tests for Agent Proxy
 */

import { WebSocket } from 'ws';
import { AgentProxy, AgentProxyPool } from '../agent-proxy';
import type { AgentProxyConfig } from '../../types';

describe('AgentProxy', () => {
  let proxy: AgentProxy;
  const testAgentId = 'test-agent-1';
  const testPort = 18180;

  beforeEach(() => {
    proxy = new AgentProxy(testAgentId, testPort);
  });

  afterEach(async () => {
    if (proxy) {
      await proxy.stop();
    }
  });

  describe('start and stop', () => {
    it('should start WebSocket server', async () => {
      await proxy.start();

      expect(proxy.isConnected()).toBe(false);
      expect(proxy.getInfo().proxyPort).toBe(testPort);
    });

    it('should stop WebSocket server', async () => {
      await proxy.start();
      await proxy.stop();

      expect(proxy.isConnected()).toBe(false);
    });

    it('should handle port in use', async () => {
      await proxy.start();

      const proxy2 = new AgentProxy('test-agent-2', testPort);

      await expect(proxy2.start()).rejects.toThrow();
      await proxy2.stop();
    });
  });

  describe('getInfo', () => {
    it('should return agent information', async () => {
      await proxy.start();

      const info = proxy.getInfo();

      expect(info.id).toBe(testAgentId);
      expect(info.name).toBe(testAgentId);
      expect(info.proxyPort).toBe(testPort);
      expect(info.wsUrl).toBe(`ws://127.0.0.1:${testPort}`);
      expect(info.registeredAt).toBeGreaterThan(0);
    });
  });

  describe('connection handling', () => {
    it('should accept WebSocket connection', async () => {
      await proxy.start();

      const ws = new WebSocket(`ws://127.0.0.1:${testPort}`);

      // Wait for both WebSocket open and agentConnected event
      const [socketOpen, agentConnected] = await Promise.all([
        new Promise<void>((resolve) => ws.once('open', () => resolve())),
        new Promise<void>((resolve) => proxy.once('agentConnected', () => resolve())),
      ]);

      expect(proxy.isConnected()).toBe(true);

      // Clean up
      await new Promise<void>((resolve) => {
        ws.once('close', () => resolve());
        ws.close();
      });
    });

    it('should reject second connection', async () => {
      await proxy.start();

      const ws1 = new WebSocket(`ws://127.0.0.1:${testPort}`);

      await new Promise((resolve) => ws1.once('open', resolve));

      const ws2 = new WebSocket(`ws://127.0.0.1:${testPort}`);

      const closeCode = await new Promise<number>((resolve) => {
        ws2.once('close', (code) => resolve(code));
      });

      expect(closeCode).toBe(1008); // Policy violation

      ws1.close();
    });

    it('should emit agentDisconnected on close', async () => {
      await proxy.start();

      const ws = new WebSocket(`ws://127.0.0.1:${testPort}`);

      await new Promise((resolve) => ws.once('open', resolve));

      const disconnectPromise = new Promise<string>((resolve) => {
        proxy.once('agentDisconnected', (id) => resolve(id));
      });

      ws.close();

      const disconnectedId = await disconnectPromise;

      expect(disconnectedId).toBe(testAgentId);
      expect(proxy.isConnected()).toBe(false);
    });
  });

  describe('message handling', () => {
    it('should emit message event on incoming message', async () => {
      await proxy.start();

      const ws = new WebSocket(`ws://127.0.0.1:${testPort}`);

      await new Promise((resolve) => ws.once('open', resolve));

      const messagePromise = new Promise<any>((resolve) => {
        proxy.once('message', (_id, request) => resolve(request));
      });

      ws.send(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'test.method',
          params: { foo: 'bar' },
          id: 1,
        })
      );

      const request = await messagePromise;

      expect(request.method).toBe('test.method');
      expect(request.params).toEqual({ foo: 'bar' });
      expect(request.id).toBe(1);

      ws.close();
    });
  });
});

describe('AgentProxyPool', () => {
  let pool: AgentProxyPool;
  const config: AgentProxyConfig = {
    portRange: [18190, 18200],
    host: '127.0.0.1',
    messageTimeout: 30000,
  };

  beforeEach(() => {
    pool = new AgentProxyPool(config);
  });

  afterEach(async () => {
    await pool.stopAll();
  });

  describe('allocateProxy', () => {
    it('should allocate proxy for agent', async () => {
      const proxy = await pool.allocateProxy('agent-1');

      expect(proxy).toBeDefined();
      expect(proxy.getInfo().id).toBe('agent-1');
      expect(proxy.getInfo().proxyPort).toBeGreaterThanOrEqual(config.portRange[0]);
      expect(proxy.getInfo().proxyPort).toBeLessThanOrEqual(config.portRange[1]);
    });

    it('should return existing proxy for same agent', async () => {
      const proxy1 = await pool.allocateProxy('agent-1');
      const proxy2 = await pool.allocateProxy('agent-1');

      expect(proxy1).toBe(proxy2);
    });

    it('should allocate different ports for different agents', async () => {
      const proxy1 = await pool.allocateProxy('agent-1');
      const proxy2 = await pool.allocateProxy('agent-2');

      expect(proxy1.getInfo().proxyPort).not.toBe(proxy2.getInfo().proxyPort);
    });
  });

  describe('getProxy', () => {
    it('should return allocated proxy', async () => {
      await pool.allocateProxy('agent-1');

      const proxy = pool.getProxy('agent-1');

      expect(proxy).toBeDefined();
      expect(proxy?.getInfo().id).toBe('agent-1');
    });

    it('should return undefined for non-existent agent', () => {
      const proxy = pool.getProxy('non-existent');

      expect(proxy).toBeUndefined();
    });
  });

  describe('getConnectedAgents', () => {
    it('should return empty list initially', () => {
      const agents = pool.getConnectedAgents();

      expect(agents).toEqual([]);
    });

    it('should return connected agents', async () => {
      const proxy = await pool.allocateProxy('agent-1');
      await proxy.start();

      // Note: Without actual WebSocket connection, this won't show as connected
      const agents = pool.getConnectedAgents();

      expect(agents.length).toBe(0);
    });
  });

  describe('releaseProxy', () => {
    it('should release allocated proxy', async () => {
      await pool.allocateProxy('agent-1');

      await pool.releaseProxy('agent-1');

      const proxy = pool.getProxy('agent-1');

      expect(proxy).toBeUndefined();
    });

    it('should handle releasing non-existent proxy', async () => {
      await expect(pool.releaseProxy('non-existent')).resolves.not.toThrow();
    });
  });

  describe('stopAll', () => {
    it('should stop all proxies', async () => {
      await pool.allocateProxy('agent-1');
      await pool.allocateProxy('agent-2');

      await pool.stopAll();

      expect(pool.getProxy('agent-1')).toBeUndefined();
      expect(pool.getProxy('agent-2')).toBeUndefined();
    });
  });
});
