import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { MarketplaceService } from '../services/marketplaceService'
import { useAuth } from '../contexts/AuthContext'
import type {
  Dataset,
  DatasetFilters,
  // DatasetSearchResponse,
  DatasetPurchaseRequest,
  DatasetDownloadRequest,
  UserLicense,
  DatasetPreview
} from '../types/dataset'

export function useMarketplace() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<DatasetFilters>({
    page: 1,
    limit: 20,
    sortBy: 'newest',
    sortOrder: 'desc'
  })

  // Search datasets with filters
  const {
    data: searchResults,
    isLoading: isSearching,
    error: searchError,
    refetch: refetchSearch
  } = useQuery({
    queryKey: ['marketplace-search', filters],
    queryFn: () => MarketplaceService.searchDatasets(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2
  })

  // Get trending datasets
  const {
    data: trendingDatasets,
    isLoading: isTrendingLoading
  } = useQuery({
    queryKey: ['marketplace-trending'],
    queryFn: () => MarketplaceService.getTrendingDatasets(10),
    staleTime: 1000 * 60 * 15, // 15 minutes
    retry: 2
  })

  // Get recommended datasets (only if authenticated)
  const {
    data: recommendedDatasets,
    isLoading: isRecommendedLoading
  } = useQuery({
    queryKey: ['marketplace-recommended'],
    queryFn: () => MarketplaceService.getRecommendedDatasets(10),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 10, // 10 minutes
    retry: 2
  })

  // Get user licenses (only if authenticated)
  const {
    data: userLicenses,
    isLoading: isLicensesLoading,
    refetch: refetchLicenses
  } = useQuery({
    queryKey: ['user-licenses'],
    queryFn: () => MarketplaceService.getUserLicenses(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2
  })

  // Get marketplace stats
  const {
    data: marketplaceStats,
    isLoading: isStatsLoading
  } = useQuery({
    queryKey: ['marketplace-stats'],
    queryFn: () => MarketplaceService.getMarketplaceStats(),
    staleTime: 1000 * 60 * 30, // 30 minutes
    retry: 2
  })

  // Purchase dataset mutation
  const purchaseDatasetMutation = useMutation({
    mutationFn: (request: DatasetPurchaseRequest) =>
      MarketplaceService.purchaseDataset(request),
    onSuccess: (response) => {
      toast.success('Dataset purchased successfully!')
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['user-licenses'] })
      queryClient.invalidateQueries({ queryKey: ['marketplace-stats'] })

      // Update dataset access in cache if available
      if (response.licenseId) {
        queryClient.invalidateQueries({
          queryKey: ['dataset-access', response.licenseId]
        })
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to purchase dataset')
    }
  })

  // Download dataset mutation
  const downloadDatasetMutation = useMutation({
    mutationFn: (request: DatasetDownloadRequest) =>
      MarketplaceService.downloadDataset(request),
    onSuccess: (response) => {
      // Trigger download
      const link = document.createElement('a')
      link.href = response.downloadUrl
      link.download = ''
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Download started!')

      // Update license usage
      queryClient.invalidateQueries({ queryKey: ['user-licenses'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to download dataset')
    }
  })

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<DatasetFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      // Reset page when changing filters (except when explicitly setting page)
      page: newFilters.page !== undefined ? newFilters.page : 1
    }))
  }, [])

  // Reset filters
  const resetFilters = useCallback(() => {
    setFilters({
      page: 1,
      limit: 20,
      sortBy: 'newest',
      sortOrder: 'desc'
    })
  }, [])

  // Load more results (for infinite scroll)
  const loadMore = useCallback(() => {
    if (searchResults?.hasMore) {
      updateFilters({ page: (filters.page || 1) + 1 })
    }
  }, [searchResults?.hasMore, filters.page, updateFilters])

  // Get dataset by ID
  const getDataset = useCallback(async (datasetId: string): Promise<Dataset | null> => {
    try {
      return await MarketplaceService.getDataset(datasetId)
    } catch (error: any) {
      toast.error(error.message || 'Failed to get dataset')
      return null
    }
  }, [])

  // Get dataset preview
  const getDatasetPreview = useCallback(async (datasetId: string): Promise<DatasetPreview | null> => {
    try {
      return await MarketplaceService.getDatasetPreview(datasetId)
    } catch (error: any) {
      toast.error(error.message || 'Failed to get dataset preview')
      return null
    }
  }, [])

  // Check dataset access
  const checkDatasetAccess = useCallback(async (datasetId: string) => {
    try {
      return await MarketplaceService.checkDatasetAccess(datasetId)
    } catch (error: any) {
      toast.error(error.message || 'Failed to check dataset access')
      return { hasAccess: false, restrictions: [] }
    }
  }, [])

  // Purchase dataset
  const purchaseDataset = useCallback(async (request: DatasetPurchaseRequest) => {
    if (!isAuthenticated) {
      toast.error('Please authenticate to purchase datasets')
      return null
    }

    return purchaseDatasetMutation.mutateAsync(request)
  }, [isAuthenticated, purchaseDatasetMutation])

  // Download dataset
  const downloadDataset = useCallback(async (request: DatasetDownloadRequest) => {
    if (!isAuthenticated) {
      toast.error('Please authenticate to download datasets')
      return null
    }

    return downloadDatasetMutation.mutateAsync(request)
  }, [isAuthenticated, downloadDatasetMutation])

  // Check if user has license for dataset
  const hasLicenseForDataset = useCallback((datasetId: string): boolean => {
    if (!userLicenses) return false

    return userLicenses.some(license =>
      license.datasetId === datasetId &&
      license.status === 'active' &&
      (!license.expiresAt || license.expiresAt > new Date())
    )
  }, [userLicenses])

  // Get user license for dataset
  const getLicenseForDataset = useCallback((datasetId: string): UserLicense | null => {
    if (!userLicenses) return null

    return userLicenses.find(license =>
      license.datasetId === datasetId &&
      license.status === 'active' &&
      (!license.expiresAt || license.expiresAt > new Date())
    ) || null
  }, [userLicenses])

  return {
    // Data
    searchResults,
    trendingDatasets,
    recommendedDatasets,
    userLicenses,
    marketplaceStats,
    filters,

    // Loading states
    isSearching,
    isTrendingLoading,
    isRecommendedLoading,
    isLicensesLoading,
    isStatsLoading,
    isPurchasing: purchaseDatasetMutation.isPending,
    isDownloading: downloadDatasetMutation.isPending,

    // Error states
    searchError,

    // Actions
    updateFilters,
    resetFilters,
    loadMore,
    refetchSearch,
    refetchLicenses,
    getDataset,
    getDatasetPreview,
    checkDatasetAccess,
    purchaseDataset,
    downloadDataset,

    // Utilities
    hasLicenseForDataset,
    getLicenseForDataset,

    // Computed
    hasMore: searchResults?.hasMore || false,
    totalResults: searchResults?.total || 0,
    currentPage: filters.page || 1
  }
}