import { useState, useEffect } from 'react'
import {
  X,
  Download,
  Eye,
  FileText,
  Volume2,
  Image as ImageIcon,
  Video,
  ExternalLink,
  Clock,
  Database,
  Star,
  Shield
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { MarketplaceService } from '../services/marketplaceService'
import type { Dataset, DatasetPreview, PreviewSample } from '../types/dataset'

interface DatasetPreviewModalProps {
  dataset: Dataset
  isOpen: boolean
  onClose: () => void
  onPurchase?: (dataset: Dataset) => void
}

export function DatasetPreviewModal({
  dataset,
  isOpen,
  onClose,
  onPurchase
}: DatasetPreviewModalProps) {
  const [preview, setPreview] = useState<DatasetPreview | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSample, setSelectedSample] = useState<PreviewSample | null>(null)
  const [activeTab, setActiveTab] = useState<'samples' | 'stats' | 'details'>('samples')

  useEffect(() => {
    if (isOpen && dataset) {
      loadPreview()
    }
  }, [isOpen, dataset])

  const loadPreview = async () => {
    setIsLoading(true)
    try {
      const previewData = await MarketplaceService.getDatasetPreview(dataset.id)
      setPreview(previewData)
      if (previewData.samples.length > 0) {
        setSelectedSample(previewData.samples[0])
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load preview')
    } finally {
      setIsLoading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <FileText className="h-4 w-4" />
      case 'audio':
        return <Volume2 className="h-4 w-4" />
      case 'image':
        return <ImageIcon className="h-4 w-4" />
      case 'video':
        return <Video className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  const renderSampleContent = (sample: PreviewSample) => {
    switch (sample.type) {
      case 'text':
        return (
          <div className="bg-gray-50 p-4 rounded-lg">
            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
              {typeof sample.content === 'string' ? sample.content : 'Binary content'}
            </pre>
          </div>
        )
      case 'audio':
        if (typeof sample.content === 'string' && sample.content.startsWith('data:audio')) {
          return (
            <div className="bg-gray-50 p-4 rounded-lg">
              <audio controls className="w-full">
                <source src={sample.content} />
                Your browser does not support the audio element.
              </audio>
            </div>
          )
        }
        return (
          <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
            <Volume2 className="h-8 w-8 mx-auto mb-2" />
            <p>Audio preview not available</p>
          </div>
        )
      case 'image':
        if (typeof sample.content === 'string' && sample.content.startsWith('data:image')) {
          return (
            <div className="bg-gray-50 p-4 rounded-lg">
              <img
                src={sample.content}
                alt="Preview sample"
                className="max-w-full h-auto rounded"
              />
            </div>
          )
        }
        return (
          <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
            <ImageIcon className="h-8 w-8 mx-auto mb-2" />
            <p>Image preview not available</p>
          </div>
        )
      case 'video':
        if (typeof sample.content === 'string' && sample.content.startsWith('data:video')) {
          return (
            <div className="bg-gray-50 p-4 rounded-lg">
              <video controls className="w-full max-h-64">
                <source src={sample.content} />
                Your browser does not support the video element.
              </video>
            </div>
          )
        }
        return (
          <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
            <Video className="h-8 w-8 mx-auto mb-2" />
            <p>Video preview not available</p>
          </div>
        )
      default:
        return (
          <div className="bg-gray-50 p-4 rounded-lg text-center text-gray-500">
            <Database className="h-8 w-8 mx-auto mb-2" />
            <p>Preview not available for this content type</p>
          </div>
        )
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Eye className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{dataset.title}</h2>
              <p className="text-sm text-gray-500">Dataset Preview</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Sidebar */}
          <div className="w-80 border-r border-gray-200 flex flex-col">
            {/* Dataset Info */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  {MarketplaceService.getCategoryDisplayName(dataset.category)}
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full">
                  {dataset.language}
                </span>
                {dataset.verified && (
                  <Shield className="h-4 w-4 text-green-600" />
                )}
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Size:</span>
                  <span className="font-medium">{dataset.size}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Samples:</span>
                  <span className="font-medium">{dataset.sampleCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Quality:</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-yellow-400 fill-current" />
                    <span className="font-medium">{dataset.qualityScore}%</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Price:</span>
                  <span className="font-medium">{MarketplaceService.formatPrice(dataset.price)}</span>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {[
                { id: 'samples', label: 'Samples', icon: Database },
                { id: 'stats', label: 'Statistics', icon: Star },
                { id: 'details', label: 'Details', icon: FileText }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center gap-1 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'samples' && (
                <div className="space-y-2">
                  {isLoading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="text-sm text-gray-500 mt-2">Loading samples...</p>
                    </div>
                  ) : preview?.samples ? (
                    preview.samples.map((sample, index) => (
                      <button
                        key={sample.id}
                        onClick={() => setSelectedSample(sample)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedSample?.id === sample.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeIcon(sample.type)}
                          <span className="font-medium text-sm">Sample {index + 1}</span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">
                          {typeof sample.content === 'string'
                            ? sample.content.substring(0, 50) + '...'
                            : `${sample.type} content`
                          }
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Database className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No preview samples available</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'stats' && preview?.statistics && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Overview</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Total Samples:</span>
                        <span className="font-medium">{preview.statistics.totalSamples.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Average Length:</span>
                        <span className="font-medium">{preview.statistics.averageLength}</span>
                      </div>
                    </div>
                  </div>

                  {Object.keys(preview.statistics.languageDistribution).length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Language Distribution</h4>
                      <div className="space-y-1">
                        {Object.entries(preview.statistics.languageDistribution).map(([lang, count]) => (
                          <div key={lang} className="flex justify-between text-sm">
                            <span className="text-gray-600">{lang}:</span>
                            <span className="font-medium">{count}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {Object.keys(preview.statistics.topicDistribution).length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Topic Distribution</h4>
                      <div className="space-y-1">
                        {Object.entries(preview.statistics.topicDistribution).slice(0, 5).map(([topic, count]) => (
                          <div key={topic} className="flex justify-between text-sm">
                            <span className="text-gray-600">{topic}:</span>
                            <span className="font-medium">{count}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{dataset.description}</p>
                  </div>

                  {dataset.tags && dataset.tags.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Tags</h4>
                      <div className="flex flex-wrap gap-1">
                        {dataset.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Metadata</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Format:</span>
                        <span className="font-medium">{dataset.metadata.format.join(', ')}</span>
                      </div>
                      {dataset.metadata.encoding && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Encoding:</span>
                          <span className="font-medium">{dataset.metadata.encoding}</span>
                        </div>
                      )}
                      {dataset.metadata.languageVariant && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Language Variant:</span>
                          <span className="font-medium">{dataset.metadata.languageVariant}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Quality Metrics</h4>
                    <div className="space-y-2">
                      {Object.entries(dataset.metadata.qualityMetrics).map(([metric, score]) => (
                        <div key={metric} className="flex justify-between items-center">
                          <span className="text-gray-500 text-sm capitalize">
                            {metric.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-red-400 via-yellow-400 to-green-400 rounded-full"
                                style={{ width: `${score}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-8">{score}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Sample Viewer */}
            <div className="flex-1 p-6 overflow-y-auto">
              {selectedSample ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    {getTypeIcon(selectedSample.type)}
                    <h3 className="text-lg font-medium text-gray-900">
                      Sample Preview
                    </h3>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded capitalize">
                      {selectedSample.type}
                    </span>
                  </div>

                  {renderSampleContent(selectedSample)}

                  {/* Sample Metadata */}
                  {selectedSample.metadata && Object.keys(selectedSample.metadata).length > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Sample Metadata</h4>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries(selectedSample.metadata).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-500 capitalize">{key}:</span>
                            <span className="font-medium text-gray-900">
                              {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <Eye className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Select a sample to preview</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-gray-200 p-6 flex items-center justify-between">
              <div className="text-sm text-gray-500">
                {preview?.expiresAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Preview expires: {preview.expiresAt.toLocaleString()}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                {preview?.downloadUrl && (
                  <a
                    href={preview.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-sm flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Full Preview
                  </a>
                )}

                {onPurchase && (
                  <button
                    onClick={() => onPurchase(dataset)}
                    className="btn-primary text-sm flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Purchase License
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}