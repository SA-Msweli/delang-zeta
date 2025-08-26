import { HttpFunction } from '@google-cloud/functions-framework/build/src/functions';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import cors from 'cors';
import crypto from 'crypto';

const corsHandler = cors({ origin: true });
const secretManager = new SecretManagerServiceClient();

// In-memory nonce store (in production, use Redis or Firestore)
const nonceStore = new Map<string, { nonce: string; timestamp: number }>();
const NONCE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface AuthRequest {
  walletAddress: string;
  signature: string;
  message: string;
  nonce: string;
  chainId: number;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  permissions: string[];
}

interface ChallengeRequest {
  walletAddress: string;
}

interface ChallengeResponse {
  challenge: string;
  nonce: string;
  expiresAt: number;
}

interface RefreshRequest {
  refreshToken: string;
}

interface TokenPayload {
  walletAddress: string;
  type: 'access' | 'refresh';
  permissions?: string[];
  iat?: number;
  exp?: number;
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

// Generate cryptographic nonce
function generateNonce(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Clean expired nonces
function cleanExpiredNonces(): void {
  const now = Date.now();
  for (const [address, data] of nonceStore.entries()) {
    if (now - data.timestamp > NONCE_EXPIRY) {
      nonceStore.delete(address);
    }
  }
}

// Generate authentication challenge
function generateChallenge(walletAddress: string, nonce: string): string {
  const timestamp = Date.now();
  return `DeLangZeta Authentication Challenge\n\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign this message to authenticate with DeLangZeta.`;
}

// Verify wallet signature with nonce validation
function verifyWalletSignature(
  walletAddress: string,
  signature: string,
  message: string,
  nonce: string
): boolean {
  try {
    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    const isValidSignature = recoveredAddress.toLowerCase() === walletAddress.toLowerCase();

    if (!isValidSignature) {
      return false;
    }

    // Verify nonce exists and is not expired
    const storedNonce = nonceStore.get(walletAddress.toLowerCase());
    if (!storedNonce) {
      console.error('No nonce found for wallet:', walletAddress);
      return false;
    }

    if (storedNonce.nonce !== nonce) {
      console.error('Invalid nonce for wallet:', walletAddress);
      return false;
    }

    if (Date.now() - storedNonce.timestamp > NONCE_EXPIRY) {
      console.error('Expired nonce for wallet:', walletAddress);
      nonceStore.delete(walletAddress.toLowerCase());
      return false;
    }

    // Verify message contains the nonce
    if (!message.includes(nonce)) {
      console.error('Message does not contain expected nonce');
      return false;
    }

    // Remove used nonce to prevent replay attacks
    nonceStore.delete(walletAddress.toLowerCase());
    return true;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
}

// Generate JWT tokens with enhanced security
async function generateTokens(walletAddress: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const signingKey = await getJwtSigningKey();
  const now = Math.floor(Date.now() / 1000);

  const accessToken = jwt.sign(
    {
      walletAddress: walletAddress.toLowerCase(),
      type: 'access',
      permissions: ['read', 'write', 'upload'],
      iat: now,
      jti: crypto.randomUUID(), // Unique token ID
    },
    signingKey,
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
    signingKey,
    {
      expiresIn: '7d',
      algorithm: 'HS256',
      issuer: 'delang-zeta-auth',
      audience: 'delang-zeta-api'
    }
  );

  return { accessToken, refreshToken };
}

// Validate and decode JWT token
async function validateToken(token: string): Promise<TokenPayload | null> {
  try {
    const signingKey = await getJwtSigningKey();
    const decoded = jwt.verify(token, signingKey, {
      algorithms: ['HS256'],
      issuer: 'delang-zeta-auth',
      audience: 'delang-zeta-api'
    }) as TokenPayload;

    return decoded;
  } catch (error) {
    console.error('Token validation failed:', error);
    return null;
  }
}

// Handle authentication challenge generation
async function handleChallenge(req: any, res: any): Promise<void> {
  const { walletAddress }: ChallengeRequest = req.body;

  if (!walletAddress) {
    res.status(400).json({ error: 'Missing walletAddress' });
    return;
  }

  if (!ethers.isAddress(walletAddress)) {
    res.status(400).json({ error: 'Invalid wallet address format' });
    return;
  }

  // Clean expired nonces
  cleanExpiredNonces();

  // Generate new nonce and challenge
  const nonce = generateNonce();
  const challenge = generateChallenge(walletAddress, nonce);
  const timestamp = Date.now();

  // Store nonce
  nonceStore.set(walletAddress.toLowerCase(), { nonce, timestamp });

  const response: ChallengeResponse = {
    challenge,
    nonce,
    expiresAt: timestamp + NONCE_EXPIRY,
  };

  res.status(200).json(response);
}

// Handle wallet authentication
async function handleAuthentication(req: any, res: any): Promise<void> {
  const { walletAddress, signature, message, nonce, chainId }: AuthRequest = req.body;

  // Validate required fields
  if (!walletAddress || !signature || !message || !nonce) {
    res.status(400).json({
      error: 'Missing required fields: walletAddress, signature, message, nonce'
    });
    return;
  }

  if (!ethers.isAddress(walletAddress)) {
    res.status(400).json({ error: 'Invalid wallet address format' });
    return;
  }

  // Verify the signature with nonce validation
  const isValidSignature = verifyWalletSignature(walletAddress, signature, message, nonce);
  if (!isValidSignature) {
    res.status(401).json({ error: 'Invalid signature or expired nonce' });
    return;
  }

  // Generate tokens
  const { accessToken, refreshToken } = await generateTokens(walletAddress);

  const response: AuthResponse = {
    accessToken,
    refreshToken,
    expiresIn: 3600, // 1 hour
    permissions: ['read', 'write', 'upload'],
  };

  res.status(200).json(response);
}

// Handle token refresh
async function handleRefresh(req: any, res: any): Promise<void> {
  const { refreshToken }: RefreshRequest = req.body;

  if (!refreshToken) {
    res.status(400).json({ error: 'Missing refreshToken' });
    return;
  }

  // Validate refresh token
  const tokenPayload = await validateToken(refreshToken);
  if (!tokenPayload || tokenPayload.type !== 'refresh') {
    res.status(401).json({ error: 'Invalid or expired refresh token' });
    return;
  }

  // Generate new access token
  const { accessToken, refreshToken: newRefreshToken } = await generateTokens(tokenPayload.walletAddress);

  const response: AuthResponse = {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: 3600,
    permissions: ['read', 'write', 'upload'],
  };

  res.status(200).json(response);
}

// Handle token validation
async function handleValidation(req: any, res: any): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);
  const tokenPayload = await validateToken(token);

  if (!tokenPayload || tokenPayload.type !== 'access') {
    res.status(401).json({ error: 'Invalid or expired access token' });
    return;
  }

  res.status(200).json({
    valid: true,
    walletAddress: tokenPayload.walletAddress,
    permissions: tokenPayload.permissions || [],
    expiresAt: tokenPayload.exp ? tokenPayload.exp * 1000 : null,
  });
}

export const authHandler: HttpFunction = async (req, res) => {
  corsHandler(req, res, async () => {
    try {
      // Set security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      });

      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }

      // Route based on path
      const path = req.path || req.url;

      switch (path) {
        case '/challenge':
          if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          await handleChallenge(req, res);
          break;

        case '/authenticate':
          if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          await handleAuthentication(req, res);
          break;

        case '/refresh':
          if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          await handleRefresh(req, res);
          break;

        case '/validate':
          if (req.method !== 'GET') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          await handleValidation(req, res);
          break;

        default:
          // Default to authentication for backward compatibility
          if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
          }
          await handleAuthentication(req, res);
          break;
      }
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
};