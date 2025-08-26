import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TokenManager } from '../tokenManager'
import { AuthService } from '../authService'
import type { AuthTokens } from '../../types/auth'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

// Mock AuthService
vi.mock('../authService', () => ({
  AuthService: {
    validateToken: vi.fn(),
    shouldRefreshToken: vi.fn()
  }
}))

const mockAuthService = vi.mocked(AuthService)

describe('TokenManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setTokens', () => {
    it('should store tokens in localStorage', () => {
      const tokens: AuthTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      }

      TokenManager.setTokens(tokens)

      expect(localStorageMock.setItem).toHaveBeenCalledWith('delang_access_token', 'access-token')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('delang_refresh_token', 'refresh-token')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('delang_token_expiry', expect.any(String))
    })

    it('should handle storage errors gracefully', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage quota exceeded')
      })

      const tokens: AuthTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer'
      }

      expect(() => TokenManager.setTokens(tokens)).toThrow('Failed to store authentication tokens')
    })
  })

  describe('getAccessToken', () => {
    it('should return valid access token', () => {
      localStorageMock.getItem.mockReturnValueOnce('valid-token')
      mockAuthService.validateToken.mockReturnValueOnce(true)

      const result = TokenManager.getAccessToken()

      expect(result).toBe('valid-token')
      expect(mockAuthService.validateToken).toHaveBeenCalledWith('valid-token')
    })

    it('should return null for invalid token', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid-token')
      mockAuthService.validateToken.mockReturnValueOnce(false)

      const result = TokenManager.getAccessToken()

      expect(result).toBeNull()
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('delang_access_token')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('delang_refresh_token')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('delang_token_expiry')
    })

    it('should return null when no token exists', () => {
      localStorageMock.getItem.mockReturnValueOnce(null)

      const result = TokenManager.getAccessToken()

      expect(result).toBeNull()
    })

    it('should handle storage errors gracefully', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error')
      })

      const result = TokenManager.getAccessToken()

      expect(result).toBeNull()
    })
  })

  describe('getRefreshToken', () => {
    it('should return refresh token', () => {
      localStorageMock.getItem.mockReturnValueOnce('refresh-token')

      const result = TokenManager.getRefreshToken()

      expect(result).toBe('refresh-token')
      expect(localStorageMock.getItem).toHaveBeenCalledWith('delang_refresh_token')
    })

    it('should handle storage errors gracefully', () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error')
      })

      const result = TokenManager.getRefreshToken()

      expect(result).toBeNull()
    })
  })

  describe('hasValidTokens', () => {
    it('should return true when both tokens are valid', () => {
      localStorageMock.getItem
        .mockReturnValueOnce('valid-access-token')
        .mockReturnValueOnce('valid-refresh-token')
      mockAuthService.validateToken.mockReturnValueOnce(true)

      const result = TokenManager.hasValidTokens()

      expect(result).toBe(true)
    })

    it('should return false when access token is missing', () => {
      localStorageMock.getItem
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('valid-refresh-token')

      const result = TokenManager.hasValidTokens()

      expect(result).toBe(false)
    })

    it('should return false when refresh token is missing', () => {
      localStorageMock.getItem
        .mockReturnValueOnce('valid-access-token')
        .mockReturnValueOnce(null)
      mockAuthService.validateToken.mockReturnValueOnce(true)

      const result = TokenManager.hasValidTokens()

      expect(result).toBe(false)
    })
  })

  describe('shouldRefreshToken', () => {
    it('should return true when token needs refresh', () => {
      localStorageMock.getItem.mockReturnValueOnce('access-token')
      mockAuthService.validateToken.mockReturnValueOnce(true)
      mockAuthService.shouldRefreshToken.mockReturnValueOnce(true)

      const result = TokenManager.shouldRefreshToken()

      expect(result).toBe(true)
      expect(mockAuthService.shouldRefreshToken).toHaveBeenCalledWith('access-token')
    })

    it('should return false when no token exists', () => {
      localStorageMock.getItem.mockReturnValueOnce(null)

      const result = TokenManager.shouldRefreshToken()

      expect(result).toBe(false)
    })
  })

  describe('clearTokens', () => {
    it('should remove all tokens from localStorage', () => {
      TokenManager.clearTokens()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('delang_access_token')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('delang_refresh_token')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('delang_token_expiry')
    })

    it('should handle storage errors gracefully', () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('Storage error')
      })

      expect(() => TokenManager.clearTokens()).not.toThrow()
    })
  })

  describe('updateAccessToken', () => {
    it('should update access token and expiry', () => {
      TokenManager.updateAccessToken('new-access-token', 3600)

      expect(localStorageMock.setItem).toHaveBeenCalledWith('delang_access_token', 'new-access-token')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('delang_token_expiry', expect.any(String))
    })

    it('should handle storage errors', () => {
      localStorageMock.setItem.mockImplementationOnce(() => {
        throw new Error('Storage error')
      })

      expect(() => TokenManager.updateAccessToken('new-token', 3600)).toThrow('Failed to update access token')
    })
  })

  describe('getTokens', () => {
    it('should return complete token object', () => {
      const now = Date.now()
      const expiry = now + 3600000 // 1 hour from now

      localStorageMock.getItem
        .mockReturnValueOnce('access-token')
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce(expiry.toString())
      mockAuthService.validateToken.mockReturnValueOnce(true)

      const result = TokenManager.getTokens()

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: expect.any(Number),
        tokenType: 'Bearer'
      })
      expect(result!.expiresIn).toBeGreaterThan(3500) // Should be close to 3600
    })

    it('should return null when tokens are incomplete', () => {
      localStorageMock.getItem
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('refresh-token')
        .mockReturnValueOnce('1234567890')

      const result = TokenManager.getTokens()

      expect(result).toBeNull()
    })
  })
})