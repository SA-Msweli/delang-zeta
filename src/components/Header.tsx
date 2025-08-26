import { Link } from 'react-router-dom'
import { Menu, Zap, Bell } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { WalletButton } from './wallet/WalletButton'
import { NetworkSwitcher } from './wallet/NetworkSwitcher'

interface HeaderProps {
  onMenuClick?: () => void
  showMenuButton?: boolean
}

export function Header({ onMenuClick, showMenuButton = false }: HeaderProps) {
  const { isAuthenticated } = useAuth()

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-40 safe-area-top">
      <div className="px-4 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            {/* Mobile Menu Button */}
            {showMenuButton && (
              <button
                onClick={onMenuClick}
                className="lg:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                aria-label="Open menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}

            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gradient hidden sm:block">
                DeLangZeta
              </span>
              <span className="text-xl font-bold text-gradient sm:hidden">
                DLZ
              </span>
            </Link>
          </div>

          {/* Center Navigation - Desktop Only */}
          {!isAuthenticated && (
            <nav className="hidden md:flex items-center space-x-8">
              <Link
                to="/"
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                Home
              </Link>
              <Link
                to="/marketplace"
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                Marketplace
              </Link>
              <a
                href="#features"
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                Features
              </a>
              <a
                href="#about"
                className="text-gray-600 hover:text-gray-900 transition-colors font-medium"
              >
                About
              </a>
            </nav>
          )}

          {/* Right Section */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Network Switcher - Authenticated Users */}
            {isAuthenticated && (
              <NetworkSwitcher className="hidden sm:block" />
            )}

            {/* Notifications - Authenticated Users */}
            {isAuthenticated && (
              <button className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors relative">
                <Bell className="w-5 h-5" />
                {/* Notification badge */}
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </button>
            )}

            {/* Wallet Connection */}
            <WalletButton
              variant="primary"
              size="md"
              className="text-sm"
            />
          </div>
        </div>
      </div>
    </header>
  )
}