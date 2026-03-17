/**
 * HuiNet Proxy Server - WebSocket Module
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import { URL } from 'url';
import { WebSocketClient, WSMessage } from '../types';

export interface WebSocketConfig {
  port: number;
  host: string;
  apiKey: string;
  heartbeatInterval: number;
}

export interface WebSocketDeps {
  onMessage: (client: WebSocketClient, message: WSMessage) => void;
  onDisconnect: (clientId: string) => void;
}

export class WebSocketModule {
  private wss?: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private config: WebSocketConfig;
  private deps: WebSocketDeps;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(config: WebSocketConfig, deps: WebSocketDeps) {
    this.config = config;
    this.deps = deps;

    // Validate config
    if (config.heartbeatInterval < 1000) {
      throw new Error('heartbeatInterval must be at least 1000ms');
    }
  }

  /**
   * Start WebSocket server
   */
  start(): void {
    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
    });

    this.setupConnectionHandler();
    this.startHeartbeat();

    const address = this.config.host === '0.0.0.0' ? 'localhost' : this.config.host;
    console.log(`[WebSocket] Listening on ws://${address}:${this.config.port}`);
  }

  /**
   * Stop WebSocket server
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      // Stop heartbeat
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer);
      }

      // Close all client connections
      for (const client of this.clients.values()) {
        try {
          client.socket.close(1001, 'Server shutting down');
        } catch {
          // Ignore close errors
        }
      }
      this.clients.clear();

      // Close server
      if (this.wss) {
        this.wss.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Setup connection handler
   */
  private setupConnectionHandler(): void {
    if (!this.wss) return;

    this.wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
      // Authenticate connection
      const authResult = this.authenticate(req.url || '');

      if (!authResult.valid) {
        socket.close(4001, 'Authentication failed');
        return;
      }

      // Create client
      const clientId = this.generateClientId();
      const client: WebSocketClient = {
        id: clientId,
        socket,
        apiKey: authResult.apiKey || '',
        connectedAt: Date.now(),
        subscriptions: [],
      };

      // Store client
      this.clients.set(clientId, client);

      // Setup socket handlers
      this.setupSocketHandlers(client);

      // Send welcome message
      this.sendToClient(client, {
        type: 'message',
        data: { connected: true, clientId },
        timestamp: Date.now(),
      });
    });
  }

  /**
   * Authenticate WebSocket connection
   */
  private authenticate(url: string): { valid: boolean; apiKey?: string } {
    try {
      const parsed = new URL(url, 'ws://localhost');
      const apiKey = parsed.searchParams.get('apiKey');

      if (!apiKey) {
        return { valid: false };
      }

      if (apiKey !== this.config.apiKey) {
        return { valid: false };
      }

      return { valid: true, apiKey };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Setup socket event handlers for a client
   */
  private setupSocketHandlers(client: WebSocketClient): void {
    const socket = client.socket as WebSocket;

    // Handle incoming messages
    socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        this.handleClientMessage(client, message);
      } catch (error) {
        // Send error response
        this.sendToClient(client, {
          type: 'error',
          data: { error: 'Invalid message format' },
          timestamp: Date.now(),
        });
      }
    });

    // Handle close
    socket.on('close', () => {
      this.clients.delete(client.id);
      this.deps.onDisconnect(client.id);
    });

    // Handle errors
    socket.on('error', () => {
      // Error logged by ws library
    });

    // Handle pong
    socket.on('pong', () => {
      (socket as any).isAlive = true;
    });
  }

  /**
   * Handle message from client
   */
  private handleClientMessage(client: WebSocketClient, message: WSMessage): void {
    switch (message.type) {
      case 'ping':
        this.sendToClient(client, {
          type: 'pong',
          timestamp: Date.now(),
        });
        break;

      case 'subscribe':
        // Handle subscription (if message.data contains types)
        if (message.data && typeof message.data === 'object' && 'types' in message.data) {
          const types = message.data.types as string[];
          client.subscriptions = types;
        }
        break;

      case 'unsubscribe':
        client.subscriptions = [];
        break;

      default:
        // Forward to message handler
        this.deps.onMessage(client, message);
        break;
    }
  }

  /**
   * Send message to a specific client
   */
  sendToClient(client: WebSocketClient, message: WSMessage): boolean {
    try {
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(JSON.stringify(message));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WSMessage): number {
    let sent = 0;
    for (const client of this.clients.values()) {
      if (this.sendToClient(client, message)) {
        sent++;
      }
    }
    return sent;
  }

  /**
   * Broadcast message to clients with matching subscriptions
   */
  broadcastToSubscribers(messageType: string, message: WSMessage): number {
    let sent = 0;
    for (const client of this.clients.values()) {
      if (client.subscriptions.length === 0 || client.subscriptions.includes(messageType)) {
        if (this.sendToClient(client, message)) {
          sent++;
        }
      }
    }
    return sent;
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [id, client] of this.clients.entries()) {
        const socket = client.socket as WebSocket;

        // Mark for termination
        if (!(socket as any).isAlive) {
          socket.terminate();
          this.clients.delete(id);
          continue;
        }

        // Mark as dead, will be terminated if no pong received
        (socket as any).isAlive = false;

        // Send ping
        if (socket.readyState === WebSocket.OPEN) {
          socket.ping();
        }
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get client by ID
   */
  getClient(id: string): WebSocketClient | undefined {
    return this.clients.get(id);
  }

  /**
   * Get all clients
   */
  getAllClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }
}
