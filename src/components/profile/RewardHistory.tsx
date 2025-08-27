// Enhanced reward history component with transaction verification and mobile responsiveness

import { useState } from 'react'
import { RewardHistoryItem, userProfileService } from '../../services/userProfileService'
import { auditService } from '../../services/auditService'

interface RewardHistoryProps {
  rewards: RewardHistoryItem[]
  onLoadMore?: () => void
}

export function RewardHistory({ rewards, onLoadMore }: RewardHistoryProps) {
  const [verifyingTx, setVerifyingTx] = useState<string | null>(null)
  const [verificationResults, setVerificationResults] = useState<Record<string, boolean>>({})
  const [showSensitiveData, setShowSensitiveData] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'contribution' | 'validation' | 'governance'>('all')

  const formatCurrency = (amount: string, token: string) => {
    const num = parseFloat(amount)
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M ${token}`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K ${token}`
    return `${num.toFixed(4)} ${token}`
  }

  const handleSensitiveDataToggle = () => {
    setShowSensitiveData(!showSensitiveData)
    // Log sensitive data access for security audit
    auditService.logActivity({
      action: 'reward_history_sensitive_data_toggle',
      details: { revealed: !showSensitiveData },
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      ipAddress: 'client-side'
    }).catch(console.error)
  }

  const getStatusColor = (status: RewardHistoryItem['status']) => {
    switch (status) {
      case 'confirmed':
        return 'text-green-600 bg-green-100'
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeIcon = (type: RewardHistoryItem['type']) => {
    switch (type) {
      case 'contribution':
        return (
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        )
      case 'validation':
        return (
          <div className="p-2 bg-green-100 rounded-lg">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>
          </div>
        )
      case 'governance':
        return (
          <div className="p-2 bg-purple-100 rounded-lg">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="p-2 bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
        )
    }
  }

  const handleVerifyTransaction = async (reward: RewardHistoryItem) => {
    if (reward.status !== 'confirmed' || !reward.transactionHash) return

    try {
      setVerifyingTx(reward.id)

      // Log transaction verification attempt for security audit
      await auditService.logActivity({
        action: 'transaction_verification_attempt',
        details: {
          rewardId: reward.id,
          transactionHash: reward.transactionHash,
          network: reward.network
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      const isVerified = await userProfileService.verifyTransaction(
        reward.transactionHash,
        reward.network
      )

      setVerificationResults(prev => ({
        ...prev,
        [reward.id]: isVerified
      }))

      // Log verification result
      await auditService.logActivity({
        action: 'transaction_verification_result',
        details: {
          rewardId: reward.id,
          verified: isVerified
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })
    } catch (error) {
      console.error('Error verifying transaction:', error)
      setVerificationResults(prev => ({
        ...prev,
        [reward.id]: false
      }))
    } finally {
      setVerifyingTx(null)
    }
  }

  const getBlockExplorerUrl = (txHash: string, network: string) => {
    const explorers: Record<string, string> = {
      'ethereum': 'https://etherscan.io/tx/',
      'bitcoin': 'https://blockstream.info/tx/',
      'bsc': 'https://bscscan.com/tx/',
      'polygon': 'https://polygonscan.com/tx/',
      'zetachain': 'https://explorer.zetachain.com/tx/'
    }

    const baseUrl = explorers[network.toLowerCase()]
    return baseUrl ? `${baseUrl}${txHash}` : null
  }

  const filteredRewards = selectedFilter === 'all'
    ? rewards
    : rewards.filter(reward => reward.type === selectedFilter)

  const totalEarned = filteredRewards.reduce((sum, reward) => {
    if (reward.status === 'confirmed') {
      return sum + parseFloat(reward.amount)
    }
    return sum
  }, 0)

  const groupedRewards = filteredRewards.reduce((groups, reward) => {
    const date = reward.timestamp.toDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(reward)
    return groups
  }, {} as Record<string, RewardHistoryItem[]>)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Mobile-First Summary */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 sm:p-6 rounded-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="text-center sm:text-left">
            <div className="flex items-center justify-between sm:justify-start sm:gap-4 mb-2">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Total Rewards Earned</h3>
              <button
                onClick={handleSensitiveDataToggle}
                className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center"
              >
                {showSensitiveData ? (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                    <span className="hidden sm:inline">Hide</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span className="hidden sm:inline">Show</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-green-600">
              {showSensitiveData ? formatCurrency(totalEarned.toString(), 'TOKENS') : '••••.•• TOKENS'}
            </p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-sm text-gray-600">Total Transactions</p>
            <p className="text-xl sm:text-2xl font-semibold text-gray-900">
              {showSensitiveData ? filteredRewards.length : '•••'}
            </p>
          </div>
        </div>
      </div>

      {/* Mobile-Optimized Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${selectedFilter === 'all'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          All Types ({rewards.length})
        </button>
        <button
          onClick={() => setSelectedFilter('contribution')}
          className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${selectedFilter === 'contribution'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          Contributions ({rewards.filter(r => r.type === 'contribution').length})
        </button>
        <button
          onClick={() => setSelectedFilter('validation')}
          className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${selectedFilter === 'validation'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          Validations ({rewards.filter(r => r.type === 'validation').length})
        </button>
        <button
          onClick={() => setSelectedFilter('governance')}
          className={`px-3 py-1 rounded-full text-xs sm:text-sm font-medium transition-colors ${selectedFilter === 'governance'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          Governance ({rewards.filter(r => r.type === 'governance').length})
        </button>
      </div>

      {/* Mobile-Optimized Reward History */}
      {filteredRewards.length === 0 ? (
        <div className="text-center py-8 sm:py-12 bg-gray-50 rounded-lg">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
            {selectedFilter === 'all' ? 'No rewards yet' : `No ${selectedFilter} rewards`}
          </h3>
          <p className="text-gray-600 text-sm sm:text-base">
            {selectedFilter === 'all'
              ? 'Start contributing data to earn your first rewards'
              : `Start ${selectedFilter === 'governance' ? 'participating in governance' : `${selectedFilter}ing`} to earn rewards`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {Object.entries(groupedRewards).map(([date, dayRewards]) => (
            <div key={date}>
              <h4 className="text-xs sm:text-sm font-medium text-gray-500 mb-2 sm:mb-3 sticky top-0 bg-white py-2">
                {new Date(date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h4>

              <div className="space-y-2 sm:space-y-3">
                {dayRewards.map((reward) => (
                  <div key={reward.id} className="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start space-x-2 sm:space-x-3 min-w-0 flex-1">
                        {getTypeIcon(reward.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                              {showSensitiveData ? formatCurrency(reward.amount, reward.token) : '••.•• ' + reward.token}
                            </p>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(reward.status)}`}>
                              {reward.status.charAt(0).toUpperCase() + reward.status.slice(1)}
                            </span>
                          </div>

                          <p className="text-xs sm:text-sm text-gray-600 mb-2 truncate">
                            {reward.type.charAt(0).toUpperCase() + reward.type.slice(1)} reward on {reward.network}
                          </p>

                          {reward.taskId && (
                            <p className="text-xs text-gray-500 mb-2 truncate">
                              Task: {reward.taskId}
                            </p>
                          )}

                          {reward.transactionHash && showSensitiveData && (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <p className="text-gray-500 font-mono">
                                {reward.transactionHash.slice(0, 6)}...{reward.transactionHash.slice(-4)}
                              </p>

                              {getBlockExplorerUrl(reward.transactionHash, reward.network) && (
                                <a
                                  href={getBlockExplorerUrl(reward.transactionHash, reward.network)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  Explorer ↗
                                </a>
                              )}

                              {reward.status === 'confirmed' && (
                                <button
                                  onClick={() => handleVerifyTransaction(reward)}
                                  disabled={verifyingTx === reward.id}
                                  className="text-green-600 hover:text-green-800 transition-colors disabled:text-gray-400"
                                >
                                  {verifyingTx === reward.id ? 'Verifying...' : 'Verify'}
                                </button>
                              )}

                              {verificationResults[reward.id] !== undefined && (
                                <span className={`${verificationResults[reward.id] ? 'text-green-600' : 'text-red-600'}`}>
                                  {verificationResults[reward.id] ? '✓ Verified' : '✗ Failed'}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right text-xs text-gray-500 flex-shrink-0">
                        {reward.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Mobile-Optimized Load More */}
      {filteredRewards.length > 0 && filteredRewards.length % 50 === 0 && onLoadMore && (
        <div className="text-center">
          <button
            onClick={onLoadMore}
            className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors text-sm sm:text-base"
          >
            Load More Rewards
          </button>
        </div>
      )}
    </div>
  )
}