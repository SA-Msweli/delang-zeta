import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// Test constants
const TEST_SIGNING_KEY = 'test-signing-key-for-jwt-tokens-must-be-long-enough-for-security';
const TEST_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF';

// Mock Secret Manager
const mockSecretManager = {
  accessSecretVersion: vi.fn().mockResolvedValue([{
    payload: {
      data: Buffer.from(TEST_SIGNING_KEY)
    }
  }])
};

vi.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: vi.fn(() => mockSecretManager)
}));

// Import after mocking
import {
  UserRole,
  Permission,
  validateToken,
  authenticate,
  authorize,
  rateLimit,
  requireRole,
  logAuditEvent,
  getAuditLogs,
  detectSuspiciousActivity,
  suspiciousActivityCheck,
  AuthenticatedRequest
} from './authorization';

describe('Authorization System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';
  });

  describe('Role-Based Permissions', () => {
    it('should assign correct permissions to contributor role', async () => {
      const token = jwt.sign(
        {
          walletAddress: TEST_WALLET_ADDRESS,
          type: 'access',
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        }
      );

      const userInfo = await validateToken(token);
      expect(userInfo).toBeDefined();
      expect(userInfo!.role).toBe(UserRole.CONTRIBUTOR);
      expect(userInfo!.permissions).toEqual([
        Permission.READ,
        Permission.WRITE,
        Permission.UPLOAD
      ]);
    });

    it('should validate token correctly', async () => {
      const token = jwt.sign(
        {
          walletAddress: TEST_WALLET_ADDRESS,
          type: 'access',
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        }
      );

      const userInfo = await validateToken(token);
      expect(userInfo).toBeDefined();
      expect(userInfo!.walletAddress).toBe(TEST_WALLET_ADDRESS);
    });

    it('should reject refresh tokens for access validation', async () => {
      const token = jwt.sign(
        {
          walletAddress: TEST_WALLET_ADDRESS,
          type: 'refresh',
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '7d',
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        }
      );

      const userInfo = await validateToken(token);
      expect(userInfo).toBeNull();
    });

    it('should reject invalid tokens', async () => {
      const userInfo = await validateToken('invalid-token');
      expect(userInfo).toBeNull();
    });
  });

  describe('Authentication Middleware', () => {
    it('should authenticate valid token', async () => {
      const token = jwt.sign(
        {
          walletAddress: TEST_WALLET_ADDRESS,
          type: 'access',
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        }
      );

      const req = {
        headers: {
          authorization: `Bearer ${token}`
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const authMiddleware = authenticate();
      await authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.walletAddress).toBe(TEST_WALLET_ADDRESS);
    });

    it('should reject missing authorization header', async () => {
      const req = {
        headers: {},
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const authMiddleware = authenticate();
      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing or invalid authorization header'
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject invalid token format', async () => {
      const req = {
        headers: {
          authorization: 'Bearer invalid-token'
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const authMiddleware = authenticate();
      await authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Authorization Middleware', () => {
    it('should allow access with sufficient permissions', () => {
      const req = {
        user: {
          walletAddress: TEST_WALLET_ADDRESS,
          role: UserRole.CONTRIBUTOR,
          permissions: [Permission.READ, Permission.WRITE, Permission.UPLOAD]
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const authzMiddleware = authorize([Permission.READ, Permission.WRITE]);
      authzMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access with insufficient permissions', () => {
      const req = {
        user: {
          walletAddress: TEST_WALLET_ADDRESS,
          role: UserRole.CONTRIBUTOR,
          permissions: [Permission.READ]
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const authzMiddleware = authorize([Permission.READ, Permission.ADMIN]);
      authzMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions',
        required: [Permission.READ, Permission.ADMIN],
        current: [Permission.READ]
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should require authentication', () => {
      const req = {
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const authzMiddleware = authorize([Permission.READ]);
      authzMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', () => {
      const req = {
        user: {
          walletAddress: TEST_WALLET_ADDRESS,
          role: UserRole.CONTRIBUTOR,
          permissions: [Permission.READ]
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn()
      } as any;

      const next = vi.fn();

      const rateLimitMiddleware = rateLimit({
        windowMs: 60000, // 1 minute
        maxRequests: 10
      });

      rateLimitMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith({
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '9',
        'X-RateLimit-Reset': expect.any(String)
      });
    });

    it('should block requests exceeding rate limit', () => {
      const req = {
        user: {
          walletAddress: TEST_WALLET_ADDRESS,
          role: UserRole.CONTRIBUTOR,
          permissions: [Permission.READ]
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn()
      } as any;

      const next = vi.fn();

      const rateLimitMiddleware = rateLimit({
        windowMs: 60000,
        maxRequests: 1
      });

      // First request should pass
      rateLimitMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);

      // Second request should be blocked
      rateLimitMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Rate limit exceeded',
        retryAfter: expect.any(Number)
      });
    });
  });

  describe('Role-Based Access Control', () => {
    it('should allow access for correct role', () => {
      const req = {
        user: {
          walletAddress: TEST_WALLET_ADDRESS,
          role: UserRole.VALIDATOR,
          permissions: []
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const roleMiddleware = requireRole(UserRole.VALIDATOR);
      roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should allow admin access to any role', () => {
      const req = {
        user: {
          walletAddress: TEST_WALLET_ADDRESS,
          role: UserRole.ADMIN,
          permissions: []
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const roleMiddleware = requireRole(UserRole.VALIDATOR);
      roleMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should deny access for incorrect role', () => {
      const req = {
        user: {
          walletAddress: TEST_WALLET_ADDRESS,
          role: UserRole.CONTRIBUTOR,
          permissions: []
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const roleMiddleware = requireRole(UserRole.VALIDATOR);
      roleMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Insufficient role',
        required: UserRole.VALIDATOR,
        current: UserRole.CONTRIBUTOR
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Audit Logging', () => {
    it('should log audit events', () => {
      const entry = {
        timestamp: new Date(),
        walletAddress: TEST_WALLET_ADDRESS,
        action: 'test_action',
        success: true,
        ipAddress: '127.0.0.1'
      };

      logAuditEvent(entry);
      const logs = getAuditLogs(1);

      expect(logs).toHaveLength(1);
      expect(logs[0]).toEqual(entry);
    });

    it('should limit audit log size', () => {
      // Add more than 1000 entries
      for (let i = 0; i < 1005; i++) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: TEST_WALLET_ADDRESS,
          action: `test_action_${i}`,
          success: true
        });
      }

      const logs = getAuditLogs(2000);
      expect(logs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Suspicious Activity Detection', () => {
    it('should detect too many failed authentication attempts', () => {
      // Log multiple failed authentication attempts
      for (let i = 0; i < 15; i++) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: TEST_WALLET_ADDRESS,
          action: 'authentication_failed',
          success: false
        });
      }

      const result = detectSuspiciousActivity(TEST_WALLET_ADDRESS);
      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain('Too many failed authentication attempts: 15');
    });

    it('should detect rate limit violations', () => {
      // Log multiple rate limit violations
      for (let i = 0; i < 10; i++) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: TEST_WALLET_ADDRESS,
          action: 'rate_limit_exceeded',
          success: false
        });
      }

      const result = detectSuspiciousActivity(TEST_WALLET_ADDRESS);
      expect(result.suspicious).toBe(true);
      expect(result.reasons).toContain('Multiple rate limit violations: 10');
    });

    it('should not flag normal activity as suspicious', () => {
      logAuditEvent({
        timestamp: new Date(),
        walletAddress: TEST_WALLET_ADDRESS,
        action: 'authentication_success',
        success: true
      });

      const result = detectSuspiciousActivity(TEST_WALLET_ADDRESS);
      expect(result.suspicious).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe('Suspicious Activity Middleware', () => {
    it('should block suspicious users', () => {
      // First, create suspicious activity
      for (let i = 0; i < 15; i++) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: TEST_WALLET_ADDRESS,
          action: 'authentication_failed',
          success: false
        });
      }

      const req = {
        user: {
          walletAddress: TEST_WALLET_ADDRESS,
          role: UserRole.CONTRIBUTOR,
          permissions: []
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const suspiciousMiddleware = suspiciousActivityCheck();
      suspiciousMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Account temporarily restricted due to suspicious activity',
        reasons: expect.arrayContaining([
          expect.stringContaining('Too many failed authentication attempts')
        ])
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should allow normal users to proceed', () => {
      const req = {
        user: {
          walletAddress: 'clean-user-address',
          role: UserRole.CONTRIBUTOR,
          permissions: []
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-user-agent')
      } as any;

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      } as any;

      const next = vi.fn();

      const suspiciousMiddleware = suspiciousActivityCheck();
      suspiciousMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});