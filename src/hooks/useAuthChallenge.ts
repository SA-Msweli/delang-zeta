import { useState, useCallback } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { toast } from 'react-hot-toast'
import { AuthService } from '../services/authService'
import { useAuth } from '../contexts/AuthContext'
import type { AuthChallenge } from '../types/auth'

export function useAuthChallenge() {
  const [isLoading, setIsLoading] = useState(false)
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null)

  const { address, chainId } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { login } = useAuth()

  const getChallenge = useCallback(async (walletAddress?: string) => {
    if (!walletAddress && !address) {
      toast.error('Please connect your wallet first')
      return null
    }

    setIsLoading(true)

    try {
      const targetAddress = walletAddress || address!
      const authChallenge = await AuthService.getChallenge(targetAddress)
      setChallenge(authChallenge)
      return authChallenge
    } catch (error: any) {
      toast.error(error.message || 'Failed to get authentication challenge')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [address])

  const signAndAuthenticate = useCallback(async (authChallenge?: AuthChallenge) => {
    if (!address || !chainId) {
      toast.error('Please connect your wallet first')
      return false
    }

    const targetChallenge = authChallenge || challenge
    if (!targetChallenge) {
      toast.error('No authentication challenge available')
      return false
    }

    // Check if challenge is expired
    if (new Date() > targetChallenge.expiresAt) {
      toast.error('Authentication challenge expired. Please try again.')
      setChallenge(null)
      return false
    }

    setIsLoading(true)

    try {
      // Sign the challenge message
      const signature = await signMessageAsync({
        message: targetChallenge.message
      })

      // Authenticate with the signature
      await login(address, signature, targetChallenge.message, chainId)

      setChallenge(null)
      return true
    } catch (error: any) {
      if (error.name === 'UserRejectedRequestError') {
        toast.error('Signature rejected. Authentication cancelled.')
      } else {
        toast.error(error.message || 'Authentication failed')
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [address, chainId, challenge, signMessageAsync, login])

  const authenticateWallet = useCallback(async (walletAddress?: string) => {
    const targetAddress = walletAddress || address
    if (!targetAddress) {
      toast.error('Please connect your wallet first')
      return false
    }

    // Get challenge and sign in one flow
    const authChallenge = await getChallenge(targetAddress)
    if (!authChallenge) {
      return false
    }

    return await signAndAuthenticate(authChallenge)
  }, [address, getChallenge, signAndAuthenticate])

  const clearChallenge = useCallback(() => {
    setChallenge(null)
  }, [])

  return {
    challenge,
    isLoading,
    getChallenge,
    signAndAuthenticate,
    authenticateWallet,
    clearChallenge
  }
}