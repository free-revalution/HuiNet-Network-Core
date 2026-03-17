/**
 * Unit Tests - AuthMiddleware
 */

import { Request, Response } from 'express';
import { createAuthMiddleware, ProxyError, ErrorCodes } from '../../src';

// Mock NextFunction type
type MockNextFunction = jest.Mock;

describe('AuthMiddleware', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: MockNextFunction;
  const validApiKey = 'test-api-key-123456';

  beforeEach(() => {
    mockReq = {
      headers: {},
    } as unknown as Request;

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;

    mockNext = jest.fn();
  });

  describe('createAuthMiddleware', () => {
    const authMiddleware = createAuthMiddleware(validApiKey);

    it('should pass with valid API key', () => {
      mockReq.headers['x-api-key'] = validApiKey;

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).apiKey).toBe(validApiKey);
    });

    it('should fail with missing API key', () => {
      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ProxyError));
      const error = mockNext.mock.calls[0][0] as ProxyError;
      expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain('Missing API Key');
    });

    it('should fail with invalid API key', () => {
      mockReq.headers['x-api-key'] = 'wrong-key';

      authMiddleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ProxyError));
      const error = mockNext.mock.calls[0][0] as ProxyError;
      expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(error.message).toContain('Invalid API Key');
    });
  });

  describe('createWsAuth', () => {
    const { createWsAuth } = require('../../src/middleware/AuthMiddleware');
    const wsAuth = createWsAuth(validApiKey);

    it('should validate WebSocket with valid API key', () => {
      const result = wsAuth('ws://localhost:3001?apiKey=test-api-key-123456');

      expect(result.valid).toBe(true);
      expect(result.apiKey).toBe(validApiKey);
    });

    it('should reject WebSocket without API key', () => {
      const result = wsAuth('ws://localhost:3001');

      expect(result.valid).toBe(false);
      expect(result.apiKey).toBeUndefined();
    });

    it('should reject WebSocket with invalid API key', () => {
      const result = wsAuth('ws://localhost:3001?apiKey=wrong-key');

      expect(result.valid).toBe(false);
    });
  });

  describe('validateRequest', () => {
    const { validateRequest } = require('../../src/middleware/AuthMiddleware');

    it('should pass with all required fields', () => {
      mockReq.body = { to: 'node123', data: 'hello' };

      const middleware = validateRequest(['to', 'data']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail with missing fields', () => {
      mockReq.body = { to: 'node123' };

      const middleware = validateRequest(['to', 'data']);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(ProxyError));
      const error = mockNext.mock.calls[0][0] as ProxyError;
      expect(error.code).toBe(ErrorCodes.INVALID_REQUEST);
      expect(error.message).toContain('Missing required fields');
    });
  });
});
