// Enhanced payout preferences component with validation and mobile responsiveness

import React, { useState, useEffect } from 'react'
import { UserProfile } from '../../types/auth'
import { SUPPORTED_NETWORKS } from '../../types/wallet'
import { userProfileService, PayoutPreferences as PayoutPrefs } from '../../services/userProfileService'
import { auditService } from '../../services/auditService'

interface PayoutPreferencesProps {
  currentPreferences?: UserProfile['preferences']
  onUpdate?: () => void
}

const SUPPORTED_TOKENS = {
  'ethereum': ['ETH', 'USDC', 'USDT', 'DAI'],
  'bitcoin': ['BTC'],
  'bsc': ['BNB', 'USDC', 'USDT', 'BUSD'],
  'polygon': ['MATIC', 'USDC', 'USDT', 'DAI'],
  'zetachain': ['ZETA', 'USDC']
}

export function PayoutPreferences({ currentPreferences, onUpdate }: PayoutPreferencesProps) {
  const [preferences, setPreferences] = useState<PayoutPrefs>({
    preferredNetwork: currentPreferences?.payoutNetwork || 'ethereum',
    preferredToken: currentPreferences?.preferredToken || 'USDC',
    autoWithdraw: false,
    minimumThreshold: '10',
    backupAddress: ''
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (currentPreferences) {
      setPreferences(prev => ({
        ...prev,
        preferredNetwork: currentPreferences.payoutNetwork,
        preferredToken: currentPreferences.preferredToken
      }))
    }
  }, [currentPreferences])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!preferences.preferredNetwork) {
      errors.preferredNetwork = 'Please select a preferred network'
    }

    if (!preferences.preferredToken) {
      errors.preferredToken = 'Please select a preferred token'
    }

    const threshold = parseFloat(preferences.minimumThreshold)
    if (isNaN(threshold) || threshold < 0) {
      errors.minimumThreshold = 'Please enter a valid minimum threshold'
    } else if (threshold < 1) {
      errors.minimumThreshold = 'Minimum threshold must be at least 1'
    }

    if (preferences.backupAddress && preferences.backupAddress.trim()) {
      // Basic address validation
      const address = preferences.backupAddress.trim()
      if (preferences.preferredNetwork === 'bitcoin') {
        // Bitcoin address validation (simplified)
        if (!address.match(/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/) &&
          !address.match(/^bc1[a-z0-9]{39,59}$/)) {
          errors.backupAddress = 'Invalid Bitcoin address format'
        }
      } else {
        // Ethereum-style address validation
        if (!address.match(/^0x[a-fA-F0-9]{40}$/)) {
          errors.backupAddress = 'Invalid address format (must be 42 characters starting with 0x)'
        }
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      setIsLoading(true)
      setError(null)
      setSuccess(false)

      // Log payout preference update attempt for security audit
      await auditService.logActivity({
        action: 'payout_preferences_update_attempt',
        details: {
          preferredNetwork: preferences.preferredNetwork,
          preferredToken: preferences.preferredToken,
          autoWithdraw: preferences.autoWithdraw,
          hasBackupAddress: !!preferences.backupAddress
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      await userProfileService.updatePayoutPreferences(preferences)

      setSuccess(true)
      onUpdate?.()

      // Log successful update
      await auditService.logActivity({
        action: 'payout_preferences_updated_success',
        details: { preferredNetwork: preferences.preferredNetwork },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      console.error('Error updating payout preferences:', error)
      setError(error instanceof Error ? error.message : 'Failed to update preferences')

      // Log failed update
      await auditService.logActivity({
        action: 'payout_preferences_update_failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleNetworkChange = (network: string) => {
    const availableTokens = SUPPORTED_TOKENS[network as keyof typeof SUPPORTED_TOKENS] || []
    const newToken = availableTokens.includes(preferences.preferredToken)
      ? preferences.preferredToken
      : availableTokens[0] || 'USDC'

    setPreferences(prev => ({
      ...prev,
      preferredNetwork: network,
      preferredToken: newToken
    }))
  }

  const availableTokens = SUPPORTED_TOKENS[preferences.preferredNetwork as keyof typeof SUPPORTED_TOKENS] || []
  const selectedNetwork = SUPPORTED_NETWORKS[parseInt(Object.keys(SUPPORTED_NETWORKS).find(chainId =>
    SUPPORTED_NETWORKS[parseInt(chainId)].name.toLowerCase().includes(preferences.preferredNetwork.toLowerCase())
  ) || '1')]

  return (
    <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
      <div className="mb-4 sm:mb-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">Payout Preferences</h3>
        <p className="text-gray-600 text-sm sm:text-base">
          Configure how and where you want to receive your rewards
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>
            <span className="text-green-800">Payout preferences updated successfully!</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Preferred Network - Mobile Optimized */}
        <div>
          <label htmlFor="preferredNetwork" className="block text-sm font-medium text-gray-700 mb-2">
            Preferred Network *
          </label>
          <select
            id="preferredNetwork"
            value={preferences.preferredNetwork}
            onChange={(e) => handleNetworkChange(e.target.value)}
            className={`w-full px-3 py-2 text-sm sm:text-base border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.preferredNetwork ? 'border-red-500' : 'border-gray-300'
              }`}
          >
            <option value="">Select Network</option>
            {Object.entries(SUPPORTED_NETWORKS).map(([chainId, network]) => (
              <option key={chainId} value={network.name.toLowerCase()}>
                {network.name} ({network.symbol})
              </option>
            ))}
          </select>
          {validationErrors.preferredNetwork && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.preferredNetwork}</p>
          )}
          {selectedNetwork && (
            <p className="mt-1 text-xs sm:text-sm text-gray-500">
              Network fees will be paid in {selectedNetwork.symbol}
            </p>
          )}
        </div>

        {/* Preferred Token */}
        <div>
          <label htmlFor="preferredToken" className="block text-sm font-medium text-gray-700 mb-2">
            Preferred Token *
          </label>
          <select
            id="preferredToken"
            value={preferences.preferredToken}
            onChange={(e) => setPreferences(prev => ({ ...prev, preferredToken: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.preferredToken ? 'border-red-500' : 'border-gray-300'
              }`}
            disabled={!preferences.preferredNetwork}
          >
            <option value="">Select Token</option>
            {availableTokens.map((token) => (
              <option key={token} value={token}>
                {token}
              </option>
            ))}
          </select>
          {validationErrors.preferredToken && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.preferredToken}</p>
          )}
        </div>

        {/* Auto Withdraw */}
        <div>
          <div className="flex items-center">
            <input
              id="autoWithdraw"
              type="checkbox"
              checked={preferences.autoWithdraw}
              onChange={(e) => setPreferences(prev => ({ ...prev, autoWithdraw: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="autoWithdraw" className="ml-2 block text-sm text-gray-900">
              Enable automatic withdrawals
            </label>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Automatically withdraw rewards when they reach the minimum threshold
          </p>
        </div>

        {/* Minimum Threshold */}
        <div>
          <label htmlFor="minimumThreshold" className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Withdrawal Threshold *
          </label>
          <div className="relative">
            <input
              type="number"
              id="minimumThreshold"
              value={preferences.minimumThreshold}
              onChange={(e) => setPreferences(prev => ({ ...prev, minimumThreshold: e.target.value }))}
              min="1"
              step="0.01"
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.minimumThreshold ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="10.00"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">{preferences.preferredToken}</span>
            </div>
          </div>
          {validationErrors.minimumThreshold && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.minimumThreshold}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Minimum amount required before automatic withdrawal (if enabled)
          </p>
        </div>

        {/* Backup Address */}
        <div>
          <label htmlFor="backupAddress" className="block text-sm font-medium text-gray-700 mb-2">
            Backup Address (Optional)
          </label>
          <input
            type="text"
            id="backupAddress"
            value={preferences.backupAddress}
            onChange={(e) => setPreferences(prev => ({ ...prev, backupAddress: e.target.value }))}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${validationErrors.backupAddress ? 'border-red-500' : 'border-gray-300'
              }`}
            placeholder={preferences.preferredNetwork === 'bitcoin' ? 'bc1...' : '0x...'}
          />
          {validationErrors.backupAddress && (
            <p className="mt-1 text-sm text-red-600">{validationErrors.backupAddress}</p>
          )}
          <p className="mt-1 text-sm text-gray-500">
            Alternative address for receiving payments if primary wallet is unavailable
          </p>
        </div>

        {/* Security Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <svg className="w-5 h-5 text-yellow-400 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <h4 className="text-sm font-medium text-yellow-800">Security Notice</h4>
              <p className="text-sm text-yellow-700 mt-1">
                Double-check all addresses before saving. Incorrect addresses may result in permanent loss of funds.
                We recommend testing with small amounts first.
              </p>
            </div>
          </div>
        </div>

        {/* Mobile-Optimized Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
          >
            {isLoading ? 'Updating...' : 'Update Preferences'}
          </button>
        </div>
      </form>
    </div>
  )
}