import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response } from 'express';
import { uploadHandler, downloadHandler, metadataHandler } from '../handlers.js';

// Mock dependencies
vi.mock('../auth.js', () => ({
  authenticateUser: vi.fn(),
  checkUploadPermission: vi.fn(),
  checkDownloadPermission: vi.fn(),
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

vi.mock('../storage.js', () => ({
  storageService: {
    generateSignedUploadUrl: vi.fn(),
    generateSignedDownloadUrl: vi.fn(),
    getUserFiles: vi.fn(),
    deleteFile: vi.fn(),
    getFileMetadata: vi.fn()
  }
}));

vi.mock('../audit.js', () => ({
  auditLogger: {
    logUploadAttempt: vi.fn(),
    logDownloadAttempt: vi.fn(),
    logAccessDenied: vi.fn(),
    logAction: vi.fn()
  }
}));

vi.mock('cors', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

import { authenticateUser, checkUploadPermission, AuthenticationError } from '../auth.js';
import { storageService } from '../storage.js';
import { auditLogger } from '../audit.js';

describe('Storage Handlers', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockJson: ReturnType<typeof vi.fn>;
  let mockStatus: ReturnType<typeof vi.fn>;

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

  describe('uploadHandler', () => {
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

    it('should handle successful upload request', async () => {
      const uploadRequest = {
        taskId: 'task123',
        fileName: 'test.txt',
        contentType: 'text/plain',
        fileSize: 1024
      };

      const uploadResponse = {
        uploadUrl: 'https://storage.googleapis.com/signed-url',
        fileId: 'file123',
        expiresAt: new Date(Date.now() + 3600000),
        maxFileSize: 10 * 1024 * 1024,
        allowedContentTypes: ['text/plain']
      };

      mockReq.body = uploadRequest;
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (storageService.generateSignedUploadUrl as any).mockResolvedValue(uploadResponse);

      await uploadHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: uploadResponse,
        warnings: []
      });
      expect(auditLogger.logUploadAttempt).toHaveBeenCalledWith(
        'user123',
        'file123',
        'test.txt',
        1024,
        'text/plain',
        '127.0.0.1',
        'Bearer valid-token',
        true
      );
    });

    it('should reject request with missing fields', async () => {
      mockReq.body = { taskId: 'task123' }; // Missing required fields
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);

      await uploadHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Missing required fields' });
    });

    it('should reject request with invalid file name', async () => {
      const uploadRequest = {
        taskId: 'task123',
        fileName: '../../../etc/passwd',
        contentType: 'text/plain',
        fileSize: 1024
      };

      mockReq.body = uploadRequest;
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);

      await uploadHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Invalid file name',
          details: expect.arrayContaining([
            'File name contains invalid characters or patterns'
          ])
        })
      );
    });

    it('should handle authentication error', async () => {
      mockReq.body = {
        taskId: 'task123',
        fileName: 'test.txt',
        contentType: 'text/plain',
        fileSize: 1024
      };
      (mockReq.get as any).mockReturnValue('Bearer invalid-token');
      (authenticateUser as any).mockRejectedValue(new AuthenticationError('Invalid token'));

      await uploadHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    it('should reject non-POST requests', async () => {
      mockReq.method = 'GET';

      await uploadHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(405);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Method not allowed' });
    });
  });

  describe('downloadHandler', () => {
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

    it('should handle successful download request', async () => {
      const downloadRequest = {
        fileId: 'file123',
        accessReason: 'User requested download'
      };

      const downloadResponse = {
        downloadUrl: 'https://storage.googleapis.com/signed-download-url',
        expiresAt: new Date(Date.now() + 3600000),
        accessGranted: true,
        fileName: 'test.txt',
        fileSize: 1024
      };

      const mockMetadata = {
        fileId: 'file123',
        userId: 'user123',
        fileName: 'test.txt',
        fileSize: 1024
      };

      mockReq.body = downloadRequest;
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (storageService.getFileMetadata as any).mockResolvedValue(mockMetadata);
      (storageService.generateSignedDownloadUrl as any).mockResolvedValue(downloadResponse);

      await downloadHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: downloadResponse
      });
    });

    it('should reject request for non-existent file', async () => {
      const downloadRequest = {
        fileId: 'nonexistent',
        accessReason: 'User requested download'
      };

      mockReq.body = downloadRequest;
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (storageService.getFileMetadata as any).mockResolvedValue(null);

      await downloadHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'File not found' });
      expect(auditLogger.logAccessDenied).toHaveBeenCalled();
    });
  });

  describe('metadataHandler', () => {
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

    it('should handle GET request for user files', async () => {
      const mockFiles = [
        {
          fileId: 'file1',
          userId: 'user123',
          fileName: 'test1.txt',
          fileSize: 1024,
          uploadedAt: new Date()
        }
      ];

      mockReq.method = 'GET';
      mockReq.query = { limit: '10', offset: '0' };
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (storageService.getUserFiles as any).mockResolvedValue(mockFiles);

      await metadataHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: {
          files: mockFiles,
          total: 1,
          limit: 10,
          offset: 0
        }
      });
    });

    it('should handle DELETE request for file', async () => {
      mockReq.method = 'DELETE';
      mockReq.query = { fileId: 'file123' };
      (mockReq.get as any).mockReturnValue('Bearer valid-token');
      (authenticateUser as any).mockResolvedValue(mockUser);
      (storageService.deleteFile as any).mockResolvedValue(undefined);

      await metadataHandler(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: 'File deleted successfully'
      });
      expect(auditLogger.logAction).toHaveBeenCalledWith(
        'user123',
        'delete',
        'file123',
        '127.0.0.1',
        'Bearer valid-token',
        true
      );
    });
  });
});