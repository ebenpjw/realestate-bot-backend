'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import {
  HomeIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  ServerIcon,
  BellIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  CurrencyDollarIcon as CurrencyIconSolid,
  ChartBarIcon as ChartIconSolid,
  Cog6ToothIcon as CogIconSolid,
  ChatBubbleLeftRightIcon as ChatIconSolid,
  ShieldCheckIcon as ShieldIconSolid,
  ServerIcon as ServerIconSolid,
  BellIcon as BellIconSolid,
  DocumentTextIcon as DocumentIconSolid,
} from '@heroicons/react/24/solid'
import clsx from 'clsx'

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin/dashboard',
    icon: HomeIcon,
    iconActive: HomeIconSolid,
  },
  {
    name: 'Agents',
    href: '/admin/agents',
    icon: UserGroupIcon,
    iconActive: UserGroupIconSolid,
    badge: 12, // Active agents count
  },
  {
    name: 'Cost Tracking',
    href: '/admin/costs',
    icon: CurrencyDollarIcon,
    iconActive: CurrencyIconSolid,
  },
  {
    name: 'Analytics',
    href: '/admin/analytics',
    icon: ChartBarIcon,
    iconActive: ChartIconSolid,
  },
  {
    name: 'WABA Management',
    href: '/admin/waba',
    icon: ChatBubbleLeftRightIcon,
    iconActive: ChatIconSolid,
  },
  {
    name: 'System Health',
    href: '/admin/system',
    icon: ServerIcon,
    iconActive: ServerIconSolid,
  },
  {
    name: 'Audit Logs',
    href: '/admin/audit',
    icon: DocumentTextIcon,
    iconActive: DocumentIconSolid,
  },
  {
    name: 'Security',
    href: '/admin/security',
    icon: ShieldCheckIcon,
    iconActive: ShieldIconSolid,
  },
  {
    name: 'Settings',
    href: '/admin/settings',
    icon: Cog6ToothIcon,
    iconActive: CogIconSolid,
  },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={clsx(
      'bg-white border-r border-gray-200 flex flex-col transition-all duration-300',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center">
            <div className="h-8 w-8 bg-red-600 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="ml-3 text-lg font-semibold text-gray-900">Admin Panel</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Admin Info */}
      {!collapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-red-700">
                {user?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.full_name || 'Administrator'}
              </p>
              <div className="flex items-center mt-1">
                <div className="h-2 w-2 bg-green-400 rounded-full"></div>
                <p className="text-xs text-gray-500 ml-1">System Admin</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          const Icon = isActive ? item.iconActive : item.icon

          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'nav-item',
                isActive ? 'nav-item-active' : 'nav-item-inactive',
                collapsed ? 'justify-center' : 'justify-start'
              )}
              title={collapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && (
                <>
                  <span className="ml-3">{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto bg-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* System Status */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">System Status</span>
              <span className="text-green-600 font-medium">Healthy</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Active Agents</span>
              <span className="text-gray-900 font-medium">12/15</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Monthly Cost</span>
              <span className="text-gray-900 font-medium">$2,847</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
