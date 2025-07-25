'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useSocket } from '@/lib/socket/SocketContext'
import { useRealTimeNotifications } from '@/lib/hooks/useRealTimeNotifications'
import { useTheme } from 'next-themes'
import {
  BellIcon,
  MagnifyingGlassIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import clsx from 'clsx'
import { RealTimeStatus } from '@/components/ui/RealTimeStatus'

export function AgentHeader() {
  const { user, logout } = useAuth()
  const { connected } = useSocket()
  const { notifications, unreadCount, markAsRead } = useRealTimeNotifications()
  const { theme, setTheme } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Implement search functionality
    console.log('Search:', searchQuery)
  }

  return (
    <header className="bg-background/95 backdrop-blur-sm border-b border-border/50 px-6 py-4 sticky top-0 z-30">
      <div className="flex items-center justify-between">
        {/* Left side - Search */}
        <div className="flex-1 max-w-lg">
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors duration-200" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-4 py-2.5 border border-input rounded-xl leading-5 bg-background/50 placeholder-muted-foreground focus:outline-none focus:placeholder-muted-foreground/70 focus:ring-2 focus:ring-ring focus:border-primary focus:bg-background sm:text-sm transition-all duration-200 hover:bg-background/80"
              placeholder="Search leads, conversations, properties..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors duration-200 rounded-full hover:bg-muted p-0.5"
                >
                  ×
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-3">
          {/* Connection Status */}
          <div className="hidden sm:block">
            <RealTimeStatus size="sm" />
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl hover:bg-accent transition-all duration-200 micro-bounce"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <SunIcon className="h-5 w-5" />
            ) : (
              <MoonIcon className="h-5 w-5" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-xl hover:bg-accent transition-all duration-200 micro-bounce"
            >
              <BellIcon className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium animate-pulse-gentle">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length > 0 ? (
                    notifications.slice(0, 10).map((notification) => {
                      const getIcon = () => {
                        switch (notification.type) {
                          case 'success':
                            return <CheckCircleIcon className="h-5 w-5 text-green-500" />
                          case 'error':
                            return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                          case 'warning':
                            return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />
                          default:
                            return <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                        }
                      }

                      return (
                        <div
                          key={notification.id}
                          className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                            !notification.read ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => markAsRead(notification.id)}
                        >
                          <div className="flex items-start space-x-3">
                            {getIcon()}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {notification.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                {notification.timestamp.toLocaleTimeString()}
                              </p>
                            </div>
                            {!notification.read && (
                              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <div className="p-4 text-center text-gray-500">
                      No notifications
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          <Menu as="div" className="relative">
            <Menu.Button className="flex items-center text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-accent transition-all duration-200 p-2 group">
              <div className="h-9 w-9 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-200 micro-bounce">
                <span className="text-sm font-semibold text-primary-foreground">
                  {user?.full_name?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="ml-3 text-left hidden sm:block">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors duration-200">
                  {user?.full_name || 'Agent'}
                </p>
                <p className="text-xs text-muted-foreground font-medium">
                  {user?.email}
                </p>
              </div>
            </Menu.Button>

            <Transition
              as={Fragment}
              enter="transition ease-out duration-100"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-75"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <Menu.Item>
                  {({ active }) => (
                    <a
                      href="/agent/settings"
                      className={clsx(
                        active ? 'bg-gray-100' : '',
                        'flex items-center px-4 py-2 text-sm text-gray-700'
                      )}
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-3" />
                      Settings
                    </a>
                  )}
                </Menu.Item>
                <Menu.Item>
                  {({ active }) => (
                    <button
                      onClick={logout}
                      className={clsx(
                        active ? 'bg-gray-100' : '',
                        'flex items-center w-full px-4 py-2 text-sm text-gray-700'
                      )}
                    >
                      <ArrowRightOnRectangleIcon className="h-4 w-4 mr-3" />
                      Sign out
                    </button>
                  )}
                </Menu.Item>
              </Menu.Items>
            </Transition>
          </Menu>
        </div>
      </div>
    </header>
  )
}
