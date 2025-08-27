import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Info } from 'lucide-react'
import { DataSubmission } from '../components/DataSubmission'
import { SubmissionProgress } from '../components/SubmissionProgress'
import { useAuth } from '../contexts/AuthContext'
import type { DataSubmission as SubmissionType } from '../types/submission'

export function SubmitDataPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [currentStep, setCurrentStep] = useState<'submit' | 'progress'>('submit')
  const [submissionId, setSubmissionId] = useState<string | null>(
    searchParams.get('submissionId')
  )
  const [completedSubmission, setCompletedSubmission] = useState<SubmissionType | null>(null)

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // If we have a submissionId in URL params, show progress
  useEffect(() => {
    if (submissionId) {
      setCurrentStep('progress')
    }
  }, [submissionId])

  const handleSubmissionSuccess = (newSubmissionId: string) => {
    setSubmissionId(newSubmissionId)
    setCurrentStep('progress')

    // Update URL to include submission ID
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set('submissionId', newSubmissionId)
    window.history.replaceState({}, '', newUrl.toString())
  }

  const handleSubmissionComplete = (submission: SubmissionType) => {
    setCompletedSubmission(submission)
  }

  const handleBackToSubmit = () => {
    setCurrentStep('submit')
    setSubmissionId(null)
    setCompletedSubmission(null)

    // Remove submission ID from URL
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.delete('submissionId')
    window.history.replaceState({}, '', newUrl.toString())
  }

  const handleBackToTasks = () => {
    navigate('/tasks')
  }

  if (!taskId) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-8">
          <Info className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Invalid Task</h2>
          <p className="text-gray-600 mb-4">No task ID provided.</p>
          <button onClick={handleBackToTasks} className="btn-primary">
            Browse Tasks
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={currentStep === 'progress' && !completedSubmission ? handleBackToSubmit : handleBackToTasks}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentStep === 'submit' ? 'Submit Data' : 'Submission Progress'}
            </h1>
            <p className="text-gray-600">
              Task ID: {taskId}
            </p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="hidden sm:flex items-center space-x-2">
          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${currentStep === 'submit'
              ? 'bg-primary-100 text-primary-800'
              : 'bg-gray-100 text-gray-600'
            }`}>
            <div className={`w-2 h-2 rounded-full ${currentStep === 'submit' ? 'bg-primary-600' : 'bg-gray-400'
              }`} />
            Submit
          </div>

          <div className="w-8 h-px bg-gray-300" />

          <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${currentStep === 'progress'
              ? 'bg-primary-100 text-primary-800'
              : 'bg-gray-100 text-gray-600'
            }`}>
            <div className={`w-2 h-2 rounded-full ${currentStep === 'progress' ? 'bg-primary-600' : 'bg-gray-400'
              }`} />
            Progress
          </div>
        </div>
      </div>

      {/* Content */}
      {currentStep === 'submit' ? (
        <DataSubmission
          taskId={taskId}
          onSuccess={handleSubmissionSuccess}
          onCancel={handleBackToTasks}
        />
      ) : submissionId ? (
        <div className="space-y-6">
          <SubmissionProgress
            submissionId={submissionId}
            onComplete={handleSubmissionComplete}
          />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {!completedSubmission && (
              <button
                onClick={handleBackToSubmit}
                className="btn-secondary"
              >
                Submit Another File
              </button>
            )}

            <button
              onClick={handleBackToTasks}
              className="btn-primary"
            >
              {completedSubmission ? 'Browse More Tasks' : 'Back to Tasks'}
            </button>

            {completedSubmission && (
              <button
                onClick={() => navigate(`/submissions/${submissionId}`)}
                className="btn-secondary"
              >
                View Full Details
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card text-center py-8">
          <Info className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Submission Found</h2>
          <p className="text-gray-600 mb-4">Unable to load submission progress.</p>
          <button onClick={handleBackToSubmit} className="btn-primary">
            Start New Submission
          </button>
        </div>
      )}

      {/* Help Section */}
      <div className="mt-8 card bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-sm font-medium text-blue-900 mb-1">
              How Data Submission Works
            </h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>1. <strong>Upload:</strong> Securely upload your file to encrypted cloud storage</p>
              <p>2. <strong>AI Verification:</strong> Our AI analyzes quality, language, and content</p>
              <p>3. <strong>Community Validation:</strong> Validators review and score your submission</p>
              <p>4. <strong>Rewards:</strong> Earn tokens based on quality and validator consensus</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}