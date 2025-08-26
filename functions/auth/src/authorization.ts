import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const secretManager = new SecretManagerServiceClient();

// User roles and permissions
export enum UserRole {
  CONTRIBUTOR = 'contributor',
  VALIDATOR = 'validator',
  ADMIN = 'admin',
  ORGANIZATION = 'organization'
}

export enum Permission {
  READ = 'read',
  WRITE = 'write',
  UPLOAD = 'upload',
  VALIDATE = 'validate',
  ADMIN = 'admin',
  CREATE_TASK = 'create_task',
  PURCHASE_LICENSE = 'purchase_license',
  MANAGE_USERS = 'manage_users'
}

// Role-based permissions mapping
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.CONTRIBUTOR]: [
    Permission.READ,
    Permission.WRITE,
    Permission.UPLOAD
  ],
  [UserRole.VALIDATOR]: [
    Permission.READ,
    Permission.WRITE,
    Permission.UPLOAD,
    Permission.VALIDATE
  ],
  [UserRole.ORGANIZATION]: [
    Permission.READ,
    Permission.WRITE,
    Permission.CREATE_TASK,
    Permission.PURCHASE_LICENSE
  ],
  [UserRole.ADMIN]: [
    Permission.READ,
    Permission.WRITE,
    Permission.UPLOAD,
    Permission.VALIDATE,
    Permission.ADMIN,
    Permission.CREATE_TASK,
    Permission.PURCHASE_LICENSE,
    Permission.MANAGE_USERS
  ]
};

// Rate limiting store (in production, use Redis)
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Audit log entry
export interface AuditLogEntry {
  timestamp: Date;
  walletAddress: string;
  action: string;
  resource?: string;
  success: boolean;
  ipAddress?: string;
  userAgent?: string;
  error?: string;
}

// In-memory audit log (in production, use database)
const auditLog: AuditLogEntry[] = [];

// Extended request interface with user info
export interface AuthenticatedRequest extends Request {
  user?: {
    walletAddress: string;
    role: UserRole;
    permissions: Permission[];
  };
}

// Get JWT signing key from Secret Manager
async function getJwtSigningKey(): Promise<string> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  try {
    const [version] = await secretManager.accessSecretVersion({
      name: `projects/${projectId}/secrets/jwt-signing-key/versions/latest`,
    });
    return version.payload?.data?.toString() || '';
  } catch (error) {
    console.error('Failed to retrieve JWT signing key:', error);
    throw new Error('Unable to access signing key');
  }
}

// Get user role (in production, fetch from database)
function getUserRole(walletAddress: string): UserRole {
  // Default role for new users
  // In production, this would query a database
  return UserRole.CONTRIBUTOR;
}

// Validate JWT token and extract user info
export async function validateToken(token: string): Promise<{
  walletAddress: string;
  role: UserRole;
  permissions: Permission[];
} | null> {
  try {
    const signingKey = await getJwtSigningKey();
    const decoded = jwt.verify(token, signingKey, {
      algorithms: ['HS256'],
      issuer: 'delang-zeta-auth',
      audience: 'delang-zeta-api'
    }) as any;

    if (decoded.type !== 'access') {
      return null;
    }

    const role = getUserRole(decoded.walletAddress);
    const permissions = ROLE_PERMISSIONS[role];

    return {
      walletAddress: decoded.walletAddress,
      role,
      permissions
    };
  } catch (error) {
    console.error('Token validation failed:', error);
    return null;
  }
}

