/**
 * DDoS Protection and Advanced Rate Limiting Service
 * Implements client-side protection measures and coordinates with server-side limits
 */

import { toast } from 'react-hot-toast'
import { SecurityLogger } from '../utils/security'

export interface DDoSConfig {
  maxRequestsPerSecond: number
  maxRequestsPerMinute: number
  maxRequestsPerHour: number
  suspiciousThreshold: number
  blockDuration: number // in milliseconds
  whitelistedActions: string[]
}

export interface RequestMetrics {
  timestamp: number
  action: string
  endpoint: string
  responseTime: number
  success: boolean
}

export interface ThreatLevel {
  level: 'low' | 'medium' | 'high' | 'critical'
  score: number
  reasons: string[]
  blocked: boolean
}

export class DDoSProtectionService {
  private static readonly CONFIG: DDoSConfig = {
    maxRequestsPerSecond: 10,
    maxRequestsPerMinute: 100,
    maxRequestsPerHour: 1000,
    suspiciousThreshold: 50,
    blockDuration: 5 * 60 * 1000, // 5 minutes
    whitelistedActions: ['auth', 'heartbeat', 'status']
  }

  private static readonly METRICS_KEY = 'delang_request_metrics'
  private static readonly BLOCKED_KEY = 'delang_blocked_until'
  private static readonly MAX_METRICS = 1000

  private static metrics: RequestMetrics[] = []
  private static blockedUntil: number = 0

  /**
   * Initialize DDoS protection
   */
  static initialize(): void {
    this.loadMetrics()
    this.loadBlockedStatus()

    // Clean old metrics every minute
    setInterval(() => {
      this.cleanOldMetrics()
    }, 60000)

    // Check for unblocking every 10 seconds
    setInterval(() => {
      this.checkUnblock()
    }, 10000)
  }

  /**
   * Check if request should be allowed
   */
  static async checkRequest(action: string, endpoint: string): Promise<{
    allowed: boolean
    reason?: string
    retryAfter?: number
    threatLevel: ThreatLevel
  }> {
    const now = Date.now()

    // Check if currently blocked
    if (this.isBlocked()) {
      const retryAfter = Math.ceil((this.blockedUntil - now) / 1000)
      SecurityLogger.logEvent('rate_limit', `Request blocked: ${action} - ${endpoint}`)

      return {
        allowed: false,
        reason: 'Temporarily blocked due to suspicious activity',
        retryAfter,
        threatLevel: { level: 'critical', score: 100, reasons: ['Currently blocked'], blocked: true }
      }
    }

    // Check if action is whitelisted
    if (this.CONFIG.whitelistedActions.includes(action)) {
      return {
        allowed: true,
        threatLevel: { level: 'low', score: 0, reasons: ['Whitelisted action'], blocked: false }
      }
    }

    // Analyze threat level
    const threatLevel = this.analyzeThreatLevel(action, endpoint)

    // Check rate limits
    const rateLimitCheck = this.checkRateLimits(action, endpoint)
    if (!rateLimitCheck.allowed) {
      SecurityLogger.logEvent('rate_limit', `Rate limit exceeded: ${action} - ${rateLimitCheck.reason}`)

      // If threat level is high, block for longer
      if (threatLevel.level === 'high' || threatLevel.level === 'critical') {
        this.blockTemporarily(this.CONFIG.blockDuration * 2)
      }

      return {
        allowed: false,
        reason: rateLimitCheck.reason,
        retryAfter: rateLimitCheck.retryAfter,
        threatLevel
      }
    }

    // If threat level is critical, block immediately
    if (threatLevel.level === 'critical') {
      this.blockTemporarily(this.CONFIG.blockDuration)
      SecurityLogger.logEvent('suspicious_activity', `Critical threat detected: ${threatLevel.reasons.join(', ')}`)

      return {
        allowed: false,
        reason: 'Suspicious activity detected',
        retryAfter: Math.ceil(this.CONFIG.blockDuration / 1000),
        threatLevel
      }
    }

    return {
      allowed: true,
      threatLevel
    }
  }

  /**
   * Record request metrics
   */
  static recordRequest(action: string, endpoint: string, responseTime: number, success: boolean): void {
    const metric: RequestMetrics = {
      timestamp: Date.now(),
      action,
      endpoint,
      responseTime,
      success
    }

    this.metrics.push(metric)

    // Keep only recent metrics
    if (this.metrics.length > this.CONFIG.maxRequestsPerHour) {
      this.metrics = this.metrics.slice(-this.CONFIG.maxRequestsPerHour)
    }

    this.saveMetrics()

    // Check for suspicious patterns after recording
    this.detectSuspiciousPatterns()
  }

