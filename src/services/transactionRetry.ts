/**
 * Transaction Retry Mechanism with Exponential Backoff
 * Handles blockchain transaction failures and automatic retry logic
 */

import { toast } from 'react-hot-toast'
import { ErrorHandlingService, ErrorType, ErrorSeverity } from './errorHandling'

export interface TransactionConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  gasMultiplier: number
  maxGasMultiplier: number
  timeoutMs: number
}

export interface TransactionAttempt {
  attemptNumber: number
  timestamp: number
  gasPrice?: string
  gasLimit?: string
  nonce?: number
  hash?: string
  error?: string
  success: boolean
}

export interface TransactionRetryState {
  id: string
  originalParams: any
  config: TransactionConfig
  attempts: TransactionAttempt[]
  status: 'pending' | 'success' | 'failed' | 'cancelled'
  finalHash?: string
  finalError?: string
  startTime: number
  endTime?: number
}

export enum TransactionErrorType {
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  GAS_TOO_LOW = 'gas_too_low',
  NONCE_TOO_LOW = 'nonce_too_low',
  NONCE_TOO_HIGH = 'nonce_too_high',
  REPLACEMENT_UNDERPRICED = 'replacement_underpriced',
  TRANSACTION_UNDERPRICED = 'transaction_underpriced',
  NETWORK_ERROR = 'network_error',
  USER_REJECTED = 'user_rejected',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export class TransactionRetryService {
  private static readonly STORAGE_KEY = 'transaction_retry_states'
  private static readonly MAX_STORED_STATES = 100
  private static retryStates: Map<string, TransactionRetryState> = new Map()

  private static readonly DEFAULT_CONFIG: TransactionConfig = {
    maxRetries: 3,
    baseDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    gasMultiplier: 1.1,
    maxGasMultiplier: 2.0,
    timeoutMs: 300000 // 5 minutes
  }

  /**
   * Initialize transaction retry service
   */
  static initialize(): void {
    this.loadRetryStates()

    // Clean up old states every hour
    setInterval(() => {
      this.cleanupOldStates()
    }, 60 * 60 * 1000)

    // Save states every 30 seconds
    setInterval(() => {
      this.saveRetryStates()
    }, 30000)
  }

  /**
   * Execute transaction with retry logic
   */
  static async executeWithRetry<T>(
    transactionFn: (params: any) => Promise<T>,
    params: any,
    config: Partial<TransactionConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config }
    const retryId = this.generateRetryId()

    const retryState: TransactionRetryState = {
      id: retryId,
      originalParams: { ...params },
      config: finalConfig,
      attempts: [],
      status: 'pending',
      startTime: Date.now()
    }

    this.retryStates.set(retryId, retryState)

    try {
      const result = await this.attemptTransaction(transactionFn, retryState)
      retryState.status = 'success'
      retryState.endTime = Date.now()
      return result
    } catch (error) {
      retryState.status = 'failed'
      retryState.finalError = error instanceof Error ? error.message : String(error)
      retryState.endTime = Date.now()

      // Log final failure
      await ErrorHandlingService.handleError(error, {
        component: 'transaction_retry',
        action: 'final_failure',
        metadata: {
          retryId,
          attempts: retryState.attempts.length,
          duration: retryState.endTime - retryState.startTime
        }
      })

      throw error
    } finally {
      this.saveRetryStates()
    }
  }

