'use client'

import { lazy, Suspense, ComponentType, ReactNode, useState, useEffect, useRef } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface LazyLoadOptions {
  fallback?: ReactNode
  delay?: number
  retries?: number
}

// Enhanced lazy loading with error boundary and retry logic
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): ComponentType<React.ComponentProps<T>> {
  const {
    fallback = <LoadingSpinner size="lg" />,
    delay = 0,
    retries = 3
  } = options

  // Add retry logic to import function
  const importWithRetry = async (): Promise<{ default: T }> => {
    let lastError: Error | null = null
    
    for (let i = 0; i <= retries; i++) {
      try {
        if (delay > 0 && i === 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        
        return await importFn()
      } catch (error) {
        lastError = error as Error
        
        if (i < retries) {
          // Exponential backoff
          const backoffDelay = Math.pow(2, i) * 1000
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
        }
      }
    }
    
    throw lastError
  }

  const LazyComponent = lazy(importWithRetry)

  return function LazyWrapper(props: React.ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <LazyComponent {...props} />
      </Suspense>
    )
  }
}

// Preload a lazy component
export function preloadComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): Promise<{ default: T }> {
  return importFn()
}

// Lazy load with intersection observer (for viewport-based loading)
export function createIntersectionLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyLoadOptions & { rootMargin?: string; threshold?: number } = {}
): ComponentType<React.ComponentProps<T> & { className?: string }> {
  const {
    fallback = <LoadingSpinner size="lg" />,
    rootMargin = '50px',
    threshold = 0.1,
    ...lazyOptions
  } = options

  return function IntersectionLazyWrapper(
    props: React.ComponentProps<T> & { className?: string }
  ) {
    const [isVisible, setIsVisible] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !hasLoaded) {
            setIsVisible(true)
            setHasLoaded(true)
            observer.disconnect()
          }
        },
        { rootMargin, threshold }
      )

      if (ref.current) {
        observer.observe(ref.current)
      }

      return () => observer.disconnect()
    }, [hasLoaded, rootMargin, threshold])

    if (!isVisible) {
      return (
        <div ref={ref} className={props.className}>
          {fallback}
        </div>
      )
    }

    const LazyComponent = createLazyComponent(importFn, lazyOptions)
    return <LazyComponent {...props} />
  }
}

// Route-based code splitting helper
export const LazyRoutes = {
  // Agent routes
  AgentDashboard: createLazyComponent(
    () => import('@/app/agent/dashboard/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
  AgentConversations: createLazyComponent(
    () => import('@/app/agent/conversations/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
  AgentLeads: createLazyComponent(
    () => import('@/app/agent/leads/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
  AgentAnalytics: createLazyComponent(
    () => import('@/app/agent/analytics/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
  AgentTesting: createLazyComponent(
    () => import('@/app/agent/testing/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
  AgentIntegrations: createLazyComponent(
    () => import('@/app/agent/integrations/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
  AgentSettings: createLazyComponent(
    () => import('@/app/agent/settings/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),

  // Admin routes
  AdminDashboard: createLazyComponent(
    () => import('@/app/admin/dashboard/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
  AdminAgents: createLazyComponent(
    () => import('@/app/admin/agents/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
  AdminCosts: createLazyComponent(
    () => import('@/app/admin/costs/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
  AdminWABA: createLazyComponent(
    () => import('@/app/admin/waba/page'),
    { fallback: <LoadingSpinner size="lg" /> }
  ),
}

// Component-based lazy loading - TEMPORARILY DISABLED
// Causing chunk generation issues with missing components
export const LazyComponents = {
  // Charts (heavy components) - commented out to fix chunk issues
  // ConversionChart: createLazyComponent(
  //   () => import('@/components/agent/ConversionChart'),
  //   { fallback: <div className="h-64 bg-gray-100 rounded-lg animate-pulse" /> }
  // ),
  // LeadSourceChart: createLazyComponent(
  //   () => import('@/components/agent/LeadSourceChart'),
  //   { fallback: <div className="h-64 bg-gray-100 rounded-lg animate-pulse" /> }
  // ),
  // ResponseTimeChart: createLazyComponent(
  //   () => import('@/components/agent/ResponseTimeChart'),
  //   { fallback: <div className="h-64 bg-gray-100 rounded-lg animate-pulse" /> }
  // ),

  // Heavy UI components - commented out to fix chunk issues
  // RichTextEditor: createLazyComponent(
  //   () => import('@/components/ui/RichTextEditor'),
  //   { fallback: <div className="h-32 bg-gray-100 rounded-lg animate-pulse" /> }
  // ),
  // DataTable: createLazyComponent(
  //   () => import('@/components/ui/DataTable'),
  //   { fallback: <div className="h-96 bg-gray-100 rounded-lg animate-pulse" /> }
  // ),
  // Calendar: createLazyComponent(
  //   () => import('@/components/ui/Calendar'),
  //   { fallback: <div className="h-80 bg-gray-100 rounded-lg animate-pulse" /> }
  // ),
}

// Preload critical routes
export function preloadCriticalRoutes() {
  if (typeof window !== 'undefined') {
    // Preload dashboard routes
    preloadComponent(() => import('@/app/agent/dashboard/page'))
    preloadComponent(() => import('@/app/admin/dashboard/page'))
    
    // Preload common components
    preloadComponent(() => import('@/components/agent/ConversionChart'))
  }
}

// Dynamic import with error handling
export async function dynamicImport<T>(
  importFn: () => Promise<T>,
  retries = 3
): Promise<T> {
  let lastError: Error | null = null
  
  for (let i = 0; i <= retries; i++) {
    try {
      return await importFn()
    } catch (error) {
      lastError = error as Error
      
      if (i < retries) {
        // Exponential backoff
        const delay = Math.pow(2, i) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError
}
