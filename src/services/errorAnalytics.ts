/**
 * Error Analytics and Logging Service
 * Comprehensive error logging, analysis, and reporting
 */

import { ErrorHandlingService, ErrorReport, ErrorType, ErrorSeverity } from './errorHandling'
import { SecurityMonitoringService, SecurityEventType } from './securityMonitoring'

export interface ErrorPattern {
  id: string
  pattern: string
  type: ErrorType
  frequency: number
  firstSeen: string
  lastSeen: string
  affectedUsers: Set<string>
  commonContext: Record<string, any>
  severity: ErrorSeverity
  resolved: boolean
}

export interface ErrorTrend {
  period: string
  errorCount: number
  errorsByType: Record<ErrorType, number>
  errorsBySeverity: Record<ErrorSeverity, number>
  topErrors: Array<{ message: string; count: number }>
  affectedUsers: number
  averageResolutionTime: number
}

export interface ErrorInsight {
  type: 'spike' | 'pattern' | 'correlation' | 'degradation'
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  data: Record<string, any>
  recommendations: string[]
  timestamp: string
}

export interface SystemHealth {
  overallScore: number
  errorRate: number
  criticalErrors: number
  systemStability: number
  userImpact: number
  trends: {
    improving: boolean
    stable: boolean
    degrading: boolean
  }
  alerts: string[]
}

export class ErrorAnalyticsService {
  private static readonly PATTERNS_KEY = 'error_patterns'
  private static readonly TRENDS_KEY = 'error_trends'
  private static readonly INSIGHTS_KEY = 'error_insights'
  private static readonly MAX_PATTERNS = 200
  private static readonly MAX_TRENDS = 100
  private static readonly MAX_INSIGHTS = 50

  private static patterns: Map<string, ErrorPattern> = new Map()
  private static trends: ErrorTrend[] = []
  private static insights: ErrorInsight[] = []
  private static analyzing = false

  /**
   * Initialize error analytics service
   */
  static initialize(): void {
    this.loadData()

    // Analyze errors every 5 minutes
    setInterval(() => {
      this.analyzeErrors()
    }, 5 * 60 * 1000)

    // Generate trends every hour
    setInterval(() => {
      this.generateTrends()
    }, 60 * 60 * 1000)

    // Clean old data every 6 hours
    setInterval(() => {
      this.cleanOldData()
    }, 6 * 60 * 60 * 1000)

    // Initial analysis
    setTimeout(() => {
      this.analyzeErrors()
      this.generateTrends()
    }, 5000)
  }

  /**
   * Analyze error patterns and generate insights
   */
  private static async analyzeErrors(): Promise<void> {
    if (this.analyzing) return
    this.analyzing = true

    try {
      const errors = ErrorHandlingService.getErrorReports(500)

      // Update patterns
      this.updateErrorPatterns(errors)

      // Generate insights
      this.generateInsights(errors)

      // Save data
      this.saveData()

    } catch (error) {
      console.error('Error analysis failed:', error)
    } finally {
      this.analyzing = false
    }
  }

  /**
   * Update error patterns
   */
  private static updateErrorPatterns(errors: ErrorReport[]): void {
    const now = new Date().toISOString()

    errors.forEach(error => {
      const patternKey = this.generatePatternKey(error)

      let pattern = this.patterns.get(patternKey)
      if (!pattern) {
        pattern = {
          id: patternKey,
          pattern: this.extractPattern(error),
          type: error.type,
          frequency: 0,
          firstSeen: error.timestamp,
          lastSeen: error.timestamp,
          affectedUsers: new Set(),
          commonContext: {},
          severity: error.severity,
          resolved: false
        }
        this.patterns.set(patternKey, pattern)
      }

      // Update pattern data
      pattern.frequency++
      pattern.lastSeen = error.timestamp

      if (error.context.userId) {
        pattern.affectedUsers.add(error.context.userId)
      }

      // Update common context
      this.updateCommonContext(pattern, error.context)

      // Update severity if higher
      if (this.getSeverityWeight(error.severity) > this.getSeverityWeight(pattern.severity)) {
        pattern.severity = error.severity
      }
    })
  }

