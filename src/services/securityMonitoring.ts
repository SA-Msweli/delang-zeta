/**
 * Security Event Monitoring and Alerting Service
 * Comprehensive security event logging, analysis, and automated response
 */

import { toast } from 'react-hot-toast'
import { apiClient } from '../config/api'

export interface SecurityEvent {
  id: string
  timestamp: string
  type: SecurityEventType
  severity: SecuritySeverity
  source: string
  userId?: string
  walletAddress?: string
  ipAddress?: string
  userAgent?: string
  details: Record<string, any>
  resolved: boolean
  responseActions: string[]
}

export enum SecurityEventType {
  AUTHENTICATION_FAILURE = 'auth_failure',
  AUTHORIZATION_DENIED = 'auth_denied',
  RATE_LIMIT_EXCEEDED = 'rate_limit',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  MALICIOUS_INPUT = 'malicious_input',
  CSRF_VIOLATION = 'csrf_violation',
  XSS_ATTEMPT = 'xss_attempt',
  SQL_INJECTION = 'sql_injection',
  FILE_UPLOAD_VIOLATION = 'file_upload_violation',
  API_ABUSE = 'api_abuse',
  WALLET_COMPROMISE = 'wallet_compromise',
  DATA_BREACH_ATTEMPT = 'data_breach',
  DDOS_ATTACK = 'ddos_attack',
  VULNERABILITY_SCAN = 'vuln_scan',
  PRIVILEGE_ESCALATION = 'privilege_escalation'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SecurityAlert {
  id: string
  timestamp: string
  title: string
  message: string
  severity: SecuritySeverity
  events: SecurityEvent[]
  acknowledged: boolean
  resolvedAt?: string
}

export interface SecurityMetrics {
  totalEvents: number
  eventsByType: Record<SecurityEventType, number>
  eventsBySeverity: Record<SecuritySeverity, number>
  eventsLast24h: number
  eventsLastHour: number
  topThreats: Array<{ type: SecurityEventType; count: number }>
  riskScore: number
}

export class SecurityMonitoringService {
  private static readonly EVENTS_KEY = 'delang_security_events'
  private static readonly ALERTS_KEY = 'delang_security_alerts'
  private static readonly MAX_EVENTS = 1000
  private static readonly MAX_ALERTS = 100

  private static events: SecurityEvent[] = []
  private static alerts: SecurityAlert[] = []
  private static monitoring = false

  /**
   * Initialize security monitoring
   */
  static initialize(): void {
    this.loadEvents()
    this.loadAlerts()
    this.startMonitoring()

    // Clean old events every hour
    setInterval(() => {
      this.cleanOldEvents()
    }, 60 * 60 * 1000)

    // Analyze patterns every 5 minutes
    setInterval(() => {
      this.analyzeSecurityPatterns()
    }, 5 * 60 * 1000)
  }

  /**
   * Log security event
   */
  static logEvent(
    type: SecurityEventType,
    details: Record<string, any>,
    severity?: SecuritySeverity,
    userId?: string,
    walletAddress?: string
  ): void {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      type,
      severity: severity || this.determineSeverity(type, details),
      source: 'client',
      userId,
      walletAddress,
      ipAddress: this.getClientIP(),
      userAgent: navigator.userAgent,
      details,
      resolved: false,
      responseActions: []
    }

    this.events.push(event)
    this.saveEvents()

    // Trigger immediate analysis for high/critical events
    if (event.severity === SecuritySeverity.HIGH || event.severity === SecuritySeverity.CRITICAL) {
      this.handleCriticalEvent(event)
    }

    // Send to server for centralized logging
    this.sendEventToServer(event)

    console.warn('Security Event:', event)
  }

  /**
   * Create security alert
   */
  static createAlert(
    title: string,
    message: string,
    severity: SecuritySeverity,
    relatedEvents: SecurityEvent[]
  ): SecurityAlert {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date().toISOString(),
      title,
      message,
      severity,
      events: relatedEvents,
      acknowledged: false
    }

