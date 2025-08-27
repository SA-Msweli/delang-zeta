// Governance context for DAO operations

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'
import {
  GovernanceContextType,
  GovernanceProposal,
  Vote,
  VotingPower,
  GovernanceStats,
  CreateProposalRequest,
  VoteRequest,
  DelegateRequest,
  GovernanceEvent
} from '../types/governance'
import { governanceService } from '../services/governanceService'
import { useAuth } from './AuthContext'

interface GovernanceState {
  proposals: GovernanceProposal[]
  userVotes: Vote[]
  votingPower: VotingPower | null
  stats: GovernanceStats | null
  isLoading: boolean
  error: string | null
}

type GovernanceAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_PROPOSALS'; payload: GovernanceProposal[] }
  | { type: 'ADD_PROPOSAL'; payload: GovernanceProposal }
  | { type: 'UPDATE_PROPOSAL'; payload: GovernanceProposal }
  | { type: 'SET_USER_VOTES'; payload: Vote[] }
  | { type: 'ADD_VOTE'; payload: Vote }
  | { type: 'SET_VOTING_POWER'; payload: VotingPower }
  | { type: 'SET_STATS'; payload: GovernanceStats }
  | { type: 'RESET_STATE' }

const initialState: GovernanceState = {
  proposals: [],
  userVotes: [],
  votingPower: null,
  stats: null,
  isLoading: false,
  error: null
}

function governanceReducer(state: GovernanceState, action: GovernanceAction): GovernanceState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }

    case 'SET_PROPOSALS':
      return { ...state, proposals: action.payload, isLoading: false }

    case 'ADD_PROPOSAL':
      return {
        ...state,
        proposals: [action.payload, ...state.proposals],
        isLoading: false
      }

    case 'UPDATE_PROPOSAL':
      return {
        ...state,
        proposals: state.proposals.map(p =>
          p.id === action.payload.id ? action.payload : p
        ),
        isLoading: false
      }

    case 'SET_USER_VOTES':
      return { ...state, userVotes: action.payload, isLoading: false }

    case 'ADD_VOTE':
      return {
        ...state,
        userVotes: [action.payload, ...state.userVotes],
        isLoading: false
      }

    case 'SET_VOTING_POWER':
      return { ...state, votingPower: action.payload, isLoading: false }

    case 'SET_STATS':
      return { ...state, stats: action.payload, isLoading: false }

    case 'RESET_STATE':
      return initialState

    default:
      return state
  }
}

const GovernanceContext = createContext<GovernanceContextType | null>(null)

