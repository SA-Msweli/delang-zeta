import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  Eye,
  TrendingUp,
  Award,
  FileText,
  Users
} from 'lucide-react'
import { SubmissionService } from '../services/submissionService'
import type { DataSubmission, SubmissionProgress as ProgressType, AuditEntry } from '../types/submission'

interface SubmissionProgressProps {
  submissionId: string
  onComplete?: (submission: DataSubmission) => void
}

interface ProgressStage {
  key: string
  label: string
  description: string
  icon: React.ReactNode
}

const PROGRESS_STAGES: ProgressStage[] = [
  {
    key: 'uploading',
    label: 'Uploading',
    description: 'Securely uploading your file to cloud storage',
    icon: <Loader2 className="h-5 w-5 animate-spin" />
  },
  {
    key: 'processing',
    label: 'Processing',
    description: 'Analyzing file content and extracting metadata',
    icon: <FileText className="h-5 w-5" />
  },
  {
    key: 'verifying',
    label: 'AI Verification',
    description: 'Running AI quality assessment and language detection',
    icon: <TrendingUp className="h-5 w-5" />
  },
  {
    key: 'complete',
    label: 'Complete',
    description: 'Submission processed and ready for community validation',
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    key: 'error',
    label: 'Error',
    description: 'An error occurred during processing',
    icon: <XCircle className="h-5 w-5" />
  }
]

