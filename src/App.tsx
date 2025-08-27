import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PWAStatus } from './components/PWAStatus'
import { HomePage } from './pages/HomePage'
import { DashboardPage } from './pages/DashboardPage'
import { TasksPage } from './pages/TasksPage'
import { MarketplacePage } from './pages/MarketplacePage'
import { LicensesPage } from './pages/LicensesPage'
import { ProfilePage } from './pages/ProfilePage'
import { SubmitDataPage } from './pages/SubmitDataPage'
import { ValidationPage } from './pages/ValidationPage'
import { GovernancePage } from './pages/GovernancePage'
import { initializeSecurity } from './utils/security'
import { ErrorHandlingService } from './services/errorHandling'
import { NetworkRecoveryService } from './services/networkRecovery'
import { TransactionRetryService } from './services/transactionRetry'
import { ErrorAnalyticsService } from './services/errorAnalytics'
import { useEffect } from 'react'

function App() {
  useEffect(() => {
    // Initialize security measures on app startup
    initializeSecurity()

    // Initialize error handling systems
    ErrorHandlingService.initialize()
    NetworkRecoveryService.initialize()
    TransactionRetryService.initialize()
    ErrorAnalyticsService.initialize()
  }, [])

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:taskId/submit" element={<SubmitDataPage />} />
        <Route path="/validation" element={<ValidationPage />} />
        <Route path="/validation/:taskId" element={<ValidationPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/licenses" element={<LicensesPage />} />
        <Route path="/governance" element={<GovernancePage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
      <PWAStatus />
    </Layout>
  )
}

export default App