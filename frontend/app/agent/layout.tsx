'use client'

import { useAuth } from '@/lib/auth/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { AgentSidebar } from '@/components/agent/AgentSidebar'
import { AgentHeader } from '@/components/agent/AgentHeader'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, isAuthenticated, isAgent } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/auth/login')
        return
      }
      
      if (!isAgent) {
        router.push('/admin/dashboard')
        return
      }
    }
  }, [loading, isAuthenticated, isAgent, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated || !isAgent) {
    return null
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <AgentSidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <AgentHeader />
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
