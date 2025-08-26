
import { Wallet, LogOut, AlertCircle, CheckCircle } from 'lucide-react'
import { useWalletAuth } from '../../hooks/useWalletAuth'

interface WalletButtonProps {
  className?: string
  showFullAddress?: boolean
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export function WalletButton({
  className = '',
  showFullAddress = false,
  variant = 'primary',
  size = 'md'
}: WalletButtonProps) {
  const {
    isConnected,
    isConnecting,
    isAuthenticated,
    address,
    formattedAddress,
    networkName,
    isNetworkSupported,
    error,
    connectAndAuthenticate,
    disconnectWallet,
    clearError
  } = useWalletAuth()

  // Handle connect click
  const handleConnect = async () => {
    try {
      clearError()
      await connectAndAuthenticate()
    } catch (error) {
      // Error is already handled in the hook
    }
  }

  // Handle disconnect click
  const handleDisconnect = async () => {
    try {
      await disconnectWallet()
    } catch (error) {
      // Error is already handled in the hook
    }
  }

  // Get button styles based on variant and size
  const getButtonStyles = () => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'

    const sizeStyles = {
      sm: 'px-3 py-2 text-sm',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    }

    const variantStyles = {
      primary: 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500',
      secondary: 'bg-gray-600 hover:bg-gray-700 text-white focus:ring-gray-500',
      outline: 'border border-gray-300 hover:bg-gray-50 text-gray-700 focus:ring-blue-500'
    }

    return `${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`
  }

  // Get status indicator
  const getStatusIndicator = () => {
    if (error) {
      return <AlertCircle className="w-4 h-4 text-red-500" />
    }

    if (isAuthenticated && isNetworkSupported) {
      return <CheckCircle className="w-4 h-4 text-green-500" />
    }

    if (isConnected && !isNetworkSupported) {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />
    }

    return null
  }

  // Get button text
  const getButtonText = () => {
    if (isConnecting) {
      return 'Connecting...'
    }

    if (error) {
      return 'Connection Error'
    }

    if (isAuthenticated) {
      const displayAddress = showFullAddress ? address : formattedAddress
      return (
        <span className="flex items-center gap-2">
          {displayAddress}
          {networkName && (
            <span className={`text-xs px-2 py-1 rounded ${isNetworkSupported
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
              }`}>
              {networkName}
            </span>
          )}
        </span>
      )
    }

    if (isConnected) {
      return 'Authenticate'
    }

    return 'Connect Wallet'
  }

  // Get button icon
  const getButtonIcon = () => {
    if (isConnecting) {
      return (
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
      )
    }

    if (isAuthenticated) {
      return <LogOut className="w-4 h-4" />
    }

    return <Wallet className="w-4 h-4" />
  }

  return (
    <div className="relative">
      <button
        onClick={isAuthenticated ? handleDisconnect : handleConnect}
        disabled={isConnecting}
        className={getButtonStyles()}
        title={error || undefined}
      >
        <span className="flex items-center gap-2">
          {getButtonIcon()}
          {getButtonText()}
          {getStatusIndicator()}
        </span>
      </button>

      {/* Error tooltip */}
      {error && (
        <div className="absolute top-full left-0 mt-2 p-2 bg-red-100 border border-red-200 rounded-md text-sm text-red-700 max-w-xs z-10">
          {error}
          <button
            onClick={clearError}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Network warning */}
      {isConnected && !isNetworkSupported && (
        <div className="absolute top-full left-0 mt-2 p-2 bg-yellow-100 border border-yellow-200 rounded-md text-sm text-yellow-700 max-w-xs z-10">
          Unsupported network. Please switch to a supported network.
        </div>
      )}
    </div>
  )
}