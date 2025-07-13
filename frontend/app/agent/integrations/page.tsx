'use client'

import { useState } from 'react'
import { 
  LinkIcon, 
  CheckCircleIcon, 
  ExclamationTriangleIcon,
  Cog6ToothIcon,
  QrCodeIcon,
  PhoneIcon,
  CalendarIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface Integration {
  id: string
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'error' | 'pending'
  icon: React.ComponentType<any>
  lastSync?: string
  config?: Record<string, any>
}

const integrations: Integration[] = [
  {
    id: 'whatsapp',
    name: 'WhatsApp Business API',
    description: 'Connect your WhatsApp Business Account for automated messaging',
    status: 'connected',
    icon: ChatBubbleLeftRightIcon,
    lastSync: '2 minutes ago',
    config: {
      phoneNumber: '+65 9123 4567',
      businessName: 'PropertyHub Singapore'
    }
  },
  {
    id: 'zoom',
    name: 'Zoom Meetings',
    description: 'Automatically schedule and manage client appointments',
    status: 'connected',
    icon: CalendarIcon,
    lastSync: '5 minutes ago',
    config: {
      accountType: 'Pro',
      meetingRoom: 'PropertyHub Main Room'
    }
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync appointments and availability with your calendar',
    status: 'connected',
    icon: CalendarIcon,
    lastSync: '1 minute ago'
  },
  {
    id: 'meta-business',
    name: 'Meta Business Manager',
    description: 'Manage Facebook and Instagram lead generation campaigns',
    status: 'pending',
    icon: LinkIcon,
    config: {
      businessId: 'Pending verification'
    }
  }
]

const getStatusColor = (status: Integration['status']) => {
  switch (status) {
    case 'connected':
      return 'text-green-600 bg-green-100'
    case 'error':
      return 'text-red-600 bg-red-100'
    case 'pending':
      return 'text-yellow-600 bg-yellow-100'
    default:
      return 'text-gray-600 bg-gray-100'
  }
}

const getStatusIcon = (status: Integration['status']) => {
  switch (status) {
    case 'connected':
      return CheckCircleIcon
    case 'error':
      return ExclamationTriangleIcon
    default:
      return Cog6ToothIcon
  }
}

export default function IntegrationsPage() {
  const [loading, setLoading] = useState<string | null>(null)

  const handleConnect = async (integrationId: string) => {
    setLoading(integrationId)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    setLoading(null)
  }

  const handleDisconnect = async (integrationId: string) => {
    setLoading(integrationId)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    setLoading(null)
  }

  const handleConfigure = (integrationId: string) => {
    // Open configuration modal or navigate to config page
    console.log('Configure integration:', integrationId)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Integrations</h1>
          <p className="text-gray-600 mt-1">
            Connect and manage your external services and APIs
          </p>
        </div>
        <Button variant="default">
          <LinkIcon className="h-4 w-4 mr-2" />
          Browse Integrations
        </Button>
      </div>

      {/* Integration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {integrations.map((integration) => {
          const StatusIcon = getStatusIcon(integration.status)
          const IconComponent = integration.icon

          return (
            <Card key={integration.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-gray-100 rounded-lg">
                    <IconComponent className="h-6 w-6 text-gray-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {integration.name}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {integration.description}
                    </p>
                    
                    {/* Status */}
                    <div className="flex items-center mt-3">
                      <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(integration.status)}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
                      </div>
                      {integration.lastSync && (
                        <span className="text-xs text-gray-500 ml-3">
                          Last sync: {integration.lastSync}
                        </span>
                      )}
                    </div>

                    {/* Configuration Details */}
                    {integration.config && (
                      <div className="mt-3 space-y-1">
                        {Object.entries(integration.config).map(([key, value]) => (
                          <div key={key} className="text-xs text-gray-600">
                            <span className="font-medium">{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</span> {value}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-2 ml-4">
                  {integration.status === 'connected' ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleConfigure(integration.id)}
                        disabled={loading === integration.id}
                      >
                        {loading === integration.id ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <>
                            <Cog6ToothIcon className="h-4 w-4 mr-1" />
                            Configure
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDisconnect(integration.id)}
                        disabled={loading === integration.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleConnect(integration.id)}
                      disabled={loading === integration.id}
                    >
                      {loading === integration.id ? (
                        <LoadingSpinner size="sm" />
                      ) : (
                        'Connect'
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* WhatsApp QR Code Section */}
      <Card className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <QrCodeIcon className="h-5 w-5 mr-2" />
              WhatsApp Business Setup
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Scan this QR code with your WhatsApp Business app to connect your account
            </p>
          </div>
          <div className="bg-gray-100 p-4 rounded-lg">
            <div className="h-32 w-32 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <QrCodeIcon className="h-12 w-12 text-gray-400" />
            </div>
          </div>
        </div>
      </Card>

      {/* Integration Health */}
      <Card className="p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Integration Health</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">API Rate Limits</span>
            <span className="text-sm font-medium text-green-600">Healthy</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Connection Status</span>
            <span className="text-sm font-medium text-green-600">All Connected</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-600">Last Health Check</span>
            <span className="text-sm text-gray-500">2 minutes ago</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
