import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { DashboardPage } from './pages/DashboardPage'
import { TasksPage } from './pages/TasksPage'
import { MarketplacePage } from './pages/MarketplacePage'
import { ProfilePage } from './pages/ProfilePage'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </Layout>
  )
}

export default App