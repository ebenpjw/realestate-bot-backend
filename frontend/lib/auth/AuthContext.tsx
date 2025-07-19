'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { authApi } from './authApi'
import { toast } from 'sonner'

export interface User {
  id: string
  email: string
  full_name: string
  role: 'agent' | 'admin'
  organization_id?: string
  status: 'active' | 'inactive' | 'busy'
  avatar_url?: string
  waba_phone_number?: string
  permissions: string[]
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  isAuthenticated: boolean
  hasPermission: (permission: string) => boolean
  isAgent: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [tokenRefreshTimer, setTokenRefreshTimer] = useState<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // Check for existing session on mount
  useEffect(() => {
    checkAuthStatus()
  }, [])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer)
      }
    }
  }, [tokenRefreshTimer])

  const checkAuthStatus = async () => {
    try {
      // Check if we're on the client side
      if (typeof window === 'undefined') {
        setLoading(false)
        return
      }

      const token = localStorage.getItem('auth_token')
      if (!token) {
        setLoading(false)
        return
      }

      // Check if token is expired
      if (isTokenExpired(token)) {
        try {
          await refreshToken()
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          await logout()
          return
        }
      }

      const userData = await authApi.getCurrentUser()
      setUser(userData)
      setupTokenRefresh(token)
    } catch (error) {
      console.error('Auth check failed:', error)
      localStorage.removeItem('auth_token')
    } finally {
      setLoading(false)
    }
  }

  const isTokenExpired = (token: string): boolean => {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return true
      const payload = JSON.parse(atob(parts[1]))
      const currentTime = Date.now() / 1000
      // Check if token expires within 5 minutes
      return payload.exp < (currentTime + 300)
    } catch {
      return true
    }
  }

  const setupTokenRefresh = (token: string) => {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return
      const payload = JSON.parse(atob(parts[1]))
      const currentTime = Date.now() / 1000
      const timeUntilRefresh = (payload.exp - currentTime - 300) * 1000 // Refresh 5 minutes before expiry

      if (timeUntilRefresh > 0) {
        if (tokenRefreshTimer) {
          clearTimeout(tokenRefreshTimer)
        }

        const timer = setTimeout(async () => {
          try {
            await refreshToken()
          } catch (error) {
            console.error('Automatic token refresh failed:', error)
            await logout()
          }
        }, timeUntilRefresh)

        setTokenRefreshTimer(timer)
      }
    } catch (error) {
      console.error('Failed to setup token refresh:', error)
    }
  }

  const refreshToken = async () => {
    try {
      const response = await authApi.refreshToken()
      localStorage.setItem('auth_token', response.token)
      setUser(response.user)
      setupTokenRefresh(response.token)
      return response.token
    } catch (error) {
      throw error
    }
  }

  const login = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true)
      const response = await authApi.login(email, password)

      localStorage.setItem('auth_token', response.token)
      setUser(response.user)
      setupTokenRefresh(response.token)

      toast.success('Welcome back!', {
        description: `Logged in as ${response.user.full_name}`,
      })

      // Redirect based on role
      if (response.user.role === 'admin') {
        router.push('/admin/dashboard')
      } else {
        router.push('/agent/dashboard')
      }
    } catch (error: any) {
      toast.error('Login failed', {
        description: error.message || 'Please check your credentials and try again',
      })
      throw error
    } finally {
      setLoading(false)
    }
  }, [router])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear token refresh timer
      if (tokenRefreshTimer) {
        clearTimeout(tokenRefreshTimer)
        setTokenRefreshTimer(null)
      }

      localStorage.removeItem('auth_token')
      setUser(null)
      router.push('/auth/login')
      toast.success('Logged out successfully', {
        description: 'You have been securely logged out',
      })
    }
  }, [router, tokenRefreshTimer])

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.getCurrentUser()
      setUser(userData)
    } catch (error) {
      console.error('Failed to refresh user:', error)
      logout()
    }
  }, [logout])

  const hasPermission = useCallback((permission: string): boolean => {
    if (!user) return false
    return user.permissions.includes(permission) || user.role === 'admin'
  }, [user])

  const value: AuthContextType = useMemo(() => ({
    user,
    loading,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user,
    hasPermission,
    isAgent: user?.role === 'agent',
    isAdmin: user?.role === 'admin',
  }), [user, loading, login, logout, refreshUser, hasPermission])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
