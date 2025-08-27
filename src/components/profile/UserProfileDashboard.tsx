// Enhanced secure user profile dashboard component with mobile responsiveness

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { userProfileService, UserStatistics, RewardHistoryItem, ActivityItem } from '../../services/userProfileService'
import { ProfileStatistics } from './ProfileStatistics'
import { RewardHistory } from './RewardHistory'
import { ActivityFeed } from './ActivityFeed'
import { PayoutPreferences } from './PayoutPreferences'
import { PrivacySettings } from './PrivacySettings'
import { auditService } from '../../services/auditService'

type TabType = 'overview' | 'rewards' | 'activity' | 'settings'

export function UserProfileDashboard() {
  const { user, isAuthenticated } = useAuth()
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [statistics, setStatistics] = useState<UserStatistics | null>(null)
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryItem[]>([])
  const [activityHistory, setActivityHistory] = useState<ActivityItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated && user) {
      loadProfileData()
      // Log profile access for security audit
      auditService.logActivity({
        action: 'profile_access',
        details: { userId: user.address },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      }).catch(console.error)
    }
  }, [isAuthenticated, user])

  const loadProfileData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Secure parallel data loading with error isolation
      const [statsResult, rewardsResult, activitiesResult] = await Promise.allSettled([
        userProfileService.fetchUserStatistics(),
        userProfileService.fetchRewardHistory(),
        userProfileService.fetchActivityHistory()
      ])

      // Handle statistics
      if (statsResult.status === 'fulfilled') {
        setStatistics(statsResult.value)
      } else {
        console.error('Failed to load statistics:', statsResult.reason)
      }

      // Handle rewards
      if (rewardsResult.status === 'fulfilled') {
        setRewardHistory(rewardsResult.value.rewards)
      } else {
        console.error('Failed to load rewards:', rewardsResult.reason)
      }

      // Handle activities
      if (activitiesResult.status === 'fulfilled') {
        setActivityHistory(activitiesResult.value.activities)
      } else {
        console.error('Failed to load activities:', activitiesResult.reason)
      }

      // Only show error if all requests failed
      const allFailed = [statsResult, rewardsResult, activitiesResult].every(
        result => result.status === 'rejected'
      )

      if (allFailed) {
        setError('Failed to load profile data. Please try again.')
      }
    } catch (error) {
      console.error('Error loading profile data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load profile data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'rewards', label: 'Rewards', icon: '💰' },
    { id: 'activity', label: 'Activity', icon: '📈' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ]

  if (!isAuthenticated || !user) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Authentication Required</h3>
          <p className="text-gray-600">Please connect your wallet to view your profile.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
      {/* Mobile-First Responsive Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="text-center sm:text-left">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Profile</h1>
            <p className="text-gray-600 mt-1 text-sm sm:text-base">
              Manage your account, view statistics, and configure preferences
            </p>
          </div>

          {/* Mobile-optimized user info */}
          <div className="flex items-center justify-center sm:justify-end space-x-3 sm:space-x-4">
            <div className="text-center sm:text-right">
              <div className="text-xs sm:text-sm text-gray-500">Wallet Address</div>
              <div className="font-mono text-xs sm:text-sm font-medium">{formatAddress(user.address)}</div>
              <button
                onClick={() => navigator.clipboard.writeText(user.address)}
                className="text-xs text-blue-600 hover:text-blue-800 transition-colors mt-1"
              >
                Copy Full Address
              </button>
            </div>
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm sm:text-lg">
                {user.address.slice(2, 4).toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Mobile-First Quick Stats */}
      {user && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="ml-2 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Reputation</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{user.reputation}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-2 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Earned</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">
                  {formatNumber(user.statistics.totalEarned)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-2 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Contributions</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{user.statistics.contributionsCount}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <div className="flex items-center">
              <div className="p-1.5 sm:p-2 bg-orange-100 rounded-lg">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div className="ml-2 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Validations</p>
                <p className="text-lg sm:text-2xl font-semibold text-gray-900">{user.statistics.validationsCount}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile-First Navigation Tabs */}
      <div className="bg-white rounded-lg shadow-md mb-4 sm:mb-6">
        <div className="border-b border-gray-200">
          {/* Mobile: Horizontal scroll tabs */}
          <nav className="flex overflow-x-auto px-4 sm:px-6 scrollbar-hide" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as TabType)
                  // Log tab navigation for analytics
                  auditService.logActivity({
                    action: 'profile_tab_navigation',
                    details: { tab: tab.id },
                    timestamp: new Date(),
                    userAgent: navigator.userAgent,
                    ipAddress: 'client-side'
                  }).catch(console.error)
                }}
                className={`py-3 sm:py-4 px-3 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  } transition-colors`}
              >
                <span className="mr-1 sm:mr-2 text-sm sm:text-base">{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Mobile-Optimized Tab Content */}
        <div className="p-4 sm:p-6">
          {isLoading ? (
            <div className="text-center py-8 sm:py-12">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 text-sm sm:text-base">Loading profile data...</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && statistics && (
                <ProfileStatistics
                  statistics={statistics}
                  recentRewards={rewardHistory.slice(0, 5)}
                  recentActivity={activityHistory.slice(0, 10)}
                />
              )}

              {activeTab === 'rewards' && (
                <RewardHistory
                  rewards={rewardHistory}
                  onLoadMore={() => {
                    // Secure load more with audit logging
                    auditService.logActivity({
                      action: 'profile_load_more_rewards',
                      details: { currentCount: rewardHistory.length },
                      timestamp: new Date(),
                      userAgent: navigator.userAgent,
                      ipAddress: 'client-side'
                    }).catch(console.error)

                    userProfileService.fetchRewardHistory(undefined, 50, rewardHistory.length)
                      .then(result => setRewardHistory(prev => [...prev, ...result.rewards]))
                      .catch(console.error)
                  }}
                />
              )}

              {activeTab === 'activity' && (
                <ActivityFeed
                  activities={activityHistory}
                  onLoadMore={() => {
                    // Secure load more with audit logging
                    auditService.logActivity({
                      action: 'profile_load_more_activities',
                      details: { currentCount: activityHistory.length },
                      timestamp: new Date(),
                      userAgent: navigator.userAgent,
                      ipAddress: 'client-side'
                    }).catch(console.error)

                    userProfileService.fetchActivityHistory(undefined, 50, activityHistory.length)
                      .then(result => setActivityHistory(prev => [...prev, ...result.activities]))
                      .catch(console.error)
                  }}
                />
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6 sm:space-y-8">
                  <PayoutPreferences
                    currentPreferences={user?.preferences}
                    onUpdate={loadProfileData}
                  />
                  <PrivacySettings
                    onUpdate={loadProfileData}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}