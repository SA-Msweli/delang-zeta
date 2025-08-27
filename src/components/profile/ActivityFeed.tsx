// Activity feed component

import { useState } from 'react'
import { ActivityItem } from '../../services/userProfileService'

interface ActivityFeedProps {
  activities: ActivityItem[]
  onLoadMore?: () => void
}

export function ActivityFeed({ activities, onLoadMore }: ActivityFeedProps) {
  const [filter, setFilter] = useState<ActivityItem['type'] | 'all'>('all')

  const getActivityIcon = (type: ActivityItem['type']) => {
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
      case 'reward':
        return (
          <div className="p-2 bg-yellow-100 rounded-lg">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
        )
      default:
        return (
          <div className="p-2 bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        )
    }
  }

  const getStatusColor = (status: ActivityItem['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100'
      case 'pending':
        return 'text-yellow-600 bg-yellow-100'
      case 'failed':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeColor = (type: ActivityItem['type']) => {
    switch (type) {
      case 'contribution':
        return 'text-blue-600 bg-blue-100'
      case 'validation':
        return 'text-green-600 bg-green-100'
      case 'governance':
        return 'text-purple-600 bg-purple-100'
      case 'reward':
        return 'text-yellow-600 bg-yellow-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const filteredActivities = filter === 'all'
    ? activities
    : activities.filter(activity => activity.type === filter)

  const groupedActivities = filteredActivities.reduce((groups, activity) => {
    const date = activity.timestamp.toDateString()
    if (!groups[date]) {
      groups[date] = []
    }
    groups[date].push(activity)
    return groups
  }, {} as Record<string, ActivityItem[]>)

  const activityCounts = activities.reduce((counts, activity) => {
    counts[activity.type] = (counts[activity.type] || 0) + 1
    return counts
  }, {} as Record<ActivityItem['type'], number>)

  return (
    <div className="space-y-6">
      {/* Activity Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg mr-3">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600">Contributions</p>
              <p className="text-xl font-semibold text-blue-900">{activityCounts.contribution || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg mr-3">
              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-green-600">Validations</p>
              <p className="text-xl font-semibold text-green-900">{activityCounts.validation || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg mr-3">
              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-purple-600">Governance</p>
              <p className="text-xl font-semibold text-purple-900">{activityCounts.governance || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg mr-3">
              <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-600">Rewards</p>
              <p className="text-xl font-semibold text-yellow-900">{activityCounts.reward || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === 'all'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          All Activities ({activities.length})
        </button>
        <button
          onClick={() => setFilter('contribution')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === 'contribution'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          Contributions ({activityCounts.contribution || 0})
        </button>
        <button
          onClick={() => setFilter('validation')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === 'validation'
            ? 'bg-green-100 text-green-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          Validations ({activityCounts.validation || 0})
        </button>
        <button
          onClick={() => setFilter('governance')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === 'governance'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          Governance ({activityCounts.governance || 0})
        </button>
        <button
          onClick={() => setFilter('reward')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${filter === 'reward'
            ? 'bg-yellow-100 text-yellow-800'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
        >
          Rewards ({activityCounts.reward || 0})
        </button>
      </div>

      {/* Activity Feed */}
      {filteredActivities.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {filter === 'all' ? 'No activity yet' : `No ${filter} activities`}
          </h3>
          <p className="text-gray-600">
            {filter === 'all'
              ? 'Your activity will appear here as you use the platform'
              : `Start ${filter === 'governance' ? 'participating in governance' : `${filter}ing`} to see activities here`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([date, dayActivities]) => (
            <div key={date}>
              <h4 className="text-sm font-medium text-gray-500 mb-3 sticky top-0 bg-white py-2">
                {new Date(date).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </h4>

              <div className="space-y-3">
                {dayActivities.map((activity) => (
                  <div key={activity.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start space-x-3">
                      {getActivityIcon(activity.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 mb-1">
                              {activity.description}
                            </p>
                            <div className="flex items-center space-x-2 mb-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(activity.type)}`}>
                                {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                              </span>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                                {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                              </span>
                            </div>
                            {activity.metadata && (
                              <div className="text-xs text-gray-500">
                                {Object.entries(activity.metadata).map(([key, value]) => (
                                  <span key={key} className="mr-3">
                                    {key}: {String(value)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="text-right text-xs text-gray-500 ml-4">
                            {activity.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {filteredActivities.length > 0 && filteredActivities.length % 50 === 0 && onLoadMore && (
        <div className="text-center">
          <button
            onClick={onLoadMore}
            className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 transition-colors"
          >
            Load More Activities
          </button>
        </div>
      )}
    </div>
  )
}