/**
 * HuiNet Proxy Server - Advanced Authentication Middleware
 *
 * Provides JWT tokens, rate limiting, and IP whitelisting
 */

import { Request, Response, NextFunction } from 'express';
import { IncomingHttpHeaders } from 'http';
import jwt from 'jsonwebtoken';

export interface JWTConfig {
  secret: string;
  expiresIn: string; // e.g., '1h', '24h', '7d'
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface IPWhitelistConfig {
  enabled: boolean;
  allowedIPs: string[]; // IP addresses or CIDR ranges
  allowedRanges: Array<{ start: string; end: string }>;
}

export interface TokenPayload {
  nodeId: string;
  apiKey: string;
  scopes: string[];
  iat?: number;
  exp?: number;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Advanced Authentication Middleware
 */
export class AdvancedAuthMiddleware {
  private jwtConfig: JWTConfig;
  private rateLimitConfig: RateLimitConfig;
  private ipWhitelistConfig: IPWhitelistConfig;
  private rateLimitStore: Map<string, RateLimitEntry> = new Map();
  private revokedTokens: Set<string> = new Set();

  constructor(config: {
    jwt?: Partial<JWTConfig>;
    rateLimit?: Partial<RateLimitConfig>;
    ipWhitelist?: Partial<IPWhitelistConfig>;
  } = {}) {
    this.jwtConfig = {
      secret: config.jwt?.secret || this.generateSecret(),
      expiresIn: config.jwt?.expiresIn || '24h',
    };

    this.rateLimitConfig = {
      windowMs: config.rateLimit?.windowMs || 60000, // 1 minute
      maxRequests: config.rateLimit?.maxRequests || 100,
      skipSuccessfulRequests: config.rateLimit?.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.rateLimit?.skipFailedRequests ?? false,
    };

    this.ipWhitelistConfig = {
      enabled: config.ipWhitelist?.enabled ?? false,
      allowedIPs: config.ipWhitelist?.allowedIPs || [],
      allowedRanges: config.ipWhitelist?.allowedRanges || [],
    };
  }

