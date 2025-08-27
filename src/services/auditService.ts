import { apiClient } from '../config/api'

export interface AuditEvent {
  id: string
  userId: string
  action: AuditAction
  resource: string
  resourceId: string
  metadata: Record<string, any>
  ipAddress: string
  userAgent: string
  timestamp: Date
  success: boolean
  errorMessage?: string
}

export type AuditAction =
  | 'dataset_view'
  | 'dataset_preview'
  | 'dataset_purchase'
  | 'dataset_download'
  | 'license_create'
  | 'license_renew'
  | 'license_revoke'
  | 'api_key_create'
  | 'api_key_revoke'
  | 'api_access'
  | 'file_access'
  | 'share_link_create'
  | 'share_link_access'

export interface AuditFilters {
  userId?: string
  action?: AuditAction
  resource?: string
  startDate?: Date
  endDate?: Date
  success?: boolean
  page?: number
  limit?: number
}

export interface AuditResponse {
  events: AuditEvent[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export class AuditService {
  // private static readonly AUDIT_ENDPOINT = '/audit-logs'
  private static readonly USER_AUDIT_ENDPOINT = '/audit-logs/user'
  private static readonly ADMIN_AUDIT_ENDPOINT = '/audit-logs/admin'

  /**
   * Log an audit event
   */
  static async logEvent(
    action: AuditAction,
    resource: string,
    resourceId: string,
    metadata: Record<string, any> = {},
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      await apiClient.post('/audit-log', {
        action,
        resource,
        resourceId,
        metadata,
        success,
        errorMessage,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      // Don't throw errors for audit logging failures
      console.warn('Failed to log audit event:', error)
    }
  }

  /**
   * Get user's audit events
   */
  static async getUserAuditEvents(filters: AuditFilters = {}): Promise<AuditResponse> {
    try {
      const response = await apiClient.get(this.USER_AUDIT_ENDPOINT, {
        params: {
          action: filters.action,
          resource: filters.resource,
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString(),
          success: filters.success,
          page: filters.page || 1,
          limit: filters.limit || 50
        }
      })

      return {
        ...response.data,
        events: response.data.events.map(this.transformAuditEvent)
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get audit events')
    }
  }

  /**
   * Get all audit events (admin only)
   */
  static async getAllAuditEvents(filters: AuditFilters = {}): Promise<AuditResponse> {
    try {
      const response = await apiClient.get(this.ADMIN_AUDIT_ENDPOINT, {
        params: {
          userId: filters.userId,
          action: filters.action,
          resource: filters.resource,
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString(),
          success: filters.success,
          page: filters.page || 1,
          limit: filters.limit || 50
        }
      })

      return {
        ...response.data,
        events: response.data.events.map(this.transformAuditEvent)
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get audit events')
    }
  }

  /**
   * Get audit statistics
   */
  static async getAuditStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalEvents: number
    successRate: number
    topActions: Array<{ action: AuditAction; count: number }>
    topResources: Array<{ resource: string; count: number }>
    eventsByDay: Array<{ date: string; count: number }>
  }> {
    try {
      const response = await apiClient.get('/audit-stats', {
        params: {
          startDate: startDate?.toISOString(),
          endDate: endDate?.toISOString()
        }
      })

      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get audit statistics')
    }
  }

  /**
   * Export audit events
   */
  static async exportAuditEvents(
    filters: AuditFilters = {},
    format: 'csv' | 'json' = 'csv'
  ): Promise<Blob> {
    try {
      const response = await apiClient.get('/audit-export', {
        params: {
          ...filters,
          format,
          startDate: filters.startDate?.toISOString(),
          endDate: filters.endDate?.toISOString()
        },
        responseType: 'blob'
      })

      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to export audit events')
    }
  }

  /**
   * Transform audit event from API response
   */
  private static transformAuditEvent(data: any): AuditEvent {
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    }
  }

  /**
   * Get action display name
   */
  static getActionDisplayName(action: AuditAction): string {
    const actionNames: Record<AuditAction, string> = {
      dataset_view: 'Dataset Viewed',
      dataset_preview: 'Dataset Previewed',
      dataset_purchase: 'Dataset Purchased',
      dataset_download: 'Dataset Downloaded',
      license_create: 'License Created',
      license_renew: 'License Renewed',
      license_revoke: 'License Revoked',
      api_key_create: 'API Key Created',
      api_key_revoke: 'API Key Revoked',
      api_access: 'API Access',
      file_access: 'File Accessed',
      share_link_create: 'Share Link Created',
      share_link_access: 'Share Link Accessed'
    }

    return actionNames[action] || action
  }

  /**
   * Get action color for UI
   */
  static getActionColor(action: AuditAction): string {
    const colors: Record<string, string> = {
      dataset_view: 'text-blue-600',
      dataset_preview: 'text-blue-600',
      dataset_purchase: 'text-green-600',
      dataset_download: 'text-purple-600',
      license_create: 'text-green-600',
      license_renew: 'text-yellow-600',
      license_revoke: 'text-red-600',
      api_key_create: 'text-green-600',
      api_key_revoke: 'text-red-600',
      api_access: 'text-indigo-600',
      file_access: 'text-gray-600',
      share_link_create: 'text-cyan-600',
      share_link_access: 'text-cyan-600'
    }

    return colors[action] || 'text-gray-600'
  }

  /**
   * Format metadata for display
   */
  static formatMetadata(metadata: Record<string, any>): string {
    const important = ['fileSize', 'fileName', 'licenseType', 'amount', 'token', 'network']
    const formatted = important
      .filter(key => metadata[key] !== undefined)
      .map(key => `${key}: ${metadata[key]}`)
      .join(', ')

    return formatted || 'No additional details'
  }

  /**
   * Check if user has admin access to audit logs
   */
  static async hasAdminAccess(): Promise<boolean> {
    try {
      await apiClient.get('/audit-admin-check')
      return true
    } catch (error) {
      return false
    }
  }
}

// Convenience functions for common audit events
export const auditLog = {
  datasetView: (datasetId: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent('dataset_view', 'dataset', datasetId, metadata),

  datasetPreview: (datasetId: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent('dataset_preview', 'dataset', datasetId, metadata),

  datasetPurchase: (datasetId: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent('dataset_purchase', 'dataset', datasetId, metadata),

  datasetDownload: (datasetId: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent('dataset_download', 'dataset', datasetId, metadata),

  licenseCreate: (licenseId: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent('license_create', 'license', licenseId, metadata),

  licenseRenew: (licenseId: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent('license_renew', 'license', licenseId, metadata),

  apiKeyCreate: (keyId: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent('api_key_create', 'api_key', keyId, metadata),

  apiAccess: (keyId: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent('api_access', 'api_key', keyId, metadata),

  fileAccess: (fileId: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent('file_access', 'file', fileId, metadata),

  error: (action: AuditAction, resource: string, resourceId: string, error: string, metadata: Record<string, any> = {}) =>
    AuditService.logEvent(action, resource, resourceId, metadata, false, error)
}

// Export static methods as instance-like object
export const auditService = {
  logEvent: (action: AuditAction, resource: string, resourceId: string, metadata?: Record<string, any>, success?: boolean, error?: string) =>
    AuditService.logEvent(action, resource, resourceId, metadata, success, error),
  logActivity: (activity: { action: string, details: any, timestamp: Date, userAgent: string, ipAddress: string }) =>
    AuditService.logEvent(activity.action as AuditAction, 'activity', 'user', activity.details, true),
  getUserAuditEvents: (filters?: AuditFilters) =>
    AuditService.getUserAuditEvents(filters),
  getAuditStatistics: (startDate?: Date, endDate?: Date) =>
    AuditService.getAuditStatistics(startDate, endDate),
  exportAuditEvents: (filters?: AuditFilters, format?: 'csv' | 'json') =>
    AuditService.exportAuditEvents(filters, format),
  getActionDisplayName: (action: AuditAction) => AuditService.getActionDisplayName(action),
  getActionColor: (action: AuditAction) => AuditService.getActionColor(action),
  formatMetadata: (metadata: Record<string, any>) => AuditService.formatMetadata(metadata),
  hasAdminAccess: () => AuditService.hasAdminAccess()
}