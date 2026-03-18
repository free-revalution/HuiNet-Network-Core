/**
 * Message Router
 *
 * Routes messages between agents and the P2P network.
 * Local agents connect via WebSocket; remote agents via P2P.
 */

import { EventEmitter } from 'events';
import type { HuiNet } from '../../src';
import type { JSONRPCRequest, P2PMessageEnvelope, AgentInfo } from '../types';
import { JSONRPCProtocol, A2AMethod } from '../protocol/json-rpc';

/**
 * Router configuration
 */
export interface RouterConfig {
  /** Local machine ID */
  machineId: string;

  /** Message timeout in milliseconds */
  messageTimeout: number;

  /** Max retries for failed messages */
  maxRetries: number;
}

/**
 * Message routing result
 */
export enum RouteResult {
  SUCCESS = 'success',
  NOT_FOUND = 'not_found',
  TIMEOUT = 'timeout',
  ERROR = 'error',
}

/**
 * Pending request tracker
 */
interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Message Router
 */
export class MessageRouter extends EventEmitter {
  private huinet: HuiNet;
  private config: RouterConfig;
  private agentProxies: Map<string, any>; // AgentProxy instances
  private pendingRequests = new Map<string, PendingRequest>();
  private nodeIdToAgentId = new Map<string, string>();
  private agentRegistry = new Map<string, AgentInfo>();

  constructor(huiNet: HuiNet, config: RouterConfig) {
    super();
    this.huinet = huinet;
    this.config = config;
    this.agentProxies = new Map();

    // Listen for incoming P2P messages
    this.huinet.on('message', (fromNodeID: string, message: any) => {
      this.handleP2PMessage(fromNodeID, message);
    });
  }

  /**
   * Register an agent proxy
   */
  registerAgentProxy(agentId: string, proxy: any): void {
    this.agentProxies.set(agentId, proxy);

    proxy.on('message', async (_srcAgentId: string, request: JSONRPCRequest) => {
      await this.handleAgentMessage(agentId, request);
    });

    proxy.on('agentConnected', (id: string) => {
      const info = proxy.getInfo();
      this.agentRegistry.set(id, info);
      this.emit('agentConnected', info);

      // Announce agent to P2P network
      this.announceAgent(info);
    });

    proxy.on('agentDisconnected', (id: string) => {
      this.agentRegistry.delete(id);
      this.nodeIdToAgentId.delete(this.huinet.getNodeID());
      this.emit('agentDisconnected', id);
    });
  }

  /**
   * Unregister an agent proxy
   */
  unregisterAgentProxy(agentId: string): void {
    const proxy = this.agentProxies.get(agentId);
    if (proxy) {
      this.agentProxies.delete(agentId);
      this.agentRegistry.delete(agentId);
    }
  }

