'use client'

import { useState } from 'react'
import { usePWA } from '@/lib/hooks/usePWA'
import {
  XMarkIcon,
  DevicePhoneMobileIcon,
  ArrowDownTrayIcon,
  BellIcon,
  WifiIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface PWAInstallPromptProps {
  onDismiss?: () => void
}

export function PWAInstallPrompt({ onDismiss }: PWAInstallPromptProps) {
  const {
    isInstallable,
    isInstalled,
    isOffline,
    notificationPermission,
    installPWA,
    requestNotificationPermission,
    subscribeToPush
  } = usePWA()

  const [dismissed, setDismissed] = useState(false)
  const [currentStep, setCurrentStep] = useState<'install' | 'notifications' | 'complete'>('install')

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const handleInstall = async () => {
    await installPWA()
    setCurrentStep('notifications')
  }

  const handleEnableNotifications = async () => {
    const permission = await requestNotificationPermission()
    if (permission === 'granted') {
      await subscribeToPush()
    }
    setCurrentStep('complete')
  }

  const handleSkipNotifications = () => {
    setCurrentStep('complete')
  }

  if (dismissed || isInstalled || !isInstallable) {
    return null
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96">
      <Card className="p-6 shadow-lg border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-blue-50">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 rounded-lg">
              <DevicePhoneMobileIcon className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {currentStep === 'install' && 'Install PropertyHub'}
                {currentStep === 'notifications' && 'Enable Notifications'}
                {currentStep === 'complete' && 'Setup Complete!'}
              </h3>
              <p className="text-sm text-gray-600">
                {currentStep === 'install' && 'Get the full app experience'}
                {currentStep === 'notifications' && 'Stay updated with real-time alerts'}
                {currentStep === 'complete' && 'You\'re all set to go!'}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {currentStep === 'install' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 bg-white rounded-lg">
                <WifiIcon className="h-6 w-6 text-green-500 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Works Offline</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <BellIcon className="h-6 w-6 text-blue-500 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Push Notifications</p>
              </div>
              <div className="p-3 bg-white rounded-lg">
                <DevicePhoneMobileIcon className="h-6 w-6 text-purple-500 mx-auto mb-1" />
                <p className="text-xs text-gray-600">Native Feel</p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              <Button
                variant="default"
                onClick={handleInstall}
                className="flex-1"
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Install App
              </Button>
              <Button
                variant="outline"
                onClick={handleDismiss}
                className="px-4"
              >
                Later
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'notifications' && (
          <div className="space-y-4">
            <div className="p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex items-center space-x-3">
                <BellIcon className="h-8 w-8 text-blue-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Real-time Updates</h4>
                  <p className="text-sm text-gray-600">
                    Get notified about new leads, messages, and appointments instantly.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                variant="default"
                onClick={handleEnableNotifications}
                className="flex-1"
                disabled={notificationPermission === 'denied'}
              >
                <BellIcon className="h-4 w-4 mr-2" />
                Enable Notifications
              </Button>
              <Button
                variant="outline"
                onClick={handleSkipNotifications}
                className="px-4"
              >
                Skip
              </Button>
            </div>

            {notificationPermission === 'denied' && (
              <p className="text-xs text-red-600 text-center">
                Notifications are blocked. You can enable them in your browser settings.
              </p>
            )}
          </div>
        )}

        {currentStep === 'complete' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 className="font-medium text-gray-900 mb-2">You're all set!</h4>
              <p className="text-sm text-gray-600">
                PropertyHub is now installed and ready to use. Enjoy the enhanced experience!
              </p>
            </div>

            <Button
              variant="default"
              onClick={handleDismiss}
              className="w-full"
            >
              Get Started
            </Button>
          </div>
        )}

        {/* Offline indicator */}
        {isOffline && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className="h-2 w-2 bg-yellow-400 rounded-full"></div>
              <p className="text-sm text-yellow-800">
                You're currently offline. The app will sync when connection is restored.
              </p>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

// Offline indicator component
export function OfflineIndicator() {
  const { isOffline } = usePWA()

  if (!isOffline) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-white text-center py-2 text-sm font-medium">
      <div className="flex items-center justify-center space-x-2">
        <div className="h-2 w-2 bg-white rounded-full animate-pulse"></div>
        <span>You're offline - Some features may be limited</span>
      </div>
    </div>
  )
}

// PWA status component for settings
export function PWAStatus() {
  const {
    isInstalled,
    isOffline,
    notificationPermission,
    pushSubscription,
    requestNotificationPermission,
    subscribeToPush,
    unsubscribeFromPush
  } = usePWA()

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900">App Status</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Installation</p>
              <p className="text-sm text-gray-600">
                {isInstalled ? 'App is installed' : 'Running in browser'}
              </p>
            </div>
            <div className={`h-3 w-3 rounded-full ${
              isInstalled ? 'bg-green-400' : 'bg-gray-400'
            }`}></div>
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Connection</p>
              <p className="text-sm text-gray-600">
                {isOffline ? 'Offline' : 'Online'}
              </p>
            </div>
            <div className={`h-3 w-3 rounded-full ${
              isOffline ? 'bg-red-400' : 'bg-green-400'
            }`}></div>
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Notifications</p>
              <p className="text-sm text-gray-600">
                {notificationPermission === 'granted' ? 'Enabled' : 
                 notificationPermission === 'denied' ? 'Blocked' : 'Not set'}
              </p>
            </div>
            <div className={`h-3 w-3 rounded-full ${
              notificationPermission === 'granted' ? 'bg-green-400' : 
              notificationPermission === 'denied' ? 'bg-red-400' : 'bg-yellow-400'
            }`}></div>
          </div>
        </div>

        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">Push Notifications</p>
              <p className="text-sm text-gray-600">
                {pushSubscription ? 'Active' : 'Inactive'}
              </p>
            </div>
            <div className={`h-3 w-3 rounded-full ${
              pushSubscription ? 'bg-green-400' : 'bg-gray-400'
            }`}></div>
          </div>
        </div>
      </div>

      <div className="flex space-x-3">
        {notificationPermission !== 'granted' && (
          <Button
            variant="outline"
            onClick={requestNotificationPermission}
            size="sm"
          >
            Enable Notifications
          </Button>
        )}
        
        {notificationPermission === 'granted' && !pushSubscription && (
          <Button
            variant="outline"
            onClick={subscribeToPush}
            size="sm"
          >
            Enable Push Notifications
          </Button>
        )}
        
        {pushSubscription && (
          <Button
            variant="outline"
            onClick={unsubscribeFromPush}
            size="sm"
          >
            Disable Push Notifications
          </Button>
        )}
      </div>
    </div>
  )
}
