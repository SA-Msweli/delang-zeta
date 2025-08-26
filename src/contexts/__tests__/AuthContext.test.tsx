import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { AuthProvider, useAuth } from '../AuthContext'
import { AuthService } from '../../services/authService'
import { TokenManager } from '../../services/tokenManager'
import type { AuthResponse, UserProfile, AuthTokens } from '../../types/auth'

// Mock dependencies
vi.mock('../../services/authService')
vi.mock('../../services/tokenManager')
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

const mockAuthService = vi.mocked(AuthService)
const mockTokenManager = vi.mocked(TokenManager)

// Test component to access auth context
function TestComponent() {
  const auth = useAuth()

  return (
    <div>
      <div data-testid="authenticated">{auth.isAuthenticated.toString()}</div>
      <div data-testid="loading">{auth.isLoading.toString()}</div>
      <div data-testid="error">{auth.error || 'no-error'}</div>
      <div data-testid="user">{auth.user?.address || 'no-user'}</div>
      <button onClick={() => auth.login('0x123', 'signature', 'message', 1)}>
        Login
      </button>
      <button onClick={auth.logout}>Logout</button>
      <button onClick={auth.refreshToken}>Refresh</button>
      <button onClick={auth.clearError}>Clear Error</button>
    </div>
  )
}

describe('AuthContext', () => {
  const mockUser: UserProfile = {
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

  const mockTokens: AuthTokens = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 3600,
    tokenType: 'Bearer'
  }

  const mockAuthResponse: AuthResponse = {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    expiresIn: 3600,
    permissions: ['read', 'write'],
    user: mockUser
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('should provide initial auth state', () => {
    mockTokenManager.getTokens.mockReturnValue(null)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    expect(screen.getByTestId('error')).toHaveTextContent('no-error')
    expect(screen.getByTestId('user')).toHaveTextContent('no-user')
  })

  it('should handle successful login', async () => {
    mockTokenManager.getTokens.mockReturnValue(null)
    mockAuthService.login.mockResolvedValue(mockAuthResponse)
    mockTokenManager.setTokens.mockImplementation(() => { })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    // Trigger login
    await act(async () => {
      screen.getByText('Login').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
      expect(screen.getByTestId('user')).toHaveTextContent(mockUser.address)
      expect(screen.getByTestId('error')).toHaveTextContent('no-error')
    })

    expect(mockAuthService.login).toHaveBeenCalledWith({
      walletAddress: '0x123',
      signature: 'signature',
      message: 'message',
      chainId: 1
    })
    expect(mockTokenManager.setTokens).toHaveBeenCalledWith(mockTokens)
  })

  it('should handle login failure', async () => {
    mockTokenManager.getTokens.mockReturnValue(null)
    mockAuthService.login.mockRejectedValue(new Error('Authentication failed'))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    // Trigger login
    await act(async () => {
      screen.getByText('Login').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('error')).toHaveTextContent('Authentication failed')
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })
  })

  it('should handle logout', async () => {
    mockTokenManager.getTokens.mockReturnValue(mockTokens)
    mockTokenManager.getRefreshToken.mockReturnValue('refresh-token')
    mockAuthService.logout.mockResolvedValue()
    mockTokenManager.clearTokens.mockImplementation(() => { })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    })

    // Trigger logout
    await act(async () => {
      screen.getByText('Logout').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })

    expect(mockAuthService.logout).toHaveBeenCalledWith('refresh-token')
    expect(mockTokenManager.clearTokens).toHaveBeenCalled()
  })

  it('should handle token refresh', async () => {
    mockTokenManager.getTokens.mockReturnValue(mockTokens)
    mockTokenManager.getRefreshToken.mockReturnValue('refresh-token')
    mockAuthService.refreshToken.mockResolvedValue({
      accessToken: 'new-access-token',
      expiresIn: 3600
    })
    mockTokenManager.updateAccessToken.mockImplementation(() => { })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    })

    // Trigger token refresh
    await act(async () => {
      screen.getByText('Refresh').click()
    })

    expect(mockAuthService.refreshToken).toHaveBeenCalledWith({
      refreshToken: 'refresh-token'
    })
    expect(mockTokenManager.updateAccessToken).toHaveBeenCalledWith('new-access-token', 3600)
  })

  it('should handle token refresh failure', async () => {
    mockTokenManager.getTokens.mockReturnValue(mockTokens)
    mockTokenManager.getRefreshToken.mockReturnValue('refresh-token')
    mockAuthService.refreshToken.mockRejectedValue(new Error('Token refresh failed'))
    mockTokenManager.clearTokens.mockImplementation(() => { })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
    })

    // Trigger token refresh
    await act(async () => {
      screen.getByText('Refresh').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('user')).toHaveTextContent('no-user')
    })

    expect(mockTokenManager.clearTokens).toHaveBeenCalled()
  })

  it('should clear error', async () => {
    mockTokenManager.getTokens.mockReturnValue(null)
    mockAuthService.login.mockRejectedValue(new Error('Test error'))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })

    // Trigger login to create error
    await act(async () => {
      screen.getByText('Login').click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Test error')
    })

    // Clear error
    await act(async () => {
      screen.getByText('Clear Error').click()
    })

    expect(screen.getByTestId('error')).toHaveTextContent('no-error')
  })

  it('should initialize with existing valid tokens', async () => {
    mockTokenManager.getTokens.mockReturnValue(mockTokens)
    mockTokenManager.shouldRefreshToken.mockReturnValue(false)

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true')
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
    })
  })

  it('should refresh token on initialization if needed', async () => {
    mockTokenManager.getTokens.mockReturnValue(mockTokens)
    mockTokenManager.shouldRefreshToken.mockReturnValue(true)
    mockTokenManager.getRefreshToken.mockReturnValue('refresh-token')
    mockAuthService.refreshToken.mockResolvedValue({
      accessToken: 'new-access-token',
      expiresIn: 3600
    })
    mockTokenManager.updateAccessToken.mockImplementation(() => { })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await waitFor(() => {
      expect(mockAuthService.refreshToken).toHaveBeenCalled()
    })
  })

  it('should throw error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { })

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useAuth must be used within an AuthProvider')

    consoleSpy.mockRestore()
  })
})