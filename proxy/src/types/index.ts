/**
 * HuiNet Proxy Server - Type Definitions
 */

// Configuration types
export interface ProxyConfig {
  // Server configuration
  httpPort: number;
  wsPort: number;
  host: string;
  apiKey: string;

  // HuiNet configuration
  huinet: HuinetConfig;

  // Optional configuration
  logLevel: LogLevel;
  maxConnections: number;
}

export interface HuinetConfig {
  listenPort: number;
  enableMDNS: boolean;
  bootstrapNodes: string[];
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Message types
export interface ProxyMessage {
  from: string;
  to?: string;
  data: unknown;
  timestamp: number;
}

export interface SendMessageRequest {
  to: string;
  data: unknown;
}

export interface MessageHistoryQuery {
  since?: number;
  before?: number;
  from?: string;
  to?: string;
  direction?: 'inbound' | 'outbound';
  limit?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  messageId?: string;
}

export interface NodeInfo {
  nodeID: string;
  state: 'online' | 'offline' | 'unknown' | 'restricted';
  addresses: Array<{
    type: string;
    host: string;
    port: number;
  }>;
  lastSeen?: number;
}

// WebSocket types
import type { WebSocket } from 'ws';

export interface WebSocketClient {
  id: string;
  socket: WebSocket;
  apiKey: string;
  connectedAt: number;
  subscriptions: string[];
}

export interface WSMessage {
  type: 'message' | 'nodeStatus' | 'error' | 'pong' | 'ping' | 'subscribe' | 'unsubscribe';
  from?: string;
  data?: unknown;
  timestamp: number;
}

// Error types
export class ProxyError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'ProxyError';
  }
}

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_REQUEST: 'INVALID_REQUEST',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
