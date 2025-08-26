import { useState } from 'react'
import { X, Wallet, Smartphone, AlertCircle, CheckCircle } from 'lucide-react'
import { useWalletAuth } from '../../hooks/useWalletAuth'

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
}

export function WalletModal({ isOpen, onClose, title = 'Connect Wallet' }: WalletModalProps) {
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null)

  const {
    isConnecting,
    availableConnectors,
    error,
    connectAndAuthenticate,
    clearError
  } = useWalletAuth()

  // Handle connector selection and connection
  const handleConnect = async (connectorId: string) => {
    setSelectedConnector(connectorId)
    clearError()

    try {
      await connectAndAuthenticate(connectorId)
      onClose()
    } catch (error) {
      // Error is already handled in the hook
    } finally {
      setSelectedConnector(null)
    }
  }

  // Get connector icon
  const getConnectorIcon = (connectorName: string) => {
    const name = connectorName.toLowerCase()

    if (name.includes('metamask')) {
      return <Wallet className="w-8 h-8" />
    } else if (name.includes('walletconnect')) {
      return <Smartphone className="w-8 h-8" />
    } else {
      return <Wallet className="w-8 h-8" />
    }
  }

  // Get connector description
  const getConnectorDescription = (connectorName: string) => {
    const name = connectorName.toLowerCase()

    if (name.includes('metamask')) {
      return 'Connect using MetaMask browser extension'
    } else if (name.includes('walletconnect')) {
      return 'Connect using mobile wallet or other WalletConnect compatible wallets'
    } else {
      return `Connect using ${connectorName}`
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Error message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <span className="text-sm text-red-700">{error}</span>
                </div>
              </div>
            )}

            {/* Connector list */}
            <div className="space-y-3">
              {availableConnectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => handleConnect(connector.id)}
                  disabled={isConnecting || !connector.ready}
                  className={`w-full p-4 border rounded-lg transition-all ${connector.ready
                    ? 'border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    : 'border-gray-100 bg-gray-50 cursor-not-allowed'
                    } ${selectedConnector === connector.id
                      ? 'border-blue-500 bg-blue-50'
                      : ''
                    }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Connector icon */}
                    <div className={`flex-shrink-0 ${connector.ready ? 'text-gray-700' : 'text-gray-400'
                      }`}>
                      {getConnectorIcon(connector.name)}
                    </div>

                    {/* Connector info */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <h3 className={`font-medium ${connector.ready ? 'text-gray-900' : 'text-gray-500'
                          }`}>
                          {connector.name}
                        </h3>

                        {/* Status indicators */}
                        {selectedConnector === connector.id && isConnecting ? (
                          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        ) : connector.ready ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-gray-400" />
                        )}
                      </div>

                      <p className={`text-sm mt-1 ${connector.ready ? 'text-gray-600' : 'text-gray-400'
                        }`}>
                        {connector.ready
                          ? getConnectorDescription(connector.name)
                          : 'Not available - please install the wallet extension'
                        }
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* No connectors available */}
            {availableConnectors.length === 0 && (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No Wallets Found
                </h3>
                <p className="text-gray-600 mb-4">
                  Please install a Web3 wallet like MetaMask to continue.
                </p>
                <a
                  href="https://metamask.io/download/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Install MetaMask
                </a>
              </div>
            )}

            {/* Help text */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">New to Web3 wallets?</h4>
              <p className="text-sm text-gray-600">
                Web3 wallets allow you to interact with blockchain applications securely.
                Your wallet stores your private keys and signs transactions on your behalf.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}