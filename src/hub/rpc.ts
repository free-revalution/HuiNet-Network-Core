/**
 * Minimal JSON-RPC helpers for the local hub WebSocket bus
 */

import type { WebSocket } from 'ws';

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
  id?: string | number | null;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
  id: string | number | null;
}

export enum A2AMethod {
  SEND_MESSAGE = 'a2a.send',
  BROADCAST = 'a2a.broadcast',
  LIST_AGENTS = 'a2a.listAgents',
  GET_AGENT_INFO = 'a2a.getAgentInfo',
  HEARTBEAT = 'a2a.heartbeat',
  TASK_EXECUTE = 'a2a.task.execute',
  TASK_RESULT = 'a2a.task.result',
}

export const HubRPC = {
  parseRequest(data: string): JSONRPCRequest | null {
    try {
      const request = JSON.parse(data) as JSONRPCRequest;
      if (request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
        return null;
      }
      return request;
    } catch {
      return null;
    }
  },

  createResponse(
    id: string | number | null,
    result?: unknown,
    error?: JSONRPCResponse['error']
  ): JSONRPCResponse {
    const response: JSONRPCResponse = { jsonrpc: '2.0', id };
    if (error) response.error = error;
    else response.result = result;
    return response;
  },

  createError(code: number, message: string, data?: unknown) {
    return { code, message, data };
  },

  isNotification(request: JSONRPCRequest): boolean {
    return request.id === undefined || request.id === null;
  },

  sendResponse(ws: WebSocket, response: JSONRPCResponse): boolean {
    try {
      ws.send(JSON.stringify(response));
      return true;
    } catch {
      return false;
    }
  },

  sendRequest(ws: WebSocket, request: JSONRPCRequest): boolean {
    try {
      ws.send(JSON.stringify(request));
      return true;
    } catch {
      return false;
    }
  },
};
