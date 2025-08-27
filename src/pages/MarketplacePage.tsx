import { useState, useEffect } from 'react'
import {
  TrendingUp,
  Star,
  Database,
  Users,
  DollarSign,
  Eye,
  Loader2
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useMarketplace } from '../hooks/useMarketplace'
import { useAuth } from '../contexts/AuthContext'
import { DatasetCard } from '../components/DatasetCard'
import { DatasetFilters } from '../components/DatasetFilters'
import { DatasetPreviewModal } from '../components/DatasetPreviewModal'
import { DatasetPurchaseModal } from '../components/DatasetPurchaseModal'
import type { Dataset } from '../types/dataset'

export function MarketplacePage() {
  const { isAuthenticated } = useAuth()
  const {
    searchResults,
    trendingDatasets,
    recommendedDatasets,
    marketplaceStats,
    filters,
    isSearching,
    isTrendingLoading,
    isRecommendedLoading,
    isStatsLoading,
    updateFilters,
    resetFilters,
    loadMore,
    hasMore,
    totalResults,
    currentPage
  } = useMarketplace()

  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showPurchaseModal, setShowPurchaseModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'trending' | 'recommended'>('all')

  // Handle infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + document.documentElement.scrollTop
        >= document.documentElement.offsetHeight - 1000
      ) {
        if (hasMore && !isSearching && activeTab === 'all') {
          loadMore()
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [hasMore, isSearching, loadMore, activeTab])

  const handlePreview = (dataset: Dataset) => {
    setSelectedDataset(dataset)
    setShowPreviewModal(true)
  }

  const handlePurchase = (dataset: Dataset) => {
    if (!isAuthenticated) {
      toast.error('Please connect your wallet to purchase datasets')
      return
    }
    setSelectedDataset(dataset)
    setShowPurchaseModal(true)
  }

  const handlePurchaseSuccess = (_licenseId: string) => {
    toast.success('Dataset purchased successfully!')
    setShowPurchaseModal(false)
    setSelectedDataset(null)
  }

  const getDisplayDatasets = () => {
    switch (activeTab) {
      case 'trending':
        return trendingDatasets || []
      case 'recommended':
        return recommendedDatasets || []
      default:
        return searchResults?.datasets || []
    }
  }

  const getLoadingState = () => {
    switch (activeTab) {
      case 'trending':
        return isTrendingLoading
      case 'recommended':
        return isRecommendedLoading
      default:
        return isSearching
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Data Marketplace</h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Discover and license high-quality language datasets for your AI projects.
          Browse verified datasets from contributors worldwide.
        </p>
      </div>

      {/* Stats Overview */}
      {marketplaceStats && !isStatsLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <Database className="h-8 w-8 text-blue-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {marketplaceStats.totalDatasets.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total Datasets</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <Eye className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {marketplaceStats.totalDownloads.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total Downloads</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <DollarSign className="h-8 w-8 text-purple-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              ${parseFloat(marketplaceStats.totalRevenue).toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total Revenue</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
            <Star className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-900">
              {marketplaceStats.averageRating.toFixed(1)}
            </div>
            <div className="text-sm text-gray-500">Average Rating</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center justify-center">
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'all'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            All Datasets
            {totalResults > 0 && (
              <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                {totalResults.toLocaleString()}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('trending')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${activeTab === 'trending'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <TrendingUp className="h-4 w-4" />
            Trending
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setActiveTab('recommended')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1 ${activeTab === 'recommended'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <Users className="h-4 w-4" />
              Recommended
            </button>
          )}
        </div>
      </div>

      {/* Filters - Only show for 'all' tab */}
      {activeTab === 'all' && (
        <DatasetFilters
          filters={filters}
          onFiltersChange={updateFilters}
          onReset={resetFilters}
          facets={searchResults?.facets}
        />
      )}

      {/* Results */}
      <div>
        {/* Loading State */}
        {getLoadingState() && currentPage === 1 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-500">Loading datasets...</p>
            </div>
          </div>
        )}

        {/* Datasets Grid */}
        {!getLoadingState() && getDisplayDatasets().length > 0 && (
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {getDisplayDatasets().map((dataset) => (
              <DatasetCard
                key={dataset.id}
                dataset={dataset}
                onPreview={handlePreview}
                onPurchase={handlePurchase}
              />
            ))}
          </div>
        )}

        {/* Load More Button */}
        {activeTab === 'all' && hasMore && !isSearching && searchResults?.datasets && searchResults.datasets.length > 0 && (
          <div className="text-center mt-8">
            <button
              onClick={loadMore}
              disabled={isSearching}
              className="btn-secondary flex items-center gap-2 mx-auto"
            >
              {isSearching ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  Load More Datasets
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                    {searchResults.datasets.length} of {totalResults}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Empty State */}
        {!getLoadingState() && getDisplayDatasets().length === 0 && (
          <div className="text-center py-12">
            <Database className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === 'all' && filters.search
                ? 'No datasets found'
                : activeTab === 'trending'
                  ? 'No trending datasets'
                  : activeTab === 'recommended'
                    ? 'No recommendations available'
                    : 'No datasets available'
              }
            </h3>
            <p className="text-gray-500 mb-6">
              {activeTab === 'all' && filters.search
                ? 'Try adjusting your search criteria or filters'
                : activeTab === 'trending'
                  ? 'Check back later for trending datasets'
                  : activeTab === 'recommended'
                    ? 'Browse datasets to get personalized recommendations'
                    : 'Datasets will appear here once they are available'
              }
            </p>
            {activeTab === 'all' && (filters.search || Object.keys(filters).length > 2) && (
              <button
                onClick={resetFilters}
                className="btn-secondary"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedDataset && (
        <>
          <DatasetPreviewModal
            dataset={selectedDataset}
            isOpen={showPreviewModal}
            onClose={() => {
              setShowPreviewModal(false)
              setSelectedDataset(null)
            }}
            onPurchase={handlePurchase}
          />

          <DatasetPurchaseModal
            dataset={selectedDataset}
            isOpen={showPurchaseModal}
            onClose={() => {
              setShowPurchaseModal(false)
              setSelectedDataset(null)
            }}
            onSuccess={handlePurchaseSuccess}
          />
        </>
      )}
    </div>
  )
}