/**
 * Tests for P2P Sync functionality
 */

import { P2PSync, RemoteMachine } from '../p2p-sync';
import { HuiNet } from '../../../src/HuiNet';
import { MachineInfo } from '../types';
import { AgentMessageType, MachineAnnounceMessage, AgentAnnounceMessage } from '../../../src/protocol/agent';

// Mock HuiNet
jest.mock('../../../src/HuiNet');

describe('P2PSync', () => {
  let mockHuiNet: any;
  let p2pSync: P2PSync;
  let machineInfo: MachineInfo;
  let mockRegistry: { getAll: () => any[] };

  beforeEach(() => {
    // Create mock HuiNet
    mockHuiNet = {
      on: jest.fn(),
      send: jest.fn().mockResolvedValue(undefined),
    };

    machineInfo = {
      machineId: 'test-machine-123',
      machineName: 'Test Machine',
      location: 'Test Lab',
    };

    mockRegistry = {
      getAll: jest.fn().mockReturnValue([]),
    };

    p2pSync = new P2PSync(mockHuiNet, machineInfo, mockRegistry);
  });

  afterEach(async () => {
    await p2pSync.cleanup();
  });

  describe('constructor', () => {
    it('should setup message handler', () => {
      expect(mockHuiNet.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should start with no remote machines', () => {
      expect(p2pSync.getRemoteMachines()).toHaveLength(0);
    });
  });

  describe('announceMachine', () => {
    it('should not call send when no remote machines', async () => {
      // Setup registry with agents
      const mockAgents = [
        {
          agentId: 'agent-1',
          machineId: 'test-machine-123',
          agentType: 'claude-code',
          agentName: 'Claude Code',
          pid: 1234,
          status: 'running',
          lastHeartbeat: Date.now(),
          registeredAt: Date.now(),
        },
      ];
      mockRegistry.getAll = jest.fn().mockReturnValue(mockAgents);

      await p2pSync.announceMachine();

      // No remote machines, so send should not be called
      expect(mockHuiNet.send).not.toHaveBeenCalled();
    });

    it('should send to all remote machines', async () => {
      // Setup registry with agents
      const mockAgents = [
        {
          agentId: 'agent-1',
          machineId: 'test-machine-123',
          agentType: 'claude-code',
          agentName: 'Claude Code',
          pid: 1234,
          status: 'running',
          lastHeartbeat: Date.now(),
          registeredAt: Date.now(),
        },
      ];
      mockRegistry.getAll = jest.fn().mockReturnValue(mockAgents);

      // Add remote machines
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote 1',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNet.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];
      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg));

      const announceMsg2: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-2' as any,
        machineName: 'Remote 2',
        agents: [],
        timestamp: Date.now(),
      };
      messageHandler('remote-machine-2' as any, JSON.stringify(announceMsg2));

      // Clear previous calls
      (mockHuiNet.send as jest.Mock).mockClear();

      await p2pSync.announceMachine();

      // Should send to both remote machines
      expect(mockHuiNet.send).toHaveBeenCalledTimes(2);
      expect(mockHuiNet.send).toHaveBeenCalledWith('remote-machine-1' as any, expect.stringContaining('"type":32'));
      expect(mockHuiNet.send).toHaveBeenCalledWith('remote-machine-2' as any, expect.stringContaining('"type":32'));
    });

    it('should create correct announcement message', async () => {
      const mockAgents = [
        {
          agentId: 'agent-1',
          machineId: 'test-machine-123',
          agentType: 'claude-code',
          agentName: 'Claude Code',
          pid: 1234,
          status: 'running',
          lastHeartbeat: Date.now(),
          registeredAt: Date.now(),
        },
      ];
      mockRegistry.getAll = jest.fn().mockReturnValue(mockAgents);

      await p2pSync.announceMachine();

      // Verify message structure through other means (not captured in mock since no remotes)
      const topology = p2pSync.getNetworkTopology();
      expect(topology.local.machineId).toBe('test-machine-123');
      expect(topology.local.agents).toHaveLength(1);
    });
  });

  describe('message handling', () => {
    let messageHandler: any;

    beforeEach(() => {
      // Extract the message handler registered with HuiNet
      const onCall = (mockHuiNet.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      messageHandler = onCall![1];
    });

    describe('MACHINE_ANNOUNCE', () => {
      it('should add new remote machine', () => {
        const announceMsg: MachineAnnounceMessage = {
          type: AgentMessageType.MACHINE_ANNOUNCE,
          machineId: 'remote-machine-456' as any,
          machineName: 'Remote Machine',
          location: 'Remote Lab',
          agents: [
            {
              agentId: 'remote-agent-1',
              agentType: 'cursor',
              agentName: 'Cursor',
              status: 'online',
            },
          ],
          timestamp: Date.now(),
        };

        messageHandler('remote-machine-456' as any, JSON.stringify(announceMsg));

        const remoteMachines = p2pSync.getRemoteMachines();
        expect(remoteMachines).toHaveLength(1);
        expect(remoteMachines[0].machineId).toBe('remote-machine-456' as any);
        expect(remoteMachines[0].machineName).toBe('Remote Machine');
        expect(remoteMachines[0].agents).toHaveLength(1);
      });

      it('should update existing remote machine', () => {
        const announceMsg: MachineAnnounceMessage = {
          type: AgentMessageType.MACHINE_ANNOUNCE,
          machineId: 'remote-machine-456' as any,
          machineName: 'Remote Machine',
          location: 'Remote Lab',
          agents: [
            {
              agentId: 'remote-agent-1',
              agentType: 'cursor',
              agentName: 'Cursor',
              status: 'online',
            },
          ],
          timestamp: Date.now(),
        };

        // First announcement
        messageHandler('remote-machine-456' as any, JSON.stringify(announceMsg));

        // Second announcement with updated agents
        announceMsg.agents = [
          {
            agentId: 'remote-agent-1',
            agentType: 'cursor',
            agentName: 'Cursor',
            status: 'online',
          },
          {
            agentId: 'remote-agent-2',
            agentType: 'windsurf',
            agentName: 'Windsurf',
            status: 'online',
          },
        ];

        messageHandler('remote-machine-456' as any, JSON.stringify(announceMsg));

        const remoteMachines = p2pSync.getRemoteMachines();
        expect(remoteMachines).toHaveLength(1);
        expect(remoteMachines[0].agents).toHaveLength(2);
      });
    });

    describe('AGENT_ANNOUNCE', () => {
      it('should add agent to existing machine', () => {
        // First announce machine
        const machineAnnounce: MachineAnnounceMessage = {
          type: AgentMessageType.MACHINE_ANNOUNCE,
          machineId: 'remote-machine-456' as any,
          machineName: 'Remote Machine',
          agents: [],
          timestamp: Date.now(),
        };
        messageHandler('remote-machine-456' as any, JSON.stringify(machineAnnounce));

        // Then announce agent
        const agentAnnounce: AgentAnnounceMessage = {
          type: AgentMessageType.AGENT_ANNOUNCE,
          machineId: 'remote-machine-456' as any,
          agentId: 'remote-agent-1',
          agentType: 'cursor',
          agentName: 'Cursor Agent',
          capabilities: ['code', 'chat'],
          timestamp: Date.now(),
        };

        messageHandler('remote-machine-456' as any, JSON.stringify(agentAnnounce));

        const remoteMachine = p2pSync.getRemoteMachine('remote-machine-456' as any);
        expect(remoteMachine).toBeDefined();
        expect(remoteMachine!.agents).toHaveLength(1);
        expect(remoteMachine!.agents[0].agentId).toBe('remote-agent-1');
        expect(remoteMachine!.machineName).toBe('Remote Machine');
      });

      it('should create machine entry if not exists', () => {
        const agentAnnounce: AgentAnnounceMessage = {
          type: AgentMessageType.AGENT_ANNOUNCE,
          machineId: 'remote-machine-789' as any,
          agentId: 'remote-agent-2',
          agentType: 'windsurf',
          agentName: 'Windsurf Agent',
          capabilities: ['code'],
          timestamp: Date.now(),
        };

        messageHandler('remote-machine-789' as any, JSON.stringify(agentAnnounce));

        const remoteMachine = p2pSync.getRemoteMachine('remote-machine-789' as any);
        expect(remoteMachine).toBeDefined();
        expect(remoteMachine!.agents).toHaveLength(1);
        expect(remoteMachine!.machineName).toContain('Machine-'); // Should use auto-generated name
      });
    });
  });

  describe('sendMessageToAgent', () => {
    it('should send agent message to remote machine', async () => {
      await p2pSync.sendMessageToAgent(
        'remote-machine-456' as any,
        'remote-agent-1',
        'local-agent-1',
        { type: 'hello', data: 'test' }
      );

      expect(mockHuiNet.send).toHaveBeenCalledWith(
        'remote-machine-456' as any,
        expect.stringContaining('"type":36')
      );
      const sendCall = (mockHuiNet.send as jest.Mock).mock.calls[0][1];
      const message = JSON.parse(sendCall);
      expect(message.type).toBe(AgentMessageType.AGENT_MESSAGE);
      expect(message.fromAgent).toBe('local-agent-1');
      expect(message.toAgent).toBe('remote-agent-1');
    });
  });

  describe('startMachineHeartbeat', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start periodic heartbeat', async () => {
      const sendSpy = mockHuiNet.send as jest.Mock;

      // Add a remote machine first
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine' as any,
        machineName: 'Remote',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNet.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];
      messageHandler('remote-machine' as any, JSON.stringify(announceMsg));

      // Clear previous calls
      sendSpy.mockClear();

      await p2pSync.startMachineHeartbeat(5000);

      // startMachineHeartbeat uses setInterval, so first call is after interval
      // Initially no calls (setInterval doesn't call immediately)
      expect(sendSpy).not.toHaveBeenCalled();

      // Advance time by interval
      jest.advanceTimersByTime(5000);

      // Now should have sent
      expect(sendSpy).toHaveBeenCalledWith('remote-machine' as any, expect.any(String));
    });

    it('should cleanup stale machines', () => {
      // Add a machine
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'stale-machine' as any,
        machineName: 'Stale Machine',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNet.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];
      messageHandler('stale-machine' as any, JSON.stringify(announceMsg));

      expect(p2pSync.getRemoteMachines()).toHaveLength(1);

      // Also add a fresh machine
      const freshMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'fresh-machine' as any,
        machineName: 'Fresh Machine',
        agents: [],
        timestamp: Date.now(),
      };
      messageHandler('fresh-machine' as any, JSON.stringify(freshMsg));

      expect(p2pSync.getRemoteMachines()).toHaveLength(2);

      // Directly test the cleanup by calling it manually after modifying lastSeen
      // We need to access the private method through the class
      const staleMachine = p2pSync.getRemoteMachine('stale-machine' as any);
      if (staleMachine) {
        // Modify the lastSeen directly through type assertion
        (staleMachine as { lastSeen: number }).lastSeen = Date.now() - 200000;
      }

      // Use real timers momentarily to get proper Date.now() behavior
      jest.useRealTimers();
      const originalCleanup = (p2pSync as any).cleanupStaleMachines.bind(p2pSync);
      originalCleanup(120000);
      jest.useFakeTimers();

      // Stale machine should be removed but fresh machine should remain
      expect(p2pSync.getRemoteMachines()).toHaveLength(1);
      expect(p2pSync.getRemoteMachines()[0].machineId).toBe('fresh-machine' as any);
    });
  });

  describe('cleanup', () => {
    it('should stop heartbeat and clear data', async () => {
      await p2pSync.startMachineHeartbeat(5000);

      // Add a machine
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'test-remote' as any,
        machineName: 'Test Remote',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNet.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];
      messageHandler('test-remote' as any, JSON.stringify(announceMsg));

      expect(p2pSync.getRemoteMachines()).toHaveLength(1);

      await p2pSync.cleanup();

      expect(p2pSync.getRemoteMachines()).toHaveLength(0);
    });
  });

  describe('getNetworkTopology', () => {
    it('should return network topology with local and remote machines', async () => {
      // Setup local agents
      mockRegistry.getAll = jest.fn().mockReturnValue([
        {
          agentId: 'local-agent-1',
          machineId: 'test-machine-123',
          agentType: 'claude-code',
          agentName: 'Local Agent',
          pid: 1234,
          status: 'running',
          lastHeartbeat: Date.now(),
          registeredAt: Date.now(),
        },
      ]);

      // Add remote machine
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine' as any,
        machineName: 'Remote Machine',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNet.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];
      messageHandler('remote-machine' as any, JSON.stringify(announceMsg));

      const topology = p2pSync.getNetworkTopology();

      expect(topology.local.machineId).toBe('test-machine-123');
      expect(topology.local.agents).toHaveLength(1);
      expect(topology.remote).toHaveLength(1);
      expect(topology.remote[0].machineId).toBe('remote-machine' as any);
    });
  });
});
