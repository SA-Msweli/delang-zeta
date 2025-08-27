// Voting interface component for mobile-optimized voting experience

import { useState, useEffect } from 'react'
import { GovernanceProposal, VoteType } from '../../types/governance'
import { useGovernance } from '../../contexts/GovernanceContext'
import { useAuth } from '../../contexts/AuthContext'

interface VotingInterfaceProps {
  proposal: GovernanceProposal
  onVoteSuccess?: () => void
  onClose?: () => void
}

export function VotingInterface({ proposal, onVoteSuccess, onClose }: VotingInterfaceProps) {
  const { vote, votingPower, fetchVotingPower, isLoading } = useGovernance()
  const { user } = useAuth()

  const [selectedVote, setSelectedVote] = useState<VoteType | null>(null)
  const [reason, setReason] = useState('')
  const [showReason, setShowReason] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (user?.address && !votingPower) {
      fetchVotingPower(user.address)
    }
  }, [user?.address, votingPower, fetchVotingPower])

  const handleVote = async () => {
    if (!selectedVote) return

    try {
      setIsSubmitting(true)
      await vote({
        proposalId: proposal.id,
        support: selectedVote,
        reason: reason.trim() || undefined
      })
      onVoteSuccess?.()
    } catch (error) {
      console.error('Failed to vote:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatVotingPower = (power: string) => {
    const num = parseFloat(power)
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  const isVotingActive = proposal.status === 'active' && new Date() < proposal.endTime
  const timeRemaining = proposal.endTime.getTime() - Date.now()
  const hoursRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60))

  if (!isVotingActive) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Voting Closed</h3>
          <p className="text-gray-600 mb-4">
            This proposal is no longer accepting votes.
          </p>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-md mx-auto">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Cast Your Vote</h3>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="text-sm text-gray-600 mb-2">
          <strong>{proposal.title}</strong>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>
            {hoursRemaining > 24
              ? `${Math.ceil(hoursRemaining / 24)} days left`
              : `${hoursRemaining} hours left`
            }
          </span>
          {votingPower && (
            <span>
              Your voting power: {formatVotingPower(votingPower.votes)}
            </span>
          )}
        </div>
      </div>

      {/* Voting Options */}
      <div className="p-6">
        <div className="space-y-3 mb-6">
          {/* Vote For */}
          <button
            onClick={() => setSelectedVote('for')}
            className={`w-full p-4 rounded-lg border-2 transition-all ${selectedVote === 'for'
              ? 'border-green-500 bg-green-50 text-green-900'
              : 'border-gray-200 hover:border-green-300 hover:bg-green-50'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 mr-3 ${selectedVote === 'for'
                  ? 'border-green-500 bg-green-500'
                  : 'border-gray-300'
                  }`}>
                  {selectedVote === 'for' && (
                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
                <span className="font-medium">Vote For</span>
              </div>
              <div className="text-sm text-gray-600">
                Support this proposal
              </div>
            </div>
          </button>

          {/* Vote Against */}
          <button
            onClick={() => setSelectedVote('against')}
            className={`w-full p-4 rounded-lg border-2 transition-all ${selectedVote === 'against'
              ? 'border-red-500 bg-red-50 text-red-900'
              : 'border-gray-200 hover:border-red-300 hover:bg-red-50'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 mr-3 ${selectedVote === 'against'
                  ? 'border-red-500 bg-red-500'
                  : 'border-gray-300'
                  }`}>
                  {selectedVote === 'against' && (
                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
                <span className="font-medium">Vote Against</span>
              </div>
              <div className="text-sm text-gray-600">
                Oppose this proposal
              </div>
            </div>
          </button>

          {/* Abstain */}
          <button
            onClick={() => setSelectedVote('abstain')}
            className={`w-full p-4 rounded-lg border-2 transition-all ${selectedVote === 'abstain'
              ? 'border-gray-500 bg-gray-50 text-gray-900'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 mr-3 ${selectedVote === 'abstain'
                  ? 'border-gray-500 bg-gray-500'
                  : 'border-gray-300'
                  }`}>
                  {selectedVote === 'abstain' && (
                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
                <span className="font-medium">Abstain</span>
              </div>
              <div className="text-sm text-gray-600">
                Neither support nor oppose
              </div>
            </div>
          </button>
        </div>

        {/* Reason (Optional) */}
        <div className="mb-6">
          <button
            onClick={() => setShowReason(!showReason)}
            className="flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            <svg
              className={`w-4 h-4 mr-1 transition-transform ${showReason ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Add reason (optional)
          </button>

          {showReason && (
            <div className="mt-3">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain your vote (optional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                maxLength={500}
              />
              <div className="text-xs text-gray-500 mt-1">
                {reason.length}/500 characters
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleVote}
          disabled={!selectedVote || isSubmitting || isLoading}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting Vote...' : 'Submit Vote'}
        </button>

        {/* Voting Power Info */}
        {votingPower && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <div className="text-sm text-gray-600">
              <div className="flex justify-between mb-1">
                <span>Token Balance:</span>
                <span>{formatVotingPower(votingPower.balance)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span>Delegated:</span>
                <span>{formatVotingPower(votingPower.delegated)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Voting Power:</span>
                <span>{formatVotingPower(votingPower.votes)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}