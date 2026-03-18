/**
 * Tests for Agent Registry
 * TDD: Tests written before implementation
 */

import { AgentRegistry } from '../registry';
import { MachineInfo, AgentInfo } from '../types';
import { EventEmitter } from 'events';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let machineInfo: MachineInfo;

  beforeEach(() => {
    machineInfo = {
      machineId: 'machine-123',
      machineName: 'test-machine',
      location: 'test-location',
    };
    registry = new AgentRegistry(machineInfo);
  });

  describe('constructor', () => {
    it('should create registry with machine info', () => {
      expect(registry).toBeInstanceOf(EventEmitter);
      expect(registry.getAll()).toEqual([]);
    });

    it('should accept machine info in constructor', () => {
      const customMachine: MachineInfo = {
        machineId: 'custom-machine',
        machineName: 'custom-name',
        location: 'custom-location',
      };
      const customRegistry = new AgentRegistry(customMachine);
      expect(customRegistry).toBeDefined();
      expect(customRegistry.getAll()).toEqual([]);
    });
  });

  describe('add', () => {
    it('should register an agent and emit agent-registered event', (done) => {
      const agentData = {
        agentId: 'agent-1',
        agentType: 'chatbot',
        agentName: 'Test Agent',
        pid: 12345,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.on('agent-registered', (agent: AgentInfo) => {
        expect(agent.agentId).toBe('agent-1');
        expect(agent.machineId).toBe('machine-123');
        expect(agent.agentType).toBe('chatbot');
        done();
      });

      const result = registry.add(agentData);
      expect(result.agentId).toBe('agent-1');
      expect(result.machineId).toBe('machine-123');
    });

    it('should add machineId to agent info', () => {
      const agentData = {
        agentId: 'agent-2',
        agentType: 'code-assistant',
        agentName: 'Code Assistant',
        pid: 54321,
        status: 'idle' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      const result = registry.add(agentData);
      expect(result.machineId).toBe('machine-123');
    });

    it('should store agent in registry', () => {
      const agentData = {
        agentId: 'agent-3',
        agentType: 'processor',
        agentName: 'Processor',
        pid: 11111,
        status: 'busy' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agentData);
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.get('agent-3')).toBeDefined();
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent agent', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });

    it('should return agent by ID', () => {
      const agentData = {
        agentId: 'agent-4',
        agentType: 'test',
        agentName: 'Test',
        pid: 22222,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agentData);
      const result = registry.get('agent-4');
      expect(result).toBeDefined();
      expect(result?.agentId).toBe('agent-4');
      expect(result?.machineId).toBe('machine-123');
    });
  });

  describe('getByMachine', () => {
    it('should return empty array for non-existent machine', () => {
      expect(registry.getByMachine('non-existent-machine')).toEqual([]);
    });

    it('should return agents by machine ID', () => {
      const agent1 = {
        agentId: 'agent-5',
        agentType: 'type1',
        agentName: 'Agent 5',
        pid: 33333,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      const agent2 = {
        agentId: 'agent-6',
        agentType: 'type2',
        agentName: 'Agent 6',
        pid: 44444,
        status: 'idle' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agent1);
      registry.add(agent2);

      const results = registry.getByMachine('machine-123');
      expect(results).toHaveLength(2);
      expect(results[0].machineId).toBe('machine-123');
      expect(results[1].machineId).toBe('machine-123');
    });

    it('should only return agents for specified machine', () => {
      // This test verifies that when we have multiple machine registries,
      // each only returns its own agents
      const machine2Info: MachineInfo = {
        machineId: 'machine-456',
        machineName: 'machine-2',
        location: 'location-2',
      };
      const registry2 = new AgentRegistry(machine2Info);

      const agent1 = {
        agentId: 'agent-7',
        agentType: 'type1',
        agentName: 'Agent 7',
        pid: 55555,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      const agent2 = {
        agentId: 'agent-8',
        agentType: 'type2',
        agentName: 'Agent 8',
        pid: 66666,
        status: 'idle' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agent1);
      registry2.add(agent2);

      expect(registry.getByMachine('machine-123')).toHaveLength(1);
      expect(registry.getByMachine('machine-123')[0].agentId).toBe('agent-7');
      expect(registry.getByMachine('machine-456')).toHaveLength(0);
      expect(registry2.getByMachine('machine-456')).toHaveLength(1);
      expect(registry2.getByMachine('machine-456')[0].agentId).toBe('agent-8');
    });
  });

  describe('remove', () => {
    it('should return false for non-existent agent', () => {
      expect(registry.remove('non-existent')).toBe(false);
    });

    it('should remove agent and emit agent-removed event', (done) => {
      const agentData = {
        agentId: 'agent-9',
        agentType: 'test',
        agentName: 'Test',
        pid: 77777,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agentData);

      registry.on('agent-removed', (agentId: string) => {
        expect(agentId).toBe('agent-9');
        expect(registry.get('agent-9')).toBeUndefined();
        done();
      });

      const result = registry.remove('agent-9');
      expect(result).toBe(true);
    });

    it('should remove agent from registry', () => {
      const agentData = {
        agentId: 'agent-10',
        agentType: 'test',
        agentName: 'Test',
        pid: 88888,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agentData);
      expect(registry.getAll()).toHaveLength(1);

      registry.remove('agent-10');
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('updateHeartbeat', () => {
    it('should return false for non-existent agent', () => {
      expect(registry.updateHeartbeat('non-existent')).toBe(false);
    });

    it('should update lastHeartbeat timestamp', () => {
      const agentData = {
        agentId: 'agent-11',
        agentType: 'test',
        agentName: 'Test',
        pid: 99999,
        status: 'running' as const,
        lastHeartbeat: 1000,
        registeredAt: Date.now(),
      };

      registry.add(agentData);
      const beforeTime = registry.get('agent-11')?.lastHeartbeat;
      expect(beforeTime).toBe(1000);

      // Wait a bit to ensure timestamp changes
      const newTime = Date.now();
      const result = registry.updateHeartbeat('agent-11');

      expect(result).toBe(true);
      const afterTime = registry.get('agent-11')?.lastHeartbeat;
      expect(afterTime).toBeGreaterThanOrEqual(newTime);
    });
  });

  describe('updateStatus', () => {
    it('should return false for non-existent agent', () => {
      expect(registry.updateStatus('non-existent', 'idle')).toBe(false);
    });

    it('should update agent status and emit agent-status-changed event', (done) => {
      const agentData = {
        agentId: 'agent-12',
        agentType: 'test',
        agentName: 'Test',
        pid: 10101,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agentData);

      registry.on('agent-status-changed', (agentId: string, newStatus: string) => {
        expect(agentId).toBe('agent-12');
        expect(newStatus).toBe('idle');
        done();
      });

      const result = registry.updateStatus('agent-12', 'idle');
      expect(result).toBe(true);
      expect(registry.get('agent-12')?.status).toBe('idle');
    });

    it('should update to any valid status', () => {
      const agentData = {
        agentId: 'agent-13',
        agentType: 'test',
        agentName: 'Test',
        pid: 11111,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agentData);

      expect(registry.updateStatus('agent-13', 'busy')).toBe(true);
      expect(registry.get('agent-13')?.status).toBe('busy');

      expect(registry.updateStatus('agent-13', 'idle')).toBe(true);
      expect(registry.get('agent-13')?.status).toBe('idle');

      expect(registry.updateStatus('agent-13', 'offline')).toBe(true);
      expect(registry.get('agent-13')?.status).toBe('offline');

      expect(registry.updateStatus('agent-13', 'running')).toBe(true);
      expect(registry.get('agent-13')?.status).toBe('running');
    });
  });

  describe('getStats', () => {
    it('should return zero stats for empty registry', () => {
      const stats = registry.getStats();
      expect(stats).toEqual({
        total: 0,
        running: 0,
        busy: 0,
        idle: 0,
        offline: 0,
      });
    });

    it('should count agents by status', () => {
      registry.add({
        agentId: 'agent-14',
        agentType: 'test',
        agentName: 'Test 1',
        pid: 12121,
        status: 'running',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-15',
        agentType: 'test',
        agentName: 'Test 2',
        pid: 13131,
        status: 'running',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-16',
        agentType: 'test',
        agentName: 'Test 3',
        pid: 14141,
        status: 'busy',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-17',
        agentType: 'test',
        agentName: 'Test 4',
        pid: 15151,
        status: 'idle',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-18',
        agentType: 'test',
        agentName: 'Test 5',
        pid: 16161,
        status: 'offline',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      const stats = registry.getStats();
      expect(stats.total).toBe(5);
      expect(stats.running).toBe(2);
      expect(stats.busy).toBe(1);
      expect(stats.idle).toBe(1);
      expect(stats.offline).toBe(1);
    });

    it('should update stats when agent status changes', () => {
      const agentData = {
        agentId: 'agent-19',
        agentType: 'test',
        agentName: 'Test',
        pid: 17171,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agentData);

      let stats = registry.getStats();
      expect(stats.running).toBe(1);
      expect(stats.busy).toBe(0);

      registry.updateStatus('agent-19', 'busy');

      stats = registry.getStats();
      expect(stats.running).toBe(0);
      expect(stats.busy).toBe(1);
    });

    it('should update stats when agent is removed', () => {
      registry.add({
        agentId: 'agent-20',
        agentType: 'test',
        agentName: 'Test',
        pid: 18181,
        status: 'running',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-21',
        agentType: 'test',
        agentName: 'Test',
        pid: 19191,
        status: 'idle',
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      });

      let stats = registry.getStats();
      expect(stats.total).toBe(2);
      expect(stats.running).toBe(1);
      expect(stats.idle).toBe(1);

      registry.remove('agent-20');

      stats = registry.getStats();
      expect(stats.total).toBe(1);
      expect(stats.running).toBe(0);
      expect(stats.idle).toBe(1);
    });
  });

  describe('getAll', () => {
    it('should return empty array initially', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('should return all registered agents', () => {
      const agent1 = {
        agentId: 'agent-22',
        agentType: 'type1',
        agentName: 'Agent 22',
        pid: 20202,
        status: 'running' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      const agent2 = {
        agentId: 'agent-23',
        agentType: 'type2',
        agentName: 'Agent 23',
        pid: 21212,
        status: 'idle' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      const agent3 = {
        agentId: 'agent-24',
        agentType: 'type3',
        agentName: 'Agent 24',
        pid: 22222,
        status: 'busy' as const,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
      };

      registry.add(agent1);
      registry.add(agent2);
      registry.add(agent3);

      const all = registry.getAll();
      expect(all).toHaveLength(3);
      expect(all.map(a => a.agentId)).toEqual(['agent-22', 'agent-23', 'agent-24']);
    });
  });
});
