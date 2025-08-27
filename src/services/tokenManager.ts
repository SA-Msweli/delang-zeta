import { AuthTokens } from '../types/auth'
import { AuthService } from './authService'

export class TokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'delang_access_token'
  private static readonly REFRESH_TOKEN_KEY = 'delang_refresh_token'
  private static readonly TOKEN_EXPIRY_KEY = 'delang_token_expiry'

  /**
   * Store authentication tokens securely
   */
  static setTokens(tokens: AuthTokens): void {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, tokens.accessToken)
      localStorage.setItem(this.REFRESH_TOKEN_KEY, tokens.refreshToken)

      const expiryTime = Date.now() + (tokens.expiresIn * 1000)
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString())
    } catch (error) {
      console.error('Failed to store tokens:', error)
      throw new Error('Failed to store authentication tokens')
    }
  }

  /**
   * Get stored access token
   */
  static getAccessToken(): string | null {
    try {
      const token = localStorage.getItem(this.ACCESS_TOKEN_KEY)

      if (!token) return null

      // Validate token format and expiration
      if (!AuthService.validateToken(token)) {
        this.clearTokens()
        return null
      }

      return token
    } catch (error) {
      console.error('Failed to get access token:', error)
      return null
    }
  }

  /**
   * Get stored refresh token
   */
  static getRefreshToken(): string | null {
    try {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY)
    } catch (error) {
      console.error('Failed to get refresh token:', error)
      return null
    }
  }

  /**
   * Get token expiry time
   */
  static getTokenExpiry(): number | null {
    try {
      const expiry = localStorage.getItem(this.TOKEN_EXPIRY_KEY)
      return expiry ? parseInt(expiry, 10) : null
    } catch (error) {
      console.error('Failed to get token expiry:', error)
      return null
    }
  }

  /**
   * Check if tokens exist and are valid
   */
  static hasValidTokens(): boolean {
    const accessToken = this.getAccessToken()
    const refreshToken = this.getRefreshToken()

    return !!(accessToken && refreshToken)
  }

  /**
   * Check if access token needs refresh
   */
  static shouldRefreshToken(): boolean {
    const accessToken = this.getAccessToken()
    if (!accessToken) return false

    return AuthService.shouldRefreshToken(accessToken)
  }

  /**
   * Clear all stored tokens
   */
  static clearTokens(): void {
    try {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY)
      localStorage.removeItem(this.REFRESH_TOKEN_KEY)
      localStorage.removeItem(this.TOKEN_EXPIRY_KEY)
    } catch (error) {
      console.error('Failed to clear tokens:', error)
    }
  }

  /**
   * Update access token after refresh
   */
  static updateAccessToken(accessToken: string, expiresIn: number): void {
    try {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken)

      const expiryTime = Date.now() + (expiresIn * 1000)
      localStorage.setItem(this.TOKEN_EXPIRY_KEY, expiryTime.toString())
    } catch (error) {
      console.error('Failed to update access token:', error)
      throw new Error('Failed to update access token')
    }
  }

  /**
   * Get tokens as AuthTokens object
   */
  static getTokens(): AuthTokens | null {
    const accessToken = this.getAccessToken()
    const refreshToken = this.getRefreshToken()
    const expiry = this.getTokenExpiry()

    if (!accessToken || !refreshToken || !expiry) {
      return null
    }

    const expiresIn = Math.max(0, Math.floor((expiry - Date.now()) / 1000))

    return {
      accessToken,
      refreshToken,
      expiresIn,
      tokenType: 'Bearer'
    }
  }
}

// Export static methods as instance-like object
export const tokenManager = {
  getAccessToken: () => TokenManager.getAccessToken(),
  getRefreshToken: () => TokenManager.getRefreshToken(),
  getTokenExpiry: () => TokenManager.getTokenExpiry(),
  hasValidTokens: () => TokenManager.hasValidTokens(),
  shouldRefreshToken: () => TokenManager.shouldRefreshToken(),
  setTokens: (tokens: AuthTokens) => TokenManager.setTokens(tokens),
  clearTokens: () => TokenManager.clearTokens(),
  updateAccessToken: (accessToken: string, expiresIn: number) => TokenManager.updateAccessToken(accessToken, expiresIn),
  getTokens: () => TokenManager.getTokens()
}