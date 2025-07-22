'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

// Force dynamic rendering to prevent Context issues during build
export const dynamic = 'force-dynamic'

export default function HomePage() {
  const { user, loading, isAuthenticated, isAgent, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        // Not authenticated, redirect to login
        router.push('/auth/login')
        return
      }

      // Authenticated, redirect based on role
      if (isAdmin) {
        router.push('/admin/dashboard')
      } else if (isAgent) {
        router.push('/agent/dashboard')
      } else {
        // Fallback to login if role is unclear
        router.push('/auth/login')
      }
    }
  }, [loading, isAuthenticated, isAgent, isAdmin, router])

  // Show loading spinner while checking authentication
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <LoadingSpinner size="lg" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Outpaced</h1>
          <p className="text-muted-foreground">Intelligent Real Estate Lead Management System</p>
        </div>
      </div>
    </div>
  )
}
