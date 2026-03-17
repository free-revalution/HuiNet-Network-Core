/**
 * AdvancedAuthMiddleware Unit Tests
 */

import { AdvancedAuthMiddleware } from '../../src/middleware/AdvancedAuthMiddleware';

describe('AdvancedAuthMiddleware', () => {
  let auth: AdvancedAuthMiddleware;

  beforeEach(() => {
    auth = new AdvancedAuthMiddleware({
      jwt: {
        secret: 'test-secret',
        expiresIn: '1h',
      },
      rateLimit: {
        windowMs: 1000,
        maxRequests: 5,
      },
    });
  });

  describe('JWT token generation and verification', () => {
    it('should generate a valid JWT token', () => {
      const token = auth.generateToken('test-api-key', ['read', 'write']);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should verify a valid JWT token', () => {
      const token = auth.generateToken('test-api-key', ['read']);
      const result = auth.verifyToken(token);

      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.apiKey).toBe('test-api-key');
      expect(result.payload?.scopes).toEqual(['read']);
    });

    it('should reject an invalid JWT token', () => {
      const result = auth.verifyToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should revoke a JWT token', () => {
      const token = auth.generateToken('test-api-key', ['read']);

      const revoked = auth.revokeToken(token);
      expect(revoked).toBe(true);

      const verification = auth.verifyToken(token);
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('revoked');
    });

    it('should return false when revoking invalid token', () => {
      const revoked = auth.revokeToken('invalid-token');
      expect(revoked).toBe(false);
    });
  });

  describe('Rate limiting', () => {
    it('should allow requests within rate limit', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.1' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        on: jest.fn(),
      } as any;

      const next = jest.fn();

      const rateLimiter = auth.rateLimit();

      // Make 5 requests (within limit)
      for (let i = 0; i < 5; i++) {
        rateLimiter(req, res, next);
        expect(next).toHaveBeenCalled();
        next.mockClear();
      }

      expect(res.status).not.toHaveBeenCalledWith(429);
    });

    it('should block requests exceeding rate limit', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.2' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        on: jest.fn(),
      } as any;

      const next = jest.fn();

      const rateLimiter = auth.rateLimit();

      // Make 6 requests (exceeds limit of 5)
      for (let i = 0; i < 6; i++) {
        rateLimiter(req, res, next);
      }

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
        })
      );
    });

    it('should set rate limit headers', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.3' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        on: jest.fn(),
      } as any;

      const next = jest.fn();

      const rateLimiter = auth.rateLimit();

      rateLimiter(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '5');
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });
  });

  describe('IP whitelist', () => {
    it('should allow all IPs when whitelist is disabled', () => {
      const authNoWhitelist = new AdvancedAuthMiddleware({
        ipWhitelist: { enabled: false },
      });

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.100' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      authNoWhitelist.ipWhitelist(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow whitelisted IPs', () => {
      const authWhitelist = new AdvancedAuthMiddleware({
        ipWhitelist: {
          enabled: true,
          allowedIPs: ['192.168.1.100'],
        },
      });

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.100' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      authWhitelist.ipWhitelist(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should block non-whitelisted IPs', () => {
      const authWhitelist = new AdvancedAuthMiddleware({
        ipWhitelist: {
          enabled: true,
          allowedIPs: ['192.168.1.100'],
        },
      });

      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.200' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      authWhitelist.ipWhitelist(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Scope-based authorization', () => {
    it('should allow access with required scope', () => {
      const req = {
        headers: {},
        token: {
          nodeId: 'test-node',
          apiKey: 'test-key',
          scopes: ['read', 'write'],
        },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      const requireRead = auth.requireScope('read');
      requireRead(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow access with wildcard scope', () => {
      const req = {
        headers: {},
        token: {
          nodeId: 'test-node',
          apiKey: 'test-key',
          scopes: ['*'],
        },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      const requireAdmin = auth.requireScope('admin');
      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access without required scope', () => {
      const req = {
        headers: {},
        token: {
          nodeId: 'test-node',
          apiKey: 'test-key',
          scopes: ['read'],
        },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      const requireWrite = auth.requireScope('write');
      requireWrite(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should deny access without token', () => {
      const req = {
        headers: {},
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      const requireRead = auth.requireScope('read');
      requireRead(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('JWT authentication middleware', () => {
    it('should authenticate valid JWT token', () => {
      const token = auth.generateToken('test-api-key');

      const req = {
        headers: {
          authorization: `Bearer ${token}`,
        },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      auth.authenticateJWT(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.token).toBeDefined();
    });

    it('should reject request without Authorization header', () => {
      const req = {
        headers: {},
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      auth.authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with invalid token', () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token',
        },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      auth.authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject request with malformed Authorization header', () => {
      const req = {
        headers: {
          authorization: 'InvalidFormat token',
        },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any;

      const next = jest.fn();

      auth.authenticateJWT(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Utility methods', () => {
    it('should cleanup expired rate limit entries', () => {
      const req = {
        headers: {},
        socket: { remoteAddress: '192.168.1.50' },
      } as any;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        setHeader: jest.fn(),
        on: jest.fn(),
      } as any;

      const next = jest.fn();

      const rateLimiter = auth.rateLimit();

      // Make a request to create entry
      rateLimiter(req, res, next);

      // Get stats before cleanup
      let stats = auth.getRateLimitStats();
      expect(stats.length).toBeGreaterThan(0);

      // Cleanup
      auth.cleanupRateLimitStore();

      // Wait for window to expire and cleanup again
      const authShortWindow = new AdvancedAuthMiddleware({
        rateLimit: { windowMs: 10, maxRequests: 5 },
      });
      const shortLimiter = authShortWindow.rateLimit();
      shortLimiter(req, res, next);

      setTimeout(() => {
        authShortWindow.cleanupRateLimitStore();
        stats = authShortWindow.getRateLimitStats();
        expect(stats.length).toBe(0);
      }, 20);
    });

    it('should get configuration', () => {
      const jwtConfig = auth.getJWTConfig();
      expect(jwtConfig.secret).toBeDefined();

      const rateLimitConfig = auth.getRateLimitConfig();
      expect(rateLimitConfig.maxRequests).toBeDefined();

      const ipWhitelistConfig = auth.getIPWhitelistConfig();
      expect(ipWhitelistConfig.enabled).toBeDefined();
    });

    it('should get rate limit stats', () => {
      const stats = auth.getRateLimitStats();
      expect(Array.isArray(stats)).toBe(true);
    });
  });
});
