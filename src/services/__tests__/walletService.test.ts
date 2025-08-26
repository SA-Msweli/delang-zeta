import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WalletService } from '../walletService'
import type { TransactionRequest, SignatureRequest } from '../../types/wallet'

// Mock toast
vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}))

describe('WalletService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isValidAddress', () => {
    it('should validate correct Ethereum addresses', () => {
      expect(WalletService.isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true)
      expect(WalletService.isValidAddress('0xabcdefABCDEF1234567890123456789012345678')).toBe(true)
    })

    it('should reject invalid addresses', () => {
      expect(WalletService.isValidAddress('1234567890123456789012345678901234567890')).toBe(false) // No 0x prefix
      expect(WalletService.isValidAddress('0x123456789012345678901234567890123456789')).toBe(false) // Too short
      expect(WalletService.isValidAddress('0x12345678901234567890123456789012345678901')).toBe(false) // Too long
      expect(WalletService.isValidAddress('0xGHIJKL7890123456789012345678901234567890')).toBe(false) // Invalid characters
      expect(WalletService.isValidAddress('')).toBe(false) // Empty string
    })
  })

  describe('isValidChainId', () => {
    it('should validate positive integers', () => {
      expect(WalletService.isValidChainId(1)).toBe(true)
      expect(WalletService.isValidChainId(137)).toBe(true)
      expect(WalletService.isValidChainId(7000)).toBe(true)
    })

    it('should reject invalid chain IDs', () => {
      expect(WalletService.isValidChainId(0)).toBe(false)
      expect(WalletService.isValidChainId(-1)).toBe(false)
      expect(WalletService.isValidChainId(1.5)).toBe(false)
      expect(WalletService.isValidChainId(NaN)).toBe(false)
    })
  })

  describe('formatAddress', () => {
    it('should format valid addresses correctly', () => {
      const address = '0x1234567890123456789012345678901234567890'
      expect(WalletService.formatAddress(address)).toBe('0x1234...7890')
      expect(WalletService.formatAddress(address, 6)).toBe('0x123456...567890')
    })

    it('should return original string for invalid addresses', () => {
      expect(WalletService.formatAddress('invalid')).toBe('invalid')
      expect(WalletService.formatAddress('')).toBe('')
    })
  })

  describe('formatTxHash', () => {
    it('should format transaction hashes correctly', () => {
      const hash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      expect(WalletService.formatTxHash(hash)).toBe('0x123456...abcdef')
      expect(WalletService.formatTxHash(hash, 8)).toBe('0x12345678...90abcdef')
    })

    it('should return original string for short hashes', () => {
      expect(WalletService.formatTxHash('0x123')).toBe('0x123')
      expect(WalletService.formatTxHash('')).toBe('')
    })
  })

  describe('getNetworkName', () => {
    it('should return correct network names', () => {
      expect(WalletService.getNetworkName(1)).toBe('Ethereum')
      expect(WalletService.getNetworkName(137)).toBe('Polygon')
      expect(WalletService.getNetworkName(7000)).toBe('ZetaChain')
    })

    it('should return generic name for unknown networks', () => {
      expect(WalletService.getNetworkName(999)).toBe('Chain 999')
    })
  })

  describe('isSupportedNetwork', () => {
    it('should return true for supported networks', () => {
      expect(WalletService.isSupportedNetwork(1)).toBe(true)
      expect(WalletService.isSupportedNetwork(137)).toBe(true)
      expect(WalletService.isSupportedNetwork(7000)).toBe(true)
    })

    it('should return false for unsupported networks', () => {
      expect(WalletService.isSupportedNetwork(999)).toBe(false)
      expect(WalletService.isSupportedNetwork(0)).toBe(false)
    })
  })

  describe('validateTransaction', () => {
    it('should validate correct transactions', () => {
      const validTransaction: TransactionRequest = {
        to: '0x1234567890123456789012345678901234567890',
        value: '1000000000000000000', // 1 ETH in wei
        gasLimit: '21000'
      }

      const errors = WalletService.validateTransaction(validTransaction)
      expect(errors).toHaveLength(0)
    })

    it('should detect invalid recipient address', () => {
      const invalidTransaction: TransactionRequest = {
        to: 'invalid-address'
      }

      const errors = WalletService.validateTransaction(invalidTransaction)
      expect(errors).toContain('Invalid recipient address')
    })

    it('should detect negative transaction value', () => {
      const invalidTransaction: TransactionRequest = {
        to: '0x1234567890123456789012345678901234567890',
        value: '-1000000000000000000'
      }

      const errors = WalletService.validateTransaction(invalidTransaction)
      expect(errors).toContain('Transaction value cannot be negative')
    })

    it('should detect invalid gas limit', () => {
      const invalidTransaction: TransactionRequest = {
        to: '0x1234567890123456789012345678901234567890',
        gasLimit: '0'
      }

      const errors = WalletService.validateTransaction(invalidTransaction)
      expect(errors).toContain('Gas limit must be positive')
    })
  })

  describe('validateSignatureRequest', () => {
    it('should validate correct signature requests', () => {
      const validRequest: SignatureRequest = {
        message: 'Sign this message',
        address: '0x1234567890123456789012345678901234567890',
        chainId: 1
      }

      const errors = WalletService.validateSignatureRequest(validRequest)
      expect(errors).toHaveLength(0)
    })

    it('should detect empty message', () => {
      const invalidRequest: SignatureRequest = {
        message: '',
        address: '0x1234567890123456789012345678901234567890',
        chainId: 1
      }

      const errors = WalletService.validateSignatureRequest(invalidRequest)
      expect(errors).toContain('Message cannot be empty')
    })

    it('should detect invalid address', () => {
      const invalidRequest: SignatureRequest = {
        message: 'Sign this message',
        address: 'invalid-address',
        chainId: 1
      }

      const errors = WalletService.validateSignatureRequest(invalidRequest)
      expect(errors).toContain('Invalid wallet address')
    })

    it('should detect invalid chain ID', () => {
      const invalidRequest: SignatureRequest = {
        message: 'Sign this message',
        address: '0x1234567890123456789012345678901234567890',
        chainId: 0
      }

      const errors = WalletService.validateSignatureRequest(invalidRequest)
      expect(errors).toContain('Invalid chain ID')
    })
  })

  describe('createAuthMessage', () => {
    it('should create authentication message with nonce', () => {
      const nonce = '123456'
      const message = WalletService.createAuthMessage(nonce)

      expect(message).toContain('Welcome to DeLangZeta!')
      expect(message).toContain(`Nonce: ${nonce}`)
      expect(message).toContain('Issued At:')
      expect(message).toContain('Domain:')
    })

    it('should include custom domain', () => {
      const nonce = '123456'
      const domain = 'example.com'
      const message = WalletService.createAuthMessage(nonce, domain)

      expect(message).toContain(`Domain: ${domain}`)
    })
  })

  describe('handleWalletError', () => {
    it('should handle user rejection error', () => {
      const error = { code: 4001 }
      expect(WalletService.handleWalletError(error)).toBe('Connection rejected by user')
    })

    it('should handle pending request error', () => {
      const error = { code: -32002 }
      expect(WalletService.handleWalletError(error)).toBe('Connection request already pending')
    })

    it('should handle generic errors', () => {
      const error = { message: 'Custom error message' }
      expect(WalletService.handleWalletError(error)).toBe('Custom error message')
    })

    it('should handle no provider error', () => {
      const error = { message: 'No provider found' }
      expect(WalletService.handleWalletError(error)).toBe('No wallet provider found. Please install MetaMask or another Web3 wallet.')
    })
  })

  describe('handleTransactionError', () => {
    it('should handle insufficient funds error', () => {
      const error = { message: 'insufficient funds for gas' }
      expect(WalletService.handleTransactionError(error)).toBe('Insufficient funds for transaction')
    })

    it('should handle gas limit error', () => {
      const error = { message: 'gas required exceeds allowance' }
      expect(WalletService.handleTransactionError(error)).toBe('Gas limit too low')
    })

    it('should handle nonce error', () => {
      const error = { message: 'nonce too low' }
      expect(WalletService.handleTransactionError(error)).toBe('Transaction nonce too low. Please try again.')
    })
  })

  describe('getTransactionUrl', () => {
    it('should return correct explorer URLs', () => {
      const txHash = '0x1234567890abcdef'

      expect(WalletService.getTransactionUrl(txHash, 1))
        .toBe('https://etherscan.io/tx/0x1234567890abcdef')

      expect(WalletService.getTransactionUrl(txHash, 137))
        .toBe('https://polygonscan.com/tx/0x1234567890abcdef')

      expect(WalletService.getTransactionUrl(txHash, 7000))
        .toBe('https://explorer.zetachain.com/tx/0x1234567890abcdef')
    })

    it('should return empty string for unsupported networks', () => {
      expect(WalletService.getTransactionUrl('0x123', 999)).toBe('')
    })
  })

  describe('getAddressUrl', () => {
    it('should return correct explorer URLs for addresses', () => {
      const address = '0x1234567890123456789012345678901234567890'

      expect(WalletService.getAddressUrl(address, 1))
        .toBe('https://etherscan.io/address/0x1234567890123456789012345678901234567890')

      expect(WalletService.getAddressUrl(address, 137))
        .toBe('https://polygonscan.com/address/0x1234567890123456789012345678901234567890')
    })

    it('should return empty string for unsupported networks', () => {
      expect(WalletService.getAddressUrl('0x123', 999)).toBe('')
    })
  })
})