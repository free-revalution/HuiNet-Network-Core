/**
 * HuiNet - Decentralized A2A Networking Library
 *
 * A peer-to-peer networking library for agent-to-agent communication
 * with support for NAT traversal, encrypted messaging, and automatic discovery.
 */

// Version information
export const version = '0.1.0';

// Type definitions for the HuiNet API

/**
 * Node identity using Ed25519 keypair
 */
export interface NodeIdentity {
  publicKey: Buffer;
  secretKey?: Buffer;
  nodeId: string;
}

/**
 * Network peer information
 */
export interface Peer {
  nodeId: string;
  publicKey: Buffer;
  addresses: string[];
  lastSeen: number;
  isSuperNode: boolean;
}

/**
 * Network configuration options
 */
export interface NetworkConfig {
  port: number;
  bootstrapNodes?: string[];
  superNode?: boolean;
  natTraversalEnabled?: boolean;
  discoveryEnabled?: boolean;
}

/**
 * Encrypted message format
 */
export interface EncryptedMessage {
  sender: string;
  recipient: string;
  nonce: Buffer;
  ciphertext: Buffer;
  timestamp: number;
}

/**
 * Transport layer packet
 */
export interface Packet {
  type: 'discover' | 'relay' | 'direct' | 'data';
  source: string;
  destination: string;
  payload: Buffer;
  ttl?: number;
}

/**
 * NAT traversal strategy result
 */
export interface NATTraversalResult {
  strategy: 'upnp' | 'stun' | 'reversal' | 'relay' | 'failed';
  publicAddress?: string;
  publicPort?: number;
  latency?: number;
}

/**
 * HuiNet node interface
 */
export interface HuiNetNode {
  readonly identity: NodeIdentity;
  readonly peers: Map<string, Peer>;

  start(): Promise<void>;
  stop(): Promise<void>;
  send(recipient: string, data: Buffer): Promise<void>;
  on(event: 'message' | 'peer' | 'error', handler: (...args: any[]) => void): void;
}

/**
 * Main HuiNet class (to be implemented)
 */
export class HuiNet implements HuiNetNode {
  readonly identity: NodeIdentity;
  readonly peers: Map<string, Peer>;

  constructor(config: NetworkConfig) {
    this.identity = {} as NodeIdentity;
    this.peers = new Map();
  }

  async start(): Promise<void> {
    throw new Error('Not implemented yet');
  }

  async stop(): Promise<void> {
    throw new Error('Not implemented yet');
  }

  async send(recipient: string, data: Buffer): Promise<void> {
    throw new Error('Not implemented yet');
  }

  on(event: string, handler: (...args: any[]) => void): void {
    throw new Error('Not implemented yet');
  }
}

// TODO: Export core modules as they are implemented
// export { Crypto } from './crypto';
// export { Discovery } from './discovery';
// export { NAT } from './nat';
// export { Routing } from './routing';
// export { Transport } from './transport';
