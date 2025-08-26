import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Test constants
const TEST_SIGNING_KEY = 'test-signing-key-for-jwt-tokens-must-be-long-enough';
const TEST_WALLET_ADDRESS = '0x742d35Cc6634C0532925a3b8D0C9C0E3C5d5c8eF';
const TEST_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

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

vi.mock('cors', () => ({
  default: () => (req: any, res: any, next: any) => next()
}));

describe('Authentication System', () => {
  let wallet: ethers.Wallet;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup test wallet
    wallet = new ethers.Wallet(TEST_PRIVATE_KEY);

    // Set environment variable
    process.env.GOOGLE_CLOUD_PROJECT = 'test-project';

    // Reset Secret Manager mock
    mockSecretManager.accessSecretVersion.mockResolvedValue([{
      payload: {
        data: Buffer.from(TEST_SIGNING_KEY)
      }
    }]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Challenge Generation', () => {
    it('should generate a valid challenge for a wallet address', async () => {
      const req = {
        method: 'POST',
        path: '/challenge',
        body: {
          walletAddress: TEST_WALLET_ADDRESS
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge: expect.stringContaining('DeLangZeta Authentication Challenge'),
          nonce: expect.any(String),
          expiresAt: expect.any(Number)
        })
      );
    });

    it('should reject invalid wallet addresses', async () => {
      const req = {
        method: 'POST',
        path: '/challenge',
        body: {
          walletAddress: 'invalid-address'
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid wallet address format'
      });
    });

    it('should require walletAddress field', async () => {
      const req = {
        method: 'POST',
        path: '/challenge',
        body: {}
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing walletAddress'
      });
    });
  });

  describe('Wallet Authentication', () => {
    it('should authenticate with valid signature and nonce', async () => {
      // First, generate a challenge
      const challengeReq = {
        method: 'POST',
        path: '/challenge',
        body: {
          walletAddress: wallet.address
        }
      };

      const challengeRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(challengeReq, challengeRes);

      const challengeResponse = challengeRes.json.mock.calls[0][0];
      const { challenge, nonce } = challengeResponse;

      // Sign the challenge
      const signature = await wallet.signMessage(challenge);

      // Now authenticate
      const authReq = {
        method: 'POST',
        path: '/authenticate',
        body: {
          walletAddress: wallet.address,
          signature,
          message: challenge,
          nonce,
          chainId: 1
        }
      };

      const authRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(authReq, authRes);

      expect(authRes.status).toHaveBeenCalledWith(200);
      expect(authRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: 3600,
          permissions: ['read', 'write', 'upload']
        })
      );
    });

    it('should reject authentication with invalid signature', async () => {
      const req = {
        method: 'POST',
        path: '/authenticate',
        body: {
          walletAddress: wallet.address,
          signature: '0xinvalidsignature',
          message: 'test message',
          nonce: 'test-nonce',
          chainId: 1
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid signature or expired nonce'
      });
    });

    it('should reject authentication with missing nonce', async () => {
      const req = {
        method: 'POST',
        path: '/authenticate',
        body: {
          walletAddress: wallet.address,
          signature: 'test-signature',
          message: 'test message',
          chainId: 1
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing required fields: walletAddress, signature, message, nonce'
      });
    });

    it('should prevent nonce reuse', async () => {
      // Generate challenge
      const challengeReq = {
        method: 'POST',
        path: '/challenge',
        body: {
          walletAddress: wallet.address
        }
      };

      const challengeRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(challengeReq, challengeRes);

      const { challenge, nonce } = challengeRes.json.mock.calls[0][0];
      const signature = await wallet.signMessage(challenge);

      // First authentication should succeed
      const authReq1 = {
        method: 'POST',
        path: '/authenticate',
        body: {
          walletAddress: wallet.address,
          signature,
          message: challenge,
          nonce,
          chainId: 1
        }
      };

      const authRes1 = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(authReq1, authRes1);
      expect(authRes1.status).toHaveBeenCalledWith(200);

      // Second authentication with same nonce should fail
      const authReq2 = {
        method: 'POST',
        path: '/authenticate',
        body: {
          walletAddress: wallet.address,
          signature,
          message: challenge,
          nonce,
          chainId: 1
        }
      };

      const authRes2 = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(authReq2, authRes2);
      expect(authRes2.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Token Refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      // Create a valid refresh token
      const refreshToken = jwt.sign(
        {
          walletAddress: wallet.address.toLowerCase(),
          type: 'refresh',
          iat: Math.floor(Date.now() / 1000),
          jti: crypto.randomUUID()
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '7d',
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        }
      );

      const req = {
        method: 'POST',
        path: '/refresh',
        body: {
          refreshToken
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: expect.any(String),
          refreshToken: expect.any(String),
          expiresIn: 3600,
          permissions: ['read', 'write', 'upload']
        })
      );
    });

    it('should reject invalid refresh token', async () => {
      const req = {
        method: 'POST',
        path: '/refresh',
        body: {
          refreshToken: 'invalid-token'
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired refresh token'
      });
    });

    it('should reject access token used as refresh token', async () => {
      // Create an access token instead of refresh token
      const accessToken = jwt.sign(
        {
          walletAddress: wallet.address.toLowerCase(),
          type: 'access',
          permissions: ['read', 'write', 'upload'],
          iat: Math.floor(Date.now() / 1000),
          jti: crypto.randomUUID()
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
        method: 'POST',
        path: '/refresh',
        body: {
          refreshToken: accessToken
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired refresh token'
      });
    });
  });

  describe('Token Validation', () => {
    it('should validate valid access token', async () => {
      // Create a valid access token
      const accessToken = jwt.sign(
        {
          walletAddress: wallet.address.toLowerCase(),
          type: 'access',
          permissions: ['read', 'write', 'upload'],
          iat: Math.floor(Date.now() / 1000),
          jti: crypto.randomUUID()
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
        method: 'GET',
        path: '/validate',
        headers: {
          authorization: `Bearer ${accessToken}`
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          valid: true,
          walletAddress: wallet.address.toLowerCase(),
          permissions: ['read', 'write', 'upload'],
          expiresAt: expect.any(Number)
        })
      );
    });

    it('should reject missing authorization header', async () => {
      const req = {
        method: 'GET',
        path: '/validate',
        headers: {}
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Missing or invalid authorization header'
      });
    });

    it('should reject invalid token format', async () => {
      const req = {
        method: 'GET',
        path: '/validate',
        headers: {
          authorization: 'Bearer invalid-token'
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid or expired access token'
      });
    });
  });

  describe('Security Headers', () => {
    it('should set security headers on all responses', async () => {
      const req = {
        method: 'POST',
        path: '/challenge',
        body: {
          walletAddress: TEST_WALLET_ADDRESS
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.set).toHaveBeenCalledWith({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Secret Manager failures gracefully', async () => {
      // Mock Secret Manager failure
      mockSecretManager.accessSecretVersion.mockRejectedValue(new Error('Secret Manager error'));

      const req = {
        method: 'POST',
        path: '/challenge',
        body: {
          walletAddress: TEST_WALLET_ADDRESS
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal server error'
      });
    });

    it('should handle unsupported HTTP methods', async () => {
      const req = {
        method: 'DELETE',
        path: '/challenge',
        body: {}
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        set: vi.fn(),
        end: vi.fn()
      };

      await authHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Method not allowed'
      });
    });
  });
});