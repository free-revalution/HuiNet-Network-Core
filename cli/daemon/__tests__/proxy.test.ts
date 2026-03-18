/**
 * Tests for HTTP Proxy Pool
 * TDD: Tests written before implementation
 */

import { HTTPProxyPool } from '../proxy';
import * as http from 'http';

describe('HTTPProxyPool', () => {
  let proxyPool: HTTPProxyPool;

  beforeEach(() => {
    proxyPool = new HTTPProxyPool({
      portRange: [8080, 8090],
    });
  });

  afterEach(async () => {
    await proxyPool.closeAll();
  });

  describe('constructor', () => {
    it('should create pool with port range', () => {
      const pool = new HTTPProxyPool({
        portRange: [9000, 9100],
      });
      expect(pool).toBeDefined();
      const stats = pool.getStats();
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
    });

    it('should initialize with empty proxy map', () => {
      const stats = proxyPool.getStats();
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
    });
  });

  describe('allocate', () => {
    it('should allocate first available port in range', async () => {
      const port = await proxyPool.allocate('agent-1');
      expect(port).toBeGreaterThanOrEqual(8080);
      expect(port).toBeLessThanOrEqual(8090);
    });

    it('should allocate sequential ports for multiple agents', async () => {
      const port1 = await proxyPool.allocate('agent-1');
      const port2 = await proxyPool.allocate('agent-2');
      const port3 = await proxyPool.allocate('agent-3');

      expect(port2).toBe(port1 + 1);
      expect(port3).toBe(port2 + 1);
    });

    it('should reuse existing port for same agent ID', async () => {
      const port1 = await proxyPool.allocate('agent-1');
      const port2 = await proxyPool.allocate('agent-1');

      expect(port1).toBe(port2);
      const stats = proxyPool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });

    it('should increment total and active stats', async () => {
      await proxyPool.allocate('agent-1');
      await proxyPool.allocate('agent-2');

      const stats = proxyPool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);
    });

    it('should throw error when port range exhausted', async () => {
      // Create a small port range
      const smallPool = new HTTPProxyPool({
        portRange: [9000, 9002], // Only 3 ports
      });

      // Allocate all ports
      await smallPool.allocate('agent-1');
      await smallPool.allocate('agent-2');
      await smallPool.allocate('agent-3');

      // Next allocation should fail
      await expect(smallPool.allocate('agent-4')).rejects.toThrow();

      await smallPool.closeAll();
    });
  });

  describe('create', () => {
    it('should create proxy at specific port', async () => {
      await proxyPool.create('agent-1', 8085);

      // Wait a bit for server to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = proxyPool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });

    it('should start HTTP server on allocated port', async () => {
      await proxyPool.create('agent-1', 8085);

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to connect to the proxy with proper Host header
      await new Promise<void>((resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: 8085,
          path: '/',
          method: 'GET',
          headers: {
            Host: 'agent-1.huinet.local',
          },
        };

        const req = http.request(options, (res) => {
          expect(res.statusCode).toBe(200);
          resolve();
        });

        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });

        req.end();
      });
    });

    it('should reuse port if proxy already exists for agent', async () => {
      await proxyPool.create('agent-1', 8085);
      await proxyPool.create('agent-1', 8090);

      const stats = proxyPool.getStats();
      expect(stats.total).toBe(1);
    });

    it('should throw error if port is already in use', async () => {
      await proxyPool.create('agent-1', 8085);

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Try to create another proxy on same port for different agent
      await expect(proxyPool.create('agent-2', 8085)).rejects.toThrow();
    });

    it('should handle HTTP requests with agent ID in Host header', async () => {
      await proxyPool.create('agent-1', 8085);

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Make request with agent ID in Host header
      await new Promise<void>((resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: 8085,
          path: '/',
          method: 'GET',
          headers: {
            Host: 'agent-1.huinet.local',
          },
        };

        const req = http.request(options, (res) => {
          expect(res.statusCode).toBe(200);
          resolve();
        });

        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });

        req.end();
      });
    });
  });

  describe('close', () => {
    it('should close proxy for specific agent', async () => {
      await proxyPool.allocate('agent-1');
      await proxyPool.allocate('agent-2');

      let stats = proxyPool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);

      await proxyPool.close('agent-1');

      stats = proxyPool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });

    it('should return silently when closing non-existent agent', async () => {
      await expect(proxyPool.close('non-existent')).resolves.not.toThrow();
    });

    it('should free port for reuse', async () => {
      const port1 = await proxyPool.allocate('agent-1');
      await proxyPool.close('agent-1');

      const port2 = await proxyPool.allocate('agent-2');
      expect(port2).toBe(port1);
    });

    it('should stop HTTP server when closed', async () => {
      await proxyPool.create('agent-1', 8085);

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify server is running
      await new Promise<void>((resolve) => {
        const req = http.get('http://localhost:8085', () => {
          resolve();
        });
        req.setTimeout(500, () => req.destroy());
      });

      // Close the proxy
      await proxyPool.close('agent-1');

      // Wait for server to stop
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify server is no longer running (connection should be refused)
      await new Promise<void>((resolve) => {
        const req = http.get('http://localhost:8085', () => {
          throw new Error('Server should not be running');
        });

        req.on('error', (err: any) => {
          // ECONNREFUSED is expected when server is closed
          expect(err.code).toBe('ECONNREFUSED');
          resolve();
        });

        req.setTimeout(500, () => req.destroy());
      });
    });
  });

  describe('closeAll', () => {
    it('should close all active proxies', async () => {
      await proxyPool.allocate('agent-1');
      await proxyPool.allocate('agent-2');
      await proxyPool.allocate('agent-3');

      let stats = proxyPool.getStats();
      expect(stats.total).toBe(3);
      expect(stats.active).toBe(3);

      await proxyPool.closeAll();

      stats = proxyPool.getStats();
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
    });

    it('should return silently when no proxies are active', async () => {
      await expect(proxyPool.closeAll()).resolves.not.toThrow();
    });

    it('should allow reallocation after closeAll', async () => {
      const port1 = await proxyPool.allocate('agent-1');
      await proxyPool.closeAll();

      const port2 = await proxyPool.allocate('agent-2');
      expect(port2).toBe(port1);
    });
  });

  describe('getStats', () => {
    it('should return correct stats after operations', async () => {
      await proxyPool.allocate('agent-1');
      await proxyPool.allocate('agent-2');

      let stats = proxyPool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active).toBe(2);

      await proxyPool.close('agent-1');

      stats = proxyPool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.active).toBe(1);
    });

    it('should reset stats after closeAll', async () => {
      await proxyPool.allocate('agent-1');
      await proxyPool.allocate('agent-2');

      await proxyPool.closeAll();

      const stats = proxyPool.getStats();
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
    });
  });

  describe('message routing', () => {
    it('should route messages to target agent', async () => {
      await proxyPool.create('agent-1', 8085);

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send a message to agent-1
      const message = { type: 'test', data: 'hello' };

      await new Promise<void>((resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: 8085,
          path: '/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Host: 'agent-1.huinet.local',
          },
        };

        const req = http.request(options, (res) => {
          expect(res.statusCode).toBe(200);
          resolve();
        });

        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });

        req.write(JSON.stringify(message));
        req.end();
      });
    });

    it('should return 404 for non-existent agent', async () => {
      await proxyPool.create('agent-1', 8085);

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 100));

      await new Promise<void>((resolve, reject) => {
        const options = {
          hostname: 'localhost',
          port: 8085,
          path: '/',
          method: 'GET',
          headers: {
            Host: 'non-existent.huinet.local',
          },
        };

        const req = http.request(options, (res) => {
          expect(res.statusCode).toBe(404);
          resolve();
        });

        req.on('error', reject);
        req.setTimeout(1000, () => {
          req.destroy();
          reject(new Error('Timeout'));
        });

        req.end();
      });
    });

    it('should parse agent ID from various Host header formats', async () => {
      await proxyPool.create('my-agent-123', 8085);

      // Wait for server to start
      await new Promise(resolve => setTimeout(resolve, 100));

      const testCases = [
        'my-agent-123.huinet.local',
        'my-agent-123.huinet.local:8085',
        'my-agent-123',
      ];

      for (const host of testCases) {
        await new Promise<void>((resolve, reject) => {
          const options = {
            hostname: 'localhost',
            port: 8085,
            path: '/',
            method: 'GET',
            headers: {
              Host: host,
            },
          };

          const req = http.request(options, (res) => {
            if (res.statusCode !== 200) {
              reject(new Error(`Expected 200 for host ${host}, got ${res.statusCode}`));
            } else {
              resolve();
            }
          });

          req.on('error', reject);
          req.setTimeout(1000, () => {
            req.destroy();
            reject(new Error('Timeout'));
          });

          req.end();
        });
      }
    });
  });
});
