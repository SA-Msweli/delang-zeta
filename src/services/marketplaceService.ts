import { apiClient } from '../config/api'
import { auditLog } from './auditService'
import { rateLimitCheck } from './rateLimitService'
import type {
  Dataset,
  DatasetFilters,
  DatasetSearchResponse,
  DatasetPurchaseRequest,
  DatasetPurchaseResponse,
  DatasetDownloadRequest,
  DatasetDownloadResponse,
  DatasetPreview,
  UserLicense,
  DatasetStats,
  DatasetReview
} from '../types/dataset'

export class MarketplaceService {
  private static readonly DATASETS_ENDPOINT = '/marketplace-datasets'
  private static readonly SEARCH_ENDPOINT = '/marketplace-search'
  private static readonly PREVIEW_ENDPOINT = '/marketplace-preview'
  private static readonly PURCHASE_ENDPOINT = '/marketplace-purchase'
  private static readonly DOWNLOAD_ENDPOINT = '/marketplace-download'
  private static readonly LICENSES_ENDPOINT = '/marketplace-licenses'
  private static readonly STATS_ENDPOINT = '/marketplace-stats'
  private static readonly REVIEWS_ENDPOINT = '/marketplace-reviews'

  /**
   * Search and browse datasets with filters
   */
  static async searchDatasets(filters: DatasetFilters = {}): Promise<DatasetSearchResponse> {
    try {
      const response = await apiClient.get(this.SEARCH_ENDPOINT, {
        params: {
          search: filters.search,
          category: filters.category,
          language: filters.language,
          dataType: filters.dataType,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          minQuality: filters.minQuality,
          verified: filters.verified,
          hasPreview: filters.hasPreview,
          sortBy: filters.sortBy || 'newest',
          sortOrder: filters.sortOrder || 'desc',
          page: filters.page || 1,
          limit: filters.limit || 20
        }
      })

      return {
        ...response.data,
        datasets: response.data.datasets.map(this.transformDataset)
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to search datasets')
    }
  }

  /**
   * Get dataset by ID with full details
   */
  static async getDataset(datasetId: string): Promise<Dataset> {
    try {
      // Check rate limit
      const rateLimitStatus = await rateLimitCheck.datasetPreview(datasetId)
      if (!rateLimitStatus.allowed) {
        throw new Error(`Rate limit exceeded. Try again in ${rateLimitStatus.retryAfter} seconds.`)
      }

      const response = await apiClient.get(`${this.DATASETS_ENDPOINT}/${datasetId}`)
      const dataset = this.transformDataset(response.data)

      // Log audit event
      await auditLog.datasetView(datasetId, {
        title: dataset.title,
        category: dataset.category,
        language: dataset.language
      })

      return dataset
    } catch (error: any) {
      await auditLog.error('dataset_view', 'dataset', datasetId, error.message)
      throw new Error(error.response?.data?.error || 'Failed to get dataset')
    }
  }

  /**
   * Get dataset preview with sample data
   */
  static async getDatasetPreview(datasetId: string): Promise<DatasetPreview> {
    try {
      // Check rate limit
      const rateLimitStatus = await rateLimitCheck.datasetPreview(datasetId)
      if (!rateLimitStatus.allowed) {
        throw new Error(`Rate limit exceeded. Try again in ${rateLimitStatus.retryAfter} seconds.`)
      }

      const response = await apiClient.get(`${this.PREVIEW_ENDPOINT}/${datasetId}`)
      const preview = {
        ...response.data,
        expiresAt: response.data.expiresAt ? new Date(response.data.expiresAt) : undefined
      }

      // Log audit event
      await auditLog.datasetPreview(datasetId, {
        sampleCount: preview.samples.length,
        previewSize: preview.statistics.totalSamples
      })

      return preview
    } catch (error: any) {
      await auditLog.error('dataset_preview', 'dataset', datasetId, error.message)
      throw new Error(error.response?.data?.error || 'Failed to get dataset preview')
    }
  }

  /**
   * Purchase dataset license
   */
  static async purchaseDataset(request: DatasetPurchaseRequest): Promise<DatasetPurchaseResponse> {
    try {
      const response = await apiClient.post(this.PURCHASE_ENDPOINT, request)
      const purchaseResponse = {
        ...response.data,
        expiresAt: response.data.expiresAt ? new Date(response.data.expiresAt) : undefined
      }

      // Log audit event
      if (purchaseResponse.success && purchaseResponse.licenseId) {
        await auditLog.datasetPurchase(request.datasetId, {
          licenseId: purchaseResponse.licenseId,
          licenseType: request.licenseType,
          paymentToken: request.paymentToken,
          paymentNetwork: request.paymentNetwork,
          transactionHash: purchaseResponse.transactionHash
        })
      }

      return purchaseResponse
    } catch (error: any) {
      await auditLog.error('dataset_purchase', 'dataset', request.datasetId, error.message, {
        licenseType: request.licenseType,
        paymentToken: request.paymentToken,
        paymentNetwork: request.paymentNetwork
      })
      throw new Error(error.response?.data?.error || 'Failed to purchase dataset')
    }
  }

  /**
   * Download dataset with license validation
   */
  static async downloadDataset(request: DatasetDownloadRequest): Promise<DatasetDownloadResponse> {
    try {
      // Check rate limit
      const rateLimitStatus = await rateLimitCheck.datasetDownload(request.licenseId)
      if (!rateLimitStatus.allowed) {
        throw new Error(`Download rate limit exceeded. Try again in ${rateLimitStatus.retryAfter} seconds.`)
      }

      const response = await apiClient.post(this.DOWNLOAD_ENDPOINT, request)
      const downloadResponse = {
        ...response.data,
        expiresAt: new Date(response.data.expiresAt)
      }

      // Log audit event
      await auditLog.datasetDownload(request.datasetId, {
        licenseId: request.licenseId,
        format: request.format,
        compression: request.compression,
        fileSize: downloadResponse.fileSize,
        checksum: downloadResponse.checksum
      })

      return downloadResponse
    } catch (error: any) {
      await auditLog.error('dataset_download', 'dataset', request.datasetId, error.message, {
        licenseId: request.licenseId,
        format: request.format,
        compression: request.compression
      })
      throw new Error(error.response?.data?.error || 'Failed to generate download link')
    }
  }

  /**
   * Get user's purchased licenses
   */
  static async getUserLicenses(): Promise<UserLicense[]> {
    try {
      const response = await apiClient.get(this.LICENSES_ENDPOINT)
      return response.data.map((license: any) => ({
        ...license,
        purchasedAt: new Date(license.purchasedAt),
        expiresAt: license.expiresAt ? new Date(license.expiresAt) : undefined
      }))
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get user licenses')
    }
  }

  /**
   * Get marketplace statistics
   */
  static async getMarketplaceStats(): Promise<DatasetStats> {
    try {
      const response = await apiClient.get(this.STATS_ENDPOINT)
      return {
        ...response.data,
        recentActivity: response.data.recentActivity.map((activity: any) => ({
          ...activity,
          timestamp: new Date(activity.timestamp)
        }))
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get marketplace stats')
    }
  }

  /**
   * Get dataset reviews
   */
  static async getDatasetReviews(datasetId: string, page = 1, limit = 10): Promise<{
    reviews: DatasetReview[]
    total: number
    averageRating: number
  }> {
    try {
      const response = await apiClient.get(`${this.REVIEWS_ENDPOINT}/${datasetId}`, {
        params: { page, limit }
      })

      return {
        ...response.data,
        reviews: response.data.reviews.map((review: any) => ({
          ...review,
          createdAt: new Date(review.createdAt),
          updatedAt: new Date(review.updatedAt),
          response: review.response ? {
            ...review.response,
            createdAt: new Date(review.response.createdAt)
          } : undefined
        }))
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get dataset reviews')
    }
  }

  /**
   * Submit dataset review
   */
  static async submitReview(datasetId: string, review: {
    rating: number
    title: string
    content: string
  }): Promise<DatasetReview> {
    try {
      const response = await apiClient.post(`${this.REVIEWS_ENDPOINT}/${datasetId}`, review)
      return {
        ...response.data,
        createdAt: new Date(response.data.createdAt),
        updatedAt: new Date(response.data.updatedAt)
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to submit review')
    }
  }

  /**
   * Check if user has access to dataset
   */
  static async checkDatasetAccess(datasetId: string): Promise<{
    hasAccess: boolean
    accessType?: 'preview' | 'full' | 'api'
    expiresAt?: Date
    restrictions: string[]
  }> {
    try {
      const response = await apiClient.get(`${this.DATASETS_ENDPOINT}/${datasetId}/access`)
      return {
        ...response.data,
        expiresAt: response.data.expiresAt ? new Date(response.data.expiresAt) : undefined
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to check dataset access')
    }
  }

  /**
   * Get recommended datasets based on user activity
   */
  static async getRecommendedDatasets(limit = 10): Promise<Dataset[]> {
    try {
      const response = await apiClient.get(`${this.DATASETS_ENDPOINT}/recommended`, {
        params: { limit }
      })
      return response.data.map(this.transformDataset)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get recommended datasets')
    }
  }

  /**
   * Get trending datasets
   */
  static async getTrendingDatasets(limit = 10): Promise<Dataset[]> {
    try {
      const response = await apiClient.get(`${this.DATASETS_ENDPOINT}/trending`, {
        params: { limit }
      })
      return response.data.map(this.transformDataset)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get trending datasets')
    }
  }

  /**
   * Transform dataset from API response
   */
  private static transformDataset(data: any): Dataset {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      preview: data.preview ? {
        ...data.preview,
        expiresAt: data.preview.expiresAt ? new Date(data.preview.expiresAt) : undefined
      } : undefined,
      access: data.access ? {
        ...data.access,
        expiresAt: data.access.expiresAt ? new Date(data.access.expiresAt) : undefined
      } : undefined
    }
  }

  /**
   * Format price for display
   */
  static formatPrice(price: { amount: string; token: string; usdEquivalent?: number }): string {
    const amount = parseFloat(price.amount)

    if (price.usdEquivalent && price.usdEquivalent > 0) {
      return `$${price.usdEquivalent.toFixed(2)} (${amount} ${price.token})`
    }

    return `${amount} ${price.token}`
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    if (bytes === 0) return '0 B'

    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    const size = bytes / Math.pow(1024, i)

    return `${size.toFixed(1)} ${sizes[i]}`
  }

  /**
   * Get category display name
   */
  static getCategoryDisplayName(category: string): string {
    const categoryNames: Record<string, string> = {
      conversational: 'Conversational',
      technical: 'Technical',
      creative: 'Creative',
      educational: 'Educational',
      news: 'News & Media',
      social: 'Social Media',
      scientific: 'Scientific',
      legal: 'Legal',
      medical: 'Medical',
      financial: 'Financial',
      entertainment: 'Entertainment',
      other: 'Other'
    }

    return categoryNames[category] || category
  }
}