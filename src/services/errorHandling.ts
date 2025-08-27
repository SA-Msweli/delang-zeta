/**
 * Comprehensive Error Handling System
 * Handles smart contract errors, API failures, network issues, and transaction failures
 */

import { toast } from 'react-hot-toast'
import { SecurityMonitoringService, SecurityEventType, SecuritySeverity } from './securityMonitoring'

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  walletAddress?: string
  transactionHash?: string
  blockNumber?: number
  gasUsed?: string
  metadata?: Record<string, any>
}

export interface ErrorReport {
  id: string
  timestamp: string
  type: ErrorType
  severity: ErrorSeverity
  message: string
  originalError: any
  context: ErrorContext
  userFriendlyMessage: string
  suggestedActions: string[]
  retryable: boolean
  retryCount: number
  resolved: boolean
}

export enum ErrorType {
  SMART_CONTRACT = 'smart_contract',
  NETWORK = 'network',
  API = 'api',
  AUTHENTICATION = 'authentication',
  VALIDATION = 'validation',
  TRANSACTION = 'transaction',
  WALLET = 'wallet',
  FILE_UPLOAD = 'file_upload',
  RATE_LIMIT = 'rate_limit',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: string[]
}

export class ErrorHandlingService {
  private static readonly ERRORS_KEY = 'delang_error_reports'
  private static readonly MAX_ERRORS = 500
  private static errors: ErrorReport[] = []
  private static retryConfigs: Map<ErrorType, RetryConfig> = new Map()

  /**
   * Initialize error handling service
   */
  static initialize(): void {
    this.loadErrors()
    this.setupRetryConfigs()
    this.setupGlobalErrorHandlers()

    // Clean old errors every hour
    setInterval(() => {
      this.cleanOldErrors()
    }, 60 * 60 * 1000)
  }

  /**
   * Handle error with comprehensive processing
   */
  static async handleError(
    error: any,
    context: ErrorContext = {},
    showToast: boolean = true
  ): Promise<ErrorReport> {
    const errorReport = this.createErrorReport(error, context)

    // Store error report
    this.errors.push(errorReport)
    this.saveErrors()

    // Log security event if needed
    if (this.isSecurityRelated(errorReport)) {
      SecurityMonitoringService.logEvent(
        this.getSecurityEventType(errorReport.type),
        {
          errorType: errorReport.type,
          message: errorReport.message,
          context: errorReport.context
        },
        this.getSecuritySeverity(errorReport.severity)
      )
    }

    // Show user-friendly message
    if (showToast) {
      this.showUserMessage(errorReport)
    }

    // Attempt automatic recovery if possible
    if (errorReport.retryable) {
      await this.attemptRecovery(errorReport)
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error Report:', errorReport)
    }

    return errorReport
  }

  /**
   * Create detailed error report
   */
  private static createErrorReport(error: any, context: ErrorContext): ErrorReport {
    const errorType = this.determineErrorType(error, context)
    const severity = this.determineSeverity(error, errorType)
    const userFriendlyMessage = this.getUserFriendlyMessage(error, errorType)
    const suggestedActions = this.getSuggestedActions(error, errorType)

    return {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      type: errorType,
      severity,
      message: this.extractErrorMessage(error),
      originalError: this.sanitizeError(error),
      context,
      userFriendlyMessage,
      suggestedActions,
      retryable: this.isRetryable(error, errorType),
      retryCount: 0,
      resolved: false
    }
  }

  /**
   * Determine error type from error object and context
   */
  private static determineErrorType(error: any, context: ErrorContext): ErrorType {
    // Smart contract errors
    if (error?.code === 'CALL_EXCEPTION' || error?.reason || error?.data) {
      return ErrorType.SMART_CONTRACT
    }

    // Network errors
    if (error?.code === 'NETWORK_ERROR' || error?.code === 'TIMEOUT' ||
      error?.message?.includes('network') || error?.message?.includes('timeout')) {
      return ErrorType.NETWORK
    }

    // API errors
    if (error?.response?.status || error?.request) {
      return ErrorType.API
    }

    // Authentication errors
    if (error?.message?.includes('authentication') || error?.message?.includes('unauthorized')) {
      return ErrorType.AUTHENTICATION
    }

    // Transaction errors
    if (error?.code === 'TRANSACTION_REPLACED' || error?.code === 'INSUFFICIENT_FUNDS' ||
      context.transactionHash) {
      return ErrorType.TRANSACTION
    }

    // Wallet errors
    if (error?.code === 'ACTION_REJECTED' || error?.message?.includes('wallet') ||
      error?.message?.includes('MetaMask')) {
      return ErrorType.WALLET
    }

    // File upload errors
    if (context.action?.includes('upload') || error?.message?.includes('file')) {
      return ErrorType.FILE_UPLOAD
    }

    // Rate limit errors
    if (error?.response?.status === 429 || error?.message?.includes('rate limit')) {
      return ErrorType.RATE_LIMIT
    }

    // Timeout errors
    if (error?.code === 'TIMEOUT' || error?.message?.includes('timeout')) {
      return ErrorType.TIMEOUT
    }

    return ErrorType.UNKNOWN
  }

