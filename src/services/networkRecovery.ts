/**
 * Network Connectivity Error Recovery Service
 * Handles network failures, connection issues, and automatic recovery
 */

import { toast } from 'react-hot-toast'
import { ErrorHandlingService, ErrorType, ErrorSeverity } from './errorHandling'

export interface NetworkStatus {
  online: boolean
  connectionType: string
  effectiveType: string
  downlink: number
  rtt: number
  saveData: boolean
}

export interface ConnectionQuality {
  level: 'excellent' | 'good' | 'fair' | 'poor' | 'offline'
  score: number
  latency: number
  bandwidth: number
  stability: number
}

export interface RecoveryStrategy {
  name: string
  priority: number
  condition: (status: NetworkStatus) => boolean
  action: () => Promise<boolean>
}

export class NetworkRecoveryService {
  private static readonly PING_ENDPOINTS = [
    '/api/health',
    'https://www.google.com/favicon.ico',
    'https://cloudflare.com/cdn-cgi/trace'
  ]

  private static readonly STORAGE_KEY = 'network_recovery_data'
  private static isOnline: boolean = navigator.onLine
  private static connectionQuality: ConnectionQuality = {
    level: 'good',
    score: 100,
    latency: 0,
    bandwidth: 0,
    stability: 100
  }

  private static recoveryStrategies: RecoveryStrategy[] = []
  private static monitoring: boolean = false
  private static recoveryAttempts: number = 0
  private static lastRecoveryTime: number = 0
  private static offlineQueue: Array<{
    id: string
    timestamp: number
    request: () => Promise<any>
    resolve: (value: any) => void
    reject: (error: any) => void
  }> = []

  /**
   * Initialize network recovery service
   */
  static initialize(): void {
    this.setupEventListeners()
    this.setupRecoveryStrategies()
    this.startMonitoring()
    this.loadOfflineQueue()

    // Initial connection quality check
    this.checkConnectionQuality()
  }

