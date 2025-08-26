import mimeTypes from 'mime-types';
import { ValidationResult } from './types.js';

const ALLOWED_EXTENSIONS = [
  '.txt', '.csv', '.json',
  '.mp3', '.wav', '.ogg', '.m4a',
  '.jpg', '.jpeg', '.png', '.webp', '.gif',
  '.mp4', '.webm', '.mov', '.avi'
];

const MAX_FILENAME_LENGTH = 255;
const DANGEROUS_PATTERNS = [
  /\.\./,  // Directory traversal
  /[<>:"|?*]/,  // Windows reserved characters
  /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i,  // Windows reserved names
  /^\./,  // Hidden files
  /\.$/, // Files ending with dot
];

export function validateFileName(fileName: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic validation
  if (!fileName || fileName.trim().length === 0) {
    errors.push('File name cannot be empty');
    return {
      isValid: false,
      errors,
      warnings,
      sanitizedFileName: '',
      detectedContentType: ''
    };
  }

  if (fileName.length > MAX_FILENAME_LENGTH) {
    errors.push(`File name too long (max ${MAX_FILENAME_LENGTH} characters)`);
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(fileName)) {
      errors.push('File name contains invalid characters or patterns');
      break;
    }
  }

  // Extract and validate extension
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    errors.push(`File extension ${extension} not allowed`);
  }

  // Sanitize filename
  let sanitizedFileName = fileName
    .replace(/[^\w\s.-]/g, '') // Remove special characters except word chars, spaces, dots, hyphens
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores

  // Ensure we still have a valid filename after sanitization
  if (sanitizedFileName.length === 0) {
    errors.push('File name becomes empty after sanitization');
    sanitizedFileName = `file_${Date.now()}${extension}`;
    warnings.push('File name was auto-generated due to invalid characters');
  }

  // Detect content type
  const detectedContentType = mimeTypes.lookup(sanitizedFileName) || 'application/octet-stream';

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedFileName,
    detectedContentType
  };
}

export function validateContentType(declaredType: string, detectedType: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // List of allowed MIME types
  const allowedTypes = [
    'text/plain',
    'text/csv',
    'application/json',
    'audio/mpeg',
    'audio/wav',
    'audio/ogg',
    'audio/mp4',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ];

  if (!allowedTypes.includes(declaredType)) {
    errors.push(`Content type ${declaredType} not allowed`);
  }

  if (!allowedTypes.includes(detectedType)) {
    errors.push(`Detected content type ${detectedType} not allowed`);
  }

  // Check for mismatch between declared and detected types
  if (declaredType !== detectedType) {
    // Allow some common mismatches
    const acceptableMismatches = [
      { declared: 'audio/mpeg', detected: 'audio/mp3' },
      { declared: 'image/jpeg', detected: 'image/jpg' },
      { declared: 'video/quicktime', detected: 'video/mov' }
    ];

    const isAcceptableMismatch = acceptableMismatches.some(
      mismatch => mismatch.declared === declaredType && mismatch.detected === detectedType
    );

    if (!isAcceptableMismatch) {
      warnings.push(`Content type mismatch: declared ${declaredType}, detected ${detectedType}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedFileName: '',
    detectedContentType: detectedType
  };
}

export function validateFileSize(size: number, maxSize: number): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (size <= 0) {
    errors.push('File size must be greater than 0');
  }

  if (size > maxSize) {
    errors.push(`File size ${size} exceeds maximum allowed size ${maxSize}`);
  }

  // Warn for very large files
  if (size > maxSize * 0.8) {
    warnings.push('File size is close to the maximum limit');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    sanitizedFileName: '',
    detectedContentType: ''
  };
}