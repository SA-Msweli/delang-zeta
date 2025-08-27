import { apiClient } from '../config/api'
import type {
  ValidationTask,
  ValidationSubmission,
  ValidationFormData,
  ValidatorStake,
  ValidationConsensus,
  ValidationReward,
  ValidationStats,
  ValidationFilters,
  ValidationQueue,
  StakingRequest,
  StakingResponse
} from '../types/validation'

export class ValidationService {
  private static readonly VALIDATION_ENDPOINT = '/validation'
  private static readonly STAKING_ENDPOINT = '/validator-staking'
  private static readonly CONSENSUS_ENDPOINT = '/validation-consensus'
  private static readonly REWARDS_ENDPOINT = '/validation-rewards'
  private static readonly STATS_ENDPOINT = '/validator-stats'

  /**
   * Get validation tasks queue for authenticated validator
   */
  static async getValidationQueue(
    filters: ValidationFilters = {},
    page = 1,
    limit = 10
  ): Promise<ValidationQueue> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.language && { language: filters.language }),
        ...(filters.dataType && { dataType: filters.dataType }),
        ...(filters.minAiScore && { minAiScore: filters.minAiScore.toString() }),
        ...(filters.maxAiScore && { maxAiScore: filters.maxAiScore.toString() }),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.status && { status: filters.status })
      })

      const response = await apiClient.get(`${this.VALIDATION_ENDPOINT}/queue?${params}`)

      return {
        tasks: response.data.tasks.map(this.transformValidationTask),
        total: response.data.total,
        hasMore: response.data.hasMore,
        nextCursor: response.data.nextCursor
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get validation queue')
    }
  }

  /**
   * Get specific validation task details
   */
  static async getValidationTask(taskId: string): Promise<ValidationTask> {
    try {
      const response = await apiClient.get(`${this.VALIDATION_ENDPOINT}/tasks/${taskId}`)
      return this.transformValidationTask(response.data)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get validation task')
    }
  }

  /**
   * Submit validation for a task
   */
  static async submitValidation(
    taskId: string,
    validationData: ValidationFormData
  ): Promise<ValidationSubmission> {
    try {
      const response = await apiClient.post(`${this.VALIDATION_ENDPOINT}/tasks/${taskId}/submit`, {
        score: validationData.score,
        feedback: validationData.feedback,
        issues: validationData.issues,
        confidence: validationData.confidence,
        timeSpent: validationData.timeSpent
      })

      return {
        id: response.data.id,
        validationTaskId: response.data.validationTaskId,
        validator: response.data.validator,
        score: response.data.score,
        feedback: response.data.feedback,
        issues: response.data.issues,
        timeSpent: response.data.timeSpent,
        confidence: response.data.confidence,
        submittedAt: new Date(response.data.submittedAt)
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to submit validation')
    }
  }

  /**
   * Stake tokens to become a validator
   */
  static async stakeTokens(stakingRequest: StakingRequest): Promise<StakingResponse> {
    try {
      const response = await apiClient.post(this.STAKING_ENDPOINT, {
        amount: stakingRequest.amount,
        token: stakingRequest.token,
        network: stakingRequest.network,
        duration: stakingRequest.duration
      })

      return {
        success: true,
        stakeId: response.data.stakeId,
        transactionHash: response.data.transactionHash,
        lockedUntil: response.data.lockedUntil ? new Date(response.data.lockedUntil) : undefined,
        message: response.data.message
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Failed to stake tokens'
      }
    }
  }

  /**
   * Get validator's current stake information
   */
  static async getValidatorStake(): Promise<ValidatorStake | null> {
    try {
      const response = await apiClient.get(`${this.STAKING_ENDPOINT}/current`)

      if (!response.data) return null

      return {
        validator: response.data.validator,
        amount: response.data.amount,
        token: response.data.token,
        network: response.data.network,
        stakedAt: new Date(response.data.stakedAt),
        lockedUntil: new Date(response.data.lockedUntil),
        reputation: response.data.reputation,
        totalValidations: response.data.totalValidations,
        accuracyScore: response.data.accuracyScore
      }
    } catch (error: any) {
      if (error.response?.status === 404) return null
      throw new Error(error.response?.data?.error || 'Failed to get validator stake')
    }
  }

  /**
   * Unstake tokens (if lock period has expired)
   */
  static async unstakeTokens(): Promise<StakingResponse> {
    try {
      const response = await apiClient.post(`${this.STAKING_ENDPOINT}/unstake`)

      return {
        success: true,
        transactionHash: response.data.transactionHash,
        message: response.data.message
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Failed to unstake tokens'
      }
    }
  }

  /**
   * Get validation consensus for a task
   */
  static async getValidationConsensus(taskId: string): Promise<ValidationConsensus> {
    try {
      const response = await apiClient.get(`${this.CONSENSUS_ENDPOINT}/${taskId}`)

      return {
        validationTaskId: response.data.validationTaskId,
        finalScore: response.data.finalScore,
        consensusReached: response.data.consensusReached,
        validatorScores: response.data.validatorScores,
        averageScore: response.data.averageScore,
        standardDeviation: response.data.standardDeviation,
        outliers: response.data.outliers,
        consensusThreshold: response.data.consensusThreshold,
        participatingValidators: response.data.participatingValidators,
        requiredValidators: response.data.requiredValidators,
        status: response.data.status,
        completedAt: response.data.completedAt ? new Date(response.data.completedAt) : undefined
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get validation consensus')
    }
  }

  /**
   * Get validator's rewards history
   */
  static async getValidationRewards(
    page = 1,
    limit = 10
  ): Promise<{ rewards: ValidationReward[], total: number, hasMore: boolean }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      const response = await apiClient.get(`${this.REWARDS_ENDPOINT}?${params}`)

      return {
        rewards: response.data.rewards.map((reward: any) => ({
          validator: reward.validator,
          validationTaskId: reward.validationTaskId,
          baseReward: reward.baseReward,
          bonusReward: reward.bonusReward,
          totalReward: reward.totalReward,
          token: reward.token,
          network: reward.network,
          accuracyBonus: reward.accuracyBonus,
          consensusBonus: reward.consensusBonus,
          paid: reward.paid,
          transactionHash: reward.transactionHash,
          paidAt: reward.paidAt ? new Date(reward.paidAt) : undefined
        })),
        total: response.data.total,
        hasMore: response.data.hasMore
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get validation rewards')
    }
  }

  /**
   * Get validator statistics
   */
  static async getValidatorStats(): Promise<ValidationStats> {
    try {
      const response = await apiClient.get(this.STATS_ENDPOINT)

      return {
        totalValidations: response.data.totalValidations,
        averageScore: response.data.averageScore,
        accuracyRate: response.data.accuracyRate,
        totalEarned: response.data.totalEarned,
        currentStake: response.data.currentStake,
        reputation: response.data.reputation,
        rank: response.data.rank,
        consensusRate: response.data.consensusRate
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get validator stats')
    }
  }

  /**
   * Claim pending validation rewards
   */
  static async claimRewards(rewardIds: string[]): Promise<{ success: boolean, transactionHash?: string, message: string }> {
    try {
      const response = await apiClient.post(`${this.REWARDS_ENDPOINT}/claim`, {
        rewardIds
      })

      return {
        success: true,
        transactionHash: response.data.transactionHash,
        message: response.data.message
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Failed to claim rewards'
      }
    }
  }

  /**
   * Get file content for validation (secure access)
   */
  static async getValidationFileAccess(taskId: string): Promise<{ accessUrl: string, expiresAt: Date }> {
    try {
      const response = await apiClient.post(`${this.VALIDATION_ENDPOINT}/tasks/${taskId}/access`)

      return {
        accessUrl: response.data.accessUrl,
        expiresAt: new Date(response.data.expiresAt)
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get file access')
    }
  }

  /**
   * Report validation task issues
   */
  static async reportValidationIssue(
    taskId: string,
    issueType: 'inappropriate_content' | 'technical_error' | 'spam' | 'other',
    description: string
  ): Promise<void> {
    try {
      await apiClient.post(`${this.VALIDATION_ENDPOINT}/tasks/${taskId}/report`, {
        issueType,
        description
      })
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to report issue')
    }
  }

  /**
   * Transform API response to ValidationTask type
   */
  private static transformValidationTask(data: any): ValidationTask {
    return {
      id: data.id,
      submissionId: data.submissionId,
      taskId: data.taskId,
      contributor: data.contributor,
      storageUrl: data.storageUrl,
      metadata: {
        language: data.metadata.language,
        wordCount: data.metadata.wordCount,
        duration: data.metadata.duration,
        fileSize: data.metadata.fileSize,
        mimeType: data.metadata.mimeType,
        originalFileName: data.metadata.originalFileName
      },
      aiScore: data.aiScore,
      aiAnalysis: {
        issues: data.aiAnalysis.issues || [],
        recommendations: data.aiAnalysis.recommendations || [],
        confidence: data.aiAnalysis.confidence
      },
      validationDeadline: new Date(data.validationDeadline),
      requiredValidators: data.requiredValidators,
      currentValidators: data.currentValidators,
      status: data.status,
      createdAt: new Date(data.createdAt)
    }
  }

  /**
   * Format token amount for display
   */
  static formatTokenAmount(amount: string, decimals = 18): string {
    const num = parseFloat(amount) / Math.pow(10, decimals)
    if (num < 0.001) return '< 0.001'
    if (num < 1) return num.toFixed(3)
    if (num < 1000) return num.toFixed(2)
    if (num < 1000000) return `${(num / 1000).toFixed(1)}K`
    return `${(num / 1000000).toFixed(1)}M`
  }

  /**
   * Calculate time remaining until deadline
   */
  static getTimeRemaining(deadline: Date): { text: string, urgent: boolean } {
    const now = new Date()
    const diff = deadline.getTime() - now.getTime()

    if (diff <= 0) return { text: 'Expired', urgent: true }

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours < 1) {
      return { text: `${minutes}m`, urgent: true }
    } else if (hours < 24) {
      return { text: `${hours}h ${minutes}m`, urgent: hours < 2 }
    } else {
      const days = Math.floor(hours / 24)
      return { text: `${days}d ${hours % 24}h`, urgent: false }
    }
  }

  /**
   * Get validation difficulty based on AI score and content type
   */
  static getValidationDifficulty(aiScore: number, _dataType: string): 'easy' | 'medium' | 'hard' {
    if (aiScore >= 80) return 'easy'
    if (aiScore >= 60) return 'medium'
    return 'hard'
  }
}