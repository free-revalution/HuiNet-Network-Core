import { NodeID } from './node';

export enum MessageType {
  // Control messages (0-9)
  DISCOVER = 0,
  HEARTBEAT = 1,
  HANDSHAKE = 2,
  HANDSHAKE_ACK = 3,
  DISCONNECT = 4,

  // Business messages (10-49)
  CHAT = 10,
  FILE_TRANSFER_INIT = 11,
  FILE_TRANSFER_DATA = 12,
  FILE_TRANSFER_ACK = 13,
  RPC_CALL = 14,
  RPC_RESPONSE = 15,

  // Network messages (50-99)
  PEER_EXCHANGE = 50,
  LOCATION_QUERY = 51,
  LOCATION_RESPONSE = 52,
  ANNOUNCE = 53,
}

export interface MessageHeader {
  version: string;
  type: MessageType;
  from: NodeID;
  to?: NodeID;
  id: string;
  timestamp: number;
  ttl?: number;
  sequence?: number;
}

export interface BaseMessage {
  header: MessageHeader;
  body?: Buffer;
  signature: Buffer;
}

export interface HandshakeBody {
  nodeID: NodeID;
  publicKey: Buffer;
  challenge: Buffer;
  challengeResponse: Buffer;
  capabilities: string[];
  version: string;
}

export interface HeartbeatBody {
  sequence: number;
  capabilities: string[];
  load?: number;
}