// Authentication middleware
export function authenticate() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: 'unknown',
          action: 'authentication_failed',
          success: false,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          error: 'Missing authorization header'
        });

        return res.status(401).json({ error: 'Missing or invalid authorization header' });
      }

      const token = authHeader.substring(7);
      const userInfo = await validateToken(token);

      if (!userInfo) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: 'unknown',
          action: 'authentication_failed',
          success: false,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          error: 'Invalid token'
        });

        return res.status(401).json({ error: 'Invalid or expired token' });
      }

      req.user = userInfo;

      logAuditEvent({
        timestamp: new Date(),
        walletAddress: userInfo.walletAddress,
        action: 'authentication_success',
        success: true,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      next();
    } catch (error) {
      console.error('Authentication middleware error:', error);

      logAuditEvent({
        timestamp: new Date(),
        walletAddress: 'unknown',
        action: 'authentication_error',
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Authorization middleware - check if user has required permissions
export function authorize(requiredPermissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: 'unknown',
          action: 'authorization_failed',
          success: false,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          error: 'No user information'
        });

        return res.status(401).json({ error: 'Authentication required' });
      }

      const hasPermission = requiredPermissions.every(permission =>
        req.user!.permissions.includes(permission)
      );

      if (!hasPermission) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: req.user.walletAddress,
          action: 'authorization_failed',
          resource: requiredPermissions.join(','),
          success: false,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          error: 'Insufficient permissions'
        });

        return res.status(403).json({
          error: 'Insufficient permissions',
          required: requiredPermissions,
          current: req.user.permissions
        });
      }

      logAuditEvent({
        timestamp: new Date(),
        walletAddress: req.user.walletAddress,
        action: 'authorization_success',
        resource: requiredPermissions.join(','),
        success: true,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      next();
    } catch (error) {
      console.error('Authorization middleware error:', error);

      logAuditEvent({
        timestamp: new Date(),
        walletAddress: req.user?.walletAddress || 'unknown',
        action: 'authorization_error',
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// Rate limiting middleware
export function rateLimit(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
}) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const key = req.user?.walletAddress || req.ip || 'unknown';
      const now = Date.now();
      const windowStart = now - options.windowMs;

      // Clean expired entries
      for (const [k, entry] of rateLimitStore.entries()) {
        if (entry.resetTime < now) {
          rateLimitStore.delete(k);
        }
      }

      let entry = rateLimitStore.get(key);

      if (!entry || entry.resetTime < now) {
        entry = {
          count: 1,
          resetTime: now + options.windowMs
        };
        rateLimitStore.set(key, entry);
      } else {
        entry.count++;
      }

      if (entry.count > options.maxRequests) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: req.user?.walletAddress || 'unknown',
          action: 'rate_limit_exceeded',
          success: false,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          error: `Rate limit exceeded: ${entry.count}/${options.maxRequests}`
        });

        return res.status(429).json({
          error: options.message || 'Rate limit exceeded',
          retryAfter: Math.ceil((entry.resetTime - now) / 1000)
        });
      }

      // Add rate limit headers
      res.set({
        'X-RateLimit-Limit': options.maxRequests.toString(),
        'X-RateLimit-Remaining': Math.max(0, options.maxRequests - entry.count).toString(),
        'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString()
      });

      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      next(); // Continue on rate limiting errors
    }
  };
}

// Role-based access control middleware
export function requireRole(requiredRole: UserRole) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== requiredRole && req.user.role !== UserRole.ADMIN) {
      logAuditEvent({
        timestamp: new Date(),
        walletAddress: req.user.walletAddress,
        action: 'role_access_denied',
        resource: requiredRole,
        success: false,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        error: `Required role: ${requiredRole}, current role: ${req.user.role}`
      });

      return res.status(403).json({
        error: 'Insufficient role',
        required: requiredRole,
        current: req.user.role
      });
    }

    next();
  };
}

// Audit logging function
export function logAuditEvent(entry: AuditLogEntry): void {
  auditLog.push(entry);

  // Log to console for development
  console.log('AUDIT:', JSON.stringify(entry));

  // In production, this would write to a database or logging service
  // Keep only last 1000 entries in memory
  if (auditLog.length > 1000) {
    auditLog.shift();
  }
}

// Get audit logs (admin only)
export function getAuditLogs(limit: number = 100): AuditLogEntry[] {
  return auditLog.slice(-limit);
}

// Security event detection
export function detectSuspiciousActivity(walletAddress: string): {
  suspicious: boolean;
  reasons: string[];
} {
  const recentEvents = auditLog
    .filter(entry => entry.walletAddress === walletAddress)
    .filter(entry => Date.now() - entry.timestamp.getTime() < 60 * 60 * 1000); // Last hour

  const reasons: string[] = [];
  let suspicious = false;

  // Check for too many failed authentication attempts
  const failedAuth = recentEvents.filter(e =>
    e.action.includes('authentication_failed') || e.action.includes('authorization_failed')
  ).length;

  if (failedAuth > 10) {
    suspicious = true;
    reasons.push(`Too many failed authentication attempts: ${failedAuth}`);
  }

  // Check for rate limit violations
  const rateLimitViolations = recentEvents.filter(e =>
    e.action === 'rate_limit_exceeded'
  ).length;

  if (rateLimitViolations > 5) {
    suspicious = true;
    reasons.push(`Multiple rate limit violations: ${rateLimitViolations}`);
  }

  return { suspicious, reasons };
}

// Middleware to check for suspicious activity
export function suspiciousActivityCheck() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (req.user) {
      const { suspicious, reasons } = detectSuspiciousActivity(req.user.walletAddress);

      if (suspicious) {
        logAuditEvent({
          timestamp: new Date(),
          walletAddress: req.user.walletAddress,
          action: 'suspicious_activity_detected',
          success: false,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          error: reasons.join('; ')
        });

        return res.status(429).json({
          error: 'Account temporarily restricted due to suspicious activity',
          reasons
        });
      }
    }

    next();
  };
}