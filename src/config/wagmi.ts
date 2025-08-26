import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia, bsc, polygon, zetachainAthensTestnet } from 'wagmi/chains'

// ZetaChain Mainnet configuration
const zetachainMainnet = {
  id: 7000,
  name: 'ZetaChain',
  nativeCurrency: {
    decimals: 18,
    name: 'ZETA',
    symbol: 'ZETA',
  },
  rpcUrls: {
    default: {
      http: ['https://zetachain-evm.blockpi.network/v1/rpc/public'],
    },
    public: {
      http: ['https://zetachain-evm.blockpi.network/v1/rpc/public'],
    },
  },
  blockExplorers: {
    default: { name: 'ZetaScan', url: 'https://explorer.zetachain.com' },
  },
} as const

export const wagmiConfig = getDefaultConfig({
  appName: 'DeLangZeta',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'your-project-id',
  chains: [
    mainnet,
    sepolia,
    bsc,
    polygon,
    zetachainMainnet,
    zetachainAthensTestnet,
  ],
  ssr: false,
})