export function GovernanceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(governanceReducer, initialState)
  const { isAuthenticated, user } = useAuth()

  // Real-time event subscription
  useEffect(() => {
    if (!isAuthenticated) return

    const subscriptionId = governanceService.subscribeToEvents((event: GovernanceEvent) => {
      switch (event.type) {
        case 'proposal_created':
          dispatch({ type: 'ADD_PROPOSAL', payload: event.data })
          break
        case 'proposal_updated':
          dispatch({ type: 'UPDATE_PROPOSAL', payload: event.data })
          break
        case 'vote_cast':
          if (event.data.voter === user?.address) {
            dispatch({ type: 'ADD_VOTE', payload: event.data })
          }
          // Update proposal vote counts
          fetchProposal(event.proposalId).then(proposal => {
            dispatch({ type: 'UPDATE_PROPOSAL', payload: proposal })
          }).catch(console.error)
          break
      }
    })

    return () => {
      governanceService.unsubscribeFromEvents(subscriptionId)
    }
  }, [isAuthenticated, user?.address])

  // Reset state when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      dispatch({ type: 'RESET_STATE' })
    }
  }, [isAuthenticated])

  const createProposal = useCallback(async (proposal: CreateProposalRequest): Promise<string> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      const proposalId = await governanceService.createProposal(proposal)

      // Fetch the created proposal to add to state
      const createdProposal = await governanceService.fetchProposal(proposalId)
      dispatch({ type: 'ADD_PROPOSAL', payload: createdProposal })

      return proposalId
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create proposal'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    }
  }, [])

  const vote = useCallback(async (voteRequest: VoteRequest): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      await governanceService.vote(voteRequest)

      // Refresh user votes and proposal data
      await Promise.all([
        fetchUserVotes(),
        fetchProposal(voteRequest.proposalId).then(proposal => {
          dispatch({ type: 'UPDATE_PROPOSAL', payload: proposal })
        })
      ])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cast vote'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    }
  }, [])

  const delegate = useCallback(async (delegateRequest: DelegateRequest): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      await governanceService.delegate(delegateRequest)

      // Refresh voting power
      await fetchVotingPower()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delegate votes'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    }
  }, [])

  const executeProposal = useCallback(async (proposalId: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      await governanceService.executeProposal(proposalId)

      // Refresh proposal data
      const updatedProposal = await governanceService.fetchProposal(proposalId)
      dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProposal })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute proposal'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    }
  }, [])

  const cancelProposal = useCallback(async (proposalId: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      // This would call a cancel endpoint
      // await governanceService.cancelProposal(proposalId)

      // For now, just refresh the proposal
      const updatedProposal = await governanceService.fetchProposal(proposalId)
      dispatch({ type: 'UPDATE_PROPOSAL', payload: updatedProposal })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to cancel proposal'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    }
  }, [])

  const fetchProposals = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      const { proposals } = await governanceService.fetchProposals()
      dispatch({ type: 'SET_PROPOSALS', payload: proposals })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch proposals'
      dispatch({ type: 'SET_ERROR', payload: message })
    }
  }, [])

  const fetchProposal = useCallback(async (proposalId: string): Promise<GovernanceProposal> => {
    try {
      const proposal = await governanceService.fetchProposal(proposalId)
      dispatch({ type: 'UPDATE_PROPOSAL', payload: proposal })
      return proposal
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch proposal'
      dispatch({ type: 'SET_ERROR', payload: message })
      throw error
    }
  }, [])

  const fetchUserVotes = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      const votes = await governanceService.fetchUserVotes()
      dispatch({ type: 'SET_USER_VOTES', payload: votes })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch user votes'
      dispatch({ type: 'SET_ERROR', payload: message })
    }
  }, [])

  const fetchVotingPower = useCallback(async (address?: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      const votingPower = await governanceService.fetchVotingPower(address)
      dispatch({ type: 'SET_VOTING_POWER', payload: votingPower })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch voting power'
      dispatch({ type: 'SET_ERROR', payload: message })
    }
  }, [])

  const fetchStats = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      dispatch({ type: 'SET_ERROR', payload: null })

      const stats = await governanceService.fetchStats()
      dispatch({ type: 'SET_STATS', payload: stats })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch governance stats'
      dispatch({ type: 'SET_ERROR', payload: message })
    }
  }, [])

  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null })
  }, [])

  const refreshData = useCallback(async (): Promise<void> => {
    await Promise.all([
      fetchProposals(),
      fetchUserVotes(),
      fetchVotingPower(),
      fetchStats()
    ])
  }, [fetchProposals, fetchUserVotes, fetchVotingPower, fetchStats])

  // Initial data loading
  useEffect(() => {
    if (isAuthenticated) {
      refreshData().catch(console.error)
    }
  }, [isAuthenticated, refreshData])

  const contextValue: GovernanceContextType = {
    ...state,
    createProposal,
    vote,
    delegate,
    executeProposal,
    cancelProposal,
    fetchProposals,
    fetchProposal,
    fetchUserVotes,
    fetchVotingPower,
    fetchStats,
    clearError,
    refreshData
  }

  return (
    <GovernanceContext.Provider value={contextValue}>
      {children}
    </GovernanceContext.Provider>
  )
}

export function useGovernance(): GovernanceContextType {
  const context = useContext(GovernanceContext)
  if (!context) {
    throw new Error('useGovernance must be used within a GovernanceProvider')
  }
  return context
}