  /**
   * Generate pattern key for grouping similar errors
   */
  private static generatePatternKey(error: ErrorReport): string {
    // Normalize error message for pattern matching
    const normalizedMessage = error.message
      .replace(/\d+/g, 'N') // Replace numbers with N
      .replace(/0x[a-fA-F0-9]+/g, '0xHEX') // Replace hex addresses
      .replace(/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/g, 'UUID') // Replace UUIDs
      .replace(/https?:\/\/[^\s]+/g, 'URL') // Replace URLs
      .toLowerCase()

    return `${error.type}_${normalizedMessage.substring(0, 100)}`
  }

  /**
   * Extract pattern description
   */
  private static extractPattern(error: ErrorReport): string {
    return `${error.type}: ${error.message.substring(0, 200)}`
  }

  /**
   * Update common context for pattern
   */
  private static updateCommonContext(pattern: ErrorPattern, context: any): void {
    Object.keys(context).forEach(key => {
      if (context[key] !== undefined && context[key] !== null) {
        if (!pattern.commonContext[key]) {
          pattern.commonContext[key] = new Set()
        }

        if (pattern.commonContext[key] instanceof Set) {
          pattern.commonContext[key].add(context[key])
        }
      }
    })
  }

  /**
   * Generate insights from error data
   */
  private static generateInsights(errors: ErrorReport[]): void {
    const now = new Date().toISOString()
    const recentErrors = errors.filter(e =>
      Date.now() - new Date(e.timestamp).getTime() < 60 * 60 * 1000 // Last hour
    )

    // Detect error spikes
    this.detectErrorSpikes(recentErrors, now)

    // Detect new patterns
    this.detectNewPatterns(now)

    // Detect correlations
    this.detectCorrelations(recentErrors, now)

    // Detect system degradation
    this.detectSystemDegradation(errors, now)
  }

  /**
   * Detect error spikes
   */
  private static detectErrorSpikes(recentErrors: ErrorReport[], timestamp: string): void {
    const errorsByMinute = new Map<number, number>()
    const now = Date.now()

    // Count errors by minute
    recentErrors.forEach(error => {
      const minute = Math.floor((now - new Date(error.timestamp).getTime()) / (60 * 1000))
      errorsByMinute.set(minute, (errorsByMinute.get(minute) || 0) + 1)
    })

    // Calculate average and detect spikes
    const counts = Array.from(errorsByMinute.values())
    const average = counts.reduce((sum, count) => sum + count, 0) / counts.length
    const maxCount = Math.max(...counts)

    if (maxCount > average * 3 && maxCount > 10) {
      this.insights.push({
        type: 'spike',
        title: 'Error Spike Detected',
        description: `Error rate spiked to ${maxCount} errors/minute (${Math.round(maxCount / average)}x normal)`,
        severity: maxCount > average * 5 ? 'critical' : 'high',
        data: {
          maxCount,
          average,
          multiplier: maxCount / average,
          timeframe: '1 hour'
        },
        recommendations: [
          'Check system resources and performance',
          'Review recent deployments or changes',
          'Monitor user impact and consider rollback if necessary'
        ],
        timestamp
      })
    }
  }

  /**
   * Detect new error patterns
   */
  private static detectNewPatterns(timestamp: string): void {
    const newPatterns = Array.from(this.patterns.values())
      .filter(pattern =>
        Date.now() - new Date(pattern.firstSeen).getTime() < 60 * 60 * 1000 && // Last hour
        pattern.frequency >= 3 // At least 3 occurrences
      )

    newPatterns.forEach(pattern => {
      this.insights.push({
        type: 'pattern',
        title: 'New Error Pattern Detected',
        description: `New recurring error: ${pattern.pattern}`,
        severity: this.getSeverityLevel(pattern.severity),
        data: {
          pattern: pattern.pattern,
          frequency: pattern.frequency,
          affectedUsers: pattern.affectedUsers.size,
          type: pattern.type
        },
        recommendations: [
          'Investigate root cause of new error pattern',
          'Check if related to recent changes',
          'Monitor user impact and frequency'
        ],
        timestamp
      })
    })
  }

