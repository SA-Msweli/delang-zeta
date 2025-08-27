/**
 * Security Dashboard Component
 * Displays security metrics, alerts, and vulnerability status
 */

import React, { useState, useEffect } from 'react'
import { Shield, AlertTriangle, Activity, Eye, Lock, Zap } from 'lucide-react'
import { SecurityMonitoringService, SecuritySeverity } from '../services/securityMonitoring'
import { DDoSProtectionService } from '../services/ddosProtection'
import { VulnerabilityScanner } from '../services/vulnerabilityScanner'

export function SecurityDashboard() {
  const [securityMetrics, setSecurityMetrics] = useState(SecurityMonitoringService.getSecurityMetrics())
  const [ddosMetrics, setDdosMetrics] = useState(DDoSProtectionService.getMetricsSummary())
  const [vulnStats, setVulnStats] = useState(VulnerabilityScanner.getVulnerabilityStats())
  const [activeAlerts, setActiveAlerts] = useState(SecurityMonitoringService.getActiveAlerts())
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setSecurityMetrics(SecurityMonitoringService.getSecurityMetrics())
      setDdosMetrics(DDoSProtectionService.getMetricsSummary())
      setVulnStats(VulnerabilityScanner.getVulnerabilityStats())
      setActiveAlerts(SecurityMonitoringService.getActiveAlerts())
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const handleRunScan = async () => {
    setIsScanning(true)
    try {
      await VulnerabilityScanner.runFullScan()
      setVulnStats(VulnerabilityScanner.getVulnerabilityStats())
    } catch (error) {
      console.error('Scan failed:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const handleAcknowledgeAlert = (alertId: string) => {
    SecurityMonitoringService.acknowledgeAlert(alertId)
    setActiveAlerts(SecurityMonitoringService.getActiveAlerts())
  }

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-red-600 bg-red-50'
    if (score >= 60) return 'text-orange-600 bg-orange-50'
    if (score >= 30) return 'text-yellow-600 bg-yellow-50'
    return 'text-green-600 bg-green-50'
  }

  const getSeverityColor = (severity: SecuritySeverity) => {
    switch (severity) {
      case SecuritySeverity.CRITICAL: return 'text-red-600 bg-red-50'
      case SecuritySeverity.HIGH: return 'text-orange-600 bg-orange-50'
      case SecuritySeverity.MEDIUM: return 'text-yellow-600 bg-yellow-50'
      default: return 'text-blue-600 bg-blue-50'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Shield className="h-8 w-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Security Dashboard</h1>
            <p className="text-gray-600">Monitor security status and threats</p>
          </div>
        </div>
        <button
          onClick={handleRunScan}
          disabled={isScanning}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Eye className="h-4 w-4" />
          <span>{isScanning ? 'Scanning...' : 'Run Security Scan'}</span>
        </button>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-800">Active Security Alerts</h2>
          </div>
          <div className="space-y-2">
            {activeAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between bg-white p-3 rounded border">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getSeverityColor(alert.severity)}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="font-medium">{alert.title}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                </div>
                <button
                  onClick={() => handleAcknowledgeAlert(alert.id)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Overall Risk Score */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Risk Score</p>
              <p className={`text-2xl font-bold ${getRiskColor(securityMetrics.riskScore)}`}>
                {securityMetrics.riskScore}/100
              </p>
            </div>
            <Shield className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        {/* Security Events */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Events (24h)</p>
              <p className="text-2xl font-bold text-gray-900">{securityMetrics.eventsLast24h}</p>
            </div>
            <Activity className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        {/* DDoS Protection */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Threat Level</p>
              <p className={`text-2xl font-bold ${getSeverityColor(ddosMetrics.threatLevel.level as SecuritySeverity)}`}>
                {ddosMetrics.threatLevel.level.toUpperCase()}
              </p>
            </div>
            <Zap className="h-8 w-8 text-gray-400" />
          </div>
        </div>

        {/* Vulnerabilities */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Vulnerabilities</p>
              <p className="text-2xl font-bold text-gray-900">{vulnStats.totalVulnerabilities}</p>
            </div>
            <Lock className="h-8 w-8 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Events Breakdown */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Events by Severity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Critical</span>
              <span className="text-sm font-medium text-red-600">
                {securityMetrics.eventsBySeverity.critical || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">High</span>
              <span className="text-sm font-medium text-orange-600">
                {securityMetrics.eventsBySeverity.high || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Medium</span>
              <span className="text-sm font-medium text-yellow-600">
                {securityMetrics.eventsBySeverity.medium || 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Low</span>
              <span className="text-sm font-medium text-blue-600">
                {securityMetrics.eventsBySeverity.low || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Request Metrics */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Metrics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Success Rate</span>
              <span className="text-sm font-medium text-green-600">
                {(ddosMetrics.successRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Avg Response Time</span>
              <span className="text-sm font-medium text-gray-900">
                {ddosMetrics.avgResponseTime.toFixed(0)}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Requests/Hour</span>
              <span className="text-sm font-medium text-gray-900">
                {ddosMetrics.requestsLastHour}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Requests</span>
              <span className="text-sm font-medium text-gray-900">
                {ddosMetrics.totalRequests}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Vulnerability Breakdown */}
      {vulnStats.totalVulnerabilities > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Vulnerability Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{vulnStats.criticalCount}</div>
              <div className="text-sm text-gray-600">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{vulnStats.highCount}</div>
              <div className="text-sm text-gray-600">High</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{vulnStats.mediumCount}</div>
              <div className="text-sm text-gray-600">Medium</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{vulnStats.lowCount}</div>
              <div className="text-sm text-gray-600">Low</div>
            </div>
          </div>
        </div>
      )}

      {/* Top Threats */}
      {securityMetrics.topThreats.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Security Threats</h3>
          <div className="space-y-2">
            {securityMetrics.topThreats.slice(0, 5).map((threat, index) => (
              <div key={threat.type} className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-700">{threat.type.replace('_', ' ')}</span>
                <span className="text-sm font-medium text-gray-900">{threat.count} events</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}