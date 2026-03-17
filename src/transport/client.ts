/**
 * TCP Client for HuiNet
 *
 * Handles outgoing connections to other nodes
 */

import * as net from 'net';
import { EventEmitter } from 'events';
import { NodeID } from '../types/node';

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
