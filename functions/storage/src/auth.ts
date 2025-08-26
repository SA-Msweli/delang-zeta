import jwt from 'jsonwebtoken';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { UserPermissions } from './types.js';

const secretClient = new SecretManagerServiceClient();

export interface AuthenticatedUser {
  userId: string;
  walletAddress: string;
  permissions: UserPermissions;
  iat: number;
  exp: number;
}

export class AuthenticationError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

let jwtSecret: string | null = null;

async function getJwtSecret(): Promise<string> {
  if (jwtSecret) return jwtSecret;

  try {
    const [version] = await secretClient.accessSecretVersion({
      name: 'projects/delang-zeta/secrets/jwt-signing-key/versions/latest',
    });

    jwtSecret = version.payload?.data?.toString() || '';
    if (!jwtSecret) {
      throw new Error('JWT secret is empty');
    }

    return jwtSecret;
  } catch (error) {
    console.error('Failed to retrieve JWT secret:', error);
    throw new AuthenticationError('Authentication service unavailable', 503);
  }
}

export async function authenticateUser(authHeader: string | undefined): Promise<AuthenticatedUser> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Missing or invalid authorization header');
  }

  const token = authHeader.substring(7);

  try {
    const secret = await getJwtSecret();
    const decoded = jwt.verify(token, secret) as any;

    if (!decoded.userId || !decoded.walletAddress) {
      throw new AuthenticationError('Invalid token payload');
    }

    // Default permissions - in production, these would come from a database
    const permissions: UserPermissions = {
      canUpload: true,
      canDownload: true,
      canDelete: false,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedContentTypes: [
        'text/plain',
        'text/csv',
        'application/json',
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/webm'
      ],
      dailyUploadLimit: 50,
      dailyDownloadLimit: 200
    };

    return {
      userId: decoded.userId,
      walletAddress: decoded.walletAddress,
      permissions,
      iat: decoded.iat,
      exp: decoded.exp
    };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AuthenticationError('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new AuthenticationError('Token expired');
    }
    throw error;
  }
}

export function checkUploadPermission(user: AuthenticatedUser, fileSize: number, contentType: string): void {
  if (!user.permissions.canUpload) {
    throw new AuthorizationError('Upload permission denied');
  }

  if (fileSize > user.permissions.maxFileSize) {
    throw new AuthorizationError(`File size exceeds limit of ${user.permissions.maxFileSize} bytes`);
  }

  if (!user.permissions.allowedContentTypes.includes(contentType)) {
    throw new AuthorizationError(`Content type ${contentType} not allowed`);
  }
}

export function checkDownloadPermission(user: AuthenticatedUser, fileOwnerId: string): void {
  if (!user.permissions.canDownload) {
    throw new AuthorizationError('Download permission denied');
  }

  // Users can always download their own files
  // Additional logic for shared files would go here
  if (user.userId !== fileOwnerId) {
    // For now, only allow users to download their own files
    throw new AuthorizationError('Access denied to this file');
  }
}