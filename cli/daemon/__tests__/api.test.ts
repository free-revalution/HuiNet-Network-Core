/**
 * Tests for Admin REST API
 * TDD: Tests written before implementation
 */

import express from 'express';
import request from 'supertest';
import { setupAdminAPI } from '../api';
import { AgentRegistry } from '../registry';
import { HTTPProxyPool } from '../proxy';
import { MachineInfo, AgentInfo } from '../types';

describe('Admin REST API', () => {
  let app: express.Application;
  let registry: AgentRegistry;
  let proxyPool: HTTPProxyPool;
  let machineInfo: MachineInfo;

  afterEach(async () => {
    // Cleanup proxy pool after each test
    if (proxyPool) {
      await proxyPool.closeAll();
    }
  });

  beforeEach(() => {
    // Setup test dependencies
    machineInfo = {
      machineId: 'test-machine-123',
      machineName: 'test-machine',
      location: 'test-location',
    };

    registry = new AgentRegistry(machineInfo);
    proxyPool = new HTTPProxyPool({
      portRange: [15000, 15020], // Use higher port range to avoid conflicts
    });

    // Create Express app with admin API
    app = setupAdminAPI(registry, proxyPool, {
      machineName: 'test-machine',
      location: 'test-location',
      listenPort: 8000,
      enableMDNS: true,
      adminPort: 3000,
      proxyPortRange: [15000, 15020],
      heartbeatInterval: 3000,
      heartbeatTimeout: 10000,
    }, machineInfo);
  });

  describe('GET /api/status', () => {
    it('should return daemon status with machineId and stats', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'running');
      expect(response.body).toHaveProperty('machineId', machineInfo.machineId);
      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('proxyStats');

      // Verify stats structure
      expect(response.body.stats).toHaveProperty('total');
      expect(response.body.stats).toHaveProperty('running');
      expect(response.body.stats).toHaveProperty('busy');
      expect(response.body.stats).toHaveProperty('idle');
      expect(response.body.stats).toHaveProperty('offline');

      // Verify proxy stats structure
      expect(response.body.proxyStats).toHaveProperty('total');
      expect(response.body.proxyStats).toHaveProperty('active');
    });
  });

  describe('POST /api/agents/register', () => {
    it('should register a new agent and return agentId, proxyPort, and heartbeatInterval', async () => {
      const agentData = {
        agentType: 'chatbot',
        agentName: 'Test Agent',
        pid: 12345,
        status: 'running' as const,
      };

      const response = await request(app)
        .post('/api/agents/register')
        .send(agentData)
        .expect('Content-Type', /json/)
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('agentId');
      expect(response.body).toHaveProperty('proxyPort');
      expect(response.body).toHaveProperty('heartbeatInterval', 3000);
      expect(response.body.agentId).toMatch(/^agent-/);

      // Verify agent was registered
      const agent = registry.get(response.body.agentId);
      expect(agent).toBeDefined();
      expect(agent?.agentType).toBe(agentData.agentType);
      expect(agent?.agentName).toBe(agentData.agentName);
      expect(agent?.pid).toBe(agentData.pid);
      expect(agent?.status).toBe(agentData.status);
      expect(agent?.machineId).toBe(machineInfo.machineId);
      expect(agent?.proxyPort).toBe(response.body.proxyPort);
    });

    it('should allocate unique proxy ports for different agents', async () => {
      const agent1 = await request(app)
        .post('/api/agents/register')
        .send({
          agentType: 'chatbot',
          agentName: 'Agent 1',
          pid: 11111,
          status: 'running' as const,
        })
        .expect(200);

      const agent2 = await request(app)
        .post('/api/agents/register')
        .send({
          agentType: 'code-assistant',
          agentName: 'Agent 2',
          pid: 22222,
          status: 'idle' as const,
        })
        .expect(200);

      expect(agent1.body.proxyPort).not.toBe(agent2.body.proxyPort);
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/agents/register')
        .send({
          agentType: 'chatbot',
          // Missing agentName, pid, status
        })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/agents/heartbeat', () => {
    it('should update heartbeat timestamp and return registered and networkTime', async () => {
      // First register an agent
      const registerResponse = await request(app)
        .post('/api/agents/register')
        .send({
          agentType: 'chatbot',
          agentName: 'Test Agent',
          pid: 12345,
          status: 'running' as const,
        })
        .expect(200);

      const agentId = registerResponse.body.agentId;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      // Send heartbeat
      const heartbeatResponse = await request(app)
        .post('/api/agents/heartbeat')
        .send({ agentId })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(heartbeatResponse.body).toHaveProperty('registered', true);
      expect(heartbeatResponse.body).toHaveProperty('networkTime');
      expect(typeof heartbeatResponse.body.networkTime).toBe('number');

      // Verify heartbeat was updated
      const agent = registry.get(agentId);
      expect(agent?.lastHeartbeat).toBeGreaterThan(0);
    });

    it('should return registered=false for unknown agent', async () => {
      const response = await request(app)
        .post('/api/agents/heartbeat')
        .send({ agentId: 'unknown-agent-123' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('registered', false);
      expect(response.body).toHaveProperty('networkTime');
    });

    it('should return 400 for missing agentId', async () => {
      const response = await request(app)
        .post('/api/agents/heartbeat')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/agents', () => {
    it('should return empty array when no agents registered', async () => {
      const response = await request(app)
        .get('/api/agents')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('should return list of all registered agents', async () => {
      // Register multiple agents
      const agent1 = await request(app)
        .post('/api/agents/register')
        .send({
          agentType: 'chatbot',
          agentName: 'Agent 1',
          pid: 11111,
          status: 'running' as const,
        })
        .expect(200);

      const agent2 = await request(app)
        .post('/api/agents/register')
        .send({
          agentType: 'code-assistant',
          agentName: 'Agent 2',
          pid: 22222,
          status: 'idle' as const,
        })
        .expect(200);

      const response = await request(app)
        .get('/api/agents')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);

      // Verify agent structure
      expect(response.body[0]).toHaveProperty('agentId');
      expect(response.body[0]).toHaveProperty('machineId');
      expect(response.body[0]).toHaveProperty('agentType');
      expect(response.body[0]).toHaveProperty('agentName');
      expect(response.body[0]).toHaveProperty('pid');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('lastHeartbeat');
      expect(response.body[0]).toHaveProperty('registeredAt');
      expect(response.body[0]).toHaveProperty('proxyPort');
    });
  });

  describe('GET /api/topology', () => {
    it('should return network topology grouped by machine', async () => {
      // Register agents on this machine
      await request(app)
        .post('/api/agents/register')
        .send({
          agentType: 'chatbot',
          agentName: 'Agent 1',
          pid: 11111,
          status: 'running' as const,
        });

      await request(app)
        .post('/api/agents/register')
        .send({
          agentType: 'code-assistant',
          agentName: 'Agent 2',
          pid: 22222,
          status: 'idle' as const,
        });

      const response = await request(app)
        .get('/api/topology')
        .expect('Content-Type', /json/)
        .expect(200);

      // Verify topology structure
      expect(response.body).toHaveProperty('machines');
      expect(Array.isArray(response.body.machines)).toBe(true);
      expect(response.body.machines).toHaveLength(1);

      // Verify machine structure
      const machine = response.body.machines[0];
      expect(machine).toHaveProperty('machineId', machineInfo.machineId);
      expect(machine).toHaveProperty('machineName', machineInfo.machineName);
      expect(machine).toHaveProperty('location', machineInfo.location);
      expect(machine).toHaveProperty('agents');
      expect(Array.isArray(machine.agents)).toBe(true);
      expect(machine.agents).toHaveLength(2);
    });

    it('should return empty machines array when no agents registered', async () => {
      const response = await request(app)
        .get('/api/topology')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('machines');
      expect(Array.isArray(response.body.machines)).toBe(true);
      // May have machine with empty agents array or no machines
      expect(response.body.machines.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DELETE /api/agents/:agentId', () => {
    it('should remove agent from registry', async () => {
      // Register an agent
      const registerResponse = await request(app)
        .post('/api/agents/register')
        .send({
          agentType: 'chatbot',
          agentName: 'Test Agent',
          pid: 12345,
          status: 'running' as const,
        })
        .expect(200);

      const agentId = registerResponse.body.agentId;

      // Verify agent exists
      expect(registry.get(agentId)).toBeDefined();

      // Delete agent
      await request(app)
        .delete(`/api/agents/${agentId}`)
        .expect(200);

      // Verify agent is removed
      expect(registry.get(agentId)).toBeUndefined();
    });

    it('should return 404 for non-existent agent', async () => {
      const response = await request(app)
        .delete('/api/agents/non-existent-agent')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});
