import { useAccount } from 'wagmi'
import { Navigate } from 'react-router-dom'
import { TrendingUp, FileText, CheckCircle, Coins } from 'lucide-react'

export function DashboardPage() {
  const { isConnected } = useAccount()

  if (!isConnected) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your activity overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
              <FileText className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Contributions</p>
              <p className="text-2xl font-bold text-gray-900">24</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Validations</p>
              <p className="text-2xl font-bold text-gray-900">156</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Coins className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Earned</p>
              <p className="text-2xl font-bold text-gray-900">1,250 ZETA</p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reputation</p>
              <p className="text-2xl font-bold text-gray-900">4.8/5.0</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Recent Contributions</h2>
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div>
                  <p className="font-medium">English Text Dataset</p>
                  <p className="text-sm text-gray-600">Submitted 2 hours ago</p>
                </div>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  Verified
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Active Tasks</h2>
          <div className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div>
                  <p className="font-medium">Spanish Conversation Data</p>
                  <p className="text-sm text-gray-600">Reward: 50 ZETA</p>
                </div>
                <button className="btn-primary text-sm">
                  Contribute
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}