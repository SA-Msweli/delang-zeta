export interface SecureUploadRequest {
  taskId: string;
  fileType: string;
  fileSize: number;
  contentType: string;
  fileName: string;
}

export interface SecureUploadResponse {
  uploadUrl: string;
  fileId: string;
  expiresAt: Date;
  maxFileSize: number;
  allowedContentTypes: string[];
}

export interface SecureDownloadRequest {
  fileId: string;
  accessReason: string;
}

export interface SecureDownloadResponse {
  downloadUrl: string;
  expiresAt: Date;
  accessGranted: boolean;
  fileName: string;
  fileSize: number;
}

export interface FileMetadata {
  fileId: string;
  userId: string;
  taskId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  uploadedAt: Date;
  storageUrl: string;
  verified: boolean;
  accessCount: number;
  lastAccessedAt?: Date;
  sharingSettings?: FileSharingSettings;
  expirationDate?: Date;
  downloadCount: number;
  maxDownloads?: number;
}

export interface FileSharingSettings {
  isPublic: boolean;
  allowedUsers: string[];
  allowedRoles: string[];
  shareExpiration?: Date;
  requiresApproval: boolean;
  downloadLimit?: number;
  accessPassword?: string;
}

export interface FileAccessRequest {
  fileId: string;
  accessReason: string;
  requestedBy: string;
  accessType: 'download' | 'view' | 'share';
  expirationHours?: number;
}

export interface FileAccessResponse {
  accessUrl: string;
  expiresAt: Date;
  accessGranted: boolean;
  accessToken: string;
  restrictions: {
    downloadLimit?: number;
    viewOnly: boolean;
    watermarked: boolean;
  };
}

export interface FileShareLink {
  shareId: string;
  fileId: string;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  accessCount: number;
  maxAccess?: number;
  isActive: boolean;
  shareUrl: string;
  permissions: {
    canDownload: boolean;
    canView: boolean;
    requiresAuth: boolean;
  };
}

export interface AuditLogEntry {
  timestamp: Date;
  userId: string;
  action: 'upload' | 'download' | 'delete' | 'access_denied';
  fileId: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface UserPermissions {
  canUpload: boolean;
  canDownload: boolean;
  canDelete: boolean;
  maxFileSize: number;
  allowedContentTypes: string[];
  dailyUploadLimit: number;
  dailyDownloadLimit: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedFileName: string;
  detectedContentType: string;
}