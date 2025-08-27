import { useState, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'react-hot-toast'
import {
  Upload,
  Camera,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  Image,
  Video,
  Mic,
  Loader2
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useFileUpload } from '../hooks/useFileUpload'
import { useCamera } from '../hooks/useCamera'
import type { SubmissionFormData, CameraCapture } from '../types/submission'

interface DataSubmissionProps {
  taskId: string
  onSuccess?: (submissionId: string) => void
  onCancel?: () => void
}

interface FormData {
  language: string
  description: string
  tags: string
  agreedToTerms: boolean
}

export function DataSubmission({ taskId, onSuccess, onCancel }: DataSubmissionProps) {
  const { isAuthenticated } = useAuth()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [showCamera, setShowCamera] = useState(false)
  const [selectedCapture, setSelectedCapture] = useState<CameraCapture | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue
  } = useForm<FormData>({
    defaultValues: {
      language: 'en',
      description: '',
      tags: '',
      agreedToTerms: false
    }
  })

  const {
    isLoading,
    uploadProgress,
    hasErrors,
    getErrorsForField,
    uploadAndSubmit,
    cancelUpload,
    resetState,
    formatFileSize
  } = useFileUpload({
    onSuccess: (submissionId) => {
      toast.success('Data submitted successfully!')
      onSuccess?.(submissionId)
      resetForm()
    },
    onError: (error) => {
      toast.error(error)
    }
  })

  const camera = useCamera({
    video: true,
    audio: false,
    facingMode: 'environment',
    onCapture: (capture) => {
      setSelectedCapture(capture)
      setShowCamera(false)
      // Convert blob to File
      const file = new File([capture.blob], capture.fileName, { type: capture.mimeType })
      setSelectedFile(file)
    },
    onError: (error) => {
      toast.error(error)
      setShowCamera(false)
    }
  })

  const resetForm = useCallback(() => {
    setSelectedFile(null)
    setSelectedCapture(null)
    setShowCamera(false)
    resetState()
    setValue('description', '')
    setValue('tags', '')
    setValue('agreedToTerms', false)
  }, [resetState, setValue])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      setSelectedFile(file)
      setSelectedCapture(null)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      setSelectedFile(file)
      setSelectedCapture(null)
    }
  }, [])

  const handleCameraClick = useCallback(async () => {
    if (!camera.isSupported) {
      toast.error('Camera not supported on this device')
      return
    }

    if (!camera.hasPermission) {
      const hasPermission = await camera.requestPermissions()
      if (!hasPermission) return
    }

    setShowCamera(true)
    await camera.startCamera()
  }, [camera])

  const handleCameraCapture = useCallback(() => {
    camera.capturePhoto()
  }, [camera])

  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null)
    setSelectedCapture(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  const onSubmit = useCallback(async (data: FormData) => {
    if (!isAuthenticated) {
      toast.error('Please authenticate first')
      return
    }

    if (!selectedFile) {
      toast.error('Please select a file to upload')
      return
    }

    const formData: SubmissionFormData = {
      taskId,
      file: selectedFile,
      language: data.language,
      description: data.description,
      tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      agreedToTerms: data.agreedToTerms
    }

    await uploadAndSubmit(selectedFile, formData)
  }, [isAuthenticated, selectedFile, taskId, uploadAndSubmit])

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-8 w-8 text-blue-500" />
    if (file.type.startsWith('video/')) return <Video className="h-8 w-8 text-purple-500" />
    if (file.type.startsWith('audio/')) return <Mic className="h-8 w-8 text-green-500" />
    return <FileText className="h-8 w-8 text-gray-500" />
  }

  if (!isAuthenticated) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">Please connect your wallet to submit data</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Submit Data</h2>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* File Upload Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload File
            </label>

            {!selectedFile ? (
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                  }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="space-y-4">
                  <div className="flex justify-center space-x-4">
                    <Upload className="h-12 w-12 text-gray-400" />
                  </div>

                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      Drop your file here, or click to browse
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Supports images, videos, audio files, and documents
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-secondary flex items-center justify-center"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Browse Files
                    </button>

                    {camera.isSupported && (
                      <button
                        type="button"
                        onClick={handleCameraClick}
                        className="btn-secondary flex items-center justify-center"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Use Camera
                      </button>
                    )}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept="image/*,video/*,audio/*,.txt,.pdf,.doc,.docx"
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getFileIcon(selectedFile)}
                    <div>
                      <p className="font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {selectedCapture && (
                  <div className="mt-4">
                    <img
                      src={selectedCapture.dataUrl}
                      alt="Captured"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}

            {getErrorsForField('file').map((error, index) => (
              <p key={index} className="mt-1 text-sm text-red-600">{error}</p>
            ))}
          </div>

          {/* Upload Progress */}
          {uploadProgress && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900">
                  Uploading... {uploadProgress.percentage}%
                </span>
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Cancel
                </button>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-blue-700 mt-1">
                <span>{formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}</span>
                <span>
                  {uploadProgress.speed > 0 && `${formatFileSize(uploadProgress.speed)}/s`}
                </span>
              </div>
            </div>
          )}

          {/* Language Selection */}
          <div>
            <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
              Language
            </label>
            <select
              id="language"
              {...register('language', { required: 'Language is required' })}
              className="input-field"
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="it">Italian</option>
              <option value="pt">Portuguese</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
              <option value="ar">Arabic</option>
              <option value="hi">Hindi</option>
              <option value="ru">Russian</option>
            </select>
            {errors.language && (
              <p className="mt-1 text-sm text-red-600">{errors.language.message}</p>
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
                minLength: { value: 10, message: 'Description must be at least 10 characters' }
              })}
              className="input-field"
              placeholder="Describe your data submission..."
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-2">
              Tags (comma-separated)
            </label>
            <input
              id="tags"
              type="text"
              {...register('tags')}
              className="input-field"
              placeholder="conversation, casual, native-speaker"
            />
            <p className="mt-1 text-sm text-gray-500">
              Add relevant tags to help categorize your submission
            </p>
          </div>

          {/* Terms Agreement */}
          <div className="flex items-start space-x-3">
            <input
              id="agreedToTerms"
              type="checkbox"
              {...register('agreedToTerms', { required: 'You must agree to the terms' })}
              className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <label htmlFor="agreedToTerms" className="text-sm text-gray-700">
              I agree that my submission is original content and I have the right to license it.
              I understand that it will be verified by AI and community validators.
            </label>
          </div>
          {errors.agreedToTerms && (
            <p className="mt-1 text-sm text-red-600">{errors.agreedToTerms.message}</p>
          )}

          {/* Error Messages */}
          {hasErrors && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <h3 className="text-sm font-medium text-red-800">
                  Please fix the following errors:
                </h3>
              </div>
              <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                {getErrorsForField('upload').map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
                {getErrorsForField('submission').map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isLoading || !selectedFile || !watch('agreedToTerms')}
              className="btn-primary flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploadProgress ? 'Uploading...' : 'Submitting...'}
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Submit Data
                </>
              )}
            </button>

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn-secondary"
                disabled={isLoading}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Capture Photo</h3>
              <button
                onClick={() => {
                  camera.stopCamera()
                  setShowCamera(false)
                }}
                className="p-2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                <video
                  ref={camera.videoRef}
                  className="w-full h-64 sm:h-80 object-cover"
                  playsInline
                  muted
                />
                <canvas
                  ref={camera.canvasRef}
                  className="hidden"
                />
              </div>

              <div className="flex justify-center space-x-4">
                <button
                  onClick={handleCameraCapture}
                  disabled={!camera.isActive}
                  className="btn-primary flex items-center disabled:opacity-50"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Capture Photo
                </button>

                <button
                  onClick={() => {
                    camera.stopCamera()
                    setShowCamera(false)
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}