import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { Header } from '../Header'

// Mock wagmi hook
vi.mock('wagmi', () => ({
  useAccount: () => ({ isConnected: false }),
}))

// Mock RainbowKit
vi.mock('@rainbow-me/rainbowkit', () => ({
  ConnectButton: () => <button>Connect Wallet</button>,
}))

const HeaderWithRouter = () => (
  <BrowserRouter>
    <Header />
  </BrowserRouter>
)

describe('Header', () => {
  it('renders the logo and title', () => {
    render(<HeaderWithRouter />)

    expect(screen.getByText('DeLangZeta')).toBeInTheDocument()
  })

  it('shows navigation when not connected', () => {
    render(<HeaderWithRouter />)

    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Marketplace')).toBeInTheDocument()
  })

  it('shows connect wallet button', () => {
    render(<HeaderWithRouter />)

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument()
  })
})