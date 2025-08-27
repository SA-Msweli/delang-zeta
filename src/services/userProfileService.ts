// User profile service for secure profile and statistics management

import { UserProfile } from '../types/auth'
import { tokenManager } from './tokenManager'
import { auditService } from './auditService'

interface UserStatistics {
  contributionsCount: number
  validationsCount: number
  totalEarned: string
  averageQuality: number
  recentActivity: ActivityItem[]
  rewardHistory: RewardHistoryItem[]
  reputationHistory: ReputationHistoryItem[]
}

interface ActivityItem {
  id: string
  type: 'contribution' | 'validation' | 'governance' | 'reward'
  description: string
  timestamp: Date
  status: 'completed' | 'pending' | 'failed'
  metadata?: any
}

interface RewardHistoryItem {
  id: string
  amount: string
  token: string
  network: string
  type: 'contribution' | 'validation' | 'governance'
  taskId?: string
  transactionHash: string
  timestamp: Date
  status: 'pending' | 'confirmed' | 'failed'
}

interface ReputationHistoryItem {
  id: string
  change: number
  newScore: number
  reason: string
  timestamp: Date
  relatedActivity?: string
}

interface PayoutPreferences {
  preferredNetwork: string
  preferredToken: string
  autoWithdraw: boolean
  minimumThreshold: string
  backupAddress?: string
}

interface PrivacySettings {
  showProfile: boolean
  showStatistics: boolean
  showRewardHistory: boolean
  showActivity: boolean
  allowDataSharing: boolean
}

interface ProfileUpdateRequest {
  preferences?: Partial<PayoutPreferences>
  privacy?: Partial<PrivacySettings>
  languages?: string[]
}

class UserProfileService {
  private baseUrl = '/api/profile'

  // Profile management
  async fetchUserProfile(address?: string): Promise<UserProfile> {
    try {
      const token = await tokenManager.getAccessToken()

      const params = address ? `?address=${address}` : ''
      const response = await fetch(`${this.baseUrl}${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user profile')
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching user profile:', error)
      throw error
    }
  }

  async updateProfile(updates: ProfileUpdateRequest): Promise<UserProfile> {
    try {
      const token = await tokenManager.getAccessToken()

      // Audit log for profile update
      await auditService.logActivity({
        action: 'profile_update',
        details: {
          updatedFields: Object.keys(updates),
          hasPreferences: !!updates.preferences,
          hasPrivacy: !!updates.privacy,
          hasLanguages: !!updates.languages
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      const response = await fetch(`${this.baseUrl}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        },
        body: JSON.stringify(updates)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update profile')
      }

      const updatedProfile = await response.json()

      // Log successful update
      await auditService.logActivity({
        action: 'profile_updated',
        details: { updatedFields: Object.keys(updates) },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      return updatedProfile
    } catch (error) {
      console.error('Error updating profile:', error)
      throw error
    }
  }

  // Statistics and activity
  async fetchUserStatistics(address?: string): Promise<UserStatistics> {
    try {
      const token = await tokenManager.getAccessToken()

      const params = address ? `?address=${address}` : ''
      const response = await fetch(`${this.baseUrl}/statistics${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user statistics')
      }

      const data = await response.json()
      return {
        ...data,
        recentActivity: data.recentActivity.map(this.transformActivity),
        rewardHistory: data.rewardHistory.map(this.transformRewardHistory),
        reputationHistory: data.reputationHistory.map(this.transformReputationHistory)
      }
    } catch (error) {
      console.error('Error fetching user statistics:', error)
      throw error
    }
  }

  async fetchRewardHistory(
    address?: string,
    limit = 50,
    offset = 0
  ): Promise<{ rewards: RewardHistoryItem[], total: number }> {
    try {
      const token = await tokenManager.getAccessToken()

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })

      if (address) params.append('address', address)

      const response = await fetch(`${this.baseUrl}/rewards?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch reward history')
      }

      const data = await response.json()
      return {
        rewards: data.rewards.map(this.transformRewardHistory),
        total: data.total
      }
    } catch (error) {
      console.error('Error fetching reward history:', error)
      throw error
    }
  }

  async fetchActivityHistory(
    address?: string,
    limit = 50,
    offset = 0
  ): Promise<{ activities: ActivityItem[], total: number }> {
    try {
      const token = await tokenManager.getAccessToken()

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })

      if (address) params.append('address', address)

      const response = await fetch(`${this.baseUrl}/activity?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch activity history')
      }

      const data = await response.json()
      return {
        activities: data.activities.map(this.transformActivity),
        total: data.total
      }
    } catch (error) {
      console.error('Error fetching activity history:', error)
      throw error
    }
  }

  // Payout preferences
  async updatePayoutPreferences(preferences: PayoutPreferences): Promise<void> {
    try {
      const token = await tokenManager.getAccessToken()

      // Audit log for payout preference update
      await auditService.logActivity({
        action: 'payout_preferences_update',
        details: {
          preferredNetwork: preferences.preferredNetwork,
          preferredToken: preferences.preferredToken,
          autoWithdraw: preferences.autoWithdraw,
          hasBackupAddress: !!preferences.backupAddress
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      const response = await fetch(`${this.baseUrl}/payout-preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        },
        body: JSON.stringify(preferences)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update payout preferences')
      }

      // Log successful update
      await auditService.logActivity({
        action: 'payout_preferences_updated',
        details: { preferredNetwork: preferences.preferredNetwork },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })
    } catch (error) {
      console.error('Error updating payout preferences:', error)
      throw error
    }
  }

  // Privacy settings
  async updatePrivacySettings(settings: PrivacySettings): Promise<void> {
    try {
      const token = await tokenManager.getAccessToken()

      // Audit log for privacy settings update
      await auditService.logActivity({
        action: 'privacy_settings_update',
        details: {
          showProfile: settings.showProfile,
          showStatistics: settings.showStatistics,
          allowDataSharing: settings.allowDataSharing
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      const response = await fetch(`${this.baseUrl}/privacy-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        },
        body: JSON.stringify(settings)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update privacy settings')
      }

      // Log successful update
      await auditService.logActivity({
        action: 'privacy_settings_updated',
        details: { allowDataSharing: settings.allowDataSharing },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })
    } catch (error) {
      console.error('Error updating privacy settings:', error)
      throw error
    }
  }

  // Transaction verification
  async verifyTransaction(transactionHash: string, network: string): Promise<boolean> {
    try {
      const token = await tokenManager.getAccessToken()

      const response = await fetch(`${this.baseUrl}/verify-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        },
        body: JSON.stringify({ transactionHash, network })
      })

      if (!response.ok) {
        throw new Error('Failed to verify transaction')
      }

      const result = await response.json()
      return result.verified
    } catch (error) {
      console.error('Error verifying transaction:', error)
      throw error
    }
  }

  // Data transformation helpers
  private transformActivity(data: any): ActivityItem {
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    }
  }

  private transformRewardHistory(data: any): RewardHistoryItem {
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    }
  }

  private transformReputationHistory(data: any): ReputationHistoryItem {
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    }
  }
}

export const userProfileService = new UserProfileService()
export type {
  UserStatistics,
  ActivityItem,
  RewardHistoryItem,
  ReputationHistoryItem,
  PayoutPreferences,
  PrivacySettings,
  ProfileUpdateRequest
}