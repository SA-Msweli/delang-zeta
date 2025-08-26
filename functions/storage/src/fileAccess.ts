import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { FileMetadata, FileAccessRequest, FileAccessResponse, FileShareLink, FileSharingSettings } from './types.js';
import { storageService } from './storage.js';
import { auditLogger } from './audit.js';

const storage = new Storage();
const MAIN_BUCKET = 'delang-zeta-datasets';
const SHARE_LINKS_BUCKET = 'delang-zeta-metadata';

export class FileAccessService {
  private static instance: FileAccessService;

  private constructor() { }

  public static getInstance(): FileAccessService {
    if (!FileAccessService.instance) {
      FileAccessService.instance = new FileAccessService();
    }
    return FileAccessService.instance;
  }

  /**
   * Generate secure access URL with advanced permissions and expiration
   */
  public async generateSecureAccessUrl(
    request: FileAccessRequest,
    userId: string,
    userPermissions: any
  ): Promise<FileAccessResponse> {
    try {
      // Get file metadata
      const metadata = await storageService.getFileMetadata(request.fileId);
      if (!metadata) {
        throw new Error('File not found');
      }

      // Check access permissions
      const hasAccess = await this.checkFileAccess(metadata, userId, request.accessType);
      if (!hasAccess) {
        throw new Error('Access denied');
      }

      // Check if file has expired
      if (metadata.expirationDate && new Date() > metadata.expirationDate) {
        throw new Error('File has expired');
      }

      // Check download limits
      if (metadata.maxDownloads && metadata.downloadCount >= metadata.maxDownloads) {
        throw new Error('Download limit exceeded');
      }

      // Generate access token
      const accessToken = this.generateAccessToken(request.fileId, userId, request.accessType);

      // Determine expiration time
      const expirationHours = request.expirationHours || 1;
      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

      // Generate signed URL
      const bucket = storage.bucket(MAIN_BUCKET);
      const file = bucket.file(metadata.storageUrl);

      const [accessUrl] = await file.getSignedUrl({
        version: 'v4',
        action: request.accessType === 'download' ? 'read' : 'read',
        expires: expiresAt,
        extensionHeaders: {
          'x-access-token': accessToken,
          'x-user-id': userId,
          'x-access-reason': request.accessReason
        }
      });

      // Update access tracking
      await this.trackFileAccess(request.fileId, userId, request.accessType);

      // Determine restrictions
      const restrictions = {
        downloadLimit: metadata.sharingSettings?.downloadLimit,
        viewOnly: request.accessType === 'view',
        watermarked: metadata.sharingSettings?.requiresApproval || false
      };

      return {
        accessUrl,
        expiresAt,
        accessGranted: true,
        accessToken,
        restrictions
      };

    } catch (error) {
      console.error('Failed to generate secure access URL:', error);
      throw error;
    }
  }

  /**
   * Create shareable link with expiration and access controls
   */
  public async createShareLink(
    fileId: string,
    createdBy: string,
    options: {
      expirationHours?: number;
      maxAccess?: number;
      canDownload?: boolean;
      canView?: boolean;
      requiresAuth?: boolean;
      password?: string;
    } = {}
  ): Promise<FileShareLink> {
    try {
      // Get file metadata
      const metadata = await storageService.getFileMetadata(fileId);
      if (!metadata) {
        throw new Error('File not found');
      }

      // Check if user can create share links
      if (metadata.userId !== createdBy) {
        throw new Error('Only file owner can create share links');
      }

      const shareId = uuidv4();
      const expirationHours = options.expirationHours || 24;
      const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

      const shareLink: FileShareLink = {
        shareId,
        fileId,
        createdBy,
        createdAt: new Date(),
        expiresAt,
        accessCount: 0,
        maxAccess: options.maxAccess,
        isActive: true,
        shareUrl: `https://delang-zeta.web.app/shared/${shareId}`,
        permissions: {
          canDownload: options.canDownload ?? true,
          canView: options.canView ?? true,
          requiresAuth: options.requiresAuth ?? false
        }
      };

      // Store share link metadata
      await this.storeShareLink(shareLink);

      // Log share link creation
      await auditLogger.logAction(
        createdBy,
        'share_created' as any,
        fileId,
        'system',
        'system',
        true,
        undefined,
        {
          shareId,
          expiresAt: expiresAt.toISOString(),
          permissions: shareLink.permissions
        }
      );

      return shareLink;

    } catch (error) {
      console.error('Failed to create share link:', error);
      throw error;
    }
  }

