/**
 * Agent WebSocket Proxy
 *
 * Provides a WebSocket interface for agents to connect to HuiNet.
 * Each agent gets its own WebSocket port for communication.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { AgentInfo, JSONRPCRequest } from '../types';
import type { AgentProxyConfig } from '../types';
import { JSONRPCProtocol } from '../protocol/json-rpc';

// Re-export AgentProxyConfig for use in other modules
export type { AgentProxyConfig } from '../types';

/**
 * Agent Proxy - manages WebSocket connection for a single agent
 */
export class AgentProxy extends EventEmitter {
  private server: WebSocketServer | null = null;
  private ws: WebSocket | null = null;
  private running = false;
  private port: number;
  private host: string;
  private agentId: string;
  private connectedAt: number | null = null;

  constructor(agentId: string, port: number, host = '127.0.0.1') {
    super();
    this.agentId = agentId;
    this.port = port;
    this.host = host;
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = new WebSocketServer({ port: this.port, host: this.host });

      this.server.on('listening', () => {
        this.running = true;
        resolve();
      });

      this.server.on('error', (err: Error) => {
        reject(err);
      });

      this.server.on('connection', (ws: WebSocket) => {
        this.handleConnection(ws);
      });
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.running = false;
          this.server = null;
          this.ws = null;
          this.connectedAt = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get agent information
   */
  getInfo(): AgentInfo {
    return {
      id: this.agentId,
      name: this.agentId,
      wsUrl: `ws://${this.host}:${this.port}`,
      proxyPort: this.port,
      registeredAt: Date.now(),
      lastHeartbeat: this.connectedAt || Date.now(),
    };
  }

  /**
   * Send a JSON-RPC request to the agent
   */
  sendRequest(request: JSONRPCRequest): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    return JSONRPCProtocol.sendRequest(this.ws, request);
  }

  /**
   * Send a JSON-RPC response to the agent
   */
  sendResponse(response: ReturnType<typeof JSONRPCProtocol.createResponse>): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    return JSONRPCProtocol.sendResponse(this.ws, response);
  }

  /**
   * Check if agent is connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection duration in milliseconds
   */
  getConnectionDuration(): number {
    if (!this.connectedAt) {
      return 0;
    }
    return Date.now() - this.connectedAt;
  }

  /**
   * Handle incoming WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    // Only one connection per agent
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      ws.close(1008, 'Agent already connected');
      return;
    }

    this.ws = ws;
    this.connectedAt = Date.now();

    this.emit('agentConnected', this.agentId);

    ws.on('message', (data: Buffer) => {
      this.handleMessage(data.toString('utf-8'));
    });

    ws.on('close', () => {
      this.ws = null;
      this.connectedAt = null;
      this.emit('agentDisconnected', this.agentId);
    });

    ws.on('error', (err: Error) => {
      console.error(`[AgentProxy:${this.agentId}] WebSocket error:`, err.message);
    });

    // Send welcome notification
    JSONRPCProtocol.sendRequest(ws, {
      jsonrpc: '2.0',
      method: 'a2a.connected',
      params: {
        agentId: this.agentId,
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Handle incoming message from agent
   */
  private handleMessage(data: string): void {
    const request = JSONRPCProtocol.parseRequest(data);

    if (!request) {
      // Send error response
      if (this.ws) {
        JSONRPCProtocol.sendResponse(
          this.ws,
          JSONRPCProtocol.createResponse(
            null,
            undefined,
            JSONRPCProtocol.createError(
              -32600,
              'Invalid Request'
            )
          )
        );
      }
      return;
    }

    // Emit request for router to handle
    this.emit('message', this.agentId, request);
  }
}

/**
 * Agent Proxy Pool - manages multiple agent proxies
 */
export class AgentProxyPool extends EventEmitter {
  private proxies = new Map<string, AgentProxy>();
  private portRange: [number, number];
  private nextPort: number;
  private host: string;

  constructor(config: AgentProxyConfig) {
    super();
    this.portRange = config.portRange;
    this.nextPort = config.portRange[0];
    this.host = config.host;
  }

  /**
   * Allocate a proxy for an agent
   */
  async allocateProxy(agentId: string): Promise<AgentProxy> {
    // Check if agent already has a proxy
    const existing = this.proxies.get(agentId);
    if (existing) {
      return existing;
    }

    // Allocate new port
    const port = this.allocatePort();

    // Create and start proxy
    const proxy = new AgentProxy(agentId, port, this.host);

    proxy.on('agentConnected', (id) => {
      this.emit('agentConnected', id);
    });

    proxy.on('agentDisconnected', (id) => {
      this.emit('agentDisconnected', id);
    });

    proxy.on('message', (agentId, request) => {
      this.emit('message', agentId, request);
    });

    await proxy.start();

    this.proxies.set(agentId, proxy);

    return proxy;
  }

  /**
   * Release a proxy
   */
  async releaseProxy(agentId: string): Promise<void> {
    const proxy = this.proxies.get(agentId);

    if (proxy) {
      await proxy.stop();
      this.proxies.delete(agentId);
    }
  }

  /**
   * Get proxy by agent ID
   */
  getProxy(agentId: string): AgentProxy | undefined {
    return this.proxies.get(agentId);
  }

  /**
   * Get all connected agents
   */
  getConnectedAgents(): AgentInfo[] {
    const agents: AgentInfo[] = [];

    for (const proxy of this.proxies.values()) {
      if (proxy.isConnected()) {
        agents.push(proxy.getInfo());
      }
    }

    return agents;
  }

  /**
   * Stop all proxies
   */
  async stopAll(): Promise<void> {
    const stopPromises: Promise<void>[] = [];

    for (const [agentId, proxy] of this.proxies.entries()) {
      stopPromises.push(
        (async () => {
          await proxy.stop();
          this.proxies.delete(agentId);
        })()
      );
    }

    await Promise.all(stopPromises);
  }

  /**
   * Allocate next available port
   */
  private allocatePort(): number {
    const port = this.nextPort;

    // Increment with wrap-around
    this.nextPort++;
    if (this.nextPort > this.portRange[1]) {
      this.nextPort = this.portRange[0];
    }

    return port;
  }
}
