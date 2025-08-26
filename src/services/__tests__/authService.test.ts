import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthService } from '../authService'
import { functionsClient } from '../../config/api'

// Mock the functions client
vi.mock('../../config/api', () => ({
  functionsClient: {
    post: vi.fn()
  }
}))

const mockFunctionsClient = vi.mocked(functionsClient)

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getChallenge', () => {
    it('should get authentication challenge successfully', async () => {
      const mockResponse = {
        data: {
          message: 'Sign this message to authenticate: 123456',
          nonce: '123456',
          expiresAt: '2024-01-01T12:00:00Z'
        }
      }

      mockFunctionsClient.post.mockResolvedValueOnce(mockResponse)

      const result = await AuthService.getChallenge('0x1234567890123456789012345678901234567890')

      expect(mockFunctionsClient.post).toHaveBeenCalledWith('/auth-challenge', {
        walletAddress: '0x1234567890123456789012345678901234567890'
      })

      expect(result).toEqual({
        message: 'Sign this message to authenticate: 123456',
        nonce: '123456',
        expiresAt: new Date('2024-01-01T12:00:00Z')
      })
    })

    it('should handle challenge request failure', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Invalid wallet address'
          }
        }
      }

      mockFunctionsClient.post.mockRejectedValueOnce(mockError)

      await expect(
        AuthService.getChallenge('invalid-address')
      ).rejects.toThrow('Invalid wallet address')
    })

    it('should handle network errors', async () => {
      mockFunctionsClient.post.mockRejectedValueOnce(new Error('Network error'))

      await expect(
        AuthService.getChallenge('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('Failed to get authentication challenge')
    })
  })

  describe('login', () => {
    it('should authenticate user successfully', async () => {
      const mockResponse = {
        data: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 3600,
          permissions: ['read', 'write'],
          user: {
            address: '0x1234567890123456789012345678901234567890',
            reputation: 100,
            statistics: {
              contributionsCount: 5,
              validationsCount: 10,
              totalEarned: '1000',
              averageQuality: 85
            },
            preferences: {
              payoutNetwork: 'ethereum',
              preferredToken: 'ETH',
              languages: ['en']
            },
            stakes: {
              validatorStake: '500',
              governanceTokens: '200'
            }
          }
        }
      }

      mockFunctionsClient.post.mockResolvedValueOnce(mockResponse)

      const authRequest = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
        message: 'Sign this message to authenticate: 123456',
        chainId: 1
      }

      const result = await AuthService.login(authRequest)

      expect(mockFunctionsClient.post).toHaveBeenCalledWith('/auth-login', {
        walletAddress: '0x1234567890123456789012345678901234567890',
        signature: '0xsignature',
        message: 'Sign this message to authenticate: 123456',
        chainId: 1
      })

      expect(result).toEqual(mockResponse.data)
    })

    it('should handle authentication failure', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Invalid signature'
          }
        }
      }

      mockFunctionsClient.post.mockRejectedValueOnce(mockError)

      const authRequest = {
        walletAddress: '0x1234567890123456789012345678901234567890',
        signature: 'invalid-signature',
        message: 'Sign this message to authenticate: 123456',
        chainId: 1
      }

      await expect(AuthService.login(authRequest)).rejects.toThrow('Invalid signature')
    })
  })

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockResponse = {
        data: {
          accessToken: 'new-access-token',
          expiresIn: 3600
        }
      }

      mockFunctionsClient.post.mockResolvedValueOnce(mockResponse)

      const result = await AuthService.refreshToken({ refreshToken: 'refresh-token' })

      expect(mockFunctionsClient.post).toHaveBeenCalledWith('/auth-refresh', {
        refreshToken: 'refresh-token'
      })

      expect(result).toEqual(mockResponse.data)
    })

    it('should handle refresh failure', async () => {
      const mockError = {
        response: {
          data: {
            error: 'Invalid refresh token'
          }
        }
      }

      mockFunctionsClient.post.mockRejectedValueOnce(mockError)

      await expect(
        AuthService.refreshToken({ refreshToken: 'invalid-token' })
      ).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('validateToken', () => {
    it('should validate valid JWT token', () => {
      // Create a mock JWT token (header.payload.signature)
      const payload = {
        sub: '0x1234567890123456789012345678901234567890',
        exp: Math.floor(Date.now() / 1000) + 3600 // Expires in 1 hour
      }

      const encodedPayload = btoa(JSON.stringify(payload))
      const mockToken = `header.${encodedPayload}.signature`

      const result = AuthService.validateToken(mockToken)
      expect(result).toBe(true)
    })

    it('should reject expired JWT token', () => {
      const payload = {
        sub: '0x1234567890123456789012345678901234567890',
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      }

      const encodedPayload = btoa(JSON.stringify(payload))
      const mockToken = `header.${encodedPayload}.signature`

      const result = AuthService.validateToken(mockToken)
      expect(result).toBe(false)
    })

    it('should reject malformed JWT token', () => {
      const result = AuthService.validateToken('invalid-token')
      expect(result).toBe(false)
    })
  })

  describe('shouldRefreshToken', () => {
    it('should return true for token expiring within 5 minutes', () => {
      const payload = {
        sub: '0x1234567890123456789012345678901234567890',
        exp: Math.floor(Date.now() / 1000) + 240 // Expires in 4 minutes
      }

      const encodedPayload = btoa(JSON.stringify(payload))
      const mockToken = `header.${encodedPayload}.signature`

      const result = AuthService.shouldRefreshToken(mockToken)
      expect(result).toBe(true)
    })

    it('should return false for token with plenty of time left', () => {
      const payload = {
        sub: '0x1234567890123456789012345678901234567890',
        exp: Math.floor(Date.now() / 1000) + 3600 // Expires in 1 hour
      }

      const encodedPayload = btoa(JSON.stringify(payload))
      const mockToken = `header.${encodedPayload}.signature`

      const result = AuthService.shouldRefreshToken(mockToken)
      expect(result).toBe(false)
    })

    it('should return true for malformed token', () => {
      const result = AuthService.shouldRefreshToken('invalid-token')
      expect(result).toBe(true)
    })
  })
})