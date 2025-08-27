import { useState, useCallback, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import {
  Star,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Flag,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Image,
  Video,
  Mic,
  Loader2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react'
import { useValidation } from '../hooks/useValidation'
import { useAuth } from '../contexts/AuthContext'
import type { ValidationFormData, ValidationIssue } from '../types/validation'

interface ValidationInterfaceProps {
  taskId?: string
  onComplete?: (taskId: string) => void
  onSkip?: (taskId: string) => void
}

interface FormData {
  score: number
  feedback: string
  confidence: number
}

const ISSUE_TYPES = [
  { value: 'quality', label: 'Poor Quality', severity: 'medium' },
  { value: 'language', label: 'Language Issues', severity: 'medium' },
  { value: 'content', label: 'Inappropriate Content', severity: 'high' },
  { value: 'format', label: 'Format Problems', severity: 'low' },
  { value: 'other', label: 'Other Issues', severity: 'low' }
] as const

const SEVERITY_COLORS = {
  low: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  medium: 'text-orange-600 bg-orange-50 border-orange-200',
  high: 'text-red-600 bg-red-50 border-red-200',
  critical: 'text-red-800 bg-red-100 border-red-300'
}

export function ValidationInterface({ taskId, onComplete, onSkip }: ValidationInterfaceProps) {
  const { isAuthenticated } = useAuth()
  const {
    currentTask,
    validatorStake,
    isLoading,
    isSubmitting,
    loadValidationTask,
    submitValidation,
    getFileAccess,
    getTimeRemaining,
    getValidationDifficulty
  } = useValidation()

  const [fileAccessUrl, setFileAccessUrl] = useState<string | null>(null)
  const [validationStartTime] = useState(Date.now())
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [showReportModal, setShowReportModal] = useState(false)
  const [currentView, setCurrentView] = useState<'overview' | 'content' | 'validation'>('overview')

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset
  } = useForm<FormData>({
    defaultValues: {
      score: 75,
      feedback: '',
      confidence: 0.8
    }
  })

  const watchedScore = watch('score')

  // Load task on mount or when taskId changes
  useEffect(() => {
    if (taskId) {
      loadValidationTask(taskId)
    }
  }, [taskId, loadValidationTask])

  // Get file access when task is loaded
  useEffect(() => {
    if (currentTask && !fileAccessUrl) {
      getFileAccess(currentTask.id).then(access => {
        if (access) {
          setFileAccessUrl(access.accessUrl)
        }
      })
    }
  }, [currentTask, fileAccessUrl, getFileAccess])

  const handleAddIssue = useCallback((type: string, description: string, severity: string) => {
    const newIssue: ValidationIssue = {
      type: type as ValidationIssue['type'],
      severity: severity as ValidationIssue['severity'],
      description,
      suggestion: ''
    }
    setIssues(prev => [...prev, newIssue])
  }, [])

  const handleRemoveIssue = useCallback((index: number) => {
    setIssues(prev => prev.filter((_, i) => i !== index))
  }, [])

  const onSubmit = useCallback(async (data: FormData) => {
    if (!currentTask) return

    const timeSpent = Math.floor((Date.now() - validationStartTime) / 1000)

    const validationData: ValidationFormData = {
      score: data.score,
      feedback: data.feedback,
      issues,
      confidence: data.confidence,
      timeSpent
    }

    const result = await submitValidation(currentTask.id, validationData)

    if (result) {
      onComplete?.(currentTask.id)
      reset()
      setIssues([])
      setFileAccessUrl(null)
    }
  }, [currentTask, validationStartTime, issues, submitValidation, onComplete, reset])

  const handleSkip = useCallback(() => {
    if (currentTask) {
      onSkip?.(currentTask.id)
      reset()
      setIssues([])
      setFileAccessUrl(null)
    }
  }, [currentTask, onSkip, reset])

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-blue-500" />
    if (mimeType.startsWith('video/')) return <Video className="h-5 w-5 text-purple-500" />
    if (mimeType.startsWith('audio/')) return <Mic className="h-5 w-5 text-green-500" />
    return <FileText className="h-5 w-5 text-gray-500" />
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDifficultyBadge = (difficulty: string) => {
    const colors = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800'
    }
    return colors[difficulty as keyof typeof colors] || colors.medium
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
        <p className="text-gray-600 mb-4">You need to stake tokens to become a validator</p>
        <button className="btn-primary">Stake Tokens</button>
      </div>
    )
  }

  if (isLoading || !currentTask) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600 mr-3" />
        <span className="text-lg text-gray-600">Loading validation task...</span>
      </div>
    )
  }

  const timeRemaining = getTimeRemaining(currentTask.validationDeadline)
  const difficulty = getValidationDifficulty(currentTask.aiScore, currentTask.metadata.mimeType)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">Validation Task</h1>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDifficultyBadge(difficulty)}`}>
                {difficulty.toUpperCase()}
              </span>
            </div>
            <p className="text-gray-600">Review and validate submitted language data</p>
          </div>

          <div className="mt-4 lg:mt-0 flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              <Clock className="h-4 w-4 inline mr-1" />
              <span className={timeRemaining.urgent ? 'text-red-600 font-medium' : ''}>
                {timeRemaining.text}
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Skip Task
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'content', label: 'Content' },
          { key: 'validation', label: 'Validation' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setCurrentView(key as any)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-colors ${currentView === key
              ? 'bg-white text-primary-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {currentView === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Information */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Information</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">File Type</span>
                <div className="flex items-center space-x-2">
                  {getFileIcon(currentTask.metadata.mimeType)}
                  <span className="text-sm font-medium">{currentTask.metadata.originalFileName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Language</span>
                <span className="text-sm font-medium">{currentTask.metadata.language}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">File Size</span>
                <span className="text-sm font-medium">
                  {(currentTask.metadata.fileSize / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>

              {currentTask.metadata.wordCount && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Word Count</span>
                  <span className="text-sm font-medium">{currentTask.metadata.wordCount.toLocaleString()}</span>
                </div>
              )}

              {currentTask.metadata.duration && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Duration</span>
                  <span className="text-sm font-medium">
                    {Math.floor(currentTask.metadata.duration / 60)}:{(currentTask.metadata.duration % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Analysis</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">AI Quality Score</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-lg font-bold ${getScoreColor(currentTask.aiScore)}`}>
                    {currentTask.aiScore}/100
                  </span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`h-4 w-4 ${star <= Math.floor(currentTask.aiScore / 20)
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                          }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Confidence</span>
                <span className="text-sm font-medium">
                  {Math.round(currentTask.aiAnalysis.confidence * 100)}%
                </span>
              </div>

              {currentTask.aiAnalysis.issues.length > 0 && (
                <div>
                  <span className="text-sm text-gray-600 block mb-2">AI Detected Issues</span>
                  <div className="space-y-1">
                    {currentTask.aiAnalysis.issues.map((issue, index) => (
                      <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {issue}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentTask.aiAnalysis.recommendations.length > 0 && (
                <div>
                  <span className="text-sm text-gray-600 block mb-2">AI Recommendations</span>
                  <div className="space-y-1">
                    {currentTask.aiAnalysis.recommendations.map((rec, index) => (
                      <div key={index} className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentView === 'content' && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Content Review</h3>
            <button
              onClick={() => setShowReportModal(!showReportModal)}
              className="btn-secondary flex items-center"
              disabled
            >
              <Flag className="h-4 w-4 mr-2" />
              Report Issue
            </button>
          </div>

          {fileAccessUrl ? (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <div className="mb-4">
                {getFileIcon(currentTask.metadata.mimeType)}
              </div>
              <p className="text-gray-600 mb-4">
                Click below to access the submitted content for validation
              </p>
              <a
                href={fileAccessUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Content
              </a>
            </div>
          ) : (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Loading secure content access...</p>
            </div>
          )}
        </div>
      )}

      {currentView === 'validation' && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Validation Assessment</h3>

            {/* Score */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quality Score (0-100)
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  {...register('score', {
                    required: 'Score is required',
                    min: { value: 0, message: 'Score must be at least 0' },
                    max: { value: 100, message: 'Score must be at most 100' }
                  })}
                  className="flex-1"
                />
                <div className="flex items-center space-x-2">
                  <span className={`text-2xl font-bold ${getScoreColor(watchedScore)}`}>
                    {watchedScore}
                  </span>
                  {watchedScore >= 80 ? (
                    <ThumbsUp className="h-5 w-5 text-green-500" />
                  ) : watchedScore >= 60 ? (
                    <div className="h-5 w-5" />
                  ) : (
                    <ThumbsDown className="h-5 w-5 text-red-500" />
                  )}
                </div>
              </div>
              {errors.score && (
                <p className="mt-1 text-sm text-red-600">{errors.score.message}</p>
              )}
            </div>

            {/* Feedback */}
            <div className="mb-6">
              <label htmlFor="feedback" className="block text-sm font-medium text-gray-700 mb-2">
                Validation Feedback
              </label>
              <textarea
                id="feedback"
                rows={4}
                {...register('feedback', {
                  required: 'Feedback is required',
                  minLength: { value: 10, message: 'Feedback must be at least 10 characters' }
                })}
                className="input-field"
                placeholder="Provide detailed feedback about the quality, accuracy, and relevance of the submitted content..."
              />
              {errors.feedback && (
                <p className="mt-1 text-sm text-red-600">{errors.feedback.message}</p>
              )}
            </div>

            {/* Confidence */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confidence Level
              </label>
              <select
                {...register('confidence', { required: 'Confidence level is required' })}
                className="input-field"
              >
                <option value={1}>Very Confident (100%)</option>
                <option value={0.9}>Confident (90%)</option>
                <option value={0.8}>Moderately Confident (80%)</option>
                <option value={0.7}>Somewhat Confident (70%)</option>
                <option value={0.6}>Low Confidence (60%)</option>
              </select>
              {errors.confidence && (
                <p className="mt-1 text-sm text-red-600">{errors.confidence.message}</p>
              )}
            </div>

            {/* Issues */}
            {issues.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Identified Issues</h4>
                <div className="space-y-2">
                  {issues.map((issue, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${SEVERITY_COLORS[issue.severity]}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium capitalize">{issue.type.replace('_', ' ')}</span>
                          <span className="ml-2 text-xs uppercase">{issue.severity}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveIssue(index)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-sm mt-1">{issue.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Issue Buttons */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Quick Issue Tags</h4>
              <div className="flex flex-wrap gap-2">
                {ISSUE_TYPES.map(({ value, label, severity }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleAddIssue(value, `${label} detected`, severity)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={handleSkip}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Skip Task
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Validation
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => {
            const views = ['overview', 'content', 'validation']
            const currentIndex = views.indexOf(currentView)
            if (currentIndex > 0) {
              setCurrentView(views[currentIndex - 1] as any)
            }
          }}
          disabled={currentView === 'overview'}
          className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </button>

        <button
          onClick={() => {
            const views = ['overview', 'content', 'validation']
            const currentIndex = views.indexOf(currentView)
            if (currentIndex < views.length - 1) {
              setCurrentView(views[currentIndex + 1] as any)
            }
          }}
          disabled={currentView === 'validation'}
          className="btn-secondary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
          <ArrowRight className="h-4 w-4 ml-2" />
        </button>
      </div>
    </div>
  )
}