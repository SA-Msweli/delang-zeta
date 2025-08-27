// Proposal creation form component

import React, { useState } from 'react'
import { CreateProposalRequest, ProposalAction } from '../../types/governance'
import { useGovernance } from '../../contexts/GovernanceContext'

interface ProposalCreationFormProps {
  onSuccess?: (proposalId: string) => void
  onCancel?: () => void
}

export function ProposalCreationForm({ onSuccess, onCancel }: ProposalCreationFormProps) {
  const { createProposal, isLoading } = useGovernance()

  const [formData, setFormData] = useState<CreateProposalRequest>({
    title: '',
    description: '',
    category: 'protocol',
    actions: [],
    discussionUrl: '',
    tags: []
  })

  const [currentAction, setCurrentAction] = useState<ProposalAction>({
    target: '',
    value: '0',
    signature: '',
    calldata: '0x',
    description: ''
  })

  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    } else if (formData.title.length < 10) {
      newErrors.title = 'Title must be at least 10 characters'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    } else if (formData.description.length < 50) {
      newErrors.description = 'Description must be at least 50 characters'
    }

    if (formData.actions.length === 0) {
      newErrors.actions = 'At least one action is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      const proposalId = await createProposal(formData)
      onSuccess?.(proposalId)
    } catch (error) {
      console.error('Failed to create proposal:', error)
    }
  }

  const addAction = () => {
    if (!currentAction.target || !currentAction.description) return

    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, currentAction]
    }))

    setCurrentAction({
      target: '',
      value: '0',
      signature: '',
      calldata: '0x',
      description: ''
    })
  }

  const removeAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }))
  }

  const addTag = () => {
    if (!tagInput.trim() || formData.tags.includes(tagInput.trim())) return

    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, tagInput.trim()]
    }))

    setTagInput('')
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag)
    }))
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Governance Proposal</h2>
        <p className="text-gray-600">
          Submit a proposal for the DAO to vote on. All proposals require a minimum token threshold.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Proposal Title *
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
              placeholder="Enter a clear, descriptive title"
              maxLength={200}
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                category: e.target.value as CreateProposalRequest['category']
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="protocol">Protocol</option>
              <option value="treasury">Treasury</option>
              <option value="parameters">Parameters</option>
              <option value="upgrade">Upgrade</option>
            </select>
          </div>

          <div>
            <label htmlFor="discussionUrl" className="block text-sm font-medium text-gray-700 mb-2">
              Discussion URL
            </label>
            <input
              type="url"
              id="discussionUrl"
              value={formData.discussionUrl}
              onChange={(e) => setFormData(prev => ({ ...prev, discussionUrl: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://forum.example.com/proposal-discussion"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description *
          </label>
          <textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={6}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.description ? 'border-red-500' : 'border-gray-300'
              }`}
            placeholder="Provide a detailed description of the proposal, including rationale and expected outcomes..."
          />
          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
          <p className="mt-1 text-sm text-gray-500">
            {formData.description.length} characters (minimum 50 required)
          </p>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add tags (press Enter)"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Actions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Proposal Actions *
          </label>

          {/* Existing Actions */}
          {formData.actions.length > 0 && (
            <div className="mb-4 space-y-2">
              {formData.actions.map((action, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{action.description}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Target: {action.target}
                        {action.value !== '0' && ` | Value: ${action.value} ETH`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAction(index)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Action */}
          <div className="p-4 border border-gray-200 rounded-md space-y-3">
            <h4 className="font-medium text-sm">Add Action</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Target Contract Address
                </label>
                <input
                  type="text"
                  value={currentAction.target}
                  onChange={(e) => setCurrentAction(prev => ({ ...prev, target: e.target.value }))}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0x..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Value (ETH)
                </label>
                <input
                  type="text"
                  value={currentAction.value}
                  onChange={(e) => setCurrentAction(prev => ({ ...prev, value: e.target.value }))}
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Function Signature
              </label>
              <input
                type="text"
                value={currentAction.signature}
                onChange={(e) => setCurrentAction(prev => ({ ...prev, signature: e.target.value }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="functionName(uint256,address)"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Calldata
              </label>
              <input
                type="text"
                value={currentAction.calldata}
                onChange={(e) => setCurrentAction(prev => ({ ...prev, calldata: e.target.value }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0x..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Action Description
              </label>
              <input
                type="text"
                value={currentAction.description}
                onChange={(e) => setCurrentAction(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Describe what this action does"
              />
            </div>

            <button
              type="button"
              onClick={addAction}
              disabled={!currentAction.target || !currentAction.description}
              className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Add Action
            </button>
          </div>

          {errors.actions && <p className="mt-1 text-sm text-red-600">{errors.actions}</p>}
        </div>

        {/* Submit Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Creating Proposal...' : 'Create Proposal'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}