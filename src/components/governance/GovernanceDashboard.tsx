// Governance dashboard component with real-time updates

import { useState } from 'react'
import { GovernanceProposal, ProposalFilters, ProposalSortOptions } from '../../types/governance'
import { useGovernance } from '../../contexts/GovernanceContext'
import { ProposalCard } from './ProposalCard'
import { ProposalCreationForm } from './ProposalCreationForm'
import { VotingInterface } from './VotingInterface'

export function GovernanceDashboard() {
  const {
    proposals,
    stats,
    votingPower,
    isLoading,
    error,
    fetchProposals,

    clearError
  } = useGovernance()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<GovernanceProposal | null>(null)
  const [showVotingInterface, setShowVotingInterface] = useState(false)
  const [filters, setFilters] = useState<ProposalFilters>({})
  const [sortBy, setSortBy] = useState<ProposalSortOptions>({
    field: 'createdAt',
    direction: 'desc'
  })

  // Filter and sort proposals
  const filteredProposals = proposals
    .filter(proposal => {
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(proposal.status)) return false
      }
      if (filters.category && filters.category.length > 0) {
        if (!filters.category.includes(proposal.category)) return false
      }
      if (filters.proposer) {
        if (!proposal.proposer.toLowerCase().includes(filters.proposer.toLowerCase())) return false
      }
      return true
    })
    .sort((a, b) => {
      const aValue = sortBy.field === 'createdAt' || sortBy.field === 'endTime'
        ? new Date(a[sortBy.field]).getTime()
        : parseFloat(a.votes.for)
      const bValue = sortBy.field === 'createdAt' || sortBy.field === 'endTime'
        ? new Date(b[sortBy.field]).getTime()
        : parseFloat(b.votes.for)

      return sortBy.direction === 'desc' ? bValue - aValue : aValue - bValue
    })


  const userCanCreateProposal = votingPower && parseFloat(votingPower.votes) >= 1000 // Minimum threshold

  const handleVoteClick = (proposalId: string) => {
    const proposal = proposals.find(p => p.id === proposalId)
    if (proposal) {
      setSelectedProposal(proposal)
      setShowVotingInterface(true)
    }
  }

  const handleCreateProposal = () => {
    setShowCreateForm(true)
  }

  const handleProposalCreated = () => {
    setShowCreateForm(false)
    // Refresh proposals to show the new one
    fetchProposals()
  }

  const formatNumber = (value: string) => {
    const num = parseFloat(value)
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toFixed(0)
  }

  if (showCreateForm) {
    return (
      <ProposalCreationForm
        onSuccess={handleProposalCreated}
        onCancel={() => setShowCreateForm(false)}
      />
    )
  }

  if (showVotingInterface && selectedProposal) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <VotingInterface
          proposal={selectedProposal}
          onVoteSuccess={() => {
            setShowVotingInterface(false)
            setSelectedProposal(null)
            fetchProposals() // Refresh to show updated vote counts
          }}
          onClose={() => {
            setShowVotingInterface(false)
            setSelectedProposal(null)
          }}
        />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Governance</h1>
            <p className="text-gray-600 mt-1">
              Participate in DAO governance by creating and voting on proposals
            </p>
          </div>

          {userCanCreateProposal && (
            <button
              onClick={handleCreateProposal}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
            >
              Create Proposal
            </button>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-800">{error}</span>
            </div>
            <button
              onClick={clearError}
              className="text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Proposals</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.totalProposals}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Proposals</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.activeProposals}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Voters</p>
                <p className="text-2xl font-semibold text-gray-900">{formatNumber(stats.totalVoters.toString())}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Participation Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.participationRate.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Sorting */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={filters.status?.[0] || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                status: e.target.value ? [e.target.value as GovernanceProposal['status']] : undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="succeeded">Succeeded</option>
              <option value="defeated">Defeated</option>
              <option value="executed">Executed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select
              value={filters.category?.[0] || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                category: e.target.value ? [e.target.value as GovernanceProposal['category']] : undefined
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="protocol">Protocol</option>
              <option value="treasury">Treasury</option>
              <option value="parameters">Parameters</option>
              <option value="upgrade">Upgrade</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
            <select
              value={`${sortBy.field}-${sortBy.direction}`}
              onChange={(e) => {
                const [field, direction] = e.target.value.split('-')
                setSortBy({
                  field: field as ProposalSortOptions['field'],
                  direction: direction as 'asc' | 'desc'
                })
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="endTime-asc">Ending Soon</option>
              <option value="votes.for-desc">Most Support</option>
            </select>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Proposer</label>
            <input
              type="text"
              value={filters.proposer || ''}
              onChange={(e) => setFilters(prev => ({
                ...prev,
                proposer: e.target.value || undefined
              }))}
              placeholder="Enter address..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Proposals List */}
      <div className="space-y-6">
        {isLoading && proposals.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading proposals...</p>
          </div>
        ) : filteredProposals.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No proposals found</h3>
            <p className="text-gray-600 mb-4">
              {proposals.length === 0
                ? "No proposals have been created yet."
                : "No proposals match your current filters."
              }
            </p>
            {userCanCreateProposal && proposals.length === 0 && (
              <button
                onClick={handleCreateProposal}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                Create First Proposal
              </button>
            )}
          </div>
        ) : (
          filteredProposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              onVote={handleVoteClick}
              onViewDetails={(id) => {
                // In a real app, this would navigate to a detailed proposal page
                console.log('View proposal details:', id)
              }}
            />
          ))
        )}
      </div>

      {/* Load More Button */}
      {filteredProposals.length > 0 && filteredProposals.length % 20 === 0 && (
        <div className="text-center mt-8">
          <button
            onClick={() => fetchProposals()}
            disabled={isLoading}
            className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-md hover:bg-gray-200 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}
    </div>
  )
}