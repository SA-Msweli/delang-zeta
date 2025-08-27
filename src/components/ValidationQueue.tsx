import { useState, useCallback, useEffect } from 'react'
import {
  Clock,
  Filter,
  RefreshCw,
  ChevronRight,
  FileText,
  Image,
  Video,
  Mic,
  AlertTriangle,
  CheckCircle,
  Loader2
} from 'lucide-react'
import { useValidation } from '../hooks/useValidation'
import { useAuth } from '../contexts/AuthContext'
import type { ValidationTask, ValidationFilters } from '../types/validation'

interface ValidationQueueProps {
  onSelectTask?: (task: ValidationTask) => void
}

const FILTER_OPTIONS = {
  language: [
    { value: '', label: 'All Languages' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'zh', label: 'Chinese' },
    { value: 'ja', label: 'Japanese' }
  ],
  dataType: [
    { value: '', label: 'All Types' },
    { value: 'text', label: 'Text' },
    { value: 'audio', label: 'Audio' },
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' }
  ],
  sortBy: [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'highest_reward', label: 'Highest Reward' },
    { value: 'deadline', label: 'Deadline Soon' }
  ]
}

export function ValidationQueue({ onSelectTask }: ValidationQueueProps) {
  const { isAuthenticated } = useAuth()
  const {
    queue,
    validatorStake,
    isLoading,
    hasMore,
    loadValidationQueue,
    loadMore,
    getTimeRemaining,
    getValidationDifficulty,
  } = useValidation({ autoRefresh: true, refreshInterval: 30000 })

  const [filters, setFilters] = useState<ValidationFilters>({
    sortBy: 'deadline'
  })
  const [showFilters, setShowFilters] = useState(false)

  // Load queue on mount and when filters change
  useEffect(() => {
    loadValidationQueue(filters)
  }, [filters, loadValidationQueue])

  const handleFilterChange = useCallback((key: keyof ValidationFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value || undefined
    }))
  }, [])

  const handleRefresh = useCallback(() => {
    loadValidationQueue(filters)
  }, [filters, loadValidationQueue])

  const handleLoadMore = useCallback(() => {
    loadMore(filters)
  }, [filters, loadMore])

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-4 w-4 text-blue-500" />
    if (mimeType.startsWith('video/')) return <Video className="h-4 w-4 text-purple-500" />
    if (mimeType.startsWith('audio/')) return <Mic className="h-4 w-4 text-green-500" />
    return <FileText className="h-4 w-4 text-gray-500" />
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-50 border-green-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'hard': return 'text-red-600 bg-red-50 border-red-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">Please connect your wallet to access validation tasks</p>
      </div>
    )
  }

  if (!validatorStake) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600 mb-4">You need to stake tokens to access validation tasks</p>
        <button className="btn-primary">Stake Tokens</button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Validation Queue</h1>
          <p className="text-gray-600">Review and validate submitted language data</p>
        </div>

        <div className="mt-4 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn-secondary flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn-secondary flex items-center"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Language
              </label>
              <select
                value={filters.language || ''}
                onChange={(e) => handleFilterChange('language', e.target.value)}
                className="input-field"
              >
                {FILTER_OPTIONS.language.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Type
              </label>
              <select
                value={filters.dataType || ''}
                onChange={(e) => handleFilterChange('dataType', e.target.value)}
                className="input-field"
              >
                {FILTER_OPTIONS.dataType.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy || 'deadline'}
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
                className="input-field"
              >
                {FILTER_OPTIONS.sortBy.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={() => {
                setFilters({ sortBy: 'deadline' })
                setShowFilters(false)
              }}
              className="btn-secondary mr-3"
            >
              Clear Filters
            </button>
            <button
              onClick={() => setShowFilters(false)}
              className="btn-primary"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

      {/* Queue Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-blue-600">{queue.length}</p>
          <p className="text-sm text-blue-800">Available Tasks</p>
        </div>

        <div className="bg-green-50 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-green-600">
            {validatorStake.reputation}/100
          </p>
          <p className="text-sm text-green-800">Your Reputation</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-purple-600">
            {(validatorStake.accuracyScore * 100).toFixed(1)}%
          </p>
          <p className="text-sm text-purple-800">Accuracy Rate</p>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg text-center">
          <p className="text-2xl font-bold text-yellow-600">
            {validatorStake.totalValidations}
          </p>
          <p className="text-sm text-yellow-800">Total Validations</p>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {isLoading && queue.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600 mr-3" />
            <span className="text-lg text-gray-600">Loading validation tasks...</span>
          </div>
        ) : queue.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Tasks Available</h3>
            <p className="text-gray-600">
              All available validation tasks have been completed. Check back later for new tasks.
            </p>
          </div>
        ) : (
          queue.map((task) => {
            const timeRemaining = getTimeRemaining(task.validationDeadline)
            const difficulty = getValidationDifficulty(task.aiScore, task.metadata.mimeType)

            return (
              <div
                key={task.id}
                className="card hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onSelectTask?.(task)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center space-x-3 mb-2">
                      {getFileIcon(task.metadata.mimeType)}
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {task.metadata.originalFileName}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getDifficultyColor(difficulty)}`}>
                        {difficulty.toUpperCase()}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Language:</span>
                        <span className="ml-1 font-medium">{task.metadata.language.toUpperCase()}</span>
                      </div>

                      <div>
                        <span className="text-gray-500">AI Score:</span>
                        <span className={`ml-1 font-medium ${getScoreColor(task.aiScore)}`}>
                          {task.aiScore}/100
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500">Validators:</span>
                        <span className="ml-1 font-medium">
                          {task.currentValidators}/{task.requiredValidators}
                        </span>
                      </div>

                      <div className="flex items-center">
                        <Clock className="h-3 w-3 text-gray-400 mr-1" />
                        <span className={`text-xs font-medium ${timeRemaining.urgent ? 'text-red-600' : 'text-gray-600'}`}>
                          {timeRemaining.text}
                        </span>
                      </div>
                    </div>

                    {/* AI Issues */}
                    {task.aiAnalysis.issues.length > 0 && (
                      <div className="mt-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <AlertTriangle className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs text-yellow-700 font-medium">
                            AI detected {task.aiAnalysis.issues.length} issue(s)
                          </span>
                        </div>
                        <div className="text-xs text-gray-600 line-clamp-2">
                          {task.aiAnalysis.issues.slice(0, 2).join(', ')}
                          {task.aiAnalysis.issues.length > 2 && '...'}
                        </div>
                      </div>
                    )}

                    {/* File Info */}
                    <div className="mt-3 flex items-center space-x-4 text-xs text-gray-500">
                      <span>
                        {(task.metadata.fileSize / 1024 / 1024).toFixed(2)} MB
                      </span>
                      {task.metadata.wordCount && (
                        <span>{task.metadata.wordCount.toLocaleString()} words</span>
                      )}
                      {task.metadata.duration && (
                        <span>
                          {Math.floor(task.metadata.duration / 60)}:
                          {(task.metadata.duration % 60).toString().padStart(2, '0')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="ml-4 flex items-center">
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Mobile Swipe Indicator */}
                <div className="sm:hidden mt-3 text-center">
                  <div className="inline-flex items-center text-xs text-gray-500">
                    <span>Tap to validate</span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="text-center mt-6">
          <button
            onClick={handleLoadMore}
            disabled={isLoading}
            className="btn-secondary flex items-center mx-auto"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Tasks'
            )}
          </button>
        </div>
      )}
    </div>
  )
}