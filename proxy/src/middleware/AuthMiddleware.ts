/**
 * HuiNet Proxy Server - Authentication Middleware
 */

import type { Request, Response, NextFunction } from 'express';
import { ProxyError, ErrorCodes } from '../types';

export interface AuthRequest extends Request {
  apiKey?: string;
}

/**
 * Create API Key authentication middleware
 */
export function createAuthMiddleware(validApiKey: string) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string | undefined;

    if (!apiKey) {
      const error = new ProxyError(
        ErrorCodes.UNAUTHORIZED,
        'Missing API Key. Provide X-API-Key header.',
        401
      );
      return next(error);
    }

    if (apiKey !== validApiKey) {
      const error = new ProxyError(
        ErrorCodes.UNAUTHORIZED,
        'Invalid API Key',
        401
      );
      return next(error);
    }

    req.apiKey = apiKey;
    next();
  };
}

/**
 * Create WebSocket authentication handler
 */
export function createWsAuth(validApiKey: string) {
  return (requestUrl: string): { valid: boolean; apiKey?: string } => {
    try {
      const url = new URL(requestUrl, 'http://localhost');
      const apiKey = url.searchParams.get('apiKey');

      if (!apiKey) {
        return { valid: false };
      }

      if (apiKey !== validApiKey) {
        return { valid: false };
      }

      return { valid: true, apiKey };
    } catch {
      return { valid: false };
    }
  };
}

/**
 * Error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof ProxyError) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  // Unknown errors
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: ErrorCodes.INTERNAL_ERROR,
  });
}

/**
 * Request validation middleware
 */
export function validateRequest(requiredFields: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = requiredFields.filter(field => !(field in req.body));

    if (missing.length > 0) {
      const error = new ProxyError(
        ErrorCodes.INVALID_REQUEST,
        `Missing required fields: ${missing.join(', ')}`,
        400
      );
      return next(error);
    }

    next();
  };
}
