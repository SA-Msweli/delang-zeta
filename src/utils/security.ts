/**
 * Comprehensive security utilities for DeLangZeta
 * Implements CSRF protection, input validation, and security headers
 */

import { toast } from 'react-hot-toast'

// CSRF Token Management
export class CSRFProtection {
  private static readonly TOKEN_KEY = 'delang_csrf_token'
  private static readonly TOKEN_HEADER = 'X-CSRF-Token'

  /**
   * Generate a cryptographically secure CSRF token
   */
  static generateToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Get current CSRF token, generate if not exists
   */
  static getToken(): string {
    let token = sessionStorage.getItem(this.TOKEN_KEY)
    if (!token) {
      token = this.generateToken()
      sessionStorage.setItem(this.TOKEN_KEY, token)
    }
    return token
  }

  /**
   * Get CSRF headers for API requests
   */
  static getHeaders(): Record<string, string> {
    return {
      [this.TOKEN_HEADER]: this.getToken()
    }
  }

  /**
   * Validate CSRF token
   */
  static validateToken(token: string): boolean {
    const storedToken = sessionStorage.getItem(this.TOKEN_KEY)
    return storedToken === token && token.length === 64
  }

  /**
   * Clear CSRF token (on logout)
   */
  static clearToken(): void {
    sessionStorage.removeItem(this.TOKEN_KEY)
  }
}

// Input Validation and Sanitization
export class InputValidator {
  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    const div = document.createElement('div')
    div.textContent = input
    return div.innerHTML
  }

  /**
   * Validate and sanitize file names
   */
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^\w\s.-]/g, '') // Remove special characters
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .substring(0, 255) // Limit length
  }

  /**
   * Validate wallet address format
   */
  static validateWalletAddress(address: string): boolean {
    // Ethereum address validation
    const ethRegex = /^0x[a-fA-F0-9]{40}$/
    // Bitcoin address validation (simplified)
    const btcRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/

    return ethRegex.test(address) || btcRegex.test(address)
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email) && email.length <= 254
  }

  /**
   * Validate URL format
   */
  static validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url)
      return ['http:', 'https:'].includes(urlObj.protocol)
    } catch {
      return false
    }
  }

  /**
   * Sanitize user input for API requests
   */
  static sanitizeInput(input: any): any {
    if (typeof input === 'string') {
      return this.sanitizeHtml(input.trim())
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item))
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value)
      }
      return sanitized
    }

    return input
  }

  /**
   * Validate task creation input
   */
  static validateTaskInput(task: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!task.title || typeof task.title !== 'string' || task.title.trim().length === 0) {
      errors.push('Task title is required')
    } else if (task.title.length > 200) {
      errors.push('Task title must be less than 200 characters')
    }

    if (!task.description || typeof task.description !== 'string' || task.description.trim().length === 0) {
      errors.push('Task description is required')
    } else if (task.description.length > 2000) {
      errors.push('Task description must be less than 2000 characters')
    }

    if (!task.language || typeof task.language !== 'string') {
      errors.push('Language is required')
    }

    if (!task.dataType || !['text', 'audio', 'image', 'video'].includes(task.dataType)) {
      errors.push('Valid data type is required')
    }

    if (!task.reward || typeof task.reward !== 'object') {
      errors.push('Reward information is required')
    } else {
      if (!task.reward.total || isNaN(Number(task.reward.total)) || Number(task.reward.total) <= 0) {
        errors.push('Valid total reward amount is required')
      }
      if (!task.reward.token || typeof task.reward.token !== 'string') {
        errors.push('Reward token is required')
      }
    }

    return { isValid: errors.length === 0, errors }
  }

  /**
   * Validate submission input
   */
  static validateSubmissionInput(submission: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!submission.taskId || typeof submission.taskId !== 'string') {
      errors.push('Task ID is required')
    }

    if (!submission.metadata || typeof submission.metadata !== 'object') {
      errors.push('Submission metadata is required')
    } else {
      if (!submission.metadata.language || typeof submission.metadata.language !== 'string') {
        errors.push('Language metadata is required')
      }
      if (submission.metadata.fileSize && (isNaN(Number(submission.metadata.fileSize)) || Number(submission.metadata.fileSize) <= 0)) {
        errors.push('Valid file size is required')
      }
    }

    return { isValid: errors.length === 0, errors }
  }
}

// Security Headers Management
export class SecurityHeaders {
  /**
   * Get security headers for API requests
   */
  static getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
      ...CSRFProtection.getHeaders()
    }
  }

  /**
   * Apply security headers to fetch requests
   */
  static applyToRequest(headers: HeadersInit = {}): HeadersInit {
    return {
      ...headers,
      ...this.getSecurityHeaders()
    }
  }
}

// Content Security Policy
export class ContentSecurityPolicy {
  /**
   * Get CSP directives for the application
   */
  static getDirectives(): string {
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "media-src 'self' blob:",
      "connect-src 'self' https://*.cloudfunctions.net https://*.googleapis.com wss:",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ]

