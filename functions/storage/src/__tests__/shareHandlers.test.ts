import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { enhancedAccessHandler, createShareLinkHandler, shareAccessHandler, manageSharingHandler } from '../shareHandlers.js';

// Mock dependencies
vi.mock('../auth.js', () => ({
  authenticateUser: vi.fn(),
  AuthenticationError: class extends Error {
    constructor(message: string, public statusCode: number = 401) {
      super(message);
      this.name = 'AuthenticationError';
    }
  },
  AuthorizationError: class extends Error {
    constructor(message: string, public statusCode: number = 403) {
      super(message);
      this.name = 'AuthorizationError';
    }
  }
}));

vi.mock('../fileAccess.js', () => ({
  fileAccessService: {
    generateSecureAccessUrl: vi.fn(),
    createShareLink: vi.fn(),
    accessViaShareLink: vi.fn(),
    updateSharingSettings: vi.fn(),
    getUserShareLinks: vi.fn(),
    revokeShareLink: vi.fn()
  }
}));

vi.mock('../audit.js', () => ({
  auditLogger: {
    logAction: vi.fn()
  }
}));

vi.mock('cors', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

import { authenticateUser } from '../auth.js';
import { fileAccessService } from '../fileAccess.js';

describe('Share Handlers', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;

  const mockUser = {
    userId: 'user123',
    walletAddress: '0x1234567890123456789012345678901234567890',
    permissions: {
      canUpload: true,
      canDownload: true,
      canDelete: false,
      maxFileSize: 10 * 1024 * 1024,
      allowedContentTypes: ['text/plain'],
      dailyUploadLimit: 50,
      dailyDownloadLimit: 200
    },
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockJson = vi.fn();
    mockStatus = vi.fn().mockReturnValue({ json: mockJson });

    mockReq = {
      method: 'POST',
      body: {},
      get: vi.fn(),
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' }
    };

    mockRes = {
      status: mockStatus,
      json: mockJson
    };
  });

  describe('enhancedAccessHandler', () => {
    it('should handle successful enhanced access request', async () => {
      const accessRequest = {
        fileId: 'file123',
        accessReason: 'User requested download',
        requestedBy: 'user123',
        accessType: 'download',
        expirationHours: 2
      };

      const accessResponse = {
        accessUrl: 'https://signed-url.com',
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        accessGranted: true,
        accessToken: 'token123',
        restrictions: {
          downloadLimit: undefined,
          viewOnly: false,
          watermarked: false
        }
      };

      mockReq.body = accessRequest;
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.generateSecureAccessUrl as any).mockResolvedValue(accessResponse);

      await enhancedAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: accessResponse
      });
    });

    it('should reject request with missing fields', async () => {
      mockReq.body = { fileId: 'file123' }; // Missing required fields
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);

      await enhancedAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    it('should handle file not found error', async () => {
      const accessRequest = {
        fileId: 'nonexistent',
        accessReason: 'User requested download',
        requestedBy: 'user123',
        accessType: 'download'
      };

      mockReq.body = accessRequest;
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.generateSecureAccessUrl as any).mockRejectedValue(new Error('File not found'));

      await enhancedAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'File not found' });
    });

    it('should handle access denied error', async () => {
      const accessRequest = {
        fileId: 'file123',
        accessReason: 'User requested download',
        requestedBy: 'user123',
        accessType: 'download'
      };

      mockReq.body = accessRequest;
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.generateSecureAccessUrl as any).mockRejectedValue(new Error('Access denied'));

      await enhancedAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Access denied' });
    });

    it('should handle expired file error', async () => {
      const accessRequest = {
        fileId: 'file123',
        accessReason: 'User requested download',
        requestedBy: 'user123',
        accessType: 'download'
      };

      mockReq.body = accessRequest;
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.generateSecureAccessUrl as any).mockRejectedValue(new Error('File has expired'));

      await enhancedAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(410);
      expect(mockJson).toHaveBeenCalledWith({ error: 'File or access has expired' });
    });

    it('should handle access limit exceeded error', async () => {
      const accessRequest = {
        fileId: 'file123',
        accessReason: 'User requested download',
        requestedBy: 'user123',
        accessType: 'download'
      };

      mockReq.body = accessRequest;
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.generateSecureAccessUrl as any).mockRejectedValue(new Error('Download limit exceeded'));

      await enhancedAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(429);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Access limit exceeded' });
    });
  });

  describe('createShareLinkHandler', () => {
    it('should create share link successfully', async () => {
      const shareLink = {
        shareId: 'share123',
        fileId: 'file123',
        createdBy: 'user123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        accessCount: 0,
        isActive: true,
        shareUrl: 'https://delang-zeta.web.app/shared/share123',
        permissions: {
          canDownload: true,
          canView: true,
          requiresAuth: false
        }
      };

      mockReq.body = {
        fileId: 'file123',
        options: {
          expirationHours: 24,
          canDownload: true,
          canView: true
        }
      };
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.createShareLink as any).mockResolvedValue(shareLink);

      await createShareLinkHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: shareLink
      });
    });

    it('should reject request with missing fileId', async () => {
      mockReq.body = { options: {} };
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);

      await createShareLinkHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Missing fileId' });
    });

    it('should handle non-owner error', async () => {
      mockReq.body = { fileId: 'file123' };
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.createShareLink as any).mockRejectedValue(new Error('Only file owner can create share links'));

      await createShareLinkHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(403);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Only file owner can create share links' });
    });
  });

  describe('shareAccessHandler', () => {
    it('should handle successful share access', async () => {
      const accessResponse = {
        accessUrl: 'https://signed-url.com',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        accessGranted: true,
        accessToken: 'token123',
        restrictions: {
          downloadLimit: 10,
          viewOnly: false,
          watermarked: true
        }
      };

      mockReq.body = {
        shareId: 'share123',
        accessorId: 'user456'
      };
      (fileAccessService.accessViaShareLink as any).mockResolvedValue(accessResponse);

      await shareAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: accessResponse
      });
    });

    it('should reject request with missing shareId', async () => {
      mockReq.body = {};

      await shareAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Missing shareId' });
    });

    it('should handle share link not found', async () => {
      mockReq.body = { shareId: 'nonexistent' };
      (fileAccessService.accessViaShareLink as any).mockRejectedValue(new Error('Share link not found'));

      await shareAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Share link not found' });
    });

    it('should handle expired share link', async () => {
      mockReq.body = { shareId: 'expired123' };
      (fileAccessService.accessViaShareLink as any).mockRejectedValue(new Error('Share link has expired'));

      await shareAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(410);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Share link has expired' });
    });

    it('should handle authentication required', async () => {
      mockReq.body = { shareId: 'auth-required123' };
      (fileAccessService.accessViaShareLink as any).mockRejectedValue(new Error('Authentication required'));

      await shareAccessHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Authentication required' });
    });
  });

  describe('manageSharingHandler', () => {
    it('should update sharing settings successfully', async () => {
      mockReq.method = 'PUT';
      mockReq.body = {
        fileId: 'file123',
        settings: {
          isPublic: true,
          allowedUsers: ['user1', 'user2'],
          allowedRoles: ['viewer'],
          requiresApproval: false
        }
      };
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.updateSharingSettings as any).mockResolvedValue(undefined);

      await manageSharingHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Sharing settings updated successfully'
      });
    });

    it('should get user share links successfully', async () => {
      const shareLinks = [
        {
          shareId: 'share1',
          fileId: 'file1',
          createdBy: 'user123',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          accessCount: 5,
          isActive: true,
          shareUrl: 'https://delang-zeta.web.app/shared/share1',
          permissions: { canDownload: true, canView: true, requiresAuth: false }
        }
      ];

      mockReq.method = 'GET';
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.getUserShareLinks as any).mockResolvedValue(shareLinks);

      await manageSharingHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: shareLinks
      });
    });

    it('should revoke share link successfully', async () => {
      mockReq.method = 'DELETE';
      mockReq.query = { shareId: 'share123' };
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (fileAccessService.revokeShareLink as any).mockResolvedValue(undefined);

      await manageSharingHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'Share link revoked successfully'
      });
    });

    it('should reject unsupported HTTP methods', async () => {
      mockReq.method = 'PATCH';
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);

      await manageSharingHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(405);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Method not allowed' });
    });
  });
});