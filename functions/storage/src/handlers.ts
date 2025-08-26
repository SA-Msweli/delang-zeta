import { Request, Response } from 'express';
import cors from 'cors';
import { authenticateUser, checkUploadPermission, checkDownloadPermission, AuthenticationError, AuthorizationError } from './auth.js';
import { validateFileName, validateContentType, validateFileSize } from './validation.js';
import { storageService } from './storage.js';
import { auditLogger } from './audit.js';
import { SecureUploadRequest, SecureDownloadRequest } from './types.js';

const corsHandler = cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://delang-zeta.web.app', 'https://delang-zeta.firebaseapp.com']
    : true,
  credentials: true
});

function getClientInfo(req: Request) {
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';
  return { ipAddress, userAgent };
}

export async function uploadHandler(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve) => corsHandler(req, res, resolve));

  const { ipAddress, userAgent } = getClientInfo(req);
  let userId = 'unknown';
  let fileId = 'unknown';

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Authenticate user
    const user = await authenticateUser(req.get('Authorization'));
    userId = user.userId;

    // Validate request body
    const uploadRequest: SecureUploadRequest = req.body;
    if (!uploadRequest.taskId || !uploadRequest.fileName || !uploadRequest.contentType || !uploadRequest.fileSize) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Validate file name
    const fileNameValidation = validateFileName(uploadRequest.fileName);
    if (!fileNameValidation.isValid) {
      await auditLogger.logUploadAttempt(
        userId,
        fileId,
        uploadRequest.fileName,
        uploadRequest.fileSize,
        uploadRequest.contentType,
        ipAddress,
        userAgent,
        false,
        `File name validation failed: ${fileNameValidation.errors.join(', ')}`
      );
      res.status(400).json({
        error: 'Invalid file name',
        details: fileNameValidation.errors,
        warnings: fileNameValidation.warnings
      });
      return;
    }

    // Validate content type
    const contentTypeValidation = validateContentType(
      uploadRequest.contentType,
      fileNameValidation.detectedContentType
    );
    if (!contentTypeValidation.isValid) {
      await auditLogger.logUploadAttempt(
        userId,
        fileId,
        uploadRequest.fileName,
        uploadRequest.fileSize,
        uploadRequest.contentType,
        ipAddress,
        userAgent,
        false,
        `Content type validation failed: ${contentTypeValidation.errors.join(', ')}`
      );
      res.status(400).json({
        error: 'Invalid content type',
        details: contentTypeValidation.errors,
        warnings: contentTypeValidation.warnings
      });
      return;
    }

    // Validate file size
    const fileSizeValidation = validateFileSize(uploadRequest.fileSize, user.permissions.maxFileSize);
    if (!fileSizeValidation.isValid) {
      await auditLogger.logUploadAttempt(
        userId,
        fileId,
        uploadRequest.fileName,
        uploadRequest.fileSize,
        uploadRequest.contentType,
        ipAddress,
        userAgent,
        false,
        `File size validation failed: ${fileSizeValidation.errors.join(', ')}`
      );
      res.status(400).json({
        error: 'Invalid file size',
        details: fileSizeValidation.errors
      });
      return;
    }

    // Check user permissions
    checkUploadPermission(user, uploadRequest.fileSize, uploadRequest.contentType);

    // Generate signed upload URL
    const uploadResponse = await storageService.generateSignedUploadUrl(
      user.userId,
      uploadRequest.taskId,
      fileNameValidation.sanitizedFileName,
      uploadRequest.contentType,
      uploadRequest.fileSize,
      user.permissions.maxFileSize,
      user.permissions.allowedContentTypes
    );

    fileId = uploadResponse.fileId;

    // Log successful upload URL generation
    await auditLogger.logUploadAttempt(
      userId,
      fileId,
      fileNameValidation.sanitizedFileName,
      uploadRequest.fileSize,
      uploadRequest.contentType,
      ipAddress,
      userAgent,
      true
    );

    res.status(200).json({
      success: true,
      data: uploadResponse,
      warnings: fileNameValidation.warnings.concat(contentTypeValidation.warnings)
    });

  } catch (error) {
    console.error('Upload handler error:', error);

    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error instanceof AuthenticationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else if (error instanceof AuthorizationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    }

    // Log failed attempt
    await auditLogger.logUploadAttempt(
      userId,
      fileId,
      'unknown',
      0,
      'unknown',
      ipAddress,
      userAgent,
      false,
      errorMessage
    );

    res.status(statusCode).json({ error: errorMessage });
  }
}

export async function downloadHandler(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve) => corsHandler(req, res, resolve));

  const { ipAddress, userAgent } = getClientInfo(req);
  let userId = 'unknown';
  let fileId = 'unknown';

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Authenticate user
    const user = await authenticateUser(req.get('Authorization'));
    userId = user.userId;

    // Validate request body
    const downloadRequest: SecureDownloadRequest = req.body;
    if (!downloadRequest.fileId || !downloadRequest.accessReason) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    fileId = downloadRequest.fileId;

    // Get file metadata to check ownership
    const metadata = await storageService.getFileMetadata(downloadRequest.fileId);
    if (!metadata) {
      await auditLogger.logAccessDenied(
        userId,
        fileId,
        'File not found',
        ipAddress,
        userAgent
      );
      res.status(404).json({ error: 'File not found' });
      return;
    }

    // Check download permissions
    checkDownloadPermission(user, metadata.userId);

    // Generate signed download URL
    const downloadResponse = await storageService.generateSignedDownloadUrl(
      user.userId,
      downloadRequest.fileId,
      downloadRequest.accessReason
    );

    // Log successful download
    await auditLogger.logDownloadAttempt(
      userId,
      fileId,
      downloadRequest.accessReason,
      ipAddress,
      userAgent,
      true
    );

    res.status(200).json({
      success: true,
      data: downloadResponse
    });

  } catch (error) {
    console.error('Download handler error:', error);

    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error instanceof AuthenticationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else if (error instanceof AuthorizationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;

      // Log access denied
      await auditLogger.logAccessDenied(
        userId,
        fileId,
        errorMessage,
        ipAddress,
        userAgent
      );
    }

    // Log failed attempt
    await auditLogger.logDownloadAttempt(
      userId,
      fileId,
      'unknown',
      ipAddress,
      userAgent,
      false,
      errorMessage
    );

    res.status(statusCode).json({ error: errorMessage });
  }
}

export async function metadataHandler(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve) => corsHandler(req, res, resolve));

  const { ipAddress, userAgent } = getClientInfo(req);
  let userId = 'unknown';

  try {
    // Authenticate user
    const user = await authenticateUser(req.get('Authorization'));
    userId = user.userId;

    if (req.method === 'GET') {
      // Get user's files
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const files = await storageService.getUserFiles(user.userId, limit, offset);

      res.status(200).json({
        success: true,
        data: {
          files,
          total: files.length,
          limit,
          offset
        }
      });

    } else if (req.method === 'DELETE') {
      // Delete a file
      const fileId = req.query.fileId as string;
      if (!fileId) {
        res.status(400).json({ error: 'Missing fileId parameter' });
        return;
      }

      await storageService.deleteFile(fileId, user.userId);

      // Log file deletion
      await auditLogger.logAction(
        userId,
        'delete',
        fileId,
        ipAddress,
        userAgent,
        true
      );

      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Metadata handler error:', error);

    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error instanceof AuthenticationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else if (error instanceof AuthorizationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    }

    res.status(statusCode).json({ error: errorMessage });
  }
}