  /**
   * Detect error correlations
   */
  private static detectCorrelations(recentErrors: ErrorReport[], timestamp: string): void {
    // Group errors by user
    const errorsByUser = new Map<string, ErrorReport[]>()

    recentErrors.forEach(error => {
      if (error.context.userId) {
        if (!errorsByUser.has(error.context.userId)) {
          errorsByUser.set(error.context.userId, [])
        }
        errorsByUser.get(error.context.userId)!.push(error)
      }
    })

    // Find users with multiple different error types
    errorsByUser.forEach((userErrors, userId) => {
      const errorTypes = new Set(userErrors.map(e => e.type))

      if (errorTypes.size >= 3 && userErrors.length >= 5) {
        this.insights.push({
          type: 'correlation',
          title: 'User Experiencing Multiple Error Types',
          description: `User ${userId} experiencing ${errorTypes.size} different error types`,
          severity: 'medium',
          data: {
            userId,
            errorTypes: Array.from(errorTypes),
            errorCount: userErrors.length,
            timeframe: '1 hour'
          },
          recommendations: [
            'Check user-specific configuration or data',
            'Review user journey and identify common factors',
            'Consider reaching out to affected user'
          ],
          timestamp
        })
      }
    })
  }

  /**
   * Detect system degradation
   */
  private static detectSystemDegradation(errors: ErrorReport[], timestamp: string): void {
    const now = Date.now()
    const last24h = errors.filter(e => now - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000)
    const last1h = errors.filter(e => now - new Date(e.timestamp).getTime() < 60 * 60 * 1000)

    const hourlyRate = last1h.length
    const dailyRate = last24h.length / 24

    if (hourlyRate > dailyRate * 2 && hourlyRate > 20) {
      this.insights.push({
        type: 'degradation',
        title: 'System Performance Degradation',
        description: `Error rate increased significantly: ${hourlyRate}/hour vs ${dailyRate.toFixed(1)}/hour average`,
        severity: hourlyRate > dailyRate * 4 ? 'critical' : 'high',
        data: {
          currentRate: hourlyRate,
          averageRate: dailyRate,
          increase: hourlyRate / dailyRate
        },
        recommendations: [
          'Check system resources (CPU, memory, disk)',
          'Review application performance metrics',
          'Consider scaling resources or optimizing code',
          'Check for external service dependencies'
        ],
        timestamp
      })
    }
  }

  /**
   * Generate error trends
   */
  private static generateTrends(): void {
    const errors = ErrorHandlingService.getErrorReports(1000)
    const now = Date.now()

    // Generate hourly trends for last 24 hours
    for (let i = 0; i < 24; i++) {
      const hourStart = now - (i + 1) * 60 * 60 * 1000
      const hourEnd = now - i * 60 * 60 * 1000

      const hourErrors = errors.filter(e => {
        const errorTime = new Date(e.timestamp).getTime()
        return errorTime >= hourStart && errorTime < hourEnd
      })

      if (hourErrors.length > 0 || i === 0) { // Always include current hour
        const trend = this.generateTrendData(hourErrors, new Date(hourStart).toISOString())
        this.trends.unshift(trend) // Add to beginning
      }
    }

    // Keep only recent trends
    this.trends = this.trends.slice(0, this.MAX_TRENDS)
  }