  /**
   * Access file via share link
   */
  public async accessViaShareLink(
    shareId: string,
    accessorId?: string,
    password?: string
  ): Promise<FileAccessResponse> {
    try {
      // Get share link metadata
      const shareLink = await this.getShareLink(shareId);
      if (!shareLink) {
        throw new Error('Share link not found');
      }

      // Check if share link is active and not expired
      if (!shareLink.isActive || new Date() > shareLink.expiresAt) {
        throw new Error('Share link has expired');
      }

      // Check access limits
      if (shareLink.maxAccess && shareLink.accessCount >= shareLink.maxAccess) {
        throw new Error('Share link access limit exceeded');
      }

      // Check authentication requirements
      if (shareLink.permissions.requiresAuth && !accessorId) {
        throw new Error('Authentication required');
      }

      // Get file metadata
      const metadata = await storageService.getFileMetadata(shareLink.fileId);
      if (!metadata) {
        throw new Error('File not found');
      }

      // Generate access URL
      const bucket = storage.bucket(MAIN_BUCKET);
      const file = bucket.file(metadata.storageUrl);

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      const [accessUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt,
        extensionHeaders: {
          'x-share-id': shareId,
          'x-accessor-id': accessorId || 'anonymous'
        }
      });

      // Update share link access count
      await this.updateShareLinkAccess(shareId);

      // Log share link access
      await auditLogger.logAction(
        accessorId || 'anonymous',
        'share_accessed' as any,
        shareLink.fileId,
        'system',
        'system',
        true,
        undefined,
        {
          shareId,
          accessCount: shareLink.accessCount + 1
        }
      );

      const accessToken = this.generateAccessToken(shareLink.fileId, accessorId || 'anonymous', 'download');

      return {
        accessUrl,
        expiresAt,
        accessGranted: true,
        accessToken,
        restrictions: {
          downloadLimit: shareLink.maxAccess,
          viewOnly: !shareLink.permissions.canDownload,
          watermarked: true
        }
      };

    } catch (error) {
      console.error('Failed to access via share link:', error);
      throw error;
    }
  }

  /**
   * Update file sharing settings
   */
  public async updateSharingSettings(
    fileId: string,
    userId: string,
    settings: FileSharingSettings
  ): Promise<void> {
    try {
      const metadata = await storageService.getFileMetadata(fileId);
      if (!metadata) {
        throw new Error('File not found');
      }

      // Check ownership
      if (metadata.userId !== userId) {
        throw new Error('Only file owner can update sharing settings');
      }

      // Update metadata
      metadata.sharingSettings = settings;
      await this.updateFileMetadata(metadata);

      // Log settings update
      await auditLogger.logAction(
        userId,
        'sharing_updated' as any,
        fileId,
        'system',
        'system',
        true,
        undefined,
        { settings }
      );

    } catch (error) {
      console.error('Failed to update sharing settings:', error);
      throw error;
    }
  }

  /**
   * Revoke share link
   */
  public async revokeShareLink(shareId: string, userId: string): Promise<void> {
    try {
      const shareLink = await this.getShareLink(shareId);
      if (!shareLink) {
        throw new Error('Share link not found');
      }

      // Check if user can revoke
      if (shareLink.createdBy !== userId) {
        throw new Error('Only creator can revoke share link');
      }

      // Deactivate share link
      shareLink.isActive = false;
      await this.storeShareLink(shareLink);

      // Log revocation
      await auditLogger.logAction(
        userId,
        'share_revoked' as any,
        shareLink.fileId,
        'system',
        'system',
        true,
        undefined,
        { shareId }
      );

    } catch (error) {
      console.error('Failed to revoke share link:', error);
      throw error;
    }
  }

  /**
   * Get user's share links
   */
  public async getUserShareLinks(userId: string): Promise<FileShareLink[]> {
    try {
      const bucket = storage.bucket(SHARE_LINKS_BUCKET);
      const [files] = await bucket.getFiles({
        prefix: `share-links/${userId}/`
      });

      const shareLinks: FileShareLink[] = [];

      for (const file of files) {
        try {
          const [content] = await file.download();
          const shareLink: FileShareLink = JSON.parse(content.toString());
          shareLinks.push(shareLink);
        } catch (error) {
          console.error(`Failed to parse share link ${file.name}:`, error);
        }
      }

      return shareLinks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    } catch (error) {
      console.error('Failed to get user share links:', error);
      return [];
    }
  }

  private async checkFileAccess(
    metadata: FileMetadata,
    userId: string,
    accessType: string
  ): Promise<boolean> {
    // Owner always has access
    if (metadata.userId === userId) {
      return true;
    }

    // Check sharing settings
    if (!metadata.sharingSettings) {
      return false;
    }

    // Check if file is public
    if (metadata.sharingSettings.isPublic) {
      return true;
    }

    // Check allowed users
    if (metadata.sharingSettings.allowedUsers.includes(userId)) {
      return true;
    }

    // Additional role-based checks would go here
    return false;
  }

  private async trackFileAccess(fileId: string, userId: string, accessType: string): Promise<void> {
    try {
      const metadata = await storageService.getFileMetadata(fileId);
      if (!metadata) return;

      metadata.accessCount += 1;
      metadata.lastAccessedAt = new Date();

      if (accessType === 'download') {
        metadata.downloadCount += 1;
      }

      await this.updateFileMetadata(metadata);
    } catch (error) {
      console.error('Failed to track file access:', error);
    }
  }

  private generateAccessToken(fileId: string, userId: string, accessType: string): string {
    const payload = {
      fileId,
      userId,
      accessType,
      timestamp: Date.now()
    };
    return Buffer.from(JSON.stringify(payload)).toString('base64');
  }

  private async storeShareLink(shareLink: FileShareLink): Promise<void> {
    try {
      const bucket = storage.bucket(SHARE_LINKS_BUCKET);
      const filePath = `share-links/${shareLink.createdBy}/${shareLink.shareId}.json`;
      const file = bucket.file(filePath);

      await file.save(JSON.stringify(shareLink, null, 2), {
        metadata: {
          contentType: 'application/json',
          cacheControl: 'no-cache'
        }
      });
    } catch (error) {
      console.error('Failed to store share link:', error);
      throw error;
    }
  }

  private async getShareLink(shareId: string): Promise<FileShareLink | null> {
    try {
      const bucket = storage.bucket(SHARE_LINKS_BUCKET);
      const [files] = await bucket.getFiles({
        prefix: `share-links/`,
        matchGlob: `**/${shareId}.json`
      });

      if (files.length === 0) {
        return null;
      }

      const [content] = await files[0].download();
      return JSON.parse(content.toString());
    } catch (error) {
      console.error('Failed to get share link:', error);
      return null;
    }
  }

  private async updateShareLinkAccess(shareId: string): Promise<void> {
    try {
      const shareLink = await this.getShareLink(shareId);
      if (!shareLink) return;

      shareLink.accessCount += 1;
      await this.storeShareLink(shareLink);
    } catch (error) {
      console.error('Failed to update share link access:', error);
    }
  }

  private async updateFileMetadata(metadata: FileMetadata): Promise<void> {
    try {
      const bucket = storage.bucket(SHARE_LINKS_BUCKET);
      const metadataFile = bucket.file(`file-metadata/${metadata.fileId}.json`);

      await metadataFile.save(JSON.stringify(metadata, null, 2), {
        metadata: {
          contentType: 'application/json',
          cacheControl: 'no-cache'
        }
      });
    } catch (error) {
      console.error('Failed to update file metadata:', error);
      throw error;
    }
  }
}

export const fileAccessService = FileAccessService.getInstance();