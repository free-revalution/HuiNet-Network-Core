/**
 * Type definitions for Agent Wrapper
 */

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number | null;
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: JSONRPCError;
  id: string | number | null;
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

/**
 * JSON-RPC Error codes
 */
export enum JSONRPCErrorCode {
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
}

/**
 * Agent information
 */
export interface AgentInfo {
  /** Unique agent ID (e.g., "claude-code-alice") */
  id: string;

  /** Friendly name */
  name: string;

  /** WebSocket connection URL */
  wsUrl: string;

  /** Proxy port assigned to this agent */
  proxyPort: number;

  /** Process ID (if launched by us) */
  pid?: number;

  /** Registration timestamp */
  registeredAt: number;

  /** Last heartbeat timestamp */
  lastHeartbeat: number;
}

/**
 * Message routing target
 */
export interface MessageTarget {
  /** Target agent ID */
  agentId: string;

  /** Target node ID (P2P network) */
  nodeId: string;

  /** Target machine ID */
  machineId?: string;
}

/**
 * P2P message envelope
 */
export interface P2PMessageEnvelope {
  /** Source agent ID */
  from: string;

  /** Destination agent ID */
  to: string;

  /** Message payload */
  payload: JSONRPCRequest;

  /** Timestamp */
  timestamp: number;

  /** Signature for verification */
  signature?: string;
}

/**
 * Agent proxy configuration
 */
export interface AgentProxyConfig {
  /** Port range for proxy allocation */
  portRange: [number, number];

  /** WebSocket host */
  host: string;

  /** Message timeout in milliseconds */
  messageTimeout: number;
}
