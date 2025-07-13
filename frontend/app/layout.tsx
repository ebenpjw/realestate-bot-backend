import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'
import { cn } from '@/lib/utils'
import { PWAInstallPrompt, OfflineIndicator } from '@/components/ui/PWAInstallPrompt'

// Force dynamic rendering for all pages
export const dynamic = 'force-dynamic'

const fontSans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: {
    default: 'PropertyHub Command',
    template: '%s | PropertyHub Command',
  },
  description: 'Apple-inspired frontend for multi-tenant real estate bot system with AI-powered lead management',
  keywords: [
    'real estate',
    'property management',
    'AI bot',
    'lead generation',
    'WhatsApp automation',
    'CRM',
  ],
  authors: [
    {
      name: 'PropertyHub Team',
    },
  ],
  creator: 'PropertyHub Team',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://propertyhub-command.com',
    title: 'PropertyHub Command',
    description: 'Apple-inspired frontend for multi-tenant real estate bot system',
    siteName: 'PropertyHub Command',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PropertyHub Command',
    description: 'Apple-inspired frontend for multi-tenant real estate bot system',
    creator: '@propertyhub',
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
        <Providers>
          <OfflineIndicator />
          {children}
          <PWAInstallPrompt />
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
      </body>
    </html>
  )
}