  /**
   * Analyze threat level based on request patterns
   */
  private static analyzeThreatLevel(action: string, endpoint: string): ThreatLevel {
    const now = Date.now()
    const reasons: string[] = []
    let score = 0

    // Recent metrics (last 5 minutes)
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 5 * 60 * 1000)

    // Check request frequency
    const lastMinute = recentMetrics.filter(m => now - m.timestamp < 60 * 1000)
    const lastSecond = recentMetrics.filter(m => now - m.timestamp < 1000)

    if (lastSecond.length > this.CONFIG.maxRequestsPerSecond) {
      score += 30
      reasons.push(`High request frequency: ${lastSecond.length} requests/second`)
    }

    if (lastMinute.length > this.CONFIG.maxRequestsPerMinute / 2) {
      score += 20
      reasons.push(`Elevated request rate: ${lastMinute.length} requests/minute`)
    }

    // Check for failed requests
    const failedRequests = recentMetrics.filter(m => !m.success).length
    const failureRate = recentMetrics.length > 0 ? failedRequests / recentMetrics.length : 0

    if (failureRate > 0.5) {
      score += 25
      reasons.push(`High failure rate: ${Math.round(failureRate * 100)}%`)
    }

    // Check for repeated identical requests
    const identicalRequests = recentMetrics.filter(m => m.action === action && m.endpoint === endpoint).length
    if (identicalRequests > 20) {
      score += 20
      reasons.push(`Repeated identical requests: ${identicalRequests}`)
    }

    // Check response times (potential probing)
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length
    if (avgResponseTime > 5000) { // 5 seconds
      score += 15
      reasons.push(`Slow response times: ${Math.round(avgResponseTime)}ms average`)
    }

    // Check for rapid endpoint scanning
    const uniqueEndpoints = new Set(recentMetrics.map(m => m.endpoint)).size
    if (uniqueEndpoints > 10 && recentMetrics.length > 50) {
      score += 25
      reasons.push(`Endpoint scanning detected: ${uniqueEndpoints} unique endpoints`)
    }

    // Determine threat level
    let level: ThreatLevel['level']
    if (score >= 80) level = 'critical'
    else if (score >= 60) level = 'high'
    else if (score >= 30) level = 'medium'
    else level = 'low'

