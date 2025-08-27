import { useState, useEffect } from 'react'
import {
  Key,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
  X
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import type { UserLicense } from '../types/dataset'

interface ApiKey {
  id: string
  name: string
  key: string
  licenseId: string
  createdAt: Date
  lastUsed?: Date
  usageCount: number
  rateLimit: number
  permissions: string[]
  status: 'active' | 'revoked' | 'expired'
}

interface ApiAccessManagerProps {
  license: UserLicense
  className?: string
}

export function ApiAccessManager({ license, className = '' }: ApiAccessManagerProps) {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadApiKeys()
  }, [license.id])

  const loadApiKeys = async () => {
    setIsLoading(true)
    try {
      // Mock API keys for demonstration
      const mockKeys: ApiKey[] = [
        {
          id: '1',
          name: 'Production API',
          key: 'dlz_' + Math.random().toString(36).substring(2, 15),
          licenseId: license.id,
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          lastUsed: new Date(Date.now() - 2 * 60 * 60 * 1000),
          usageCount: 1247,
          rateLimit: 1000,
          permissions: ['read', 'download'],
          status: 'active'
        },
        {
          id: '2',
          name: 'Development API',
          key: 'dlz_' + Math.random().toString(36).substring(2, 15),
          licenseId: license.id,
          createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
          lastUsed: new Date(Date.now() - 24 * 60 * 60 * 1000),
          usageCount: 342,
          rateLimit: 100,
          permissions: ['read'],
          status: 'active'
        }
      ]
      setApiKeys(mockKeys)
    } catch (error: any) {
      toast.error('Failed to load API keys')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys)
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId)
    } else {
      newVisible.add(keyId)
    }
    setVisibleKeys(newVisible)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('API key copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const revokeApiKey = async (keyId: string) => {
    try {
      setApiKeys(prev => prev.map(key =>
        key.id === keyId ? { ...key, status: 'revoked' as const } : key
      ))
      toast.success('API key revoked successfully')
    } catch (error: any) {
      toast.error('Failed to revoke API key')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'revoked':
        return 'bg-red-100 text-red-800'
      case 'expired':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4" />
      case 'revoked':
        return <AlertCircle className="h-4 w-4" />
      case 'expired':
        return <Clock className="h-4 w-4" />
      default:
        return <Key className="h-4 w-4" />
    }
  }

  const formatKey = (key: string, visible: boolean) => {
    if (visible) return key
    return key.substring(0, 8) + '•'.repeat(20) + key.substring(key.length - 4)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">API Access</h3>
          <p className="text-sm text-gray-500">
            Manage API keys for programmatic access to your licensed dataset
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary text-sm flex items-center gap-2"
          disabled={license.status !== 'active'}
        >
          <Plus className="h-4 w-4" />
          Create API Key
        </button>
      </div>

      {/* Usage Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <span className="font-medium text-blue-900">Total API Calls</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">
            {license.apiCalls.toLocaleString()}
          </div>
          <div className="text-sm text-blue-600">
            of {license.maxApiCalls?.toLocaleString() || '∞'} allowed
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Key className="h-5 w-5 text-green-600" />
            <span className="font-medium text-green-900">Active Keys</span>
          </div>
          <div className="text-2xl font-bold text-green-900">
            {apiKeys.filter(key => key.status === 'active').length}
          </div>
          <div className="text-sm text-green-600">
            of {apiKeys.length} total keys
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-purple-600" />
            <span className="font-medium text-purple-900">Rate Limit</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">
            {Math.max(...apiKeys.map(k => k.rateLimit), 0)}
          </div>
          <div className="text-sm text-purple-600">
            requests per hour
          </div>
        </div>
      </div>

      {/* API Keys List */}
      {isLoading ? (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Loading API keys...</p>
        </div>
      ) : apiKeys.length > 0 ? (
        <div className="space-y-4">
          {apiKeys.map((apiKey) => (
            <div key={apiKey.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-gray-900">{apiKey.name}</h4>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1 ${getStatusColor(apiKey.status)}`}>
                      {getStatusIcon(apiKey.status)}
                      {apiKey.status.charAt(0).toUpperCase() + apiKey.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Created {apiKey.createdAt.toLocaleDateString()}
                    {apiKey.lastUsed && (
                      <> • Last used {apiKey.lastUsed.toLocaleDateString()}</>
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {apiKey.status === 'active' && (
                    <button
                      onClick={() => revokeApiKey(apiKey.id)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                      title="Revoke API key"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* API Key Display */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-between">
                  <code className="text-sm font-mono text-gray-800 flex-1 mr-4">
                    {formatKey(apiKey.key, visibleKeys.has(apiKey.id))}
                  </code>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                      title={visibleKeys.has(apiKey.id) ? 'Hide key' : 'Show key'}
                    >
                      {visibleKeys.has(apiKey.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => copyToClipboard(apiKey.key)}
                      className="text-gray-500 hover:text-gray-700 transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Key Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Usage:</span>
                  <p className="font-medium">{apiKey.usageCount.toLocaleString()} calls</p>
                </div>
                <div>
                  <span className="text-gray-500">Rate Limit:</span>
                  <p className="font-medium">{apiKey.rateLimit}/hour</p>
                </div>
                <div>
                  <span className="text-gray-500">Permissions:</span>
                  <p className="font-medium capitalize">{apiKey.permissions.join(', ')}</p>
                </div>
                <div>
                  <span className="text-gray-500">License:</span>
                  <p className="font-medium">{license.licenseType}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Key className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys</h3>
          <p className="text-gray-500 mb-4">
            Create an API key to access your licensed dataset programmatically.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
            disabled={license.status !== 'active'}
          >
            Create Your First API Key
          </button>
        </div>
      )}

      {/* Create API Key Modal */}
      {showCreateModal && (
        <CreateApiKeyModal
          license={license}
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadApiKeys()
          }}
        />
      )}
    </div>
  )
}

interface CreateApiKeyModalProps {
  license: UserLicense
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

function CreateApiKeyModal({ isOpen, onClose, onSuccess }: CreateApiKeyModalProps) {
  const [keyName, setKeyName] = useState('')
  const [rateLimit, setRateLimit] = useState(100)
  const [permissions, setPermissions] = useState<string[]>(['read'])
  const [isCreating, setIsCreating] = useState(false)

  const availablePermissions = [
    { id: 'read', label: 'Read Access', description: 'View dataset metadata and samples' },
    { id: 'download', label: 'Download Access', description: 'Download dataset files' },
    { id: 'stream', label: 'Stream Access', description: 'Stream data in real-time' }
  ]

  const handleCreate = async () => {
    if (!keyName.trim()) {
      toast.error('Please enter a name for your API key')
      return
    }

    setIsCreating(true)
    try {
      // Mock API key creation
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('API key created successfully!')
      onSuccess()
    } catch (error: any) {
      toast.error('Failed to create API key')
    } finally {
      setIsCreating(false)
    }
  }

  const togglePermission = (permission: string) => {
    setPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Create API Key</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Key Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              API Key Name
            </label>
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., Production API, Development Key"
              className="input-field"
            />
          </div>

          {/* Rate Limit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rate Limit (requests per hour)
            </label>
            <select
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value))}
              className="input-field"
            >
              <option value={100}>100 requests/hour</option>
              <option value={500}>500 requests/hour</option>
              <option value={1000}>1,000 requests/hour</option>
              <option value={5000}>5,000 requests/hour</option>
            </select>
          </div>

          {/* Permissions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permissions
            </label>
            <div className="space-y-2">
              {availablePermissions.map((perm) => (
                <label key={perm.id} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.id)}
                    onChange={() => togglePermission(perm.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-1"
                  />
                  <div>
                    <div className="font-medium text-sm">{perm.label}</div>
                    <div className="text-xs text-gray-500">{perm.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Important Security Notice</p>
                <p>
                  Store your API key securely. It will only be shown once after creation.
                  Anyone with this key can access your licensed dataset.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || !keyName.trim() || permissions.length === 0}
            className="btn-primary flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Key className="h-4 w-4" />
                Create API Key
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}