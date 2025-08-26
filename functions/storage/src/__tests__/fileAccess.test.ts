import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fileAccessService } from '../fileAccess.js';
import { FileMetadata, FileAccessRequest, FileSharingSettings } from '../types.js';

// Mock dependencies
vi.mock('@google-cloud/storage', () => ({
  Storage: vi.fn(() => ({
    bucket: vi.fn(() => ({
      file: vi.fn(() => ({
        getSignedUrl: vi.fn().mockResolvedValue(['https://signed-url.com']),
        exists: vi.fn().mockResolvedValue([true]),
        save: vi.fn().mockResolvedValue(undefined),
        download: vi.fn().mockResolvedValue([Buffer.from('{"test": "data"}')])
      })),
      getFiles: vi.fn().mockResolvedValue([[]])
    }))
  }))
}));

vi.mock('../storage.js', () => ({
  storageService: {
    getFileMetadata: vi.fn()
  }
}));

vi.mock('../audit.js', () => ({
  auditLogger: {
    logAction: vi.fn()
  }
}));

import { storageService } from '../storage.js';

describe('FileAccessService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSecureAccessUrl', () => {
    const mockMetadata: FileMetadata = {
      fileId: 'file123',
      userId: 'user123',
      taskId: 'task123',
      fileName: 'test.txt',
      fileSize: 1024,
      contentType: 'text/plain',
      uploadedAt: new Date(),
      storageUrl: 'path/to/file.txt',
      verified: true,
      accessCount: 0,
      downloadCount: 0,
      sharingSettings: {
        isPublic: false,
        allowedUsers: [],
        allowedRoles: [],
        requiresApproval: false
      }
    };

    const mockRequest: FileAccessRequest = {
      fileId: 'file123',
      accessReason: 'User requested access',
      requestedBy: 'user123',
      accessType: 'download',
      expirationHours: 2
    };

    it('should generate secure access URL for file owner', async () => {
      (storageService.getFileMetadata as any).mockResolvedValue(mockMetadata);

      const result = await fileAccessService.generateSecureAccessUrl(
        mockRequest,
        'user123',
        { canDownload: true }
      );

      expect(result.accessGranted).toBe(true);
      expect(result.accessUrl).toBe('https://signed-url.com');
      expect(result.accessToken).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should deny access for non-owner without sharing permissions', async () => {
      (storageService.getFileMetadata as any).mockResolvedValue(mockMetadata);

      await expect(
        fileAccessService.generateSecureAccessUrl(
          mockRequest,
          'otherUser',
          { canDownload: true }
        )
      ).rejects.toThrow('Access denied');
    });

    it('should allow access for public files', async () => {
      const publicMetadata = {
        ...mockMetadata,
        sharingSettings: {
          ...mockMetadata.sharingSettings!,
          isPublic: true
        }
      };
      (storageService.getFileMetadata as any).mockResolvedValue(publicMetadata);

      const result = await fileAccessService.generateSecureAccessUrl(
        mockRequest,
        'otherUser',
        { canDownload: true }
      );

      expect(result.accessGranted).toBe(true);
    });

    it('should deny access for expired files', async () => {
      const expiredMetadata = {
        ...mockMetadata,
        expirationDate: new Date(Date.now() - 24 * 60 * 60 * 1000) // Yesterday
      };
      (storageService.getFileMetadata as any).mockResolvedValue(expiredMetadata);

      await expect(
        fileAccessService.generateSecureAccessUrl(
          mockRequest,
          'user123',
          { canDownload: true }
        )
      ).rejects.toThrow('File has expired');
    });

    it('should deny access when download limit exceeded', async () => {
      const limitedMetadata = {
        ...mockMetadata,
        maxDownloads: 5,
        downloadCount: 5
      };
      (storageService.getFileMetadata as any).mockResolvedValue(limitedMetadata);

      await expect(
        fileAccessService.generateSecureAccessUrl(
          mockRequest,
          'user123',
          { canDownload: true }
        )
      ).rejects.toThrow('Download limit exceeded');
    });

    it('should allow access for allowed users', async () => {
      const sharedMetadata = {
        ...mockMetadata,
        sharingSettings: {
          ...mockMetadata.sharingSettings!,
          allowedUsers: ['allowedUser']
        }
      };
      (storageService.getFileMetadata as any).mockResolvedValue(sharedMetadata);

      const result = await fileAccessService.generateSecureAccessUrl(
        mockRequest,
        'allowedUser',
        { canDownload: true }
      );

      expect(result.accessGranted).toBe(true);
    });
  });

  describe('createShareLink', () => {
    const mockMetadata: FileMetadata = {
      fileId: 'file123',
      userId: 'user123',
      taskId: 'task123',
      fileName: 'test.txt',
      fileSize: 1024,
      contentType: 'text/plain',
      uploadedAt: new Date(),
      storageUrl: 'path/to/file.txt',
      verified: true,
      accessCount: 0,
      downloadCount: 0
    };

    it('should create share link for file owner', async () => {
      (storageService.getFileMetadata as any).mockResolvedValue(mockMetadata);

      const shareLink = await fileAccessService.createShareLink('file123', 'user123', {
        expirationHours: 24,
        canDownload: true,
        canView: true
      });

      expect(shareLink.fileId).toBe('file123');
      expect(shareLink.createdBy).toBe('user123');
      expect(shareLink.isActive).toBe(true);
      expect(shareLink.shareUrl).toContain('shared/');
      expect(shareLink.permissions.canDownload).toBe(true);
      expect(shareLink.permissions.canView).toBe(true);
    });

    it('should deny share link creation for non-owner', async () => {
      (storageService.getFileMetadata as any).mockResolvedValue(mockMetadata);

      await expect(
        fileAccessService.createShareLink('file123', 'otherUser')
      ).rejects.toThrow('Only file owner can create share links');
    });

    it('should create share link with default settings', async () => {
      (storageService.getFileMetadata as any).mockResolvedValue(mockMetadata);

      const shareLink = await fileAccessService.createShareLink('file123', 'user123');

      expect(shareLink.permissions.canDownload).toBe(true);
      expect(shareLink.permissions.canView).toBe(true);
      expect(shareLink.permissions.requiresAuth).toBe(false);
      expect(shareLink.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('updateSharingSettings', () => {
    const mockMetadata: FileMetadata = {
      fileId: 'file123',
      userId: 'user123',
      taskId: 'task123',
      fileName: 'test.txt',
      fileSize: 1024,
      contentType: 'text/plain',
      uploadedAt: new Date(),
      storageUrl: 'path/to/file.txt',
      verified: true,
      accessCount: 0,
      downloadCount: 0
    };

    it('should update sharing settings for file owner', async () => {
      (storageService.getFileMetadata as any).mockResolvedValue(mockMetadata);

      const newSettings: FileSharingSettings = {
        isPublic: true,
        allowedUsers: ['user1', 'user2'],
        allowedRoles: ['viewer'],
        requiresApproval: false,
        downloadLimit: 10
      };

      await expect(
        fileAccessService.updateSharingSettings('file123', 'user123', newSettings)
      ).resolves.not.toThrow();
    });

    it('should deny sharing settings update for non-owner', async () => {
      (storageService.getFileMetadata as any).mockResolvedValue(mockMetadata);

      const newSettings: FileSharingSettings = {
        isPublic: true,
        allowedUsers: [],
        allowedRoles: [],
        requiresApproval: false
      };

      await expect(
        fileAccessService.updateSharingSettings('file123', 'otherUser', newSettings)
      ).rejects.toThrow('Only file owner can update sharing settings');
    });
  });

  describe('accessViaShareLink', () => {
    it('should handle non-existent share link', async () => {
      // Mock getShareLink to return null
      vi.spyOn(fileAccessService as any, 'getShareLink').mockResolvedValue(null);

      await expect(
        fileAccessService.accessViaShareLink('nonexistent')
      ).rejects.toThrow('Share link not found');
    });

    it('should handle expired share link', async () => {
      const expiredShareLink = {
        shareId: 'share123',
        fileId: 'file123',
        createdBy: 'user123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
        accessCount: 0,
        isActive: true,
        shareUrl: 'https://example.com/shared/share123',
        permissions: {
          canDownload: true,
          canView: true,
          requiresAuth: false
        }
      };

      vi.spyOn(fileAccessService as any, 'getShareLink').mockResolvedValue(expiredShareLink);

      await expect(
        fileAccessService.accessViaShareLink('share123')
      ).rejects.toThrow('Share link has expired');
    });

    it('should handle access limit exceeded', async () => {
      const limitedShareLink = {
        shareId: 'share123',
        fileId: 'file123',
        createdBy: 'user123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        accessCount: 10,
        maxAccess: 10,
        isActive: true,
        shareUrl: 'https://example.com/shared/share123',
        permissions: {
          canDownload: true,
          canView: true,
          requiresAuth: false
        }
      };

      vi.spyOn(fileAccessService as any, 'getShareLink').mockResolvedValue(limitedShareLink);

      await expect(
        fileAccessService.accessViaShareLink('share123')
      ).rejects.toThrow('Share link access limit exceeded');
    });

    it('should require authentication when configured', async () => {
      const authRequiredShareLink = {
        shareId: 'share123',
        fileId: 'file123',
        createdBy: 'user123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        accessCount: 0,
        isActive: true,
        shareUrl: 'https://example.com/shared/share123',
        permissions: {
          canDownload: true,
          canView: true,
          requiresAuth: true
        }
      };

      vi.spyOn(fileAccessService as any, 'getShareLink').mockResolvedValue(authRequiredShareLink);

      await expect(
        fileAccessService.accessViaShareLink('share123')
      ).rejects.toThrow('Authentication required');
    });
  });
});