import { useState } from 'react'
import { Search, Filter, Download, Star } from 'lucide-react'

export function MarketplacePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const datasets = [
    {
      id: '1',
      title: 'English Conversational Dataset',
      description: 'High-quality English conversations for chatbot training with 10K+ verified interactions',
      language: 'English',
      category: 'Conversational',
      size: '2.5 GB',
      samples: 10500,
      rating: 4.8,
      price: '0.1 ETH',
      downloads: 234,
      verified: true
    },
    {
      id: '2',
      title: 'Spanish Technical Documentation',
      description: 'Professional Spanish technical documentation dataset for domain-specific language models',
      language: 'Spanish',
      category: 'Technical',
      size: '1.8 GB',
      samples: 7800,
      rating: 4.6,
      price: '150 USDC',
      downloads: 89,
      verified: true
    },
    {
      id: '3',
      title: 'Multilingual Audio Transcriptions',
      description: 'Audio transcriptions in 12 languages with high accuracy for speech recognition training',
      language: 'Multiple',
      category: 'Audio',
      size: '5.2 GB',
      samples: 25000,
      rating: 4.9,
      price: '0.05 BTC',
      downloads: 456,
      verified: true
    }
  ]

  const filteredDatasets = datasets.filter(dataset => {
    const matchesSearch = dataset.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dataset.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || dataset.category.toLowerCase() === selectedCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Data Marketplace</h1>
        <p className="text-gray-600">Discover and license high-quality language datasets for your AI projects</p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search datasets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="input-field w-auto"
          >
            <option value="all">All Categories</option>
            <option value="conversational">Conversational</option>
            <option value="technical">Technical</option>
            <option value="audio">Audio</option>
            <option value="creative">Creative</option>
          </select>
        </div>
      </div>

      {/* Datasets Grid */}
      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredDatasets.map((dataset) => (
          <div key={dataset.id} className="card hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  {dataset.language}
                </span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {dataset.category}
                </span>
                {dataset.verified && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                    Verified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-400 fill-current" />
                <span className="text-sm font-medium">{dataset.rating}</span>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-2">{dataset.title}</h3>
            <p className="text-gray-600 mb-4 line-clamp-3">{dataset.description}</p>

            <div className="space-y-2 mb-4 text-sm text-gray-500">
              <div className="flex justify-between">
                <span>Size:</span>
                <span className="font-medium text-gray-900">{dataset.size}</span>
              </div>
              <div className="flex justify-between">
                <span>Samples:</span>
                <span className="font-medium text-gray-900">{dataset.samples.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Downloads:</span>
                <span className="font-medium text-gray-900">{dataset.downloads}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <div>
                <span className="text-2xl font-bold text-gray-900">{dataset.price}</span>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary text-sm flex items-center">
                  <Download className="h-4 w-4 mr-1" />
                  Preview
                </button>
                <button className="btn-primary text-sm">
                  License
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDatasets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No datasets found matching your criteria.</p>
        </div>
      )}
    </div>
  )
}