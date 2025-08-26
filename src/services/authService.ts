import { apiClient } from '../config/api'
import type {
  AuthRequest,
  AuthResponse,
  AuthChallenge,
  TokenRefreshRequest,
  TokenRefreshResponse
} from '../types/auth'

export class AuthService {
  private static readonly CHALLENGE_ENDPOINT = '/auth-challenge'
  private static readonly LOGIN_ENDPOINT = '/auth-login'
  private static readonly REFRESH_ENDPOINT = '/auth-refresh'
  private static readonly LOGOUT_ENDPOINT = '/auth-logout'

  /**
   * Get authentication challenge for wallet signing
   */
  static async getChallenge(walletAddress: string): Promise<AuthChallenge> {
    try {
      const response = await apiClient.post(this.CHALLENGE_ENDPOINT, {
        walletAddress: walletAddress.toLowerCase()
      })

      return {
        message: response.data.message,
        nonce: response.data.nonce,
        expiresAt: new Date(response.data.expiresAt)
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get authentication challenge')
    }
  }

  /**
   * Authenticate user with wallet signature
   */
  static async login(authRequest: AuthRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post(this.LOGIN_ENDPOINT, {
        walletAddress: authRequest.walletAddress.toLowerCase(),
        signature: authRequest.signature,
        message: authRequest.message,
        chainId: authRequest.chainId
      })

      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Authentication failed')
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshRequest: TokenRefreshRequest): Promise<TokenRefreshResponse> {
    try {
      const response = await apiClient.post(this.REFRESH_ENDPOINT, refreshRequest)
      return response.data
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Token refresh failed')
    }
  }

  /**
   * Logout user and invalidate tokens
   */
  static async logout(refreshToken: string): Promise<void> {
    try {
      await apiClient.post(this.LOGOUT_ENDPOINT, { refreshToken })
    } catch (error: any) {
      // Log error but don't throw - logout should always succeed locally
      console.warn('Server logout failed:', error.response?.data?.error || error.message)
    }
  }

  /**
   * Validate JWT token format and expiration
   */
  static validateToken(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Math.floor(Date.now() / 1000)
      return payload.exp > now
    } catch {
      return false
    }
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp * 1000 // Convert to milliseconds
    } catch {
      return null
    }
  }

  /**
   * Check if token needs refresh (expires within 5 minutes)
   */
  static shouldRefreshToken(token: string): boolean {
    const expiration = this.getTokenExpiration(token)
    if (!expiration) return true

    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000)
    return expiration < fiveMinutesFromNow
  }
}