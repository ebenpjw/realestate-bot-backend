'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useGoogleIntegration } from '@/lib/hooks/useIntegrations'
import { toast } from 'sonner'
import {
  User,
  Bell,
  Shield,
  MessageSquare,
  Clock,
  Globe,
  Smartphone,
  Key,
  Settings as SettingsIcon,
  Calendar,
  Save,
  CheckCircle,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PWAStatus } from '@/components/ui/PWAInstallPrompt'

interface SettingsSection {
  id: string
  title: string
  description: string
  icon: React.ComponentType<any>
}

const settingsSections: SettingsSection[] = [
  {
    id: 'profile',
    title: 'Profile Settings',
    description: 'Manage your personal information and preferences',
    icon: User
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: 'Configure how and when you receive notifications',
    icon: Bell
  },
  {
    id: 'security',
    title: 'Security & Privacy',
    description: 'Manage your account security and privacy settings',
    icon: Shield
  },
  {
    id: 'bot',
    title: 'Bot Configuration',
    description: 'Customize your AI assistant behavior and responses',
    icon: MessageSquare
  },
  {
    id: 'availability',
    title: 'Availability',
    description: 'Set your working hours and availability preferences',
    icon: Clock
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect Google Calendar, Zoom, and other services',
    icon: Globe
  },
  {
    id: 'app',
    title: 'App Settings',
    description: 'Manage PWA features, offline mode, and app preferences',
    icon: Smartphone
  }
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [activeSection, setActiveSection] = useState('profile')

  // Use React Query hook for Google Calendar integration status
  const { data: googleIntegration, isLoading: googleLoading, refetch: refetchGoogle } = useGoogleIntegration(user?.id)
  const [formData, setFormData] = useState({
    fullName: user?.full_name || 'Agent',
    email: user?.email || '',
    phone: '+65 9123 4567',
    timezone: 'Asia/Singapore',
    language: 'en',
    notifications: {
      email: true,
      push: true,
      sms: false,
      newLeads: true,
      appointments: true,
      systemUpdates: false
    },
    availability: {
      monday: { enabled: true, start: '09:00', end: '18:00' },
      tuesday: { enabled: true, start: '09:00', end: '18:00' },
      wednesday: { enabled: true, start: '09:00', end: '18:00' },
      thursday: { enabled: true, start: '09:00', end: '18:00' },
      friday: { enabled: true, start: '09:00', end: '18:00' },
      saturday: { enabled: false, start: '10:00', end: '16:00' },
      sunday: { enabled: false, start: '10:00', end: '16:00' }
    },
    botSettings: {
      responseStyle: 'professional',
      aggressiveness: 'medium',
      followUpEnabled: true,
      autoScheduling: true
    }
  })

  const handleSave = async () => {
    setLoading(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setLoading(false)
  }

  // Integration handlers
  const handleGoogleConnect = async () => {
    if (!user?.id) {
      toast.error('User not authenticated')
      return
    }

    try {
      // Directly open the Google OAuth URL since the endpoint returns a redirect
      const authUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'}/api/auth/google?agentId=${user.id}`
      const authWindow = window.open(authUrl, 'google-auth', 'width=500,height=600,scrollbars=yes,resizable=yes')

      if (!authWindow) {
        toast.error('Popup blocked', {
          description: 'Please allow popups for this site and try again'
        })
        return
      }

      toast.success('Google Calendar authentication initiated', {
        description: 'Complete the authentication in the popup window'
      })

      // Listen for messages from the OAuth popup
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
          toast.success('Google Calendar connected successfully!')
          refetchGoogle() // Refresh the integration status
          window.removeEventListener('message', handleMessage)
        } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
          toast.error('Google Calendar authentication failed', {
            description: event.data.error || 'Please try again'
          })
          window.removeEventListener('message', handleMessage)
        }
      }

      window.addEventListener('message', handleMessage)

      // Fallback: Listen for the popup to close and refresh integration status
      const checkClosed = setInterval(() => {
        if (authWindow.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)

          // Refresh status after popup closes (in case message wasn't received)
          setTimeout(() => {
            refetchGoogle()
          }, 1000)

          toast.info('Authentication window closed', {
            description: 'Checking connection status...'
          })
        }
      }, 1000)

    } catch (error) {
      console.error('Google auth error:', error)
      toast.error('Failed to initiate Google Calendar authentication')
    }
  }



  const renderProfileSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.timezone}
              onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
            >
              <option value="Asia/Singapore">Singapore (GMT+8)</option>
              <option value="Asia/Kuala_Lumpur">Kuala Lumpur (GMT+8)</option>
              <option value="Asia/Bangkok">Bangkok (GMT+7)</option>
              <option value="Asia/Jakarta">Jakarta (GMT+7)</option>
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Profile Picture</h3>
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-xl font-medium text-primary">
              {formData.fullName.charAt(0)}
            </span>
          </div>
          <div>
            <Button variant="outline" size="sm">
              Change Photo
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              JPG, PNG or GIF. Max size 2MB.
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
        <div className="space-y-4">
          {Object.entries(formData.notifications).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </label>
                <p className="text-xs text-gray-500">
                  {key === 'email' && 'Receive notifications via email'}
                  {key === 'push' && 'Browser and mobile push notifications'}
                  {key === 'sms' && 'SMS notifications for urgent matters'}
                  {key === 'newLeads' && 'Notify when new leads are received'}
                  {key === 'appointments' && 'Appointment reminders and updates'}
                  {key === 'systemUpdates' && 'System maintenance and updates'}
                </p>
              </div>
              <Switch
                checked={value}
                onCheckedChange={(checked) => setFormData(prev => ({
                  ...prev,
                  notifications: { ...prev.notifications, [key]: checked }
                }))}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Password & Authentication</h3>
        <div className="space-y-4">
          <Button variant="outline" className="w-full justify-start">
            <Key className="h-4 w-4 mr-2" />
            Change Password
          </Button>
          <Button variant="outline" className="w-full justify-start">
            <Smartphone className="h-4 w-4 mr-2" />
            Enable Two-Factor Authentication
          </Button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Active Sessions</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900">Current Session</p>
              <p className="text-xs text-gray-500">Chrome on Windows • Singapore</p>
            </div>
            <span className="text-xs text-green-600 font-medium">Active</span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return renderProfileSettings()
      case 'notifications':
        return renderNotificationSettings()
      case 'security':
        return renderSecuritySettings()
      case 'app':
        return <PWAStatus />
      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Settings section coming soon...</p>
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>
        <Button onClick={handleSave} disabled={loading}>
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger value="bot" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Bot
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Availability
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Settings</CardTitle>
              <CardDescription>
                Manage your personal information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderProfileSettings()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Card>
            <CardHeader>
              <CardTitle>Integrations</CardTitle>
              <CardDescription>
                Connect your Google Calendar for seamless appointment booking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-8 w-8 text-blue-600" />
                        <div>
                          <h3 className="font-medium">Google Calendar</h3>
                          <p className="text-sm text-muted-foreground">Sync appointments and availability</p>
                          {googleIntegration?.status === 'connected' && googleIntegration?.email && (
                            <div className="flex items-center gap-1 mt-1">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              <span className="text-xs text-green-600">{googleIntegration.email}</span>
                            </div>
                          )}
                          {googleIntegration?.status === 'error' && googleIntegration?.errorMessage && (
                            <div className="flex items-center gap-1 mt-1">
                              <ExternalLink className="h-3 w-3 text-red-600" />
                              <span className="text-xs text-red-600">Connection error</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={handleGoogleConnect}
                        disabled={googleLoading}
                      >
                        {googleLoading ? (
                          <>
                            <LoadingSpinner size="sm" className="mr-2" />
                            Loading...
                          </>
                        ) : googleIntegration?.status === 'connected' ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                            Connected
                          </>
                        ) : (
                          <>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Connect
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Other tabs would have similar structure */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Configure how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground">Notification settings coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security & Privacy</CardTitle>
              <CardDescription>
                Manage your account security and privacy settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground">Security settings coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bot">
          <Card>
            <CardHeader>
              <CardTitle>Bot Configuration</CardTitle>
              <CardDescription>
                Customize your AI assistant behavior and responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground">Bot settings coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="availability">
          <Card>
            <CardHeader>
              <CardTitle>Availability Settings</CardTitle>
              <CardDescription>
                Set your working hours and availability preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground">Availability settings coming soon...</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
