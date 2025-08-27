import { useState, useCallback, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { SubmissionService } from '../services/submissionService'
import type {
  SecureUploadRequest,
  SecureUploadResponse,
  FileUploadProgress,
  SubmissionFormData,
  ValidationError
} from '../types/submission'

interface UseFileUploadOptions {
  onSuccess?: (submissionId: string) => void
  onError?: (error: string) => void
  onProgress?: (progress: FileUploadProgress) => void
}

interface FileUploadState {
  isUploading: boolean
  isSubmitting: boolean
  uploadProgress: FileUploadProgress | null
  uploadResponse: SecureUploadResponse | null
  errors: ValidationError[]
  submissionId: string | null
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const [state, setState] = useState<FileUploadState>({
    isUploading: false,
    isSubmitting: false,
    uploadProgress: null,
    uploadResponse: null,
    errors: [],
    submissionId: null
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const resetState = useCallback(() => {
    setState({
      isUploading: false,
      isSubmitting: false,
      uploadProgress: null,
      uploadResponse: null,
      errors: [],
      submissionId: null
    })
  }, [])

  const validateFile = useCallback((file: File, allowedTypes: string[], maxSize: number): boolean => {
    const validationErrors = SubmissionService.validateFile(file, allowedTypes, maxSize)

    if (validationErrors.length > 0) {
      setState(prev => ({
        ...prev,
        errors: validationErrors.map(error => ({
          field: 'file',
          message: error,
          code: 'VALIDATION_ERROR'
        }))
      }))
      return false
    }

    setState(prev => ({ ...prev, errors: [] }))
    return true
  }, [])

  const requestUploadUrl = useCallback(async (request: SecureUploadRequest): Promise<SecureUploadResponse | null> => {
    try {
      setState(prev => ({ ...prev, isUploading: true, errors: [] }))

      const response = await SubmissionService.requestUploadUrl(request)

      setState(prev => ({ ...prev, uploadResponse: response }))
      return response
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to get upload URL'
      setState(prev => ({
        ...prev,
        isUploading: false,
        errors: [{
          field: 'upload',
          message: errorMessage,
          code: 'UPLOAD_URL_ERROR'
        }]
      }))
      toast.error(errorMessage)
      options.onError?.(errorMessage)
      return null
    }
  }, [options])

  const uploadFile = useCallback(async (file: File, uploadUrl: string): Promise<boolean> => {
    try {
      abortControllerRef.current = new AbortController()

      await SubmissionService.uploadFile(file, uploadUrl, (progress) => {
        setState(prev => ({ ...prev, uploadProgress: progress }))
        options.onProgress?.(progress)
      })

      setState(prev => ({ ...prev, isUploading: false, uploadProgress: null }))
      return true
    } catch (error: any) {
      const errorMessage = error.message || 'File upload failed'
      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: null,
        errors: [{
          field: 'upload',
          message: errorMessage,
          code: 'UPLOAD_ERROR'
        }]
      }))
      toast.error(errorMessage)
      options.onError?.(errorMessage)
      return false
    }
  }, [options])

  const submitData = useCallback(async (
    submissionId: string,
    formData: Omit<SubmissionFormData, 'file'>
  ): Promise<boolean> => {
    try {
      setState(prev => ({ ...prev, isSubmitting: true, errors: [] }))

      const response = await SubmissionService.submitData(submissionId, formData)

      if (response.success) {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          submissionId: response.submissionId || null
        }))
        toast.success(response.message)
        options.onSuccess?.(response.submissionId || submissionId)
        return true
      } else {
        setState(prev => ({
          ...prev,
          isSubmitting: false,
          errors: response.errors || []
        }))
        toast.error(response.message)
        options.onError?.(response.message)
        return false
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Submission failed'
      setState(prev => ({
        ...prev,
        isSubmitting: false,
        errors: [{
          field: 'submission',
          message: errorMessage,
          code: 'SUBMISSION_ERROR'
        }]
      }))
      toast.error(errorMessage)
      options.onError?.(errorMessage)
      return false
    }
  }, [options])

  const uploadAndSubmit = useCallback(async (
    file: File,
    formData: SubmissionFormData
  ): Promise<boolean> => {
    try {
      // Step 1: Request upload URL
      const uploadRequest: SecureUploadRequest = {
        taskId: formData.taskId,
        fileType: file.type,
        fileSize: file.size,
        contentType: file.type,
        fileName: file.name
      }

      const uploadResponse = await requestUploadUrl(uploadRequest)
      if (!uploadResponse) return false

      // Step 2: Validate file
      if (!validateFile(file, uploadResponse.allowedTypes, uploadResponse.maxFileSize)) {
        return false
      }

      // Step 3: Upload file
      const uploadSuccess = await uploadFile(file, uploadResponse.uploadUrl)
      if (!uploadSuccess) return false

      // Step 4: Submit data
      const submitSuccess = await submitData(uploadResponse.submissionId, {
        taskId: formData.taskId,
        language: formData.language,
        description: formData.description,
        tags: formData.tags,
        agreedToTerms: formData.agreedToTerms
      })

      return submitSuccess
    } catch (error: any) {
      const errorMessage = error.message || 'Upload and submission failed'
      toast.error(errorMessage)
      options.onError?.(errorMessage)
      return false
    }
  }, [requestUploadUrl, validateFile, uploadFile, submitData, options])

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    setState(prev => ({
      ...prev,
      isUploading: false,
      uploadProgress: null
    }))

    toast('Upload cancelled')
  }, [])

  const getErrorsForField = useCallback((field: string): string[] => {
    return state.errors
      .filter(error => error.field === field)
      .map(error => error.message)
  }, [state.errors])

  const hasErrors = state.errors.length > 0
  const isLoading = state.isUploading || state.isSubmitting

  return {
    // State
    isUploading: state.isUploading,
    isSubmitting: state.isSubmitting,
    isLoading,
    uploadProgress: state.uploadProgress,
    uploadResponse: state.uploadResponse,
    errors: state.errors,
    hasErrors,
    submissionId: state.submissionId,

    // Actions
    requestUploadUrl,
    uploadFile,
    submitData,
    uploadAndSubmit,
    cancelUpload,
    resetState,
    validateFile,

    // Utilities
    getErrorsForField,
    formatFileSize: SubmissionService.formatFileSize,
    formatSpeed: SubmissionService.formatSpeed,
    formatTimeRemaining: SubmissionService.formatTimeRemaining
  }
}