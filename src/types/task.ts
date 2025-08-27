// Task management types and interfaces

export interface Task {
  id: string
  creator: string
  title: string
  description: string
  language: string
  dataType: 'text' | 'audio' | 'image' | 'video'
  criteria: TaskCriteria
  reward: TaskReward
  deadline: Date
  status: 'draft' | 'active' | 'paused' | 'completed' | 'expired' | 'cancelled'
  submissions: TaskSubmission[]
  maxSubmissions: number
  currentSubmissions: number
  requiredValidators: number
  createdAt: Date
  updatedAt: Date
}

export interface TaskCriteria {
  minWordCount?: number
  maxWordCount?: number
  minDuration?: number
  maxDuration?: number
  qualityThreshold: number
  specificRequirements: string[]
  allowedFormats: string[]
  languageRequirements: LanguageRequirement[]
}

export interface LanguageRequirement {
  language: string
  nativeLevel: boolean
  dialectSpecific?: string
  culturalContext?: string
}

export interface TaskReward {
  total: string
  perSubmission: string
  token: string
  network: string
  bonusRewards: BonusReward[]
  escrowAddress?: string
  distributionMethod: 'immediate' | 'milestone' | 'completion'
}

export interface BonusReward {
  type: 'quality' | 'speed' | 'volume' | 'first'
  threshold: number
  amount: string
  description: string
}

export interface TaskSubmission {
  id: string
  contributor: string
  submittedAt: Date
  status: 'pending' | 'reviewing' | 'approved' | 'rejected'
  qualityScore: number
  validatorCount: number
  rewardPaid: boolean
}

export interface TaskFormData {
  title: string
  description: string
  language: string
  dataType: 'text' | 'audio' | 'image' | 'video'
  criteria: {
    minWordCount?: number
    maxWordCount?: number
    minDuration?: number
    maxDuration?: number
    qualityThreshold: number
    specificRequirements: string[]
    allowedFormats: string[]
  }
  reward: {
    total: string
    token: string
    network: string
    distributionMethod: 'immediate' | 'milestone' | 'completion'
  }
  deadline: Date
  maxSubmissions: number
  requiredValidators: number
}

export interface TaskFilters {
  status?: string
  language?: string
  dataType?: string
  creator?: string
  minReward?: string
  maxReward?: string
  sortBy?: 'newest' | 'oldest' | 'highest_reward' | 'deadline' | 'most_submissions'
}

export interface TaskStats {
  totalTasks: number
  activeTasks: number
  completedTasks: number
  totalRewardsDistributed: string
  averageQualityScore: number
  topLanguages: LanguageStats[]
  recentActivity: TaskActivity[]
}

export interface LanguageStats {
  language: string
  taskCount: number
  averageReward: string
  completionRate: number
}

export interface TaskActivity {
  id: string
  type: 'created' | 'submitted' | 'validated' | 'completed' | 'expired'
  taskId: string
  taskTitle: string
  actor: string
  timestamp: Date
  details: Record<string, any>
}

export interface TaskProgress {
  taskId: string
  submissionsReceived: number
  maxSubmissions: number
  averageQualityScore: number
  validationsCompleted: number
  rewardsDistributed: string
  timeRemaining: number
  status: 'on_track' | 'behind' | 'at_risk' | 'completed'
  milestones: TaskMilestone[]
}

export interface TaskMilestone {
  id: string
  name: string
  description: string
  targetDate: Date
  completed: boolean
  completedAt?: Date
  requirements: string[]
}

export interface TaskSponsorship {
  taskId: string
  sponsor: string
  amount: string
  token: string
  network: string
  transactionHash: string
  sponsoredAt: Date
  message?: string
}

export interface TaskCreateRequest {
  title: string
  description: string
  language: string
  dataType: 'text' | 'audio' | 'image' | 'video'
  criteria: TaskCriteria
  reward: Omit<TaskReward, 'escrowAddress'>
  deadline: Date
  maxSubmissions: number
  requiredValidators: number
}

export interface TaskCreateResponse {
  success: boolean
  taskId?: string
  transactionHash?: string
  escrowAddress?: string
  message: string
  errors?: ValidationError[]
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface TaskUpdateRequest {
  title?: string
  description?: string
  deadline?: Date
  maxSubmissions?: number
  status?: 'active' | 'paused' | 'cancelled'
}

export interface TaskSponsorshipRequest {
  amount: string
  token: string
  network: string
  message?: string
}