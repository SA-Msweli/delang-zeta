/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures and provides fallback mechanisms for API calls
 */

import { toast } from 'react-hot-toast'
import { ErrorHandlingService, ErrorType, ErrorSeverity } from './errorHandling'

export enum CircuitState {
  CLOSED = 'closed',     // Normal operation
  OPEN = 'open',         // Circuit is open, requests fail fast
  HALF_OPEN = 'half_open' // Testing if service has recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number      // Number of failures before opening
  recoveryTimeout: number       // Time to wait before trying again (ms)
  monitoringPeriod: number     // Time window for failure counting (ms)
  halfOpenMaxCalls: number     // Max calls allowed in half-open state
  successThreshold: number     // Successes needed to close circuit
}

export interface CircuitBreakerMetrics {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureTime: number
  lastSuccessTime: number
  totalRequests: number
  totalFailures: number
  totalSuccesses: number
  uptime: number
}

export interface FallbackStrategy {
  type: 'cache' | 'alternative_service' | 'default_response' | 'queue'
  handler: (error: any, ...args: any[]) => Promise<any>
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime: number = 0
  private lastSuccessTime: number = 0
  private totalRequests: number = 0
  private totalFailures: number = 0
  private totalSuccesses: number = 0
  private nextAttempt: number = 0
  private halfOpenCalls: number = 0
  private readonly startTime: number = Date.now()

  constructor(
    private readonly name: string,
    private readonly config: CircuitBreakerConfig,
    private readonly fallbackStrategy?: FallbackStrategy
  ) { }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>, ...args: any[]): Promise<T> {
    this.totalRequests++

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        // Circuit is still open, fail fast
        const error = new Error(`Circuit breaker is OPEN for ${this.name}`)
        return this.handleFailure(error, ...args)
      } else {
        // Try to transition to half-open
        this.state = CircuitState.HALF_OPEN
        this.halfOpenCalls = 0
        this.successCount = 0
      }
    }

    // Check half-open state limits
    if (this.state === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        const error = new Error(`Circuit breaker HALF_OPEN limit exceeded for ${this.name}`)
        return this.handleFailure(error, ...args)
      }
      this.halfOpenCalls++
    }

    try {
      const result = await fn()
      this.handleSuccess()
      return result
    } catch (error) {
      return this.handleFailure(error, ...args)
    }
  }

  /**
   * Handle successful execution
   */
  private handleSuccess(): void {
    this.totalSuccesses++
    this.lastSuccessTime = Date.now()

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.config.successThreshold) {
        // Close the circuit
        this.state = CircuitState.CLOSED
        this.failureCount = 0
        this.successCount = 0
        this.halfOpenCalls = 0

        toast.success(`${this.name} service recovered`)
        console.log(`Circuit breaker CLOSED for ${this.name}`)
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0
    }
  }

  /**
   * Handle failed execution
   */
  private async handleFailure(error: any, ...args: any[]): Promise<any> {
    this.totalFailures++
    this.lastFailureTime = Date.now()
    this.failureCount++

    // Log error
    await ErrorHandlingService.handleError(error, {
      component: 'circuit_breaker',
      action: this.name,
      metadata: {
        state: this.state,
        failureCount: this.failureCount,
        totalRequests: this.totalRequests
      }
    }, false)

    // Check if we should open the circuit
    if (this.state === CircuitState.CLOSED &&
      this.failureCount >= this.config.failureThreshold) {
      this.openCircuit()
    } else if (this.state === CircuitState.HALF_OPEN) {
      // Failed in half-open state, go back to open
      this.openCircuit()
    }

    // Try fallback strategy
    if (this.fallbackStrategy) {
      try {
        return await this.fallbackStrategy.handler(error, ...args)
      } catch (fallbackError) {
        console.error(`Fallback failed for ${this.name}:`, fallbackError)
      }
    }

    // No fallback or fallback failed, throw original error
    throw error
  }

  /**
   * Open the circuit
   */
  private openCircuit(): void {
    this.state = CircuitState.OPEN
    this.nextAttempt = Date.now() + this.config.recoveryTimeout
    this.halfOpenCalls = 0

    toast.error(`${this.name} service is temporarily unavailable`)
    console.warn(`Circuit breaker OPENED for ${this.name}`)
  }

  /**
   * Get current metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
      uptime: Date.now() - this.startTime
    }
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.totalRequests === 0) return 1
    return this.totalSuccesses / this.totalRequests
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.halfOpenCalls = 0
    this.nextAttempt = 0
    console.log(`Circuit breaker RESET for ${this.name}`)
  }

  /**
   * Force open circuit (for testing or maintenance)
   */
  forceOpen(): void {
    this.state = CircuitState.OPEN
    this.nextAttempt = Date.now() + this.config.recoveryTimeout
    console.log(`Circuit breaker FORCE OPENED for ${this.name}`)
  }

  /**
   * Force close circuit
   */
  forceClose(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.halfOpenCalls = 0
    this.nextAttempt = 0
    console.log(`Circuit breaker FORCE CLOSED for ${this.name}`)
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
export class CircuitBreakerManager {
  private static breakers: Map<string, CircuitBreaker> = new Map()

  /**
   * Create or get circuit breaker for a service
   */
  static getBreaker(
    name: string,
    config?: Partial<CircuitBreakerConfig>,
    fallbackStrategy?: FallbackStrategy
  ): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 60000, // 1 minute
        monitoringPeriod: 300000, // 5 minutes
        halfOpenMaxCalls: 3,
        successThreshold: 2
      }

      const finalConfig = { ...defaultConfig, ...config }
      this.breakers.set(name, new CircuitBreaker(name, finalConfig, fallbackStrategy))
    }

    return this.breakers.get(name)!
  }

  /**
   * Get all circuit breakers
   */
  static getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers)
  }

  /**
   * Get metrics for all breakers
   */
  static getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {}

    for (const [name, breaker] of this.breakers.entries()) {
      metrics[name] = breaker.getMetrics()
    }

    return metrics
  }

  /**
   * Reset all circuit breakers
   */
  static resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset()
    }
  }

  /**
   * Get overall system health
   */
  static getSystemHealth(): {
    totalBreakers: number
    openBreakers: number
    halfOpenBreakers: number
    closedBreakers: number
    overallSuccessRate: number
    criticalServices: string[]
  } {
    const metrics = this.getAllMetrics()
    const breakerNames = Object.keys(metrics)

    let totalRequests = 0
    let totalSuccesses = 0
    const criticalServices: string[] = []

    const openBreakers = breakerNames.filter(name =>
      metrics[name].state === CircuitState.OPEN
    )

    const halfOpenBreakers = breakerNames.filter(name =>
      metrics[name].state === CircuitState.HALF_OPEN
    )

    const closedBreakers = breakerNames.filter(name =>
      metrics[name].state === CircuitState.CLOSED
    )

    // Calculate overall success rate
    for (const [name, metric] of Object.entries(metrics)) {
      totalRequests += metric.totalRequests
      totalSuccesses += metric.totalSuccesses

      // Identify critical services (low success rate or open circuit)
      const successRate = metric.totalRequests > 0 ?
        metric.totalSuccesses / metric.totalRequests : 1

      if (successRate < 0.8 || metric.state === CircuitState.OPEN) {
        criticalServices.push(name)
      }
    }

    const overallSuccessRate = totalRequests > 0 ? totalSuccesses / totalRequests : 1

    return {
      totalBreakers: breakerNames.length,
      openBreakers: openBreakers.length,
      halfOpenBreakers: halfOpenBreakers.length,
      closedBreakers: closedBreakers.length,
      overallSuccessRate,
      criticalServices
    }
  }
}

