import { EventEmitter } from 'events';
import dgram from 'dgram';
import { NodeID } from '../types/node';

export interface DiscoveredNode {
  nodeId: NodeID;
  port: number;
  address: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface MDiscoveryConfig {
  nodeId: NodeID;
  port: number;
  host?: string;
  multicastAddress?: string;
  multicastPort?: number;
  bindAddress?: string;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export interface MDiscoveryEvent {
  nodeId: NodeID;
  addresses: string[];
  port: number;
}

export interface DiscoveryMessage {
  type: 'announce';
  nodeId: NodeID;
  port: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

/**
 * mDNS discovery service for local network node discovery
 * Uses UDP multicast on 224.0.0.114:43000 for service discovery
 */
export class MDiscoveryService extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private readonly nodeId: NodeID;
  private readonly port: number;
  private readonly multicastAddress: string;
  private readonly multicastPort: number;
  private readonly bindAddress: string;
  private readonly ttl: number;
  private readonly metadata: Record<string, unknown>;
  private running: boolean = false;
  private messageHandler: ((msg: Buffer, rinfo: dgram.RemoteInfo) => void) | null = null;
  private errorHandler: ((err: Error) => void) | null = null;

  constructor(config: MDiscoveryConfig) {
    super();
    this.nodeId = config.nodeId;
    this.port = config.port;
    this.multicastAddress = config.multicastAddress ?? '224.0.0.114';
    this.multicastPort = config.multicastPort ?? 43000;
    this.bindAddress = config.bindAddress ?? '0.0.0.0';
    this.ttl = config.ttl ?? 1;
    this.metadata = config.metadata ?? {};
  }

  /**
   * Start the mDNS discovery service
   */
  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        // Create socket with reuseAddr option to allow multiple nodes
        this.socket = dgram.createSocket({
          type: 'udp4',
          reuseAddr: true
        });

        // Set up message handler
        this.messageHandler = (msg: Buffer, rinfo: dgram.RemoteInfo) => {
          this.handleMessage(msg, rinfo);
        };

        // Set up error handler for errors after binding
        this.errorHandler = (err: Error) => {
          if (!this.running) {
            // If not yet running, this is a bind error
            reject(err);
          } else {
            this.emit('error', err);
          }
        };

        this.socket.on('message', this.messageHandler);
        this.socket.on('error', this.errorHandler);

        // Bind to multicast port
        this.socket.bind(this.multicastPort, this.bindAddress, () => {
          try {
            // Add multicast membership
            this.socket!.addMembership(this.multicastAddress);

            // Enable broadcast and set TTL
            this.socket!.setBroadcast(true);
            this.socket!.setMulticastTTL(this.ttl);

            this.running = true;
            this.emit('listening');
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stop the mDNS discovery service
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    return new Promise((resolve) => {
      if (this.socket) {
        // Remove event listeners
        if (this.messageHandler) {
          this.socket.removeListener('message', this.messageHandler);
        }
        if (this.errorHandler) {
          this.socket.removeListener('error', this.errorHandler);
        }

        this.socket.close(() => {
          this.socket = null;
          this.running = false;
          this.messageHandler = null;
          this.errorHandler = null;
          this.emit('stopped');
          resolve();
        });
      } else {
        this.running = false;
        this.emit('stopped');
        resolve();
      }
    });
  }

  /**
   * Announce this node to the network
   */
  announce(): void {
    if (!this.running || !this.socket) {
      return;
    }

    const message: DiscoveryMessage = {
      type: 'announce',
      nodeId: this.nodeId,
      port: this.port,
      timestamp: Date.now(),
      metadata: Object.keys(this.metadata).length > 0 ? this.metadata : undefined,
    };

    const messageBuffer = Buffer.from(JSON.stringify(message));

    this.socket.send(
      messageBuffer,
      this.multicastPort,
      this.multicastAddress,
      (err) => {
        if (err) {
          this.emit('error', err);
        }
      }
    );
  }

  /**
   * Check if the service is running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Handle incoming discovery messages
   */
  private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      const message: DiscoveryMessage = JSON.parse(msg.toString());

      // Validate message structure
      if (!this.isValidDiscoveryMessage(message)) {
        return;
      }

      // Ignore own messages
      if (message.nodeId === this.nodeId) {
        return;
      }

      // Emit discovered event
      const discoveredNode: DiscoveredNode = {
        nodeId: message.nodeId,
        port: message.port,
        address: rinfo.address,
        timestamp: message.timestamp,
        metadata: message.metadata,
      };

      this.emit('discovered', discoveredNode);
    } catch (err) {
      this.emit('error', err);
    }
  }

  /**
   * Validate discovery message structure
   */
  private isValidDiscoveryMessage(message: unknown): message is DiscoveryMessage {
    if (typeof message !== 'object' || message === null) {
      return false;
    }

    const msg = message as Record<string, unknown>;

    return (
      msg.type === 'announce' &&
      typeof msg.nodeId === 'string' &&
      typeof msg.port === 'number' &&
      typeof msg.timestamp === 'number'
    );
  }
}
