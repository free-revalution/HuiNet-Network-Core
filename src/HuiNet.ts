import { EventEmitter } from 'events';
import { KeyPair, generateKeyPair, deriveNodeID } from './crypto/keypair';
import { RoutingTable } from './routing/table';
import { ConnectionPool, ConnectionType, Connection } from './transport/pool';
import { TransportType, NodeState } from './types/connection';
import { NodeID } from './types/node';
import { MDiscoveryService } from './discovery/mdns';
import { TCPServer } from './transport/server';
import { TCPClient, TCPClientConnection } from './transport/client';
import { HandshakeHandler } from './protocol/handshake';
import { HeartbeatHandler } from './protocol/heartbeat';
import { SigningManager } from './crypto/signing';
import { MessageType } from './types/message';
import { getLocalIPs, isSameSubnet } from './utils/network';
import { validateHuiNetConfig, ValidationError } from './utils/validation';

// HuiNet 配置接口
export interface HuiNetConfig {
  keyPair?: KeyPair;
  listenPort?: number;
  listenHost?: string;
  bootstrapNodes?: string[];
  maxCoreConnections?: number;
  maxActiveConnections?: number;
  enableMDNS?: boolean;
  // Routing table layer management
  promoteToActiveThreshold?: number;  // 连接次数阈值，超过后升级到 Active
  promoteToCoreThreshold?: number;    // 连接次数阈值，超过后升级到 Core
  routingCleanupInterval?: number;    // 路由表清理间隔（毫秒）
  maxNodeAge?: number;                 // 节点最大存活时间（毫秒）
}

// HuiNet 主类
export class HuiNet extends EventEmitter {
  private config: Required<HuiNetConfig>;
  private keyPair: KeyPair;
  private nodeID: string;
  private routingTable: RoutingTable;
  private connectionPool: ConnectionPool;
  private mdnsService: MDiscoveryService | null = null;
  private announceInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private tcpServer: TCPServer | null = null;
  // Store raw TCPClient instances for event handling (key: host:port)
  private rawClients: Map<string, TCPClient> = new Map();
  // Map client key to nodeID
  private clientKeyToNodeID: Map<string, string> = new Map();
  // Track node connection counts for promotion
  private nodeConnectionCounts: Map<NodeID, number> = new Map();
  private handshakeHandler: HandshakeHandler;
  private heartbeatHandler: HeartbeatHandler;
  private signingManager: SigningManager;
  private running = false;

  constructor(config: HuiNetConfig = {}) {
    super();

    // Validate configuration
    try {
      validateHuiNetConfig(config);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new Error(`Invalid HuiNet configuration: ${error.message}${error.field ? ` (field: ${error.field})` : ''}`);
      }
      throw error;
    }

    this.keyPair = config.keyPair || generateKeyPair();
    this.nodeID = deriveNodeID(this.keyPair.publicKey);

    this.config = {
      keyPair: this.keyPair,
      listenPort: config.listenPort ?? 8000, // 默认监听端口 8000
      listenHost: config.listenHost || '0.0.0.0', // 默认监听所有接口
      bootstrapNodes: config.bootstrapNodes || [],
      maxCoreConnections: config.maxCoreConnections || 10,
      maxActiveConnections: config.maxActiveConnections || 50,
      enableMDNS: config.enableMDNS !== false,
      promoteToActiveThreshold: config.promoteToActiveThreshold || 3,
      promoteToCoreThreshold: config.promoteToCoreThreshold || 10,
      routingCleanupInterval: config.routingCleanupInterval || 300000, // 5 minutes
      maxNodeAge: config.maxNodeAge || 3600000, // 1 hour
    };

    this.routingTable = new RoutingTable();
    this.connectionPool = new ConnectionPool({
      maxCoreConnections: this.config.maxCoreConnections,
      maxActiveConnections: this.config.maxActiveConnections,
    });

    // Initialize protocol handlers
    this.handshakeHandler = new HandshakeHandler();
    this.heartbeatHandler = new HeartbeatHandler();
    this.signingManager = new SigningManager(this.keyPair);

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

