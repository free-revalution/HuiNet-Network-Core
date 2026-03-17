/**
 * HuiNet Proxy Server - Main Controller
 */

import express, { Express } from 'express';
import { HuiNet } from '@huinet/network';
import { ConfigManager } from './config/ConfigManager';
import { HttpApiModule } from './modules/HttpApiModule';
import { WebSocketModule } from './modules/WebSocketModule';
import { MessageHistory } from './modules/MessageHistory';
import { createAuthMiddleware, errorHandler } from './middleware/AuthMiddleware';
import { ProxyConfig, ProxyMessage, WebSocketClient, WSMessage } from './types';

export class HuiNetProxy {
  private config: ProxyConfig;
  private configManager: ConfigManager;
  private huinet: HuiNet;
  private app: Express;
  private httpServer?: ReturnType<Express['listen']>;
  private wsModule?: WebSocketModule;
  private messageHistory: MessageHistory;
  private running = false;

  constructor(userConfig: Partial<ProxyConfig> = {}) {
    this.configManager = new ConfigManager(userConfig);
    this.config = this.configManager.getConfig();

    // Validate configuration
    const validation = this.configManager.validate();
    if (!validation.valid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Initialize HuiNet SDK
    this.huinet = new HuiNet({
      listenPort: this.config.huinet.listenPort,
      listenHost: this.config.host,
      enableMDNS: this.config.huinet.enableMDNS,
      bootstrapNodes: this.config.huinet.bootstrapNodes,
    });

    // Initialize Message History
    this.messageHistory = new MessageHistory({
      maxEntries: 1000,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Initialize Express app
    this.app = express();

    // Initialize WebSocket module
    this.wsModule = new WebSocketModule(
      {
        port: this.config.wsPort,
        host: this.config.host,
        apiKey: this.config.apiKey,
        heartbeatInterval: 30000,
      },
      {
        onMessage: this.handleWsMessage.bind(this),
        onDisconnect: this.handleWsDisconnect.bind(this),
      }
    );

    // Setup middleware and routes
    this.setupMiddleware();
    this.setupRoutes();
    this.setupEventHandlers();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Body parser
    this.app.use(express.json());

    // Request logging (if debug mode)
    if (this.config.logLevel === 'debug') {
      this.app.use((req, res, next) => {
        console.log(`[DEBUG] ${req.method} ${req.path}`);
        next();
      });
    }

    // Authentication middleware
    this.app.use('/api', createAuthMiddleware(this.config.apiKey));
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check (no auth required)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        running: this.running,
        wsClients: this.wsModule?.getClientCount() || 0,
      });
    });

    // API routes
    const httpApi = new HttpApiModule({
      huinet: this.huinet,
      messageHistory: this.messageHistory,
    });
    this.app.use('/api', httpApi.getRouter());

