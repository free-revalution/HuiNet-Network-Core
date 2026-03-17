/**
 * TCP Client for HuiNet
 *
 * Handles outgoing connections to other nodes
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { NodeID } from '../types/node';
import type { Connection } from './pool';

export interface TCPClientConfig {
  nodeId: NodeID;
}

export class TCPClient extends EventEmitter {
  private config: TCPClientConfig;
  private socket: net.Socket | null = null;
  private connected = false;

  constructor(config: TCPClientConfig) {
    super();
    this.config = config;
  }

  async connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();

      this.socket.on('connect', () => {
        this.connected = true;
        this.emit('connected');
        resolve();
      });

      this.socket.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      this.socket.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
      });

      this.socket.connect(port, host);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
    }
  }

  /**
   * Close the connection (alias for disconnect for Connection interface compatibility)
   */
  async close(): Promise<void> {
    this.disconnect();
  }

  /**
   * Send data asynchronously (for Connection interface compatibility)
   */
  async sendAsync(data: Buffer): Promise<void> {
    if (!this.send(data)) {
      throw new Error('Failed to send: client not connected');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  send(data: Buffer): boolean {
    if (this.socket && this.connected) {
      this.socket.write(data);
      return true;
    }
    return false;
  }

  private handleData(data: Buffer): void {
    try {
      // Try to parse as JSON directly (simple format)
      const messageStr = data.toString('utf-8');
      const messageData = JSON.parse(messageStr);

      this.emit('message', {
        message: messageData,
      });
    } catch (error) {
      // Silently handle parse errors - might be partial data
    }
  }
}

/**
 * TCPClientConnection adapter for ConnectionPool
 *
 * Wraps a TCPClient to implement the Connection interface
 */
export class TCPClientConnection implements Connection {
  private _nodeID: NodeID;

  constructor(private client: TCPClient, nodeID: NodeID) {
    this._nodeID = nodeID;
  }

  get nodeID(): NodeID {
    return this._nodeID;
  }

  async send(message: any): Promise<void> {
    let data: Buffer;

    if (message instanceof Buffer) {
      data = message;
    } else if (typeof message === 'string') {
      // If message is already a JSON string, convert directly to Buffer
      data = Buffer.from(message, 'utf-8');
    } else {
      // If message is an object, JSON stringify it first
      data = Buffer.from(JSON.stringify(message), 'utf-8');
    }

    await this.client.sendAsync(data);
  }

  async close(): Promise<void> {
    this.client.disconnect();
  }

  isConnected(): boolean {
    return this.client.isConnected();
  }

  /**
   * Get the underlying TCPClient
   */
  getClient(): TCPClient {
    return this.client;
  }
}
