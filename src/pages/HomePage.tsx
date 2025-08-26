import { useAccount } from 'wagmi'
import { Navigate } from 'react-router-dom'
import { ArrowRight, Globe, Shield, Coins, Users } from 'lucide-react'

export function HomePage() {
  const { isConnected } = useAccount()

  // Redirect to dashboard if already connected
  if (isConnected) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero Section */}
      <div className="text-center py-12 lg:py-20">
        <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
          Earn Rewards for
          <span className="text-gradient block">Language Data</span>
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
          Join the decentralized revolution in AI training data. Contribute high-quality language data,
          validate submissions, and earn rewards across Bitcoin, Ethereum, and other networks.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="btn-primary text-lg px-8 py-3 flex items-center justify-center">
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </button>
          <button className="btn-secondary text-lg px-8 py-3">
            Learn More
          </button>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why Choose DeLangZeta?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Built on ZetaChain's Universal Smart Contracts for true omnichain functionality
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div className="card text-center">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Globe className="h-6 w-6 text-primary-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Omnichain Payments</h3>
            <p className="text-gray-600">
              Pay and receive rewards in BTC, ETH, USDC, or any supported token from your preferred network
            </p>
          </div>

          <div className="card text-center">
            <div className="w-12 h-12 bg-secondary-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Shield className="h-6 w-6 text-secondary-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">AI-Powered Verification</h3>
            <p className="text-gray-600">
              Google Gemini 2.5 Flash ensures data quality with intelligent automated verification
            </p>
          </div>

          <div className="card text-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Coins className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Fair Rewards</h3>
            <p className="text-gray-600">
              Transparent reward distribution based on data quality and community validation
            </p>
          </div>

          <div className="card text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Users className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Community Driven</h3>
            <p className="text-gray-600">
              Decentralized governance ensures the platform evolves with community needs
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-2xl text-white">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Platform Statistics</h2>
          <p className="text-primary-100">Growing ecosystem of contributors and validators</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold mb-2">10K+</div>
            <div className="text-primary-100">Data Contributions</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2">500+</div>
            <div className="text-primary-100">Active Contributors</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2">50+</div>
            <div className="text-primary-100">Languages Supported</div>
          </div>
          <div>
            <div className="text-3xl font-bold mb-2">$100K+</div>
            <div className="text-primary-100">Rewards Distributed</div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          Ready to Start Earning?
        </h2>
        <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
          Connect your wallet and start contributing to the future of AI training data
        </p>
        <button className="btn-primary text-lg px-8 py-3 flex items-center justify-center mx-auto">
          Connect Wallet
          <ArrowRight className="ml-2 h-5 w-5" />
        </button>
      </div>
    </div>
  )
}