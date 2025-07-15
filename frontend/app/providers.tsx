'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { AuthProvider } from '@/lib/auth/AuthContext'
import { SocketProvider } from '@/lib/socket/SocketContext'
import { WABAProvider } from '@/lib/contexts/WABAContext'
import { AgentProvider } from '@/lib/contexts/AgentContext'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { TooltipProvider } from '@radix-ui/react-tooltip'
import dynamic from 'next/dynamic'

// Create a client with modern React Query v5 configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
      retry: (failureCount, error: any) => {
        // Don't retry on 401/403 errors
        if (error?.status === 401 || error?.status === 403) {
          return false
        }
        return failureCount < 3
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
    },
  },
})

// Theme context for dark/light mode
interface ThemeContextType {
  theme: 'light' | 'dark'
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark')
    }
  }, [])

  useEffect(() => {
    if (!mounted) return
    localStorage.setItem('theme', theme)
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme, mounted])

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light')
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <div style={{ visibility: 'hidden' }}>{children}</div>
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Temporarily disable ReactQueryDevtools production import to fix deployment
// const ReactQueryDevtoolsProduction = dynamic(
//   () =>
//     import('@tanstack/react-query-devtools/build/modern/production.js').then(
//       (d) => ({
//         default: d.ReactQueryDevtools,
//       }),
//     ),
//   {
//     ssr: false,
//   },
// )

export function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <TooltipProvider delayDuration={300}>
          <AuthProvider>
            <AgentProvider>
              <WABAProvider>
                <SocketProvider>
                  {children}
                  {mounted && process.env.NODE_ENV === 'development' && (
                    <ReactQueryDevtools
                      initialIsOpen={false}
                      buttonPosition="bottom-left"
                      position="bottom"
                    />
                  )}
                </SocketProvider>
              </WABAProvider>
            </AgentProvider>
          </AuthProvider>
        </TooltipProvider>
      </NextThemesProvider>
    </QueryClientProvider>
  )
}
