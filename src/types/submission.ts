// Data submission types and interfaces

export interface DataSubmission {
  id: string
  taskId: string
  contributor: string
  storageUrl: string
  metadata: SubmissionMetadata
  verification: VerificationResult
  rewards: RewardInfo
  createdAt: Date
  updatedAt: Date
}

export interface SubmissionMetadata {
  language: string
  wordCount?: number
  duration?: number
  fileSize: number
  mimeType: string
  originalFileName: string
  checksum: string
}

export interface VerificationResult {
  aiScore: number
  validatorScores: number[]
  finalScore: number
  status: 'pending' | 'processing' | 'verified' | 'rejected'
  issues: string[]
  recommendations: string[]
  confidence: number
  processingTime: number
  auditTrail: AuditEntry[]
}

export interface AuditEntry {
  timestamp: Date
  action: string
  actor: string
  details: Record<string, any>
}

export interface RewardInfo {
  amount: string
  token: string
  network: string
  paid: boolean
  transactionHash?: string
}

export interface SecureUploadRequest {
  taskId: string
  fileType: string
  fileSize: number
  contentType: string
  fileName: string
}

export interface SecureUploadResponse {
  uploadUrl: string
  fileId: string
  submissionId: string
  expiresAt: Date
  maxFileSize: number
  allowedTypes: string[]
}

export interface SubmissionProgress {
  submissionId: string
  stage: 'uploading' | 'processing' | 'verifying' | 'complete' | 'error'
  progress: number
  message: string
  error?: string
  estimatedTimeRemaining?: number
}

export interface FileUploadProgress {
  loaded: number
  total: number
  percentage: number
  speed: number
  timeRemaining: number
}

export interface CameraCapture {
  blob: Blob
  dataUrl: string
  fileName: string
  mimeType: string
}

export interface SubmissionFormData {
  taskId: string
  file: File | null
  language: string
  description: string
  tags: string[]
  agreedToTerms: boolean
}

export interface ValidationError {
  field: string
  message: string
  code: string
}

export interface SubmissionResponse {
  success: boolean
  submissionId?: string
  errors?: ValidationError[]
  message: string
}