  /**
   * Attempt transaction with retry logic
   */
  private static async attemptTransaction<T>(
    transactionFn: (params: any) => Promise<T>,
    retryState: TransactionRetryState
  ): Promise<T> {
    let lastError: any

    for (let attempt = 0; attempt <= retryState.config.maxRetries; attempt++) {
      const attemptData: TransactionAttempt = {
        attemptNumber: attempt + 1,
        timestamp: Date.now(),
        success: false
      }

      try {
        // Adjust parameters for retry
        const adjustedParams = this.adjustTransactionParams(
          retryState.originalParams,
          attempt,
          lastError,
          retryState.config
        )

        attemptData.gasPrice = adjustedParams.gasPrice
        attemptData.gasLimit = adjustedParams.gasLimit
        attemptData.nonce = adjustedParams.nonce

        // Execute transaction
        const result = await Promise.race([
          transactionFn(adjustedParams),
          this.createTimeoutPromise(retryState.config.timeoutMs)
        ])

        // Success
        attemptData.success = true
        if (typeof result === 'object' && result && 'hash' in result) {
          attemptData.hash = (result as any).hash
          retryState.finalHash = (result as any).hash
        }

        retryState.attempts.push(attemptData)

        toast.success(`Transaction successful${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`)

        return result as T
      } catch (error) {
        lastError = error
        attemptData.error = error instanceof Error ? error.message : String(error)
        retryState.attempts.push(attemptData)

        const errorType = this.classifyTransactionError(error)

        // Log attempt failure
        await ErrorHandlingService.handleError(error, {
          component: 'transaction_retry',
          action: 'attempt_failed',
          metadata: {
            retryId: retryState.id,
            attempt: attempt + 1,
            errorType,
            gasPrice: attemptData.gasPrice,
            gasLimit: attemptData.gasLimit
          }
        }, false)

        // Check if error is retryable
        if (!this.isRetryableError(errorType) || attempt >= retryState.config.maxRetries) {
          throw error
        }

        // Show retry message
        if (attempt < retryState.config.maxRetries) {
          const nextAttempt = attempt + 2
          toast.error(`Transaction failed (attempt ${attempt + 1}). Retrying... (${nextAttempt}/${retryState.config.maxRetries + 1})`)
        }

        // Wait before retry
        const delay = this.calculateDelay(attempt, retryState.config)
        await this.delay(delay)
      }
    }

    throw lastError
  }

  /**
   * Adjust transaction parameters for retry
   */
  private static adjustTransactionParams(
    originalParams: any,
    attemptNumber: number,
    lastError: any,
    config: TransactionConfig
  ): any {
    const params = { ...originalParams }
    const errorType = lastError ? this.classifyTransactionError(lastError) : null

    // Adjust gas price for retries
    if (attemptNumber > 0) {
      const gasMultiplier = Math.min(
        Math.pow(config.gasMultiplier, attemptNumber),
        config.maxGasMultiplier
      )

      if (params.gasPrice) {
        const originalGasPrice = BigInt(params.gasPrice)
        params.gasPrice = (originalGasPrice * BigInt(Math.floor(gasMultiplier * 100)) / BigInt(100)).toString()
      }

      if (params.maxFeePerGas) {
        const originalMaxFee = BigInt(params.maxFeePerGas)
        params.maxFeePerGas = (originalMaxFee * BigInt(Math.floor(gasMultiplier * 100)) / BigInt(100)).toString()
      }

      if (params.maxPriorityFeePerGas) {
        const originalPriorityFee = BigInt(params.maxPriorityFeePerGas)
        params.maxPriorityFeePerGas = (originalPriorityFee * BigInt(Math.floor(gasMultiplier * 100)) / BigInt(100)).toString()
      }
    }

    // Handle specific error types
    switch (errorType) {
      case TransactionErrorType.GAS_TOO_LOW:
        if (params.gasLimit) {
          const originalGasLimit = BigInt(params.gasLimit)
          params.gasLimit = (originalGasLimit * BigInt(120) / BigInt(100)).toString() // Increase by 20%
        }
        break

      case TransactionErrorType.NONCE_TOO_LOW:
        if (params.nonce !== undefined) {
          params.nonce = params.nonce + 1
        }
        break

      case TransactionErrorType.REPLACEMENT_UNDERPRICED:
      case TransactionErrorType.TRANSACTION_UNDERPRICED:
        // Increase gas price more aggressively
        if (params.gasPrice) {
          const originalGasPrice = BigInt(params.gasPrice)
          params.gasPrice = (originalGasPrice * BigInt(150) / BigInt(100)).toString() // Increase by 50%
        }
        break
    }

    return params
  }