    return {
      level,
      score,
      reasons,
      blocked: false
    }
  }

  /**
   * Check rate limits
   */
  private static checkRateLimits(action: string, endpoint: string): {
    allowed: boolean
    reason?: string
    retryAfter?: number
  } {
    const now = Date.now()

    // Check per-second limit
    const lastSecond = this.metrics.filter(m => now - m.timestamp < 1000)
    if (lastSecond.length >= this.CONFIG.maxRequestsPerSecond) {
      return {
        allowed: false,
        reason: 'Too many requests per second',
        retryAfter: 1
      }
    }

    // Check per-minute limit
    const lastMinute = this.metrics.filter(m => now - m.timestamp < 60 * 1000)
    if (lastMinute.length >= this.CONFIG.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: 'Too many requests per minute',
        retryAfter: 60
      }
    }

    // Check per-hour limit
    const lastHour = this.metrics.filter(m => now - m.timestamp < 60 * 60 * 1000)
    if (lastHour.length >= this.CONFIG.maxRequestsPerHour) {
      return {
        allowed: false,
        reason: 'Too many requests per hour',
        retryAfter: 3600
      }
    }

    return { allowed: true }
  }

  /**
   * Detect suspicious patterns
   */
  private static detectSuspiciousPatterns(): void {
    const now = Date.now()
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 10 * 60 * 1000) // Last 10 minutes

    // Pattern 1: Rapid-fire requests
    const rapidRequests = recentMetrics.filter(m => now - m.timestamp < 5000) // Last 5 seconds
    if (rapidRequests.length > 20) {
      SecurityLogger.logEvent('suspicious_activity', `Rapid-fire requests detected: ${rapidRequests.length} in 5 seconds`)
    }

    // Pattern 2: Consistent failures
    const recentFailures = recentMetrics.filter(m => !m.success && now - m.timestamp < 60 * 1000)
    if (recentFailures.length > 10) {
      SecurityLogger.logEvent('suspicious_activity', `Multiple failures detected: ${recentFailures.length} in last minute`)
    }

    // Pattern 3: Unusual endpoint access patterns
    const endpointCounts = new Map<string, number>()
    recentMetrics.forEach(m => {
      endpointCounts.set(m.endpoint, (endpointCounts.get(m.endpoint) || 0) + 1)
    })

    for (const [endpoint, count] of endpointCounts.entries()) {
      if (count > 50) {
        SecurityLogger.logEvent('suspicious_activity', `Excessive endpoint access: ${endpoint} accessed ${count} times`)
      }
    }
  }

  /**
   * Block temporarily
   */
  private static blockTemporarily(duration: number): void {
    this.blockedUntil = Date.now() + duration
    localStorage.setItem(this.BLOCKED_KEY, this.blockedUntil.toString())

    toast.error(`Access temporarily blocked for ${Math.ceil(duration / 60000)} minutes due to suspicious activity`)
    SecurityLogger.logEvent('suspicious_activity', `Temporary block applied for ${duration}ms`)
  }

  /**
   * Check if currently blocked
   */
  private static isBlocked(): boolean {
    return Date.now() < this.blockedUntil
  }

  /**
   * Check if should unblock
   */
  private static checkUnblock(): void {
    if (this.blockedUntil > 0 && Date.now() >= this.blockedUntil) {
      this.blockedUntil = 0
      localStorage.removeItem(this.BLOCKED_KEY)
      toast.success('Access restored')
      SecurityLogger.logEvent('suspicious_activity', 'Temporary block lifted')
    }
  }

  /**
   * Clean old metrics
   */
  private static cleanOldMetrics(): void {
    const cutoff = Date.now() - (2 * 60 * 60 * 1000) // 2 hours
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff)
    this.saveMetrics()
  }

  /**
   * Load metrics from storage
   */
  private static loadMetrics(): void {
    try {
      const stored = localStorage.getItem(this.METRICS_KEY)
      if (stored) {
        this.metrics = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load request metrics:', error)
      this.metrics = []
    }
  }

  /**
   * Save metrics to storage
   */
  private static saveMetrics(): void {
    try {
      localStorage.setItem(this.METRICS_KEY, JSON.stringify(this.metrics))
    } catch (error) {
      console.error('Failed to save request metrics:', error)
    }
  }

  /**
   * Load blocked status from storage
   */
  private static loadBlockedStatus(): void {
    try {
      const stored = localStorage.getItem(this.BLOCKED_KEY)
      if (stored) {
        this.blockedUntil = parseInt(stored, 10)
      }
    } catch (error) {
      console.error('Failed to load blocked status:', error)
      this.blockedUntil = 0
    }
  }

  /**
   * Get current metrics summary
   */
  static getMetricsSummary(): {
    totalRequests: number
    successRate: number
    avgResponseTime: number
    requestsLastMinute: number
    requestsLastHour: number
    threatLevel: ThreatLevel
  } {
    const now = Date.now()
    const lastMinute = this.metrics.filter(m => now - m.timestamp < 60 * 1000)
    const lastHour = this.metrics.filter(m => now - m.timestamp < 60 * 60 * 1000)

    const successfulRequests = this.metrics.filter(m => m.success).length
    const successRate = this.metrics.length > 0 ? successfulRequests / this.metrics.length : 1

    const avgResponseTime = this.metrics.length > 0
      ? this.metrics.reduce((sum, m) => sum + m.responseTime, 0) / this.metrics.length
      : 0

    const threatLevel = this.analyzeThreatLevel('summary', '/metrics')

    return {
      totalRequests: this.metrics.length,
      successRate,
      avgResponseTime,
      requestsLastMinute: lastMinute.length,
      requestsLastHour: lastHour.length,
      threatLevel
    }
  }

  /**
   * Reset all metrics and blocks
   */
  static reset(): void {
    this.metrics = []
    this.blockedUntil = 0
    localStorage.removeItem(this.METRICS_KEY)
    localStorage.removeItem(this.BLOCKED_KEY)
    SecurityLogger.logEvent('suspicious_activity', 'DDoS protection reset')
  }

  /**
   * Get configuration
   */
  static getConfig(): DDoSConfig {
    return { ...this.CONFIG }
  }

  /**
   * Update configuration (admin only)
   */
  static updateConfig(newConfig: Partial<DDoSConfig>): void {
    Object.assign(this.CONFIG, newConfig)
    SecurityLogger.logEvent('suspicious_activity', `DDoS protection config updated: ${JSON.stringify(newConfig)}`)
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  DDoSProtectionService.initialize()
}