export function SubmissionProgress({ submissionId, onComplete }: SubmissionProgressProps) {
  const [progress, setProgress] = useState<ProgressType | null>(null)
  const [submission, setSubmission] = useState<DataSubmission | null>(null)
  const [showAuditTrail, setShowAuditTrail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchProgress = useCallback(async () => {
    try {
      const progressData = await SubmissionService.getSubmissionProgress(submissionId)
      setProgress(progressData)
      setError(null)

      // If complete, fetch full submission details
      if (progressData.stage === 'complete') {
        const submissionData = await SubmissionService.getSubmission(submissionId)
        setSubmission(submissionData)
        onComplete?.(submissionData)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [submissionId, onComplete])

  // Poll for progress updates
  useEffect(() => {
    fetchProgress()

    const interval = setInterval(() => {
      if (progress?.stage !== 'complete' && progress?.stage !== 'error') {
        fetchProgress()
      }
    }, 2000) // Poll every 2 seconds

    return () => clearInterval(interval)
  }, [fetchProgress, progress?.stage])

  const getCurrentStageIndex = useCallback(() => {
    if (!progress) return 0
    return PROGRESS_STAGES.findIndex(stage => stage.key === progress.stage)
  }, [progress])

  const getStageStatus = useCallback((stageIndex: number) => {
    const currentIndex = getCurrentStageIndex()

    if (progress?.stage === 'error') {
      return stageIndex === currentIndex ? 'error' : stageIndex < currentIndex ? 'complete' : 'pending'
    }

    if (stageIndex < currentIndex) return 'complete'
    if (stageIndex === currentIndex) return 'active'
    return 'pending'
  }, [getCurrentStageIndex, progress?.stage])

  const formatScore = (score: number) => {
    return `${Math.round(score)}/100`
  }

  const formatTimeEstimate = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  if (isLoading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mr-3" />
          <span className="text-lg text-gray-600">Loading submission status...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <div className="flex items-center justify-center py-8 text-red-600">
          <XCircle className="h-8 w-8 mr-3" />
          <div>
            <p className="text-lg font-medium">Error loading submission</p>
            <p className="text-sm text-red-500">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Submission Progress</h2>
          <span className="text-sm text-gray-500">ID: {submissionId.slice(0, 8)}...</span>
        </div>

        {/* Progress Steps */}
        <div className="space-y-4">
          {PROGRESS_STAGES.filter(stage => stage.key !== 'error' || progress?.stage === 'error').map((stage, index) => {
            const status = getStageStatus(index)
            const isActive = status === 'active'
            const isComplete = status === 'complete'
            const isError = status === 'error'

            return (
              <div key={stage.key} className="flex items-start space-x-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${isError ? 'bg-red-100 text-red-600' :
                  isComplete ? 'bg-green-100 text-green-600' :
                    isActive ? 'bg-primary-100 text-primary-600' :
                      'bg-gray-100 text-gray-400'
                  }`}>
                  {isError ? <XCircle className="h-5 w-5" /> :
                    isComplete ? <CheckCircle className="h-5 w-5" /> :
                      stage.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-sm font-medium ${isError ? 'text-red-900' :
                      isComplete ? 'text-green-900' :
                        isActive ? 'text-primary-900' :
                          'text-gray-500'
                      }`}>
                      {stage.label}
                    </h3>

                    {isActive && progress?.progress !== undefined && (
                      <span className="text-sm text-primary-600 font-medium">
                        {Math.round(progress.progress)}%
                      </span>
                    )}
                  </div>

                  <p className={`text-sm mt-1 ${isError ? 'text-red-600' :
                    isComplete ? 'text-green-600' :
                      isActive ? 'text-primary-600' :
                        'text-gray-500'
                    }`}>
                    {isActive && progress?.message ? progress.message : stage.description}
                  </p>

                  {isActive && progress?.estimatedTimeRemaining && (
                    <p className="text-xs text-gray-500 mt-1">
                      Estimated time remaining: {formatTimeEstimate(progress.estimatedTimeRemaining)}
                    </p>
                  )}

                  {isError && progress?.error && (
                    <p className="text-sm text-red-600 mt-1 bg-red-50 p-2 rounded">
                      {progress.error}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Progress Bar */}
        {progress && progress.stage !== 'error' && (
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* AI Verification Results */}
      {submission?.verification && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AI Verification Results</h3>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-lg font-bold text-blue-600">
                {formatScore(submission.verification.aiScore)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-blue-900">Quality Score</span>
                <Award className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-1">
                {formatScore(submission.verification.aiScore)}
              </p>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900">Confidence</span>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {Math.round(submission.verification.confidence * 100)}%
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-purple-900">Status</span>
                <Users className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-sm font-bold text-purple-600 mt-1 capitalize">
                {submission.verification.status.replace('_', ' ')}
              </p>
            </div>
          </div>

          {/* Issues and Recommendations */}
          {(submission.verification.issues.length > 0 || submission.verification.recommendations.length > 0) && (
            <div className="space-y-4">
              {submission.verification.issues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-900 mb-2 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Issues Found
                  </h4>
                  <ul className="space-y-1">
                    {submission.verification.issues.map((issue, index) => (
                      <li key={index} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {submission.verification.recommendations.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-blue-900 mb-2 flex items-center">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    Recommendations
                  </h4>
                  <ul className="space-y-1">
                    {submission.verification.recommendations.map((rec, index) => (
                      <li key={index} className="text-sm text-blue-700 bg-blue-50 p-2 rounded">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Audit Trail Toggle */}
          {submission.verification.auditTrail.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => setShowAuditTrail(!showAuditTrail)}
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <Eye className="h-4 w-4 mr-1" />
                {showAuditTrail ? 'Hide' : 'Show'} Audit Trail
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audit Trail */}
      {showAuditTrail && submission?.verification.auditTrail && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Audit Trail</h3>
          <div className="space-y-3">
            {submission.verification.auditTrail.map((entry: AuditEntry, index: number) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{entry.action}</p>
                    <time className="text-xs text-gray-500">
                      {entry.timestamp.toLocaleString()}
                    </time>
                  </div>
                  <p className="text-sm text-gray-600">Actor: {entry.actor}</p>
                  {Object.keys(entry.details).length > 0 && (
                    <div className="mt-2 text-xs text-gray-500">
                      <pre className="whitespace-pre-wrap">
                        {JSON.stringify(entry.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {submission?.verification.status === 'verified' && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center">
            <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-green-900">Submission Approved!</h3>
              <p className="text-sm text-green-700 mt-1">
                Your submission has been verified and is now available for community validation.
                You'll receive rewards once the validation process is complete.
              </p>
            </div>
          </div>
        </div>
      )}

      {submission?.verification.status === 'rejected' && (
        <div className="card bg-red-50 border-red-200">
          <div className="flex items-center">
            <XCircle className="h-6 w-6 text-red-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-red-900">Submission Rejected</h3>
              <p className="text-sm text-red-700 mt-1">
                Your submission did not meet the quality requirements. Please review the issues above and consider resubmitting with improvements.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}