    this.alerts.push(alert)
    this.saveAlerts()

    // Show user notification for high/critical alerts
    if (severity === SecuritySeverity.HIGH || severity === SecuritySeverity.CRITICAL) {
      toast.error(`Security Alert: ${title}`)
    }

    return alert
  }

  /**
   * Handle critical security events
   */
  private static handleCriticalEvent(event: SecurityEvent): void {
    const responseActions: string[] = []

    switch (event.type) {
      case SecurityEventType.WALLET_COMPROMISE:
        responseActions.push('logout_user', 'clear_tokens', 'notify_admin')
        this.executeResponseAction('logout_user')
        break

      case SecurityEventType.DDOS_ATTACK:
        responseActions.push('rate_limit', 'block_ip', 'notify_admin')
        this.executeResponseAction('rate_limit')
        break

      case SecurityEventType.DATA_BREACH_ATTEMPT:
        responseActions.push('block_user', 'audit_access', 'notify_admin')
        this.executeResponseAction('audit_access')
        break

      case SecurityEventType.PRIVILEGE_ESCALATION:
        responseActions.push('revoke_permissions', 'logout_user', 'notify_admin')
        this.executeResponseAction('logout_user')
        break

      default:
        responseActions.push('log_event', 'monitor')
    }

    event.responseActions = responseActions

    // Create alert for critical events
    this.createAlert(
      `Critical Security Event: ${event.type}`,
      `A critical security event has been detected: ${JSON.stringify(event.details)}`,
      event.severity,
      [event]
    )
  }

  /**
   * Execute automated response action
   */
  private static executeResponseAction(action: string): void {
    switch (action) {
      case 'logout_user':
        // Clear authentication tokens
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        sessionStorage.clear()
        window.location.href = '/'
        break

      case 'clear_tokens':
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        break

      case 'rate_limit':
        // Trigger client-side rate limiting
        localStorage.setItem('security_rate_limited', Date.now().toString())
        break

      case 'audit_access':
        // Log detailed access information
        this.logEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
          action: 'audit_access_triggered',
          url: window.location.href,
          timestamp: Date.now()
        })
        break

      default:
        console.warn('Unknown response action:', action)
    }
  }

  /**
   * Analyze security patterns
   */
  private static analyzeSecurityPatterns(): void {
    const now = Date.now()
    const last24h = this.events.filter(e =>
      now - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000
    )

    // Pattern 1: Multiple authentication failures
    const authFailures = last24h.filter(e => e.type === SecurityEventType.AUTHENTICATION_FAILURE)
    if (authFailures.length > 10) {
      this.createAlert(
        'Multiple Authentication Failures',
        `${authFailures.length} authentication failures detected in the last 24 hours`,
        SecuritySeverity.HIGH,
        authFailures.slice(-5)
      )
    }

    // Pattern 2: Rapid security events from same source
    const eventsByUser = new Map<string, SecurityEvent[]>()
    last24h.forEach(event => {
      const key = event.userId || event.ipAddress || 'unknown'
      if (!eventsByUser.has(key)) {
        eventsByUser.set(key, [])
      }
      eventsByUser.get(key)!.push(event)
    })

    for (const [user, userEvents] of eventsByUser.entries()) {
      if (userEvents.length > 20) {
        this.createAlert(
          'Suspicious User Activity',
          `User ${user} has generated ${userEvents.length} security events in 24 hours`,
          SecuritySeverity.MEDIUM,
          userEvents.slice(-5)
        )
      }
    }

    // Pattern 3: Escalating threat severity
    const recentEvents = last24h.slice(-10)
    const criticalEvents = recentEvents.filter(e => e.severity === SecuritySeverity.CRITICAL)
    if (criticalEvents.length > 2) {
      this.createAlert(
        'Escalating Security Threats',
        `Multiple critical security events detected recently`,
        SecuritySeverity.CRITICAL,
        criticalEvents
      )
    }
  }

  /**
   * Determine event severity based on type and details
   */
  private static determineSeverity(type: SecurityEventType, details: Record<string, any>): SecuritySeverity {
    const criticalTypes = [
      SecurityEventType.WALLET_COMPROMISE,
      SecurityEventType.DATA_BREACH_ATTEMPT,
      SecurityEventType.PRIVILEGE_ESCALATION,
      SecurityEventType.DDOS_ATTACK
    ]

    const highTypes = [
      SecurityEventType.SQL_INJECTION,
      SecurityEventType.XSS_ATTEMPT,
      SecurityEventType.API_ABUSE,
      SecurityEventType.VULNERABILITY_SCAN
    ]

    const mediumTypes = [
      SecurityEventType.AUTHORIZATION_DENIED,
      SecurityEventType.MALICIOUS_INPUT,
      SecurityEventType.FILE_UPLOAD_VIOLATION,
      SecurityEventType.CSRF_VIOLATION
    ]

    if (criticalTypes.includes(type)) return SecuritySeverity.CRITICAL
    if (highTypes.includes(type)) return SecuritySeverity.HIGH
    if (mediumTypes.includes(type)) return SecuritySeverity.MEDIUM
    return SecuritySeverity.LOW
  }

  /**
   * Get security metrics
   */
  static getSecurityMetrics(): SecurityMetrics {
    const now = Date.now()
    const last24h = this.events.filter(e =>
      now - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000
    )
    const lastHour = this.events.filter(e =>
      now - new Date(e.timestamp).getTime() < 60 * 60 * 1000
    )

    // Count events by type
    const eventsByType: Record<SecurityEventType, number> = {} as any
    Object.values(SecurityEventType).forEach(type => {
      eventsByType[type] = this.events.filter(e => e.type === type).length
    })

    // Count events by severity
    const eventsBySeverity: Record<SecuritySeverity, number> = {} as any
    Object.values(SecuritySeverity).forEach(severity => {
      eventsBySeverity[severity] = this.events.filter(e => e.severity === severity).length
    })

    // Top threats
    const topThreats = Object.entries(eventsByType)
      .map(([type, count]) => ({ type: type as SecurityEventType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Calculate risk score (0-100)
    const criticalWeight = 10
    const highWeight = 5
    const mediumWeight = 2
    const lowWeight = 1

    const riskScore = Math.min(100,
      (eventsBySeverity[SecuritySeverity.CRITICAL] * criticalWeight) +
      (eventsBySeverity[SecuritySeverity.HIGH] * highWeight) +
      (eventsBySeverity[SecuritySeverity.MEDIUM] * mediumWeight) +
      (eventsBySeverity[SecuritySeverity.LOW] * lowWeight)
    )

    return {
      totalEvents: this.events.length,
      eventsByType,
      eventsBySeverity,
      eventsLast24h: last24h.length,
      eventsLastHour: lastHour.length,
      topThreats,
      riskScore
    }
  }

  /**
   * Get recent events
   */
  static getRecentEvents(limit: number = 50): SecurityEvent[] {
    return this.events.slice(-limit).reverse()
  }

  /**
   * Get active alerts
   */
  static getActiveAlerts(): SecurityAlert[] {
    return this.alerts.filter(alert => !alert.acknowledged)
  }

  /**
   * Acknowledge alert
   */
  static acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert) {
      alert.acknowledged = true
      alert.resolvedAt = new Date().toISOString()
      this.saveAlerts()
    }
  }

  /**
   * Send event to server
   */
  private static async sendEventToServer(event: SecurityEvent): Promise<void> {
    try {
      await apiClient.post('/security-events', {
        event: {
          ...event,
          // Remove sensitive client-side data
          userAgent: undefined,
          ipAddress: undefined
        }
      })
    } catch (error) {
      console.error('Failed to send security event to server:', error)
    }
  }

  /**
   * Start monitoring
   */
  private static startMonitoring(): void {
    if (this.monitoring) return
    this.monitoring = true

    // Monitor for suspicious DOM manipulation
    this.monitorDOMChanges()

    // Monitor for suspicious network requests
    this.monitorNetworkRequests()

    // Monitor for console access (potential XSS)
    this.monitorConsoleAccess()
  }

  /**
   * Monitor DOM changes for XSS attempts
   */
  private static monitorDOMChanges(): void {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element

              // Check for suspicious script tags
              if (element.tagName === 'SCRIPT') {
                this.logEvent(SecurityEventType.XSS_ATTEMPT, {
                  type: 'script_injection',
                  content: element.textContent?.substring(0, 200),
                  src: element.getAttribute('src')
                })
              }

              // Check for suspicious iframes
              if (element.tagName === 'IFRAME') {
                const src = element.getAttribute('src')
                if (src && !src.startsWith(window.location.origin)) {
                  this.logEvent(SecurityEventType.XSS_ATTEMPT, {
                    type: 'iframe_injection',
                    src
                  })
                }
              }
            }
          })
        }
      })
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true
    })
  }

  /**
   * Monitor network requests
   */
  private static monitorNetworkRequests(): void {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const [url, options] = args
      const startTime = Date.now()

      try {
        const response = await originalFetch(...args)
        const responseTime = Date.now() - startTime

        // Log suspicious requests
        if (typeof url === 'string' && !url.startsWith(window.location.origin)) {
          this.logEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
            type: 'external_request',
            url,
            method: options?.method || 'GET',
            responseTime,
            status: response.status
          })
        }

        return response
      } catch (error) {
        this.logEvent(SecurityEventType.API_ABUSE, {
          type: 'request_failure',
          url: url.toString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        throw error
      }
    }
  }

  /**
   * Monitor console access
   */
  private static monitorConsoleAccess(): void {
    const originalLog = console.log
    console.log = (...args) => {
      // Check for suspicious console usage
      const message = args.join(' ')
      if (message.includes('document.cookie') || message.includes('localStorage')) {
        this.logEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, {
          type: 'console_access',
          message: message.substring(0, 200)
        })
      }
      return originalLog(...args)
    }
  }

  /**
   * Utility methods
   */
  private static generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static generateAlertId(): string {
    return `alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static getClientIP(): string {
    // This would typically be set by the server
    return 'client'
  }

  private static loadEvents(): void {
    try {
      const stored = localStorage.getItem(this.EVENTS_KEY)
      if (stored) {
        this.events = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load security events:', error)
      this.events = []
    }
  }

  private static saveEvents(): void {
    try {
      // Keep only recent events
      if (this.events.length > this.MAX_EVENTS) {
        this.events = this.events.slice(-this.MAX_EVENTS)
      }
      localStorage.setItem(this.EVENTS_KEY, JSON.stringify(this.events))
    } catch (error) {
      console.error('Failed to save security events:', error)
    }
  }

  private static loadAlerts(): void {
    try {
      const stored = localStorage.getItem(this.ALERTS_KEY)
      if (stored) {
        this.alerts = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load security alerts:', error)
      this.alerts = []
    }
  }

  private static saveAlerts(): void {
    try {
      // Keep only recent alerts
      if (this.alerts.length > this.MAX_ALERTS) {
        this.alerts = this.alerts.slice(-this.MAX_ALERTS)
      }
      localStorage.setItem(this.ALERTS_KEY, JSON.stringify(this.alerts))
    } catch (error) {
      console.error('Failed to save security alerts:', error)
    }
  }

  private static cleanOldEvents(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days
    this.events = this.events.filter(e => new Date(e.timestamp).getTime() > cutoff)
    this.saveEvents()
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  SecurityMonitoringService.initialize()
}