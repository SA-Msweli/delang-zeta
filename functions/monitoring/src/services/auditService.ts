import { Firestore } from '@google-cloud/firestore';
import { Logging } from '@google-cloud/logging';
import { AuditLogEntry } from '../types';

export class AuditService {
  private firestore: Firestore;
  private logging: Logging;
  private logName = 'delang-zeta-audit';

  constructor() {
    this.firestore = new Firestore();
    this.logging = new Logging();
  }

  /**
   * Log an audit event
   */
  async logEvent(event: Omit<AuditLogEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditEntry: AuditLogEntry = {
        ...event,
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };

      // Store in Firestore for querying
      await this.firestore.collection('audit_logs').doc(auditEntry.id).set(auditEntry);

      // Also log to Cloud Logging for centralized logging
      const log = this.logging.log(this.logName);
      const metadata = {
        resource: { type: 'global' },
        severity: auditEntry.success ? 'INFO' : 'ERROR',
        labels: {
          userId: auditEntry.userId || 'anonymous',
          action: auditEntry.action,
          resource: auditEntry.resource
        }
      };

      const entry = log.entry(metadata, {
        ...auditEntry,
        message: `${auditEntry.action} on ${auditEntry.resource}${auditEntry.resourceId ? ` (${auditEntry.resourceId})` : ''}`
      });

      await log.write(entry);

      console.log(`Audit log recorded: ${auditEntry.action} on ${auditEntry.resource}`);
    } catch (error) {
      console.error('Failed to log audit event:', error);
      // Don't throw error to avoid breaking the main operation
    }
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(
    userId: string,
    action: 'login' | 'logout' | 'token_refresh' | 'login_failed',
    success: boolean,
    details: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action,
      resource: 'authentication',
      details,
      ipAddress,
      userAgent,
      success,
      errorMessage: success ? undefined : details.error
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    userId: string,
    action: 'read' | 'write' | 'delete',
    resource: string,
    resourceId: string,
    success: boolean,
    details: Record<string, any> = {},
    ipAddress?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: `data_${action}`,
      resource,
      resourceId,
      details,
      ipAddress,
      success
    });
  }

  /**
   * Log API access event
   */
  async logApiAccess(
    userId: string | undefined,
    method: string,
    endpoint: string,
    statusCode: number,
    responseTime: number,
    details: Record<string, any> = {},
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: `api_${method.toLowerCase()}`,
      resource: endpoint,
      details: {
        ...details,
        statusCode,
        responseTime,
        method
      },
      ipAddress,
      userAgent,
      success: statusCode < 400
    });
  }  /**
   *
 Log file operation event
   */
  async logFileOperation(
    userId: string,
    action: 'upload' | 'download' | 'delete',
    fileId: string,
    fileName: string,
    success: boolean,
    details: Record<string, any> = {},
    ipAddress?: string
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: `file_${action}`,
      resource: 'file',
      resourceId: fileId,
      details: {
        ...details,
        fileName
      },
      ipAddress,
      success
    });
  }

  /**
   * Log blockchain transaction event
   */
  async logBlockchainTransaction(
    userId: string,
    action: string,
    transactionHash: string,
    success: boolean,
    details: Record<string, any> = {}
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: `blockchain_${action}`,
      resource: 'transaction',
      resourceId: transactionHash,
      details,
      success
    });
  }

  /**
   * Log admin action
   */
  async logAdminAction(
    adminUserId: string,
    action: string,
    targetResource: string,
    targetResourceId: string,
    success: boolean,
    details: Record<string, any> = {},
    ipAddress?: string
  ): Promise<void> {
    await this.logEvent({
      userId: adminUserId,
      action: `admin_${action}`,
      resource: targetResource,
      resourceId: targetResourceId,
      details: {
        ...details,
        adminAction: true
      },
      ipAddress,
      success
    });
  }

  /**
   * Get audit logs with filtering
   */
  async getAuditLogs(
    filters: {
      userId?: string;
      action?: string;
      resource?: string;
      startTime?: Date;
      endTime?: Date;
      success?: boolean;
    } = {},
    limit = 100,
    offset = 0
  ): Promise<AuditLogEntry[]> {
    try {
      let query = this.firestore.collection('audit_logs');

      // Apply filters
      if (filters.userId) {
        query = query.where('userId', '==', filters.userId);
      }
      if (filters.action) {
        query = query.where('action', '==', filters.action);
      }
      if (filters.resource) {
        query = query.where('resource', '==', filters.resource);
      }
      if (filters.success !== undefined) {
        query = query.where('success', '==', filters.success);
      }
      if (filters.startTime) {
        query = query.where('timestamp', '>=', filters.startTime);
      }
      if (filters.endTime) {
        query = query.where('timestamp', '<=', filters.endTime);
      }

      // Order and limit
      query = query.orderBy('timestamp', 'desc').limit(limit).offset(offset);

      const snapshot = await query.get();
      const logs: AuditLogEntry[] = [];

      snapshot.forEach(doc => {
        const data = doc.data();
        logs.push({
          ...data,
          timestamp: data.timestamp.toDate()
        } as AuditLogEntry);
      });

      return logs;
    } catch (error) {
      console.error('Failed to get audit logs:', error);
      return [];
    }
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(
    startTime: Date,
    endTime: Date
  ): Promise<{
    totalEvents: number;
    successfulEvents: number;
    failedEvents: number;
    eventsByAction: Record<string, number>;
    eventsByResource: Record<string, number>;
    eventsByUser: Record<string, number>;
  }> {
    try {
      const snapshot = await this.firestore
        .collection('audit_logs')
        .where('timestamp', '>=', startTime)
        .where('timestamp', '<=', endTime)
        .get();

      const stats = {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        eventsByAction: {} as Record<string, number>,
        eventsByResource: {} as Record<string, number>,
        eventsByUser: {} as Record<string, number>
      };

      snapshot.forEach(doc => {
        const data = doc.data();
        stats.totalEvents++;

        if (data.success) {
          stats.successfulEvents++;
        } else {
          stats.failedEvents++;
        }

        // Count by action
        stats.eventsByAction[data.action] = (stats.eventsByAction[data.action] || 0) + 1;

        // Count by resource
        stats.eventsByResource[data.resource] = (stats.eventsByResource[data.resource] || 0) + 1;

        // Count by user
        const userId = data.userId || 'anonymous';
        stats.eventsByUser[userId] = (stats.eventsByUser[userId] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Failed to get audit statistics:', error);
      return {
        totalEvents: 0,
        successfulEvents: 0,
        failedEvents: 0,
        eventsByAction: {},
        eventsByResource: {},
        eventsByUser: {}
      };
    }
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs(retentionDays: number = 365): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

      const snapshot = await this.firestore
        .collection('audit_logs')
        .where('timestamp', '<', cutoffDate)
        .limit(500) // Process in batches
        .get();

      if (!snapshot.empty) {
        const batch = this.firestore.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Cleaned up ${snapshot.size} old audit log records`);
      }
    } catch (error) {
      console.error('Failed to cleanup old audit logs:', error);
      throw error;
    }
  }

  /**
   * Export audit logs for compliance
   */
  async exportAuditLogs(
    startTime: Date,
    endTime: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const logs = await this.getAuditLogs({
        startTime,
        endTime
      }, 10000); // Large limit for export

      if (format === 'csv') {
        return this.convertToCSV(logs);
      } else {
        return JSON.stringify(logs, null, 2);
      }
    } catch (error) {
      console.error('Failed to export audit logs:', error);
      throw error;
    }
  }

  /**
   * Convert audit logs to CSV format
   */
  private convertToCSV(logs: AuditLogEntry[]): string {
    if (logs.length === 0) {
      return 'No data available';
    }

    const headers = [
      'id',
      'timestamp',
      'userId',
      'action',
      'resource',
      'resourceId',
      'success',
      'ipAddress',
      'userAgent',
      'errorMessage'
    ];

    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.id,
        log.timestamp.toISOString(),
        log.userId || '',
        log.action,
        log.resource,
        log.resourceId || '',
        log.success.toString(),
        log.ipAddress || '',
        log.userAgent || '',
        log.errorMessage || ''
      ];

      // Escape commas and quotes in values
      const escapedRow = row.map(value => {
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      });

      csvRows.push(escapedRow.join(','));
    });

    return csvRows.join('\n');
  }
}

export const auditService = new AuditService();