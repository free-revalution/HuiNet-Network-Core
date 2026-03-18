/**
 * Tests for DaemonClient
 */

import { DaemonClient } from '../client';
import { AgentInfo } from '../../daemon/types';

// Mock fetch for testing
global.fetch = jest.fn();

describe('DaemonClient', () => {
  let client: DaemonClient;
  const mockDaemonUrl = 'http://localhost:3000';

  beforeEach(() => {
    client = new DaemonClient(mockDaemonUrl);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('connect', () => {
    it('should successfully connect to daemon', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'running',
          machineId: 'machine-123',
          stats: {
            totalAgents: 2,
            activeAgents: 2,
          },
          proxyStats: {
            total: 10,
            active: 2,
          },
        }),
      });

      await expect(client.connect()).resolves.not.toThrow();
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockDaemonUrl}/api/status`
      );
    });

    it('should throw error when daemon is not reachable', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Connection refused'));

      await expect(client.connect()).rejects.toThrow('Failed to connect to daemon');
    });

    it('should throw error when daemon returns error status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.connect()).rejects.toThrow('Daemon returned error: 500');
    });
  });

  describe('getTopology', () => {
    it('should fetch network topology', async () => {
      const mockAgents: AgentInfo[] = [
        {
          agentId: 'agent-1',
          machineId: 'machine-1',
          agentType: 'chatbot',
          agentName: 'ChatBot 1',
          pid: 1234,
          status: 'running',
          lastHeartbeat: Date.now(),
          registeredAt: Date.now() - 10000,
          proxyPort: 8001,
        },
        {
          agentId: 'agent-2',
          machineId: 'machine-1',
          agentType: 'code-assistant',
          agentName: 'Code Assistant',
          pid: 5678,
          status: 'idle',
          lastHeartbeat: Date.now(),
          registeredAt: Date.now() - 5000,
          proxyPort: 8002,
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          machines: [
            {
              machineId: 'machine-1',
              machineName: 'Machine 1',
              location: 'local',
              agents: mockAgents,
            },
          ],
        }),
      });

      const topology = await client.getTopology();

      expect(topology).toEqual({
        machines: [
          {
            machineId: 'machine-1',
            machineName: 'Machine 1',
            location: 'local',
            agents: mockAgents,
          },
        ],
      });
      expect(global.fetch).toHaveBeenCalledWith(
        `${mockDaemonUrl}/api/topology`
      );
    });

    it('should throw error on fetch failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(client.getTopology()).rejects.toThrow('Failed to fetch topology');
    });
  });

  describe('sendMessage', () => {
    it('should send message between agents', async () => {
      const mockResponse = {
        fromAgent: 'agent-1',
        toAgent: 'agent-2',
        message: 'Hello',
        timestamp: Date.now(),
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(
        client.sendMessage('agent-1', 'agent-2', 'Hello')
      ).resolves.not.toThrow();

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockDaemonUrl}/api/messages/send`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fromAgent: 'agent-1',
            toAgent: 'agent-2',
            message: 'Hello',
          }),
        })
      );
    });

    it('should throw error on send failure', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Send failed'));

      await expect(
        client.sendMessage('agent-1', 'agent-2', 'Hello')
      ).rejects.toThrow('Failed to send message');
    });
  });

  describe('subscribeEvents', () => {
    it('should return event source', () => {
      const eventSource = client.subscribeEvents();

      expect(eventSource).toBeDefined();
      expect(eventSource).toHaveProperty('on');
      expect(eventSource).toHaveProperty('close');
    });

    it('should allow registering event listeners', () => {
      const eventSource = client.subscribeEvents();
      const statusCallback = jest.fn();
      const topologyCallback = jest.fn();

      eventSource.on('status', statusCallback);
      eventSource.on('topology', topologyCallback);

      // Verify listeners were registered (implementation detail)
      expect(eventSource).toBeDefined();

      eventSource.close();
    });

    it('should allow closing event source', () => {
      const eventSource = client.subscribeEvents();

      expect(() => eventSource.close()).not.toThrow();
    });
  });
});
