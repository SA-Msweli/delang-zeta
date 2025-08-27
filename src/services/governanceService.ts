// Governance service for secure DAO operations

import {
  GovernanceProposal,
  Vote,
  VotingPower,
  GovernanceStats,
  CreateProposalRequest,
  VoteRequest,
  DelegateRequest,
  ProposalFilters,
  ProposalSortOptions,
  GovernanceEvent
} from '../types/governance'
import { tokenManager } from './tokenManager'
import { auditService } from './auditService'

class GovernanceService {
  private baseUrl = '/api/governance'
  private eventListeners: Map<string, (event: GovernanceEvent) => void> = new Map()

  // Proposal management
  async createProposal(proposal: CreateProposalRequest): Promise<string> {
    try {
      const token = await tokenManager.getAccessToken()

      // Audit log for proposal creation
      await auditService.logActivity({
        action: 'governance_proposal_create',
        details: {
          title: proposal.title,
          category: proposal.category,
          actionsCount: proposal.actions.length
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      const response = await fetch(`${this.baseUrl}/proposals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        },
        body: JSON.stringify(proposal)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create proposal')
      }

      const result = await response.json()

      // Log successful creation
      await auditService.logActivity({
        action: 'governance_proposal_created',
        details: {
          proposalId: result.proposalId,
          title: proposal.title
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      return result.proposalId
    } catch (error) {
      console.error('Error creating proposal:', error)
      throw error
    }
  }

  async fetchProposals(
    filters?: ProposalFilters,
    sort?: ProposalSortOptions,
    limit = 20,
    offset = 0
  ): Promise<{ proposals: GovernanceProposal[], total: number }> {
    try {
      const token = await tokenManager.getAccessToken()

      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })

      if (filters) {
        if (filters.status) params.append('status', filters.status.join(','))
        if (filters.category) params.append('category', filters.category.join(','))
        if (filters.proposer) params.append('proposer', filters.proposer)
        if (filters.dateRange) {
          params.append('startDate', filters.dateRange.start.toISOString())
          params.append('endDate', filters.dateRange.end.toISOString())
        }
      }

      if (sort) {
        params.append('sortBy', sort.field)
        params.append('sortOrder', sort.direction)
      }

      const response = await fetch(`${this.baseUrl}/proposals?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch proposals')
      }

      const data = await response.json()
      return {
        proposals: data.proposals.map(this.transformProposal),
        total: data.total
      }
    } catch (error) {
      console.error('Error fetching proposals:', error)
      throw error
    }
  }

  async fetchProposal(proposalId: string): Promise<GovernanceProposal> {
    try {
      const token = await tokenManager.getAccessToken()

      const response = await fetch(`${this.baseUrl}/proposals/${proposalId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch proposal')
      }

      const data = await response.json()
      return this.transformProposal(data)
    } catch (error) {
      console.error('Error fetching proposal:', error)
      throw error
    }
  }

  // Voting operations
  async vote(voteRequest: VoteRequest): Promise<void> {
    try {
      const token = await tokenManager.getAccessToken()

      // Audit log for vote attempt
      await auditService.logActivity({
        action: 'governance_vote_attempt',
        details: {
          proposalId: voteRequest.proposalId,
          support: voteRequest.support,
          hasReason: !!voteRequest.reason
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      const response = await fetch(`${this.baseUrl}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        },
        body: JSON.stringify(voteRequest)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to cast vote')
      }

      // Log successful vote
      await auditService.logActivity({
        action: 'governance_vote_cast',
        details: {
          proposalId: voteRequest.proposalId,
          support: voteRequest.support
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })
    } catch (error) {
      console.error('Error casting vote:', error)
      throw error
    }
  }

  async fetchUserVotes(address?: string): Promise<Vote[]> {
    try {
      const token = await tokenManager.getAccessToken()

      const params = address ? `?address=${address}` : ''
      const response = await fetch(`${this.baseUrl}/votes${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch user votes')
      }

      const data = await response.json()
      return data.votes.map(this.transformVote)
    } catch (error) {
      console.error('Error fetching user votes:', error)
      throw error
    }
  }

  // Delegation
  async delegate(delegateRequest: DelegateRequest): Promise<void> {
    try {
      const token = await tokenManager.getAccessToken()

      // Audit log for delegation
      await auditService.logActivity({
        action: 'governance_delegate',
        details: {
          delegatee: delegateRequest.delegatee
        },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      const response = await fetch(`${this.baseUrl}/delegate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        },
        body: JSON.stringify(delegateRequest)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delegate votes')
      }
    } catch (error) {
      console.error('Error delegating votes:', error)
      throw error
    }
  }

  // Voting power
  async fetchVotingPower(address?: string): Promise<VotingPower> {
    try {
      const token = await tokenManager.getAccessToken()

      const params = address ? `?address=${address}` : ''
      const response = await fetch(`${this.baseUrl}/voting-power${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch voting power')
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Error fetching voting power:', error)
      throw error
    }
  }

  // Statistics
  async fetchStats(): Promise<GovernanceStats> {
    try {
      const token = await tokenManager.getAccessToken()

      const response = await fetch(`${this.baseUrl}/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch governance stats')
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching governance stats:', error)
      throw error
    }
  }

  // Proposal execution
  async executeProposal(proposalId: string): Promise<void> {
    try {
      const token = await tokenManager.getAccessToken()

      // Audit log for execution attempt
      await auditService.logActivity({
        action: 'governance_proposal_execute_attempt',
        details: { proposalId },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })

      const response = await fetch(`${this.baseUrl}/proposals/${proposalId}/execute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to execute proposal')
      }

      // Log successful execution
      await auditService.logActivity({
        action: 'governance_proposal_executed',
        details: { proposalId },
        timestamp: new Date(),
        userAgent: navigator.userAgent,
        ipAddress: 'client-side'
      })
    } catch (error) {
      console.error('Error executing proposal:', error)
      throw error
    }
  }

  // Real-time updates
  subscribeToEvents(callback: (event: GovernanceEvent) => void): string {
    const subscriptionId = crypto.randomUUID()
    this.eventListeners.set(subscriptionId, callback)

    // In a real implementation, this would connect to WebSocket or Server-Sent Events
    // For now, we'll simulate with periodic polling
    this.startEventPolling(subscriptionId)

    return subscriptionId
  }

  unsubscribeFromEvents(subscriptionId: string): void {
    this.eventListeners.delete(subscriptionId)
  }

  private startEventPolling(subscriptionId: string): void {
    // Simulate real-time updates with polling
    // In production, this would be replaced with WebSocket connection
    const interval = setInterval(async () => {
      if (!this.eventListeners.has(subscriptionId)) {
        clearInterval(interval)
        return
      }

      try {
        // Poll for new events
        const events = await this.fetchRecentEvents()
        const callback = this.eventListeners.get(subscriptionId)

        if (callback) {
          events.forEach(callback)
        }
      } catch (error) {
        console.error('Error polling for governance events:', error)
      }
    }, 10000) // Poll every 10 seconds
  }

  private async fetchRecentEvents(): Promise<GovernanceEvent[]> {
    try {
      const token = await tokenManager.getAccessToken()

      const response = await fetch(`${this.baseUrl}/events?since=${Date.now() - 60000}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': crypto.randomUUID()
        }
      })

      if (!response.ok) {
        return []
      }

      const data = await response.json()
      return data.events || []
    } catch (error) {
      console.error('Error fetching recent events:', error)
      return []
    }
  }

  // Data transformation helpers
  private transformProposal(data: any): GovernanceProposal {
    return {
      ...data,
      createdAt: new Date(data.createdAt),
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      executionTime: data.executionTime ? new Date(data.executionTime) : undefined
    }
  }

  private transformVote(data: any): Vote {
    return {
      ...data,
      timestamp: new Date(data.timestamp)
    }
  }
}

export const governanceService = new GovernanceService()