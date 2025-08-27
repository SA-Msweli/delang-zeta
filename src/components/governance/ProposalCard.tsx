// Proposal card component for displaying governance proposals


import { GovernanceProposal, VoteType } from '../../types/governance'
import { useGovernance } from '../../contexts/GovernanceContext'

interface ProposalCardProps {
  proposal: GovernanceProposal
  onVote?: (proposalId: string, support: VoteType) => void
  onViewDetails?: (proposalId: string) => void
  showVoting?: boolean
  compact?: boolean
}

export function ProposalCard({
  proposal,
  onVote,
  onViewDetails,
  showVoting = true,
  compact = false
}: ProposalCardProps) {
  const { vote, isLoading } = useGovernance()

  const getStatusColor = (status: GovernanceProposal['status']) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'succeeded': return 'bg-blue-100 text-blue-800'
      case 'defeated': return 'bg-red-100 text-red-800'
      case 'executed': return 'bg-purple-100 text-purple-800'
      case 'queued': return 'bg-yellow-100 text-yellow-800'
      case 'cancelled': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getCategoryColor = (category: GovernanceProposal['category']) => {
    switch (category) {
      case 'protocol': return 'bg-indigo-100 text-indigo-800'
      case 'treasury': return 'bg-emerald-100 text-emerald-800'
      case 'parameters': return 'bg-orange-100 text-orange-800'
      case 'upgrade': return 'bg-pink-100 text-pink-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatNumber = (value: string) => {
    const num = parseFloat(value)
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toFixed(0)
  }

  const getVotePercentage = (votes: string, total: string) => {
    const voteNum = parseFloat(votes)
    const totalNum = parseFloat(total)
    if (totalNum === 0) return 0
    return (voteNum / totalNum) * 100
  }

  const totalVotes = parseFloat(proposal.votes.for) + parseFloat(proposal.votes.against) + parseFloat(proposal.votes.abstain)
  const forPercentage = getVotePercentage(proposal.votes.for, totalVotes.toString())
  const againstPercentage = getVotePercentage(proposal.votes.against, totalVotes.toString())
  const abstainPercentage = getVotePercentage(proposal.votes.abstain, totalVotes.toString())

  const isVotingActive = proposal.status === 'active' && new Date() < proposal.endTime
  const timeRemaining = proposal.endTime.getTime() - Date.now()
  const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24))

  const handleVote = async (support: VoteType) => {
    try {
      await vote({ proposalId: proposal.id, support })
      onVote?.(proposal.id, support)
    } catch (error) {
      console.error('Failed to vote:', error)
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow ${compact ? 'p-4' : 'p-6'
      }`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
              {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(proposal.category)}`}>
              {proposal.category.charAt(0).toUpperCase() + proposal.category.slice(1)}
            </span>
            {proposal.metadata.tags.map(tag => (
              <span key={tag} className="px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-600">
                {tag}
              </span>
            ))}
          </div>

          <h3 className={`font-semibold text-gray-900 ${compact ? 'text-lg' : 'text-xl'} mb-2`}>
            {proposal.title}
          </h3>

          <p className={`text-gray-600 ${compact ? 'text-sm' : ''} ${compact ? 'line-clamp-2' : 'line-clamp-3'}`}>
            {proposal.description}
          </p>
        </div>

        {isVotingActive && (
          <div className="text-right">
            <div className="text-sm text-gray-500">
              {daysRemaining > 0 ? `${daysRemaining} days left` : 'Ending soon'}
            </div>
          </div>
        )}
      </div>

      {/* Voting Results */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Voting Results</span>
          <span className="text-sm text-gray-500">
            {formatNumber(totalVotes.toString())} votes
          </span>
        </div>

        <div className="space-y-2">
          {/* For votes */}
          <div className="flex items-center gap-3">
            <div className="w-12 text-xs text-gray-600">For</div>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${forPercentage}%` }}
              />
            </div>
            <div className="w-16 text-xs text-right text-gray-600">
              {forPercentage.toFixed(1)}%
            </div>
            <div className="w-12 text-xs text-right text-gray-600">
              {formatNumber(proposal.votes.for)}
            </div>
          </div>

          {/* Against votes */}
          <div className="flex items-center gap-3">
            <div className="w-12 text-xs text-gray-600">Against</div>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${againstPercentage}%` }}
              />
            </div>
            <div className="w-16 text-xs text-right text-gray-600">
              {againstPercentage.toFixed(1)}%
            </div>
            <div className="w-12 text-xs text-right text-gray-600">
              {formatNumber(proposal.votes.against)}
            </div>
          </div>

          {/* Abstain votes */}
          <div className="flex items-center gap-3">
            <div className="w-12 text-xs text-gray-600">Abstain</div>
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-gray-400 h-2 rounded-full transition-all duration-300"
                style={{ width: `${abstainPercentage}%` }}
              />
            </div>
            <div className="w-16 text-xs text-right text-gray-600">
              {abstainPercentage.toFixed(1)}%
            </div>
            <div className="w-12 text-xs text-right text-gray-600">
              {formatNumber(proposal.votes.abstain)}
            </div>
          </div>
        </div>

        {/* Quorum Progress */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-600">Quorum Progress</span>
            <span className="text-xs text-gray-600">
              {formatNumber(totalVotes.toString())} / {formatNumber(proposal.votingPower.quorum)}
            </span>
          </div>
          <div className="bg-gray-200 rounded-full h-1">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, (totalVotes / parseFloat(proposal.votingPower.quorum)) * 100)}%`
              }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2">
        {showVoting && isVotingActive && (
          <div className="flex gap-2 flex-1">
            <button
              onClick={() => handleVote('for')}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors"
            >
              Vote For
            </button>
            <button
              onClick={() => handleVote('against')}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors"
            >
              Vote Against
            </button>
            <button
              onClick={() => handleVote('abstain')}
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Abstain
            </button>
          </div>
        )}

        <button
          onClick={() => onViewDetails?.(proposal.id)}
          className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-md hover:bg-blue-200 transition-colors"
        >
          View Details
        </button>
      </div>

      {/* Metadata */}
      {!compact && (
        <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex flex-wrap justify-between gap-2">
            <span>Proposed by: {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}</span>
            <span>Created: {proposal.createdAt.toLocaleDateString()}</span>
            {proposal.metadata.discussionUrl && (
              <a
                href={proposal.metadata.discussionUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                Discussion →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}