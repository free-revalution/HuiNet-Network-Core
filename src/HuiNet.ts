import { EventEmitter } from 'events';
import { KeyPair, generateKeyPair, deriveNodeID } from './crypto/keypair';
import { RoutingTable } from './routing/table';
import { ConnectionPool } from './transport/pool';
import { ConnectionType, TransportType, NodeState } from './types/connection';
import { MDiscoveryService } from './discovery/mdns';
import { TCPServer } from './transport/server';
import { TCPClient } from './transport/client';

export interface HuiNetConfig {
  keyPair?: KeyPair;
  listenPort?: number;
  listenHost?: string;
  bootstrapNodes?: string[];
  maxCoreConnections?: number;
  maxActiveConnections?: number;
  enableMDNS?: boolean;
}

export class HuiNet extends EventEmitter {
  private config: Required<HuiNetConfig>;
  private keyPair: KeyPair;
  private nodeID: string;
  private routingTable: RoutingTable;
  private connectionPool: ConnectionPool;
  private mdnsService: MDiscoveryService | null = null;
  private tcpServer: TCPServer | null = null;
  private clients: Map<string, TCPClient> = new Map();
  private running = false;

  constructor(config: HuiNetConfig = {}) {
    super();

    this.keyPair = config.keyPair || generateKeyPair();
    this.nodeID = deriveNodeID(this.keyPair.publicKey);

    this.config = {
      keyPair: this.keyPair,
      listenPort: config.listenPort || 8000,
      listenHost: config.listenHost || '0.0.0.0',
      bootstrapNodes: config.bootstrapNodes || [],
      maxCoreConnections: config.maxCoreConnections || 10,
      maxActiveConnections: config.maxActiveConnections || 50,
      enableMDNS: config.enableMDNS !== false,
    };

    this.routingTable = new RoutingTable();
    this.connectionPool = new ConnectionPool({
      maxCoreConnections: this.config.maxCoreConnections,
      maxActiveConnections: this.config.maxActiveConnections,
    });

    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.running) return;

    // Start TCP server
    this.tcpServer = new TCPServer({
      host: this.config.listenHost,
      port: this.config.listenPort,
      nodeId: this.nodeID,
    });

    this.tcpServer.on('listening', () => {
      // Server started silently
    });

    this.tcpServer.on('connection', () => {
      // Connection logged silently
    });

    this.tcpServer.on('message', ({ connection, message: msgData }) => {
      try {
        // The message event contains { connection, message: {...} }
        // msgData.message is the actual data we sent
        this.emit('message', connection.nodeId || connection.remoteAddress, msgData);
      } catch (error) {
        // Silently handle parse errors
      }
    });

    this.tcpServer.on('disconnection', (connection) => {
      if (connection.nodeId) {
        this.emit('peerDisconnected', connection.nodeId);
      }
    });

    await this.tcpServer.start();

    // Start mDNS discovery
    if (this.config.enableMDNS) {
      this.mdnsService = new MDiscoveryService({
        nodeId: this.nodeID,
        port: this.config.listenPort,
      });

      this.mdnsService.on('discovered', (event) => {
        this.handleDiscoveredNode(event);
      });

      await this.mdnsService.start();
    }

    // Connect to bootstrap nodes
    for (const address of this.config.bootstrapNodes) {
      const [host, port] = address.split(':');
      if (host && port) {
        this.connectToNode(host, parseInt(port)).catch(() => {
          // Silently handle connection errors
        });
      }
    }

    this.running = true;
    this.emit('ready');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    // Stop TCP server
    if (this.tcpServer) {
      await this.tcpServer.stop();
      this.tcpServer = null;
    }

    // Stop mDNS
    if (this.mdnsService) {
      await this.mdnsService.stop();
      this.mdnsService = null;
    }

    // Disconnect all clients
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();

    // Disconnect all connections
    await this.connectionPool.disconnectAll();

    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  getNodeID(): string {
    return this.nodeID;
  }

  getPublicKey(): Buffer {
    return this.keyPair.publicKey;
  }

