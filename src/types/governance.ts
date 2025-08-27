// Governance types and interfaces

export interface GovernanceProposal {
  id: string
  title: string
  description: string
  proposer: string
  category: 'protocol' | 'treasury' | 'parameters' | 'upgrade'
  status: 'draft' | 'active' | 'succeeded' | 'defeated' | 'queued' | 'executed' | 'cancelled'
  createdAt: Date
  startTime: Date
  endTime: Date
  executionTime?: Date

  // Voting details
  votingPower: {
    total: string
    quorum: string
    required: string
  }

  votes: {
    for: string
    against: string
    abstain: string
  }

  // Proposal actions
  actions: ProposalAction[]

  // Metadata
  metadata: {
    ipfsHash?: string
    discussionUrl?: string
    tags: string[]
  }
}

export interface ProposalAction {
  target: string
  value: string
  signature: string
  calldata: string
  description: string
}

export interface Vote {
  proposalId: string
  voter: string
  support: VoteType
  weight: string
  reason?: string
  timestamp: Date
  transactionHash: string
}

export type VoteType = 'for' | 'against' | 'abstain'

export interface VotingPower {
  address: string
  balance: string
  delegated: string
  votes: string
  blockNumber: number
}

export interface GovernanceStats {
  totalProposals: number
  activeProposals: number
  totalVoters: number
  totalVotingPower: string
  participationRate: number
  averageVotingPower: string
}

export interface CreateProposalRequest {
  title: string
  description: string
  category: GovernanceProposal['category']
  actions: ProposalAction[]
  discussionUrl?: string
  tags: string[]
}

export interface VoteRequest {
  proposalId: string
  support: VoteType
  reason?: string
}

export interface DelegateRequest {
  delegatee: string
}

export interface GovernanceContextType {
  // State
  proposals: GovernanceProposal[]
  userVotes: Vote[]
  votingPower: VotingPower | null
  stats: GovernanceStats | null
  isLoading: boolean
  error: string | null

  // Actions
  createProposal: (proposal: CreateProposalRequest) => Promise<string>
  vote: (voteRequest: VoteRequest) => Promise<void>
  delegate: (delegateRequest: DelegateRequest) => Promise<void>
  executeProposal: (proposalId: string) => Promise<void>
  cancelProposal: (proposalId: string) => Promise<void>

  // Data fetching
  fetchProposals: () => Promise<void>
  fetchProposal: (proposalId: string) => Promise<GovernanceProposal>
  fetchUserVotes: () => Promise<void>
  fetchVotingPower: (address?: string) => Promise<void>
  fetchStats: () => Promise<void>

  // Utilities
  clearError: () => void
  refreshData: () => Promise<void>
}

// Governance token information
export interface GovernanceToken {
  address: string
  name: string
  symbol: string
  decimals: number
  totalSupply: string
  circulatingSupply: string
}

// Proposal filters and sorting
export interface ProposalFilters {
  status?: GovernanceProposal['status'][]
  category?: GovernanceProposal['category'][]
  proposer?: string
  dateRange?: {
    start: Date
    end: Date
  }
}

export interface ProposalSortOptions {
  field: 'createdAt' | 'endTime' | 'votes.for' | 'votingPower.total'
  direction: 'asc' | 'desc'
}

// Real-time updates
export interface GovernanceEvent {
  type: 'proposal_created' | 'proposal_updated' | 'vote_cast' | 'proposal_executed'
  proposalId: string
  data: any
  timestamp: Date
}