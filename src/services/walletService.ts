import { toast } from 'react-hot-toast'
import type {
  TransactionRequest,
  SignatureRequest,
  SignatureResult
} from '../types/wallet'

export class WalletService {
  /**
   * Validate wallet address format
   */
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address)
  }

  /**
   * Validate chain ID
   */
  static isValidChainId(chainId: number): boolean {
    return Number.isInteger(chainId) && chainId > 0
  }

  /**
   * Format address for display (0x1234...5678)
   */
  static formatAddress(address: string, length = 4): string {
    if (!this.isValidAddress(address)) return address

    return `${address.slice(0, 2 + length)}...${address.slice(-length)}`
  }

  /**
   * Format transaction hash for display
   */
  static formatTxHash(hash: string, length = 6): string {
    if (!hash || hash.length < 10) return hash

    return `${hash.slice(0, 2 + length)}...${hash.slice(-length)}`
  }

  /**
   * Get network name from chain ID
   */
  static getNetworkName(chainId: number): string {
    const networks: Record<number, string> = {
      1: 'Ethereum',
      11155111: 'Sepolia',
      56: 'BSC',
      137: 'Polygon',
      7000: 'ZetaChain',
      7001: 'ZetaChain Athens'
    }

    return networks[chainId] || `Chain ${chainId}`
  }

  /**
   * Check if network is supported
   */
  static isSupportedNetwork(chainId: number): boolean {
    const supportedChains = [1, 11155111, 56, 137, 7000, 7001]
    return supportedChains.includes(chainId)
  }

  /**
   * Validate transaction request
   */
  static validateTransaction(transaction: TransactionRequest): string[] {
    const errors: string[] = []

    if (!transaction.to || !this.isValidAddress(transaction.to)) {
      errors.push('Invalid recipient address')
    }

    if (transaction.value) {
      try {
        const value = BigInt(transaction.value)
        if (value < 0) {
          errors.push('Transaction value cannot be negative')
        }
      } catch {
        errors.push('Invalid transaction value format')
      }
    }

    if (transaction.gasLimit) {
      try {
        const gasLimit = BigInt(transaction.gasLimit)
        if (gasLimit <= 0) {
          errors.push('Gas limit must be positive')
        }
      } catch {
        errors.push('Invalid gas limit format')
      }
    }

    return errors
  }

  /**
   * Validate signature request
   */
  static validateSignatureRequest(request: SignatureRequest): string[] {
    const errors: string[] = []

    if (!request.message || request.message.trim().length === 0) {
      errors.push('Message cannot be empty')
    }

    if (!request.address || !this.isValidAddress(request.address)) {
      errors.push('Invalid wallet address')
    }

    if (!this.isValidChainId(request.chainId)) {
      errors.push('Invalid chain ID')
    }

    return errors
  }

  /**
   * Create authentication message for wallet signing
   */
  static createAuthMessage(nonce: string, domain?: string): string {
    const timestamp = new Date().toISOString()
    const siteDomain = domain || window.location.hostname

    return `Welcome to DeLangZeta!

Click to sign in and accept the DeLangZeta Terms of Service.

This request will not trigger a blockchain transaction or cost any gas fees.

Your authentication status will reset after 24 hours.

Wallet address:
{address}

Nonce: ${nonce}
Issued At: ${timestamp}
Domain: ${siteDomain}`
  }

  /**
   * Parse signature result
   */
  static parseSignatureResult(
    signature: string,
    message: string,
    address: string,
    chainId: number
  ): SignatureResult {
    return {
      signature,
      message,
      address: address.toLowerCase(),
      chainId
    }
  }

  /**
   * Handle wallet connection errors
   */
  static handleWalletError(error: any): string {
    if (error.code === 4001) {
      return 'Connection rejected by user'
    } else if (error.code === -32002) {
      return 'Connection request already pending'
    } else if (error.code === -32603) {
      return 'Internal wallet error'
    } else if (error.message?.includes('User rejected')) {
      return 'Connection rejected by user'
    } else if (error.message?.includes('Already processing')) {
      return 'Wallet is already processing a request'
    } else if (error.message?.includes('No provider')) {
      return 'No wallet provider found. Please install MetaMask or another Web3 wallet.'
    } else if (error.message?.includes('Unsupported chain')) {
      return 'Unsupported network. Please switch to a supported network.'
    } else {
      return error.message || 'Wallet connection failed'
    }
  }

  /**
   * Handle transaction errors
   */
  static handleTransactionError(error: any): string {
    if (error.code === 4001) {
      return 'Transaction rejected by user'
    } else if (error.code === -32603) {
      return 'Transaction failed'
    } else if (error.message?.includes('insufficient funds')) {
      return 'Insufficient funds for transaction'
    } else if (error.message?.includes('gas required exceeds allowance')) {
      return 'Gas limit too low'
    } else if (error.message?.includes('nonce too low')) {
      return 'Transaction nonce too low. Please try again.'
    } else if (error.message?.includes('replacement transaction underpriced')) {
      return 'Transaction replacement underpriced'
    } else {
      return error.message || 'Transaction failed'
    }
  }

  /**
   * Handle signature errors
   */
  static handleSignatureError(error: any): string {
    if (error.code === 4001) {
      return 'Signature rejected by user'
    } else if (error.message?.includes('User denied')) {
      return 'Signature rejected by user'
    } else {
      return error.message || 'Signature failed'
    }
  }

  /**
   * Get block explorer URL for transaction
   */
  static getTransactionUrl(txHash: string, chainId: number): string {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io/tx/',
      11155111: 'https://sepolia.etherscan.io/tx/',
      56: 'https://bscscan.com/tx/',
      137: 'https://polygonscan.com/tx/',
      7000: 'https://explorer.zetachain.com/tx/',
      7001: 'https://athens.explorer.zetachain.com/tx/'
    }

    const baseUrl = explorers[chainId]
    return baseUrl ? `${baseUrl}${txHash}` : ''
  }

  /**
   * Get block explorer URL for address
   */
  static getAddressUrl(address: string, chainId: number): string {
    const explorers: Record<number, string> = {
      1: 'https://etherscan.io/address/',
      11155111: 'https://sepolia.etherscan.io/address/',
      56: 'https://bscscan.com/address/',
      137: 'https://polygonscan.com/address/',
      7000: 'https://explorer.zetachain.com/address/',
      7001: 'https://athens.explorer.zetachain.com/address/'
    }

    const baseUrl = explorers[chainId]
    return baseUrl ? `${baseUrl}${address}` : ''
  }

  /**
   * Show transaction success toast with explorer link
   */
  static showTransactionSuccess(txHash: string, chainId: number): void {
    const explorerUrl = this.getTransactionUrl(txHash, chainId)
    const shortHash = this.formatTxHash(txHash)

    if (explorerUrl) {
      toast.success(`Transaction submitted: ${shortHash}`, {
        duration: 6000
      })
    } else {
      toast.success(`Transaction submitted: ${shortHash}`)
    }
  }

  /**
   * Show transaction error toast
   */
  static showTransactionError(error: any): void {
    const message = this.handleTransactionError(error)
    toast.error(message)
  }

  /**
   * Show wallet connection error toast
   */
  static showConnectionError(error: any): void {
    const message = this.handleWalletError(error)
    toast.error(message)
  }
}