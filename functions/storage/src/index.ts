import { http } from '@google-cloud/functions-framework';
import { uploadHandler, downloadHandler, metadataHandler } from './handlers.js';
import { enhancedAccessHandler, createShareLinkHandler, shareAccessHandler, manageSharingHandler } from './shareHandlers.js';

// Register Cloud Functions
http('uploadHandler', uploadHandler);
http('downloadHandler', downloadHandler);
http('metadataHandler', metadataHandler);
http('enhancedAccessHandler', enhancedAccessHandler);
http('createShareLinkHandler', createShareLinkHandler);
http('shareAccessHandler', shareAccessHandler);
http('manageSharingHandler', manageSharingHandler);

// Export handlers for testing
export {
  uploadHandler,
  downloadHandler,
  metadataHandler,
  enhancedAccessHandler,
  createShareLinkHandler,
  shareAccessHandler,
  manageSharingHandler
};