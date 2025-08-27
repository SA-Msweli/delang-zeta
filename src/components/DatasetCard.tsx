import { useState } from 'react'
import {
  Star,
  Download,
  Eye,
  Shield,
  Clock,
  Database,
  Lock,
  Unlock
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { MarketplaceService } from '../services/marketplaceService'
import { useMarketplace } from '../hooks/useMarketplace'
import { useAuth } from '../contexts/AuthContext'
import type { Dataset } from '../types/dataset'

interface DatasetCardProps {
  dataset: Dataset
  onPreview?: (dataset: Dataset) => void
  onPurchase?: (dataset: Dataset) => void
  className?: string
}

export function DatasetCard({
  dataset,
  onPreview,
  onPurchase,
  className = ''
}: DatasetCardProps) {
  const { isAuthenticated } = useAuth()
  const { hasLicenseForDataset, getLicenseForDataset } = useMarketplace()
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  const hasLicense = hasLicenseForDataset(dataset.id)
  const userLicense = getLicenseForDataset(dataset.id)

  const handlePreview = async () => {
    if (onPreview) {
      onPreview(dataset)
      return
    }

    setIsLoadingPreview(true)
    try {
      const preview = await MarketplaceService.getDatasetPreview(dataset.id)
      if (preview) {
        // Open preview in modal or new tab
        console.log('Preview data:', preview)
        toast.success('Preview loaded successfully')
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load preview')
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const handlePurchase = () => {
    if (!isAuthenticated) {
      toast.error('Please connect your wallet to purchase datasets')
      return
    }

    if (onPurchase) {
      onPurchase(dataset)
    }
  }

  const formatPrice = () => {
    return MarketplaceService.formatPrice(dataset.price)
  }

  const formatFileSize = () => {
    // Convert size string to bytes for formatting
    const sizeMatch = dataset.size.match(/^([\d.]+)\s*([KMGT]?B)$/i)
    if (!sizeMatch) return dataset.size

    const [, value, unit] = sizeMatch
    const multipliers: Record<string, number> = {
      'B': 1,
      'KB': 1024,
      'MB': 1024 * 1024,
      'GB': 1024 * 1024 * 1024,
      'TB': 1024 * 1024 * 1024 * 1024
    }

    const bytes = parseFloat(value) * (multipliers[unit.toUpperCase()] || 1)
    return MarketplaceService.formatFileSize(bytes)
  }

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      conversational: 'bg-blue-100 text-blue-800',
      technical: 'bg-purple-100 text-purple-800',
      creative: 'bg-pink-100 text-pink-800',
      educational: 'bg-green-100 text-green-800',
      news: 'bg-orange-100 text-orange-800',
      social: 'bg-cyan-100 text-cyan-800',
      scientific: 'bg-indigo-100 text-indigo-800',
      legal: 'bg-gray-100 text-gray-800',
      medical: 'bg-red-100 text-red-800',
      financial: 'bg-yellow-100 text-yellow-800',
      entertainment: 'bg-rose-100 text-rose-800',
      other: 'bg-slate-100 text-slate-800'
    }
    return colors[category] || colors.other
  }

  return (
    <div className={`card hover:shadow-lg transition-all duration-200 group ${className}`}>
      {/* Header with badges */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(dataset.category)}`}>
            {MarketplaceService.getCategoryDisplayName(dataset.category)}
          </span>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
            {dataset.language}
          </span>
          <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full capitalize">
            {dataset.dataType}
          </span>
          {dataset.verified && (
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Verified
            </span>
          )}
          {hasLicense && (
            <span className="px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full flex items-center gap-1">
              <Unlock className="h-3 w-3" />
              Owned
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Star className="h-4 w-4 text-yellow-400 fill-current" />
          <span className="font-medium">{dataset.rating.toFixed(1)}</span>
          <span className="text-gray-500">({dataset.reviewCount})</span>
        </div>
      </div>

      {/* Title and description */}
      <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
        {dataset.title}
      </h3>
      <p className="text-gray-600 mb-4 line-clamp-3 text-sm leading-relaxed">
        {dataset.description}
      </p>

      {/* Metadata */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-500 flex items-center gap-1">
            <Database className="h-4 w-4" />
            Size:
          </span>
          <span className="font-medium text-gray-900">{formatFileSize()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Samples:</span>
          <span className="font-medium text-gray-900">{dataset.sampleCount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500 flex items-center gap-1">
            <Download className="h-4 w-4" />
            Downloads:
          </span>
          <span className="font-medium text-gray-900">{dataset.downloads.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-500">Quality:</span>
          <div className="flex items-center gap-1">
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-full transition-all"
                style={{ width: `${dataset.qualityScore}%` }}
              />
            </div>
            <span className="font-medium text-gray-900 text-xs">
              {dataset.qualityScore}%
            </span>
          </div>
        </div>
        {userLicense && userLicense.expiresAt && (
          <div className="flex justify-between items-center">
            <span className="text-gray-500 flex items-center gap-1">
              <Clock className="h-4 w-4" />
              License expires:
            </span>
            <span className="font-medium text-gray-900 text-xs">
              {userLicense.expiresAt.toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Tags */}
      {dataset.tags && dataset.tags.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1">
            {dataset.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded"
              >
                #{tag}
              </span>
            ))}
            {dataset.tags.length > 3 && (
              <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded">
                +{dataset.tags.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Price and actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex flex-col">
          <span className="text-2xl font-bold text-gray-900">
            {formatPrice()}
          </span>
          {dataset.price.usdEquivalent && (
            <span className="text-xs text-gray-500">
              ≈ ${dataset.price.usdEquivalent.toFixed(2)} USD
            </span>
          )}
        </div>

        <div className="flex gap-2">
          {/* Preview button */}
          <button
            onClick={handlePreview}
            disabled={isLoadingPreview}
            className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-50"
            title="Preview dataset"
          >
            <Eye className="h-4 w-4" />
            {isLoadingPreview ? 'Loading...' : 'Preview'}
          </button>

          {/* Purchase/Access button */}
          {hasLicense ? (
            <button
              onClick={() => {
                // Navigate to dataset details or download
                toast.success('You already own this dataset!')
              }}
              className="btn-success text-sm flex items-center gap-1"
              title="You own this dataset"
            >
              <Unlock className="h-4 w-4" />
              Access
            </button>
          ) : (
            <button
              onClick={handlePurchase}
              className="btn-primary text-sm flex items-center gap-1"
              title="Purchase dataset license"
            >
              <Lock className="h-4 w-4" />
              License
            </button>
          )}
        </div>
      </div>

      {/* License info for owned datasets */}
      {hasLicense && userLicense && (
        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-700 font-medium">
              {userLicense.licenseType.charAt(0).toUpperCase() + userLicense.licenseType.slice(1)} License
            </span>
            <span className="text-green-600">
              {userLicense.downloadCount}/{userLicense.maxDownloads || '∞'} downloads
            </span>
          </div>
          {userLicense.expiresAt && (
            <div className="text-xs text-green-600 mt-1">
              Expires: {userLicense.expiresAt.toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}