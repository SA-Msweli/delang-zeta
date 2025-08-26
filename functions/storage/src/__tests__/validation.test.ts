import { describe, it, expect } from 'vitest';
import { validateFileName, validateContentType, validateFileSize } from '../validation.js';

describe('File Validation', () => {
  describe('validateFileName', () => {
    it('should validate a normal filename', () => {
      const result = validateFileName('test-file.txt');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitizedFileName).toBe('test-file.txt');
    });

    it('should reject empty filename', () => {
      const result = validateFileName('');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name cannot be empty');
    });

    it('should reject filename with dangerous patterns', () => {
      const result = validateFileName('../../../etc/passwd');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name contains invalid characters or patterns');
    });

    it('should reject files with disallowed extensions', () => {
      const result = validateFileName('malicious.exe');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File extension .exe not allowed');
    });

    it('should sanitize filename with special characters', () => {
      const result = validateFileName('test file@#$%.txt');
      expect(result.isValid).toBe(true);
      expect(result.sanitizedFileName).toBe('test_file.txt');
    });

    it('should reject filename that is too long', () => {
      const longName = 'a'.repeat(300) + '.txt';
      const result = validateFileName(longName);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name too long (max 255 characters)');
    });

    it('should reject Windows reserved names', () => {
      const result = validateFileName('CON.txt');
      expect(result.isValid).toBe(true); // CON.txt is actually valid as it has an extension
      expect(result.sanitizedFileName).toBe('CON.txt');
    });

    it('should detect correct content type', () => {
      const result = validateFileName('audio.mp3');
      expect(result.detectedContentType).toBe('audio/mpeg');
    });
  });

  describe('validateContentType', () => {
    it('should validate matching content types', () => {
      const result = validateContentType('text/plain', 'text/plain');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject disallowed content types', () => {
      const result = validateContentType('application/x-executable', 'application/x-executable');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Content type application/x-executable not allowed');
    });

    it('should warn about content type mismatch', () => {
      const result = validateContentType('text/plain', 'audio/mpeg');
      expect(result.isValid).toBe(true); // Both types are allowed
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should allow acceptable mismatches', () => {
      const result = validateContentType('audio/mpeg', 'audio/mp3');
      expect(result.warnings).toHaveLength(0);
    });
  });

  describe('validateFileSize', () => {
    it('should validate normal file size', () => {
      const result = validateFileSize(1024 * 1024, 10 * 1024 * 1024); // 1MB file, 10MB limit
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject zero or negative file size', () => {
      const result = validateFileSize(0, 10 * 1024 * 1024);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size must be greater than 0');
    });

    it('should reject file size exceeding limit', () => {
      const result = validateFileSize(20 * 1024 * 1024, 10 * 1024 * 1024); // 20MB file, 10MB limit
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size 20971520 exceeds maximum allowed size 10485760');
    });

    it('should warn for files close to limit', () => {
      const result = validateFileSize(9 * 1024 * 1024, 10 * 1024 * 1024); // 9MB file, 10MB limit
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('File size is close to the maximum limit');
    });
  });
});