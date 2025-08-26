import { Storage } from '@google-cloud/storage';
import { AuditLogEntry } from './types.js';

const storage = new Storage();
const AUDIT_BUCKET = 'delang-zeta-audit-logs';

export class AuditLogger {
  private static instance: AuditLogger;
  private logBuffer: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Flush logs every 30 seconds
    this.flushInterval = setInterval(() => {
      this.flushLogs();
    }, 30000);
  }

  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  public async logAction(
    userId: string,
    action: AuditLogEntry['action'],
    fileId: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    errorMessage?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    const logEntry: AuditLogEntry = {
      timestamp: new Date(),
      userId,
      action,
      fileId,
      ipAddress,
      userAgent,
      success,
      errorMessage,
      metadata
    };

    this.logBuffer.push(logEntry);

    // Flush immediately for critical actions or errors
    if (!success || action === 'delete') {
      await this.flushLogs();
    }

    // Flush if buffer is getting large
    if (this.logBuffer.length >= 100) {
      await this.flushLogs();
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      const bucket = storage.bucket(AUDIT_BUCKET);
      const fileName = `audit-logs/${new Date().toISOString().split('T')[0]}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;

      const file = bucket.file(fileName);
      const logData = {
        timestamp: new Date().toISOString(),
        entries: logsToFlush
      };

      await file.save(JSON.stringify(logData, null, 2), {
        metadata: {
          contentType: 'application/json',
          cacheControl: 'no-cache'
        }
      });

      console.log(`Flushed ${logsToFlush.length} audit log entries to ${fileName}`);
    } catch (error) {
      console.error('Failed to flush audit logs:', error);
      // Re-add logs to buffer for retry
      this.logBuffer.unshift(...logsToFlush);
    }
  }

  public async logUploadAttempt(
    userId: string,
    fileId: string,
    fileName: string,
    fileSize: number,
    contentType: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.logAction(
      userId,
      'upload',
      fileId,
      ipAddress,
      userAgent,
      success,
      errorMessage,
      {
        fileName,
        fileSize,
        contentType
      }
    );
  }

  public async logDownloadAttempt(
    userId: string,
    fileId: string,
    accessReason: string,
    ipAddress: string,
    userAgent: string,
    success: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.logAction(
      userId,
      'download',
      fileId,
      ipAddress,
      userAgent,
      success,
      errorMessage,
      {
        accessReason
      }
    );
  }

  public async logAccessDenied(
    userId: string,
    fileId: string,
    reason: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.logAction(
      userId,
      'access_denied',
      fileId,
      ipAddress,
      userAgent,
      false,
      reason
    );
  }

  public destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    // Flush any remaining logs
    this.flushLogs();
  }
}

export const auditLogger = AuditLogger.getInstance();