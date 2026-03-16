import { EventEmitter } from 'events';
import { NodeID } from './types/node';
import { KeyPair, generateKeyPair, deriveNodeID } from './crypto/keypair';
import { RoutingTable } from './routing/table';
import { ConnectionPool } from './transport/pool';
import { ConnectionType, NodeState, TransportType } from './types/connection';
import { MDiscoveryService } from './discovery/mdns';

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
  private nodeID: NodeID;
  private routingTable: RoutingTable;
  private connectionPool: ConnectionPool;
  private mdnsService: MDiscoveryService | null = null;
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

    // TODO: Start TCP listener

    // TODO: Connect to bootstrap nodes

    this.running = true;
    this.emit('ready');
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    // Stop mDNS
    if (this.mdnsService) {
      await this.mdnsService.stop();
      this.mdnsService = null;
    }

    // Disconnect all connections
    await this.connectionPool.disconnectAll();

    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  getNodeID(): NodeID {
    return this.nodeID;
  }

  getPublicKey(): Buffer {
    return this.keyPair.publicKey;
  }

  async send(targetNodeID: NodeID, message: any): Promise<void> {
    return this.connectionPool.send(targetNodeID, message);
  }

  getRoutingTable(): RoutingTable {
    return this.routingTable;
  }

  getConnectionPool(): ConnectionPool {
    return this.connectionPool;
  }

  private setupEventHandlers(): void {
    this.connectionPool.on('connected', (nodeID: NodeID, type: ConnectionType) => {
      this.emit('peerConnected', nodeID, type);
    });

    this.connectionPool.on('disconnected', (nodeID: NodeID) => {
      this.emit('peerDisconnected', nodeID);
    });
  }

  private handleDiscoveredNode(event: any): void {
    this.emit('nodeDiscovered', event);
    // TODO: Add to routing table and attempt connection
  }
}
