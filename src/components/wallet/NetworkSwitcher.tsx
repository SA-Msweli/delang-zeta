import { useState } from 'react'
import { ChevronDown, AlertCircle, CheckCircle, Globe } from 'lucide-react'
import { useWalletAuth } from '../../hooks/useWalletAuth'
import { SUPPORTED_NETWORKS } from '../../types/wallet'

interface NetworkSwitcherProps {
  className?: string
  showTestnets?: boolean
}

export function NetworkSwitcher({ className = '', showTestnets = false }: NetworkSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  const {
    isConnected,
    chainId,
    networkName,
    isNetworkSupported,
    switchNetwork
  } = useWalletAuth()

  // Filter networks based on testnet preference
  const availableNetworks = Object.values(SUPPORTED_NETWORKS).filter(
    network => showTestnets || !network.isTestnet
  )

  // Handle network switch
  const handleNetworkSwitch = async (targetChainId: number) => {
    setIsSwitching(true)
    setIsOpen(false)

    try {
      await switchNetwork(targetChainId)
    } catch (error) {
      // Error is already handled in the hook
    } finally {
      setIsSwitching(false)
    }
  }

  // Get network icon
  const getNetworkIcon = () => {
    return <Globe className="w-4 h-4" />
  }

  if (!isConnected) {
    return null
  }

  return (
    <div className={`relative ${className}`}>
      {/* Network button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${isNetworkSupported
          ? 'border-green-200 bg-green-50 text-green-800 hover:bg-green-100'
          : 'border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100'
          }`}
      >
        {/* Network status icon */}
        {isSwitching ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isNetworkSupported ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <AlertCircle className="w-4 h-4" />
        )}

        {/* Network name */}
        <span className="text-sm font-medium">
          {networkName || `Chain ${chainId}`}
        </span>

        {/* Dropdown arrow */}
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''
          }`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="p-2">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Select Network
              </div>

              {availableNetworks.map((network) => {
                const isCurrentNetwork = chainId === network.chainId
                const isSupported = SUPPORTED_NETWORKS[network.chainId] !== undefined

                return (
                  <button
                    key={network.chainId}
                    onClick={() => handleNetworkSwitch(network.chainId)}
                    disabled={isCurrentNetwork || isSwitching}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${isCurrentNetwork
                      ? 'bg-blue-50 text-blue-700 cursor-default'
                      : 'hover:bg-gray-50 text-gray-700'
                      }`}
                  >
                    {/* Network icon */}
                    <div className="flex-shrink-0">
                      {getNetworkIcon()}
                    </div>

                    {/* Network info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {network.name}
                        </span>

                        {network.isTestnet && (
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                            Testnet
                          </span>
                        )}
                      </div>

                      <div className="text-sm text-gray-500">
                        {network.symbol}
                      </div>
                    </div>

                    {/* Status indicator */}
                    <div className="flex-shrink-0">
                      {isCurrentNetwork ? (
                        <CheckCircle className="w-4 h-4 text-blue-500" />
                      ) : isSupported ? (
                        <div className="w-4 h-4" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <AlertCircle className="w-3 h-3" />
                <span>
                  Only supported networks are shown
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}