  /**
   * Determine error severity
   */
  private static determineSeverity(error: any, type: ErrorType): ErrorSeverity {
    // Critical errors that break core functionality
    if (type === ErrorType.SMART_CONTRACT && error?.reason?.includes('revert')) {
      return ErrorSeverity.CRITICAL
    }

    if (type === ErrorType.AUTHENTICATION && error?.response?.status === 401) {
      return ErrorSeverity.HIGH
    }

    if (type === ErrorType.TRANSACTION && error?.code === 'INSUFFICIENT_FUNDS') {
      return ErrorSeverity.HIGH
    }

    // High severity errors
    if (type === ErrorType.NETWORK || type === ErrorType.API) {
      const status = error?.response?.status
      if (status >= 500) return ErrorSeverity.HIGH
      if (status >= 400) return ErrorSeverity.MEDIUM
    }

    // Medium severity for user-facing issues
    if (type === ErrorType.WALLET || type === ErrorType.FILE_UPLOAD) {
      return ErrorSeverity.MEDIUM
    }

    // Low severity for recoverable issues
    if (type === ErrorType.RATE_LIMIT || type === ErrorType.TIMEOUT) {
      return ErrorSeverity.LOW
    }

    return ErrorSeverity.MEDIUM
  }

  /**
   * Get user-friendly error message
   */
  private static getUserFriendlyMessage(error: any, type: ErrorType): string {
    switch (type) {
      case ErrorType.SMART_CONTRACT:
        if (error?.reason?.includes('insufficient funds')) {
          return 'Insufficient funds to complete this transaction'
        }
        if (error?.reason?.includes('gas')) {
          return 'Transaction failed due to gas issues. Please try again with higher gas limit.'
        }
        if (error?.reason?.includes('revert')) {
          return 'Transaction was rejected by the smart contract. Please check your inputs.'
        }
        return 'Smart contract interaction failed. Please try again.'

      case ErrorType.NETWORK:
        return 'Network connection issue. Please check your internet connection and try again.'

      case ErrorType.API:
        const status = error?.response?.status
        if (status === 429) {
          return 'Too many requests. Please wait a moment and try again.'
        }
        if (status >= 500) {
          return 'Server error. Our team has been notified. Please try again later.'
        }
        if (status === 404) {
          return 'The requested resource was not found.'
        }
        return 'Service temporarily unavailable. Please try again.'

      case ErrorType.AUTHENTICATION:
        return 'Authentication failed. Please reconnect your wallet and try again.'

      case ErrorType.TRANSACTION:
        if (error?.code === 'TRANSACTION_REPLACED') {
          return 'Transaction was replaced. Please check your wallet for the latest status.'
        }
        if (error?.code === 'INSUFFICIENT_FUNDS') {
          return 'Insufficient funds to complete this transaction.'
        }
        return 'Transaction failed. Please try again.'

      case ErrorType.WALLET:
        if (error?.code === 'ACTION_REJECTED') {
          return 'Transaction was rejected in your wallet.'
        }
        return 'Wallet connection issue. Please check your wallet and try again.'

      case ErrorType.FILE_UPLOAD:
        return 'File upload failed. Please check your file and try again.'

      case ErrorType.RATE_LIMIT:
        return 'Rate limit exceeded. Please wait a moment before trying again.'

      case ErrorType.TIMEOUT:
        return 'Request timed out. Please try again.'

      default:
        return 'An unexpected error occurred. Please try again.'
    }
  }

