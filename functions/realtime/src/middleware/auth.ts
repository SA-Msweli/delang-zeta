import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { configManager } from '../config';
import { AuthenticatedRequest } from '../types';

export interface AuthRequest extends Request {
  user?: AuthenticatedRequest;
}

export async function authenticateJWT(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const token = authHeader.substring(7);
    const config = await configManager.getConfig();

    try {
      const decoded = jwt.verify(token, config.jwtSecret) as any;

      // Validate token structure
      if (!decoded.userId || !decoded.walletAddress) {
        throw new Error('Invalid token structure');
      }

      // Check token expiration
      if (decoded.exp && Date.now() >= decoded.exp * 1000) {
        throw new Error('Token expired');
      }

      req.user = {
        userId: decoded.userId,
        walletAddress: decoded.walletAddress,
        permissions: decoded.permissions || [],
        token
      };

      next();
    } catch (jwtError: any) {
      console.error('JWT verification failed:', jwtError.message);

      if (jwtError.name === 'TokenExpiredError') {
        res.status(401).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      } else if (jwtError.name === 'JsonWebTokenError') {
        res.status(401).json({
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      } else {
        res.status(401).json({
          error: 'Authentication failed',
          code: 'AUTH_FAILED'
        });
      }
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

export function requirePermissions(permissions: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.some(permission =>
      userPermissions.includes(permission) || userPermissions.includes('admin')
    );

    if (!hasPermission) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: permissions,
        current: userPermissions
      });
      return;
    }

    next();
  };
}

export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No auth provided, continue without user
    next();
    return;
  }

  // Auth provided, try to authenticate
  authenticateJWT(req, res, next);
}