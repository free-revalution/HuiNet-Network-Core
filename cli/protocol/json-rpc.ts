/**
 * JSON-RPC 2.0 Protocol Handler
 */

import { WebSocket } from 'ws';
import type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
} from '../types';
import { JSONRPCErrorCode } from '../types';

/**
 * JSON-RPC Protocol Handler
 */
export class JSONRPCProtocol {
  /**
   * Parse JSON-RPC request from string
   */
  static parseRequest(data: string): JSONRPCRequest | null {
    try {
      const request = JSON.parse(data) as JSONRPCRequest;

      // Validate JSON-RPC 2.0 format
      if (request.jsonrpc !== '2.0') {
        return null;
      }

      if (typeof request.method !== 'string') {
        return null;
      }

      return request;
    } catch {
      return null;
    }
  }

  /**
   * Create JSON-RPC response
   */
  static createResponse(
    id: string | number | null,
    result?: unknown,
    error?: JSONRPCError
  ): JSONRPCResponse {
    const response: JSONRPCResponse = {
      jsonrpc: '2.0',
      id,
    };

    if (error) {
      response.error = error;
    } else {
      response.result = result;
    }

    return response;
  }

  /**
   * Create JSON-RPC error
   */
  static createError(
    code: JSONRPCErrorCode,
    message: string,
    data?: unknown
  ): JSONRPCError {
    const error: JSONRPCError = { code, message };

    if (data !== undefined) {
      error.data = data;
    }

    return error;
  }

  /**
   * Check if request is a notification (no id, no response expected)
   */
  static isNotification(request: JSONRPCRequest): boolean {
    return request.id === undefined || request.id === null;
  }

  /**
   * Send JSON-RPC response through WebSocket
   */
  static sendResponse(ws: WebSocket, response: JSONRPCResponse): boolean {
    try {
      ws.send(JSON.stringify(response));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send JSON-RPC request through WebSocket
   */
  static sendRequest(ws: WebSocket, request: JSONRPCRequest): boolean {
    try {
      ws.send(JSON.stringify(request));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Parse and validate incoming message
   */
  static async handleMessage(
    data: string,
    handler: (request: JSONRPCRequest) => Promise<unknown> | unknown
  ): Promise<JSONRPCResponse | null> {
    const request = this.parseRequest(data);

    if (!request) {
      return this.createResponse(
        null,
        undefined,
        this.createError(
          JSONRPCErrorCode.InvalidRequest,
          'Invalid JSON-RPC 2.0 request'
        )
      );
    }

    // Notifications don't get responses
    if (this.isNotification(request)) {
      // Trigger handler asynchronously, no response
      Promise.resolve(handler(request)).catch((err: unknown) => {
        console.error('Notification handler error:', err);
      });
      return null;
    }

    // Handle request and return response
    try {
      const result = await handler(request);
      return this.createResponse(request.id!, result);
    } catch (error) {
      const err = error as { code?: number; message?: string; data?: unknown };
      const code = err.code ?? JSONRPCErrorCode.InternalError;
      const message = err.message ?? 'Internal error';
      return this.createResponse(
        request.id!,
        undefined,
        this.createError(code, message, err.data)
      );
    }
  }
}

/**
 * Standard JSON-RPC methods for A2A communication
 */
export enum A2AMethod {
  /** Send a message to another agent */
  SEND_MESSAGE = 'a2a.send',

  /** Broadcast a message to all agents */
  BROADCAST = 'a2a.broadcast',

  /** Query available agents */
  LIST_AGENTS = 'a2a.listAgents',

  /** Get agent information */
  GET_AGENT_INFO = 'a2a.getAgentInfo',

  /** Heartbeat to keep connection alive */
  HEARTBEAT = 'a2a.heartbeat',

  /** Task execution (request/response) */
  TASK_EXECUTE = 'a2a.task.execute',

  /** Task result */
  TASK_RESULT = 'a2a.task.result',
}

/**
 * A2A message types
 */
export enum A2AMessageType {
  /** Simple text message */
  CHAT = 'chat',

  /** Task execution request */
  TASK_REQUEST = 'task_request',

  /** Task execution result */
  TASK_RESULT = 'task_result',

  /** System notification */
  SYSTEM = 'system',
}

// Re-export JSONRPCErrorCode for convenience
export { JSONRPCErrorCode } from '../types';
