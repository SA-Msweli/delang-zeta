import { useState, useCallback } from 'react'
import { useAccount, useSignMessage, useDisconnect, useConnect, useSwitchChain } from 'wagmi'
import { toast } from 'react-hot-toast'
import { useAuth } from '../contexts/AuthContext'
import { useAuthChallenge } from './useAuthChallenge'
import { WalletService } from '../services/walletService'
import type { WalletConnectionState } from '../types/wallet'

export function useWalletAuth() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { address, chainId, connector, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { disconnect } = useDisconnect()
  const { connect, connectors } = useConnect()
  const { switchChain } = useSwitchChain()

  const { isAuthenticated, logout } = useAuth()
  const { authenticateWallet, isLoading: isAuthenticating } = useAuthChallenge()

  // Get wallet connection state
  const connectionState: WalletConnectionState = {
    isConnected,
    isConnecting: isConnecting || isAuthenticating,
    address: address || null,
    chainId: chainId || null,
    connector: connector?.name || null,
    error
  }

  // Connect wallet
  const connectWallet = useCallback(async (connectorId?: string) => {
    setIsConnecting(true)
    setError(null)

    try {
      // Find connector
      const targetConnector = connectorId
        ? connectors.find(c => c.id === connectorId)
        : connectors[0] // Default to first available connector

      if (!targetConnector) {
        throw new Error('No wallet connector available')
      }

      // Connect to wallet
      await connect({ connector: targetConnector })

      toast.success(`Connected to ${targetConnector.name}`)
    } catch (error: any) {
      const errorMessage = WalletService.handleWalletError(error)
      setError(errorMessage)
      WalletService.showConnectionError(error)
      throw error
    } finally {
      setIsConnecting(false)
    }
  }, [connect, connectors])

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      // Logout from auth system first
      if (isAuthenticated) {
        await logout()
      }

      // Disconnect wallet
      await disconnect()

      setError(null)
      toast.success('Wallet disconnected')
    } catch (error: any) {
      const errorMessage = WalletService.handleWalletError(error)
      setError(errorMessage)
      toast.error(errorMessage)
    }
  }, [disconnect, logout, isAuthenticated])

  // Switch network
  const switchNetwork = useCallback(async (targetChainId: number) => {
    if (!isConnected) {
      toast.error('Please connect your wallet first')
      return
    }

    if (!WalletService.isSupportedNetwork(targetChainId)) {
      toast.error('Unsupported network')
      return
    }

    try {
      await switchChain({ chainId: targetChainId })
      toast.success(`Switched to ${WalletService.getNetworkName(targetChainId)}`)
    } catch (error: any) {
      const errorMessage = WalletService.handleWalletError(error)
      setError(errorMessage)
      toast.error(errorMessage)
      throw error
    }
  }, [switchChain, isConnected])

  // Sign message
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!isConnected || !address) {
      throw new Error('Wallet not connected')
    }

    try {
      const signature = await signMessageAsync({ message })
      return signature
    } catch (error: any) {
      const errorMessage = WalletService.handleSignatureError(error)
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [signMessageAsync, isConnected, address])

  // Connect and authenticate in one flow
  const connectAndAuthenticate = useCallback(async (connectorId?: string) => {
    try {
      // Connect wallet if not connected
      if (!isConnected) {
        await connectWallet(connectorId)
      }

      // Wait for connection to be established
      if (!address) {
        throw new Error('Wallet connection failed')
      }

      // Authenticate with the connected wallet
      const success = await authenticateWallet(address)

      if (!success) {
        throw new Error('Authentication failed')
      }

      return true
    } catch (error: any) {
      // If authentication fails, disconnect the wallet
      if (isConnected) {
        await disconnect()
      }
      throw error
    }
  }, [isConnected, address, connectWallet, authenticateWallet, disconnect])

  // Check if current network is supported
  const isNetworkSupported = useCallback(() => {
    return chainId ? WalletService.isSupportedNetwork(chainId) : false
  }, [chainId])

  // Get formatted address
  const getFormattedAddress = useCallback(() => {
    return address ? WalletService.formatAddress(address) : null
  }, [address])

  // Get network name
  const getNetworkName = useCallback(() => {
    return chainId ? WalletService.getNetworkName(chainId) : null
  }, [chainId])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Get available connectors
  const getAvailableConnectors = useCallback(() => {
    return connectors.map(connector => ({
      id: connector.id,
      name: connector.name,
      icon: connector.icon,
      ready: connector.ready
    }))
  }, [connectors])

  return {
    // State
    ...connectionState,
    isAuthenticated,
    isNetworkSupported: isNetworkSupported(),
    formattedAddress: getFormattedAddress(),
    networkName: getNetworkName(),
    availableConnectors: getAvailableConnectors(),

    // Actions
    connectWallet,
    disconnectWallet,
    switchNetwork,
    signMessage,
    connectAndAuthenticate,
    clearError
  }
}