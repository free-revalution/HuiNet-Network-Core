import {
  AgentMessageType,
  MachineAnnounceMessage,
  AgentAnnounceMessage,
  AgentHeartbeatMessage,
  AgentStatusMessage,
  AgentMessage,
  isAgentMessage,
  getAgentMessageTypeName,
} from '../agent';

describe('Agent Message Types', () => {
  describe('AgentMessageType', () => {
    it('should have correct hex values', () => {
      expect(AgentMessageType.MACHINE_ANNOUNCE).toBe(0x20);
      expect(AgentMessageType.AGENT_ANNOUNCE).toBe(0x21);
      expect(AgentMessageType.AGENT_HEARTBEAT).toBe(0x22);
      expect(AgentMessageType.AGENT_STATUS).toBe(0x23);
      expect(AgentMessageType.AGENT_MESSAGE).toBe(0x24);
    });
  });

  describe('MachineAnnounceMessage', () => {
    it('should create valid machine announcement', () => {
      const msg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'machine-123',
        machineName: 'Test Machine',
        location: 'us-west',
        agents: [
          {
            agentId: 'agent-1',
            agentType: 'worker',
            agentName: 'Worker 1',
            status: 'online',
          },
        ],
        timestamp: Date.now(),
      };

      expect(msg.type).toBe(0x20);
      expect(msg.machineId).toBe('machine-123');
      expect(msg.agents).toHaveLength(1);
      expect(msg.agents[0].agentId).toBe('agent-1');
    });

    it('should allow optional location', () => {
      const msg: MachineAnnounceMessage = {
        type: AgentMessageType.MACHINE_ANNOUNCE,
        machineId: 'machine-123',
        machineName: 'Test Machine',
        agents: [],
        timestamp: Date.now(),
      };

      expect(msg.location).toBeUndefined();
    });
  });

  describe('AgentAnnounceMessage', () => {
    it('should create valid agent announcement', () => {
      const msg: AgentAnnounceMessage = {
        type: AgentMessageType.AGENT_ANNOUNCE,
        machineId: 'machine-123',
        agentId: 'agent-1',
        agentType: 'worker',
        agentName: 'Worker Agent',
        capabilities: ['compute', 'storage'],
        timestamp: Date.now(),
      };

      expect(msg.type).toBe(0x21);
      expect(msg.agentId).toBe('agent-1');
      expect(msg.capabilities).toContain('compute');
    });
  });

  describe('AgentHeartbeatMessage', () => {
    it('should create valid agent heartbeat', () => {
      const msg: AgentHeartbeatMessage = {
        type: AgentMessageType.AGENT_HEARTBEAT,
        agentId: 'agent-1',
        machineId: 'machine-123',
        sequence: 1,
        status: 'online',
        timestamp: Date.now(),
      };

      expect(msg.type).toBe(0x22);
      expect(msg.sequence).toBe(1);
      expect(msg.status).toBe('online');
    });
  });

  describe('AgentStatusMessage', () => {
    it('should create valid agent status with all fields', () => {
      const msg: AgentStatusMessage = {
        type: AgentMessageType.AGENT_STATUS,
        agentId: 'agent-1',
        machineId: 'machine-123',
        status: 'busy',
        load: 0.75,
        tasksProcessed: 100,
        errors: 2,
        lastActivity: Date.now(),
        timestamp: Date.now(),
      };

      expect(msg.type).toBe(0x23);
      expect(msg.status).toBe('busy');
      expect(msg.load).toBe(0.75);
      expect(msg.tasksProcessed).toBe(100);
    });

    it('should create valid agent status with minimal fields', () => {
      const msg: AgentStatusMessage = {
        type: AgentMessageType.AGENT_STATUS,
        agentId: 'agent-1',
        machineId: 'machine-123',
        status: 'online',
        timestamp: Date.now(),
      };

      expect(msg.load).toBeUndefined();
      expect(msg.tasksProcessed).toBeUndefined();
    });
  });

  describe('AgentMessage', () => {
    it('should create valid agent-to-agent message', () => {
      const msg: AgentMessage = {
        type: AgentMessageType.AGENT_MESSAGE,
        fromAgent: 'agent-1',
        toAgent: 'agent-2',
        message: { type: 'task', data: 'hello' },
        timestamp: Date.now(),
      };

      expect(msg.type).toBe(0x24);
      expect(msg.fromAgent).toBe('agent-1');
      expect(msg.toAgent).toBe('agent-2');
      expect(msg.message.type).toBe('task');
    });
  });

  describe('isAgentMessage', () => {
    it('should return true for valid agent messages', () => {
      const validMsg: AgentMessage = {
        type: AgentMessageType.AGENT_MESSAGE,
        fromAgent: 'agent-1',
        toAgent: 'agent-2',
        message: 'hello',
        timestamp: Date.now(),
      };

      expect(isAgentMessage(validMsg)).toBe(true);
    });

    it('should return false for invalid messages', () => {
      expect(isAgentMessage(null)).toBe(false);
      expect(isAgentMessage(undefined)).toBe(false);
      expect(isAgentMessage({})).toBe(false);
      expect(isAgentMessage({ type: 0x50 })).toBe(false); // Out of range
    });

    it('should return false for messages with missing type', () => {
      expect(isAgentMessage({ message: 'hello' })).toBe(false);
    });
  });

  describe('getAgentMessageTypeName', () => {
    it('should return correct names for all types', () => {
      expect(getAgentMessageTypeName(AgentMessageType.MACHINE_ANNOUNCE)).toBe('MACHINE_ANNOUNCE');
      expect(getAgentMessageTypeName(AgentMessageType.AGENT_ANNOUNCE)).toBe('AGENT_ANNOUNCE');
      expect(getAgentMessageTypeName(AgentMessageType.AGENT_HEARTBEAT)).toBe('AGENT_HEARTBEAT');
      expect(getAgentMessageTypeName(AgentMessageType.AGENT_STATUS)).toBe('AGENT_STATUS');
      expect(getAgentMessageTypeName(AgentMessageType.AGENT_MESSAGE)).toBe('AGENT_MESSAGE');
    });

    it('should return UNKNOWN for invalid type', () => {
      expect(getAgentMessageTypeName(0x50 as AgentMessageType)).toBe('UNKNOWN');
    });
  });

  describe('Message type ranges', () => {
    it('should use 0x20-0x24 range to avoid conflicts', () => {
      const types = [
        AgentMessageType.MACHINE_ANNOUNCE,
        AgentMessageType.AGENT_ANNOUNCE,
        AgentMessageType.AGENT_HEARTBEAT,
        AgentMessageType.AGENT_STATUS,
        AgentMessageType.AGENT_MESSAGE,
      ];

      types.forEach(type => {
        expect(type).toBeGreaterThanOrEqual(0x20);
        expect(type).toBeLessThanOrEqual(0x24);
      });
    });
  });
});