  /**
   * Generate trend data for a time period
   */
  private static generateTrendData(errors: ErrorReport[], period: string): ErrorTrend {
    const errorsByType: Record<ErrorType, number> = {} as any
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any
    const errorMessages = new Map<string, number>()
    const affectedUsers = new Set<string>()

    // Initialize counters
    Object.values(ErrorType).forEach(type => {
      errorsByType[type] = 0
    })
    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = 0
    })

    // Process errors
    errors.forEach(error => {
      errorsByType[error.type]++
      errorsBySeverity[error.severity]++

      if (error.context.userId) {
        affectedUsers.add(error.context.userId)
      }

      const shortMessage = error.message.substring(0, 100)
      errorMessages.set(shortMessage, (errorMessages.get(shortMessage) || 0) + 1)
    })

    // Get top errors
    const topErrors = Array.from(errorMessages.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }))

    // Calculate average resolution time
    const resolvedErrors = errors.filter(e => e.resolved)
    const averageResolutionTime = resolvedErrors.length > 0
      ? resolvedErrors.reduce((sum, e) => {
        const resolutionTime = Date.now() - new Date(e.timestamp).getTime()
        return sum + resolutionTime
      }, 0) / resolvedErrors.length
      : 0

    return {
      period,
      errorCount: errors.length,
      errorsByType,
      errorsBySeverity,
      topErrors,
      affectedUsers: affectedUsers.size,
      averageResolutionTime
    }
  }

  /**
   * Get system health score
   */
  static getSystemHealth(): SystemHealth {
    const errors = ErrorHandlingService.getErrorReports(100)
    const recentErrors = errors.filter(e =>
      Date.now() - new Date(e.timestamp).getTime() < 60 * 60 * 1000 // Last hour
    )

    const criticalErrors = recentErrors.filter(e => e.severity === ErrorSeverity.CRITICAL).length
    const errorRate = recentErrors.length

    // Calculate scores (0-100)
    let overallScore = 100
    let systemStability = 100
    let userImpact = 100

    // Penalize for errors
    overallScore -= Math.min(errorRate * 2, 50)
    overallScore -= Math.min(criticalErrors * 10, 30)

    // System stability based on error patterns
    const activePatterns = Array.from(this.patterns.values())
      .filter(p => !p.resolved && Date.now() - new Date(p.lastSeen).getTime() < 60 * 60 * 1000)

    systemStability -= Math.min(activePatterns.length * 5, 40)

    // User impact based on affected users
    const affectedUsers = new Set()
    recentErrors.forEach(e => {
      if (e.context.userId) affectedUsers.add(e.context.userId)
    })

    userImpact -= Math.min(affectedUsers.size * 3, 50)

    // Determine trends
    const last2Hours = errors.filter(e =>
      Date.now() - new Date(e.timestamp).getTime() < 2 * 60 * 60 * 1000
    )
    const firstHourErrors = last2Hours.filter(e =>
      Date.now() - new Date(e.timestamp).getTime() >= 60 * 60 * 1000
    ).length
    const secondHourErrors = recentErrors.length

    const improving = secondHourErrors < firstHourErrors * 0.8
    const degrading = secondHourErrors > firstHourErrors * 1.5
    const stable = !improving && !degrading

    // Generate alerts
    const alerts: string[] = []
    if (criticalErrors > 0) {
      alerts.push(`${criticalErrors} critical errors in the last hour`)
    }
    if (errorRate > 20) {
      alerts.push(`High error rate: ${errorRate} errors/hour`)
    }
    if (activePatterns.length > 5) {
      alerts.push(`${activePatterns.length} active error patterns`)
    }

    return {
      overallScore: Math.max(0, overallScore),
      errorRate,
      criticalErrors,
      systemStability: Math.max(0, systemStability),
      userImpact: Math.max(0, userImpact),
      trends: {
        improving,
        stable,
        degrading
      },
      alerts
    }
  }

  /**
   * Get error patterns
   */
  static getErrorPatterns(limit: number = 20): ErrorPattern[] {
    return Array.from(this.patterns.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit)
  }

  /**
   * Get error trends
   */
  static getErrorTrends(limit: number = 24): ErrorTrend[] {
    return this.trends.slice(0, limit)
  }

  /**
   * Get insights
   */
  static getInsights(limit: number = 10): ErrorInsight[] {
    return this.insights
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  /**
   * Resolve error pattern
   */
  static resolvePattern(patternId: string): void {
    const pattern = this.patterns.get(patternId)
    if (pattern) {
      pattern.resolved = true
      this.saveData()
    }
  }

  /**
   * Utility methods
   */
  private static getSeverityWeight(severity: ErrorSeverity): number {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return 4
      case ErrorSeverity.HIGH: return 3
      case ErrorSeverity.MEDIUM: return 2
      case ErrorSeverity.LOW: return 1
      default: return 0
    }
  }

  private static getSeverityLevel(severity: ErrorSeverity): 'low' | 'medium' | 'high' | 'critical' {
    switch (severity) {
      case ErrorSeverity.CRITICAL: return 'critical'
      case ErrorSeverity.HIGH: return 'high'
      case ErrorSeverity.MEDIUM: return 'medium'
      case ErrorSeverity.LOW: return 'low'
      default: return 'low'
    }
  }

  private static saveData(): void {
    try {
      // Convert Sets to Arrays for serialization
      const patternsForStorage = Array.from(this.patterns.entries()).map(([key, pattern]) => [
        key,
        {
          ...pattern,
          affectedUsers: Array.from(pattern.affectedUsers),
          commonContext: Object.fromEntries(
            Object.entries(pattern.commonContext).map(([k, v]) => [
              k,
              v instanceof Set ? Array.from(v) : v
            ])
          )
        }
      ])

      localStorage.setItem(this.PATTERNS_KEY, JSON.stringify(patternsForStorage))
      localStorage.setItem(this.TRENDS_KEY, JSON.stringify(this.trends.slice(0, this.MAX_TRENDS)))
      localStorage.setItem(this.INSIGHTS_KEY, JSON.stringify(this.insights.slice(0, this.MAX_INSIGHTS)))
    } catch (error) {
      console.error('Failed to save error analytics data:', error)
    }
  }

  private static loadData(): void {
    try {
      // Load patterns
      const patternsData = localStorage.getItem(this.PATTERNS_KEY)
      if (patternsData) {
        const patterns = JSON.parse(patternsData)
        patterns.forEach(([key, pattern]: [string, any]) => {
          this.patterns.set(key, {
            ...pattern,
            affectedUsers: new Set(pattern.affectedUsers),
            commonContext: Object.fromEntries(
              Object.entries(pattern.commonContext).map(([k, v]) => [
                k,
                Array.isArray(v) ? new Set(v) : v
              ])
            )
          })
        })
      }

      // Load trends
      const trendsData = localStorage.getItem(this.TRENDS_KEY)
      if (trendsData) {
        this.trends = JSON.parse(trendsData)
      }

      // Load insights
      const insightsData = localStorage.getItem(this.INSIGHTS_KEY)
      if (insightsData) {
        this.insights = JSON.parse(insightsData)
      }
    } catch (error) {
      console.error('Failed to load error analytics data:', error)
    }
  }

  private static cleanOldData(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days

    // Clean old patterns
    const oldPatterns = Array.from(this.patterns.entries())
      .filter(([_, pattern]) => new Date(pattern.lastSeen).getTime() < cutoff)

    oldPatterns.forEach(([key]) => {
      this.patterns.delete(key)
    })

    // Clean old insights
    this.insights = this.insights.filter(insight =>
      Date.now() - new Date(insight.timestamp).getTime() < cutoff
    )

    if (oldPatterns.length > 0 || this.insights.length < this.MAX_INSIGHTS) {
      this.saveData()
    }
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  ErrorAnalyticsService.initialize()
}