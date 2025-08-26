import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { toast } from 'react-hot-toast'
import { TokenManager } from '../services/tokenManager'

// Cloud Functions configuration - single source of truth
export const CLOUD_FUNCTIONS_URL = import.meta.env.VITE_CLOUD_FUNCTIONS_URL || 'https://us-central1-delang-zeta.cloudfunctions.net'

// Retry configuration
const RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000 // 1 second

// Create secure HTTP client class
class SecureHttpClient {
  private client: AxiosInstance
  private isRefreshing = false
  private failedQueue: Array<{
    resolve: (value?: any) => void
    reject: (error?: any) => void
  }> = []

  constructor(baseURL: string, timeout = 30000) {
    this.client = axios.create({
      baseURL,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = TokenManager.getAccessToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId()

        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor for error handling and token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        // Handle 401 errors with token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          if (this.isRefreshing) {
            // If already refreshing, queue the request
            return new Promise((resolve, reject) => {
              this.failedQueue.push({ resolve, reject })
            }).then(() => {
              return this.client(originalRequest)
            }).catch(err => {
              return Promise.reject(err)
            })
          }

          originalRequest._retry = true
          this.isRefreshing = true

          try {
            const refreshToken = TokenManager.getRefreshToken()
            if (!refreshToken) {
              throw new Error('No refresh token available')
            }

            // Attempt to refresh token using Cloud Functions endpoint
            const response = await axios.post(`${this.client.defaults.baseURL}/auth-refresh`, {
              refreshToken
            })

            const { accessToken, expiresIn } = response.data
            TokenManager.updateAccessToken(accessToken, expiresIn)

            // Process failed queue
            this.processQueue(null)

            // Retry original request
            return this.client(originalRequest)
          } catch (refreshError) {
            this.processQueue(refreshError)
            TokenManager.clearTokens()
            toast.error('Session expired. Please reconnect your wallet.')

            // Redirect to home
            if (typeof window !== 'undefined') {
              window.location.href = '/'
            }

            return Promise.reject(refreshError)
          } finally {
            this.isRefreshing = false
          }
        }

        return this.handleResponseError(error)
      }
    )
  }

  private processQueue(error: any) {
    this.failedQueue.forEach(({ resolve, reject }) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })

    this.failedQueue = []
  }

  private handleResponseError(error: any) {
    const status = error.response?.status
    const data = error.response?.data

    // Don't show toast for auth endpoints to avoid spam
    const isAuthEndpoint = error.config?.url?.includes('/auth')

    if (!isAuthEndpoint) {
      if (status >= 500) {
        toast.error('Server error. Please try again later.')
      } else if (status === 429) {
        toast.error('Too many requests. Please wait a moment.')
      } else if (status === 403) {
        toast.error('Access denied. Please check your permissions.')
      } else if (data?.error) {
        toast.error(data.error)
      } else if (error.code === 'NETWORK_ERROR') {
        toast.error('Network error. Please check your connection.')
      } else if (error.code === 'TIMEOUT') {
        toast.error('Request timeout. Please try again.')
      }
    }

    return Promise.reject(error)
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Retry logic for failed requests
  private async retryRequest<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    attempts = RETRY_ATTEMPTS
  ): Promise<AxiosResponse<T>> {
    try {
      return await requestFn()
    } catch (error: any) {
      if (attempts > 1 && this.shouldRetry(error)) {
        await this.delay(RETRY_DELAY)
        return this.retryRequest(requestFn, attempts - 1)
      }
      throw error
    }
  }

  private shouldRetry(error: any): boolean {
    const status = error.response?.status
    const code = error.code

    // Retry on network errors, timeouts, and 5xx errors
    return (
      code === 'NETWORK_ERROR' ||
      code === 'TIMEOUT' ||
      (status >= 500 && status < 600) ||
      status === 429 // Rate limiting
    )
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Public methods
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.client.get<T>(url, config))
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.client.post<T>(url, data, config))
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.client.put<T>(url, data, config))
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.client.patch<T>(url, data, config))
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.retryRequest(() => this.client.delete<T>(url, config))
  }

  // Get underlying axios instance for advanced usage
  getClient(): AxiosInstance {
    return this.client
  }
}

// Create secure HTTP client instance for Cloud Functions
export const apiClient = new SecureHttpClient(CLOUD_FUNCTIONS_URL)

// Legacy export for backward compatibility
export const functionsClient = apiClient

// Legacy exports for backward compatibility
export const setTokens = (access: string, refresh: string) => {
  TokenManager.setTokens({
    accessToken: access,
    refreshToken: refresh,
    expiresIn: 3600, // Default 1 hour
    tokenType: 'Bearer'
  })
}

export const getAccessToken = (): string | null => {
  return TokenManager.getAccessToken()
}

export const clearTokens = () => {
  TokenManager.clearTokens()
}