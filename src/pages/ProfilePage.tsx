import { useAccount } from 'wagmi'
import { Navigate } from 'react-router-dom'
import { User, Award, TrendingUp, Settings } from 'lucide-react'

export function ProfilePage() {
  const { address, isConnected } = useAccount()

  if (!isConnected) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
        <p className="text-gray-600">Manage your account and view your statistics</p>
      </div>

      {/* Profile Header */}
      <div className="card mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          <div className="w-24 h-24 bg-gradient-to-r from-primary-600 to-secondary-600 rounded-full flex items-center justify-center">
            <User className="h-12 w-12 text-white" />
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Anonymous'}
            </h2>
            <div className="flex flex-wrap gap-4 text-sm text-gray-600">
              <span>Member since: March 2024</span>
              <span>•</span>
              <span>Reputation: 4.8/5.0</span>
              <span>•</span>
              <span>Verified Contributor</span>
            </div>
          </div>

          <button className="btn-secondary flex items-center">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="card text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="h-6 w-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">24</h3>
          <p className="text-gray-600">Total Contributions</p>
        </div>

        <div className="card text-center">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Award className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">156</h3>
          <p className="text-gray-600">Validations Completed</p>
        </div>

        <div className="card text-center">
          <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="h-6 w-6 text-yellow-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">1,250</h3>
          <p className="text-gray-600">ZETA Earned</p>
        </div>
      </div>

      {/* Activity Sections */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Contributions */}
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Recent Contributions</h3>
          <div className="space-y-4">
            {[
              { title: 'English Conversation Data', status: 'Verified', reward: '50 ZETA', date: '2 hours ago' },
              { title: 'Spanish Translation Task', status: 'Pending', reward: '30 USDC', date: '1 day ago' },
              { title: 'French Audio Transcription', status: 'Verified', reward: '0.001 BTC', date: '3 days ago' },
            ].map((contribution, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div>
                  <p className="font-medium text-gray-900">{contribution.title}</p>
                  <p className="text-sm text-gray-600">{contribution.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{contribution.reward}</p>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${contribution.status === 'Verified'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    {contribution.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reward History */}
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Reward History</h3>
          <div className="space-y-4">
            {[
              { type: 'Contribution Reward', amount: '+50 ZETA', date: '2 hours ago', network: 'ZetaChain' },
              { type: 'Validation Reward', amount: '+25 ZETA', date: '1 day ago', network: 'ZetaChain' },
              { type: 'Contribution Reward', amount: '+0.001 BTC', date: '3 days ago', network: 'Bitcoin' },
            ].map((reward, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div>
                  <p className="font-medium text-gray-900">{reward.type}</p>
                  <p className="text-sm text-gray-600">{reward.date} • {reward.network}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-green-600">{reward.amount}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}