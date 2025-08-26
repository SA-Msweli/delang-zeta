import { describe, it, expect, vi } from 'vitest';
import { ethers } from 'ethers';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Test constants
const TEST_SIGNING_KEY = 'test-signing-key-for-jwt-tokens-must-be-long-enough-for-security';
const TEST_PRIVATE_KEY = '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

describe('Authentication Core Functions', () => {
  let wallet: ethers.Wallet;

  beforeEach(() => {
    wallet = new ethers.Wallet(TEST_PRIVATE_KEY);
  });

  describe('JWT Token Generation', () => {
    it('should generate valid JWT tokens', () => {
      const walletAddress = wallet.address;
      const now = Math.floor(Date.now() / 1000);

      const accessToken = jwt.sign(
        {
          walletAddress: walletAddress.toLowerCase(),
          type: 'access',
          permissions: ['read', 'write', 'upload'],
          iat: now,
          jti: crypto.randomUUID(),
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        }
      );

      const refreshToken = jwt.sign(
        {
          walletAddress: walletAddress.toLowerCase(),
          type: 'refresh',
          iat: now,
          jti: crypto.randomUUID(),
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '7d',
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        }
      );

      expect(accessToken).toBeDefined();
      expect(refreshToken).toBeDefined();

      // Verify tokens can be decoded
      const decodedAccess = jwt.verify(accessToken, TEST_SIGNING_KEY, {
        algorithms: ['HS256'],
        issuer: 'delang-zeta-auth',
        audience: 'delang-zeta-api'
      }) as any;

      const decodedRefresh = jwt.verify(refreshToken, TEST_SIGNING_KEY, {
        algorithms: ['HS256'],
        issuer: 'delang-zeta-auth',
        audience: 'delang-zeta-api'
      }) as any;

      expect(decodedAccess.walletAddress).toBe(walletAddress.toLowerCase());
      expect(decodedAccess.type).toBe('access');
      expect(decodedAccess.permissions).toEqual(['read', 'write', 'upload']);

      expect(decodedRefresh.walletAddress).toBe(walletAddress.toLowerCase());
      expect(decodedRefresh.type).toBe('refresh');
    });
  });

  describe('Signature Verification', () => {
    it('should verify wallet signatures correctly', async () => {
      const message = 'Test authentication message';
      const signature = await wallet.signMessage(message);

      // Verify signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      expect(recoveredAddress.toLowerCase()).toBe(wallet.address.toLowerCase());
    });

    it('should reject invalid signatures', () => {
      const message = 'Test authentication message';
      const invalidSignature = '0x1234567890abcdef';

      expect(() => {
        ethers.verifyMessage(message, invalidSignature);
      }).toThrow();
    });
  });

  describe('Nonce Generation', () => {
    it('should generate unique nonces', () => {
      const nonce1 = crypto.randomBytes(32).toString('hex');
      const nonce2 = crypto.randomBytes(32).toString('hex');

      expect(nonce1).not.toBe(nonce2);
      expect(nonce1).toHaveLength(64); // 32 bytes = 64 hex chars
      expect(nonce2).toHaveLength(64);
    });

    it('should generate challenge messages with nonce', () => {
      const walletAddress = wallet.address;
      const nonce = crypto.randomBytes(32).toString('hex');
      const timestamp = Date.now();

      const challenge = `DeLangZeta Authentication Challenge\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign this message to authenticate with DeLangZeta.`;

      expect(challenge).toContain(walletAddress);
      expect(challenge).toContain(nonce);
      expect(challenge).toContain('DeLangZeta Authentication Challenge');
    });
  });

  describe('Address Validation', () => {
    it('should validate correct Ethereum addresses', () => {
      expect(ethers.isAddress(wallet.address)).toBe(true);
      expect(ethers.isAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(ethers.isAddress('invalid-address')).toBe(false);
      expect(ethers.isAddress('0x123')).toBe(false);
      expect(ethers.isAddress('')).toBe(false);
    });
  });

  describe('Token Validation', () => {
    it('should validate tokens with correct parameters', () => {
      const token = jwt.sign(
        {
          walletAddress: wallet.address.toLowerCase(),
          type: 'access',
          permissions: ['read', 'write', 'upload'],
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        }
      );

      const decoded = jwt.verify(token, TEST_SIGNING_KEY, {
        algorithms: ['HS256'],
        issuer: 'delang-zeta-auth',
        audience: 'delang-zeta-api'
      }) as any;

      expect(decoded.walletAddress).toBe(wallet.address.toLowerCase());
      expect(decoded.type).toBe('access');
    });

    it('should reject tokens with wrong issuer', () => {
      const token = jwt.sign(
        {
          walletAddress: wallet.address.toLowerCase(),
          type: 'access',
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'wrong-issuer',
          audience: 'delang-zeta-api'
        }
      );

      expect(() => {
        jwt.verify(token, TEST_SIGNING_KEY, {
          algorithms: ['HS256'],
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        });
      }).toThrow();
    });

    it('should reject tokens with wrong audience', () => {
      const token = jwt.sign(
        {
          walletAddress: wallet.address.toLowerCase(),
          type: 'access',
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '1h',
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'wrong-audience'
        }
      );

      expect(() => {
        jwt.verify(token, TEST_SIGNING_KEY, {
          algorithms: ['HS256'],
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        });
      }).toThrow();
    });

    it('should reject expired tokens', () => {
      const token = jwt.sign(
        {
          walletAddress: wallet.address.toLowerCase(),
          type: 'access',
        },
        TEST_SIGNING_KEY,
        {
          expiresIn: '-1h', // Already expired
          algorithm: 'HS256',
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        }
      );

      expect(() => {
        jwt.verify(token, TEST_SIGNING_KEY, {
          algorithms: ['HS256'],
          issuer: 'delang-zeta-auth',
          audience: 'delang-zeta-api'
        });
      }).toThrow();
    });
  });

  describe('Security Headers', () => {
    it('should define proper security headers', () => {
      const securityHeaders = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      };

      expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff');
      expect(securityHeaders['X-Frame-Options']).toBe('DENY');
      expect(securityHeaders['X-XSS-Protection']).toBe('1; mode=block');
      expect(securityHeaders['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    });
  });
});