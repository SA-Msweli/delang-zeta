import { useState, useCallback } from 'react'
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther, parseGwei } from 'viem'
import { WalletService } from '../services/walletService'
import type { TransactionRequest, TransactionResult } from '../types/wallet'

export function useTransaction() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  const { sendTransactionAsync } = useSendTransaction()
  const { data: receipt, isLoading: isWaiting } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined
  })

  // Send transaction
  const sendTransaction = useCallback(async (
    transaction: TransactionRequest
  ): Promise<TransactionResult> => {
    setIsLoading(true)
    setError(null)
    setTxHash(null)

    try {
      // Validate transaction
      const validationErrors = WalletService.validateTransaction(transaction)
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join(', '))
      }

      // Prepare transaction data
      const txData: any = {
        to: transaction.to as `0x${string}`,
      }

      // Add value if specified
      if (transaction.value) {
        txData.value = parseEther(transaction.value)
      }

      // Add data if specified
      if (transaction.data) {
        txData.data = transaction.data as `0x${string}`
      }

      // Add gas parameters if specified
      if (transaction.gasLimit) {
        txData.gas = BigInt(transaction.gasLimit)
      }

      if (transaction.gasPrice) {
        txData.gasPrice = parseGwei(transaction.gasPrice)
      }

      if (transaction.maxFeePerGas) {
        txData.maxFeePerGas = parseGwei(transaction.maxFeePerGas)
      }

      if (transaction.maxPriorityFeePerGas) {
        txData.maxPriorityFeePerGas = parseGwei(transaction.maxPriorityFeePerGas)
      }

      // Send transaction
      const hash = await sendTransactionAsync(txData)
      setTxHash(hash)

      // Show success toast with explorer link
      WalletService.showTransactionSuccess(hash, 1) // TODO: Get actual chain ID

      return {
        hash,
        chainId: 1, // TODO: Get actual chain ID
        status: 'pending'
      }
    } catch (error: any) {
      const errorMessage = WalletService.handleTransactionError(error)
      setError(errorMessage)
      WalletService.showTransactionError(error)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [sendTransactionAsync])

  // Send ETH transaction
  const sendEth = useCallback(async (
    to: string,
    amount: string
  ): Promise<TransactionResult> => {
    return sendTransaction({
      to,
      value: amount
    })
  }, [sendTransaction])

  // Send contract transaction
  const sendContractTransaction = useCallback(async (
    contractAddress: string,
    data: string,
    value?: string
  ): Promise<TransactionResult> => {
    return sendTransaction({
      to: contractAddress,
      data,
      value
    })
  }, [sendTransaction])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Reset transaction state
  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setTxHash(null)
  }, [])

  // Get transaction result with receipt data
  const getTransactionResult = useCallback((): TransactionResult | null => {
    if (!txHash) return null

    return {
      hash: txHash,
      chainId: 1, // TODO: Get actual chain ID
      status: receipt ? 'confirmed' : 'pending',
      blockNumber: receipt?.blockNumber ? Number(receipt.blockNumber) : undefined,
      gasUsed: receipt?.gasUsed ? receipt.gasUsed.toString() : undefined,
      effectiveGasPrice: receipt?.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : undefined
    }
  }, [txHash, receipt])

  return {
    // State
    isLoading: isLoading || isWaiting,
    error,
    txHash,
    receipt,
    transactionResult: getTransactionResult(),

    // Actions
    sendTransaction,
    sendEth,
    sendContractTransaction,
    clearError,
    reset
  }
}