      // Announce this node to the network so others can discover it
      this.mdnsService.announce();

      // Set up periodic announcements (every 30 seconds)
      this.announceInterval = setInterval(() => {
        if (this.mdnsService && this.mdnsService.isRunning()) {
          this.mdnsService.announce();
        }
      }, 30000);
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

    // Start routing table cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupRoutingTable();
    }, this.config.routingCleanupInterval);

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
    if (this.announceInterval) {
      clearInterval(this.announceInterval);
      this.announceInterval = null;
    }

    if (this.mdnsService) {
      await this.mdnsService.stop();
      this.mdnsService = null;
    }

    // Stop routing table cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Disconnect all connections from connection pool
    await this.connectionPool.disconnectAll();

    // Clear raw clients map
    for (const client of this.rawClients.values()) {
      client.disconnect();
    }
    this.rawClients.clear();
    this.clientKeyToNodeID.clear();

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

  /**
   * Get routing table statistics
   */
  getRoutingStats() {
    const stats = this.routingTable.getStats();
    return {
      ...stats,
      connectionCounts: Object.fromEntries(this.nodeConnectionCounts),
    };
  }

  /**
   * Promote a node to Active layer
   */
  promoteToActive(nodeID: NodeID): boolean {
    return this.routingTable.promoteToActive(nodeID);
  }

  /**
   * Promote a node to Core layer
   */
  promoteToCore(nodeID: NodeID): boolean {
    return this.routingTable.promoteToCore(nodeID);
  }

  /**
   * Demote a node from Core to Active
   */
  demoteFromCore(nodeID: NodeID): boolean {
    return this.routingTable.demoteToActive(nodeID);
  }

  /**
   * Demote a node from Active to Known
   */
  demoteFromActive(nodeID: NodeID): boolean {
    return this.routingTable.demoteToKnown(nodeID);
  }

  /**
   * Cleanup routing table - remove stale nodes
   */
  private cleanupRoutingTable(): void {
    const cleaned = this.routingTable.cleanup(this.config.maxNodeAge);
    if (cleaned > 0) {
      this.emit('routingTableCleanup', { cleaned });
    }
  }

  /**
   * Update node connection count and check for promotion
   */
  private updateNodeConnectionCount(nodeID: NodeID): void {
    const currentCount = this.nodeConnectionCounts.get(nodeID) || 0;
    const newCount = currentCount + 1;
    this.nodeConnectionCounts.set(nodeID, newCount);

    // Auto-promote based on connection count
    if (newCount >= this.config.promoteToCoreThreshold) {
      this.routingTable.promoteToCore(nodeID);
    } else if (newCount >= this.config.promoteToActiveThreshold) {
      this.routingTable.promoteToActive(nodeID);
    }
  }

  async send(targetNodeID: string, message: any): Promise<void> {
    const messageData = JSON.stringify({
      from: this.nodeID,
      to: targetNodeID,
      timestamp: Date.now(),
      data: message
    });

    // Check if connection exists in connection pool
    if (this.connectionPool.hasConnection(targetNodeID)) {
      // Use connection pool
      await this.connectionPool.send(targetNodeID, messageData);
      return;
    }

    // Find node in routing table
    const knownNode = this.routingTable.getKnownNode(targetNodeID);

    if (!knownNode || knownNode.addresses.length === 0) {
      throw new Error(`Unknown node: ${targetNodeID}`);
    }

    const address = knownNode.addresses[0];
    const host = address.host;
    const port = address.port;

    // Attempt reconnection
    const reconnected = await this.connectToNode(host, port, targetNodeID);
    if (!reconnected) {
      throw new Error(`Failed to connect to ${targetNodeID}`);
    }

    // Send message through connection pool
    await this.connectionPool.send(targetNodeID, messageData);
  }

  async connectToNode(host: string, port: number, nodeID?: string): Promise<boolean> {
    const clientKey = `${host}:${port}`;
    const effectiveNodeID = nodeID || clientKey;

    // Check if already connected in connection pool
    if (this.connectionPool.hasConnection(effectiveNodeID)) {
      // Still update connection count to track connection frequency
      this.updateNodeConnectionCount(effectiveNodeID);
      return true;
    }

    // Create new TCP client
    const client = new TCPClient({ nodeId: this.nodeID });

    // Set up event handlers FIRST to prevent race condition
    client.on('error', () => {
      // Error will be caught by the promise rejection
    });

    client.on('disconnected', () => {
      this.emit('peerDisconnected', effectiveNodeID);
      // Remove from connection pool
      this.connectionPool.removeConnection(effectiveNodeID).catch(() => {});
      // Remove from raw clients
      this.rawClients.delete(clientKey);
      this.clientKeyToNodeID.delete(clientKey);
    });

    client.on('message', ({ message }) => {
      try {
        const data = JSON.parse(message);

        // Try to decode as protocol message first
        const { decodeMessage, MessageType } = require('./protocol');
        let decoded = null;
        try {
          decoded = decodeMessage(Buffer.from(message));
        } catch {
          // Not a protocol message, use legacy format
        }

        if (decoded) {
          // Handle protocol messages
          switch (decoded.header.type) {
            case MessageType.HANDSHAKE:
              this.handleHandshake(decoded, effectiveNodeID);
              break;
            case MessageType.HANDSHAKE_ACK:
              this.handleHandshakeAck(decoded, effectiveNodeID);
              break;
            case MessageType.HEARTBEAT:
              this.handleHeartbeat(decoded, effectiveNodeID);
              break;
            case MessageType.DISCONNECT:
              this.handleDisconnect(decoded, effectiveNodeID);
              break;
            default:
              // Business message
              this.emit('message', effectiveNodeID, decoded);
          }
        } else {
          // Legacy format
          this.emit('message', effectiveNodeID, data);
        }
      } catch (error) {
        // Ignore parse errors
      }
    });

    try {
      // Add timeout to prevent hanging
      await Promise.race([
        client.connect(host, port),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        )
      ]) as Promise<void>;

      // Verify connection state
      if (!client.isConnected()) {
        return false;
      }

      // Connection successful, add/update to routing table
      const existingNode = this.routingTable.getAnyNode(effectiveNodeID);

      if (existingNode) {
        // Node already exists, update its info
        existingNode.state = NodeState.ONLINE;
        existingNode.lastSeen = Date.now();
        existingNode.connectionCount++;

        // Update in the appropriate map
        if (this.routingTable.getCoreNode(effectiveNodeID)) {
          this.routingTable.addCoreNode(existingNode);
        } else if (this.routingTable.getActiveNode(effectiveNodeID)) {
          this.routingTable.addActiveNode(existingNode);
        } else {
          this.routingTable.addKnownNode(existingNode);
        }
      } else {
        // New node, add to Known layer first
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
      }

      // Update connection count and check for promotion
      this.updateNodeConnectionCount(effectiveNodeID);

      // Create connection adapter and add to connection pool
      const connection = new TCPClientConnection(client, effectiveNodeID);
      await this.connectionPool.addConnection(
        effectiveNodeID,
        connection,
        ConnectionType.ACTIVE
      );

      // Store raw client for event handling
      this.rawClients.set(clientKey, client);
      this.clientKeyToNodeID.set(clientKey, effectiveNodeID);

      this.emit('peerConnected', effectiveNodeID);

      return true;

    } catch (error) {
      // Connection failed, cleanup
      try {
        client.disconnect();
      } catch {
        // Ignore cleanup errors
      }
      return false;
    }
  }

  getRoutingTable(): RoutingTable {
    return this.routingTable;
  }

  getConnectionPool(): ConnectionPool {
    return this.connectionPool;
  }

  /**
   * Disconnect from a specific node
   * @param nodeID The node ID to disconnect from
   * @returns true if successfully disconnected, false otherwise
   */
  async disconnectFromNode(nodeID: string): Promise<boolean> {
    // Check if node exists in connection pool
    if (!this.connectionPool.hasConnection(nodeID)) {
      // Node doesn't exist, return false
      return false;
    }

    try {
      // Remove from connection pool
      await this.connectionPool.removeConnection(nodeID);

      // Find and remove from raw clients
      for (const [clientKey, targetNodeID] of this.clientKeyToNodeID.entries()) {
        if (targetNodeID === nodeID) {
          const client = this.rawClients.get(clientKey);
          if (client) {
            client.disconnect();
            this.rawClients.delete(clientKey);
          }
          this.clientKeyToNodeID.delete(clientKey);
          break;
        }
      }

      // Update routing table
      this.routingTable.updateNodeState(nodeID, NodeState.OFFLINE);

      // Emit disconnect event
      this.emit('peerDisconnected', nodeID);

      return true;
    } catch (error) {
      // Disconnect failed
      return false;
    }
  }

  /**
   * Get list of connected node IDs
   * @returns Array of connected node IDs
   */
  getConnectedNodes(): string[] {
    const connected: string[] = [];
    const allNodes = this.routingTable.getAllNodes();

    for (const node of allNodes) {
      if (node.state === NodeState.ONLINE) {
        connected.push(node.nodeID);
      }
    }

    return connected;
  }

  /**
   * Get handshake handler
   */
  getHandshakeHandler(): HandshakeHandler {
    return this.handshakeHandler;
  }

  /**
   * Get heartbeat handler
   */
  getHeartbeatHandler(): HeartbeatHandler {
    return this.heartbeatHandler;
  }

  /**
   * Get alive nodes based on heartbeat
   */
  getAliveNodes(): string[] {
    return this.heartbeatHandler.getAliveNodes();
  }

  /**
   * Check if a node is alive based on heartbeat
   */
  isNodeAlive(nodeID: string): boolean {
    return this.heartbeatHandler.isNodeAlive(nodeID);
  }

  /**
   * Get signing manager
   */
  getSigningManager(): SigningManager {
    return this.signingManager;
  }

  /**
   * Sign a message
   */
  signMessage(message: any): { success: boolean; signature?: Buffer; error?: string } {
    // Convert to BaseMessage format
    const baseMessage = {
      header: {
        version: '1.0.0',
        type: message.type || 10, // Default to CHAT
        from: this.nodeID,
        to: message.to,
        id: message.id || this.generateMessageID(),
        timestamp: message.timestamp || Date.now(),
      },
      body: message.data ? Buffer.from(JSON.stringify(message.data)) : Buffer.alloc(0),
      signature: Buffer.alloc(0),
    };

    return this.signingManager.signMessage(baseMessage);
  }

  /**
   * Verify a message signature
   */
  verifyMessage(message: any, nodeID: string): { valid: boolean; error?: string } {
    const result = this.signingManager.verifyMessage(message, nodeID);

    // Store public key if verification succeeds
    if (result.valid && result.nodeID) {
      this.signingManager.addPublicKey(result.nodeID, this.signingManager.getLocalPublicKey());
    }

    return result;
  }

  /**
   * Add a public key for a node
   */
  addNodePublicKey(nodeID: string, publicKey: Buffer): void {
    this.signingManager.addPublicKey(nodeID, publicKey);
  }

  /**
   * Get a node's public key
   */
  getNodePublicKey(nodeID: string): Buffer | undefined {
    return this.signingManager.getPublicKey(nodeID);
  }

  /**
   * Get local IP addresses
   *
   * @param options - Filter options for IP addresses
   * @returns Array of local IP addresses
   */
  getLocalIPs(options?: {
    ipv4Only?: boolean;
    ipv6Only?: boolean;
    excludeInternal?: boolean;
    interfaceName?: string;
  }): string[] {
    return getLocalIPs(options);
  }

  /**
   * Get the primary local IP address (first non-internal IPv4 address)
   *
   * @returns Primary local IP or undefined if none found
   */
  getPrimaryLocalIP(): string | undefined {
    const ips = this.getLocalIPs({ ipv4Only: true, excludeInternal: true });
    return ips[0];
  }

  /**
   * Check if a node is on the same local network
   *
   * @param nodeID - The node ID to check
   * @param subnetMask - Subnet mask bits (default: 24 for /24)
   * @returns true if on same network, false if not, null if node not found or cannot determine
   */
  isSameNetwork(nodeID: string, subnetMask: number = 24): boolean | null {
    // Find the node in routing table
    const knownNode = this.routingTable.getKnownNode(nodeID);
    if (!knownNode || knownNode.addresses.length === 0) {
      return null;
    }

    // Get the target node's IP address (first address, TCP transport preferred)
    const targetAddress = knownNode.addresses.find(addr => addr.type === TransportType.TCP)
      || knownNode.addresses[0];
    const targetIP = targetAddress.host;

    // Get local IPs
    const localIPs = this.getLocalIPs({ ipv4Only: true, excludeInternal: true });
    if (localIPs.length === 0) {
      return null;
    }

    // Check if any local IP is on the same subnet as the target
    for (const localIP of localIPs) {
      try {
        if (isSameSubnet(localIP, targetIP, subnetMask)) {
          return true;
        }
      } catch {
        // Invalid IP format, skip
        continue;
      }
    }

    return false;
  }

  /**
   * Generate a message ID
   */
  private generateMessageID(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}-${random}`;
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
        const existingNode = this.routingTable.getAnyNode(event.nodeId);

        if (!existingNode) {
          // New discovered node, add to Known layer with UNKNOWN state
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
        } else {
          // Node exists, update lastSeen time
          existingNode.lastSeen = Date.now();
          // Update in the appropriate map
          if (this.routingTable.getCoreNode(event.nodeId)) {
            this.routingTable.addCoreNode(existingNode);
          } else if (this.routingTable.getActiveNode(event.nodeId)) {
            this.routingTable.addActiveNode(existingNode);
          } else {
            this.routingTable.addKnownNode(existingNode);
          }
        }

        // Automatically connect to discovered node
        if (!this.connectionPool.hasConnection(event.nodeId)) {
          this.connectToNode(host, parseInt(port), event.nodeId)
            .catch(() => {
              // Silently handle connection errors
            });
        }
      }
    }
  }

  /**
   * Handle handshake message
   */
  private handleHandshake(message: any, fromNodeID: string): void {
    const { HandshakeHandler, createHandshakeAckMessage, encodeMessage } = require('./protocol');

    // Sign callback - for now just use empty signature
    const signCallback = (data: Buffer) => Buffer.alloc(0);

    this.handshakeHandler.handleHandshake(
      message,
      this.nodeID,
      this.keyPair.publicKey,
      signCallback
    ).then(result => {
      if (result) {
        // Send handshake acknowledgment
        // In production, you would send this through the client
        this.emit('handshakeCompleted', fromNodeID);
      }
    });
  }

  /**
   * Handle handshake acknowledgment
   */
  private handleHandshakeAck(message: any, fromNodeID: string): void {
    const result = this.handshakeHandler.handleHandshakeAck(message);

    if (result.success) {
      // Start heartbeat for this node
      this.heartbeatHandler.startHeartbeat(fromNodeID, async (msg: Buffer) => {
        // Send heartbeat message through connection pool
        try {
          await this.connectionPool.send(fromNodeID, msg);
          return true;
        } catch {
          return false;
        }
      });

      this.emit('handshakeCompleted', fromNodeID);
    }
  }

  /**
   * Handle heartbeat message
   */
  private handleHeartbeat(message: any, fromNodeID: string): void {
    this.heartbeatHandler.handleHeartbeat(
      message,
      this.nodeID,
      async (msg: Buffer) => {
        // Send pong response through connection pool
        try {
          await this.connectionPool.send(fromNodeID, msg);
          return true;
        } catch {
          return false;
        }
      }
    );
  }

  /**
   * Handle disconnect message
   */
  private handleDisconnect(message: any, fromNodeID: string): void {
    this.heartbeatHandler.stopHeartbeat(fromNodeID);
    this.routingTable.updateNodeState(fromNodeID, NodeState.OFFLINE);
    this.emit('peerDisconnected', fromNodeID);
  }
}
