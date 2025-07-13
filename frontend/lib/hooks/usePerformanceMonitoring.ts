'use client'

import { useEffect, useState, useCallback } from 'react'

interface PerformanceMetrics {
  // Core Web Vitals
  fcp: number | null // First Contentful Paint
  lcp: number | null // Largest Contentful Paint
  fid: number | null // First Input Delay
  cls: number | null // Cumulative Layout Shift
  ttfb: number | null // Time to First Byte
  
  // Custom metrics
  pageLoadTime: number | null
  domContentLoaded: number | null
  memoryUsage: number | null
  connectionType: string | null
  
  // Performance scores
  performanceScore: number | null
  recommendations: string[]
}

interface PerformanceEntry {
  name: string
  startTime: number
  duration: number
  entryType: string
}

export function usePerformanceMonitoring() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fcp: null,
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    pageLoadTime: null,
    domContentLoaded: null,
    memoryUsage: null,
    connectionType: null,
    performanceScore: null,
    recommendations: [],
  })

  const [isSupported, setIsSupported] = useState(false)

  // Check if Performance API is supported
  useEffect(() => {
    setIsSupported(
      typeof window !== 'undefined' &&
      'performance' in window &&
      'PerformanceObserver' in window
    )
  }, [])

  // Measure Core Web Vitals
  const measureCoreWebVitals = useCallback(() => {
    if (!isSupported) return

    // First Contentful Paint
    const fcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint')
      if (fcpEntry) {
        setMetrics(prev => ({ ...prev, fcp: fcpEntry.startTime }))
      }
    })
    fcpObserver.observe({ entryTypes: ['paint'] })

    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const lastEntry = entries[entries.length - 1]
      if (lastEntry) {
        setMetrics(prev => ({ ...prev, lcp: lastEntry.startTime }))
      }
    })
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

    // First Input Delay
    const fidObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const fidEntry = entries[0]
      if (fidEntry) {
        setMetrics(prev => ({ 
          ...prev, 
          fid: fidEntry.processingStart - fidEntry.startTime 
        }))
      }
    })
    fidObserver.observe({ entryTypes: ['first-input'] })

    // Cumulative Layout Shift
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
        }
      }
      setMetrics(prev => ({ ...prev, cls: clsValue }))
    })
    clsObserver.observe({ entryTypes: ['layout-shift'] })

    // Cleanup observers
    return () => {
      fcpObserver.disconnect()
      lcpObserver.disconnect()
      fidObserver.disconnect()
      clsObserver.disconnect()
    }
  }, [isSupported])

  // Measure navigation timing
  const measureNavigationTiming = useCallback(() => {
    if (!isSupported) return

    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    if (navigation) {
      setMetrics(prev => ({
        ...prev,
        ttfb: navigation.responseStart - navigation.requestStart,
        pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      }))
    }
  }, [isSupported])

  // Measure memory usage
  const measureMemoryUsage = useCallback(() => {
    if (!isSupported || !(performance as any).memory) return

    const memory = (performance as any).memory
    setMetrics(prev => ({
      ...prev,
      memoryUsage: memory.usedJSHeapSize / 1024 / 1024, // Convert to MB
    }))
  }, [isSupported])

  // Get connection information
  const getConnectionInfo = useCallback(() => {
    if (typeof navigator !== 'undefined' && (navigator as any).connection) {
      const connection = (navigator as any).connection
      setMetrics(prev => ({
        ...prev,
        connectionType: connection.effectiveType || connection.type || 'unknown',
      }))
    }
  }, [])

  // Calculate performance score
  const calculatePerformanceScore = useCallback((metrics: PerformanceMetrics) => {
    let score = 100
    const recommendations: string[] = []

    // FCP scoring (0-2.5s good, 2.5-4s needs improvement, >4s poor)
    if (metrics.fcp !== null) {
      if (metrics.fcp > 4000) {
        score -= 20
        recommendations.push('Optimize First Contentful Paint (currently > 4s)')
      } else if (metrics.fcp > 2500) {
        score -= 10
        recommendations.push('Improve First Contentful Paint (currently > 2.5s)')
      }
    }

    // LCP scoring (0-2.5s good, 2.5-4s needs improvement, >4s poor)
    if (metrics.lcp !== null) {
      if (metrics.lcp > 4000) {
        score -= 25
        recommendations.push('Optimize Largest Contentful Paint (currently > 4s)')
      } else if (metrics.lcp > 2500) {
        score -= 15
        recommendations.push('Improve Largest Contentful Paint (currently > 2.5s)')
      }
    }

    // FID scoring (0-100ms good, 100-300ms needs improvement, >300ms poor)
    if (metrics.fid !== null) {
      if (metrics.fid > 300) {
        score -= 20
        recommendations.push('Optimize First Input Delay (currently > 300ms)')
      } else if (metrics.fid > 100) {
        score -= 10
        recommendations.push('Improve First Input Delay (currently > 100ms)')
      }
    }

    // CLS scoring (0-0.1 good, 0.1-0.25 needs improvement, >0.25 poor)
    if (metrics.cls !== null) {
      if (metrics.cls > 0.25) {
        score -= 20
        recommendations.push('Reduce Cumulative Layout Shift (currently > 0.25)')
      } else if (metrics.cls > 0.1) {
        score -= 10
        recommendations.push('Improve Cumulative Layout Shift (currently > 0.1)')
      }
    }

    // Memory usage scoring
    if (metrics.memoryUsage !== null && metrics.memoryUsage > 50) {
      score -= 10
      recommendations.push('High memory usage detected (> 50MB)')
    }

    return {
      score: Math.max(0, score),
      recommendations,
    }
  }, [])

  // Send metrics to analytics
  const sendMetricsToAnalytics = useCallback((metrics: PerformanceMetrics) => {
    // Only send in production
    if (process.env.NODE_ENV !== 'production') return

    // Send to your analytics service
    try {
      fetch('/api/analytics/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metrics,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: Date.now(),
        }),
      }).catch(console.error)
    } catch (error) {
      console.error('Failed to send performance metrics:', error)
    }
  }, [])

  // Initialize performance monitoring
  useEffect(() => {
    if (!isSupported) return

    const cleanup = measureCoreWebVitals()
    
    // Measure other metrics after page load
    if (document.readyState === 'complete') {
      measureNavigationTiming()
      measureMemoryUsage()
      getConnectionInfo()
    } else {
      window.addEventListener('load', () => {
        measureNavigationTiming()
        measureMemoryUsage()
        getConnectionInfo()
      })
    }

    return cleanup
  }, [isSupported, measureCoreWebVitals, measureNavigationTiming, measureMemoryUsage, getConnectionInfo])

  // Calculate score when metrics change
  useEffect(() => {
    const { score, recommendations } = calculatePerformanceScore(metrics)
    setMetrics(prev => ({
      ...prev,
      performanceScore: score,
      recommendations,
    }))

    // Send metrics to analytics if we have core metrics
    if (metrics.fcp && metrics.lcp) {
      sendMetricsToAnalytics(metrics)
    }
  }, [metrics.fcp, metrics.lcp, metrics.fid, metrics.cls, calculatePerformanceScore, sendMetricsToAnalytics])

  // Manual performance measurement
  const measurePerformance = useCallback(() => {
    measureNavigationTiming()
    measureMemoryUsage()
    getConnectionInfo()
  }, [measureNavigationTiming, measureMemoryUsage, getConnectionInfo])

  return {
    metrics,
    isSupported,
    measurePerformance,
  }
}
