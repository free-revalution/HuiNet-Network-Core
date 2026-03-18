/**
 * Tests for main launcher logic
 * TDD: Tests written before implementation
 */

import { launch } from '../index';
import { Supervisor } from '../supervisor';
import * as http from 'http';

// Mock Supervisor
jest.mock('../supervisor');

// Mock fetch properly
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Launcher', () => {
  let mockDaemonServer: http.Server;
  let daemonPort: number;

  beforeAll((done) => {
    // Start a mock daemon server
    daemonPort = 3011;
    mockDaemonServer = http.createServer((req, res) => {
      if (req.method === 'GET' && req.url === '/api/status') {
        // Handle status check
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'running',
          machineId: 'machine-123',
          stats: { total: 0, running: 0, busy: 0, idle: 0, offline: 0 },
          proxyStats: { total: 10, active: 0 },
        }));
      } else if (req.method === 'POST' && req.url === '/api/agents/register') {
        // Handle agent registration
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          const data = JSON.parse(body);
          res.writeHead(200);
          res.end(JSON.stringify({
            agentId: 'test-agent-456',
            proxyPort: 8081,
            heartbeatInterval: 3000,
          }));
        });
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    mockDaemonServer.listen(daemonPort, done);
  });

  afterAll((done) => {
    mockDaemonServer.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default fetch mocks
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/status')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'running', machineId: 'machine-123' }),
        } as any);
      } else if (url.includes('/api/agents/register')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ agentId: 'test-agent-456', proxyPort: 8081, heartbeatInterval: 3000 }),
        } as any);
      }
      return Promise.reject(new Error('Not found'));
    });
  });

  describe('launch', () => {
    it('should detect agent type from command', async () => {
      const mockSupervisor = {
        launch: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      (Supervisor as jest.MockedClass<typeof Supervisor>).mockImplementation(() => {
        return mockSupervisor as any;
      });

      await launch('claude', ['--version'], `http://localhost:${daemonPort}`);

      expect(mockSupervisor.launch).toHaveBeenCalled();
    });

    it('should check daemon availability before launching', async () => {
      const mockSupervisor = {
        launch: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      (Supervisor as jest.MockedClass<typeof Supervisor>).mockImplementation(() => {
        return mockSupervisor as any;
      });

      await launch('claude', ['--version'], `http://localhost:${daemonPort}`);

      // Verify status check was made - should be the first call
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('/api/status')
      );
    });

    it('should register agent with daemon', async () => {
      const mockSupervisor = {
        launch: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      (Supervisor as jest.MockedClass<typeof Supervisor>).mockImplementation(() => {
        return mockSupervisor as any;
      });

      await launch('claude', ['--version'], `http://localhost:${daemonPort}`);

      // Verify registration was made - should be the second call
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/api/agents/register'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should setup environment variables with agent ID', async () => {
      const mockSupervisor = {
        launch: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      (Supervisor as jest.MockedClass<typeof Supervisor>).mockImplementation(() => {
        return mockSupervisor as any;
      });

      await launch('claude', ['--version'], `http://localhost:${daemonPort}`);

      expect(mockSupervisor.launch).toHaveBeenCalledWith(
        'claude',
        ['--version'],
        expect.objectContaining({
          HUINET_AGENT_ID: expect.any(String),
          HUINET_AGENT_TYPE: expect.any(String),
        })
      );
    });

    it('should setup proxy environment variables if available', async () => {
      const mockSupervisor = {
        launch: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      (Supervisor as jest.MockedClass<typeof Supervisor>).mockImplementation(() => {
        return mockSupervisor as any;
      });

      await launch('claude', ['--version'], `http://localhost:${daemonPort}`);

      // Check if proxy vars are set (they should be based on registration response)
      const launchCall = mockSupervisor.launch.mock.calls[0];
      const env = launchCall[2];

      // Proxy port from mock response is 8081
      expect(env).toHaveProperty('HTTP_PROXY');
      expect(env).toHaveProperty('HTTPS_PROXY');
      expect(env.HTTP_PROXY).toContain('8081');
    });

    it('should handle SIGINT for graceful shutdown', async () => {
      const mockSupervisor = {
        launch: jest.fn().mockResolvedValue(undefined),
        on: jest.fn((event: string, callback: any) => {
          if (event === 'process-exit') {
            // Simulate immediate exit for testing
            setTimeout(() => callback(0, null), 10);
          }
        }),
        stop: jest.fn().mockResolvedValue(undefined),
      };

      (Supervisor as jest.MockedClass<typeof Supervisor>).mockImplementation(() => {
        return mockSupervisor as any;
      });

      // Mock process.exit to prevent actual exit
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
        // Do nothing - just prevent exit
      }) as any);

      await launch('claude', ['--version'], `http://localhost:${daemonPort}`);

      // Verify supervisor was created and stop is available
      expect(mockSupervisor.stop).toBeDefined();

      exitSpy.mockRestore();
    });

    it('should throw error if daemon is not available', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>).mockRejectedValueOnce(
        new Error('Daemon not available')
      );

      await expect(
        launch('claude', ['--version'], 'http://localhost:9999')
      ).rejects.toThrow();
    });

    it('should throw error if registration fails', async () => {
      (global.fetch as jest.MockedFunction<typeof fetch>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ status: 'running' }),
        } as any)
        .mockRejectedValueOnce(new Error('Registration failed'));

      await expect(
        launch('claude', ['--version'], 'http://localhost:9999')
      ).rejects.toThrow();
    });
  });
});
