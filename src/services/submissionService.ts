import { apiClient } from '../config/api'
import type {
  SecureUploadRequest,
  SecureUploadResponse,
  DataSubmission,
  SubmissionFormData,
  SubmissionResponse,
  SubmissionProgress,
  FileUploadProgress
} from '../types/submission'

export class SubmissionService {
  private static readonly UPLOAD_ENDPOINT = '/secure-upload'
  private static readonly SUBMIT_ENDPOINT = '/submit-data'
  private static readonly PROGRESS_ENDPOINT = '/submission-progress'
  private static readonly SUBMISSIONS_ENDPOINT = '/submissions'

  /**
   * Request secure upload URL from Cloud Functions
   */
  static async requestUploadUrl(request: SecureUploadRequest): Promise<SecureUploadResponse> {
    try {
      const response = await apiClient.post(this.UPLOAD_ENDPOINT, {
        taskId: request.taskId,
        fileType: request.fileType,
        fileSize: request.fileSize,
        contentType: request.contentType,
        fileName: request.fileName
      })

      return {
        uploadUrl: response.data.uploadUrl,
        fileId: response.data.fileId,
        submissionId: response.data.submissionId,
        expiresAt: new Date(response.data.expiresAt),
        maxFileSize: response.data.maxFileSize,
        allowedTypes: response.data.allowedTypes
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get upload URL')
    }
  }

  /**
   * Upload file to Google Cloud Storage using signed URL
   */
  static async uploadFile(
    file: File,
    uploadUrl: string,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const startTime = Date.now()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const elapsed = Date.now() - startTime
          const speed = event.loaded / (elapsed / 1000) // bytes per second
          const timeRemaining = speed > 0 ? (event.total - event.loaded) / speed : 0

          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage: Math.round((event.loaded / event.total) * 100),
            speed,
            timeRemaining
          })
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`))
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed due to network error'))
      })

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timed out'))
      })

      xhr.open('PUT', uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.timeout = 300000 // 5 minutes timeout
      xhr.send(file)
    })
  }

  /**
   * Submit data after successful upload
   */
  static async submitData(
    submissionId: string,
    formData: Omit<SubmissionFormData, 'file'>
  ): Promise<SubmissionResponse> {
    try {
      const response = await apiClient.post(this.SUBMIT_ENDPOINT, {
        submissionId,
        taskId: formData.taskId,
        language: formData.language,
        description: formData.description,
        tags: formData.tags,
        agreedToTerms: formData.agreedToTerms
      })

      return {
        success: true,
        submissionId: response.data.submissionId,
        message: response.data.message
      }
    } catch (error: any) {
      return {
        success: false,
        errors: error.response?.data?.errors || [],
        message: error.response?.data?.error || 'Submission failed'
      }
    }
  }

  /**
   * Get submission progress with real-time updates
   */
  static async getSubmissionProgress(submissionId: string): Promise<SubmissionProgress> {
    try {
      const response = await apiClient.get(`${this.PROGRESS_ENDPOINT}/${submissionId}`)

      return {
        submissionId: response.data.submissionId,
        stage: response.data.stage,
        progress: response.data.progress,
        message: response.data.message,
        error: response.data.error,
        estimatedTimeRemaining: response.data.estimatedTimeRemaining
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get submission progress')
    }
  }

  /**
   * Get user's submissions with pagination
   */
  static async getUserSubmissions(
    page = 1,
    limit = 10,
    status?: string
  ): Promise<{ submissions: DataSubmission[], total: number, hasMore: boolean }> {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(status && { status })
      })

      const response = await apiClient.get(`${this.SUBMISSIONS_ENDPOINT}?${params}`)

      return {
        submissions: response.data.submissions.map(this.transformSubmission),
        total: response.data.total,
        hasMore: response.data.hasMore
      }
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get submissions')
    }
  }

  /**
   * Get submission details by ID
   */
  static async getSubmission(submissionId: string): Promise<DataSubmission> {
    try {
      const response = await apiClient.get(`${this.SUBMISSIONS_ENDPOINT}/${submissionId}`)
      return this.transformSubmission(response.data)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to get submission')
    }
  }

  /**
   * Cancel pending submission
   */
  static async cancelSubmission(submissionId: string): Promise<void> {
    try {
      await apiClient.delete(`${this.SUBMISSIONS_ENDPOINT}/${submissionId}`)
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'Failed to cancel submission')
    }
  }

  /**
   * Validate file before upload
   */
  static validateFile(file: File, allowedTypes: string[], maxSize: number): string[] {
    const errors: string[] = []

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size exceeds maximum allowed size of ${this.formatFileSize(maxSize)}`)
    }

    // Check file type
    if (!allowedTypes.includes(file.type)) {
      errors.push(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`)
    }

    // Check file name
    if (file.name.length > 255) {
      errors.push('File name is too long (maximum 255 characters)')
    }

    return errors
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Calculate upload speed for display
   */
  static formatSpeed(bytesPerSecond: number): string {
    return `${this.formatFileSize(bytesPerSecond)}/s`
  }

  /**
   * Format time remaining for display
   */
  static formatTimeRemaining(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds / 3600)}h`
  }

  /**
   * Transform API response to DataSubmission type
   */
  private static transformSubmission(data: any): DataSubmission {
    return {
      id: data.id,
      taskId: data.taskId,
      contributor: data.contributor,
      storageUrl: data.storageUrl,
      metadata: {
        language: data.metadata.language,
        wordCount: data.metadata.wordCount,
        duration: data.metadata.duration,
        fileSize: data.metadata.fileSize,
        mimeType: data.metadata.mimeType,
        originalFileName: data.metadata.originalFileName,
        checksum: data.metadata.checksum
      },
      verification: {
        aiScore: data.verification.aiScore,
        validatorScores: data.verification.validatorScores || [],
        finalScore: data.verification.finalScore,
        status: data.verification.status,
        issues: data.verification.issues || [],
        recommendations: data.verification.recommendations || [],
        confidence: data.verification.confidence,
        processingTime: data.verification.processingTime,
        auditTrail: data.verification.auditTrail?.map((entry: any) => ({
          timestamp: new Date(entry.timestamp),
          action: entry.action,
          actor: entry.actor,
          details: entry.details
        })) || []
      },
      rewards: {
        amount: data.rewards.amount,
        token: data.rewards.token,
        network: data.rewards.network,
        paid: data.rewards.paid,
        transactionHash: data.rewards.transactionHash
      },
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    }
  }
}