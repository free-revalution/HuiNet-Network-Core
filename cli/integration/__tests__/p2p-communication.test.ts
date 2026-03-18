/**
 * Integration tests for P2P Communication
 *
 * Tests P2P message routing between machines and agents:
 * 1. Machine discovery and announcement
 * 2. Agent discovery across machines
 * 3. Cross-machine agent messaging
 * 4. P2P sync and topology management
 */

import { P2PSync } from '../../daemon/p2p-sync';
import { AgentRegistry } from '../../daemon/registry';
import { MachineInfo } from '../../daemon/types';
import { HuiNet } from '../../../src/HuiNet';
import { AgentMessageType, MachineAnnounceMessage, AgentAnnounceMessage, AgentMessage } from '../../../src/protocol/agent';

// Mock HuiNet
jest.mock('../../../src/HuiNet');

describe('P2P Communication Integration', () => {
  let localMachine: MachineInfo;
  let remoteMachine1: MachineInfo;
  let remoteMachine2: MachineInfo;
  let localRegistry: AgentRegistry;
  let remoteRegistry1: AgentRegistry;
  let remoteRegistry2: AgentRegistry;
  let localP2P: P2PSync;
  let remoteP2P1: P2PSync;
  let remoteP2P2: P2PSync;
  let mockHuiNetLocal: any;
  let mockHuiNetRemote1: any;
  let mockHuiNetRemote2: any;

  function createMockHuiNet(nodeId: string): any {
    return {
      on: jest.fn(),
      send: jest.fn().mockResolvedValue(undefined),
    };
  }

  beforeEach(() => {
    // Create machine info
    localMachine = {
      machineId: 'local-machine',
      machineName: 'Local Machine',
      location: 'Local Lab',
    };

    remoteMachine1 = {
      machineId: 'remote-machine-1',
      machineName: 'Remote Machine 1',
      location: 'Remote Lab 1',
    };

    remoteMachine2 = {
      machineId: 'remote-machine-2',
      machineName: 'Remote Machine 2',
      location: 'Remote Lab 2',
    };

    // Create registries
    localRegistry = new AgentRegistry(localMachine);
    remoteRegistry1 = new AgentRegistry(remoteMachine1);
    remoteRegistry2 = new AgentRegistry(remoteMachine2);

    // Create mock HuiNet instances
    mockHuiNetLocal = createMockHuiNet('local-machine');
    mockHuiNetRemote1 = createMockHuiNet('remote-machine-1');
    mockHuiNetRemote2 = createMockHuiNet('remote-machine-2');

    // Create P2P sync instances
    localP2P = new P2PSync(mockHuiNetLocal, localMachine, localRegistry);
    remoteP2P1 = new P2PSync(mockHuiNetRemote1, remoteMachine1, remoteRegistry1);
    remoteP2P2 = new P2PSync(mockHuiNetRemote2, remoteMachine2, remoteRegistry2);
  });

  afterEach(async () => {
    await localP2P.cleanup();
    await remoteP2P1.cleanup();
    await remoteP2P2.cleanup();
  });

  describe('Machine Discovery', () => {
    it('should discover remote machine through announcement', () => {
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
        location: 'Remote Lab 1',
        agents: [],
        timestamp: Date.now(),
      };

      // Get message handler from local P2P
      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      // Simulate receiving announcement
      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg));

      // Verify machine is discovered
      const remoteMachines = localP2P.getRemoteMachines();
      expect(remoteMachines).toHaveLength(1);
      expect(remoteMachines[0].machineId).toBe('remote-machine-1' as any);
      expect(remoteMachines[0].machineName).toBe('Remote Machine 1');
    });

    it('should discover multiple remote machines', () => {
      const announceMsg1: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
        agents: [],
        timestamp: Date.now(),
      };

      const announceMsg2: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-2' as any,
        machineName: 'Remote Machine 2',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg1));
      messageHandler('remote-machine-2' as any, JSON.stringify(announceMsg2));

      const remoteMachines = localP2P.getRemoteMachines();
      expect(remoteMachines).toHaveLength(2);

      const machineIds = remoteMachines.map(m => m.machineId);
      expect(machineIds).toContain('remote-machine-1' as any);
      expect(machineIds).toContain('remote-machine-2' as any);
    });

    it('should update existing remote machine info on new announcement', () => {
      const announceMsg1: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg1));

      let remoteMachines = localP2P.getRemoteMachines();
      expect(remoteMachines[0].agents).toHaveLength(0);

      // Update with agents
      const announceMsg2: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
        agents: [
          {
            agentId: 'remote-agent-1',
            agentType: 'claude-code',
            agentName: 'Claude Code',
            status: 'online',
          },
        ],
        timestamp: Date.now(),
      };

      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg2));

      remoteMachines = localP2P.getRemoteMachines();
      expect(remoteMachines).toHaveLength(1); // Still only one machine
      expect(remoteMachines[0].agents).toHaveLength(1);
      expect(remoteMachines[0].agents[0].agentId).toBe('remote-agent-1');
    });
  });

  describe('Agent Discovery Across Machines', () => {
    it('should discover agents on remote machines', () => {
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
        agents: [
          {
            agentId: 'remote-agent-1',
            agentType: 'claude-code',
            agentName: 'Claude Code',
            status: 'online',
          },
          {
            agentId: 'remote-agent-2',
            agentType: 'cursor',
            agentName: 'Cursor',
            status: 'busy',
          },
        ],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg));

      const remoteMachine = localP2P.getRemoteMachine('remote-machine-1' as any);
      expect(remoteMachine).toBeDefined();
      expect(remoteMachine!.agents).toHaveLength(2);
      expect(remoteMachine!.agents[0].agentId).toBe('remote-agent-1');
      expect(remoteMachine!.agents[1].agentId).toBe('remote-agent-2');
    });

    it('should handle individual agent announcements', () => {
      // First announce machine
      const machineAnnounce: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      messageHandler('remote-machine-1' as any, JSON.stringify(machineAnnounce));

      let remoteMachine = localP2P.getRemoteMachine('remote-machine-1' as any);
      expect(remoteMachine!.agents).toHaveLength(0);

      // Then announce individual agent
      const agentAnnounce: AgentAnnounceMessage = {
        type: AgentMessageType.AGENT_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        agentId: 'remote-agent-1',
        agentType: 'windsurf',
        agentName: 'Windsurf',
        capabilities: ['code', 'chat'],
        timestamp: Date.now(),
      };

      messageHandler('remote-machine-1' as any, JSON.stringify(agentAnnounce));

      remoteMachine = localP2P.getRemoteMachine('remote-machine-1' as any);
      expect(remoteMachine!.agents).toHaveLength(1);
      expect(remoteMachine!.agents[0].agentId).toBe('remote-agent-1');
    });
  });

  describe('Network Topology', () => {
    beforeEach(() => {
      // Add some agents to local registry
      localRegistry.add({
        agentId: 'local-agent-1',
        agentType: 'claude-code',
        agentName: 'Local Claude',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      // Announce remote machines
      const announceMsg1: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
        agents: [
          {
            agentId: 'remote-agent-1',
            agentType: 'cursor',
            agentName: 'Remote Cursor',
            status: 'online',
          },
        ],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg1));
    });

    it('should return complete network topology', () => {
      const topology = localP2P.getNetworkTopology();

      expect(topology.local.machineId).toBe('local-machine');
      expect(topology.local.agents).toHaveLength(1);
      expect(topology.local.agents[0].agentId).toBe('local-agent-1');

      expect(topology.remote).toHaveLength(1);
      expect(topology.remote[0].machineId).toBe('remote-machine-1' as any);
      expect(topology.remote[0].agents).toHaveLength(1);
    });

    it('should count total agents across network', () => {
      const topology = localP2P.getNetworkTopology();

      const localAgentCount = topology.local.agents.length;
      const remoteAgentCount = topology.remote.reduce(
        (sum, machine) => sum + machine.agents.length,
        0
      );

      const totalAgents = localAgentCount + remoteAgentCount;
      expect(totalAgents).toBe(2); // 1 local + 1 remote
    });
  });

  describe('Cross-Machine Agent Messaging', () => {
    it('should send message to agent on remote machine', async () => {
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
        agents: [
          {
            agentId: 'remote-agent-1',
            agentType: 'claude-code',
            agentName: 'Remote Claude',
            status: 'online',
          },
        ],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg));

      // Send message to remote agent
      await localP2P.sendMessageToAgent(
        'remote-machine-1' as any,
        'remote-agent-1',
        'local-agent-1',
        { type: 'hello', data: 'Hello from local!' }
      );

      expect(mockHuiNetLocal.send).toHaveBeenCalledWith(
        'remote-machine-1' as any,
        expect.stringContaining('"type":36')
      );

      const sentMessage = JSON.parse((mockHuiNetLocal.send as jest.Mock).mock.calls[0][1]);
      expect(sentMessage.fromAgent).toBe('local-agent-1');
      expect(sentMessage.toAgent).toBe('remote-agent-1');
      expect(sentMessage.message.data).toBe('Hello from local!');
    });

    it('should handle incoming agent-to-agent messages', () => {
      const agentMessage: AgentMessage = {
        type: AgentMessageType.AGENT_MESSAGE,
        fromAgent: 'remote-agent-1',
        toAgent: 'local-agent-1',
        message: { type: 'greeting', text: 'Hello!' },
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      // Should handle without errors
      expect(() => {
        messageHandler('remote-machine-1' as any, JSON.stringify(agentMessage));
      }).not.toThrow();
    });
  });

  describe('P2P Sync Heartbeat and Cleanup', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should announce local machine periodically', async () => {
      // Add agents to local registry
      localRegistry.add({
        agentId: 'local-agent-1',
        agentType: 'claude-code',
        agentName: 'Local Claude',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      // Add remote machine so announcement has a target
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];
      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg));

      (mockHuiNetLocal.send as jest.Mock).mockClear();

      await localP2P.startMachineHeartbeat(5000);

      // Initial call happens after interval
      jest.advanceTimersByTime(5000);

      expect(mockHuiNetLocal.send).toHaveBeenCalledWith(
        'remote-machine-1' as any,
        expect.stringContaining('"type":32')
      );
    });

    it('should cleanup stale machines', async () => {
      const announceMsg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'stale-machine' as any,
        machineName: 'Stale Machine',
        agents: [],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];
      messageHandler('stale-machine' as any, JSON.stringify(announceMsg));

      expect(localP2P.getRemoteMachines()).toHaveLength(1);

      // Manually set lastSeen to old time
      const staleMachine = localP2P.getRemoteMachine('stale-machine' as any);
      if (staleMachine) {
        (staleMachine as { lastSeen: number }).lastSeen = Date.now() - 200000;
      }

      jest.useRealTimers();

      // Trigger cleanup
      (localP2P as any).cleanupStaleMachines(120000);

      jest.useFakeTimers();

      expect(localP2P.getRemoteMachines()).toHaveLength(0);
    });
  });

  describe('Multi-Machine Network', () => {
    it('should maintain topology across multiple machines', () => {
      // Local machine announces
      localRegistry.add({
        agentId: 'local-agent-1',
        agentType: 'claude-code',
        agentName: 'Local Claude',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      // Remote machine 1 announces
      const announceMsg1: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
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

      // Remote machine 2 announces
      const announceMsg2: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-2' as any,
        machineName: 'Remote Machine 2',
        agents: [
          {
            agentId: 'remote-agent-2',
            agentType: 'windsurf',
            agentName: 'Windsurf',
            status: 'busy',
          },
        ],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg1));
      messageHandler('remote-machine-2' as any, JSON.stringify(announceMsg2));

      const topology = localP2P.getNetworkTopology();

      expect(topology.local.agents).toHaveLength(1);
      expect(topology.remote).toHaveLength(2);
      expect(topology.remote[0].agents).toHaveLength(1);
      expect(topology.remote[1].agents).toHaveLength(1);

      // Total agents: 1 local + 1 on remote1 + 1 on remote2 = 3
      const totalAgents =
        topology.local.agents.length +
        topology.remote.reduce((sum, m) => sum + m.agents.length, 0);
      expect(totalAgents).toBe(3);
    });

    it('should route messages between any two agents', async () => {
      // Setup both remote machines
      const announceMsg1: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-1' as any,
        machineName: 'Remote Machine 1',
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

      const announceMsg2: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'remote-machine-2' as any,
        machineName: 'Remote Machine 2',
        agents: [
          {
            agentId: 'remote-agent-2',
            agentType: 'windsurf',
            agentName: 'Windsurf',
            status: 'online',
          },
        ],
        timestamp: Date.now(),
      };

      const onCall = (mockHuiNetLocal.on as jest.Mock).mock.calls.find(
        call => call[0] === 'message'
      );
      const messageHandler = onCall![1];

      messageHandler('remote-machine-1' as any, JSON.stringify(announceMsg1));
      messageHandler('remote-machine-2' as any, JSON.stringify(announceMsg2));

      // Send message from local to remote-2
      await localP2P.sendMessageToAgent(
        'remote-machine-2' as any,
        'remote-agent-2',
        'local-agent-1',
        { text: 'Hello from local!' }
      );

      expect(mockHuiNetLocal.send).toHaveBeenCalledWith(
        'remote-machine-2' as any,
        expect.any(String)
      );

      // Send message to remote-1
      (mockHuiNetLocal.send as jest.Mock).mockClear();

      await localP2P.sendMessageToAgent(
        'remote-machine-1' as any,
        'remote-agent-1',
        'local-agent-1',
        { text: 'Hello again!' }
      );

      expect(mockHuiNetLocal.send).toHaveBeenCalledWith(
        'remote-machine-1' as any,
        expect.any(String)
      );
    });
  });
});
