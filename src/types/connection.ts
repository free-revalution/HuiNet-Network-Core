import { NodeID } from './node';

export enum ConnectionType {
  CORE,       // Persistent connection to super nodes
  ACTIVE,     // Cached connection to recently used nodes
  ON_DEMAND,  // Temporary connection for one-off operations
}

export enum ConnectionState {
  CONNECTING,
  CONNECTED,
  IDLE,
  DISCONNECTED,
  RECONNECTING,
  FAILED,
}

export enum NodeState {
  UNKNOWN,
  ONLINE,
  OFFLINE,
  RESTRICTED,
}

export enum TransportType {
  TCP = 'tcp',
  WS = 'ws',
  QUIC = 'quic',
  RELAY = 'relay',
}

export interface TransportAddress {
  type: TransportType;
  host: string;
  port: number;
  path?: string;
  relayNode?: NodeID;
  priority: number;
  lastVerified: number;
}

export interface ConnectionInfo {
  nodeID: NodeID;
  connectionType: ConnectionType;
  state: ConnectionState;
  localAddress: string;
  remoteAddress: string;
  transport: string;
  metrics: ConnectionMetrics;
  heartbeat: HeartbeatState;
}

export interface ConnectionMetrics {
  rtt: number;
  lossRate: number;
  bandwidth: number;
  lastMessageTime: number;
}

export interface HeartbeatState {
  interval: number;
  lastSent: number;
  lastReceived: number;
  missedCount: number;
}
