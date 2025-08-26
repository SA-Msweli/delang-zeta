import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  ShoppingBag,
  User,
  Plus
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tasks', href: '/tasks', icon: FileText },
  { name: 'Contribute', href: '/contribute', icon: Plus, isAction: true },
  { name: 'Marketplace', href: '/marketplace', icon: ShoppingBag },
  { name: 'Profile', href: '/profile', icon: User },
]

export function MobileNav() {
  const location = useLocation()

  return (
    <nav className="mobile-nav lg:hidden safe-area-bottom">
      <div className="flex justify-around items-center">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          const isAction = item.isAction

          return (
            <Link
              key={item.name}
              to={item.href}
              className={`
                flex flex-col items-center justify-center min-w-0 flex-1 transition-all duration-200
                ${isAction
                  ? 'relative -mt-6'
                  : 'py-2 px-1'
                }
              `}
            >
              {isAction ? (
                // Action button (floating)
                <div className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-3 shadow-lg">
                  <item.icon className="h-6 w-6" />
                </div>
              ) : (
                // Regular nav item
                <>
                  <div className={`
                    p-1 rounded-lg transition-colors
                    ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}>
                    <item.icon className={`
                      h-5 w-5 transition-colors
                      ${isActive ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}
                    `} />
                  </div>
                  <span className={`
                    text-xs font-medium mt-1 truncate transition-colors
                    ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}
                  `}>
                    {item.name}
                  </span>
                </>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}