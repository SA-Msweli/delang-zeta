import React, { ReactNode } from 'react'
import { AlertCircle, CheckCircle, Info } from 'lucide-react'

interface FormFieldProps {
  label: string
  children: ReactNode
  error?: string
  required?: boolean
  description?: string
  className?: string
}

export function FormField({
  label,
  children,
  error,
  required = false,
  description,
  className = ''
}: FormFieldProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {description && (
        <p className="text-sm text-gray-500">{description}</p>
      )}

      <div className="relative">
        {children}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}

interface ResponsiveFormProps {
  children: ReactNode
  onSubmit?: (e: React.FormEvent) => void
  className?: string
  layout?: 'single' | 'double' | 'auto'
}

export function ResponsiveForm({
  children,
  onSubmit,
  className = '',
  layout = 'auto'
}: ResponsiveFormProps) {
  const getLayoutClasses = () => {
    switch (layout) {
      case 'single':
        return 'grid grid-cols-1 gap-6'
      case 'double':
        return 'grid grid-cols-1 md:grid-cols-2 gap-6'
      case 'auto':
      default:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
    }
  }

  return (
    <form onSubmit={onSubmit} className={`space-y-6 ${className}`}>
      <div className={getLayoutClasses()}>
        {children}
      </div>
    </form>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, className = '', ...props }: InputProps) {
  return (
    <input
      className={`
        w-full px-3 py-2 border rounded-lg transition-colors
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
        ${error
          ? 'border-red-300 focus:ring-red-500'
          : 'border-gray-300 hover:border-gray-400'
        }
        ${className}
      `}
      {...props}
    />
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ error, className = '', ...props }: TextareaProps) {
  return (
    <textarea
      className={`
        w-full px-3 py-2 border rounded-lg transition-colors resize-vertical
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
        ${error
          ? 'border-red-300 focus:ring-red-500'
          : 'border-gray-300 hover:border-gray-400'
        }
        ${className}
      `}
      {...props}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
  options: { value: string; label: string }[]
  placeholder?: string
}

export function Select({ error, options, placeholder, className = '', ...props }: SelectProps) {
  return (
    <select
      className={`
        w-full px-3 py-2 border rounded-lg transition-colors
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
        disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
        ${error
          ? 'border-red-300 focus:ring-red-500'
          : 'border-gray-300 hover:border-gray-400'
        }
        ${className}
      `}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  description?: string
}

export function Checkbox({ label, description, className = '', ...props }: CheckboxProps) {
  return (
    <div className={`flex items-start gap-3 ${className}`}>
      <input
        type="checkbox"
        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
        {...props}
      />
      <div className="flex-1">
        <label className="text-sm font-medium text-gray-700 cursor-pointer">
          {label}
        </label>
        {description && (
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        )}
      </div>
    </div>
  )
}

interface RadioGroupProps {
  name: string
  options: { value: string; label: string; description?: string }[]
  value?: string
  onChange?: (value: string) => void
  className?: string
}

export function RadioGroup({ name, options, value, onChange, className = '' }: RadioGroupProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {options.map((option) => (
        <div key={option.value} className="flex items-start gap-3">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={(e) => onChange?.(e.target.value)}
            className="mt-1 w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500 focus:ring-2"
          />
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700 cursor-pointer">
              {option.label}
            </label>
            {option.description && (
              <p className="text-sm text-gray-500 mt-1">{option.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

interface FormActionsProps {
  children: ReactNode
  className?: string
  align?: 'left' | 'center' | 'right'
}

export function FormActions({ children, className = '', align = 'right' }: FormActionsProps) {
  const alignClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end'
  }

  return (
    <div className={`flex flex-col sm:flex-row gap-3 ${alignClasses[align]} ${className}`}>
      {children}
    </div>
  )
}

interface FormMessageProps {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  className?: string
}

export function FormMessage({ type, message, className = '' }: FormMessageProps) {
  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: CheckCircle
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: AlertCircle
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: Info
    },
    warning: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      icon: AlertCircle
    }
  }

  const style = styles[type]
  const Icon = style.icon

  return (
    <div className={`
      flex items-center gap-3 p-4 rounded-lg border
      ${style.bg} ${style.border} ${style.text} ${className}
    `}>
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="text-sm">{message}</span>
    </div>
  )
}