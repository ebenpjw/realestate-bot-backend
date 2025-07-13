'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BeakerIcon,
  LinkIcon,
  BellIcon,
} from '@heroicons/react/24/outline'
import {
  HomeIcon as HomeIconSolid,
  ChatBubbleLeftRightIcon as ChatIconSolid,
  UserGroupIcon as UserGroupIconSolid,
  ChartBarIcon as ChartIconSolid,
  Cog6ToothIcon as CogIconSolid,
  BeakerIcon as BeakerIconSolid,
  LinkIcon as LinkIconSolid,
  BellIcon as BellIconSolid,
} from '@heroicons/react/24/solid'
import clsx from 'clsx'

const navigation = [
  {
    name: 'Dashboard',
    href: '/agent/dashboard',
    icon: HomeIcon,
    iconActive: HomeIconSolid,
  },
  {
    name: 'Conversations',
    href: '/agent/conversations',
    icon: ChatBubbleLeftRightIcon,
    iconActive: ChatIconSolid,
    badge: 3, // This would come from real-time data
  },
  {
    name: 'Leads',
    href: '/agent/leads',
    icon: UserGroupIcon,
    iconActive: UserGroupIconSolid,
  },
  {
    name: 'Analytics',
    href: '/agent/analytics',
    icon: ChartBarIcon,
    iconActive: ChartIconSolid,
  },
  {
    name: 'Testing',
    href: '/agent/testing',
    icon: BeakerIcon,
    iconActive: BeakerIconSolid,
  },
  {
    name: 'Integrations',
    href: '/agent/integrations',
    icon: LinkIcon,
    iconActive: LinkIconSolid,
  },
  {
    name: 'Settings',
    href: '/agent/settings',
    icon: Cog6ToothIcon,
    iconActive: CogIconSolid,
  },
]

export function AgentSidebar() {
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
            <div className="h-8 w-8 bg-primary-600 rounded-lg flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <span className="ml-3 text-lg font-semibold text-gray-900">PropertyHub</span>
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

      {/* User Info */}
      {!collapsed && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center">
            <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary-700">
                {user?.full_name?.charAt(0) || 'A'}
              </span>
            </div>
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.full_name || 'Agent'}
              </p>
              <div className="flex items-center mt-1">
                <div className="status-dot status-online"></div>
                <p className="text-xs text-gray-500">Online</p>
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
                    <span className="ml-auto bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Quick Actions */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200">
          <div className="space-y-2">
            <button className="w-full btn-primary text-sm py-2">
              New Test Conversation
            </button>
            <button className="w-full btn-secondary text-sm py-2">
              View All Leads
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
