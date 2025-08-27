import { useState, useCallback, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import { TaskService } from '../services/taskService'
import type {
  Task,
  TaskFormData,
  TaskFilters,
  TaskStats,
  TaskProgress,
  TaskUpdateRequest,
  TaskSponsorshipRequest
} from '../types/task'

interface UseTaskManagementOptions {
  autoRefresh?: boolean
  refreshInterval?: number
}

interface TaskManagementState {
  tasks: Task[]
  userTasks: Task[]
  currentTask: Task | null
  taskProgress: TaskProgress | null
  stats: TaskStats | null
  isLoading: boolean
  isCreating: boolean
  isUpdating: boolean
  isSponsoring: boolean
  error: string | null
  hasMore: boolean
  page: number
}

export function useTaskManagement(options: UseTaskManagementOptions = {}) {
  const { autoRefresh = false, refreshInterval = 60000 } = options

  const [state, setState] = useState<TaskManagementState>({
    tasks: [],
    userTasks: [],
    currentTask: null,
    taskProgress: null,
    stats: null,
    isLoading: false,
    isCreating: false,
    isUpdating: false,
    isSponsoring: false,
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

  // Load tasks with filters
  const loadTasks = useCallback(async (
    filters: TaskFilters = {},
    page = 1,
    append = false
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const result = await TaskService.getTasks(filters, page, 10)

      setState(prev => ({
        ...prev,
        tasks: append ? [...prev.tasks, ...result.tasks] : result.tasks,
        hasMore: result.hasMore,
        page,
        isLoading: false
      }))
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load tasks'
      setError(errorMessage)
      setState(prev => ({ ...prev, isLoading: false }))
      toast.error(errorMessage)
    }
  }, [setError])

  // Load more tasks (pagination)
  const loadMore = useCallback(async (filters: TaskFilters = {}) => {
    if (state.isLoading || !state.hasMore) return

    await loadTasks(filters, state.page + 1, true)
  }, [state.isLoading, state.hasMore, state.page, loadTasks])

  // Load specific task
  const loadTask = useCallback(async (taskId: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const task = await TaskService.getTask(taskId)

      setState(prev => ({
        ...prev,
        currentTask: task,
        isLoading: false
      }))

      return task
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load task'
      setError(errorMessage)
      setState(prev => ({ ...prev, isLoading: false }))
      toast.error(errorMessage)
      return null
    }
  }, [setError])

  // Load user's tasks
  const loadUserTasks = useCallback(async (page = 1, append = false) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const result = await TaskService.getUserTasks(page, 10)

      setState(prev => ({
        ...prev,
        userTasks: append ? [...prev.userTasks, ...result.tasks] : result.tasks,
        isLoading: false
      }))
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load user tasks'
      setError(errorMessage)
      setState(prev => ({ ...prev, isLoading: false }))
      toast.error(errorMessage)
    }
  }, [setError])

  // Create new task
  const createTask = useCallback(async (taskData: TaskFormData): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isCreating: true, error: null }))

      const result = await TaskService.createTask(taskData)

      setState(prev => ({ ...prev, isCreating: false }))

      if (result.success) {
        toast.success(result.message)
        // Refresh tasks list
        await loadTasks()
        await loadUserTasks()
        return true
      } else {
        toast.error(result.message)
        if (result.errors && result.errors.length > 0) {
          result.errors.forEach(error => toast.error(error.message))
        }
        return false
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to create task'
      setError(errorMessage)
      setState(prev => ({ ...prev, isCreating: false }))
      toast.error(errorMessage)
      return false
    }
  }, [setError, loadTasks, loadUserTasks])

  // Update task
  const updateTask = useCallback(async (
    taskId: string,
    updates: TaskUpdateRequest
  ): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isUpdating: true, error: null }))

      const result = await TaskService.updateTask(taskId, updates)

      setState(prev => ({ ...prev, isUpdating: false }))

      if (result.success) {
        toast.success(result.message)
        // Refresh current task if it's the one being updated
        if (state.currentTask?.id === taskId) {
          await loadTask(taskId)
        }
        // Refresh tasks lists
        await loadTasks()
        await loadUserTasks()
        return true
      } else {
        toast.error(result.message)
        return false
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to update task'
      setError(errorMessage)
      setState(prev => ({ ...prev, isUpdating: false }))
      toast.error(errorMessage)
      return false
    }
  }, [setError, state.currentTask?.id, loadTask, loadTasks, loadUserTasks])

  // Delete task
  const deleteTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isUpdating: true, error: null }))

      const result = await TaskService.deleteTask(taskId)

      setState(prev => ({ ...prev, isUpdating: false }))

      if (result.success) {
        toast.success(result.message)
        // Remove from local state
        setState(prev => ({
          ...prev,
          tasks: prev.tasks.filter(task => task.id !== taskId),
          userTasks: prev.userTasks.filter(task => task.id !== taskId),
          currentTask: prev.currentTask?.id === taskId ? null : prev.currentTask
        }))
        return true
      } else {
        toast.error(result.message)
        return false
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to delete task'
      setError(errorMessage)
      setState(prev => ({ ...prev, isUpdating: false }))
      toast.error(errorMessage)
      return false
    }
  }, [setError])

  // Sponsor task
  const sponsorTask = useCallback(async (
    taskId: string,
    sponsorshipData: TaskSponsorshipRequest
  ): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isSponsoring: true, error: null }))

      const result = await TaskService.sponsorTask(taskId, sponsorshipData)

      setState(prev => ({ ...prev, isSponsoring: false }))

      if (result.success) {
        toast.success(result.message)
        // Refresh current task to show updated sponsorship
        if (state.currentTask?.id === taskId) {
          await loadTask(taskId)
        }
        return true
      } else {
        toast.error(result.message)
        return false
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sponsor task'
      setError(errorMessage)
      setState(prev => ({ ...prev, isSponsoring: false }))
      toast.error(errorMessage)
      return false
    }
  }, [setError, state.currentTask?.id, loadTask])

  // Load task progress
  const loadTaskProgress = useCallback(async (taskId: string) => {
    try {
      const progress = await TaskService.getTaskProgress(taskId)
      setState(prev => ({ ...prev, taskProgress: progress }))
      return progress
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load task progress'
      setError(errorMessage)
      toast.error(errorMessage)
      return null
    }
  }, [setError])

  // Load task stats
  const loadTaskStats = useCallback(async () => {
    try {
      const stats = await TaskService.getTaskStats()
      setState(prev => ({ ...prev, stats }))
      return stats
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to load task stats'
      setError(errorMessage)
      toast.error(errorMessage)
      return null
    }
  }, [setError])

  // Search tasks
  const searchTasks = useCallback(async (
    query: string,
    filters: TaskFilters = {},
    page = 1,
    append = false
  ) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const result = await TaskService.searchTasks(query, filters, page, 10)

      setState(prev => ({
        ...prev,
        tasks: append ? [...prev.tasks, ...result.tasks] : result.tasks,
        hasMore: result.hasMore,
        page,
        isLoading: false
      }))
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to search tasks'
      setError(errorMessage)
      setState(prev => ({ ...prev, isLoading: false }))
      toast.error(errorMessage)
    }
  }, [setError])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadTasks()
      if (state.currentTask) {
        loadTaskProgress(state.currentTask.id)
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, loadTasks, loadTaskProgress, state.currentTask])

  // Initialize data on mount
  useEffect(() => {
    loadTasks()
    loadTaskStats()
  }, []) // Only run on mount

  return {
    // State
    tasks: state.tasks,
    userTasks: state.userTasks,
    currentTask: state.currentTask,
    taskProgress: state.taskProgress,
    stats: state.stats,
    isLoading: state.isLoading,
    isCreating: state.isCreating,
    isUpdating: state.isUpdating,
    isSponsoring: state.isSponsoring,
    error: state.error,
    hasMore: state.hasMore,
    page: state.page,

    // Actions
    loadTasks,
    loadMore,
    loadTask,
    loadUserTasks,
    createTask,
    updateTask,
    deleteTask,
    sponsorTask,
    loadTaskProgress,
    loadTaskStats,
    searchTasks,
    clearError,

    // Utilities
    formatTokenAmount: TaskService.formatTokenAmount,
    getTimeRemaining: TaskService.getTimeRemaining,
    getCompletionPercentage: TaskService.getCompletionPercentage,
    getStatusColor: TaskService.getStatusColor,
    validateTaskForm: TaskService.validateTaskForm
  }
}