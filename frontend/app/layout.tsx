import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'
import { ErrorBoundary } from '@/components/error-boundary'
// Temporarily disable PWA components to fix deployment
// import { PWAInstallPrompt, OfflineIndicator } from '@/components/ui/PWAInstallPrompt'

// Force dynamic rendering to prevent Context issues during build
export const dynamic = 'force-dynamic'

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
})

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: {
    default: 'Outpaced',
    template: '%s | Outpaced',
  },
  description: 'Modern real estate bot management system with AI-powered lead management and multi-tenant WABA support',
  keywords: [
    'real estate',
    'property management',
    'AI bot',
    'lead generation',
    'WhatsApp automation',
    'CRM',
    'multi-tenant',
    'WABA',
  ],
  authors: [
    {
      name: 'Outpaced Team',
    },
  ],
  creator: 'Outpaced Team',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://outpaced.com',
    title: 'Outpaced',
    description: 'Modern real estate bot management system with AI-powered lead management',
    siteName: 'Outpaced',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Outpaced',
    description: 'Modern real estate bot management system with AI-powered lead management',
    creator: '@outpaced',
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#3b82f6' },
    { media: '(prefers-color-scheme: dark)', color: '#1e40af' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-background font-sans antialiased',
          fontSans.variable,
          fontMono.variable
        )}
      >
        <ErrorBoundary>
          <Providers>
            {/* Temporarily disabled PWA components */}
            {children}
            <Toaster
              position="top-right"
              expand={true}
              richColors
              closeButton
              toastOptions={{
                duration: 4000,
                classNames: {
                  toast: 'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
                  description: 'group-[.toast]:text-muted-foreground',
                  actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                  cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                },
              }}
            />
          </Providers>
        </ErrorBoundary>
      </body>
    </html>
  )
}
