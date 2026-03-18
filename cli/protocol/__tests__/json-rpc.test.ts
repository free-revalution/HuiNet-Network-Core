/**
 * Tests for JSON-RPC Protocol
 */

import { JSONRPCProtocol, A2AMethod, JSONRPCErrorCode } from '../json-rpc';

describe('JSONRPCProtocol', () => {
  describe('parseRequest', () => {
    it('should parse valid JSON-RPC request', () => {
      const data = JSON.stringify({
        jsonrpc: '2.0',
        method: 'test.method',
        params: { foo: 'bar' },
        id: 1,
      });

      const result = JSONRPCProtocol.parseRequest(data);

      expect(result).not.toBeNull();
      expect(result?.method).toBe('test.method');
      expect(result?.params).toEqual({ foo: 'bar' });
      expect(result?.id).toBe(1);
    });

    it('should parse notification (no id)', () => {
      const data = JSON.stringify({
        jsonrpc: '2.0',
        method: 'test.notification',
        params: { data: 'test' },
      });

      const result = JSONRPCProtocol.parseRequest(data);

      expect(result).not.toBeNull();
      expect(result?.method).toBe('test.notification');
      expect(result?.id).toBeUndefined();
    });

    it('should reject invalid JSON-RPC version', () => {
      const data = JSON.stringify({
        jsonrpc: '1.0',
        method: 'test.method',
        id: 1,
      });

      const result = JSONRPCProtocol.parseRequest(data);

      expect(result).toBeNull();
    });

    it('should reject missing method', () => {
      const data = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
      });

      const result = JSONRPCProtocol.parseRequest(data);

      expect(result).toBeNull();
    });

    it('should reject invalid JSON', () => {
      const result = JSONRPCProtocol.parseRequest('invalid json');

      expect(result).toBeNull();
    });
  });

  describe('createResponse', () => {
    it('should create success response', () => {
      const response = JSONRPCProtocol.createResponse(1, { result: 'success' });

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toEqual({ result: 'success' });
      expect(response.error).toBeUndefined();
    });

    it('should create error response', () => {
      const error = JSONRPCProtocol.createError(
        JSONRPCErrorCode.MethodNotFound,
        'Method not found'
      );

      const response = JSONRPCProtocol.createResponse(1, undefined, error);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeUndefined();
      expect(response.error).toEqual({
        code: JSONRPCErrorCode.MethodNotFound,
        message: 'Method not found',
      });
    });
  });

  describe('createError', () => {
    it('should create error without data', () => {
      const error = JSONRPCProtocol.createError(
        JSONRPCErrorCode.InternalError,
        'Something went wrong'
      );

      expect(error.code).toBe(JSONRPCErrorCode.InternalError);
      expect(error.message).toBe('Something went wrong');
      expect(error.data).toBeUndefined();
    });

    it('should create error with data', () => {
      const error = JSONRPCProtocol.createError(
        JSONRPCErrorCode.InvalidParams,
        'Invalid parameters',
        { details: 'param "foo" is required' }
      );

      expect(error.code).toBe(JSONRPCErrorCode.InvalidParams);
      expect(error.message).toBe('Invalid parameters');
      expect(error.data).toEqual({ details: 'param "foo" is required' });
    });
  });

  describe('isNotification', () => {
    it('should return true for notification (no id)', () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test.notify',
      };

      expect(JSONRPCProtocol.isNotification(request)).toBe(true);
    });

    it('should return true for notification (null id)', () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test.notify',
        id: null,
      };

      expect(JSONRPCProtocol.isNotification(request)).toBe(true);
    });

    it('should return false for request with id', () => {
      const request = {
        jsonrpc: '2.0' as const,
        method: 'test.method',
        id: 1,
      };

      expect(JSONRPCProtocol.isNotification(request)).toBe(false);
    });
  });
});

describe('A2AMethod', () => {
  it('should define all A2A methods', () => {
    expect(A2AMethod.SEND_MESSAGE).toBe('a2a.send');
    expect(A2AMethod.BROADCAST).toBe('a2a.broadcast');
    expect(A2AMethod.LIST_AGENTS).toBe('a2a.listAgents');
    expect(A2AMethod.GET_AGENT_INFO).toBe('a2a.getAgentInfo');
    expect(A2AMethod.HEARTBEAT).toBe('a2a.heartbeat');
    expect(A2AMethod.TASK_EXECUTE).toBe('a2a.task.execute');
    expect(A2AMethod.TASK_RESULT).toBe('a2a.task.result');
  });
});