  /**
   * Setup network event listeners
   */
  private static setupEventListeners(): void {
    window.addEventListener('online', () => {
      this.handleOnline()
    })

    window.addEventListener('offline', () => {
      this.handleOffline()
    })

    // Listen for connection changes
    if ('connection' in navigator) {
      const connection = (navigator as any).connection
      connection.addEventListener('change', () => {
        this.handleConnectionChange()
      })
    }

    // Listen for visibility changes (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.checkConnectionQuality()
      }
    })
  }

  /**
   * Handle online event
   */
  private static async handleOnline(): Promise<void> {
    console.log('Network: Online event detected')
    this.isOnline = true

    // Verify actual connectivity
    const isActuallyOnline = await this.verifyConnectivity()

    if (isActuallyOnline) {
      toast.success('Connection restored')

      // Process offline queue
      await this.processOfflineQueue()

      // Update connection quality
      await this.checkConnectionQuality()

      // Log recovery
      ErrorHandlingService.handleError(
        new Error('Network connection restored'),
        {
          component: 'network_recovery',
          action: 'connection_restored',
          metadata: {
            recoveryAttempts: this.recoveryAttempts,
            offlineQueueSize: this.offlineQueue.length
          }
        },
        false
      )

      this.recoveryAttempts = 0
    }
  }

  /**
   * Handle offline event
   */
  private static handleOffline(): void {
    console.log('Network: Offline event detected')
    this.isOnline = false
    this.connectionQuality = {
      level: 'offline',
      score: 0,
      latency: Infinity,
      bandwidth: 0,
      stability: 0
    }

    toast.error('Connection lost. Requests will be queued for retry.')

    // Log offline event
    ErrorHandlingService.handleError(
      new Error('Network connection lost'),
      {
        component: 'network_recovery',
        action: 'connection_lost',
        metadata: {
          timestamp: Date.now()
        }
      },
      false
    )
  }

  /**
   * Handle connection changes
   */
  private static async handleConnectionChange(): Promise<void> {
    console.log('Network: Connection change detected')
    await this.checkConnectionQuality()

    // If connection quality is poor, start recovery attempts
    if (this.connectionQuality.level === 'poor') {
      this.attemptRecovery()
    }
  }

  /**
   * Verify actual connectivity by pinging endpoints
   */
  private static async verifyConnectivity(): Promise<boolean> {
    const promises = this.PING_ENDPOINTS.map(endpoint =>
      this.pingEndpoint(endpoint)
    )

    try {
      const results = await Promise.allSettled(promises)
      const successCount = results.filter(r => r.status === 'fulfilled').length

      return successCount > 0
    } catch {
      return false
    }
  }

  /**
   * Ping a specific endpoint
   */
  private static async pingEndpoint(endpoint: string): Promise<boolean> {
    const startTime = Date.now()

    try {
      const response = await fetch(endpoint, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000)
      })

      const latency = Date.now() - startTime
      return latency < 10000 // Consider successful if under 10 seconds
    } catch {
      return false
    }
  }

  /**
   * Check connection quality
   */
  private static async checkConnectionQuality(): Promise<void> {
    if (!this.isOnline) {
      this.connectionQuality = {
        level: 'offline',
        score: 0,
        latency: Infinity,
        bandwidth: 0,
        stability: 0
      }
      return
    }

    const startTime = Date.now()
    let latency = 0
    let bandwidth = 0
    let stability = 100

    try {
      // Measure latency
      const pingResult = await this.pingEndpoint('/api/health')
      latency = Date.now() - startTime

      // Get connection info if available
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        bandwidth = connection.downlink || 0

        // Estimate stability based on connection type
        switch (connection.effectiveType) {
          case '4g':
            stability = 95
            break
          case '3g':
            stability = 80
            break
          case '2g':
            stability = 60
            break
          case 'slow-2g':
            stability = 40
            break
          default:
            stability = 90
        }
      }

      // Calculate quality score
      let score = 100

      // Penalize high latency
      if (latency > 1000) score -= 30
      else if (latency > 500) score -= 15
      else if (latency > 200) score -= 5

      // Penalize low bandwidth
      if (bandwidth < 0.5) score -= 20
      else if (bandwidth < 1) score -= 10
      else if (bandwidth < 2) score -= 5

      // Factor in stability
      score = (score * stability) / 100

      // Determine quality level
      let level: ConnectionQuality['level']
      if (score >= 90) level = 'excellent'
      else if (score >= 75) level = 'good'
      else if (score >= 50) level = 'fair'
      else level = 'poor'

      this.connectionQuality = {
        level,
        score,
        latency,
        bandwidth,
        stability
      }

    } catch (error) {
      this.connectionQuality = {
        level: 'poor',
        score: 10,
        latency: Infinity,
        bandwidth: 0,
        stability: 0
      }
    }
  }

  /**
   * Setup recovery strategies
   */
  private static setupRecoveryStrategies(): void {
    this.recoveryStrategies = [
      {
        name: 'refresh_connection',
        priority: 1,
        condition: (status) => !status.online,
        action: async () => {
          // Force a connection check
          return await this.verifyConnectivity()
        }
      },
      {
        name: 'clear_cache',
        priority: 2,
        condition: (status) => status.online && this.connectionQuality.level === 'poor',
        action: async () => {
          try {
            if ('caches' in window) {
              const cacheNames = await caches.keys()
              await Promise.all(
                cacheNames.map(name => caches.delete(name))
              )
            }
            return true
          } catch {
            return false
          }
        }
      },
      {
        name: 'reset_service_worker',
        priority: 3,
        condition: (status) => status.online && this.connectionQuality.level === 'poor',
        action: async () => {
          try {
            if ('serviceWorker' in navigator) {
              const registrations = await navigator.serviceWorker.getRegistrations()
              await Promise.all(
                registrations.map(reg => reg.unregister())
              )

              // Re-register service worker
              await navigator.serviceWorker.register('/sw.js')
            }
            return true
          } catch {
            return false
          }
        }
      },
      {
        name: 'reload_page',
        priority: 4,
        condition: (status) => status.online && this.recoveryAttempts > 3,
        action: async () => {
          toast('Reloading page to restore connection...')
          setTimeout(() => {
            window.location.reload()
          }, 2000)
          return true
        }
      }
    ]
  }

  /**
   * Attempt network recovery
   */
  private static async attemptRecovery(): Promise<boolean> {
    if (Date.now() - this.lastRecoveryTime < 30000) {
      // Don't attempt recovery too frequently
      return false
    }

    this.recoveryAttempts++
    this.lastRecoveryTime = Date.now()

    console.log(`Network recovery attempt ${this.recoveryAttempts}`)

    const networkStatus = this.getNetworkStatus()

    // Sort strategies by priority
    const applicableStrategies = this.recoveryStrategies
      .filter(strategy => strategy.condition(networkStatus))
      .sort((a, b) => a.priority - b.priority)

    for (const strategy of applicableStrategies) {
      try {
        console.log(`Trying recovery strategy: ${strategy.name}`)
        const success = await strategy.action()

        if (success) {
          console.log(`Recovery strategy ${strategy.name} succeeded`)

          // Verify recovery
          await this.checkConnectionQuality()

          if (this.connectionQuality.level !== 'poor' && this.connectionQuality.level !== 'offline') {
            toast.success('Connection recovered')
            return true
          }
        }
      } catch (error) {
        console.error(`Recovery strategy ${strategy.name} failed:`, error)
      }
    }

    return false
  }

  /**
   * Start monitoring network quality
   */
  private static startMonitoring(): void {
    if (this.monitoring) return
    this.monitoring = true

    // Check connection quality every 30 seconds
    setInterval(async () => {
      await this.checkConnectionQuality()

      // Attempt recovery if connection is poor
      if (this.connectionQuality.level === 'poor' || this.connectionQuality.level === 'offline') {
        this.attemptRecovery()
      }
    }, 30000)

    // Save offline queue periodically
    setInterval(() => {
      this.saveOfflineQueue()
    }, 10000)
  }

  /**
   * Queue request for offline processing
   */
  static queueRequest<T>(request: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queueItem = {
        id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        request,
        resolve,
        reject
      }

      this.offlineQueue.push(queueItem)
      this.saveOfflineQueue()

      toast('Request queued - will retry when connection is restored')
    })
  }

  /**
   * Process offline queue
   */
  private static async processOfflineQueue(): Promise<void> {
    if (this.offlineQueue.length === 0) return

    console.log(`Processing ${this.offlineQueue.length} queued requests`)

    const queue = [...this.offlineQueue]
    this.offlineQueue = []

    for (const item of queue) {
      try {
        const result = await item.request()
        item.resolve(result)
      } catch (error) {
        // If request still fails, re-queue it
        if (this.shouldRequeue(error)) {
          this.offlineQueue.push(item)
        } else {
          item.reject(error)
        }
      }
    }

    this.saveOfflineQueue()
  }

  /**
   * Check if request should be re-queued
   */
  private static shouldRequeue(error: any): boolean {
    // Re-queue network errors but not application errors
    return error?.code === 'NETWORK_ERROR' ||
      error?.message?.includes('network') ||
      error?.message?.includes('timeout')
  }

  /**
   * Get current network status
   */
  static getNetworkStatus(): NetworkStatus {
    const connection = (navigator as any).connection

    return {
      online: this.isOnline,
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0,
      saveData: connection?.saveData || false
    }
  }

  /**
   * Get connection quality
   */
  static getConnectionQuality(): ConnectionQuality {
    return { ...this.connectionQuality }
  }

  /**
   * Get recovery statistics
   */
  static getRecoveryStats(): {
    recoveryAttempts: number
    lastRecoveryTime: number
    queuedRequests: number
    isMonitoring: boolean
    strategies: string[]
  } {
    return {
      recoveryAttempts: this.recoveryAttempts,
      lastRecoveryTime: this.lastRecoveryTime,
      queuedRequests: this.offlineQueue.length,
      isMonitoring: this.monitoring,
      strategies: this.recoveryStrategies.map(s => s.name)
    }
  }

  /**
   * Force recovery attempt
   */
  static async forceRecovery(): Promise<boolean> {
    this.lastRecoveryTime = 0 // Reset cooldown
    return await this.attemptRecovery()
  }

  /**
   * Clear offline queue
   */
  static clearOfflineQueue(): void {
    this.offlineQueue.forEach(item => {
      item.reject(new Error('Queue cleared'))
    })
    this.offlineQueue = []
    this.saveOfflineQueue()
  }

  /**
   * Save offline queue to storage
   */
  private static saveOfflineQueue(): void {
    try {
      const queueData = this.offlineQueue.map(item => ({
        id: item.id,
        timestamp: item.timestamp
        // Note: Functions cannot be serialized, so we only save metadata
      }))

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        queue: queueData,
        recoveryAttempts: this.recoveryAttempts,
        lastRecoveryTime: this.lastRecoveryTime
      }))
    } catch (error) {
      console.error('Failed to save offline queue:', error)
    }
  }

  /**
   * Load offline queue from storage
   */
  private static loadOfflineQueue(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored)
        this.recoveryAttempts = data.recoveryAttempts || 0
        this.lastRecoveryTime = data.lastRecoveryTime || 0

        // Note: We can't restore the actual request functions,
        // so we just clear old queue data
        if (data.queue && data.queue.length > 0) {
          console.log(`Found ${data.queue.length} queued requests from previous session (cannot restore)`)
        }
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error)
    }
  }

  /**
   * Test network connectivity
   */
  static async testConnectivity(): Promise<{
    online: boolean
    latency: number
    quality: ConnectionQuality
    endpoints: Array<{ url: string; success: boolean; latency: number }>
  }> {
    const results = []

    for (const endpoint of this.PING_ENDPOINTS) {
      const startTime = Date.now()
      try {
        await this.pingEndpoint(endpoint)
        results.push({
          url: endpoint,
          success: true,
          latency: Date.now() - startTime
        })
      } catch {
        results.push({
          url: endpoint,
          success: false,
          latency: -1
        })
      }
    }

    const successfulPings = results.filter(r => r.success)
    const avgLatency = successfulPings.length > 0
      ? successfulPings.reduce((sum, r) => sum + r.latency, 0) / successfulPings.length
      : -1

    await this.checkConnectionQuality()

    return {
      online: successfulPings.length > 0,
      latency: avgLatency,
      quality: this.getConnectionQuality(),
      endpoints: results
    }
  }
}

// Initialize on module load
if (typeof window !== 'undefined') {
  NetworkRecoveryService.initialize()
}