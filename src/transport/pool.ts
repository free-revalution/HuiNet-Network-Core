import { EventEmitter } from 'events';
import { NodeID } from '../types/node';
import { ConnectionType, ConnectionState } from '../types/connection';

export { ConnectionType, ConnectionState } from '../types/connection';

export interface Connection {
  nodeID: NodeID;
  send(message: any): Promise<void>;
  close(): Promise<void>;
  isConnected(): boolean;
}

export interface PoolConfig {
  maxCoreConnections: number;
  maxActiveConnections: number;
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
}

export interface ConnectionEntry {
  connection: Connection;
  type: ConnectionType;
  state: ConnectionState;
  lastUsed: number;
  lastHeartbeat: number;
}

export class ConnectionPool extends EventEmitter {
  private config: Required<PoolConfig>;
  private connections: Map<NodeID, ConnectionEntry> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(config: PoolConfig) {
    super();
    this.config = {
      maxCoreConnections: config.maxCoreConnections,
      maxActiveConnections: config.maxActiveConnections,
      heartbeatInterval: config.heartbeatInterval || 15000,
      heartbeatTimeout: config.heartbeatTimeout || 45000,
    };
    this.startHeartbeat();
  }

  async addConnection(
    nodeID: NodeID,
    connection: Connection,
    type: ConnectionType
  ): Promise<void> {
    // Check limits
    if (type === ConnectionType.CORE) {
      const coreCount = this.getCoreConnectionCount();
      if (coreCount >= this.config.maxCoreConnections) {
        this.evictLRU(ConnectionType.CORE);
      }
    } else if (type === ConnectionType.ACTIVE) {
      const activeCount = this.getActiveConnectionCount();
      if (activeCount >= this.config.maxActiveConnections) {
        this.evictLRU(ConnectionType.ACTIVE);
      }
    }

    const entry: ConnectionEntry = {
      connection,
      type,
      state: ConnectionState.CONNECTED,
      lastUsed: Date.now(),
      lastHeartbeat: Date.now(),
    };

    this.connections.set(nodeID, entry);
    this.emit('connected', nodeID, type);
  }

  getConnection(nodeID: NodeID): Connection | undefined {
    const entry = this.connections.get(nodeID);
    if (entry && entry.connection.isConnected()) {
      entry.lastUsed = Date.now();
      return entry.connection;
    }
    return undefined;
  }

  hasConnection(nodeID: NodeID): boolean {
    return this.connections.has(nodeID) &&
           this.connections.get(nodeID)!.connection.isConnected();
  }

  async removeConnection(nodeID: NodeID): Promise<void> {
    const entry = this.connections.get(nodeID);
    if (entry) {
      await entry.connection.close();
      this.connections.delete(nodeID);
      this.emit('disconnected', nodeID);
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.entries()).map(
      async ([nodeID, entry]) => {
        await entry.connection.close();
        this.emit('disconnected', nodeID);
      }
    );

    await Promise.all(disconnectPromises);
    this.connections.clear();
    this.stopHeartbeat();
  }

  async send(nodeID: NodeID, message: any): Promise<void> {
    const connection = this.getConnection(nodeID);
    if (!connection) {
      throw new Error(`No connection to node: ${nodeID}`);
    }

    await connection.send(message);
  }

  getCoreConnectionCount(): number {
    return Array.from(this.connections.values())
      .filter(e => e.type === ConnectionType.CORE).length;
  }

  getActiveConnectionCount(): number {
    return Array.from(this.connections.values())
      .filter(e => e.type === ConnectionType.ACTIVE).length;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  getConnectionType(nodeID: NodeID): ConnectionType | undefined {
    return this.connections.get(nodeID)?.type;
  }

  private evictLRU(type: ConnectionType): void {
    let oldestNodeID: NodeID | undefined;
    let oldestTime = Infinity;

    for (const [nodeID, entry] of this.connections) {
      if (entry.type === type && entry.lastUsed < oldestTime) {
        oldestTime = entry.lastUsed;
        oldestNodeID = nodeID;
      }
    }

    if (oldestNodeID) {
      this.removeConnection(oldestNodeID);
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeats();
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async sendHeartbeats(): Promise<void> {
    const now = Date.now();

    for (const [nodeID, entry] of this.connections) {
      if (!entry.connection.isConnected()) {
        this.connections.delete(nodeID);
        this.emit('disconnected', nodeID);
        continue;
      }

      // Check for timeout
      if (now - entry.lastHeartbeat > this.config.heartbeatTimeout) {
        await this.removeConnection(nodeID);
        continue;
      }

      // Send heartbeat
      try {
        await entry.connection.send({
          type: 'heartbeat',
          timestamp: now,
        });
        entry.lastHeartbeat = now;
      } catch (e) {
        // Connection might be dead
        await this.removeConnection(nodeID);
      }
    }
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      coreConnections: this.getCoreConnectionCount(),
      activeConnections: this.getActiveConnectionCount(),
    };
  }
}