/**
 * Predefined fallback strategies
 */
export const FallbackStrategies = {
  /**
   * Cache-based fallback
   */
  cache: (cacheKey: string, defaultValue: any = null): FallbackStrategy => ({
    type: 'cache',
    handler: async (error: any) => {
      const cached = localStorage.getItem(`fallback_cache_${cacheKey}`)
      if (cached) {
        try {
          return JSON.parse(cached)
        } catch {
          return cached
        }
      }
      return defaultValue
    }
  }),

  /**
   * Default response fallback
   */
  defaultResponse: (defaultValue: any): FallbackStrategy => ({
    type: 'default_response',
    handler: async (error: any) => defaultValue
  }),

  /**
   * Alternative service fallback
   */
  alternativeService: (alternativeFn: () => Promise<any>): FallbackStrategy => ({
    type: 'alternative_service',
    handler: async (error: any) => {
      try {
        return await alternativeFn()
      } catch (altError) {
        console.error('Alternative service also failed:', altError)
        throw error // Throw original error
      }
    }
  }),

  /**
   * Queue for retry fallback
   */
  queue: (queueName: string): FallbackStrategy => ({
    type: 'queue',
    handler: async (error: any, ...args: any[]) => {
      // Store request in queue for later retry
      const queueKey = `retry_queue_${queueName}`
      const queue = JSON.parse(localStorage.getItem(queueKey) || '[]')

      queue.push({
        timestamp: Date.now(),
        args,
        error: error.message
      })

      localStorage.setItem(queueKey, JSON.stringify(queue))

      toast(`Request queued for retry when ${queueName} service recovers`)
      return null
    }
  })
}

/**
 * Specific circuit breakers for DeLangZeta services
 */
export const ServiceCircuitBreakers = {
  /**
   * Google AI services circuit breaker
   */
  googleAI: CircuitBreakerManager.getBreaker('google_ai', {
    failureThreshold: 3,
    recoveryTimeout: 120000, // 2 minutes
    halfOpenMaxCalls: 2,
    successThreshold: 2
  }, FallbackStrategies.cache('ai_verification', {
    score: 0,
    analysis: 'Service temporarily unavailable',
    fallback: true
  })),

  /**
   * Blockchain RPC circuit breaker
   */
  blockchain: CircuitBreakerManager.getBreaker('blockchain_rpc', {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    halfOpenMaxCalls: 3,
    successThreshold: 2
  }, FallbackStrategies.alternativeService(async () => {
    // Try alternative RPC endpoint
    throw new Error('No alternative RPC available')
  })),

  /**
   * File storage circuit breaker
   */
  storage: CircuitBreakerManager.getBreaker('file_storage', {
    failureThreshold: 3,
    recoveryTimeout: 60000, // 1 minute
    halfOpenMaxCalls: 2,
    successThreshold: 2
  }, FallbackStrategies.queue('storage')),

  /**
   * Authentication service circuit breaker
   */
  auth: CircuitBreakerManager.getBreaker('auth_service', {
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    halfOpenMaxCalls: 2,
    successThreshold: 2
  }, FallbackStrategies.cache('auth_status', { authenticated: false }))
}