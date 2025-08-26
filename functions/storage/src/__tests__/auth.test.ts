import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { authenticateUser, checkUploadPermission, checkDownloadPermission, AuthenticationError, AuthorizationError } from '../auth.js';

// Mock the Secret Manager
vi.mock('@google-cloud/secret-manager', () => ({
  SecretManagerServiceClient: vi.fn(() => ({
    accessSecretVersion: vi.fn().mockResolvedValue([{
      payload: {
        data: Buffer.from('test-secret-key')
      }
    }])
  }))
}));

describe('Authentication and Authorization', () => {
  const mockSecret = 'test-secret-key';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticateUser', () => {
    it('should authenticate valid JWT token', async () => {
      const payload = {
        userId: 'user123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const token = jwt.sign(payload, mockSecret);
      const authHeader = `Bearer ${token}`;

      const user = await authenticateUser(authHeader);

      expect(user.userId).toBe('user123');
      expect(user.walletAddress).toBe('0x1234567890123456789012345678901234567890');
      expect(user.permissions).toBeDefined();
      expect(user.permissions.canUpload).toBe(true);
    });

    it('should reject missing authorization header', async () => {
      await expect(authenticateUser(undefined)).rejects.toThrow(AuthenticationError);
    });

    it('should reject invalid authorization header format', async () => {
      await expect(authenticateUser('InvalidHeader')).rejects.toThrow(AuthenticationError);
    });

    it('should reject expired token', async () => {
      const payload = {
        userId: 'user123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      };

      const token = jwt.sign(payload, mockSecret);
      const authHeader = `Bearer ${token}`;

      await expect(authenticateUser(authHeader)).rejects.toThrow(AuthenticationError);
    });

    it('should reject token with invalid signature', async () => {
      const payload = {
        userId: 'user123',
        walletAddress: '0x1234567890123456789012345678901234567890',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const token = jwt.sign(payload, 'wrong-secret');
      const authHeader = `Bearer ${token}`;

      await expect(authenticateUser(authHeader)).rejects.toThrow(AuthenticationError);
    });

    it('should reject token with missing required fields', async () => {
      const payload = {
        userId: 'user123',
        // Missing walletAddress
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const token = jwt.sign(payload, mockSecret);
      const authHeader = `Bearer ${token}`;

      await expect(authenticateUser(authHeader)).rejects.toThrow(AuthenticationError);
    });
  });

  describe('checkUploadPermission', () => {
    const mockUser = {
      userId: 'user123',
      walletAddress: '0x1234567890123456789012345678901234567890',
      permissions: {
        canUpload: true,
        canDownload: true,
        canDelete: false,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedContentTypes: ['text/plain', 'audio/mpeg'],
        dailyUploadLimit: 50,
        dailyDownloadLimit: 200
      },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    it('should allow valid upload', () => {
      expect(() => {
        checkUploadPermission(mockUser, 1024 * 1024, 'text/plain'); // 1MB text file
      }).not.toThrow();
    });

    it('should reject upload when permission denied', () => {
      const userWithoutPermission = {
        ...mockUser,
        permissions: { ...mockUser.permissions, canUpload: false }
      };

      expect(() => {
        checkUploadPermission(userWithoutPermission, 1024, 'text/plain');
      }).toThrow(AuthorizationError);
    });

    it('should reject file exceeding size limit', () => {
      expect(() => {
        checkUploadPermission(mockUser, 20 * 1024 * 1024, 'text/plain'); // 20MB file
      }).toThrow(AuthorizationError);
    });

    it('should reject disallowed content type', () => {
      expect(() => {
        checkUploadPermission(mockUser, 1024, 'application/x-executable');
      }).toThrow(AuthorizationError);
    });
  });

  describe('checkDownloadPermission', () => {
    const mockUser = {
      userId: 'user123',
      walletAddress: '0x1234567890123456789012345678901234567890',
      permissions: {
        canUpload: true,
        canDownload: true,
        canDelete: false,
        maxFileSize: 10 * 1024 * 1024,
        allowedContentTypes: ['text/plain', 'audio/mpeg'],
        dailyUploadLimit: 50,
        dailyDownloadLimit: 200
      },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
    };

    it('should allow user to download their own files', () => {
      expect(() => {
        checkDownloadPermission(mockUser, 'user123'); // Same user ID
      }).not.toThrow();
    });

    it('should reject download when permission denied', () => {
      const userWithoutPermission = {
        ...mockUser,
        permissions: { ...mockUser.permissions, canDownload: false }
      };

      expect(() => {
        checkDownloadPermission(userWithoutPermission, 'user123');
      }).toThrow(AuthorizationError);
    });

    it('should reject download of other users files', () => {
      expect(() => {
        checkDownloadPermission(mockUser, 'otherUser456');
      }).toThrow(AuthorizationError);
    });
  });
});