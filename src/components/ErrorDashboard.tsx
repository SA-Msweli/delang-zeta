/**
 * Error Dashboard Component
 * Displays error analytics, patterns, and system health
 */

import React, { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, TrendingDown, Activity, Users, Clock, RefreshCw } from 'lucide-react'
import { ErrorAnalyticsService } from '../services/errorAnalytics'
import { ErrorHandlingService, ErrorSeverity } from '../services/errorHandling'
import { NetworkRecoveryService } from '../services/networkRecovery'
import { TransactionRetryService } from '../services/transactionRetry'

export function ErrorDashboard() {
  const [systemHealth, setSystemHealth] = useState(ErrorAnalyticsService.getSystemHealth())
  const [errorPatterns, setErrorPatterns] = useState(ErrorAnalyticsService.getErrorPatterns(10))
  const [insights, setInsights] = useState(ErrorAnalyticsService.getInsights(5))
  const [trends, setTrends] = useState(ErrorAnalyticsService.getErrorTrends(12))
  const [errorStats, setErrorStats] = useState(ErrorHandlingService.getErrorStats())
  const [networkStats, setNetworkStats] = useState(NetworkRecoveryService.getRecoveryStats())
  const [transactionStats, setTransactionStats] = useState(TransactionRetryService.getRetryStats())

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemHealth(ErrorAnalyticsService.getSystemHealth())
      setErrorPatterns(ErrorAnalyticsService.getErrorPatterns(10))
      setInsights(ErrorAnalyticsService.getInsights(5))
      setTrends(ErrorAnalyticsService.getErrorTrends(12))
      setErrorStats(ErrorHandlingService.getErrorStats())
      setNetworkStats(NetworkRecoveryService.getRecoveryStats())
      setTransactionStats(TransactionRetryService.getRetryStats())
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const getHealthColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50'
    if (score >= 70) return 'text-yellow-600 bg-yellow-50'
    if (score >= 50) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      default: return 'text-blue-600 bg-blue-50 border-blue-200'
    }
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Activity className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Error Analytics Dashboard</h1>
            <p className="text-gray-600">Monitor system health and error patterns</p>
          </div>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">System Health</p>
              <p className={`text-2xl font-bold ${getHealthColor(systemHealth.overallScore)}`}>
                {systemHealth.overallScore.toFixed(0)}%
              </p>
            </div>
            <Activity className="h-8 w-8 text-gray-400" />
          </div>
          <div className="mt-2">
            {systemHealth.trends.improving && (
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp className="h-4 w-4 mr-1" />
                Improving
              </div>
            )}
            {systemHealth.trends.degrading && (
              <div className="flex items-center text-red-600 text-sm">
                <TrendingDown className="h-4 w-4 mr-1" />
                Degrading
              </div>
            )}
            {systemHealth.trends.stable && (
              <div className="flex items-center text-gray-600 text-sm">
                <Activity className="h-4 w-4 mr-1" />
                Stable
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Error Rate</p>
              <p className="text-2xl font-bold text-gray-900">{systemHealth.errorRate}/hr</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {systemHealth.criticalErrors} critical errors
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Network Recovery</p>
              <p className="text-2xl font-bold text-gray-900">{networkStats.recoveryAttempts}</p>
            </div>
            <RefreshCw className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {networkStats.queuedRequests} queued requests
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Transaction Retries</p>
              <p className="text-2xl font-bold text-gray-900">{transactionStats.totalRetries}</p>
            </div>
            <Clock className="h-8 w-8 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {transactionStats.successfulRetries} successful
          </p>
        </div>
      </div>

      {/* Active Alerts */}
      {systemHealth.alerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-800">Active Alerts</h2>
          </div>
          <div className="space-y-2">
            {systemHealth.alerts.map((alert, index) => (
              <div key={index} className="bg-white p-3 rounded border text-red-800">
                {alert}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Insights</h3>
          <div className="space-y-4">
            {insights.map((insight) => (
              <div key={insight.title} className={`p-4 rounded-lg border ${getSeverityColor(insight.severity)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium">{insight.title}</h4>
                    <p className="text-sm mt-1">{insight.description}</p>
                    {insight.recommendations.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium">Recommendations:</p>
                        <ul className="text-xs mt-1 space-y-1">
                          {insight.recommendations.slice(0, 2).map((rec, index) => (
                            <li key={index}>• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(insight.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Patterns and Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error Patterns */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Error Patterns</h3>
          <div className="space-y-3">
            {errorPatterns.slice(0, 5).map((pattern) => (
              <div key={pattern.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {pattern.pattern.substring(0, 60)}...
                  </p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-xs text-gray-500">
                      {pattern.frequency} occurrences
                    </span>
                    <span className="text-xs text-gray-500">
                      {pattern.affectedUsers.size} users
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${getSeverityColor(pattern.severity)}`}>
                      {pattern.severity}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Statistics */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Statistics</h3>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">By Severity</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Critical</span>
                  <span className="text-sm font-medium text-red-600">
                    {errorStats.errorsBySeverity.critical || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">High</span>
                  <span className="text-sm font-medium text-orange-600">
                    {errorStats.errorsBySeverity.high || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Medium</span>
                  <span className="text-sm font-medium text-yellow-600">
                    {errorStats.errorsBySeverity.medium || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Low</span>
                  <span className="text-sm font-medium text-blue-600">
                    {errorStats.errorsBySeverity.low || 0}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Resolution Status</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Errors</span>
                  <span className="text-sm font-medium text-gray-900">
                    {errorStats.totalErrors}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Resolved</span>
                  <span className="text-sm font-medium text-green-600">
                    {errorStats.resolvedErrors}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Retryable</span>
                  <span className="text-sm font-medium text-blue-600">
                    {errorStats.retryableErrors}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Trends Chart */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Error Trends (Last 12 Hours)</h3>
        <div className="h-64 flex items-end space-x-2">
          {trends.map((trend, index) => {
            const maxErrors = Math.max(...trends.map(t => t.errorCount))
            const height = maxErrors > 0 ? (trend.errorCount / maxErrors) * 100 : 0

            return (
              <div key={trend.period} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0px' }}
                  title={`${trend.errorCount} errors`}
                />
                <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-left">
                  {new Date(trend.period).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Transaction Retry Details */}
      {transactionStats.totalRetries > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Retry Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{transactionStats.totalRetries}</div>
              <div className="text-sm text-gray-600">Total Retries</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{transactionStats.successfulRetries}</div>
              <div className="text-sm text-gray-600">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{transactionStats.failedRetries}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{transactionStats.pendingRetries}</div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Average attempts per transaction: {transactionStats.averageAttempts.toFixed(1)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}