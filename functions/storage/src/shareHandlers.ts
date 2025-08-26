import { Request, Response } from 'express';
import cors from 'cors';
import { authenticateUser, AuthenticationError, AuthorizationError } from './auth.js';
import { fileAccessService } from './fileAccess.js';
import { auditLogger } from './audit.js';
import { FileAccessRequest, FileSharingSettings } from './types.js';

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

/**
 * Enhanced file access handler with advanced permissions
 */
export async function enhancedAccessHandler(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve) => corsHandler(req, res, resolve));

  const { ipAddress, userAgent } = getClientInfo(req);
  let userId = 'unknown';

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Authenticate user
    const user = await authenticateUser(req.get('Authorization'));
    userId = user.userId;

    // Validate request body
    const accessRequest: FileAccessRequest = req.body;
    if (!accessRequest.fileId || !accessRequest.accessReason || !accessRequest.accessType) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Generate secure access URL
    const accessResponse = await fileAccessService.generateSecureAccessUrl(
      accessRequest,
      user.userId,
      user.permissions
    );

    // Log successful access
    await auditLogger.logAction(
      userId,
      'enhanced_access' as any,
      accessRequest.fileId,
      ipAddress,
      userAgent,
      true,
      undefined,
      {
        accessType: accessRequest.accessType,
        accessReason: accessRequest.accessReason,
        expirationHours: accessRequest.expirationHours
      }
    );

    res.status(200).json({
      success: true,
      data: accessResponse
    });

  } catch (error) {
    console.error('Enhanced access handler error:', error);

    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error instanceof AuthenticationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else if (error instanceof AuthorizationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else if (error instanceof Error) {
      if (error.message.includes('not found')) {
        statusCode = 404;
        errorMessage = 'File not found';
      } else if (error.message.includes('denied')) {
        statusCode = 403;
        errorMessage = 'Access denied';
      } else if (error.message.includes('expired')) {
        statusCode = 410;
        errorMessage = 'File or access has expired';
      } else if (error.message.includes('limit')) {
        statusCode = 429;
        errorMessage = 'Access limit exceeded';
      }
    }

    // Log failed attempt
    await auditLogger.logAction(
      userId,
      'enhanced_access' as any,
      req.body?.fileId || 'unknown',
      ipAddress,
      userAgent,
      false,
      errorMessage
    );

    res.status(statusCode).json({ error: errorMessage });
  }
}

/**
 * Create share link handler
 */
export async function createShareLinkHandler(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve) => corsHandler(req, res, resolve));

  const { ipAddress, userAgent } = getClientInfo(req);
  let userId = 'unknown';

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Authenticate user
    const user = await authenticateUser(req.get('Authorization'));
    userId = user.userId;

    const { fileId, options = {} } = req.body;
    if (!fileId) {
      res.status(400).json({ error: 'Missing fileId' });
      return;
    }

    // Create share link
    const shareLink = await fileAccessService.createShareLink(fileId, user.userId, options);

    res.status(200).json({
      success: true,
      data: shareLink
    });

  } catch (error) {
    console.error('Create share link handler error:', error);

    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error instanceof AuthenticationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else if (error instanceof Error) {
      if (error.message.includes('not found')) {
        statusCode = 404;
        errorMessage = 'File not found';
      } else if (error.message.includes('owner')) {
        statusCode = 403;
        errorMessage = 'Only file owner can create share links';
      }
    }

    res.status(statusCode).json({ error: errorMessage });
  }
}

/**
 * Access via share link handler (public endpoint)
 */
export async function shareAccessHandler(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve) => corsHandler(req, res, resolve));

  const { ipAddress, userAgent } = getClientInfo(req);

  try {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { shareId, accessorId, password } = req.body;
    if (!shareId) {
      res.status(400).json({ error: 'Missing shareId' });
      return;
    }

    // Access file via share link
    const accessResponse = await fileAccessService.accessViaShareLink(shareId, accessorId, password);

    res.status(200).json({
      success: true,
      data: accessResponse
    });

  } catch (error) {
    console.error('Share access handler error:', error);

    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        statusCode = 404;
        errorMessage = 'Share link not found';
      } else if (error.message.includes('expired')) {
        statusCode = 410;
        errorMessage = 'Share link has expired';
      } else if (error.message.includes('limit')) {
        statusCode = 429;
        errorMessage = 'Share link access limit exceeded';
      } else if (error.message.includes('Authentication required')) {
        statusCode = 401;
        errorMessage = 'Authentication required';
      }
    }

    res.status(statusCode).json({ error: errorMessage });
  }
}

/**
 * Manage sharing settings handler
 */
export async function manageSharingHandler(req: Request, res: Response): Promise<void> {
  await new Promise<void>((resolve) => corsHandler(req, res, resolve));

  const { ipAddress, userAgent } = getClientInfo(req);
  let userId = 'unknown';

  try {
    // Authenticate user
    const user = await authenticateUser(req.get('Authorization'));
    userId = user.userId;

    if (req.method === 'PUT') {
      // Update sharing settings
      const { fileId, settings } = req.body;
      if (!fileId || !settings) {
        res.status(400).json({ error: 'Missing fileId or settings' });
        return;
      }

      await fileAccessService.updateSharingSettings(fileId, user.userId, settings as FileSharingSettings);

      res.status(200).json({
        success: true,
        message: 'Sharing settings updated successfully'
      });

    } else if (req.method === 'GET') {
      // Get user's share links
      const shareLinks = await fileAccessService.getUserShareLinks(user.userId);

      res.status(200).json({
        success: true,
        data: shareLinks
      });

    } else if (req.method === 'DELETE') {
      // Revoke share link
      const { shareId } = req.query;
      if (!shareId) {
        res.status(400).json({ error: 'Missing shareId' });
        return;
      }

      await fileAccessService.revokeShareLink(shareId as string, user.userId);

      res.status(200).json({
        success: true,
        message: 'Share link revoked successfully'
      });

    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Manage sharing handler error:', error);

    let statusCode = 500;
    let errorMessage = 'Internal server error';

    if (error instanceof AuthenticationError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else if (error instanceof Error) {
      if (error.message.includes('not found')) {
        statusCode = 404;
        errorMessage = 'Resource not found';
      } else if (error.message.includes('owner') || error.message.includes('creator')) {
        statusCode = 403;
        errorMessage = 'Access denied';
      }
    }

    res.status(statusCode).json({ error: errorMessage });
  }
}