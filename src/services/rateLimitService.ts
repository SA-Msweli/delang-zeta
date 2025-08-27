import { apiClient } from '../config/api'

export interface RateLimit {
  id: string
  userId: string
  resource: string
  resourceId: string
  limit: number
  window: number // in seconds
  current: number
  resetAt: Date
  blocked: boolean
}

export interface RateLimitConfig {
  resource: string
  resourceId: string
  limit: number
  window: number // in seconds
}

export interface RateLimitStatus {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
  retryAfter?: number
}

export class RateLimitService {
  private static readonly RATE_LIMIT_ENDPOINT = '/rate-limit'
  private static readonly RATE_LIMIT_CHECK_ENDPOINT = '/rate-limit/check'
  private static readonly RATE_LIMIT_STATUS_ENDPOINT = '/rate-limit/status'

  /**
   * Check if request is allowed under rate limit
   */
  static async checkRateLimit(
    resource: string,
    resourceId: string,
    action: string = 'default'
  ): Promise<RateLimitStatus> {
    try {
      const response = await apiClient.post(this.RATE_LIMIT_CHECK_ENDPOINT, {
        resource,
        resourceId,
        action
      })

      return {
        ...response.data,
        resetAt: new Date(response.data.resetAt)
      }
    } catch (error: any) {
      if (error.response?.status === 429) {
        return {
          allowed: false,
          limit: error.response.data.limit,
          remaining: 0,
          resetAt: new Date(error.response.data.resetAt),
          retryAfter: error.response.data.retryAfter
        }
      }
      throw new Error(error.response?.data?.error || 'Failed to check rate limit')
    }
  }

  /**
   * Get current rate limit status for user
   */
  static async getRateLimitStatus(
    resource?: string,
    resourceId?: string
  ): Promise<RateLimit[]> {
    try {
      const response = await apiClient.get(this.RATE_LIMIT_STATUS_ENDPOINT, {
        params: { resource, resourceId }
      })

      return response.data.map((limit: any) => ({
        ...limit,
        resetAt: new Date(limit.resetAt)
      }))
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get rate limit status')
    }
  }

  /**
   * Configure rate limits for a resource
   */
  static async configureRateLimit(config: RateLimitConfig): Promise<void> {
    try {
      await apiClient.post(this.RATE_LIMIT_ENDPOINT, config)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to configure rate limit')
    }
  }

  /**
   * Reset rate limit for a resource
   */
  static async resetRateLimit(
    resource: string,
    resourceId: string
  ): Promise<void> {
    try {
      await apiClient.delete(`${this.RATE_LIMIT_ENDPOINT}/${resource}/${resourceId}`)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to reset rate limit')
    }
  }

  /**
   * Get rate limit configuration for different resources
   */
  static getDefaultLimits(): Record<string, RateLimitConfig[]> {
    return {
      api_access: [
        { resource: 'api_key', resourceId: '', limit: 1000, window: 3600 }, // 1000 per hour
        { resource: 'api_key', resourceId: '', limit: 100, window: 60 }     // 100 per minute
      ],
      dataset_download: [
        { resource: 'license', resourceId: '', limit: 10, window: 3600 },   // 10 per hour
        { resource: 'license', resourceId: '', limit: 3, window: 300 }      // 3 per 5 minutes
      ],
      dataset_preview: [
        { resource: 'dataset', resourceId: '', limit: 100, window: 3600 },  // 100 per hour
        { resource: 'dataset', resourceId: '', limit: 20, window: 60 }      // 20 per minute
      ],
      file_access: [
        { resource: 'file', resourceId: '', limit: 500, window: 3600 },     // 500 per hour
        { resource: 'file', resourceId: '', limit: 50, window: 60 }         // 50 per minute
      ]
    }
  }

  /**
   * Format time remaining until reset
   */
  static formatTimeUntilReset(resetAt: Date): string {
    const now = new Date()
    const diff = resetAt.getTime() - now.getTime()

    if (diff <= 0) return 'Now'

    const minutes = Math.floor(diff / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  /**
   * Get usage percentage
   */
  static getUsagePercentage(current: number, limit: number): number {
    return Math.min((current / limit) * 100, 100)
  }

  /**
   * Get status color based on usage
   */
  static getStatusColor(current: number, limit: number): string {
    const percentage = this.getUsagePercentage(current, limit)

    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 75) return 'text-orange-600'
    if (percentage >= 50) return 'text-yellow-600'
    return 'text-green-600'
  }

  /**
   * Get status background color
   */
  static getStatusBgColor(current: number, limit: number): string {
    const percentage = this.getUsagePercentage(current, limit)

    if (percentage >= 90) return 'bg-red-50 border-red-200'
    if (percentage >= 75) return 'bg-orange-50 border-orange-200'
    if (percentage >= 50) return 'bg-yellow-50 border-yellow-200'
    return 'bg-green-50 border-green-200'
  }

  /**
   * Check if rate limit is near threshold
   */
  static isNearLimit(current: number, limit: number, threshold: number = 0.8): boolean {
    return (current / limit) >= threshold
  }

  /**
   * Get recommended action based on rate limit status
   */
  static getRecommendedAction(rateLimit: RateLimit): string {
    const percentage = this.getUsagePercentage(rateLimit.current, rateLimit.limit)

    if (rateLimit.blocked) {
      return `Rate limit exceeded. Try again in ${this.formatTimeUntilReset(rateLimit.resetAt)}`
    }

    if (percentage >= 90) {
      return 'Approaching rate limit. Consider reducing request frequency.'
    }

    if (percentage >= 75) {
      return 'High usage detected. Monitor your request rate.'
    }

    return 'Usage is within normal limits.'
  }

  /**
   * Estimate time to complete requests given current rate limit
   */
  static estimateCompletionTime(
    requestsRemaining: number,
    currentUsage: number,
    limit: number,
    windowSeconds: number
  ): Date {
    const availableInCurrentWindow = limit - currentUsage

    if (requestsRemaining <= availableInCurrentWindow) {
      // Can complete within current window
      return new Date()
    }

    // Calculate how many additional windows needed
    const additionalRequests = requestsRemaining - availableInCurrentWindow
    const additionalWindows = Math.ceil(additionalRequests / limit)

    return new Date(Date.now() + (additionalWindows * windowSeconds * 1000))
  }
}

// Convenience functions for common rate limit checks
export const rateLimitCheck = {
  apiAccess: (apiKeyId: string) =>
    RateLimitService.checkRateLimit('api_key', apiKeyId, 'access'),

  datasetDownload: (licenseId: string) =>
    RateLimitService.checkRateLimit('license', licenseId, 'download'),

  datasetPreview: (datasetId: string) =>
    RateLimitService.checkRateLimit('dataset', datasetId, 'preview'),

  fileAccess: (fileId: string) =>
    RateLimitService.checkRateLimit('file', fileId, 'access'),

  shareLink: (linkId: string) =>
    RateLimitService.checkRateLimit('share_link', linkId, 'access')
}