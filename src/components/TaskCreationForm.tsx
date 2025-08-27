import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import {
  Plus,
  X,
  DollarSign,
  FileText,
  Image,
  Video,
  Mic,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Info
} from 'lucide-react'
import { useTaskManagement } from '../hooks/useTaskManagement'
import { useAuth } from '../contexts/AuthContext'
import type { TaskFormData } from '../types/task'

interface TaskCreationFormProps {
  onSuccess?: (taskId: string) => void
  onCancel?: () => void
}

interface FormData {
  title: string
  description: string
  language: string
  dataType: 'text' | 'audio' | 'image' | 'video'
  minWordCount?: number
  maxWordCount?: number
  minDuration?: number
  maxDuration?: number
  qualityThreshold: number
  specificRequirements: string
  allowedFormats: string
  rewardTotal: string
  rewardToken: string
  rewardNetwork: string
  distributionMethod: 'immediate' | 'milestone' | 'completion'
  deadline: string
  maxSubmissions: number
  requiredValidators: number
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ru', name: 'Russian' }
]

const SUPPORTED_TOKENS = [
  { symbol: 'ZETA', name: 'ZetaChain', network: 'zetachain' },
  { symbol: 'ETH', name: 'Ethereum', network: 'ethereum' },
  { symbol: 'USDC', name: 'USD Coin', network: 'ethereum' },
  { symbol: 'BTC', name: 'Bitcoin', network: 'bitcoin' }
]

const DATA_TYPES = [
  { value: 'text', label: 'Text', icon: FileText, description: 'Written content, articles, conversations' },
  { value: 'audio', label: 'Audio', icon: Mic, description: 'Voice recordings, podcasts, music' },
  { value: 'image', label: 'Image', icon: Image, description: 'Photos, illustrations, graphics' },
  { value: 'video', label: 'Video', icon: Video, description: 'Video content, animations, clips' }
]

