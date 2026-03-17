/**
 * TCP Server for HuiNet
 *
 * Handles incoming connections and messages
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { NodeID } from '../types/node';

export interface TCPServerConfig {
  host: string;
  port: number;
  nodeId: NodeID;
}

export interface ServerConnection {
  socket: net.Socket;
  nodeId?: NodeID;
  remoteAddress: string;
}

export class TCPServer extends EventEmitter {
  private server: net.Server;
  private connections: Map<NodeID, ServerConnection> = new Map();
  private connectionsBySocket: Map<net.Socket, ServerConnection> = new Map();
  private config: TCPServerConfig;

  constructor(config: TCPServerConfig) {
    super();
    this.config = config;
    this.server = net.createServer(this.handleConnection.bind(this));
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.emit('listening', {
          host: this.config.host,
          port: this.config.port
        });
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all connections
      for (const connection of this.connections.values()) {
        connection.socket.destroy();
      }
      for (const connection of this.connectionsBySocket.values()) {
        connection.socket.destroy();
      }
      this.connections.clear();
      this.connectionsBySocket.clear();

      this.server.close(() => {
        this.emit('closed');
        resolve();
      });
    });
  }

  private handleConnection(socket: net.Socket): void {
    const remoteAddress = `${socket.remoteAddress}:${socket.remotePort}`;

    const connection: ServerConnection = {
      socket,
      remoteAddress,
    };

    // Store by socket so we can find it later when receiving data
    this.connectionsBySocket.set(socket, connection);

    this.emit('connection', connection);

    socket.on('data', (data: Buffer) => {
      this.handleData(socket, data);
    });

    socket.on('error', (error) => {
      this.emit('connectionError', { connection, error });
    });

    socket.on('close', () => {
      // Remove from both maps
      this.connectionsBySocket.delete(socket);
      if (connection.nodeId) {
        this.connections.delete(connection.nodeId);
        this.emit('disconnection', connection);
      }
    });
  }

  private handleData(socket: net.Socket, data: Buffer): void {
    try {
      const messageStr = data.toString('utf-8');
      const messageData = JSON.parse(messageStr);

      const connection = this.connectionsBySocket.get(socket);
      if (connection) {
        this.emit('message', {
          connection,
          message: messageData,
        });
      }
    } catch (error) {
      // Silently handle parse errors - might be partial data
    }
  }

  broadcast(data: Buffer): void {
    for (const connection of this.connections.values()) {
      connection.socket.write(data);
    }
  }

  send(nodeID: NodeID, data: Buffer): boolean {
    const connection = this.connections.get(nodeID);
    if (connection) {
      connection.socket.write(data);
      return true;
    }
    return false;
  }
}
