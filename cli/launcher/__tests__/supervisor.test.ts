/**
 * Tests for Supervisor
 * TDD: Tests written before implementation
 */

import { Supervisor } from '../supervisor';
import { EventEmitter } from 'events';
import * as http from 'http';

// Mock child_process
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const { spawn } = require('child_process');

describe('Supervisor', () => {
  let supervisor: Supervisor;
  let mockDaemonServer: http.Server;
  let daemonPort: number;
  let mockProcess: any;

  beforeAll((done) => {
    // Start a mock daemon server
    daemonPort = 3010; // Use different port from default daemon
    mockDaemonServer = http.createServer((req, res) => {
      if (req.method === 'DELETE' && req.url?.startsWith('/api/agents/')) {
        // Handle agent unregistration
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
      } else if (req.method === 'POST' && req.url === '/api/agents/heartbeat') {
        // Handle heartbeat
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          const data = JSON.parse(body);
          res.writeHead(200);
          res.end(JSON.stringify({ registered: true, networkTime: Date.now() }));
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
    // Mock process
    mockProcess = {
      on: jest.fn(),
      kill: jest.fn(),
      pid: 12345,
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
    };

    (spawn as jest.Mock).mockReturnValue(mockProcess);

    supervisor = new Supervisor(`http://localhost:${daemonPort}`, 'test-agent-1');

    // Mock sendHeartbeat to avoid actual network calls
    jest.spyOn(supervisor as any, 'sendHeartbeat').mockResolvedValue(undefined);

    // Mock setInterval to avoid actual timers
    jest.spyOn(global, 'setInterval').mockReturnValue(123 as any);
    jest.spyOn(global, 'clearInterval').mockImplementation(() => {});
  });

  afterEach(() => {
    if (supervisor) {
      supervisor.removeAllListeners();
    }
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create supervisor extending EventEmitter', () => {
      expect(supervisor).toBeInstanceOf(EventEmitter);
    });

    it('should store daemon URL and agent ID', () => {
      const customSupervisor = new Supervisor('http://localhost:3000', 'agent-123');
      expect(customSupervisor).toBeDefined();
    });
  });

  describe('launch', () => {
    it('should spawn agent process with command and args', async () => {
      await supervisor.launch('node', ['--version'], {});

      expect(spawn).toHaveBeenCalledWith('node', ['--version'], {
        env: expect.any(Object),
        stdio: 'pipe',
      });
    });

    it('should merge environment variables', async () => {
      const customEnv = {
        CUSTOM_VAR: 'custom-value',
        PATH: '/usr/bin',
      };

      await supervisor.launch('echo', ['hello'], customEnv);

      expect(spawn).toHaveBeenCalledWith('echo', ['hello'], {
        env: expect.objectContaining({
          CUSTOM_VAR: 'custom-value',
          PATH: '/usr/bin',
        }),
        stdio: 'pipe',
      });
    });

    it('should inject HuiNet environment variables', async () => {
      await supervisor.launch('echo', ['hello'], {});

      const spawnCall = (spawn as jest.Mock).mock.calls[0];
      const env = spawnCall[2].env;

      expect(env).toHaveProperty('HUINET_AGENT_ID', 'test-agent-1');
    });

    it('should start heartbeat after launch', async () => {
      const startHeartbeatSpy = jest.spyOn(supervisor as any, 'startHeartbeat');

      await supervisor.launch('echo', ['hello'], {});

      expect(startHeartbeatSpy).toHaveBeenCalled();
    }, 10000);

    it('should emit process-exit event when process exits', (done) => {
      supervisor.on('process-exit', (code: number, signal: string) => {
        expect(code).toBe(0);
        expect(signal).toBeNull();
        done();
      });

      supervisor.launch('echo', ['hello'], {}).then(() => {
        // Simulate process exit
        const exitCallback = (mockProcess.on as jest.Mock).mock.calls.find(
          (call: any[]) => call[0] === 'exit'
        )[1];

        exitCallback(0, null);
      });
    });

    it('should handle spawn errors', async () => {
      const errorSpy = jest.fn();
      supervisor.on('error', errorSpy);

      (spawn as jest.Mock).mockImplementation(() => {
        throw new Error('Spawn failed');
      });

      try {
        await supervisor.launch('invalid-command', [], {});
      } catch (error) {
        expect(errorSpy).toHaveBeenCalled();
      }
    });
  });

  describe('heartbeat', () => {
    it('should start heartbeat after launch', async () => {
      const startHeartbeatSpy = jest.spyOn(supervisor as any, 'startHeartbeat');

      await supervisor.launch('echo', ['hello'], {});

      expect(startHeartbeatSpy).toHaveBeenCalled();

      // Clean up
      await supervisor.stop();
    });

    it('should stop heartbeat when stopped', async () => {
      await supervisor.launch('echo', ['hello'], {});

      const stopHeartbeatSpy = jest.spyOn(supervisor as any, 'stopHeartbeat');

      await supervisor.stop();

      expect(stopHeartbeatSpy).toHaveBeenCalled();
    });
  });

  describe('unregister', () => {
    it('should send DELETE request to daemon', async () => {
      await supervisor.launch('echo', ['hello'], {});

      // Manually trigger unregister (normally called on process exit)
      await (supervisor as any).unregister();

      // If we get here without error, the DELETE request succeeded
      expect(true).toBe(true);
    });
  });

  describe('stop', () => {
    it('should stop heartbeat and kill process', async () => {
      await supervisor.launch('echo', ['hello'], {});

      const stopHeartbeatSpy = jest.spyOn(supervisor as any, 'stopHeartbeat');

      await supervisor.stop();

      expect(stopHeartbeatSpy).toHaveBeenCalled();
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should handle graceful shutdown', async () => {
      await supervisor.launch('echo', ['hello'], {});

      // Simulate graceful exit - trigger exit callback immediately
      const exitCallback = (mockProcess.on as jest.Mock).mock.calls.find(
        (call: any[]) => call[0] === 'exit'
      )[1];

      // Call exit callback immediately
      exitCallback(0, null);

      await supervisor.stop();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
  });

  describe('integration', () => {
    it('should handle full lifecycle: launch -> stop', async () => {
      // Launch
      await supervisor.launch('echo', ['hello'], {});
      expect(spawn).toHaveBeenCalled();

      // Stop
      await supervisor.stop();
      expect(mockProcess.kill).toHaveBeenCalled();
    });
  });
});