  /**
   * Classify transaction error type
   */
  private static classifyTransactionError(error: any): TransactionErrorType {
    const message = error?.message?.toLowerCase() || ''
    const reason = error?.reason?.toLowerCase() || ''
    const code = error?.code

    if (message.includes('insufficient funds') || reason.includes('insufficient funds')) {
      return TransactionErrorType.INSUFFICIENT_FUNDS
    }

    if (message.includes('gas too low') || message.includes('intrinsic gas too low')) {
      return TransactionErrorType.GAS_TOO_LOW
    }

    if (message.includes('nonce too low') || reason.includes('nonce too low')) {
      return TransactionErrorType.NONCE_TOO_LOW
    }

    if (message.includes('nonce too high') || reason.includes('nonce too high')) {
      return TransactionErrorType.NONCE_TOO_HIGH
    }

    if (message.includes('replacement underpriced') || reason.includes('replacement underpriced')) {
      return TransactionErrorType.REPLACEMENT_UNDERPRICED
    }

    if (message.includes('transaction underpriced') || reason.includes('transaction underpriced')) {
      return TransactionErrorType.TRANSACTION_UNDERPRICED
    }

    if (code === 'NETWORK_ERROR' || message.includes('network')) {
      return TransactionErrorType.NETWORK_ERROR
    }

    if (code === 'ACTION_REJECTED' || message.includes('user rejected')) {
      return TransactionErrorType.USER_REJECTED
    }

    if (message.includes('timeout') || code === 'TIMEOUT') {
      return TransactionErrorType.TIMEOUT
    }

    return TransactionErrorType.UNKNOWN
  }

  /**
   * Check if error is retryable
   */
  private static isRetryableError(errorType: TransactionErrorType): boolean {
    const retryableErrors = [
      TransactionErrorType.GAS_TOO_LOW,
      TransactionErrorType.NONCE_TOO_LOW,
      TransactionErrorType.REPLACEMENT_UNDERPRICED,
      TransactionErrorType.TRANSACTION_UNDERPRICED,
      TransactionErrorType.NETWORK_ERROR,
      TransactionErrorType.TIMEOUT
    ]

    return retryableErrors.includes(errorType)
  }

