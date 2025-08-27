import { useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Award, Lock } from 'lucide-react'
import { ValidationQueue } from '../components/ValidationQueue'
import { ValidationInterface } from '../components/ValidationInterface'
import { ValidatorStaking } from '../components/ValidatorStaking'
import { useAuth } from '../contexts/AuthContext'
import { useValidation } from '../hooks/useValidation'
import type { ValidationTask } from '../types/validation'

type ViewMode = 'queue' | 'validate' | 'staking'

export function ValidationPage() {
  const { taskId } = useParams<{ taskId?: string }>()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { validatorStake } = useValidation()

  const [currentView, setCurrentView] = useState<ViewMode>(
    taskId ? 'validate' : validatorStake ? 'queue' : 'staking'
  )
  const [selectedTask, setSelectedTask] = useState<ValidationTask | null>(null)

  const handleSelectTask = useCallback((task: ValidationTask) => {
    setSelectedTask(task)
    setCurrentView('validate')
    navigate(`/validation/${task.id}`)
  }, [navigate])

  const handleCompleteValidation = useCallback((_taskId: string) => {
    setCurrentView('queue')
    setSelectedTask(null)
    navigate('/validation')
  }, [navigate])

  const handleSkipValidation = useCallback((_taskId: string) => {
    setCurrentView('queue')
    setSelectedTask(null)
    navigate('/validation')
  }, [navigate])

  const handleBackToQueue = useCallback(() => {
    setCurrentView('queue')
    setSelectedTask(null)
    navigate('/validation')
  }, [navigate])

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="card text-center py-8">
          <Lock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please connect your wallet to access validation features</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              {currentView !== 'queue' && (
                <button
                  onClick={handleBackToQueue}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
              )}

              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {currentView === 'queue' && 'Validation Queue'}
                  {currentView === 'validate' && 'Validate Submission'}
                  {currentView === 'staking' && 'Validator Staking'}
                </h1>
              </div>
            </div>

            {/* Navigation */}
            <div className="hidden sm:flex items-center space-x-1">
              <button
                onClick={() => setCurrentView('queue')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentView === 'queue'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                disabled={!validatorStake}
              >
                Queue
              </button>

              <button
                onClick={() => setCurrentView('staking')}
                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${currentView === 'staking'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
              >
                <Award className="h-4 w-4 mr-1 inline" />
                Staking
              </button>
            </div>

            {/* Mobile Navigation */}
            <div className="sm:hidden">
              <select
                value={currentView}
                onChange={(e) => setCurrentView(e.target.value as ViewMode)}
                className="text-sm border-gray-300 rounded-md"
              >
                <option value="queue" disabled={!validatorStake}>Queue</option>
                <option value="staking">Staking</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'queue' && (
          <ValidationQueue onSelectTask={handleSelectTask} />
        )}

        {currentView === 'validate' && (
          <ValidationInterface
            taskId={taskId || selectedTask?.id}
            onComplete={handleCompleteValidation}
            onSkip={handleSkipValidation}
          />
        )}

        {currentView === 'staking' && (
          <ValidatorStaking />
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="grid grid-cols-2">
          <button
            onClick={() => setCurrentView('queue')}
            disabled={!validatorStake}
            className={`flex flex-col items-center justify-center py-3 text-xs font-medium transition-colors ${currentView === 'queue'
              ? 'text-primary-600 bg-primary-50'
              : validatorStake
                ? 'text-gray-600 hover:text-gray-900'
                : 'text-gray-400 cursor-not-allowed'
              }`}
          >
            <div className="h-6 w-6 mb-1 flex items-center justify-center">
              📋
            </div>
            Queue
          </button>

          <button
            onClick={() => setCurrentView('staking')}
            className={`flex flex-col items-center justify-center py-3 text-xs font-medium transition-colors ${currentView === 'staking'
              ? 'text-primary-600 bg-primary-50'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Award className="h-6 w-6 mb-1" />
            Staking
          </button>
        </div>
      </div>

      {/* Bottom Padding for Mobile Navigation */}
      <div className="sm:hidden h-20" />
    </div>
  )
}