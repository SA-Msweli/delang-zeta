// Governance page component


import { GovernanceDashboard } from '../components/governance/GovernanceDashboard'
import { GovernanceProvider } from '../contexts/GovernanceContext'

export function GovernancePage() {
  return (
    <GovernanceProvider>
      <div className="min-h-screen bg-gray-50">
        <GovernanceDashboard />
      </div>
    </GovernanceProvider>
  )
}