// Authentication types and interfaces

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface AuthRequest {
  walletAddress: string
  signature: string
  message: string
  chainId: number
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  permissions: string[]
  user: UserProfile
}

export interface UserProfile {
  address: string
  reputation: number
  statistics: {
    contributionsCount: number
    validationsCount: number
    totalEarned: string
    averageQuality: number
  }
  preferences: {
    payoutNetwork: string
    preferredToken: string
    languages: string[]
  }
  stakes: {
    validatorStake: string
    governanceTokens: string
  }
}

export interface AuthChallenge {
  message: string
  nonce: string
  expiresAt: Date
}

export interface TokenRefreshRequest {
  refreshToken: string
}

export interface TokenRefreshResponse {
  accessToken: string
  expiresIn: number
}

export interface AuthState {
  isAuthenticated: boolean
  user: UserProfile | null
  tokens: AuthTokens | null
  isLoading: boolean
  error: string | null
}

export interface AuthContextType extends AuthState {
  login: (walletAddress: string, signature: string, message: string, chainId: number) => Promise<void>
  logout: () => void
  refreshToken: () => Promise<void>
  clearError: () => void
}