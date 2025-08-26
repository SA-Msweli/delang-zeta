import React, { useState, useRef, useCallback } from 'react'
import { Upload, X, File, Image, Video, Music, FileText, AlertCircle, CheckCircle } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (files: File[]) => void
  accept?: string
  multiple?: boolean
  maxSize?: number // in MB
  maxFiles?: number
  className?: string
  disabled?: boolean
  progress?: number
  error?: string
}

export function FileUpload({
  onFileSelect,
  accept = '*/*',
  multiple = false,
  maxSize = 10, // 10MB default
  maxFiles = 1,
  className = '',
  disabled = false,
  progress,
  error
}: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const validFiles: File[] = []
    const errors: string[] = []

    // Validate files
    fileArray.forEach(file => {
      // Check file size
      if (file.size > maxSize * 1024 * 1024) {
        errors.push(`${file.name} is too large (max ${maxSize}MB)`)
        return
      }

      // Check file count
      if (validFiles.length >= maxFiles) {
        errors.push(`Maximum ${maxFiles} files allowed`)
        return
      }

      validFiles.push(file)
    })

    if (errors.length > 0) {
      console.error('File validation errors:', errors)
      return
    }

    setSelectedFiles(validFiles)
    onFileSelect(validFiles)
  }, [maxSize, maxFiles, onFileSelect])

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragOver(true)
    }
  }, [disabled])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    if (disabled) return

    handleFileSelect(e.dataTransfer.files)
  }, [disabled, handleFileSelect])

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files)
  }, [handleFileSelect])

  // Handle click to select files
  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }, [disabled])

  // Remove file
  const removeFile = useCallback((index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    setSelectedFiles(newFiles)
    onFileSelect(newFiles)
  }, [selectedFiles, onFileSelect])

  // Get file icon
  const getFileIcon = (file: File) => {
    const type = file.type.toLowerCase()

    if (type.startsWith('image/')) return Image
    if (type.startsWith('video/')) return Video
    if (type.startsWith('audio/')) return Music
    if (type.includes('text') || type.includes('document')) return FileText

    return File
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 transition-all cursor-pointer
          ${isDragOver
            ? 'border-blue-400 bg-blue-50'
            : error
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="text-center">
          <Upload className={`
            mx-auto h-12 w-12 mb-4
            ${isDragOver ? 'text-blue-500' : error ? 'text-red-400' : 'text-gray-400'}
          `} />

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900">
              {isDragOver
                ? 'Drop files here'
                : 'Click to upload or drag and drop'
              }
            </p>

            <p className="text-xs text-gray-500">
              {accept === '*/*' ? 'Any file type' : accept} up to {maxSize}MB
              {multiple && ` (max ${maxFiles} files)`}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        {progress !== undefined && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200 rounded-b-lg overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-900">
            Selected Files ({selectedFiles.length})
          </h4>

          <div className="space-y-2">
            {selectedFiles.map((file, index) => {
              const FileIcon = getFileIcon(file)

              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <FileIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  {progress === undefined && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        removeFile(index)
                      }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {progress !== undefined && progress === 100 && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Mobile-optimized camera upload component
interface CameraUploadProps {
  onCapture: (file: File) => void
  className?: string
  disabled?: boolean
}

export function CameraUpload({ onCapture, className = '', disabled = false }: CameraUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onCapture(file)
    }
  }, [onCapture])

  const handleClick = useCallback(() => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }, [disabled])

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleCapture}
        disabled={disabled}
        className="hidden"
      />

      <button
        onClick={handleClick}
        disabled={disabled}
        className={`
          w-full flex items-center justify-center gap-2 px-4 py-3 
          border border-gray-300 rounded-lg transition-colors
          ${disabled
            ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 hover:bg-gray-50'
          }
        `}
      >
        <Image className="w-5 h-5" />
        <span className="font-medium">Take Photo</span>
      </button>
    </div>
  )
}