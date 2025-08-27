import { useState, useCallback, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { ValidationService } from '../services/validationService'
import type {
  ValidationTask,
  ValidationFormData,
  ValidationSubmission,
  ValidatorStake,
  ValidationStats,
  ValidationFilters,
  StakingRequest
} from '../types/validation'

interface UseValidationOptions {
  autoRefresh?: boolean
  refreshInterval?: number
}

interface ValidationState {
  queue: ValidationTask[]
  currentTask: ValidationTask | null
  validatorStake: ValidatorStake | null
  stats: ValidationStats | null
  isLoading: boolean
  isSubmitting: boolean
  isStaking: boolean
  error: string | null
  hasMore: boolean
  page: number
}

export function useValidation(options: UseValidationOptions = {}) {
  const { autoRefresh = false, refreshInterval = 30000 } = options

  const [state, setState] = useState<ValidationState>({
    queue: [],
    currentTask: null,
    validatorStake: null,
    stats: null,
    isLoading: false,
    isSubmitting: false,
    isStaking: false,
    error: null,
    hasMore: false,
    page: 1
  })

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [setError])

  // Load validation queue
  const loadValidationQueue = useCallback(async (
    filters: ValidationFilters = {},
    page = 1,
    append = false
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const result = await ValidationService.getValidationQueue(filters, page, 10)

      setState(prev => ({
        ...prev,
        queue: append ? [...prev.queue, ...result.tasks] : result.tasks,
        hasMore: result.hasMore,
        page,
        isLoading: false
      }))
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load validation queue'
      setError(errorMessage)
      setState(prev => ({ ...prev, isLoading: false }))
      toast.error(errorMessage)
    }
  }, [setError])

  // Load more tasks (pagination)
  const loadMore = useCallback(async (filters: ValidationFilters = {}) => {
    if (state.isLoading || !state.hasMore) return

    await loadValidationQueue(filters, state.page + 1, true)
  }, [state.isLoading, state.hasMore, state.page, loadValidationQueue])

  // Load specific validation task
  const loadValidationTask = useCallback(async (taskId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const task = await ValidationService.getValidationTask(taskId)

      setState(prev => ({
        ...prev,
        currentTask: task,
        isLoading: false
      }))

      return task
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load validation task'
      setError(errorMessage)
      setState(prev => ({ ...prev, isLoading: false }))
      toast.error(errorMessage)
      return null
    }
  }, [setError])

  // Submit validation
  const submitValidation = useCallback(async (
    taskId: string,
    validationData: ValidationFormData
  ): Promise<ValidationSubmission | null> => {
    try {
      setState(prev => ({ ...prev, isSubmitting: true, error: null }))

      const submission = await ValidationService.submitValidation(taskId, validationData)

      setState(prev => ({ ...prev, isSubmitting: false }))
      toast.success('Validation submitted successfully!')

      // Refresh queue to remove completed task
      await loadValidationQueue()

      return submission
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to submit validation'
      setError(errorMessage)
      setState(prev => ({ ...prev, isSubmitting: false }))
      toast.error(errorMessage)
      return null
    }
  }, [setError, loadValidationQueue])

  // Load validator stake
  const loadValidatorStake = useCallback(async () => {
    try {
      const stake = await ValidationService.getValidatorStake()
      setState(prev => ({ ...prev, validatorStake: stake }))
      return stake
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load validator stake'
      setError(errorMessage)
      toast.error(errorMessage)
      return null
    }
  }, [setError])

  // Stake tokens
  const stakeTokens = useCallback(async (stakingRequest: StakingRequest): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isStaking: true, error: null }))

      const result = await ValidationService.stakeTokens(stakingRequest)

      setState(prev => ({ ...prev, isStaking: false }))

      if (result.success) {
        toast.success(result.message)
        // Refresh stake info
        await loadValidatorStake()
        return true
      } else {
        toast.error(result.message)
        return false
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to stake tokens'
      setError(errorMessage)
      setState(prev => ({ ...prev, isStaking: false }))
      toast.error(errorMessage)
      return false
    }
  }, [setError, loadValidatorStake])

  // Unstake tokens
  const unstakeTokens = useCallback(async (): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isStaking: true, error: null }))

      const result = await ValidationService.unstakeTokens()

      setState(prev => ({ ...prev, isStaking: false }))

      if (result.success) {
        toast.success(result.message)
        // Refresh stake info
        await loadValidatorStake()
        return true
      } else {
        toast.error(result.message)
        return false
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to unstake tokens'
      setError(errorMessage)
      setState(prev => ({ ...prev, isStaking: false }))
      toast.error(errorMessage)
      return false
    }
  }, [setError, loadValidatorStake])

  // Load validator stats
  const loadValidatorStats = useCallback(async () => {
    try {
      const stats = await ValidationService.getValidatorStats()
      setState(prev => ({ ...prev, stats }))
      return stats
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load validator stats'
      setError(errorMessage)
      toast.error(errorMessage)
      return null
    }
  }, [setError])

  // Get file access for validation
  const getFileAccess = useCallback(async (taskId: string) => {
    try {
      const access = await ValidationService.getValidationFileAccess(taskId)
      return access
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to get file access'
      toast.error(errorMessage)
      return null
    }
  }, [])

  // Report validation issue
  const reportIssue = useCallback(async (
    taskId: string,
    issueType: 'inappropriate_content' | 'technical_error' | 'spam' | 'other',
    description: string
  ): Promise<boolean> => {
    try {
      await ValidationService.reportValidationIssue(taskId, issueType, description)
      toast.success('Issue reported successfully')
      return true
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to report issue'
      toast.error(errorMessage)
      return false
    }
  }, [])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadValidationQueue()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, loadValidationQueue])

  // Initialize data on mount
  useEffect(() => {
    loadValidationQueue()
    loadValidatorStake()
    loadValidatorStats()
  }, []) // Only run on mount

  return {
    // State
    queue: state.queue,
    currentTask: state.currentTask,
    validatorStake: state.validatorStake,
    stats: state.stats,
    isLoading: state.isLoading,
    isSubmitting: state.isSubmitting,
    isStaking: state.isStaking,
    error: state.error,
    hasMore: state.hasMore,
    page: state.page,

    // Actions
    loadValidationQueue,
    loadMore,
    loadValidationTask,
    submitValidation,
    stakeTokens,
    unstakeTokens,
    loadValidatorStake,
    loadValidatorStats,
    getFileAccess,
    reportIssue,
    clearError,

    // Utilities
    formatTokenAmount: ValidationService.formatTokenAmount,
    getTimeRemaining: ValidationService.getTimeRemaining,
    getValidationDifficulty: ValidationService.getValidationDifficulty
  }
}