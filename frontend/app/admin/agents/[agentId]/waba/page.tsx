'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { apiClient } from '@/lib/api/client'
import { showErrorToast } from '@/lib/utils/errorHandling'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft,
  MessageSquare,
  Phone,
  Settings,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react'

interface AgentInfo {
  id: string
  full_name: string
  email: string
  status: string
  waba_phone_number?: string
  waba_display_name?: string
  waba_api_key?: string
  waba_app_id?: string
  waba_status?: string
  bot_name?: string
  created_at: string
  last_active?: string
}

interface WABAConfig {
  phoneNumber: string
  displayName: string
  apiKey: string
  appId: string
  status: 'connected' | 'disconnected' | 'pending' | 'error'
  lastSync?: string
}

export default function AgentWABAPage() {
  const params = useParams()
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const agentId = params.agentId as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [agent, setAgent] = useState<AgentInfo | null>(null)
  const [wabaConfig, setWABAConfig] = useState<WABAConfig>({
    phoneNumber: '',
    displayName: '',
    apiKey: '',
    appId: '',
    status: 'disconnected'
  })

  // Store the actual API key separately from the masked display value
  const [actualApiKey, setActualApiKey] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  // Check admin permission
  if (!hasPermission('manage_system')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to manage agent WABA settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch agent info and WABA configuration
  const fetchAgentInfo = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiClient.get(`/api/agents/${agentId}`)
      const agentData = response.data.data

      setAgent(agentData)

      // First set from database fields
      let wabaConfig = {
        phoneNumber: agentData.waba_phone_number || '',
        displayName: agentData.waba_display_name || '',
        apiKey: agentData.gupshup_api_key_encrypted ? '***' : '', // Mask encrypted API key
        appId: agentData.gupshup_app_id || '',
        status: agentData.waba_status || 'disconnected',
        lastSync: agentData.last_active
      }

      // If agent has Gupshup app configured, try to fetch details from Partner API
      if (agentData.gupshup_app_id && (!wabaConfig.phoneNumber || !wabaConfig.displayName)) {
        try {
          const wabaStatusResponse = await apiClient.get(`/api/dashboard/agents/${agentId}/waba-status`)
          const wabaStatus = wabaStatusResponse.data.data

          if (wabaStatus.status === 'connected' || wabaStatus.status === 'unhealthy') {
            // Auto-populate from Gupshup Partner API data
            wabaConfig = {
              phoneNumber: wabaStatus.phoneNumber || wabaConfig.phoneNumber,
              displayName: wabaStatus.displayName || wabaConfig.displayName,
              apiKey: wabaConfig.apiKey, // Keep existing API key (masked)
              appId: wabaStatus.appId || wabaConfig.appId,
              status: wabaStatus.status,
              lastSync: wabaStatus.lastSync || wabaConfig.lastSync
            }

            // Update database with auto-discovered values if they were empty
            if (wabaStatus.phoneNumber && !agentData.waba_phone_number) {
              await apiClient.patch(`/api/agents/${agentId}`, {
                waba_phone_number: wabaStatus.phoneNumber
              })
            }
            if (wabaStatus.displayName && !agentData.waba_display_name) {
              await apiClient.patch(`/api/agents/${agentId}`, {
                waba_display_name: wabaStatus.displayName
              })
            }
          }
        } catch (wabaError) {
          console.warn('Could not fetch WABA details from Partner API:', wabaError)
          // Continue with database values
        }
      }

      setWABAConfig(wabaConfig)

    } catch (error: any) {
      console.error('Error fetching agent info:', error)
      setError(error.response?.data?.message || 'Failed to load agent information')
      showErrorToast('Failed to load agent WABA settings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (agentId) {
      fetchAgentInfo()
    }
  }, [agentId])

  const handleSaveConfig = async () => {
    try {
      setSaving(true)
      
      const response = await apiClient.patch(`/api/agents/${agentId}`, {
        waba_phone_number: wabaConfig.phoneNumber,
        waba_display_name: wabaConfig.displayName,
        waba_api_key: wabaConfig.apiKey === '***' ? undefined : wabaConfig.apiKey, // Don't send masked value
        waba_app_id: wabaConfig.appId
      })

      if (response.data.success) {
        showErrorToast('WABA configuration saved successfully')
        await fetchAgentInfo() // Refresh data
      }
    } catch (error: any) {
      console.error('Error saving WABA config:', error)
      showErrorToast(error.response?.data?.message || 'Failed to save WABA configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    try {
      setTesting(true)
      
      const response = await apiClient.post('/api/integrations/waba/test', {
        agentId: agentId
      })

      if (response.data.success) {
        showErrorToast('WABA connection test successful')
        setWABAConfig(prev => ({ ...prev, status: 'connected' }))
      }
    } catch (error: any) {
      console.error('Error testing WABA connection:', error)
      showErrorToast(error.response?.data?.message || 'WABA connection test failed')
      setWABAConfig(prev => ({ ...prev, status: 'error' }))
    } finally {
      setTesting(false)
    }
  }

  const handleAutoDiscover = async () => {
    try {
      setDiscovering(true)

      // If we have a phone number, use the new discovery endpoint
      if (wabaConfig.phoneNumber) {
        const response = await apiClient.post('/api/partner/waba/discover-by-phone', {
          phoneNumber: wabaConfig.phoneNumber
        })

        const discoveredDetails = response.data.data

        if (discoveredDetails.found) {
          setWABAConfig(prev => ({
            ...prev,
            displayName: discoveredDetails.displayName || prev.displayName,
            appId: discoveredDetails.appId || prev.appId,
            apiKey: discoveredDetails.apiKey || prev.apiKey, // Store the actual API key
            status: 'connected'
          }))
          showErrorToast('WABA details auto-discovered from Gupshup Partner API')
        } else {
          showErrorToast('No WABA details found for this phone number')
        }
      } else {
        // Fallback to the existing method if no phone number
        const response = await apiClient.get(`/api/dashboard/agents/${agentId}/waba-status`)
        const wabaStatus = response.data.data

        if (wabaStatus.phoneNumber || wabaStatus.displayName) {
          setWABAConfig(prev => ({
            ...prev,
            phoneNumber: wabaStatus.phoneNumber || prev.phoneNumber,
            displayName: wabaStatus.displayName || prev.displayName,
            appId: wabaStatus.appId || prev.appId,
            status: wabaStatus.status
          }))
          showErrorToast('WABA details auto-discovered from Gupshup Partner API')
        } else {
          showErrorToast('Please enter a phone number first, then try auto-discovery')
        }
      }
    } catch (error: any) {
      console.error('Error auto-discovering WABA details:', error)
      showErrorToast(error.response?.data?.message || 'Failed to auto-discover WABA details')
    } finally {
      setDiscovering(false)
    }
  }

  const handleInputChange = (field: keyof typeof wabaConfig, value: string) => {
    setWABAConfig(prev => ({
      ...prev,
      [field]: value
    }))

    // Auto-discover when phone number is entered and other fields are empty
    if (field === 'phoneNumber' && value && value.length > 8 &&
        !wabaConfig.displayName && !wabaConfig.appId) {
      // Debounce the auto-discovery to avoid too many API calls
      setTimeout(() => {
        if (wabaConfig.phoneNumber === value) { // Only if phone number hasn't changed
          handleAutoDiscover()
        }
      }, 1000)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800'
      case 'disconnected':
        return 'bg-red-100 text-red-800'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <Wifi className="h-4 w-4" />
      case 'disconnected':
        return <WifiOff className="h-4 w-4" />
      case 'pending':
        return <RefreshCw className="h-4 w-4" />
      case 'error':
        return <XCircle className="h-4 w-4" />
      default:
        return <WifiOff className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Error Loading Agent</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchAgentInfo}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/admin/agents')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">WABA Settings</h1>
            <p className="text-gray-600 mt-1">
              Configure WhatsApp Business API for {agent?.full_name}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className={`${getStatusColor(wabaConfig.status)}`}>
            {getStatusIcon(wabaConfig.status)}
            <span className="ml-1 capitalize">{wabaConfig.status}</span>
          </Badge>
        </div>
      </div>

      {/* Agent Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Agent Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-gray-500">Agent Name</Label>
              <p className="text-sm font-medium">{agent?.full_name}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Email</Label>
              <p className="text-sm">{agent?.email}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-gray-500">Status</Label>
              <Badge variant="outline" className="capitalize">{agent?.status}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WABA Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            WABA Configuration
          </CardTitle>
          <CardDescription>
            Configure WhatsApp Business API credentials and settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input
                id="phoneNumber"
                value={wabaConfig.phoneNumber}
                onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                placeholder="+65xxxxxxxx"
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={wabaConfig.displayName}
                onChange={(e) => handleInputChange('displayName', e.target.value)}
                placeholder="Business Display Name"
              />
            </div>
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={wabaConfig.apiKey}
                onChange={(e) => handleInputChange('apiKey', e.target.value)}
                placeholder="Enter WABA API Key"
              />
            </div>
            <div>
              <Label htmlFor="appId">App ID</Label>
              <Input
                id="appId"
                value={wabaConfig.appId}
                onChange={(e) => handleInputChange('appId', e.target.value)}
                placeholder="Enter WABA App ID"
              />
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={handleAutoDiscover}
                disabled={discovering}
              >
                {discovering ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Auto-Discovering...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Auto-Discover
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testing || !wabaConfig.phoneNumber || !wabaConfig.apiKey}
              >
                {testing ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
            </div>
            <Button
              onClick={handleSaveConfig}
              disabled={saving}
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Status Information */}
      {wabaConfig.lastSync && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-600">
              Last synchronized: {new Date(wabaConfig.lastSync).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
