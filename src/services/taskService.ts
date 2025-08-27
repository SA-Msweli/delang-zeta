import { apiClient } from '../config/api'
import type {
  Task,
  TaskFormData,
  TaskFilters,
  TaskStats,
  TaskProgress,
  TaskSponsorship,
  TaskCreateRequest,
  TaskCreateResponse,
  TaskUpdateRequest,
  TaskSponsorshipRequest
} from '../types/task'

export class TaskService {
  private static readonly TASKS_ENDPOINT = '/tasks'
  private static readonly TASK_STATS_ENDPOINT = '/task-stats'
  private static readonly TASK_PROGRESS_ENDPOINT = '/task-progress'
  private static readonly TASK_SPONSORSHIP_ENDPOINT = '/task-sponsorship'

  /**
   * Get tasks with filtering and pagination
   */
  static async getTasks(
    filters: TaskFilters = {},
    page = 1,
    limit = 10
  ): Promise<{ tasks: Task[], total: number, hasMore: boolean }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.language && { language: filters.language }),
        ...(filters.dataType && { dataType: filters.dataType }),
        ...(filters.creator && { creator: filters.creator }),
        ...(filters.minReward && { minReward: filters.minReward }),
        ...(filters.maxReward && { maxReward: filters.maxReward }),
        ...(filters.sortBy && { sortBy: filters.sortBy })
      })

      const response = await apiClient.get(`${this.TASKS_ENDPOINT}?${params}`)

      return {
        tasks: response.data.tasks.map(this.transformTask),
        total: response.data.total,
        hasMore: response.data.hasMore
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get tasks')
    }
  }

  /**
   * Get specific task by ID
   */
  static async getTask(taskId: string): Promise<Task> {
    try {
      const response = await apiClient.get(`${this.TASKS_ENDPOINT}/${taskId}`)
      return this.transformTask(response.data)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get task')
    }
  }

  /**
   * Create a new task
   */
  static async createTask(taskData: TaskFormData): Promise<TaskCreateResponse> {
    try {
      const request: TaskCreateRequest = {
        title: taskData.title,
        description: taskData.description,
        language: taskData.language,
        dataType: taskData.dataType,
        criteria: {
          minWordCount: taskData.criteria.minWordCount,
          maxWordCount: taskData.criteria.maxWordCount,
          minDuration: taskData.criteria.minDuration,
          maxDuration: taskData.criteria.maxDuration,
          qualityThreshold: taskData.criteria.qualityThreshold,
          specificRequirements: taskData.criteria.specificRequirements,
          allowedFormats: taskData.criteria.allowedFormats,
          languageRequirements: []
        },
        reward: {
          total: taskData.reward.total,
          perSubmission: this.calculatePerSubmissionReward(taskData.reward.total, taskData.maxSubmissions),
          token: taskData.reward.token,
          network: taskData.reward.network,
          bonusRewards: [],
          distributionMethod: taskData.reward.distributionMethod
        },
        deadline: taskData.deadline,
        maxSubmissions: taskData.maxSubmissions,
        requiredValidators: taskData.requiredValidators
      }

      const response = await apiClient.post(this.TASKS_ENDPOINT, request)

      return {
        success: true,
        taskId: response.data.taskId,
        transactionHash: response.data.transactionHash,
        escrowAddress: response.data.escrowAddress,
        message: response.data.message
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Failed to create task',
        errors: error.response?.data?.errors || []
      }
    }
  }

  /**
   * Update an existing task
   */
  static async updateTask(taskId: string, updates: TaskUpdateRequest): Promise<{ success: boolean, message: string }> {
    try {
      const response = await apiClient.patch(`${this.TASKS_ENDPOINT}/${taskId}`, updates)

      return {
        success: true,
        message: response.data.message
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Failed to update task'
      }
    }
  }

  /**
   * Delete/cancel a task
   */
  static async deleteTask(taskId: string): Promise<{ success: boolean, message: string }> {
    try {
      const response = await apiClient.delete(`${this.TASKS_ENDPOINT}/${taskId}`)

      return {
        success: true,
        message: response.data.message
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Failed to delete task'
      }
    }
  }

  /**
   * Get user's created tasks
   */
  static async getUserTasks(
    page = 1,
    limit = 10
  ): Promise<{ tasks: Task[], total: number, hasMore: boolean }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      })

      const response = await apiClient.get(`${this.TASKS_ENDPOINT}/my-tasks?${params}`)

      return {
        tasks: response.data.tasks.map(this.transformTask),
        total: response.data.total,
        hasMore: response.data.hasMore
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get user tasks')
    }
  }

  /**
   * Get task statistics
   */
  static async getTaskStats(): Promise<TaskStats> {
    try {
      const response = await apiClient.get(this.TASK_STATS_ENDPOINT)

      return {
        totalTasks: response.data.totalTasks,
        activeTasks: response.data.activeTasks,
        completedTasks: response.data.completedTasks,
        totalRewardsDistributed: response.data.totalRewardsDistributed,
        averageQualityScore: response.data.averageQualityScore,
        topLanguages: response.data.topLanguages,
        recentActivity: response.data.recentActivity.map((activity: any) => ({
          ...activity,
          timestamp: new Date(activity.timestamp)
        }))
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get task stats')
    }
  }

  /**
   * Get task progress details
   */
  static async getTaskProgress(taskId: string): Promise<TaskProgress> {
    try {
      const response = await apiClient.get(`${this.TASK_PROGRESS_ENDPOINT}/${taskId}`)

      return {
        taskId: response.data.taskId,
        submissionsReceived: response.data.submissionsReceived,
        maxSubmissions: response.data.maxSubmissions,
        averageQualityScore: response.data.averageQualityScore,
        validationsCompleted: response.data.validationsCompleted,
        rewardsDistributed: response.data.rewardsDistributed,
        timeRemaining: response.data.timeRemaining,
        status: response.data.status,
        milestones: response.data.milestones.map((milestone: any) => ({
          ...milestone,
          targetDate: new Date(milestone.targetDate),
          completedAt: milestone.completedAt ? new Date(milestone.completedAt) : undefined
        }))
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get task progress')
    }
  }

  /**
   * Sponsor a task with additional funding
   */
  static async sponsorTask(
    taskId: string,
    sponsorshipData: TaskSponsorshipRequest
  ): Promise<{ success: boolean, transactionHash?: string, message: string }> {
    try {
      const response = await apiClient.post(`${this.TASK_SPONSORSHIP_ENDPOINT}/${taskId}`, {
        amount: sponsorshipData.amount,
        token: sponsorshipData.token,
        network: sponsorshipData.network,
        message: sponsorshipData.message
      })

      return {
        success: true,
        transactionHash: response.data.transactionHash,
        message: response.data.message
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.error || 'Failed to sponsor task'
      }
    }
  }

  /**
   * Get task sponsorships
   */
  static async getTaskSponsorships(taskId: string): Promise<TaskSponsorship[]> {
    try {
      const response = await apiClient.get(`${this.TASK_SPONSORSHIP_ENDPOINT}/${taskId}`)

      return response.data.sponsorships.map((sponsorship: any) => ({
        ...sponsorship,
        sponsoredAt: new Date(sponsorship.sponsoredAt)
      }))
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get task sponsorships')
    }
  }

  /**
   * Get trending tasks
   */
  static async getTrendingTasks(limit = 10): Promise<Task[]> {
    try {
      const response = await apiClient.get(`${this.TASKS_ENDPOINT}/trending?limit=${limit}`)
      return response.data.tasks.map(this.transformTask)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get trending tasks')
    }
  }

  /**
   * Search tasks by text
   */
  static async searchTasks(
    query: string,
    filters: TaskFilters = {},
    page = 1,
    limit = 10
  ): Promise<{ tasks: Task[], total: number, hasMore: boolean }> {
    try {
      const params = new URLSearchParams({
        q: query,
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.status && { status: filters.status }),
        ...(filters.language && { language: filters.language }),
        ...(filters.dataType && { dataType: filters.dataType })
      })

      const response = await apiClient.get(`${this.TASKS_ENDPOINT}/search?${params}`)

      return {
        tasks: response.data.tasks.map(this.transformTask),
        total: response.data.total,
        hasMore: response.data.hasMore
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to search tasks')
    }
  }

  /**
   * Transform API response to Task type
   */
  private static transformTask(data: any): Task {
    return {
      id: data.id,
      creator: data.creator,
      title: data.title,
      description: data.description,
      language: data.language,
      dataType: data.dataType,
      criteria: data.criteria,
      reward: data.reward,
      deadline: new Date(data.deadline),
      status: data.status,
      submissions: data.submissions || [],
      maxSubmissions: data.maxSubmissions,
      currentSubmissions: data.currentSubmissions,
      requiredValidators: data.requiredValidators,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    }
  }

  /**
   * Calculate per-submission reward
   */
  private static calculatePerSubmissionReward(total: string, maxSubmissions: number): string {
    const totalAmount = parseFloat(total)
    const perSubmission = totalAmount / maxSubmissions
    return perSubmission.toString()
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

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

    if (days > 7) {
      return { text: `${days} days`, urgent: false }
    } else if (days > 0) {
      return { text: `${days}d ${hours}h`, urgent: days <= 2 }
    } else if (hours > 0) {
      return { text: `${hours}h`, urgent: true }
    } else {
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      return { text: `${minutes}m`, urgent: true }
    }
  }

  /**
   * Get task completion percentage
   */
  static getCompletionPercentage(currentSubmissions: number, maxSubmissions: number): number {
    return Math.round((currentSubmissions / maxSubmissions) * 100)
  }

  /**
   * Get task status color
   */
  static getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200'
      case 'draft': return 'text-gray-600 bg-gray-50 border-gray-200'
      case 'paused': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'completed': return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'expired': return 'text-red-600 bg-red-50 border-red-200'
      case 'cancelled': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  /**
   * Validate task form data
   */
  static validateTaskForm(data: TaskFormData): string[] {
    const errors: string[] = []

    if (!data.title.trim()) errors.push('Title is required')
    if (data.title.length > 100) errors.push('Title must be less than 100 characters')

    if (!data.description.trim()) errors.push('Description is required')
    if (data.description.length < 50) errors.push('Description must be at least 50 characters')

    if (!data.language) errors.push('Language is required')
    if (!data.dataType) errors.push('Data type is required')

    if (data.criteria.qualityThreshold < 0 || data.criteria.qualityThreshold > 100) {
      errors.push('Quality threshold must be between 0 and 100')
    }

    if (parseFloat(data.reward.total) <= 0) errors.push('Reward amount must be greater than 0')
    if (!data.reward.token) errors.push('Reward token is required')
    if (!data.reward.network) errors.push('Reward network is required')

    if (data.deadline <= new Date()) errors.push('Deadline must be in the future')
    if (data.maxSubmissions <= 0) errors.push('Max submissions must be greater than 0')
    if (data.requiredValidators <= 0) errors.push('Required validators must be greater than 0')

    return errors
  }
}