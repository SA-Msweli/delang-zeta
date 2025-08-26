import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { AuthService } from '../services/authService'
import { TokenManager } from '../services/tokenManager'
import type { AuthState, AuthContextType, UserProfile, AuthTokens } from '../types/auth'

// Auth reducer actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: UserProfile; tokens: AuthTokens } }
  | { type: 'AUTH_ERROR'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'TOKEN_REFRESH_SUCCESS'; payload: { accessToken: string; expiresIn: number } }
  | { type: 'CLEAR_ERROR' }
  | { type: 'SET_LOADING'; payload: boolean }

// Initial auth state
const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  tokens: null,
  isLoading: true, // Start with loading to check existing tokens
  error: null
}

// Auth reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null
      }

    case 'AUTH_SUCCESS':
      return {
        ...state,
        isAuthenticated: true,
        user: action.payload.user,
        tokens: action.payload.tokens,
        isLoading: false,
        error: null
      }

    case 'AUTH_ERROR':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tokens: null,
        isLoading: false,
        error: action.payload
      }

    case 'AUTH_LOGOUT':
      return {
        ...state,
        isAuthenticated: false,
        user: null,
        tokens: null,
        isLoading: false,
        error: null
      }

    case 'TOKEN_REFRESH_SUCCESS':
      return {
        ...state,
        tokens: state.tokens ? {
          ...state.tokens,
          accessToken: action.payload.accessToken,
          expiresIn: action.payload.expiresIn
        } : null,
        error: null
      }

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      }

    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      }

    default:
      return state
  }
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState)

  // Auto-refresh token timer
  const setupTokenRefresh = useCallback((expiresIn: number) => {
    // Refresh token 5 minutes before expiry
    const refreshTime = Math.max(0, (expiresIn - 300) * 1000)

    setTimeout(() => {
      if (TokenManager.hasValidTokens()) {
        refreshToken()
      }
    }, refreshTime)
  }, [])

  // Login function
  const login = useCallback(async (
    walletAddress: string,
    signature: string,
    message: string,
    chainId: number
  ) => {
    dispatch({ type: 'AUTH_START' })

    try {
      const authResponse = await AuthService.login({
        walletAddress,
        signature,
        message,
        chainId
      })

      const tokens: AuthTokens = {
        accessToken: authResponse.accessToken,
        refreshToken: authResponse.refreshToken,
        expiresIn: authResponse.expiresIn,
        tokenType: 'Bearer'
      }

      // Store tokens securely
      TokenManager.setTokens(tokens)

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: {
          user: authResponse.user,
          tokens
        }
      })

      // Setup auto-refresh
      setupTokenRefresh(authResponse.expiresIn)

      toast.success('Successfully authenticated!')
    } catch (error: any) {
      const errorMessage = error.message || 'Authentication failed'
      dispatch({ type: 'AUTH_ERROR', payload: errorMessage })
      toast.error(errorMessage)
      throw error
    }
  }, [setupTokenRefresh])

  // Logout function
  const logout = useCallback(async () => {
    const refreshToken = TokenManager.getRefreshToken()

    if (refreshToken) {
      try {
        await AuthService.logout(refreshToken)
      } catch (error) {
        console.warn('Server logout failed:', error)
      }
    }

    TokenManager.clearTokens()
    dispatch({ type: 'AUTH_LOGOUT' })
    toast.success('Logged out successfully')
  }, [])

  // Refresh token function
  const refreshToken = useCallback(async () => {
    const storedRefreshToken = TokenManager.getRefreshToken()

    if (!storedRefreshToken) {
      dispatch({ type: 'AUTH_LOGOUT' })
      return
    }

    try {
      const response = await AuthService.refreshToken({
        refreshToken: storedRefreshToken
      })

      TokenManager.updateAccessToken(response.accessToken, response.expiresIn)

      dispatch({
        type: 'TOKEN_REFRESH_SUCCESS',
        payload: {
          accessToken: response.accessToken,
          expiresIn: response.expiresIn
        }
      })

      // Setup next refresh
      setupTokenRefresh(response.expiresIn)
    } catch (error: any) {
      console.error('Token refresh failed:', error)
      dispatch({ type: 'AUTH_LOGOUT' })
      TokenManager.clearTokens()
      toast.error('Session expired. Please reconnect your wallet.')
    }
  }, [setupTokenRefresh])

  // Clear error function
  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  // Initialize auth state on mount
  useEffect(() => {
    const initializeAuth = async () => {
      dispatch({ type: 'SET_LOADING', payload: true })

      try {
        const tokens = TokenManager.getTokens()

        if (!tokens) {
          dispatch({ type: 'SET_LOADING', payload: false })
          return
        }

        // Check if token needs refresh
        if (TokenManager.shouldRefreshToken()) {
          await refreshToken()
        } else {
          // Tokens are valid, but we need user profile
          // In a real app, you might want to fetch user profile here
          // For now, we'll just mark as authenticated with stored tokens
          dispatch({
            type: 'AUTH_SUCCESS',
            payload: {
              user: {
                address: '',
                reputation: 0,
                statistics: {
                  contributionsCount: 0,
                  validationsCount: 0,
                  totalEarned: '0',
                  averageQuality: 0
                },
                preferences: {
                  payoutNetwork: 'ethereum',
                  preferredToken: 'ETH',
                  languages: ['en']
                },
                stakes: {
                  validatorStake: '0',
                  governanceTokens: '0'
                }
              },
              tokens
            }
          })

          setupTokenRefresh(tokens.expiresIn)
        }
      } catch (error) {
        console.error('Auth initialization failed:', error)
        TokenManager.clearTokens()
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    initializeAuth()
  }, [refreshToken, setupTokenRefresh])

  // Context value
  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshToken,
    clearError
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook to use auth context
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}