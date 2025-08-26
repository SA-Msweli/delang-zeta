import { useState } from 'react'
import { useAccount } from 'wagmi'
import { Navigate } from 'react-router-dom'
import { Search, Filter, Plus } from 'lucide-react'

export function TasksPage() {
  const { isConnected } = useAccount()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')

  if (!isConnected) {
    return <Navigate to="/" replace />
  }

  const tasks = [
    {
      id: '1',
      title: 'English Conversation Dataset',
      description: 'Collect natural English conversations for chatbot training',
      language: 'English',
      reward: '100 ZETA',
      deadline: '2024-03-15',
      submissions: 45,
      maxSubmissions: 100,
      status: 'active'
    },
    {
      id: '2',
      title: 'Spanish Technical Documentation',
      description: 'Translate technical documentation from English to Spanish',
      language: 'Spanish',
      reward: '75 USDC',
      deadline: '2024-03-20',
      submissions: 12,
      maxSubmissions: 50,
      status: 'active'
    },
    {
      id: '3',
      title: 'French Audio Transcription',
      description: 'Transcribe French audio recordings for speech recognition training',
      language: 'French',
      reward: '0.01 BTC',
      deadline: '2024-03-25',
      submissions: 8,
      maxSubmissions: 30,
      status: 'active'
    }
  ]

  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = selectedFilter === 'all' || task.language.toLowerCase() === selectedFilter
    return matchesSearch && matchesFilter
  })

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Tasks</h1>
          <p className="text-gray-600">Browse and contribute to language data collection tasks</p>
        </div>
        <button className="btn-primary mt-4 lg:mt-0 flex items-center">
          <Plus className="h-5 w-5 mr-2" />
          Create Task
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value)}
            className="input-field w-auto"
          >
            <option value="all">All Languages</option>
            <option value="english">English</option>
            <option value="spanish">Spanish</option>
            <option value="french">French</option>
            <option value="german">German</option>
          </select>
        </div>
      </div>

      {/* Tasks Grid */}
      <div className="grid gap-6">
        {filteredTasks.map((task) => (
          <div key={task.id} className="card hover:shadow-md transition-shadow">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900">{task.title}</h3>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    {task.language}
                  </span>
                </div>
                <p className="text-gray-600 mb-4">{task.description}</p>

                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                  <span>Reward: <strong className="text-gray-900">{task.reward}</strong></span>
                  <span>Deadline: <strong className="text-gray-900">{task.deadline}</strong></span>
                  <span>Progress: <strong className="text-gray-900">{task.submissions}/{task.maxSubmissions}</strong></span>
                </div>
              </div>

              <div className="mt-4 lg:mt-0 lg:ml-6 flex flex-col lg:items-end gap-2">
                <div className="w-full lg:w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary-600 h-2 rounded-full"
                    style={{ width: `${(task.submissions / task.maxSubmissions) * 100}%` }}
                  ></div>
                </div>
                <button className="btn-primary w-full lg:w-auto">
                  Contribute
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No tasks found matching your criteria.</p>
        </div>
      )}
    </div>
  )
}