  /**
   * Get suggested actions for error recovery
   */
  private static getSuggestedActions(error: any, type: ErrorType): string[] {
    const actions: string[] = []

    switch (type) {
      case ErrorType.SMART_CONTRACT:
        actions.push('Check your wallet balance')
        actions.push('Verify transaction parameters')
        actions.push('Try increasing gas limit')
        break

      case ErrorType.NETWORK:
        actions.push('Check internet connection')
        actions.push('Try switching networks')
        actions.push('Refresh the page')
        break

      case ErrorType.API:
        actions.push('Wait a few moments and retry')
        actions.push('Check service status')
        actions.push('Contact support if issue persists')
        break

      case ErrorType.AUTHENTICATION:
        actions.push('Reconnect your wallet')
        actions.push('Clear browser cache')
        actions.push('Try a different wallet')
        break

      case ErrorType.TRANSACTION:
        actions.push('Check transaction status in wallet')
        actions.push('Verify sufficient gas fees')
        actions.push('Try with higher gas price')
        break

      case ErrorType.WALLET:
        actions.push('Check wallet connection')
        actions.push('Approve transaction in wallet')
        actions.push('Try refreshing wallet')
        break

      case ErrorType.FILE_UPLOAD:
        actions.push('Check file size and format')
        actions.push('Try a different file')
        actions.push('Check internet connection')
        break

      case ErrorType.RATE_LIMIT:
        actions.push('Wait before retrying')
        actions.push('Reduce request frequency')
        break

      case ErrorType.TIMEOUT:
        actions.push('Try again with better connection')
        actions.push('Check network status')
        break

      default:
        actions.push('Try again')
        actions.push('Refresh the page')
        actions.push('Contact support if issue persists')
    }

    return actions
  }

  /**
   * Show user-friendly message
   */
  private static showUserMessage(errorReport: ErrorReport): void {
    const toastOptions = {
      duration: errorReport.severity === ErrorSeverity.CRITICAL ? 8000 : 5000,
      position: 'top-right' as const
    }

    switch (errorReport.severity) {
      case ErrorSeverity.CRITICAL:
        toast.error(errorReport.userFriendlyMessage, toastOptions)
        break
      case ErrorSeverity.HIGH:
        toast.error(errorReport.userFriendlyMessage, toastOptions)
        break
      case ErrorSeverity.MEDIUM:
        toast.error(errorReport.userFriendlyMessage, toastOptions)
        break
      case ErrorSeverity.LOW:
        toast(errorReport.userFriendlyMessage, toastOptions)
        break
    }
  }

  /**
   * Attempt automatic error recovery
   */
  private static async attemptRecovery(errorReport: ErrorReport): Promise<boolean> {
    if (errorReport.retryCount >= this.getMaxRetries(errorReport.type)) {
      return false
    }

    const retryConfig = this.retryConfigs.get(errorReport.type)
    if (!retryConfig) return false

    const delay = Math.min(
      retryConfig.baseDelay * Math.pow(retryConfig.backoffMultiplier, errorReport.retryCount),
      retryConfig.maxDelay
    )

    await this.delay(delay)

    errorReport.retryCount++

    // Recovery strategies by error type
    switch (errorReport.type) {
      case ErrorType.NETWORK:
        return this.recoverNetworkError(errorReport)

      case ErrorType.API:
        return this.recoverApiError(errorReport)

      case ErrorType.AUTHENTICATION:
        return this.recoverAuthError(errorReport)

      default:
        return false
    }
  }

  /**
   * Network error recovery
   */
  private static async recoverNetworkError(errorReport: ErrorReport): Promise<boolean> {
    try {
      // Test network connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      })

      if (response.ok) {
        errorReport.resolved = true
        toast.success('Network connection restored')
        return true
      }
    } catch {
      // Network still down
    }

    return false
  }

  /**
   * API error recovery
   */
  private static async recoverApiError(errorReport: ErrorReport): Promise<boolean> {
    // For API errors, we typically just retry the request
    // The actual retry logic would be handled by the calling code
    return false
  }

  /**
   * Authentication error recovery
   */
  private static async recoverAuthError(errorReport: ErrorReport): Promise<boolean> {
    try {
      // Attempt token refresh
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        // This would trigger the token refresh logic in the API client
        return true
      }
    } catch {
      // Refresh failed
    }

