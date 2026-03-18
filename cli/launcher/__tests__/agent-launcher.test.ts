/**
 * Tests for Agent Launcher
 */

import { EventEmitter } from 'events';
import { AgentLauncher } from '../agent-launcher';
import type { AgentConfig } from '../../config/agent-config';

describe('AgentLauncher', () => {
  let launcher: AgentLauncher;
  let mockDaemon: any;

  beforeEach(() => {
    mockDaemon = new EventEmitter();
    mockDaemon.allocateAgent = jest.fn().mockResolvedValue({
      port: 8081,
      wsUrl: 'ws://127.0.0.1:8081',
    });
    mockDaemon.getHuiNet = jest.fn().mockReturnValue({
      getNodeID: () => 'mock-node-id',
    });

    launcher = new AgentLauncher(mockDaemon);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isRunning', () => {
    it('should return false initially', () => {
      expect(launcher.isRunning('test-agent')).toBe(false);
    });
  });

  describe('stop', () => {
    it('should return false for non-existent agent', async () => {
      const stopped = await launcher.stop('non-existent');
      expect(stopped).toBe(false);
    });
  });

  describe('getProcess', () => {
    it('should return undefined for non-existent agent', () => {
      const proc = launcher.getProcess('non-existent');
      expect(proc).toBeUndefined();
    });
  });
});
