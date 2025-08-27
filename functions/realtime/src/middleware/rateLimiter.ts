import { Request, Response, NextFunction } from 'express';
import { Firestore } from '@google-cloud/firestore';
import { configManager } from '../config';
import { AuthRequest } from './auth';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  userId?: string;
  ip: string;
}

class RateLimiter {
  private firestore: Firestore;
  private collection = 'rate_limits';

  constructor() {
    this.firestore = new Firestore();
  }

  async checkRateLimit(
    identifier: string,
    type: 'user' | 'ip',
    limit: number,
    windowMs: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const docId = `${type}_${identifier}`;

    try {
      const docRef = this.firestore.collection(this.collection).doc(docId);

      await this.firestore.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);

        if (!doc.exists) {
          // First request
          transaction.set(docRef, {
            count: 1,
            resetTime: now + windowMs,
            lastRequest: now,
            identifier,
            type
          });
          return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
        }

        const data = doc.data() as RateLimitEntry & { lastRequest: number };

        // Check if window has expired
        if (now >= data.resetTime) {
          // Reset window
          transaction.update(docRef, {
            count: 1,
            resetTime: now + windowMs,
            lastRequest: now
          });
          return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
        }

        // Check if limit exceeded
        if (data.count >= limit) {
          return {
            allowed: false,
            remaining: 0,
            resetTime: data.resetTime
          };
        }

        // Increment count
        transaction.update(docRef, {
          count: data.count + 1,
          lastRequest: now
        });

        return {
          allowed: true,
          remaining: limit - (data.count + 1),
          resetTime: data.resetTime
        };
      });

      // This won't be reached due to transaction, but TypeScript needs it
      return { allowed: false, remaining: 0, resetTime: now };
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // On error, allow the request but log the issue
      return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
    }
  }

  async cleanupExpiredEntries(): Promise<void> {
    const now = Date.now();

    try {
      const expiredQuery = this.firestore
        .collection(this.collection)
        .where('resetTime', '<', now)
        .limit(100);

      const snapshot = await expiredQuery.get();

      if (snapshot.empty) {
        return;
      }

      const batch = this.firestore.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Cleaned up ${snapshot.size} expired rate limit entries`);
    } catch (error) {
      console.error('Failed to cleanup expired rate limit entries:', error);
    }
  }
}

const rateLimiter = new RateLimiter();

export async function applyRateLimit(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const config = await configManager.getConfig();
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = req.user?.userId;

    // Check IP-based rate limit
    const ipResult = await rateLimiter.checkRateLimit(
      ip,
      'ip',
      config.rateLimits.perIP,
      config.rateLimits.windowMs
    );

    if (!ipResult.allowed) {
      res.status(429).json({
        error: 'Too many requests from this IP',
        code: 'RATE_LIMIT_IP',
        retryAfter: Math.ceil((ipResult.resetTime - Date.now()) / 1000)
      });
      return;
    }

    // Check user-based rate limit if authenticated
    if (userId) {
      const userResult = await rateLimiter.checkRateLimit(
        userId,
        'user',
        config.rateLimits.perUser,
        config.rateLimits.windowMs
      );

      if (!userResult.allowed) {
        res.status(429).json({
          error: 'Too many requests for this user',
          code: 'RATE_LIMIT_USER',
          retryAfter: Math.ceil((userResult.resetTime - Date.now()) / 1000)
        });
        return;
      }

      // Set user rate limit headers
      res.set({
        'X-RateLimit-Limit-User': config.rateLimits.perUser.toString(),
        'X-RateLimit-Remaining-User': userResult.remaining.toString(),
        'X-RateLimit-Reset-User': Math.ceil(userResult.resetTime / 1000).toString()
      });
    }

    // Set IP rate limit headers
    res.set({
      'X-RateLimit-Limit-IP': config.rateLimits.perIP.toString(),
      'X-RateLimit-Remaining-IP': ipResult.remaining.toString(),
      'X-RateLimit-Reset-IP': Math.ceil(ipResult.resetTime / 1000).toString()
    });

    next();
  } catch (error) {
    console.error('Rate limiting error:', error);
    // On error, allow the request but log the issue
    next();
  }
}

// Cleanup function to be called periodically
export async function cleanupRateLimits(): Promise<void> {
  await rateLimiter.cleanupExpiredEntries();
}

export { rateLimiter };