export function TaskCreationForm({ onSuccess, onCancel }: TaskCreationFormProps) {
  const { isAuthenticated } = useAuth()
  const { isCreating, createTask, validateTaskForm } = useTaskManagement()

  const [currentStep, setCurrentStep] = useState(1)
  const [requirements, setRequirements] = useState<string[]>([])
  const [formats, setFormats] = useState<string[]>([])

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger
  } = useForm<FormData>({
    defaultValues: {
      title: '',
      description: '',
      language: 'en',
      dataType: 'text',
      qualityThreshold: 75,
      specificRequirements: '',
      allowedFormats: '',
      rewardTotal: '',
      rewardToken: 'ZETA',
      rewardNetwork: 'zetachain',
      distributionMethod: 'completion',
      deadline: '',
      maxSubmissions: 100,
      requiredValidators: 3
    }
  })

  const watchedDataType = watch('dataType')
  const watchedRewardTotal = watch('rewardTotal')
  const watchedMaxSubmissions = watch('maxSubmissions')

  const calculatePerSubmissionReward = useCallback(() => {
    const total = parseFloat(watchedRewardTotal || '0')
    const maxSubs = watchedMaxSubmissions || 1
    return (total / maxSubs).toFixed(4)
  }, [watchedRewardTotal, watchedMaxSubmissions])

  const addRequirement = useCallback((requirement: string) => {
    if (requirement.trim() && !requirements.includes(requirement.trim())) {
      setRequirements(prev => [...prev, requirement.trim()])
      setValue('specificRequirements', '')
    }
  }, [requirements, setValue])

  const removeRequirement = useCallback((index: number) => {
    setRequirements(prev => prev.filter((_, i) => i !== index))
  }, [])

  const addFormat = useCallback((format: string) => {
    if (format.trim() && !formats.includes(format.trim())) {
      setFormats(prev => [...prev, format.trim()])
      setValue('allowedFormats', '')
    }
  }, [formats, setValue])

  const removeFormat = useCallback((index: number) => {
    setFormats(prev => prev.filter((_, i) => i !== index))
  }, [])

  const nextStep = useCallback(async () => {
    const isValid = await trigger()
    if (isValid && currentStep < 4) {
      setCurrentStep(prev => prev + 1)
    }
  }, [currentStep, trigger])

  const prevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }, [currentStep])

  const onSubmit = useCallback(async (data: FormData) => {
    const taskData: TaskFormData = {
      title: data.title,
      description: data.description,
      language: data.language,
      dataType: data.dataType,
      criteria: {
        minWordCount: data.minWordCount,
        maxWordCount: data.maxWordCount,
        minDuration: data.minDuration,
        maxDuration: data.maxDuration,
        qualityThreshold: data.qualityThreshold,
        specificRequirements: requirements,
        allowedFormats: formats
      },
      reward: {
        total: data.rewardTotal,
        token: data.rewardToken,
        network: data.rewardNetwork,
        distributionMethod: data.distributionMethod
      },
      deadline: new Date(data.deadline),
      maxSubmissions: data.maxSubmissions,
      requiredValidators: data.requiredValidators
    }

    // Validate form data
    const validationErrors = validateTaskForm(taskData)
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => console.error(error))
      return
    }

    const success = await createTask(taskData)

    if (success) {
      onSuccess?.('new-task-id') // In real implementation, this would come from the API
    }
  }, [requirements, formats, validateTaskForm, createTask, onSuccess])

  // const getDataTypeIcon = (type: string) => {
  //   const dataType = DATA_TYPES.find(dt => dt.value === type)
  //   return dataType ? dataType.icon : FileText
  // }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">Please connect your wallet to create tasks</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="card">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Create New Task</h2>
            <p className="text-gray-600">Set up a language data collection task</p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step <= currentStep
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-600'
                }`}>
                {step < currentStep ? (
                  <CheckCircle className="h-5 w-5" />
                ) : (
                  step
                )}
              </div>
              {step < 4 && (
                <div className={`w-16 h-1 mx-2 ${step < currentStep ? 'bg-primary-600' : 'bg-gray-200'
                  }`} />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Basic Information */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

              {/* Title */}
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Task Title
                </label>
                <input
                  id="title"
                  type="text"
                  {...register('title', {
                    required: 'Title is required',
                    maxLength: { value: 100, message: 'Title must be less than 100 characters' }
                  })}
                  className="input-field"
                  placeholder="e.g., English Conversation Dataset for Chatbot Training"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={4}
                  {...register('description', {
                    required: 'Description is required',
                    minLength: { value: 50, message: 'Description must be at least 50 characters' }
                  })}
                  className="input-field"
                  placeholder="Describe what kind of language data you need, its purpose, and any specific requirements..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Language */}
              <div>
                <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                  Target Language
                </label>
                <select
                  id="language"
                  {...register('language', { required: 'Language is required' })}
                  className="input-field"
                >
                  {SUPPORTED_LANGUAGES.map(lang => (
                    <option key={lang.code} value={lang.code}>
                      {lang.name}
                    </option>
                  ))}
                </select>
                {errors.language && (
                  <p className="mt-1 text-sm text-red-600">{errors.language.message}</p>
                )}
              </div>

              {/* Data Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data Type
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {DATA_TYPES.map(type => {
                    const Icon = type.icon
                    return (
                      <label
                        key={type.value}
                        className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${watchedDataType === type.value
                          ? 'border-primary-600 bg-primary-50'
                          : 'border-gray-300 bg-white hover:bg-gray-50'
                          }`}
                      >
                        <input
                          type="radio"
                          value={type.value}
                          {...register('dataType', { required: 'Data type is required' })}
                          className="sr-only"
                        />
                        <div className="flex items-center">
                          <Icon className="h-6 w-6 text-gray-600 mr-3" />
                          <div>
                            <span className="block text-sm font-medium text-gray-900">
                              {type.label}
                            </span>
                            <span className="block text-sm text-gray-500">
                              {type.description}
                            </span>
                          </div>
                        </div>
                        {watchedDataType === type.value && (
                          <CheckCircle className="h-5 w-5 text-primary-600 absolute top-2 right-2" />
                        )}
                      </label>
                    )
                  })}
                </div>
                {errors.dataType && (
                  <p className="mt-1 text-sm text-red-600">{errors.dataType.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Criteria */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Task Criteria</h3>

              {/* Content Length/Duration */}
              {(watchedDataType === 'text') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="minWordCount" className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Word Count
                    </label>
                    <input
                      id="minWordCount"
                      type="number"
                      min="0"
                      {...register('minWordCount')}
                      className="input-field"
                      placeholder="e.g., 100"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxWordCount" className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Word Count
                    </label>
                    <input
                      id="maxWordCount"
                      type="number"
                      min="0"
                      {...register('maxWordCount')}
                      className="input-field"
                      placeholder="e.g., 1000"
                    />
                  </div>
                </div>
              )}

              {(watchedDataType === 'audio' || watchedDataType === 'video') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="minDuration" className="block text-sm font-medium text-gray-700 mb-2">
                      Minimum Duration (seconds)
                    </label>
                    <input
                      id="minDuration"
                      type="number"
                      min="0"
                      {...register('minDuration')}
                      className="input-field"
                      placeholder="e.g., 30"
                    />
                  </div>
                  <div>
                    <label htmlFor="maxDuration" className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Duration (seconds)
                    </label>
                    <input
                      id="maxDuration"
                      type="number"
                      min="0"
                      {...register('maxDuration')}
                      className="input-field"
                      placeholder="e.g., 300"
                    />
                  </div>
                </div>
              )}

              {/* Quality Threshold */}
              <div>
                <label htmlFor="qualityThreshold" className="block text-sm font-medium text-gray-700 mb-2">
                  Quality Threshold (0-100)
                </label>
                <input
                  id="qualityThreshold"
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  {...register('qualityThreshold', {
                    required: 'Quality threshold is required',
                    min: { value: 0, message: 'Quality threshold must be at least 0' },
                    max: { value: 100, message: 'Quality threshold must be at most 100' }
                  })}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>0 (Low)</span>
                  <span className="font-medium">{watch('qualityThreshold')}</span>
                  <span>100 (High)</span>
                </div>
                {errors.qualityThreshold && (
                  <p className="mt-1 text-sm text-red-600">{errors.qualityThreshold.message}</p>
                )}
              </div>

              {/* Specific Requirements */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specific Requirements
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    {...register('specificRequirements')}
                    className="input-field flex-1"
                    placeholder="Add a specific requirement..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addRequirement(watch('specificRequirements'))
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addRequirement(watch('specificRequirements'))}
                    className="btn-secondary flex items-center"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {requirements.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {requirements.map((req, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                      >
                        {req}
                        <button
                          type="button"
                          onClick={() => removeRequirement(index)}
                          className="ml-2 text-blue-600 hover:text-blue-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Allowed Formats */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Allowed File Formats
                </label>
                <div className="flex space-x-2 mb-2">
                  <input
                    type="text"
                    {...register('allowedFormats')}
                    className="input-field flex-1"
                    placeholder="e.g., .txt, .pdf, .docx"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addFormat(watch('allowedFormats'))
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addFormat(watch('allowedFormats'))}
                    className="btn-secondary flex items-center"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                {formats.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formats.map((format, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800"
                      >
                        {format}
                        <button
                          type="button"
                          onClick={() => removeFormat(index)}
                          className="ml-2 text-green-600 hover:text-green-800"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Rewards */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Reward Configuration</h3>

              {/* Total Reward */}
              <div>
                <label htmlFor="rewardTotal" className="block text-sm font-medium text-gray-700 mb-2">
                  Total Reward Pool
                </label>
                <input
                  id="rewardTotal"
                  type="number"
                  step="0.000001"
                  min="0"
                  {...register('rewardTotal', {
                    required: 'Total reward is required',
                    min: { value: 0.000001, message: 'Reward must be greater than 0' }
                  })}
                  className="input-field"
                  placeholder="0.00"
                />
                {errors.rewardTotal && (
                  <p className="mt-1 text-sm text-red-600">{errors.rewardTotal.message}</p>
                )}
              </div>

              {/* Token Selection */}
              <div>
                <label htmlFor="rewardToken" className="block text-sm font-medium text-gray-700 mb-2">
                  Reward Token
                </label>
                <select
                  id="rewardToken"
                  {...register('rewardToken', { required: 'Token is required' })}
                  className="input-field"
                >
                  {SUPPORTED_TOKENS.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.name} ({token.symbol})
                    </option>
                  ))}
                </select>
                {errors.rewardToken && (
                  <p className="mt-1 text-sm text-red-600">{errors.rewardToken.message}</p>
                )}
              </div>

              {/* Distribution Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Distribution Method
                </label>
                <div className="space-y-3">
                  {[
                    { value: 'immediate', label: 'Immediate', description: 'Pay contributors immediately after validation' },
                    { value: 'milestone', label: 'Milestone-based', description: 'Pay at specific milestones' },
                    { value: 'completion', label: 'On Completion', description: 'Pay all contributors when task is complete' }
                  ].map(method => (
                    <label
                      key={method.value}
                      className={`relative flex cursor-pointer rounded-lg border p-4 focus:outline-none ${watch('distributionMethod') === method.value
                        ? 'border-primary-600 bg-primary-50'
                        : 'border-gray-300 bg-white hover:bg-gray-50'
                        }`}
                    >
                      <input
                        type="radio"
                        value={method.value}
                        {...register('distributionMethod', { required: 'Distribution method is required' })}
                        className="sr-only"
                      />
                      <div>
                        <span className="block text-sm font-medium text-gray-900">
                          {method.label}
                        </span>
                        <span className="block text-sm text-gray-500">
                          {method.description}
                        </span>
                      </div>
                      {watch('distributionMethod') === method.value && (
                        <CheckCircle className="h-5 w-5 text-primary-600 absolute top-2 right-2" />
                      )}
                    </label>
                  ))}
                </div>
                {errors.distributionMethod && (
                  <p className="mt-1 text-sm text-red-600">{errors.distributionMethod.message}</p>
                )}
              </div>

              {/* Reward Calculation */}
              {watchedRewardTotal && watchedMaxSubmissions && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <DollarSign className="h-5 w-5 text-green-600 mr-2" />
                    <h4 className="text-sm font-medium text-green-900">Reward Breakdown</h4>
                  </div>
                  <div className="text-sm text-green-800">
                    <p>Per submission: <span className="font-medium">{calculatePerSubmissionReward()} {watch('rewardToken')}</span></p>
                    <p>Total pool: <span className="font-medium">{watchedRewardTotal} {watch('rewardToken')}</span></p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Timeline & Validation */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Timeline & Validation</h3>

              {/* Deadline */}
              <div>
                <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 mb-2">
                  Task Deadline
                </label>
                <input
                  id="deadline"
                  type="datetime-local"
                  {...register('deadline', {
                    required: 'Deadline is required',
                    validate: value => new Date(value) > new Date() || 'Deadline must be in the future'
                  })}
                  className="input-field"
                  min={new Date().toISOString().slice(0, 16)}
                />
                {errors.deadline && (
                  <p className="mt-1 text-sm text-red-600">{errors.deadline.message}</p>
                )}
              </div>

              {/* Max Submissions */}
              <div>
                <label htmlFor="maxSubmissions" className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Submissions
                </label>
                <input
                  id="maxSubmissions"
                  type="number"
                  min="1"
                  {...register('maxSubmissions', {
                    required: 'Maximum submissions is required',
                    min: { value: 1, message: 'Must allow at least 1 submission' }
                  })}
                  className="input-field"
                  placeholder="100"
                />
                {errors.maxSubmissions && (
                  <p className="mt-1 text-sm text-red-600">{errors.maxSubmissions.message}</p>
                )}
              </div>

              {/* Required Validators */}
              <div>
                <label htmlFor="requiredValidators" className="block text-sm font-medium text-gray-700 mb-2">
                  Required Validators per Submission
                </label>
                <input
                  id="requiredValidators"
                  type="number"
                  min="1"
                  max="10"
                  {...register('requiredValidators', {
                    required: 'Required validators is required',
                    min: { value: 1, message: 'Must require at least 1 validator' },
                    max: { value: 10, message: 'Cannot require more than 10 validators' }
                  })}
                  className="input-field"
                  placeholder="3"
                />
                {errors.requiredValidators && (
                  <p className="mt-1 text-sm text-red-600">{errors.requiredValidators.message}</p>
                )}
              </div>

              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Info className="h-5 w-5 text-blue-600 mr-2" />
                  <h4 className="text-sm font-medium text-blue-900">Task Summary</h4>
                </div>
                <div className="text-sm text-blue-800 space-y-1">
                  <p><span className="font-medium">Title:</span> {watch('title') || 'Untitled Task'}</p>
                  <p><span className="font-medium">Type:</span> {watchedDataType} in {SUPPORTED_LANGUAGES.find(l => l.code === watch('language'))?.name}</p>
                  <p><span className="font-medium">Reward:</span> {watchedRewardTotal} {watch('rewardToken')} total</p>
                  <p><span className="font-medium">Max Submissions:</span> {watchedMaxSubmissions}</p>
                  <p><span className="font-medium">Validators:</span> {watch('requiredValidators')} per submission</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t">
            <button
              type="button"
              onClick={currentStep === 1 ? onCancel : prevStep}
              className="btn-secondary"
              disabled={isCreating}
            >
              {currentStep === 1 ? 'Cancel' : 'Previous'}
            </button>

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="btn-primary"
                disabled={isCreating}
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isCreating}
                className="btn-primary flex items-center"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Task...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Create Task
                  </>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}