'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'

interface PWAInstallPrompt {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface PWAState {
  isInstallable: boolean
  isInstalled: boolean
  isOffline: boolean
  isUpdateAvailable: boolean
  notificationPermission: NotificationPermission
  pushSubscription: PushSubscription | null
}

export function usePWA() {
  const [pwaState, setPWAState] = useState<PWAState>({
    isInstallable: false,
    isInstalled: false,
    isOffline: false,
    isUpdateAvailable: false,
    notificationPermission: 'default',
    pushSubscription: null
  })

  const [installPrompt, setInstallPrompt] = useState<PWAInstallPrompt | null>(null)
  const [serviceWorkerRegistration, setServiceWorkerRegistration] = useState<ServiceWorkerRegistration | null>(null)

  // Register service worker
  const registerServiceWorker = useCallback(async () => {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        })

        setServiceWorkerRegistration(registration)

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setPWAState(prev => ({ ...prev, isUpdateAvailable: true }))
                toast.info('App Update Available', {
                  description: 'A new version is ready. Refresh to update.',
                  action: {
                    label: 'Refresh',
                    onClick: () => window.location.reload()
                  }
                })
              }
            })
          }
        })

        console.log('Service Worker registered successfully')
        return registration
      } catch (error) {
        console.error('Service Worker registration failed:', error)
        return null
      }
    }
    return null
  }, [])

  // Install PWA
  const installPWA = useCallback(async () => {
    if (installPrompt) {
      try {
        await installPrompt.prompt()
        const choiceResult = await installPrompt.userChoice
        
        if (choiceResult.outcome === 'accepted') {
          setPWAState(prev => ({ ...prev, isInstalled: true, isInstallable: false }))
          setInstallPrompt(null)
          toast.success('App Installed', {
            description: 'PropertyHub has been added to your home screen!'
          })
        }
      } catch (error) {
        console.error('PWA installation failed:', error)
        toast.error('Installation Failed', {
          description: 'Unable to install the app. Please try again.'
        })
      }
    }
  }, [installPrompt])

  // Request notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      try {
        const permission = await Notification.requestPermission()
        setPWAState(prev => ({ ...prev, notificationPermission: permission }))
        
        if (permission === 'granted') {
          toast.success('Notifications Enabled', {
            description: 'You will now receive push notifications.'
          })
        } else {
          toast.error('Notifications Denied', {
            description: 'You can enable notifications in your browser settings.'
          })
        }
        
        return permission
      } catch (error) {
        console.error('Notification permission request failed:', error)
        return 'denied'
      }
    }
    return 'denied'
  }, [])

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async () => {
    if (!serviceWorkerRegistration) {
      console.error('Service Worker not registered')
      return null
    }

    try {
      const subscription = await serviceWorkerRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      })

      setPWAState(prev => ({ ...prev, pushSubscription: subscription }))
      
      // Send subscription to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(subscription)
      })

      toast.success('Push Notifications Enabled', {
        description: 'You will receive real-time updates.'
      })

      return subscription
    } catch (error) {
      console.error('Push subscription failed:', error)
      toast.error('Push Notifications Failed', {
        description: 'Unable to enable push notifications.'
      })
      return null
    }
  }, [serviceWorkerRegistration])

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async () => {
    if (pwaState.pushSubscription) {
      try {
        await pwaState.pushSubscription.unsubscribe()
        setPWAState(prev => ({ ...prev, pushSubscription: null }))
        
        // Notify server
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })

        toast.success('Push Notifications Disabled')
      } catch (error) {
        console.error('Push unsubscription failed:', error)
      }
    }
  }, [pwaState.pushSubscription])

  // Check if app is running in standalone mode (installed)
  const checkIfInstalled = useCallback(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                        (window.navigator as any).standalone ||
                        document.referrer.includes('android-app://')
    
    setPWAState(prev => ({ ...prev, isInstalled: isStandalone }))
  }, [])

  // Initialize PWA features
  useEffect(() => {
    // Register service worker
    registerServiceWorker()

    // Check if installed
    checkIfInstalled()

    // Check initial notification permission
    if ('Notification' in window) {
      setPWAState(prev => ({ 
        ...prev, 
        notificationPermission: Notification.permission 
      }))
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as any)
      setPWAState(prev => ({ ...prev, isInstallable: true }))
    }

    // Listen for app installed
    const handleAppInstalled = () => {
      setPWAState(prev => ({ ...prev, isInstalled: true, isInstallable: false }))
      setInstallPrompt(null)
      toast.success('App Installed Successfully!')
    }

    // Listen for online/offline status
    const handleOnline = () => {
      setPWAState(prev => ({ ...prev, isOffline: false }))
      toast.success('Back Online', {
        description: 'Connection restored. Syncing data...'
      })
    }

    const handleOffline = () => {
      setPWAState(prev => ({ ...prev, isOffline: true }))
      toast.warning('You\'re Offline', {
        description: 'Some features may be limited.'
      })
    }

    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Set initial offline state
    setPWAState(prev => ({ ...prev, isOffline: !navigator.onLine }))

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [registerServiceWorker, checkIfInstalled])

  // Get push subscription on service worker registration
  useEffect(() => {
    if (serviceWorkerRegistration) {
      serviceWorkerRegistration.pushManager.getSubscription()
        .then(subscription => {
          setPWAState(prev => ({ ...prev, pushSubscription: subscription }))
        })
        .catch(console.error)
    }
  }, [serviceWorkerRegistration])

  return {
    ...pwaState,
    installPWA,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush,
    serviceWorkerRegistration
  }
}