  async send(targetNodeID: string, message: any): Promise<void> {
    const messageData = JSON.stringify({
      from: this.nodeID,
      to: targetNodeID,
      timestamp: Date.now(),
      data: message
    });

    // Find the node in routing table
    const knownNode = this.routingTable.getKnownNode(targetNodeID);
    if (knownNode && knownNode.addresses.length > 0) {
      const address = knownNode.addresses[0];
      const host = address.host;
      const port = address.port;

      // Get or create client
      const clientKey = `${host}:${port}`;
      let client = this.clients.get(clientKey);

      if (!client || !client.isConnected()) {
        client = new TCPClient({ nodeId: this.nodeID });
        this.clients.set(clientKey, client);

        client.on('message', ({ message: msg }) => {
          try {
            const data = JSON.parse(msg);
            this.emit('message', targetNodeID, data);
          } catch {
            // Silently handle parse errors
          }
        });

        await client.connect(host, port);
      }

      // Send message
      client.send(Buffer.from(messageData));
    } else {
      throw new Error(`Unknown node: ${targetNodeID}`);
    }
  }

  async connectToNode(host: string, port: number, nodeID?: string): Promise<boolean> {
    const client = new TCPClient({ nodeId: this.nodeID });
    const clientKey = `${host}:${port}`;

    // Add error handler to prevent unhandled errors
    client.on('error', () => {
      // Error will be caught by the promise rejection
    });

    try {
      // Add timeout to prevent hanging
      await Promise.race([
        client.connect(host, port),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        )
      ]) as Promise<void>;

      // 验证连接状态
      if (!client.isConnected()) {
        return false;
      }

      // 使用 clientKey 作为临时 nodeID（如果没有提供）
      const effectiveNodeID = nodeID || clientKey;

      // 连接成功，添加到路由表
      this.routingTable.addKnownNode({
        nodeID: effectiveNodeID,
        addresses: [{
          type: TransportType.TCP,
          host: host,
          port: port,
          priority: 1,
          lastVerified: Date.now(),
        }],
        publicKey: Buffer.alloc(32), // Placeholder
        metadata: {
          version: '1.0.0',
          capabilities: [],
          startTime: Date.now(),
        },
        state: NodeState.ONLINE,
        lastSeen: Date.now(),
        connectionCount: 1,
      });

      // 设置事件监听
      client.on('disconnected', () => {
        this.emit('peerDisconnected', effectiveNodeID);
        this.clients.delete(clientKey);
      });

      client.on('message', ({ message }) => {
        try {
          const data = JSON.parse(message);
          this.emit('message', effectiveNodeID, data);
        } catch {
          // 忽略解析错误
        }
      });

      this.clients.set(clientKey, client);
      this.emit('peerConnected', effectiveNodeID);

      return true;

    } catch (error) {
      // 连接失败，清理资源
      try {
        client.disconnect();
      } catch {}
      return false;
    }
  }

  getRoutingTable(): RoutingTable {
    return this.routingTable;
  }

  getConnectionPool(): ConnectionPool {
    return this.connectionPool;
  }

  private setupEventHandlers(): void {
    this.connectionPool.on('connected', (nodeID: string, type: ConnectionType) => {
      this.emit('peerConnected', nodeID, type);
    });

    this.connectionPool.on('disconnected', (nodeID: string) => {
      this.emit('peerDisconnected', nodeID);
    });
  }

  private handleDiscoveredNode(event: any): void {
    this.emit('nodeDiscovered', event);

    // Add to routing table immediately when discovered
    if (event.nodeId && event.address) {
      const [host, port] = event.address.split(':');
      if (host && port) {
        this.routingTable.addKnownNode({
          nodeID: event.nodeId,
          addresses: [{
            type: TransportType.TCP,
            host: host,
            port: parseInt(port),
            priority: 1,
            lastVerified: Date.now(),
          }],
          publicKey: Buffer.alloc(32), // Placeholder
          metadata: {
            version: '1.0.0',
            capabilities: [],
            startTime: Date.now(),
          },
          state: NodeState.UNKNOWN,
          lastSeen: Date.now(),
          connectionCount: 0,
        });

        // Automatically connect to discovered node
        if (!this.clients.has(event.address)) {
          this.connectToNode(host, parseInt(port), event.nodeId)
            .catch(() => {
              // Silently handle connection errors
            });
        }
      }
    }
  }
}