  /**
   * Get all registered agents
   */
  getRegisteredAgents(): AgentInfo[] {
    return Array.from(this.agentRegistry.values());
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentInfo | undefined {
    return this.agentRegistry.get(agentId);
  }

  /**
   * Route a message from an agent
   */
  async routeFromAgent(
    fromAgentId: string,
    request: JSONRPCRequest
  ): Promise<unknown> {
    const method = request.method;

    switch (method) {
      case A2AMethod.SEND_MESSAGE:
        return this.handleSendMessage(fromAgentId, request.params);

      case A2AMethod.BROADCAST:
        return this.handleBroadcast(fromAgentId, request.params);

      case A2AMethod.LIST_AGENTS:
        return this.handleListAgents();

      case A2AMethod.GET_AGENT_INFO:
        return this.handleGetAgentInfo(request.params);

      case A2AMethod.HEARTBEAT:
        return this.handleHeartbeat(fromAgentId);

      case A2AMethod.TASK_EXECUTE:
        return this.handleTaskExecute(fromAgentId, request.params, request.id);

      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Handle message from agent (via proxy)
   */
  private async handleAgentMessage(
    agentId: string,
    request: JSONRPCRequest
  ): Promise<void> {
    try {
      // If notification, handle without response
      if (JSONRPCProtocol.isNotification(request)) {
        await this.routeFromAgent(agentId, request);
        return;
      }

      // If request, route and send response
      const result = await this.routeFromAgent(agentId, request);

      const proxy = this.agentProxies.get(agentId);
      if (proxy) {
        proxy.sendResponse(
          JSONRPCProtocol.createResponse(request.id!, result)
        );
      }
    } catch (error) {
      const proxy = this.agentProxies.get(agentId);
      if (proxy) {
        proxy.sendResponse(
          JSONRPCProtocol.createResponse(
            request.id!,
            undefined,
            JSONRPCProtocol.createError(
              -32603,
              (error as Error).message
            )
          )
        );
      }
    }
  }

  /**
   * Handle incoming P2P message
   */
  private handleP2PMessage(fromNodeID: string, message: any): void {
    // Check if this is a P2P message envelope
    if (message.type === 'a2a.message') {
      const envelope = message as P2PMessageEnvelope;

      // Find local agent
      const proxy = this.agentProxies.get(envelope.to);

      if (proxy && proxy.isConnected()) {
        // Forward to local agent
        proxy.sendRequest(envelope.payload);
      }
    }
  }

  /**
   * Send message to another agent (via P2P if remote)
   */
  private async handleSendMessage(
    fromAgentId: string,
    params: unknown
  ): Promise<boolean> {
    const { to, message } = params as { to: string; message: unknown };

    // Check if target is local
    const localProxy = this.agentProxies.get(to);
    if (localProxy && localProxy.isConnected()) {
      // Local delivery
      return localProxy.sendRequest({
        jsonrpc: '2.0',
        method: 'a2a.message',
        params: {
          from: fromAgentId,
          message,
        },
      });
    }

    // Remote delivery via P2P
    // Find target node ID from agent registry
    // For now, we'll try direct delivery to P2P node
    // In production, this would query a directory service

    const envelope: P2PMessageEnvelope = {
      from: fromAgentId,
      to,
      payload: {
        jsonrpc: '2.0',
        method: 'a2a.message',
        params: {
          from: fromAgentId,
          message,
        },
      },
      timestamp: Date.now(),
    };

    try {
      await this.huinet.send(to, envelope);
      return true;
    } catch (error) {
      console.error('Failed to send message via P2P:', error);
      return false;
    }
  }

  /**
   * Handle broadcast message
   */
  private async handleBroadcast(
    fromAgentId: string,
    params: unknown
  ): Promise<number> {
    const { message } = params as { message: unknown };

    // Broadcast to all local agents
    let localCount = 0;
    for (const [agentId, proxy] of this.agentProxies.entries()) {
      if (agentId !== fromAgentId && proxy.isConnected()) {
        proxy.sendRequest({
          jsonrpc: '2.0',
          method: 'a2a.message',
          params: {
            from: fromAgentId,
            message,
          },
        });
        localCount++;
      }
    }

    // Broadcast to P2P network
    const envelope: P2PMessageEnvelope = {
      from: fromAgentId,
      to: '*', // Broadcast
      payload: {
        jsonrpc: '2.0',
        method: 'a2a.message',
        params: {
          from: fromAgentId,
          message,
        },
      },
      timestamp: Date.now(),
    };

    try {
      await this.huinet.broadcast(envelope);
    } catch (error) {
      console.error('Failed to broadcast via P2P:', error);
    }

    return localCount;
  }

  /**
   * Handle list agents request
   */
  private handleListAgents(): AgentInfo[] {
    return this.getRegisteredAgents();
  }

  /**
   * Handle get agent info request
   */
  private handleGetAgentInfo(params: unknown): AgentInfo | undefined {
    const { agentId } = params as { agentId: string };

    // Check local agents
    const localAgent = this.agentRegistry.get(agentId);
    if (localAgent) {
      return localAgent;
    }

    // For remote agents, would query directory service
    return undefined;
  }

  /**
   * Handle heartbeat
   */
  private handleHeartbeat(agentId: string): { status: string } {
    const agent = this.agentRegistry.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
    }

    return { status: 'ok' };
  }

  /**
   * Handle task execution
   */
  private async handleTaskExecute(
    fromAgentId: string,
    params: unknown,
    requestId: string | number | undefined
  ): Promise<{ taskId: string }> {
    const { to, task } = params as { to: string; task: unknown };

    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Send task to target agent
    const envelope: P2PMessageEnvelope = {
      from: fromAgentId,
      to,
      payload: {
        jsonrpc: '2.0',
        method: 'a2a.task.execute',
        params: {
          taskId,
          task,
        },
        id: requestId,
      },
      timestamp: Date.now(),
    };

    try {
      await this.huinet.send(to, envelope);
      return { taskId };
    } catch (error) {
      throw new Error(`Failed to send task: ${(error as Error).message}`);
    }
  }

  /**
   * Announce agent to P2P network
   */
  private announceAgent(info: AgentInfo): void {
    const announcement = {
      type: 'a2a.announce',
      agentId: info.id,
      nodeId: this.huinet.getNodeID(),
      machineId: this.config.machineId,
      timestamp: Date.now(),
    };

    // Broadcast to P2P network
    this.huinet.broadcast(announcement);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clear pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Router destroyed'));
    }
    this.pendingRequests.clear();

    // Unregister all agents
    this.agentProxies.clear();
    this.agentRegistry.clear();
    this.nodeIdToAgentId.clear();
  }
}
