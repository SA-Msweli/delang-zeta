import { ReactNode, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { isAuthenticated } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen)
  const closeSidebar = () => setIsSidebarOpen(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header
        onMenuClick={toggleSidebar}
        showMenuButton={isAuthenticated}
      />

      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop Sidebar */}
        {isAuthenticated && (
          <Sidebar
            isOpen={isSidebarOpen}
            onClose={closeSidebar}
          />
        )}

        {/* Main Content */}
        <main className={`
          flex-1 overflow-auto
          ${isAuthenticated ? 'lg:ml-64' : ''}
          ${isAuthenticated ? 'pb-16 lg:pb-0' : 'pb-0'}
        `}>
          <div className="px-4 py-6 lg:px-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Navigation */}
      {isAuthenticated && <MobileNav />}

      {/* Mobile Sidebar Overlay */}
      {isAuthenticated && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={closeSidebar}
        />
      )}
    </div>
  )
}