    return directives.join('; ')
  }

  /**
   * Apply CSP to the document
   */
  static apply(): void {
    const meta = document.createElement('meta')
    meta.httpEquiv = 'Content-Security-Policy'
    meta.content = this.getDirectives()
    document.head.appendChild(meta)
  }
}

// Rate Limiting Client-Side Tracking
export class ClientRateLimit {
  private static readonly STORAGE_KEY = 'delang_rate_limits'
  private static limits: Map<string, { count: number; resetTime: number }> = new Map()

  /**
   * Check if action is rate limited
   */
  static isLimited(action: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now()
    const key = `${action}_${Math.floor(now / windowMs)}`

    const limit = this.limits.get(key)
    if (!limit) {
      this.limits.set(key, { count: 1, resetTime: now + windowMs })
      return false
    }

    if (limit.count >= maxRequests) {
      return true
    }

    limit.count++
    return false
  }

  /**
   * Get remaining requests for an action
   */
  static getRemaining(action: string, maxRequests: number, windowMs: number): number {
    const now = Date.now()
    const key = `${action}_${Math.floor(now / windowMs)}`

    const limit = this.limits.get(key)
    if (!limit) return maxRequests

    return Math.max(0, maxRequests - limit.count)
  }

  /**
   * Clean expired rate limit entries
   */
  static cleanup(): void {
    const now = Date.now()
    for (const [key, limit] of this.limits.entries()) {
      if (limit.resetTime < now) {
        this.limits.delete(key)
      }
    }
  }
}

// Security Event interface
interface SecurityEvent {
  timestamp: string
  type: 'auth_failure' | 'validation_error' | 'rate_limit' | 'suspicious_activity' | 'csrf_violation'
  details: string
  userAgent: string
  url: string
}

// Security Event Logging
export class SecurityLogger {
  private static readonly LOG_KEY = 'delang_security_logs'
  private static readonly MAX_LOGS = 100

  /**
   * Log security event
   */
  static logEvent(type: SecurityEvent['type'], details: string): void {
    const event: SecurityEvent = {
      timestamp: new Date().toISOString(),
      type,
      details,
      userAgent: navigator.userAgent,
      url: window.location.href
    }

    try {
      const logs = this.getLogs()
      logs.push(event)

      // Keep only the most recent logs
      if (logs.length > this.MAX_LOGS) {
        logs.splice(0, logs.length - this.MAX_LOGS)
      }

      localStorage.setItem(this.LOG_KEY, JSON.stringify(logs))

      // Also log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.warn('Security Event:', event)
      }
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  /**
   * Get security logs
   */
  static getLogs(): SecurityEvent[] {
    try {
      const logs = localStorage.getItem(this.LOG_KEY)
      return logs ? JSON.parse(logs) : []
    } catch {
      return []
    }
  }

  /**
   * Clear security logs
   */
  static clearLogs(): void {
    localStorage.removeItem(this.LOG_KEY)
  }

  /**
   * Detect suspicious patterns
   */
  static detectSuspiciousActivity(): { suspicious: boolean; reasons: string[] } {
    const logs = this.getLogs()
    const recentLogs = logs.filter(log =>
      Date.now() - new Date(log.timestamp).getTime() < 60 * 60 * 1000 // Last hour
    )

    const reasons: string[] = []
    let suspicious = false

    // Check for multiple auth failures
    const authFailures = recentLogs.filter(log => log.type === 'auth_failure').length
    if (authFailures > 5) {
      suspicious = true
      reasons.push(`Multiple authentication failures: ${authFailures}`)
    }

    // Check for rate limit violations
    const rateLimitViolations = recentLogs.filter(log => log.type === 'rate_limit').length
    if (rateLimitViolations > 3) {
      suspicious = true
      reasons.push(`Multiple rate limit violations: ${rateLimitViolations}`)
    }

    // Check for validation errors
    const validationErrors = recentLogs.filter(log => log.type === 'validation_error').length
    if (validationErrors > 10) {
      suspicious = true
      reasons.push(`Multiple validation errors: ${validationErrors}`)
    }

    return { suspicious, reasons }
  }
}

// Secure Random Number Generation
export class SecureRandom {
  /**
   * Generate cryptographically secure random bytes
   */
  static getRandomBytes(length: number): Uint8Array {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return array
  }

  /**
   * Generate secure random string
   */
  static getRandomString(length: number): string {
    const bytes = this.getRandomBytes(length)
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Generate secure random number in range
   */
  static getRandomNumber(min: number, max: number): number {
    const range = max - min
    const bytes = this.getRandomBytes(4)
    const randomValue = new DataView(bytes.buffer).getUint32(0, true)
    return min + (randomValue % range)
  }
}

// Initialize security measures
export function initializeSecurity(): void {
  // Apply Content Security Policy
  ContentSecurityPolicy.apply()

  // Start rate limit cleanup interval
  setInterval(() => {
    ClientRateLimit.cleanup()
  }, 60000) // Clean every minute

  // Log initialization
  SecurityLogger.logEvent('suspicious_activity', 'Security system initialized')
}