    return false
  }

  /**
   * Setup retry configurations
   */
  private static setupRetryConfigs(): void {
    this.retryConfigs.set(ErrorType.NETWORK, {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: ['NETWORK_ERROR', 'TIMEOUT']
    })

    this.retryConfigs.set(ErrorType.API, {
      maxAttempts: 3,
      baseDelay: 2000,
      maxDelay: 15000,
      backoffMultiplier: 2,
      retryableErrors: ['500', '502', '503', '504']
    })

    this.retryConfigs.set(ErrorType.AUTHENTICATION, {
      maxAttempts: 2,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2,
      retryableErrors: ['401', 'TOKEN_EXPIRED']
    })

    this.retryConfigs.set(ErrorType.TRANSACTION, {
      maxAttempts: 2,
      baseDelay: 5000,
      maxDelay: 30000,
      backoffMultiplier: 3,
      retryableErrors: ['REPLACEMENT_UNDERPRICED', 'NONCE_EXPIRED']
    })
  }

  /**
   * Setup global error handlers
   */
  private static setupGlobalErrorHandlers(): void {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason, { component: 'global', action: 'unhandled_promise' })
      event.preventDefault()
    })

    // Global JavaScript errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error, {
        component: 'global',
        action: 'javascript_error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })

    // Resource loading errors
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.handleError(new Error('Resource loading failed'), {
          component: 'global',
          action: 'resource_error',
          metadata: {
            tagName: (event.target as any)?.tagName,
            src: (event.target as any)?.src || (event.target as any)?.href
          }
        })
      }
    }, true)
  }

  /**
   * Utility methods
   */
  private static extractErrorMessage(error: any): string {
    if (typeof error === 'string') return error
    if (error?.message) return error.message
    if (error?.reason) return error.reason
    if (error?.response?.data?.error) return error.response.data.error
    if (error?.response?.statusText) return error.response.statusText
    return 'Unknown error'
  }

  private static sanitizeError(error: any): any {
    // Remove sensitive information from error object
    const sanitized = { ...error }
    delete sanitized.config?.headers?.Authorization
    delete sanitized.request
    return sanitized
  }

  private static isRetryable(error: any, type: ErrorType): boolean {
    const retryConfig = this.retryConfigs.get(type)
    if (!retryConfig) return false

    const errorCode = error?.code || error?.response?.status?.toString()
    return retryConfig.retryableErrors.includes(errorCode)
  }

  private static getMaxRetries(type: ErrorType): number {
    return this.retryConfigs.get(type)?.maxAttempts || 0
  }

  private static isSecurityRelated(errorReport: ErrorReport): boolean {
    return [
      ErrorType.AUTHENTICATION,
      ErrorType.SMART_CONTRACT,
      ErrorType.WALLET
    ].includes(errorReport.type)
  }

  private static getSecurityEventType(errorType: ErrorType): SecurityEventType {
    switch (errorType) {
      case ErrorType.AUTHENTICATION:
        return SecurityEventType.AUTHENTICATION_FAILURE
      case ErrorType.SMART_CONTRACT:
        return SecurityEventType.API_ABUSE
      case ErrorType.WALLET:
        return SecurityEventType.SUSPICIOUS_ACTIVITY
      default:
        return SecurityEventType.SUSPICIOUS_ACTIVITY
    }
  }

  private static getSecuritySeverity(errorSeverity: ErrorSeverity): SecuritySeverity {
    switch (errorSeverity) {
      case ErrorSeverity.CRITICAL:
        return SecuritySeverity.CRITICAL
      case ErrorSeverity.HIGH:
        return SecuritySeverity.HIGH
      case ErrorSeverity.MEDIUM:
        return SecuritySeverity.MEDIUM
      default:
        return SecuritySeverity.LOW
    }
  }

  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private static loadErrors(): void {
    try {
      const stored = localStorage.getItem(this.ERRORS_KEY)
      if (stored) {
        this.errors = JSON.parse(stored)
      }
    } catch (error) {
      console.error('Failed to load error reports:', error)
      this.errors = []
    }
  }

  private static saveErrors(): void {
    try {
      // Keep only recent errors
      if (this.errors.length > this.MAX_ERRORS) {
        this.errors = this.errors.slice(-this.MAX_ERRORS)
      }
      localStorage.setItem(this.ERRORS_KEY, JSON.stringify(this.errors))
    } catch (error) {
      console.error('Failed to save error reports:', error)
    }
  }

  private static cleanOldErrors(): void {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 days
    this.errors = this.errors.filter(e => new Date(e.timestamp).getTime() > cutoff)
    this.saveErrors()
  }

  /**
   * Public API methods
   */
  static getErrorReports(limit: number = 50): ErrorReport[] {
    return this.errors.slice(-limit).reverse()
  }

  static getErrorStats(): {
    totalErrors: number
    errorsByType: Record<ErrorType, number>
    errorsBySeverity: Record<ErrorSeverity, number>
    resolvedErrors: number
    retryableErrors: number
  } {
    const errorsByType: Record<ErrorType, number> = {} as any
    const errorsBySeverity: Record<ErrorSeverity, number> = {} as any

    Object.values(ErrorType).forEach(type => {
      errorsByType[type] = this.errors.filter(e => e.type === type).length
    })

    Object.values(ErrorSeverity).forEach(severity => {
      errorsBySeverity[severity] = this.errors.filter(e => e.severity === severity).length
    })

    return {
      totalErrors: this.errors.length,
      errorsByType,
      errorsBySeverity,
      resolvedErrors: this.errors.filter(e => e.resolved).length,
      retryableErrors: this.errors.filter(e => e.retryable).length
    }
  }

  static resolveError(errorId: string): void {
    const error = this.errors.find(e => e.id === errorId)
    if (error) {
      error.resolved = true
      this.saveErrors()
    }
  }

  static clearErrors(): void {
    this.errors = []
    localStorage.removeItem(this.ERRORS_KEY)
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  ErrorHandlingService.initialize()
}