    // Error handler
    this.app.use(errorHandler);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Not found',
        code: 'NOT_FOUND',
      });
    });
  }

  /**
   * Setup HuiNet event handlers
   */
  private setupEventHandlers(): void {
    // Handle incoming messages from HuiNet network
    this.huinet.on('message', (from: string, message: ProxyMessage) => {
      this.log('info', `Message received from ${from}`);

      // Record in history
      this.messageHistory.add({
        from,
        data: message.data,
        timestamp: message.timestamp || Date.now(),
        direction: 'inbound',
      });

      // Broadcast to WebSocket clients
      this.broadcastToWsClients({
        type: 'message',
        from,
        data: message.data,
        timestamp: message.timestamp || Date.now(),
      });
    });

    // Handle peer connected
    this.huinet.on('peerConnected', (nodeID: string) => {
      this.log('info', `Peer connected: ${nodeID}`);

      // Notify WebSocket clients
      this.broadcastToWsClients({
        type: 'nodeStatus',
        data: { nodeID, status: 'connected' },
        timestamp: Date.now(),
      }, 'nodeStatus');
    });

    // Handle peer disconnected
    this.huinet.on('peerDisconnected', (nodeID: string) => {
      this.log('info', `Peer disconnected: ${nodeID}`);

      // Notify WebSocket clients
      this.broadcastToWsClients({
        type: 'nodeStatus',
        data: { nodeID, status: 'disconnected' },
        timestamp: Date.now(),
      }, 'nodeStatus');
    });

    // Handle node discovered
    this.huinet.on('nodeDiscovered', (event: unknown) => {
      this.log('debug', `Node discovered: ${JSON.stringify(event)}`);
    });
  }

  /**
   * Handle message from WebSocket client
   */
  private handleWsMessage(client: WebSocketClient, message: WSMessage): void {
    this.log('debug', `WS message from ${client.id}: ${message.type}`);

    // Handle client sending messages through the proxy
    if (message.type === 'message' && message.from && message.data) {
      // Forward to HuiNet network
      const targetNodeID = message.from as string;
      this.huinet.send(targetNodeID, message.data)
        .then(() => {
          // Record sent message
          this.messageHistory.add({
            from: this.huinet.getNodeID(),
            to: targetNodeID,
            data: message.data,
            timestamp: Date.now(),
            direction: 'outbound',
          });

          this.wsModule?.sendToClient(client, {
            type: 'message',
            from: this.huinet.getNodeID(),
            data: { sent: true, to: targetNodeID },
            timestamp: Date.now(),
          });
        })
        .catch((error) => {
          this.wsModule?.sendToClient(client, {
            type: 'error',
            data: { error: error.message },
            timestamp: Date.now(),
          });
        });
    }
  }

  /**
   * Handle WebSocket client disconnect
   */
  private handleWsDisconnect(clientId: string): void {
    this.log('info', `WS client disconnected: ${clientId}`);
  }

  /**
   * Broadcast message to WebSocket clients
   */
  private broadcastToWsClients(message: WSMessage, messageType?: string): void {
    if (!this.wsModule) return;

    if (messageType) {
      this.wsModule.broadcastToSubscribers(messageType, message);
    } else {
      this.wsModule.broadcast(message);
    }
  }

  /**
   * Start the proxy server
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Proxy server is already running');
    }

    this.log('info', 'Starting HuiNet SDK...');
    await this.huinet.start();
    this.log('info', `HuiNet node started: ${this.huinet.getNodeID()}`);

    this.log('info', `Starting HTTP server on ${this.config.host}:${this.config.httpPort}...`);
    this.httpServer = this.app.listen(this.config.httpPort, this.config.host);

    this.log('info', `Starting WebSocket server on ${this.config.host}:${this.config.wsPort}...`);
    this.wsModule?.start();

    this.running = true;

    const displayHost = this.config.host === '0.0.0.0' ? 'localhost' : this.config.host;
    this.log('info', `HuiNet Proxy Server started`);
    this.log('info', `  - HTTP API: http://${displayHost}:${this.config.httpPort}/api`);
    this.log('info', `  - WebSocket: ws://${displayHost}:${this.config.wsPort}`);
    this.log('info', `  - Health: http://${displayHost}:${this.config.httpPort}/health`);
    this.log('info', `  - API Key: ${this.config.apiKey}`);
  }

  /**
   * Stop the proxy server
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.log('info', 'Stopping HuiNet Proxy Server...');

    // Stop WebSocket server
    if (this.wsModule) {
      await this.wsModule.stop();
    }

    // Stop HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer?.close(() => resolve());
      });
    }

    // Stop HuiNet SDK
    await this.huinet.stop();

    this.running = false;
    this.log('info', 'HuiNet Proxy Server stopped');
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get the HuiNet instance
   */
  getHuiNet(): HuiNet {
    return this.huinet;
  }

  /**
   * Get the WebSocket module
   */
  getWebSocketModule(): WebSocketModule | undefined {
    return this.wsModule;
  }

  /**
   * Get the message history
   */
  getMessageHistory(): MessageHistory {
    return this.messageHistory;
  }

  /**
   * Get configuration
   */
  getConfig(): ProxyConfig {
    return { ...this.config };
  }

  /**
   * Log message based on log level
   */
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.config.logLevel];

    if (levels[level] >= currentLevel) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }
}