  /**
   * Generate JWT token from API key
   */
  generateToken(apiKey: string, scopes: string[] = ['read', 'write']): string {
    const payload: TokenPayload = {
      nodeId: this.generateNodeId(apiKey),
      apiKey,
      scopes,
      iat: Math.floor(Date.now() / 1000),
    };

    return jwt.sign(payload, this.jwtConfig.secret, {
      expiresIn: this.jwtConfig.expiresIn,
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { valid: boolean; payload?: TokenPayload; error?: string } {
    try {
      // Check if token is revoked
      if (this.revokedTokens.has(token)) {
        return { valid: false, error: 'Token has been revoked' };
      }

      const decoded = jwt.verify(token, this.jwtConfig.secret) as TokenPayload;

      return { valid: true, payload: decoded };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Invalid token',
      };
    }
  }

  /**
   * Revoke a JWT token
   */
  revokeToken(token: string): boolean {
    const verification = this.verifyToken(token);
    if (verification.valid) {
      this.revokedTokens.add(token);
      return true;
    }
    return false;
  }

  /**
   * Middleware: JWT authentication
   */
  authenticateJWT = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: 'Missing Authorization header',
          code: 'MISSING_AUTH_HEADER',
        });
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
          success: false,
          error: 'Invalid Authorization header format',
          code: 'INVALID_AUTH_FORMAT',
        });
        return;
      }

      const token = parts[1];
      const verification = this.verifyToken(token);

      if (!verification.valid) {
        res.status(401).json({
          success: false,
          error: verification.error || 'Invalid token',
          code: 'INVALID_TOKEN',
        });
        return;
      }

      // Attach payload to request
      (req as any).token = verification.payload;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Authentication error',
        code: 'AUTH_ERROR',
      });
    }
  };

  /**
   * Middleware: Rate limiting
   */
  rateLimit = (options?: Partial<RateLimitConfig>) => {
    const config = { ...this.rateLimitConfig, ...options };

    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.getRateLimitKey(req);
      const now = Date.now();

      // Get or create rate limit entry
      let entry = this.rateLimitStore.get(key);

      if (!entry || now > entry.resetTime) {
        // Create new entry
        entry = {
          count: 1,
          resetTime: now + config.windowMs,
        };
        this.rateLimitStore.set(key, entry);
      } else {
        // Increment count
        entry.count++;
      }

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.maxRequests - entry.count).toString());
      res.setHeader('X-RateLimit-Reset', new Date(entry.resetTime).toISOString());

      // Check if limit exceeded
      if (entry.count > config.maxRequests) {
        res.status(429).json({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        });
        return;
      }

      // Track response for skip options
      if (config.skipSuccessfulRequests || config.skipFailedRequests) {
        res.on('finish', () => {
          const statusCode = res.statusCode;
          const shouldSkip = (config.skipSuccessfulRequests && statusCode < 400) ||
                             (config.skipFailedRequests && statusCode >= 400);

          if (shouldSkip && entry.count > 0) {
            entry.count--;
          }
        });
      }

      next();
    };
  };

  /**
   * Middleware: IP whitelist
   */
  ipWhitelist = (req: Request, res: Response, next: NextFunction): void => {
    if (!this.ipWhitelistConfig.enabled) {
      next();
      return;
    }

    const clientIP = this.getClientIP(req);

    if (this.isIPAllowed(clientIP)) {
      next();
    } else {
      res.status(403).json({
        success: false,
        error: 'IP address not allowed',
        code: 'IP_NOT_ALLOWED',
        clientIP,
      });
    }
  };

  /**
   * Middleware: Scope-based authorization
   */
  requireScope(requiredScope: string) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const payload = (req as any).token as TokenPayload | undefined;

      if (!payload) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      if (payload.scopes.includes(requiredScope) || payload.scopes.includes('*')) {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: `Insufficient scope. Required: ${requiredScope}`,
          code: 'INSUFFICIENT_SCOPE',
        });
      }
    };
  }

  /**
   * Get rate limit key for a request
   */
  private getRateLimitKey(req: Request): string {
    const token = (req as any).token as TokenPayload | undefined;
    const clientIP = this.getClientIP(req);

    // Use token nodeId if available, otherwise use IP
    return token?.nodeId || clientIP || 'unknown';
  }

  /**
   * Get client IP address
   */
  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
           req.headers['x-real-ip'] as string ||
           req.socket.remoteAddress ||
           'unknown';
  }

  /**
   * Check if IP is allowed
   */
  private isIPAllowed(ip: string): boolean {
    // Check exact matches
    if (this.ipWhitelistConfig.allowedIPs.includes(ip)) {
      return true;
    }

    // Check CIDR ranges
    for (const range of this.ipWhitelistConfig.allowedRanges) {
      if (this.isIPInRange(ip, range.start, range.end)) {
        return true;
      }
    }

    // If no whitelist configured, allow all
    if (this.ipWhitelistConfig.allowedIPs.length === 0 &&
        this.ipWhitelistConfig.allowedRanges.length === 0) {
      return true;
    }

    return false;
  }

  /**
   * Check if IP is in range
   */
  private isIPInRange(ip: string, start: string, end: string): boolean {
    // Simple implementation - for production, use ip-range-check or similar
    const ipToNum = (ipStr: string): number => {
      const parts = ipStr.split('.');
      return (parseInt(parts[0]) << 24) +
             (parseInt(parts[1]) << 16) +
             (parseInt(parts[2]) << 8) +
             parseInt(parts[3]);
    };

    try {
      const ipNum = ipToNum(ip);
      const startNum = ipToNum(start);
      const endNum = ipToNum(end);
      return ipNum >= startNum && ipNum <= endNum;
    } catch {
      return false;
    }
  }

  /**
   * Generate a random node ID from API key
   */
  private generateNodeId(apiKey: string): string {
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < apiKey.length; i++) {
      const char = apiKey.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `node_${Math.abs(hash)}`;
  }

  /**
   * Generate a random secret
   */
  private generateSecret(): string {
    return require('crypto').randomBytes(32).toString('hex');
  }

  /**
   * Cleanup expired rate limit entries
   */
  cleanupRateLimitStore(): void {
    const now = Date.now();
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  /**
   * Get JWT config
   */
  getJWTConfig(): JWTConfig {
    return { ...this.jwtConfig };
  }

  /**
   * Get rate limit config
   */
  getRateLimitConfig(): RateLimitConfig {
    return { ...this.rateLimitConfig };
  }

  /**
   * Get IP whitelist config
   */
  getIPWhitelistConfig(): IPWhitelistConfig {
    return { ...this.ipWhitelistConfig };
  }

  /**
   * Get current rate limit stats
   */
  getRateLimitStats(): Array<{ key: string; count: number; resetTime: number }> {
    return Array.from(this.rateLimitStore.entries()).map(([key, entry]) => ({
      key,
      count: entry.count,
      resetTime: entry.resetTime,
    }));
  }
}

export * from './AdvancedAuthMiddleware';
