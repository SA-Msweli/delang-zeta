import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ResponsiveModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  className?: string
  closeOnOverlayClick?: boolean
  showCloseButton?: boolean
}

export function ResponsiveModal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  className = '',
  closeOnOverlayClick = true,
  showCloseButton = true
}: ResponsiveModalProps) {

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Size classes
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={closeOnOverlayClick ? onClose : undefined}
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Modal Content */}
        <div className={`
          relative bg-white rounded-lg shadow-xl w-full transform transition-all
          ${sizeClasses[size]} ${className}
        `}>
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              {title && (
                <h2 className="text-xl font-semibold text-gray-900 pr-4">
                  {title}
                </h2>
              )}

              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>
          )}

          {/* Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ModalHeaderProps {
  children: ReactNode
  className?: string
}

export function ModalHeader({ children, className = '' }: ModalHeaderProps) {
  return (
    <div className={`pb-4 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  )
}

interface ModalBodyProps {
  children: ReactNode
  className?: string
}

export function ModalBody({ children, className = '' }: ModalBodyProps) {
  return (
    <div className={`py-4 ${className}`}>
      {children}
    </div>
  )
}

interface ModalFooterProps {
  children: ReactNode
  className?: string
}

export function ModalFooter({ children, className = '' }: ModalFooterProps) {
  return (
    <div className={`pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-3 justify-end ${className}`}>
      {children}
    </div>
  )
}

// Mobile-optimized bottom sheet modal
interface BottomSheetProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className = ''
}: BottomSheetProps) {

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className={`
        fixed bottom-0 left-0 right-0 bg-white rounded-t-xl shadow-xl transform transition-transform
        max-h-[90vh] overflow-hidden safe-area-bottom
        ${className}
      `}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-8 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

// Confirmation modal
interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  type?: 'danger' | 'warning' | 'info'
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'info'
}: ConfirmModalProps) {

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const buttonStyles = {
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 text-white'
  }

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={title}
    >
      <div className="space-y-4">
        <p className="text-gray-600">{message}</p>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg transition-colors ${buttonStyles[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </ResponsiveModal>
  )
}