/**
 * Admin REST API for HuiNet Daemon
 * Provides HTTP endpoints for agent management
 */

import express, { Request, Response, NextFunction } from 'express';
import { AgentRegistry, AgentStats } from './registry';
import { HTTPProxyPool } from './proxy';
import { DaemonConfig, AgentInfo } from './types';

/**
 * Request body for agent registration
 */
interface RegisterRequest {
  agentType: string;
  agentName: string;
  pid: number;
  status: AgentInfo['status'];
}

/**
 * Request body for heartbeat
 */
interface HeartbeatRequest {
  agentId: string;
}

/**
 * Response for agent registration
 */
interface RegisterResponse {
  agentId: string;
  proxyPort: number;
  heartbeatInterval: number;
}

/**
 * Response for heartbeat
 */
interface HeartbeatResponse {
  registered: boolean;
  networkTime: number;
}

/**
 * Response for status endpoint
 */
interface StatusResponse {
  status: string;
  machineId: string;
  stats: AgentStats;
  proxyStats: { total: number; active: number };
}

/**
 * Topology response
 */
interface TopologyResponse {
  machines: Array<{
    machineId: string;
    machineName: string;
    location: string;
    agents: AgentInfo[];
  }>;
}

/**
 * Error response
 */
interface ErrorResponse {
  error: string;
}

/**
 * Generate a unique agent ID
 */
function generateAgentId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `agent-${timestamp}-${random}`;
}

/**
 * Group agents by machine for topology view
 */
function groupByMachine(
  agents: AgentInfo[],
  machineInfo?: { machineId: string; machineName: string; location: string }
): TopologyResponse['machines'] {
  const machineMap = new Map<string, AgentInfo[]>();

  // Group agents by machine
  for (const agent of agents) {
    const machineAgents = machineMap.get(agent.machineId) || [];
    machineAgents.push(agent);
    machineMap.set(agent.machineId, machineAgents);
  }

  // Convert to array with machine info
  const machines: TopologyResponse['machines'] = [];

  for (const [machineId, agents] of machineMap.entries()) {
    // Use provided machineInfo if it matches, otherwise use placeholders
    if (machineInfo && machineInfo.machineId === machineId) {
      machines.push({
        machineId,
        machineName: machineInfo.machineName,
        location: machineInfo.location,
        agents,
      });
    } else {
      // Placeholder info for machines we don't have info for
      machines.push({
        machineId,
        machineName: `machine-${machineId.substring(0, 8)}`,
        location: 'unknown',
        agents,
      });
    }
  }

  return machines;
}

/**
 * Setup Admin API
 *
 * @param registry - Agent registry instance
 * @param proxyPool - HTTP proxy pool instance
 * @param config - Daemon configuration
 * @param machineInfo - Machine information (optional, will be inferred from agents if not provided)
 * @returns Express application
 */
export function setupAdminAPI(
  registry: AgentRegistry,
  proxyPool: HTTPProxyPool,
  config: Required<DaemonConfig>,
  machineInfo?: { machineId: string; machineName: string; location: string }
): express.Application {
  const app = express();

  // Middleware
  app.use(express.json());

  // Error handling middleware
  const asyncHandler = (
    fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
  ) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * GET /api/status
   * Returns daemon status, machine ID, and statistics
   */
  app.get('/api/status', asyncHandler(async (req: Request, res: Response) => {
    const stats = registry.getStats();
    const proxyStats = proxyPool.getStats();

    // Get machineId from parameter, first agent, or use 'unknown'
    let machineId = machineInfo?.machineId;
    if (!machineId) {
      const agents = registry.getAll();
      if (agents.length > 0) {
        machineId = agents[0].machineId;
      } else {
        machineId = 'unknown';
      }
    }

    const response: StatusResponse = {
      status: 'running',
      machineId,
      stats,
      proxyStats,
    };

    res.json(response);
  }));

  /**
   * POST /api/agents/register
   * Registers a new agent and allocates a proxy port
   */
  app.post(
    '/api/agents/register',
    asyncHandler(async (req: Request, res: Response) => {
      const { agentType, agentName, pid, status } = req.body as RegisterRequest;

      // Validate required fields
      if (!agentType || !agentName || pid === undefined || !status) {
        const errorResponse: ErrorResponse = {
          error: 'Missing required fields: agentType, agentName, pid, status',
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Generate agent ID
      const agentId = generateAgentId();

      // Allocate proxy port
      const proxyPort = await proxyPool.allocate(agentId);

      // Register agent
      const agent = registry.add({
        agentId,
        agentType,
        agentName,
        pid,
        status,
        lastHeartbeat: Date.now(),
        registeredAt: Date.now(),
        proxyPort,
      });

      const response: RegisterResponse = {
        agentId: agent.agentId,
        proxyPort: agent.proxyPort!,
        heartbeatInterval: config.heartbeatInterval,
      };

      res.json(response);
    })
  );

  /**
   * POST /api/agents/heartbeat
   * Updates agent heartbeat timestamp
   */
  app.post(
    '/api/agents/heartbeat',
    asyncHandler(async (req: Request, res: Response) => {
      const { agentId } = req.body as HeartbeatRequest;

      // Validate required fields
      if (!agentId) {
        const errorResponse: ErrorResponse = {
          error: 'Missing required field: agentId',
        };
        res.status(400).json(errorResponse);
        return;
      }

      // Update heartbeat
      const registered = registry.updateHeartbeat(agentId);

      const response: HeartbeatResponse = {
        registered,
        networkTime: Date.now(),
      };

      res.json(response);
    })
  );

  /**
   * GET /api/agents
   * Returns list of all registered agents
   */
  app.get('/api/agents', asyncHandler(async (req: Request, res: Response) => {
    const agents = registry.getAll();
    res.json(agents);
  }));

  /**
   * GET /api/topology
   * Returns network topology grouped by machine
   */
  app.get(
    '/api/topology',
    asyncHandler(async (req: Request, res: Response) => {
      const agents = registry.getAll();
      const machines = groupByMachine(agents, machineInfo);

      const response: TopologyResponse = {
        machines,
      };

      res.json(response);
    })
  );

  /**
   * DELETE /api/agents/:agentId
   * Removes an agent from the registry
   */
  app.delete(
    '/api/agents/:agentId',
    asyncHandler(async (req: Request, res: Response) => {
      const { agentId } = req.params;
      const id = Array.isArray(agentId) ? agentId[0] : agentId;

      const removed = registry.remove(id);

      if (!removed) {
        const errorResponse: ErrorResponse = {
          error: `Agent not found: ${id}`,
        };
        res.status(404).json(errorResponse);
        return;
      }

      // Close proxy for this agent
      await proxyPool.close(id);

      res.status(200).send();
    })
  );

  /**
   * Global error handler
   */
  app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('API Error:', err);
    const errorResponse: ErrorResponse = {
      error: err.message || 'Internal server error',
    };
    res.status(500).json(errorResponse);
  });

  return app;
}
