import { useState, useRef, useCallback, useEffect } from 'react'
import { toast } from 'react-hot-toast'
import type { CameraCapture } from '../types/submission'

interface UseCameraOptions {
  video?: boolean
  audio?: boolean
  facingMode?: 'user' | 'environment'
  maxDuration?: number // in seconds for video
  onCapture?: (capture: CameraCapture) => void
  onError?: (error: string) => void
}

interface CameraState {
  isSupported: boolean
  isActive: boolean
  isRecording: boolean
  hasPermission: boolean
  error: string | null
  recordingDuration: number
  captures: CameraCapture[]
}

export function useCamera(options: UseCameraOptions = {}) {
  const {
    video = true,
    audio = false,
    facingMode = 'environment',
    maxDuration = 30,
    onCapture,
    onError
  } = options

  const [state, setState] = useState<CameraState>({
    isSupported: 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices,
    isActive: false,
    isRecording: false,
    hasPermission: false,
    error: null,
    recordingDuration: 0,
    captures: []
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Check camera support and permissions
  useEffect(() => {
    if (!state.isSupported) {
      setState(prev => ({ ...prev, error: 'Camera not supported on this device' }))
      onError?.('Camera not supported on this device')
    }
  }, [state.isSupported, onError])

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) return false

    try {
      const constraints: MediaStreamConstraints = {
        video: video ? {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } : false,
        audio: audio
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      // Test successful, stop the stream
      stream.getTracks().forEach(track => track.stop())

      setState(prev => ({ ...prev, hasPermission: true, error: null }))
      return true
    } catch (error: any) {
      const errorMessage = error.name === 'NotAllowedError'
        ? 'Camera permission denied. Please allow camera access and try again.'
        : error.name === 'NotFoundError'
          ? 'No camera found on this device.'
          : `Camera error: ${error.message}`

      setState(prev => ({ ...prev, hasPermission: false, error: errorMessage }))
      onError?.(errorMessage)
      toast.error(errorMessage)
      return false
    }
  }, [state.isSupported, video, audio, facingMode, onError])

  const startCamera = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !state.hasPermission) {
      const hasPermission = await requestPermissions()
      if (!hasPermission) return false
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: video ? {
          facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } : false,
        audio: audio
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setState(prev => ({ ...prev, isActive: true, error: null }))
      return true
    } catch (error: any) {
      const errorMessage = `Failed to start camera: ${error.message}`
      setState(prev => ({ ...prev, error: errorMessage }))
      onError?.(errorMessage)
      toast.error(errorMessage)
      return false
    }
  }, [state.isSupported, state.hasPermission, video, audio, facingMode, requestPermissions, onError])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    setState(prev => ({
      ...prev,
      isActive: false,
      isRecording: false,
      recordingDuration: 0
    }))
  }, [])

  const capturePhoto = useCallback((): CameraCapture | null => {
    if (!videoRef.current || !canvasRef.current || !state.isActive) {
      toast.error('Camera not active')
      return null
    }

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) {
        toast.error('Canvas not supported')
        return null
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw video frame to canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to blob
      return new Promise<CameraCapture>((resolve) => {
        canvas.toBlob((blob) => {
          if (!blob) {
            toast.error('Failed to capture photo')
            return
          }

          const fileName = `photo_${Date.now()}.jpg`
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9)

          const capture: CameraCapture = {
            blob,
            dataUrl,
            fileName,
            mimeType: 'image/jpeg'
          }

          setState(prev => ({
            ...prev,
            captures: [...prev.captures, capture]
          }))

          onCapture?.(capture)
          toast.success('Photo captured!')
          resolve(capture)
        }, 'image/jpeg', 0.9)
      }) as any // Type assertion for synchronous return
    } catch (error: any) {
      const errorMessage = `Failed to capture photo: ${error.message}`
      toast.error(errorMessage)
      onError?.(errorMessage)
      return null
    }
  }, [state.isActive, onCapture, onError])

  const startRecording = useCallback((): boolean => {
    if (!streamRef.current || !state.isActive || state.isRecording) {
      toast.error('Cannot start recording')
      return false
    }

    try {
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9'
      })

      chunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const fileName = `video_${Date.now()}.webm`
        const dataUrl = URL.createObjectURL(blob)

        const capture: CameraCapture = {
          blob,
          dataUrl,
          fileName,
          mimeType: 'video/webm'
        }

        setState(prev => ({
          ...prev,
          captures: [...prev.captures, capture],
          isRecording: false,
          recordingDuration: 0
        }))

        onCapture?.(capture)
        toast.success('Video recorded!')
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start(1000) // Collect data every second

      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setState(prev => {
          const newDuration = prev.recordingDuration + 1

          // Auto-stop at max duration
          if (newDuration >= maxDuration) {
            stopRecording()
            return { ...prev, recordingDuration: maxDuration }
          }

          return { ...prev, recordingDuration: newDuration }
        })
      }, 1000)

      setState(prev => ({ ...prev, isRecording: true }))
      toast.success('Recording started')
      return true
    } catch (error: any) {
      const errorMessage = `Failed to start recording: ${error.message}`
      toast.error(errorMessage)
      onError?.(errorMessage)
      return false
    }
  }, [state.isActive, state.isRecording, maxDuration, onCapture, onError])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
  }, [state.isRecording])

  const deleteCapture = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      captures: prev.captures.filter((_, i) => i !== index)
    }))
  }, [])

  const clearCaptures = useCallback(() => {
    setState(prev => ({ ...prev, captures: [] }))
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return {
    // State
    isSupported: state.isSupported,
    isActive: state.isActive,
    isRecording: state.isRecording,
    hasPermission: state.hasPermission,
    error: state.error,
    recordingDuration: state.recordingDuration,
    captures: state.captures,
    maxDuration,

    // Refs for components
    videoRef,
    canvasRef,

    // Actions
    requestPermissions,
    startCamera,
    stopCamera,
    capturePhoto,
    startRecording,
    stopRecording,
    deleteCapture,
    clearCaptures,

    // Utilities
    formatDuration: (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}:${secs.toString().padStart(2, '0')}`
    }
  }
}