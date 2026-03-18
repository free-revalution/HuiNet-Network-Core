/**
 * Integration tests for Agent Lifecycle
 *
 * Tests the full lifecycle of an agent:
 * 1. Registration
 * 2. Heartbeat
 * 3. Status updates
 * 4. Cleanup/removal
 */

import { AgentRegistry } from '../../daemon/registry';
import { HTTPProxyPool } from '../../daemon/proxy';
import { MachineInfo } from '../../daemon/types';

describe('Agent Lifecycle Integration', () => {
  let registry: AgentRegistry;
  let proxyPool: HTTPProxyPool;
  let machineInfo: MachineInfo;

  beforeEach(() => {
    machineInfo = {
      machineId: 'test-machine-' + Math.random().toString(36).substring(7),
      machineName: 'Test Machine',
      location: 'Test Lab',
    };

    registry = new AgentRegistry(machineInfo);
    proxyPool = new HTTPProxyPool({ portRange: [18080, 18090] });
  });

  afterEach(async () => {
    await proxyPool.closeAll();
  });

  describe('Agent Registration', () => {
    it('should register agent successfully', async () => {
      const proxyPort = await proxyPool.allocate('agent-1');

      const agent = registry.add({
        agentId: 'agent-1',
        agentType: 'claude-code',
        agentName: 'Claude Code',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort,
        registeredAt: Date.now(),
      });

      expect(agent.agentId).toBe('agent-1');
      expect(agent.machineId).toBe(machineInfo.machineId);
      expect(agent.proxyPort).toBe(proxyPort);
      expect(agent.status).toBe('running');
    });

    it('should register multiple agents', async () => {
      const port1 = await proxyPool.allocate('agent-1');
      const port2 = await proxyPool.allocate('agent-2');
      const port3 = await proxyPool.allocate('agent-3');

      registry.add({
        agentId: 'agent-1',
        agentType: 'claude-code',
        agentName: 'Claude Code',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort: port1,
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-2',
        agentType: 'cursor',
        agentName: 'Cursor',
        pid: 5678,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort: port2,
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-3',
        agentType: 'windsurf',
        agentName: 'Windsurf',
        pid: 9012,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort: port3,
        registeredAt: Date.now(),
      });

      const agents = registry.getAll();
      expect(agents).toHaveLength(3);
      expect(agents.every(a => a.machineId === machineInfo.machineId)).toBe(true);
    });

    it('should assign unique proxy ports to agents', async () => {
      const port1 = await proxyPool.allocate('agent-1');
      const port2 = await proxyPool.allocate('agent-2');

      expect(port1).not.toBe(port2);

      registry.add({
        agentId: 'agent-1',
        agentType: 'claude-code',
        agentName: 'Claude Code',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort: port1,
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-2',
        agentType: 'cursor',
        agentName: 'Cursor',
        pid: 5678,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort: port2,
        registeredAt: Date.now(),
      });

      const agent1 = registry.get('agent-1');
      const agent2 = registry.get('agent-2');

      expect(agent1?.proxyPort).not.toBe(agent2?.proxyPort);
    });
  });

  describe('Agent Heartbeat', () => {
    it('should update agent heartbeat', async () => {
      const proxyPort = await proxyPool.allocate('agent-heartbeat-1');

      const initialTime = Date.now();

      registry.add({
        agentId: 'agent-heartbeat-1',
        agentType: 'claude-code',
        agentName: 'Claude Code',
        pid: 1234,
        status: 'running',
        lastHeartbeat: initialTime,
        proxyPort,
        registeredAt: initialTime,
      });

      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const updated = registry.updateHeartbeat('agent-heartbeat-1');
      expect(updated).toBe(true);

      const agent = registry.get('agent-heartbeat-1');
      expect(agent?.lastHeartbeat).toBeGreaterThan(initialTime);
    });

    it('should return false for non-existent agent heartbeat', () => {
      const updated = registry.updateHeartbeat('non-existent-agent');
      expect(updated).toBe(false);
    });

    it('should handle multiple heartbeat updates', async () => {
      const proxyPort = await proxyPool.allocate('agent-heartbeat-2');

      registry.add({
        agentId: 'agent-heartbeat-2',
        agentType: 'cursor',
        agentName: 'Cursor',
        pid: 5678,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort,
        registeredAt: Date.now(),
      });

      const timestamps: number[] = [];

      for (let i = 0; i < 5; i++) {
        await new Promise(resolve => setTimeout(resolve, 5));
        registry.updateHeartbeat('agent-heartbeat-2');
        const agent = registry.get('agent-heartbeat-2');
        timestamps.push(agent!.lastHeartbeat);
      }

      // All timestamps should be different (monotonically increasing)
      expect(new Set(timestamps).size).toBe(5);
      expect(timestamps[4]).toBeGreaterThan(timestamps[0]);
    });
  });

  describe('Agent Status Updates', () => {
    it('should update agent status', async () => {
      const proxyPort = await proxyPool.allocate('agent-status-1');

      registry.add({
        agentId: 'agent-status-1',
        agentType: 'claude-code',
        agentName: 'Claude Code',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort,
        registeredAt: Date.now(),
      });

      const updated = registry.updateStatus('agent-status-1', 'busy');
      expect(updated).toBe(true);

      const agent = registry.get('agent-status-1');
      expect(agent?.status).toBe('busy');
    });

    it('should return false for non-existent agent status update', () => {
      const updated = registry.updateStatus('non-existent-agent', 'idle');
      expect(updated).toBe(false);
    });

    it('should track status changes across lifecycle', async () => {
      const proxyPort = await proxyPool.allocate('agent-status-2');

      registry.add({
        agentId: 'agent-status-2',
        agentType: 'windsurf',
        agentName: 'Windsurf',
        pid: 9012,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort,
        registeredAt: Date.now(),
      });

      // Simulate agent lifecycle
      registry.updateStatus('agent-status-2', 'busy');
      expect(registry.get('agent-status-2')?.status).toBe('busy');

      registry.updateStatus('agent-status-2', 'idle');
      expect(registry.get('agent-status-2')?.status).toBe('idle');

      registry.updateStatus('agent-status-2', 'busy');
      expect(registry.get('agent-status-2')?.status).toBe('busy');

      registry.updateStatus('agent-status-2', 'offline');
      expect(registry.get('agent-status-2')?.status).toBe('offline');
    });
  });

  describe('Agent Query and Filtering', () => {
    beforeEach(async () => {
      // Setup multiple agents
      const port1 = await proxyPool.allocate('agent-query-1');
      const port2 = await proxyPool.allocate('agent-query-2');
      const port3 = await proxyPool.allocate('agent-query-3');

      registry.add({
        agentId: 'agent-query-1',
        agentType: 'claude-code',
        agentName: 'Claude Code',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort: port1,
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-query-2',
        agentType: 'cursor',
        agentName: 'Cursor',
        pid: 5678,
        status: 'busy',
        lastHeartbeat: Date.now(),
        proxyPort: port2,
        registeredAt: Date.now(),
      });

      registry.add({
        agentId: 'agent-query-3',
        agentType: 'windsurf',
        agentName: 'Windsurf',
        pid: 9012,
        status: 'idle',
        lastHeartbeat: Date.now(),
        proxyPort: port3,
        registeredAt: Date.now(),
      });
    });

    it('should get all agents', () => {
      const agents = registry.getAll();
      expect(agents).toHaveLength(3);
    });

    it('should get agents by machine ID', () => {
      const agents = registry.getByMachine(machineInfo.machineId);
      expect(agents).toHaveLength(3);
      expect(agents.every(a => a.machineId === machineInfo.machineId)).toBe(true);
    });

    it('should get specific agent by ID', () => {
      const agent = registry.get('agent-query-1');
      expect(agent).toBeDefined();
      expect(agent?.agentType).toBe('claude-code');
    });

    it('should return undefined for non-existent agent', () => {
      const agent = registry.get('non-existent-agent');
      expect(agent).toBeUndefined();
    });

    it('should calculate stats correctly', () => {
      const stats = registry.getStats();
      expect(stats.total).toBe(3);
      expect(stats.running).toBe(1);
      expect(stats.busy).toBe(1);
      expect(stats.idle).toBe(1);
      expect(stats.offline).toBe(0);
    });
  });

  describe('Agent Removal and Cleanup', () => {
    it('should remove agent successfully', async () => {
      const proxyPort = await proxyPool.allocate('agent-remove-1');

      registry.add({
        agentId: 'agent-remove-1',
        agentType: 'claude-code',
        agentName: 'Claude Code',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort,
        registeredAt: Date.now(),
      });

      expect(registry.get('agent-remove-1')).toBeDefined();

      const removed = registry.remove('agent-remove-1');
      expect(removed).toBe(true);

      expect(registry.get('agent-remove-1')).toBeUndefined();
    });

    it('should return false when removing non-existent agent', () => {
      const removed = registry.remove('non-existent-agent');
      expect(removed).toBe(false);
    });

    it('should cleanup proxy port when agent is removed', async () => {
      const port1 = await proxyPool.allocate('agent-cleanup-1');

      registry.add({
        agentId: 'agent-cleanup-1',
        agentType: 'claude-code',
        agentName: 'Claude Code',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort: port1,
        registeredAt: Date.now(),
      });

      registry.remove('agent-cleanup-1');
      await proxyPool.close('agent-cleanup-1');

      // Port should be available for reuse
      const port2 = await proxyPool.allocate('agent-cleanup-2');
      expect(port2).toBe(port1);
    });

    it('should handle cleanup of multiple agents', async () => {
      const agents = ['agent-multi-1', 'agent-multi-2', 'agent-multi-3'];

      for (const agentId of agents) {
        const port = await proxyPool.allocate(agentId);
        registry.add({
          agentId,
          agentType: 'claude-code',
          agentName: `Agent ${agentId}`,
          pid: parseInt(agentId.split('-')[2]),
          status: 'running',
          lastHeartbeat: Date.now(),
          proxyPort: port,
          registeredAt: Date.now(),
        });
      }

      expect(registry.getAll()).toHaveLength(3);

      // Remove all agents
      for (const agentId of agents) {
        registry.remove(agentId);
        await proxyPool.close(agentId);
      }

      expect(registry.getAll()).toHaveLength(0);
    });
  });

  describe('Full Agent Lifecycle', () => {
    it('should handle complete agent lifecycle from registration to removal', async () => {
      const agentId = 'agent-lifecycle-full';

      // 1. Register agent
      const proxyPort = await proxyPool.allocate(agentId);
      const agent = registry.add({
        agentId,
        agentType: 'claude-code',
        agentName: 'Claude Code',
        pid: 1234,
        status: 'running',
        lastHeartbeat: Date.now(),
        proxyPort,
        registeredAt: Date.now(),
      });

      expect(agent.agentId).toBe(agentId);
      expect(registry.getAll()).toHaveLength(1);

      // 2. Send heartbeat
      await new Promise(resolve => setTimeout(resolve, 5));
      const heartbeatUpdated = registry.updateHeartbeat(agentId);
      expect(heartbeatUpdated).toBe(true);

      // 3. Update status to busy
      const statusUpdated = registry.updateStatus(agentId, 'busy');
      expect(statusUpdated).toBe(true);
      expect(registry.get(agentId)?.status).toBe('busy');

      // 4. Send another heartbeat
      await new Promise(resolve => setTimeout(resolve, 5));
      registry.updateHeartbeat(agentId);

      // 5. Update status back to idle
      registry.updateStatus(agentId, 'idle');
      expect(registry.get(agentId)?.status).toBe('idle');

      // 6. Remove agent
      const removed = registry.remove(agentId);
      expect(removed).toBe(true);
      expect(registry.get(agentId)).toBeUndefined();

      // 7. Cleanup proxy
      await proxyPool.close(agentId);
      expect(registry.getAll()).toHaveLength(0);
    });

    it('should handle concurrent agent lifecycles', async () => {
      const agentIds = ['agent-concurrent-1', 'agent-concurrent-2', 'agent-concurrent-3'];

      // Register all agents
      for (const agentId of agentIds) {
        const port = await proxyPool.allocate(agentId);
        registry.add({
          agentId,
          agentType: 'claude-code',
          agentName: `Agent ${agentId}`,
          pid: parseInt(agentId.split('-')[2]),
          status: 'running',
          lastHeartbeat: Date.now(),
          proxyPort: port,
          registeredAt: Date.now(),
        });
      }

      expect(registry.getAll()).toHaveLength(3);

      // Simulate concurrent heartbeats
      const heartbeatPromises = agentIds.map(async (agentId) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        return registry.updateHeartbeat(agentId);
      });

      const results = await Promise.all(heartbeatPromises);
      expect(results.every(r => r === true)).toBe(true);

      // Simulate concurrent status updates
      const statusPromises = agentIds.map(async (agentId) => {
        await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
        const statuses: Array<'busy' | 'idle'> = ['busy', 'idle'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        return registry.updateStatus(agentId, status);
      });

      await Promise.all(statusPromises);

      // Verify all agents still exist
      expect(registry.getAll()).toHaveLength(3);

      // Cleanup
      for (const agentId of agentIds) {
        registry.remove(agentId);
        await proxyPool.close(agentId);
      }

      expect(registry.getAll()).toHaveLength(0);
    });
  });
});
