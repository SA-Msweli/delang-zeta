// Validation system types and interfaces

export interface ValidationTask {
  id: string
  submissionId: string
  taskId: string
  contributor: string
  storageUrl: string
  metadata: {
    language: string
    wordCount?: number
    duration?: number
    fileSize: number
    mimeType: string
    originalFileName: string
  }
  aiScore: number
  aiAnalysis: {
    issues: string[]
    recommendations: string[]
    confidence: number
  }
  validationDeadline: Date
  requiredValidators: number
  currentValidators: number
  status: 'pending' | 'in_progress' | 'completed' | 'expired'
  createdAt: Date
}

export interface ValidationSubmission {
  id: string
  validationTaskId: string
  validator: string
  score: number // 0-100
  feedback: string
  issues: ValidationIssue[]
  timeSpent: number // in seconds
  confidence: number // 0-1
  submittedAt: Date
}

export interface ValidationIssue {
  type: 'quality' | 'language' | 'content' | 'format' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  suggestion?: string
}

export interface ValidatorStake {
  validator: string
  amount: string
  token: string
  network: string
  stakedAt: Date
  lockedUntil: Date
  reputation: number
  totalValidations: number
  accuracyScore: number
}

export interface ValidationConsensus {
  validationTaskId: string
  finalScore: number
  consensusReached: boolean
  validatorScores: number[]
  averageScore: number
  standardDeviation: number
  outliers: string[] // validator addresses
  consensusThreshold: number
  participatingValidators: number
  requiredValidators: number
  status: 'pending' | 'reached' | 'failed'
  completedAt?: Date
}

export interface ValidationReward {
  validator: string
  validationTaskId: string
  baseReward: string
  bonusReward: string
  totalReward: string
  token: string
  network: string
  accuracyBonus: number
  consensusBonus: number
  paid: boolean
  transactionHash?: string
  paidAt?: Date
}

export interface StakingRequest {
  amount: string
  token: string
  network: string
  duration: number // in days
}

export interface StakingResponse {
  success: boolean
  stakeId?: string
  transactionHash?: string
  lockedUntil?: Date
  message: string
}

export interface ValidationFormData {
  score: number
  feedback: string
  issues: ValidationIssue[]
  confidence: number
  timeSpent: number
}

export interface ValidationStats {
  totalValidations: number
  averageScore: number
  accuracyRate: number
  totalEarned: string
  currentStake: string
  reputation: number
  rank: number
  consensusRate: number
}

export interface ValidationFilters {
  language?: string
  dataType?: string
  minAiScore?: number
  maxAiScore?: number
  sortBy?: 'newest' | 'oldest' | 'highest_reward' | 'deadline'
  status?: 'pending' | 'in_progress' | 'completed'
}

export interface ValidationQueue {
  tasks: ValidationTask[]
  total: number
  hasMore: boolean
  nextCursor?: string
}