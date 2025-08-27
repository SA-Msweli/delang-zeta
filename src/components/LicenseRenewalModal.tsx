import { useState, useEffect } from 'react'
import {
  X,
  RefreshCw,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Wallet
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useMarketplace } from '../hooks/useMarketplace'
// import { MarketplaceService } from '../services/marketplaceService'
import type { UserLicense, DatasetPurchaseRequest } from '../types/dataset'

interface LicenseRenewalModalProps {
  license: UserLicense
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function LicenseRenewalModal({
  license,
  isOpen,
  onClose,
  onSuccess
}: LicenseRenewalModalProps) {
  const { purchaseDataset, isPurchasing } = useMarketplace()

  const [renewalPeriod, setRenewalPeriod] = useState<'1month' | '3months' | '6months' | '1year'>('3months')
  const [paymentToken, setPaymentToken] = useState('ETH')
  const [paymentNetwork, setPaymentNetwork] = useState('ethereum')
  const [autoRenewal, setAutoRenewal] = useState(false)
  const [estimatedCost, setEstimatedCost] = useState<number>(0)
  const [discount, setDiscount] = useState<number>(0)

  const renewalOptions = [
    { value: '1month', label: '1 Month', multiplier: 0.1, discount: 0 },
    { value: '3months', label: '3 Months', multiplier: 0.25, discount: 5 },
    { value: '6months', label: '6 Months', multiplier: 0.45, discount: 10 },
    { value: '1year', label: '1 Year', multiplier: 0.8, discount: 20 }
  ]

  const paymentOptions = [
    { token: 'ETH', network: 'ethereum', name: 'Ethereum (ETH)', icon: '⟠' },
    { token: 'BTC', network: 'bitcoin', name: 'Bitcoin (BTC)', icon: '₿' },
    { token: 'USDC', network: 'ethereum', name: 'USD Coin (USDC)', icon: '$' },
    { token: 'USDC', network: 'polygon', name: 'USDC (Polygon)', icon: '$' },
    { token: 'ZETA', network: 'zetachain', name: 'ZetaChain (ZETA)', icon: 'Z' }
  ]

  useEffect(() => {
    calculateRenewalCost()
  }, [renewalPeriod, autoRenewal])

  const calculateRenewalCost = () => {
    const selectedOption = renewalOptions.find(opt => opt.value === renewalPeriod)
    if (!selectedOption) return

    // Base cost from original license
    const baseCost = parseFloat(license.amount)
    let cost = baseCost * selectedOption.multiplier

    // Apply renewal discount
    let renewalDiscount = selectedOption.discount

    // Additional discount for auto-renewal
    if (autoRenewal) {
      renewalDiscount += 5
    }

    // Loyalty discount for existing customers
    renewalDiscount += 10

    const discountAmount = cost * (renewalDiscount / 100)
    cost -= discountAmount

    setEstimatedCost(cost)
    setDiscount(renewalDiscount)
  }

  const handleRenewal = async () => {
    try {
      const request: DatasetPurchaseRequest = {
        datasetId: license.datasetId,
        licenseType: license.licenseType,
        paymentToken,
        paymentNetwork,
        quantity: 1
      }

      const response = await purchaseDataset(request)
      if (response?.success) {
        toast.success('License renewed successfully!')
        onSuccess?.()
        onClose()
      }
    } catch (error: any) {
      toast.error(error.message || 'Renewal failed')
    }
  }

  const getDaysUntilExpiry = () => {
    if (!license.expiresAt) return null
    return Math.ceil((license.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  const getExpiryStatus = () => {
    const days = getDaysUntilExpiry()
    if (days === null) return { status: 'no-expiry', color: 'text-gray-600', icon: CheckCircle }
    if (days < 0) return { status: 'expired', color: 'text-red-600', icon: AlertCircle }
    if (days <= 7) return { status: 'expiring-soon', color: 'text-orange-600', icon: Clock }
    return { status: 'active', color: 'text-green-600', icon: CheckCircle }
  }

  if (!isOpen) return null

  const expiryStatus = getExpiryStatus()
  const daysUntilExpiry = getDaysUntilExpiry()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Renew License</h2>
              <p className="text-sm text-gray-500">{license.datasetTitle}</p>
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
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current License Status */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Current License Status</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">License Type:</span>
                <p className="font-medium capitalize">{license.licenseType}</p>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <div className="flex items-center gap-1">
                  <expiryStatus.icon className={`h-4 w-4 ${expiryStatus.color}`} />
                  <span className={`font-medium ${expiryStatus.color}`}>
                    {license.status === 'expired' ? 'Expired' : 'Active'}
                  </span>
                </div>
              </div>
              {license.expiresAt && (
                <>
                  <div>
                    <span className="text-gray-500">Expires:</span>
                    <p className="font-medium">{license.expiresAt.toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Time Remaining:</span>
                    <p className={`font-medium ${expiryStatus.color}`}>
                      {daysUntilExpiry !== null ? (
                        daysUntilExpiry < 0
                          ? `Expired ${Math.abs(daysUntilExpiry)} days ago`
                          : `${daysUntilExpiry} days`
                      ) : 'No expiration'}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Renewal Period Selection */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Select Renewal Period</h3>
            <div className="grid grid-cols-2 gap-3">
              {renewalOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setRenewalPeriod(option.value as any)}
                  className={`p-4 border rounded-lg text-left transition-all ${renewalPeriod === option.value
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">{option.label}</span>
                    {option.discount > 0 && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        {option.discount}% off
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {(parseFloat(license.amount) * option.multiplier).toFixed(4)} {license.token}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Payment Method</h3>
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
                      <p className="text-xs text-gray-500 capitalize">{option.network}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Auto-Renewal Option */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRenewal}
                onChange={(e) => setAutoRenewal(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
              />
              <div>
                <div className="font-medium text-blue-900">Enable Auto-Renewal</div>
                <p className="text-sm text-blue-700 mt-1">
                  Automatically renew your license before it expires. You can cancel anytime.
                  <span className="font-medium"> Additional 5% discount applied!</span>
                </p>
              </div>
            </label>
          </div>

          {/* Cost Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3">Cost Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Base renewal cost:</span>
                <span className="font-medium">
                  {(parseFloat(license.amount) * renewalOptions.find(opt => opt.value === renewalPeriod)!.multiplier).toFixed(4)} {license.token}
                </span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Total discount ({discount}%):</span>
                  <span className="font-medium">
                    -{((parseFloat(license.amount) * renewalOptions.find(opt => opt.value === renewalPeriod)!.multiplier) * (discount / 100)).toFixed(4)} {license.token}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-900">Final cost:</span>
                  <span className="font-bold text-lg text-gray-900">
                    {estimatedCost.toFixed(4)} {license.token}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Renewal Benefits</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                10% loyalty discount for existing customers
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Same license terms and permissions
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Uninterrupted access to dataset
              </li>
              {autoRenewal && (
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Additional 5% auto-renewal discount
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              New expiration: {new Date(Date.now() + (
                renewalPeriod === '1month' ? 30 :
                  renewalPeriod === '3months' ? 90 :
                    renewalPeriod === '6months' ? 180 : 365
              ) * 24 * 60 * 60 * 1000).toLocaleDateString()}
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
              onClick={handleRenewal}
              disabled={isPurchasing}
              className="btn-primary flex items-center gap-2"
            >
              {isPurchasing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  Renew License
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}