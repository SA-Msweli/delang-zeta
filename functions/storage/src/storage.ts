import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import { FileMetadata, SecureUploadResponse, SecureDownloadResponse } from './types.js';
import { auditLogger } from './audit.js';

const storage = new Storage();
const MAIN_BUCKET = 'delang-zeta-datasets';
const METADATA_BUCKET = 'delang-zeta-metadata';

export class StorageService {
  private static instance: StorageService;

  private constructor() { }

  public static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  public async generateSignedUploadUrl(
    userId: string,
    taskId: string,
    fileName: string,
    contentType: string,
    fileSize: number,
    maxFileSize: number,
    allowedContentTypes: string[]
  ): Promise<SecureUploadResponse> {
    const fileId = uuidv4();
    const sanitizedFileName = this.sanitizeFileName(fileName);
    const filePath = `submissions/pending/${userId}/${taskId}/${fileId}/${sanitizedFileName}`;

    try {
      const bucket = storage.bucket(MAIN_BUCKET);
      const file = bucket.file(filePath);

      // Generate signed URL for upload (valid for 1 hour)
      const [uploadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 60 * 60 * 1000, // 1 hour
        contentType,
        extensionHeaders: {
          'x-goog-content-length-range': `0,${maxFileSize}`
        }
      });

      // Store file metadata
      await this.storeFileMetadata({
        fileId,
        userId,
        taskId,
        fileName: sanitizedFileName,
        fileSize,
        contentType,
        uploadedAt: new Date(),
        storageUrl: filePath,
        verified: false,
        accessCount: 0,
        downloadCount: 0
      });

      return {
        uploadUrl,
        fileId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        maxFileSize,
        allowedContentTypes
      };
    } catch (error) {
      console.error('Failed to generate signed upload URL:', error);
      throw new Error('Failed to generate upload URL');
    }
  }

  public async generateSignedDownloadUrl(
    userId: string,
    fileId: string,
    accessReason: string
  ): Promise<SecureDownloadResponse> {
    try {
      // Get file metadata
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) {
        throw new Error('File not found');
      }

      // Check if user has access to this file
      if (metadata.userId !== userId) {
        throw new Error('Access denied');
      }

      const bucket = storage.bucket(MAIN_BUCKET);
      const file = bucket.file(metadata.storageUrl);

      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error('File not found in storage');
      }

      // Generate signed URL for download (valid for 1 hour)
      const [downloadUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 60 * 60 * 1000 // 1 hour
      });

      // Update access count and last accessed time
      await this.updateFileAccess(fileId);

      return {
        downloadUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        accessGranted: true,
        fileName: metadata.fileName,
        fileSize: metadata.fileSize
      };
    } catch (error) {
      console.error('Failed to generate signed download URL:', error);
      throw error;
    }
  }

  public async moveFileToVerified(fileId: string, taskId: string): Promise<string> {
    try {
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) {
        throw new Error('File metadata not found');
      }

      const sourceBucket = storage.bucket(MAIN_BUCKET);
      const sourceFile = sourceBucket.file(metadata.storageUrl);

      // Determine new path based on content type
      let category = 'other';
      if (metadata.contentType.startsWith('text/')) category = 'text';
      else if (metadata.contentType.startsWith('audio/')) category = 'audio';
      else if (metadata.contentType.startsWith('image/')) category = 'image';
      else if (metadata.contentType.startsWith('video/')) category = 'video';

      const newPath = `verified/${category}/${taskId}/${fileId}/${metadata.fileName}`;
      const destFile = sourceBucket.file(newPath);

      // Copy file to new location
      await sourceFile.copy(destFile);

      // Update metadata with new path
      metadata.storageUrl = newPath;
      metadata.verified = true;
      await this.storeFileMetadata(metadata);

      // Delete original file
      await sourceFile.delete();

      return newPath;
    } catch (error) {
      console.error('Failed to move file to verified:', error);
      throw error;
    }
  }

  public async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) {
        throw new Error('File not found');
      }

      // Check ownership
      if (metadata.userId !== userId) {
        throw new Error('Access denied');
      }

      const bucket = storage.bucket(MAIN_BUCKET);
      const file = bucket.file(metadata.storageUrl);

      // Delete file from storage
      await file.delete();

      // Delete metadata
      await this.deleteFileMetadata(fileId);
    } catch (error) {
      console.error('Failed to delete file:', error);
      throw error;
    }
  }

  private async storeFileMetadata(metadata: FileMetadata): Promise<void> {
    try {
      const bucket = storage.bucket(METADATA_BUCKET);
      const metadataFile = bucket.file(`file-metadata/${metadata.fileId}.json`);

      await metadataFile.save(JSON.stringify(metadata, null, 2), {
        metadata: {
          contentType: 'application/json',
          cacheControl: 'no-cache'
        }
      });
    } catch (error) {
      console.error('Failed to store file metadata:', error);
      throw error;
    }
  }

  public async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    try {
      const bucket = storage.bucket(METADATA_BUCKET);
      const metadataFile = bucket.file(`file-metadata/${fileId}.json`);

      const [exists] = await metadataFile.exists();
      if (!exists) {
        return null;
      }

      const [content] = await metadataFile.download();
      return JSON.parse(content.toString());
    } catch (error) {
      console.error('Failed to get file metadata:', error);
      return null;
    }
  }

  private async updateFileAccess(fileId: string): Promise<void> {
    try {
      const metadata = await this.getFileMetadata(fileId);
      if (!metadata) return;

      metadata.accessCount += 1;
      metadata.lastAccessedAt = new Date();

      await this.storeFileMetadata(metadata);
    } catch (error) {
      console.error('Failed to update file access:', error);
    }
  }

  private async deleteFileMetadata(fileId: string): Promise<void> {
    try {
      const bucket = storage.bucket(METADATA_BUCKET);
      const metadataFile = bucket.file(`file-metadata/${fileId}.json`);
      await metadataFile.delete();
    } catch (error) {
      console.error('Failed to delete file metadata:', error);
    }
  }

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  public async getUserFiles(userId: string, limit: number = 50, offset: number = 0): Promise<FileMetadata[]> {
    try {
      const bucket = storage.bucket(METADATA_BUCKET);
      const [files] = await bucket.getFiles({
        prefix: 'file-metadata/',
        maxResults: limit * 2 // Get more than needed to filter
      });

      const userFiles: FileMetadata[] = [];
      let processed = 0;
      let skipped = 0;

      for (const file of files) {
        if (userFiles.length >= limit) break;

        try {
          const [content] = await file.download();
          const metadata: FileMetadata = JSON.parse(content.toString());

          if (metadata.userId === userId) {
            if (skipped < offset) {
              skipped++;
              continue;
            }
            userFiles.push(metadata);
          }
        } catch (error) {
          console.error(`Failed to parse metadata for file ${file.name}:`, error);
        }

        processed++;
      }

      return userFiles.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    } catch (error) {
      console.error('Failed to get user files:', error);
      return [];
    }
  }
}

export const storageService = StorageService.getInstance();