  /**
   * Calculate delay for retry attempt
   */
  private static calculateDelay(attemptNumber: number, config: TransactionConfig): number {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attemptNumber)
    return Math.min(delay, config.maxDelay)
  }

  /**
   * Create timeout promise
   */
  private static createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Transaction timeout after ${timeoutMs}ms`))
      }, timeoutMs)
    })
  }

  /**
   * Delay execution
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate retry ID
   */
  private static generateRetryId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get retry state
   */
  static getRetryState(retryId: string): TransactionRetryState | undefined {
    return this.retryStates.get(retryId)
  }

  /**
   * Get all retry states
   */
  static getAllRetryStates(): TransactionRetryState[] {
    return Array.from(this.retryStates.values())
  }

  /**
   * Get retry statistics
   */
  static getRetryStats(): {
    totalRetries: number
    successfulRetries: number
    failedRetries: number
    pendingRetries: number
    averageAttempts: number
    errorsByType: Record<TransactionErrorType, number>
  } {
    const states = Array.from(this.retryStates.values())

    const errorsByType: Record<TransactionErrorType, number> = {} as any
    Object.values(TransactionErrorType).forEach(type => {
      errorsByType[type] = 0
    })

    let totalAttempts = 0

    states.forEach(state => {
      totalAttempts += state.attempts.length

      state.attempts.forEach(attempt => {
        if (attempt.error) {
          const errorType = this.classifyTransactionError({ message: attempt.error })
          errorsByType[errorType]++
        }
      })
    })

    return {
      totalRetries: states.length,
      successfulRetries: states.filter(s => s.status === 'success').length,
      failedRetries: states.filter(s => s.status === 'failed').length,
      pendingRetries: states.filter(s => s.status === 'pending').length,
      averageAttempts: states.length > 0 ? totalAttempts / states.length : 0,
      errorsByType
    }
  }

  /**
   * Cancel retry
   */
  static cancelRetry(retryId: string): boolean {
    const state = this.retryStates.get(retryId)
    if (state && state.status === 'pending') {
      state.status = 'cancelled'
      state.endTime = Date.now()
      this.saveRetryStates()
      return true
    }
    return false
  }

  /**
   * Clear completed retries
   */
  static clearCompleted(): void {
    const completedStates = Array.from(this.retryStates.entries())
      .filter(([_, state]) => state.status !== 'pending')

    completedStates.forEach(([id]) => {
      this.retryStates.delete(id)
    })

    this.saveRetryStates()
  }

  /**
   * Save retry states to storage
   */
  private static saveRetryStates(): void {
    try {
      const states = Array.from(this.retryStates.values())
      const recentStates = states
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, this.MAX_STORED_STATES)

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentStates))
    } catch (error) {
      console.error('Failed to save retry states:', error)
    }
  }

  /**
   * Load retry states from storage
   */
  private static loadRetryStates(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const states: TransactionRetryState[] = JSON.parse(stored)

        states.forEach(state => {
          this.retryStates.set(state.id, state)
        })
      }
    } catch (error) {
      console.error('Failed to load retry states:', error)
    }
  }

  /**
   * Clean up old retry states
   */
  private static cleanupOldStates(): void {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000) // 24 hours

    const oldStates = Array.from(this.retryStates.entries())
      .filter(([_, state]) => state.startTime < cutoff)

    oldStates.forEach(([id]) => {
      this.retryStates.delete(id)
    })

    if (oldStates.length > 0) {
      console.log(`Cleaned up ${oldStates.length} old retry states`)
      this.saveRetryStates()
    }
  }

  /**
   * Get user-friendly error message
   */
  static getErrorMessage(errorType: TransactionErrorType): string {
    switch (errorType) {
      case TransactionErrorType.INSUFFICIENT_FUNDS:
        return 'Insufficient funds to complete the transaction'

      case TransactionErrorType.GAS_TOO_LOW:
        return 'Gas limit too low. Increasing gas limit and retrying...'

      case TransactionErrorType.NONCE_TOO_LOW:
        return 'Transaction nonce too low. Adjusting and retrying...'

      case TransactionErrorType.NONCE_TOO_HIGH:
        return 'Transaction nonce too high. Please wait for pending transactions to complete'

      case TransactionErrorType.REPLACEMENT_UNDERPRICED:
        return 'Gas price too low for replacement. Increasing gas price and retrying...'

      case TransactionErrorType.TRANSACTION_UNDERPRICED:
        return 'Gas price too low. Increasing gas price and retrying...'

      case TransactionErrorType.NETWORK_ERROR:
        return 'Network error. Retrying transaction...'

      case TransactionErrorType.USER_REJECTED:
        return 'Transaction was rejected by user'

      case TransactionErrorType.TIMEOUT:
        return 'Transaction timed out. Retrying...'

      default:
        return 'Transaction failed. Retrying...'
    }
  }

  /**
   * Estimate gas for transaction
   */
  static async estimateGasWithBuffer(
    estimateGasFn: () => Promise<bigint>,
    bufferPercentage: number = 20
  ): Promise<string> {
    try {
      const estimatedGas = await estimateGasFn()
      const buffer = estimatedGas * BigInt(bufferPercentage) / BigInt(100)
      const gasWithBuffer = estimatedGas + buffer

      return gasWithBuffer.toString()
    } catch (error) {
      // If estimation fails, use a reasonable default
      console.warn('Gas estimation failed, using default:', error)
      return '200000' // Default gas limit
    }
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  TransactionRetryService.initialize()
}