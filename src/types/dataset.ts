// Dataset and marketplace types and interfaces

export interface Dataset {
  id: string
  title: string
  description: string
  language: string
  category: DatasetCategory
  dataType: 'text' | 'audio' | 'image' | 'video' | 'multimodal'
  size: string
  sampleCount: number
  qualityScore: number
  rating: number
  reviewCount: number
  price: DatasetPrice
  downloads: number
  verified: boolean
  creator: string
  createdAt: Date
  updatedAt: Date
  tags: string[]
  metadata: DatasetMetadata
  preview: DatasetPreview
  license: DatasetLicense
  access: DatasetAccess
}

export interface DatasetMetadata {
  format: string[]
  encoding?: string
  sampleRate?: number
  bitRate?: number
  resolution?: string
  duration?: number
  wordCount?: number
  languageVariant?: string
  culturalContext?: string
  domainSpecific?: string[]
  qualityMetrics: QualityMetrics
}

export interface QualityMetrics {
  accuracy: number
  completeness: number
  consistency: number
  relevance: number
  diversity: number
  bias: number
  aiVerificationScore: number
  humanVerificationScore: number
}

export interface DatasetPrice {
  amount: string
  token: string
  network: string
  usdEquivalent: number
  discounts?: PriceDiscount[]
}

export interface PriceDiscount {
  type: 'bulk' | 'academic' | 'early_access' | 'loyalty'
  threshold: number
  percentage: number
  description: string
}

export interface DatasetPreview {
  samples: PreviewSample[]
  statistics: PreviewStatistics
  downloadUrl?: string
  expiresAt?: Date
}

export interface PreviewSample {
  id: string
  content: string | ArrayBuffer
  metadata: Record<string, any>
  type: 'text' | 'audio' | 'image' | 'video'
}

export interface PreviewStatistics {
  totalSamples: number
  averageLength: number
  languageDistribution: Record<string, number>
  topicDistribution: Record<string, number>
  qualityDistribution: Record<string, number>
}

export interface DatasetLicense {
  id: string
  type: LicenseType
  name: string
  description: string
  permissions: LicensePermission[]
  restrictions: LicenseRestriction[]
  attribution: boolean
  commercial: boolean
  derivatives: boolean
  shareAlike: boolean
  duration: number // in days, 0 for perpetual
  maxUsers?: number
  maxDownloads?: number
  geographicRestrictions?: string[]
}

export interface DatasetAccess {
  hasAccess: boolean
  accessType?: 'preview' | 'full' | 'api'
  expiresAt?: Date
  downloadCount: number
  maxDownloads?: number
  apiCalls: number
  maxApiCalls?: number
  restrictions: AccessRestriction[]
}

export interface AccessRestriction {
  type: 'geographic' | 'usage' | 'time' | 'volume'
  description: string
  active: boolean
}

export type DatasetCategory =
  | 'conversational'
  | 'technical'
  | 'creative'
  | 'educational'
  | 'news'
  | 'social'
  | 'scientific'
  | 'legal'
  | 'medical'
  | 'financial'
  | 'entertainment'
  | 'other'

export type LicenseType =
  | 'commercial'
  | 'academic'
  | 'research'
  | 'personal'
  | 'open'
  | 'restricted'

export type LicensePermission =
  | 'use'
  | 'modify'
  | 'distribute'
  | 'sublicense'
  | 'private_use'
  | 'commercial_use'
  | 'patent_use'

export type LicenseRestriction =
  | 'no_commercial'
  | 'no_derivatives'
  | 'no_distribution'
  | 'attribution_required'
  | 'share_alike'
  | 'no_sublicense'
  | 'geographic_limit'
  | 'time_limit'
  | 'usage_limit'

export interface DatasetFilters {
  search?: string
  category?: DatasetCategory
  language?: string
  dataType?: string
  minPrice?: number
  maxPrice?: number
  minQuality?: number
  verified?: boolean
  hasPreview?: boolean
  sortBy?: DatasetSortOption
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export type DatasetSortOption =
  | 'newest'
  | 'oldest'
  | 'price_low'
  | 'price_high'
  | 'quality'
  | 'rating'
  | 'downloads'
  | 'relevance'

export interface DatasetSearchResponse {
  datasets: Dataset[]
  total: number
  page: number
  limit: number
  hasMore: boolean
  filters: DatasetFilters
  facets: SearchFacets
}

export interface SearchFacets {
  categories: FacetCount[]
  languages: FacetCount[]
  dataTypes: FacetCount[]
  priceRanges: FacetCount[]
  qualityRanges: FacetCount[]
}

export interface FacetCount {
  value: string
  count: number
  selected: boolean
}

export interface DatasetPurchaseRequest {
  datasetId: string
  licenseType: LicenseType
  paymentToken: string
  paymentNetwork: string
  quantity?: number
  academicDiscount?: boolean
  bulkDiscount?: boolean
}

export interface DatasetPurchaseResponse {
  success: boolean
  licenseId?: string
  transactionHash?: string
  downloadUrl?: string
  apiKey?: string
  expiresAt?: Date
  message: string
  errors?: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface DatasetDownloadRequest {
  datasetId: string
  licenseId: string
  format?: string
  compression?: 'none' | 'zip' | 'tar.gz'
}

export interface DatasetDownloadResponse {
  downloadUrl: string
  expiresAt: Date
  fileSize: number
  format: string
  checksum: string
}

export interface DatasetStats {
  totalDatasets: number
  totalDownloads: number
  totalRevenue: string
  averageRating: number
  topCategories: CategoryStats[]
  topLanguages: LanguageStats[]
  recentActivity: DatasetActivity[]
}

export interface CategoryStats {
  category: DatasetCategory
  count: number
  averagePrice: number
  averageRating: number
}

export interface LanguageStats {
  language: string
  count: number
  averagePrice: number
  totalDownloads: number
}

export interface DatasetActivity {
  id: string
  type: 'created' | 'purchased' | 'downloaded' | 'reviewed' | 'updated'
  datasetId: string
  datasetTitle: string
  actor: string
  timestamp: Date
  details: Record<string, any>
}

export interface UserLicense {
  id: string
  datasetId: string
  datasetTitle: string
  licenseType: LicenseType
  purchasedAt: Date
  expiresAt?: Date
  status: 'active' | 'expired' | 'revoked' | 'suspended'
  downloadCount: number
  maxDownloads?: number
  apiCalls: number
  maxApiCalls?: number
  transactionHash: string
  amount: string
  token: string
  network: string
}

export interface DatasetReview {
  id: string
  datasetId: string
  reviewer: string
  rating: number
  title: string
  content: string
  helpful: number
  verified: boolean
  createdAt: Date
  updatedAt: Date
  response?: ReviewResponse
}

export interface ReviewResponse {
  content: string
  author: string
  createdAt: Date
}