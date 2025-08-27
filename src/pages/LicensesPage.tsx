import { useState } from 'react'
import {
  Download,
  Calendar,
  Clock,
  Shield,
  AlertCircle,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Eye
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useMarketplace } from '../hooks/useMarketplace'
import { useAuth } from '../contexts/AuthContext'
import { MarketplaceService } from '../services/marketplaceService'
import type { UserLicense } from '../types/dataset'

export function LicensesPage() {
  const { isAuthenticated } = useAuth()
  const { userLicenses, isLicensesLoading, refetchLicenses } = useMarketplace()
  const [selectedLicense, setSelectedLicense] = useState<UserLicense | null>(null)
  const [isDownloading, setIsDownloading] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'expiring'>('all')

  if (!isAuthenticated) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
        <p className="text-gray-600 mb-6">
          Please connect your wallet to view your dataset licenses.
        </p>
      </div>
    )
  }

  const handleDownload = async (license: UserLicense) => {
    setIsDownloading(license.id)
    try {
      const response = await MarketplaceService.downloadDataset({
        datasetId: license.datasetId,
        licenseId: license.id,
        format: 'json',
        compression: 'zip'
      })

      // Trigger download
      const link = document.createElement('a')
      link.href = response.downloadUrl
      link.download = `${license.datasetTitle.replace(/[^a-zA-Z0-9]/g, '_')}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.success('Download started!')
      refetchLicenses()
    } catch (error: any) {
      toast.error(error.message || 'Download failed')
    } finally {
      setIsDownloading(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      case 'revoked':
        return 'bg-gray-100 text-gray-800'
      case 'suspended':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />
      case 'expired':
        return <Clock className="h-4 w-4" />
      case 'revoked':
      case 'suspended':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Shield className="h-4 w-4" />
    }
  }

  const isExpiringSoon = (license: UserLicense) => {
    if (!license.expiresAt) return false
    const daysUntilExpiry = Math.ceil((license.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0
  }

  const filteredLicenses = userLicenses?.filter(license => {
    switch (filter) {
      case 'active':
        return license.status === 'active'
      case 'expired':
        return license.status === 'expired'
      case 'expiring':
        return license.status === 'active' && isExpiringSoon(license)
      default:
        return true
    }
  }) || []

  const getUsagePercentage = (used: number, max?: number) => {
    if (!max) return 0
    return Math.min((used / max) * 100, 100)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Licenses</h1>
          <p className="text-gray-600 mt-1">
            Manage your dataset licenses and downloads
          </p>
        </div>
        <button
          onClick={() => refetchLicenses()}
          disabled={isLicensesLoading}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLicensesLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-700">Filter:</span>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'All Licenses' },
            { key: 'active', label: 'Active' },
            { key: 'expiring', label: 'Expiring Soon' },
            { key: 'expired', label: 'Expired' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key as any)}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${filter === key
                ? 'bg-blue-100 text-blue-800 font-medium'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {label}
              {key !== 'all' && (
                <span className="ml-1 text-xs">
                  ({userLicenses?.filter(l => {
                    switch (key) {
                      case 'active': return l.status === 'active'
                      case 'expired': return l.status === 'expired'
                      case 'expiring': return l.status === 'active' && isExpiringSoon(l)
                      default: return true
                    }
                  }).length || 0})
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {isLicensesLoading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading your licenses...</p>
        </div>
      )}

      {/* Licenses List */}
      {!isLicensesLoading && filteredLicenses.length > 0 && (
        <div className="space-y-4">
          {filteredLicenses.map((license) => (
            <div key={license.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {license.datasetTitle}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(license.status)}`}>
                      {getStatusIcon(license.status)}
                      {license.status.charAt(0).toUpperCase() + license.status.slice(1)}
                    </span>
                    {isExpiringSoon(license) && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-medium rounded-full flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expiring Soon
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">License Type:</span>
                      <p className="font-medium capitalize">{license.licenseType}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Purchased:</span>
                      <p className="font-medium">{license.purchasedAt.toLocaleDateString()}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Price Paid:</span>
                      <p className="font-medium">{license.amount} {license.token}</p>
                    </div>
                    <div>
                      <span className="text-gray-500">Network:</span>
                      <p className="font-medium capitalize">{license.network}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Usage Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Download Usage */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Downloads</span>
                    <span className="text-sm text-gray-500">
                      {license.downloadCount}/{license.maxDownloads || '∞'}
                    </span>
                  </div>
                  {license.maxDownloads && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${getUsagePercentage(license.downloadCount, license.maxDownloads)}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* API Usage */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">API Calls</span>
                    <span className="text-sm text-gray-500">
                      {license.apiCalls}/{license.maxApiCalls || '∞'}
                    </span>
                  </div>
                  {license.maxApiCalls && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${getUsagePercentage(license.apiCalls, license.maxApiCalls)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Expiration Info */}
              {license.expiresAt && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">
                      {license.status === 'expired'
                        ? `Expired on ${license.expiresAt.toLocaleDateString()}`
                        : `Expires on ${license.expiresAt.toLocaleDateString()}`
                      }
                    </span>
                    {isExpiringSoon(license) && (
                      <span className="text-xs text-yellow-600">
                        ({Math.ceil((license.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining)
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <ExternalLink className="h-4 w-4" />
                  <a
                    href={`#/marketplace/dataset/${license.datasetId}`}
                    className="hover:text-blue-600 transition-colors"
                  >
                    View Dataset
                  </a>
                  <span>•</span>
                  <a
                    href={`https://etherscan.io/tx/${license.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-blue-600 transition-colors"
                  >
                    View Transaction
                  </a>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedLicense(license)}
                    className="btn-secondary text-sm flex items-center gap-1"
                  >
                    <Eye className="h-4 w-4" />
                    Details
                  </button>

                  {license.status === 'active' && (
                    <button
                      onClick={() => handleDownload(license)}
                      disabled={isDownloading === license.id || !!(license.maxDownloads && license.downloadCount >= license.maxDownloads)}
                      className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50"
                    >
                      {isDownloading === license.id ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" />
                          Download
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLicensesLoading && filteredLicenses.length === 0 && (
        <div className="text-center py-12">
          <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'all' ? 'No licenses found' : `No ${filter} licenses`}
          </h3>
          <p className="text-gray-500 mb-6">
            {filter === 'all'
              ? "You haven't purchased any dataset licenses yet."
              : `You don't have any ${filter} licenses at the moment.`
            }
          </p>
          {filter === 'all' && (
            <a href="#/marketplace" className="btn-primary">
              Browse Marketplace
            </a>
          )}
        </div>
      )}

      {/* License Details Modal */}
      {selectedLicense && (
        <LicenseDetailsModal
          license={selectedLicense}
          isOpen={!!selectedLicense}
          onClose={() => setSelectedLicense(null)}
        />
      )}
    </div>
  )
}

interface LicenseDetailsModalProps {
  license: UserLicense
  isOpen: boolean
  onClose: () => void
}

function LicenseDetailsModal({ license, isOpen, onClose }: LicenseDetailsModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">License Details</h2>
            <p className="text-sm text-gray-500">{license.datasetTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ExternalLink className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">License Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">License ID:</span>
                <p className="font-mono text-xs break-all">{license.id}</p>
              </div>
              <div>
                <span className="text-gray-500">License Type:</span>
                <p className="font-medium capitalize">{license.licenseType}</p>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <p className="font-medium capitalize">{license.status}</p>
              </div>
              <div>
                <span className="text-gray-500">Purchase Date:</span>
                <p className="font-medium">{license.purchasedAt.toLocaleDateString()}</p>
              </div>
              {license.expiresAt && (
                <div>
                  <span className="text-gray-500">Expiration Date:</span>
                  <p className="font-medium">{license.expiresAt.toLocaleDateString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Info */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Payment Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Amount Paid:</span>
                <p className="font-medium">{license.amount} {license.token}</p>
              </div>
              <div>
                <span className="text-gray-500">Network:</span>
                <p className="font-medium capitalize">{license.network}</p>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Transaction Hash:</span>
                <p className="font-mono text-xs break-all">{license.transactionHash}</p>
              </div>
            </div>
          </div>

          {/* Usage Statistics */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Usage Statistics</h3>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">Downloads</span>
                  <span className="text-sm text-gray-500">
                    {license.downloadCount} / {license.maxDownloads || 'Unlimited'}
                  </span>
                </div>
                {license.maxDownloads && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((license.downloadCount / license.maxDownloads) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-700">API Calls</span>
                  <span className="text-sm text-gray-500">
                    {license.apiCalls} / {license.maxApiCalls || 'Unlimited'}
                  </span>
                </div>
                {license.maxApiCalls && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((license.apiCalls / license.maxApiCalls) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}