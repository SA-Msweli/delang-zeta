// Enhanced profile statistics component with mobile responsiveness and security

import { useState } from 'react'
import { UserStatistics, RewardHistoryItem, ActivityItem } from '../../services/userProfileService'
import { auditService } from '../../services/auditService'

interface ProfileStatisticsProps {
  statistics: UserStatistics
  recentRewards: RewardHistoryItem[]
  recentActivity: ActivityItem[]
}

export function ProfileStatistics({ statistics, recentRewards, recentActivity }: ProfileStatisticsProps) {
  const [showSensitiveData, setShowSensitiveData] = useState(false)

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  const handleSensitiveDataToggle = () => {
    setShowSensitiveData(!showSensitiveData)
    // Log sensitive data access for security audit
    auditService.logActivity({
      action: 'profile_sensitive_data_toggle',
      details: { revealed: !showSensitiveData },
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      ipAddress: 'client-side'
    }).catch(console.error)
  }

  const formatCurrency = (amount: string, token: string) => {
    return `${formatNumber(amount)} ${token}`
  }

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'contribution':
        return (
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
        )
      case 'validation':
        return (
          <div className="p-2 bg-green-100 rounded-lg">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
            </svg>
          </div>
        )
      case 'governance':
        return (
          <div className="p-2 bg-purple-100 rounded-lg">
            <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
        )
      case 'reward':
        return (
          <div className="p-2 bg-yellow-100 rounded-lg">
            <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="p-2 bg-gray-100 rounded-lg">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
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

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Performance Overview - Mobile First */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Performance Overview</h3>
          <button
            onClick={handleSensitiveDataToggle}
            className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center"
          >
            {showSensitiveData ? (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
                Hide Details
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Show Details
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 sm:p-6 rounded-lg hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-blue-600 truncate">Average Quality Score</p>
                <p className="text-xl sm:text-3xl font-bold text-blue-900">
                  {showSensitiveData ? (statistics.averageQuality * 100).toFixed(1) : '••.•'}%
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-blue-200 rounded-full flex-shrink-0 ml-2">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 sm:p-6 rounded-lg hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-green-600 truncate">Total Contributions</p>
                <p className="text-xl sm:text-3xl font-bold text-green-900">
                  {showSensitiveData ? statistics.contributionsCount : '•••'}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-green-200 rounded-full flex-shrink-0 ml-2">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 sm:p-6 rounded-lg hover:shadow-md transition-shadow sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-purple-600 truncate">Total Validations</p>
                <p className="text-xl sm:text-3xl font-bold text-purple-900">
                  {showSensitiveData ? statistics.validationsCount : '•••'}
                </p>
              </div>
              <div className="p-2 sm:p-3 bg-purple-200 rounded-full flex-shrink-0 ml-2">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Rewards - Mobile Optimized */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Rewards</h3>
          <button className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors">
            View All →
          </button>
        </div>

        {recentRewards.length === 0 ? (
          <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <p className="text-gray-600 text-sm sm:text-base">No rewards yet</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Start contributing data to earn rewards</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {recentRewards.map((reward) => (
              <div key={reward.id} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                  <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">
                      {showSensitiveData ? formatCurrency(reward.amount, reward.token) : '••.•• ' + reward.token}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-600 truncate">
                      {reward.type.charAt(0).toUpperCase() + reward.type.slice(1)} • {reward.network}
                    </p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(reward.status)}`}>
                    {reward.status.charAt(0).toUpperCase() + reward.status.slice(1)}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    {reward.timestamp.toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity - Mobile Optimized */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Activity</h3>
          <button className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors">
            View All →
          </button>
        </div>

        {recentActivity.length === 0 ? (
          <div className="text-center py-6 sm:py-8 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-600 text-sm sm:text-base">No recent activity</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Your activity will appear here</p>
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-2 sm:space-x-3 p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                {getActivityIcon(activity.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 line-clamp-2">{activity.description}</p>
                  <div className="flex items-center justify-between mt-1 gap-2">
                    <p className="text-xs text-gray-500 truncate">
                      {activity.timestamp.toLocaleDateString()} {activity.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getStatusColor(activity.status)}`}>
                      {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reputation History Chart - Mobile Responsive */}
      <div>
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Reputation Trend</h3>
        <div className="bg-gray-50 rounded-lg p-6 sm:p-8 text-center">
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <p className="text-gray-600 mb-2 text-sm sm:text-base">Reputation Chart</p>
          <p className="text-xs sm:text-sm text-gray-500">
            Interactive chart showing reputation changes over time will be displayed here
          </p>
          {statistics.reputationHistory && statistics.reputationHistory.length > 0 && (
            <div className="mt-4 text-xs text-gray-600">
              Last updated: {new Date(statistics.reputationHistory[0]?.timestamp || Date.now()).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}