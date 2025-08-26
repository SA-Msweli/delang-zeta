// Wallet integration types

export interface WalletConnectionState {
  isConnected: boolean
  isConnecting: boolean
  address: string | null
  chainId: number | null
  connector: string | null
  error: string | null
}

export interface NetworkInfo {
  chainId: number
  name: string
  symbol: string
  rpcUrl: string
  blockExplorer: string
  isTestnet: boolean
}

export interface TransactionRequest {
  to: string
  value?: string
  data?: string
  gasLimit?: string
  gasPrice?: string
  maxFeePerGas?: string
  maxPriorityFeePerGas?: string
}

export interface TransactionResult {
  hash: string
  chainId: number
  blockNumber?: number
  status: 'pending' | 'confirmed' | 'failed'
  gasUsed?: string
  effectiveGasPrice?: string
}

export interface SignatureRequest {
  message: string
  address: string
  chainId: number
}

export interface SignatureResult {
  signature: string
  address: string
  message: string
  chainId: number
}

export interface WalletContextType extends WalletConnectionState {
  connect: (connectorId?: string) => Promise<void>
  disconnect: () => Promise<void>
  switchNetwork: (chainId: number) => Promise<void>
  signMessage: (message: string) => Promise<string>
  sendTransaction: (transaction: TransactionRequest) => Promise<TransactionResult>
  addNetwork: (network: NetworkInfo) => Promise<void>
  clearError: () => void
}

// Supported networks for omnichain functionality
export const SUPPORTED_NETWORKS: Record<number, NetworkInfo> = {
  // Ethereum Mainnet
  1: {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    isTestnet: false
  },
  // Ethereum Sepolia Testnet
  11155111: {
    chainId: 11155111,
    name: 'Sepolia',
    symbol: 'ETH',
    rpcUrl: 'https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    blockExplorer: 'https://sepolia.etherscan.io',
    isTestnet: true
  },
  // BSC Mainnet
  56: {
    chainId: 56,
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    blockExplorer: 'https://bscscan.com',
    isTestnet: false
  },
  // Polygon Mainnet
  137: {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    isTestnet: false
  },
  // ZetaChain Mainnet
  7000: {
    chainId: 7000,
    name: 'ZetaChain',
    symbol: 'ZETA',
    rpcUrl: 'https://zetachain-evm.blockpi.network/v1/rpc/public',
    blockExplorer: 'https://explorer.zetachain.com',
    isTestnet: false
  },
  // ZetaChain Athens Testnet
  7001: {
    chainId: 7001,
    name: 'ZetaChain Athens',
    symbol: 'ZETA',
    rpcUrl: 'https://zetachain-athens-evm.blockpi.network/v1/rpc/public',
    blockExplorer: 'https://athens.explorer.zetachain.com',
    isTestnet: true
  }
}