import { useState, useEffect } from 'react'
import {
  X,
  CreditCard,
  Shield,
  AlertCircle,
  CheckCircle,
  Wallet
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useMarketplace } from '../hooks/useMarketplace'
import { useAuth } from '../contexts/AuthContext'
import { MarketplaceService } from '../services/marketplaceService'
import type { Dataset, LicenseType, DatasetPurchaseRequest } from '../types/dataset'

interface DatasetPurchaseModalProps {
  dataset: Dataset
  isOpen: boolean
  onClose: () => void
  onSuccess?: (licenseId: string) => void
}

export function DatasetPurchaseModal({
  dataset,
  isOpen,
  onClose,
  onSuccess
}: DatasetPurchaseModalProps) {
  const { isAuthenticated } = useAuth()
  const { purchaseDataset, isPurchasing } = useMarketplace()

  const [selectedLicense, setSelectedLicense] = useState<LicenseType>('commercial')
  const [paymentToken, setPaymentToken] = useState('ETH')
  const [paymentNetwork, setPaymentNetwork] = useState('ethereum')
  const [quantity, setQuantity] = useState(1)
  const [academicDiscount, setAcademicDiscount] = useState(false)
  const [bulkDiscount, setBulkDiscount] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState<number>(0)

  const licenseTypes: Array<{
    type: LicenseType
    name: string
    description: string
    permissions: string[]
    restrictions: string[]
    priceMultiplier: number
  }> = [
      {
        type: 'personal',
        name: 'Personal License',
        description: 'For individual, non-commercial use',
        permissions: ['Personal use', 'Learning', 'Research'],
        restrictions: ['No commercial use', 'No redistribution'],
        priceMultiplier: 0.3
      },
      {
        type: 'academic',
        name: 'Academic License',
        description: 'For educational institutions and research',
        permissions: ['Educational use', 'Research', 'Publication'],
        restrictions: ['No commercial use', 'Attribution required'],
        priceMultiplier: 0.5
      },
      {
        type: 'commercial',
        name: 'Commercial License',
        description: 'For business and commercial applications',
        permissions: ['Commercial use', 'Modification', 'Distribution'],
        restrictions: ['Attribution required'],
        priceMultiplier: 1.0
      },
      {
        type: 'research',
        name: 'Research License',
        description: 'For research organizations and labs',
        permissions: ['Research use', 'Publication', 'Collaboration'],
        restrictions: ['No commercial use', 'Share-alike'],
        priceMultiplier: 0.4
      }
    ]

  const paymentOptions = [
    { token: 'ETH', network: 'ethereum', name: 'Ethereum (ETH)', icon: '⟠' },
    { token: 'BTC', network: 'bitcoin', name: 'Bitcoin (BTC)', icon: '₿' },
    { token: 'USDC', network: 'ethereum', name: 'USD Coin (USDC)', icon: '$' },
    { token: 'USDC', network: 'polygon', name: 'USDC (Polygon)', icon: '$' },
    { token: 'ZETA', network: 'zetachain', name: 'ZetaChain (ZETA)', icon: 'Z' }
  ]

  useEffect(() => {
    calculateEstimatedCost()
  }, [selectedLicense, quantity, academicDiscount, bulkDiscount])

  const calculateEstimatedCost = () => {
    const selectedLicenseType = licenseTypes.find(l => l.type === selectedLicense)
    if (!selectedLicenseType) return

    let cost = dataset.price.usdEquivalent * selectedLicenseType.priceMultiplier * quantity

    // Apply discounts
    if (academicDiscount && selectedLicense === 'academic') {
      cost *= 0.8 // 20% academic discount
    }

    if (bulkDiscount && quantity >= 5) {
      cost *= 0.85 // 15% bulk discount
    }

    setEstimatedCost(cost)
  }

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      toast.error('Please connect your wallet to purchase')
      return
    }

    if (!agreedToTerms) {
      toast.error('Please agree to the terms and conditions')
      return
    }

    const request: DatasetPurchaseRequest = {
      datasetId: dataset.id,
      licenseType: selectedLicense,
      paymentToken,
      paymentNetwork,
      quantity,
      academicDiscount: academicDiscount && selectedLicense === 'academic',
      bulkDiscount: bulkDiscount && quantity >= 5
    }

    try {
      const response = await purchaseDataset(request)
      if (response?.success && response.licenseId) {
        toast.success('Dataset purchased successfully!')
        onSuccess?.(response.licenseId)
        onClose()
      }
    } catch (error: any) {
      toast.error(error.message || 'Purchase failed')
    }
  }

  if (!isOpen) return null

  const selectedLicenseType = licenseTypes.find(l => l.type === selectedLicense)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <CreditCard className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Purchase Dataset License</h2>
              <p className="text-sm text-gray-500">{dataset.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-2 gap-6 p-6">
            {/* Left Column - License Selection */}
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Choose License Type</h3>
                <div className="space-y-3">
                  {licenseTypes.map((license) => (
                    <div
                      key={license.type}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${selectedLicense === license.type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                      onClick={() => setSelectedLicense(license.type)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <input
                              type="radio"
                              checked={selectedLicense === license.type}
                              onChange={() => setSelectedLicense(license.type)}
                              className="text-blue-600"
                            />
                            <h4 className="font-medium text-gray-900">{license.name}</h4>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{license.description}</p>

                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                              <p className="font-medium text-green-700 mb-1">Permissions:</p>
                              <ul className="space-y-1">
                                {license.permissions.map((permission, index) => (
                                  <li key={index} className="flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3 text-green-600" />
                                    {permission}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-medium text-red-700 mb-1">Restrictions:</p>
                              <ul className="space-y-1">
                                {license.restrictions.map((restriction, index) => (
                                  <li key={index} className="flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3 text-red-600" />
                                    {restriction}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-gray-900">
                            ${(dataset.price.usdEquivalent * license.priceMultiplier).toFixed(2)}
                          </span>
                          {license.priceMultiplier !== 1.0 && (
                            <p className="text-xs text-gray-500">
                              {Math.round(license.priceMultiplier * 100)}% of base price
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Method</h3>
                <div className="grid grid-cols-2 gap-3">
                  {paymentOptions.map((option) => (
                    <button
                      key={`${option.token}-${option.network}`}
                      onClick={() => {
                        setPaymentToken(option.token)
                        setPaymentNetwork(option.network)
                      }}
                      className={`p-3 border rounded-lg text-left transition-all ${paymentToken === option.token && paymentNetwork === option.network
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{option.icon}</span>
                        <div>
                          <p className="font-medium text-sm">{option.name}</p>
                          <p className="text-xs text-gray-500">{option.network}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity and Discounts */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="input-field w-24"
                  />
                  {quantity >= 5 && (
                    <p className="text-sm text-green-600 mt-1">
                      Bulk discount available (15% off)
                    </p>
                  )}
                </div>

                {selectedLicense === 'academic' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={academicDiscount}
                      onChange={(e) => setAcademicDiscount(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      Apply academic discount (20% off)
                    </span>
                  </label>
                )}

                {quantity >= 5 && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={bulkDiscount}
                      onChange={(e) => setBulkDiscount(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">
                      Apply bulk discount (15% off for 5+ licenses)
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-6">
              {/* Dataset Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Dataset Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Title:</span>
                    <span className="font-medium text-right">{dataset.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Category:</span>
                    <span className="font-medium">{MarketplaceService.getCategoryDisplayName(dataset.category)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Language:</span>
                    <span className="font-medium">{dataset.language}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Size:</span>
                    <span className="font-medium">{dataset.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Samples:</span>
                    <span className="font-medium">{dataset.sampleCount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Quality Score:</span>
                    <span className="font-medium">{dataset.qualityScore}%</span>
                  </div>
                </div>
              </div>

              {/* License Summary */}
              {selectedLicenseType && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">License Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">License Type:</span>
                      <span className="font-medium">{selectedLicenseType.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quantity:</span>
                      <span className="font-medium">{quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Payment Method:</span>
                      <span className="font-medium">{paymentToken} ({paymentNetwork})</span>
                    </div>
                    {academicDiscount && (
                      <div className="flex justify-between text-green-600">
                        <span>Academic Discount:</span>
                        <span className="font-medium">-20%</span>
                      </div>
                    )}
                    {bulkDiscount && (
                      <div className="flex justify-between text-green-600">
                        <span>Bulk Discount:</span>
                        <span className="font-medium">-15%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Cost Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">Cost Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Base Price:</span>
                    <span className="font-medium">${dataset.price.usdEquivalent.toFixed(2)}</span>
                  </div>
                  {selectedLicenseType && selectedLicenseType.priceMultiplier !== 1.0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">License Multiplier:</span>
                      <span className="font-medium">{Math.round(selectedLicenseType.priceMultiplier * 100)}%</span>
                    </div>
                  )}
                  {quantity > 1 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Quantity:</span>
                      <span className="font-medium">×{quantity}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-200 pt-2 mt-2">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-900">Total (USD):</span>
                      <span className="font-bold text-lg text-gray-900">${estimatedCost.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Terms and Conditions */}
              <div className="space-y-3">
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                  />
                  <span className="text-sm text-gray-700">
                    I agree to the{' '}
                    <a href="#" className="text-blue-600 hover:underline">
                      Terms of Service
                    </a>{' '}
                    and{' '}
                    <a href="#" className="text-blue-600 hover:underline">
                      License Agreement
                    </a>
                  </span>
                </label>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-medium mb-1">Important Notice</p>
                      <p>
                        This purchase will be processed on the blockchain.
                        Transaction fees may apply. Please ensure you have sufficient
                        balance in your wallet.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4" />
              Secure blockchain transaction
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="btn-secondary"
              disabled={isPurchasing}
            >
              Cancel
            </button>
            <button
              onClick={handlePurchase}
              disabled={!agreedToTerms || isPurchasing || !isAuthenticated}
              className="btn-primary flex items-center gap-2"
            >
              {isPurchasing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  Purchase License
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}