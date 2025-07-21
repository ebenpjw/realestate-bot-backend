'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { apiClient } from '@/lib/api/client'
import { showErrorToast } from '@/lib/utils/errorHandling'
import {
  Users,
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  DollarSign,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Mail,
  Phone,
  Calendar,
  Activity,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface Agent {
  id: string
  full_name: string
  email: string
  status: 'active' | 'inactive' | 'pending'
  last_active?: string
  waba_phone_number?: string
  waba_display_name?: string
  bot_name?: string
  created_at: string
  // Calculated fields
  totalConversations?: number
  conversionRate?: number
  monthlyCost?: number
  wabaConnected?: boolean
  wabaStatusLoading?: boolean
  wabaStatusError?: string | null
}



const getStatusColor = (status: Agent['status']) => {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800'
    case 'inactive':
      return 'bg-gray-100 text-gray-800'
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'suspended':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusIcon = (status: Agent['status']) => {
  switch (status) {
    case 'active':
      return <CheckCircle className="h-4 w-4" />
    case 'inactive':
      return <XCircle className="h-4 w-4" />
    case 'pending':
      return <Clock className="h-4 w-4" />
    case 'suspended':
      return <XCircle className="h-4 w-4" />
    default:
      return <Clock className="h-4 w-4" />
  }
}

export default function AgentsPage() {
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    status: 'active' as 'active' | 'inactive' | 'pending',
    waba_phone_number: '',
    waba_display_name: '',
    bot_name: ''
  })
  const [saving, setSaving] = useState(false)
  const [approvingAgent, setApprovingAgent] = useState<string | null>(null)
  const [rejectingAgent, setRejectingAgent] = useState<string | null>(null)

  // Check admin permission
  if (!hasPermission('manage_system')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">You don't have permission to manage agents.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fetch agents data
  const fetchAgents = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get all agents from the dedicated agents API
      const response = await apiClient.get('/api/agents', {
        params: {
          limit: 100, // Get more agents
          sortBy: 'created_at',
          sortOrder: 'desc'
        }
      })

      const { agents } = response.data.data || {}

      if (!agents || !Array.isArray(agents)) {
        throw new Error('No agents data available')
      }

      // Transform the data to match our interface
      const transformedAgents: Agent[] = agents.map((agent: any) => {
        return {
          id: agent.id,
          full_name: agent.full_name || 'Unknown Agent',
          email: agent.email || '',
          status: agent.status || 'inactive',
          last_active: agent.last_active || agent.updated_at,
          waba_phone_number: agent.waba_phone_number,
          waba_display_name: agent.waba_display_name,
          bot_name: agent.bot_name,
          created_at: agent.created_at,
          totalConversations: 0, // Will be populated from performance data if needed
          conversionRate: 0, // Will be populated from performance data if needed
          monthlyCost: 0, // Will be populated from performance data if needed
          wabaConnected: !!(agent.waba_phone_number && agent.gupshup_app_id),
          wabaStatusLoading: false,
          wabaStatusError: null
        }
      })

      setAgents(transformedAgents)
    } catch (error: any) {
      console.error('Error fetching agents:', error)
      setError(error.response?.data?.message || 'Failed to load agents')
      showErrorToast('Failed to load agents data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAgents()
  }, [])

  // Function to check real-time WABA status for an agent
  const checkWABAStatus = async (agentId: string) => {
    try {
      setAgents(prev => prev.map(agent =>
        agent.id === agentId
          ? { ...agent, wabaStatusLoading: true, wabaStatusError: null }
          : agent
      ))

      const response = await apiClient.get(`/api/dashboard/agents/${agentId}/waba-status`)
      const wabaStatus = response.data.data

      setAgents(prev => prev.map(agent =>
        agent.id === agentId
          ? {
              ...agent,
              wabaConnected: wabaStatus.status === 'connected',
              wabaStatusLoading: false,
              wabaStatusError: wabaStatus.status === 'error' ? wabaStatus.errorMessage : null,
              waba_phone_number: wabaStatus.phoneNumber || agent.waba_phone_number
            }
          : agent
      ))

      return wabaStatus
    } catch (error: any) {
      console.error('Error checking WABA status:', error)
      setAgents(prev => prev.map(agent =>
        agent.id === agentId
          ? {
              ...agent,
              wabaStatusLoading: false,
              wabaStatusError: error.response?.data?.message || 'Failed to check WABA status'
            }
          : agent
      ))
      showErrorToast('Failed to check WABA status')
    }
  }

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleInviteAgent = () => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => setLoading(false), 2000)
  }

  const handleEditAgent = (agent: Agent) => {
    setEditingAgent(agent)
    setEditFormData({
      full_name: agent.full_name,
      email: agent.email,
      status: agent.status,
      waba_phone_number: agent.waba_phone_number || '',
      waba_display_name: agent.waba_display_name || '',
      bot_name: agent.bot_name || ''
    })
  }

  const handleSaveAgent = async () => {
    if (!editingAgent) return

    try {
      setSaving(true)

      // Update agent in database
      const response = await apiClient.patch(`/api/agents/${editingAgent.id}`, editFormData)

      if (response.data.success) {
        // Update local state
        setAgents(agents.map(agent =>
          agent.id === editingAgent.id
            ? { ...agent, ...editFormData }
            : agent
        ))

        setEditingAgent(null)
        showErrorToast('Agent updated successfully')
      }
    } catch (error: any) {
      console.error('Error updating agent:', error)
      showErrorToast(error.response?.data?.message || 'Failed to update agent')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingAgent(null)
    setEditFormData({
      full_name: '',
      email: '',
      status: 'active',
      waba_phone_number: '',
      waba_display_name: '',
      bot_name: ''
    })
  }

  const handleApproveAgent = async (agentId: string) => {
    try {
      setApprovingAgent(agentId)

      const response = await apiClient.post(`/api/agents/${agentId}/approve`)

      if (response.data.success) {
        // Update the agent status in the list
        setAgents(prev => prev.map(agent =>
          agent.id === agentId
            ? { ...agent, status: 'active' as const }
            : agent
        ))

        // Show success toast
        toast.success('Agent approved successfully!', {
          description: 'The agent can now login and access the system.'
        })
      }
    } catch (error: any) {
      console.error('Error approving agent:', error)
      showErrorToast(error.response?.data?.error || 'Failed to approve agent')
    } finally {
      setApprovingAgent(null)
    }
  }

  const handleRejectAgent = async (agentId: string, reason?: string) => {
    try {
      setRejectingAgent(agentId)

      const response = await apiClient.post(`/api/agents/${agentId}/reject`, { reason })

      if (response.data.success) {
        // Remove the agent from the list
        setAgents(prev => prev.filter(agent => agent.id !== agentId))

        // Show success toast
        toast.success('Agent registration rejected', {
          description: 'The agent registration has been rejected and removed.'
        })
      }
    } catch (error: any) {
      console.error('Error rejecting agent:', error)
      showErrorToast(error.response?.data?.error || 'Failed to reject agent')
    } finally {
      setRejectingAgent(null)
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
            <h2 className="text-lg font-semibold mb-2">Error Loading Agents</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchAgents}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Management</h1>
          <p className="text-gray-600 mt-1">
            Manage and monitor all Outpaced agents
          </p>
        </div>
        <Button
          variant="default"
          onClick={handleInviteAgent}
          disabled={loading}
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" className="mr-2" />
              Sending...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              Invite Agent
            </>
          )}
        </Button>
      </div>

      {/* Filters and Search */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search agents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
            </select>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              More Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Agents Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Performance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  WABA
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="relative px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAgents.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary-700">
                          {agent.full_name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {agent.full_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {agent.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(agent.status)}`}>
                      {getStatusIcon(agent.status)}
                      <span className="ml-1">{agent.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="flex items-center">
                        <MessageSquare className="h-4 w-4 text-gray-400 mr-1" />
                        {agent.totalConversations} conversations
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {agent.conversionRate}% conversion rate
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => router.push(`/admin/agents/${agent.id}/costs`)}
                      className="flex items-center text-sm text-gray-900 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                    >
                      <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                      S${agent.monthlyCost}/month
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        agent.wabaStatusLoading
                          ? 'bg-yellow-100 text-yellow-800'
                          : agent.wabaStatusError
                          ? 'bg-red-100 text-red-800'
                          : agent.wabaConnected
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {agent.wabaStatusLoading
                          ? 'Checking...'
                          : agent.wabaStatusError
                          ? 'Error'
                          : agent.wabaConnected
                          ? 'Connected'
                          : 'Disconnected'
                        }
                      </span>
                      <button
                        onClick={() => checkWABAStatus(agent.id)}
                        disabled={agent.wabaStatusLoading}
                        className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-50"
                        title="Check WABA Status"
                      >
                        <RefreshCw className={`h-3 w-3 ${agent.wabaStatusLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    {agent.wabaStatusError && (
                      <div className="text-xs text-red-600 mt-1" title={agent.wabaStatusError}>
                        {agent.wabaStatusError.length > 30
                          ? `${agent.wabaStatusError.substring(0, 30)}...`
                          : agent.wabaStatusError
                        }
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {agent.last_active ? new Date(agent.last_active).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="text-gray-400 hover:text-gray-600">
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {agent.status === 'inactive' ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleApproveAgent(agent.id)}
                              disabled={approvingAgent === agent.id}
                              className="text-green-600 hover:text-green-700"
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              {approvingAgent === agent.id ? 'Approving...' : 'Approve Registration'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleRejectAgent(agent.id)}
                              disabled={rejectingAgent === agent.id}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              {rejectingAgent === agent.id ? 'Rejecting...' : 'Reject Registration'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        ) : null}
                        <DropdownMenuItem onClick={() => handleEditAgent(agent)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Agent
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/admin/agents/${agent.id}/costs`)}>
                          <DollarSign className="h-4 w-4 mr-2" />
                          View Costs
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/admin/agents/${agent.id}/waba`)}>
                          <MessageSquare className="h-4 w-4 mr-2" />
                          WABA Settings
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {agents.filter(a => a.status === 'active').length}
            </div>
            <div className="text-sm text-gray-600">Active Agents</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {agents.filter(a => a.status === 'pending').length}
            </div>
            <div className="text-sm text-gray-600">Pending Invites</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              S${agents.reduce((sum, a) => sum + a.monthlyCost, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Monthly Cost</div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {Math.round(agents.reduce((sum, a) => sum + a.conversionRate, 0) / agents.length)}%
            </div>
            <div className="text-sm text-gray-600">Avg Conversion Rate</div>
          </div>
        </Card>
      </div>

      {/* Edit Agent Dialog */}
      {editingAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Edit Agent</h2>
              <p className="text-sm text-gray-600">Update agent information and settings.</p>
            </div>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="full_name" className="text-right">
                Name
              </Label>
              <Input
                id="full_name"
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">
                Status
              </Label>
              <Select
                value={editFormData.status}
                onValueChange={(value) => setEditFormData({ ...editFormData, status: value as 'active' | 'inactive' | 'pending' })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="waba_phone_number" className="text-right">
                WABA Phone
              </Label>
              <Input
                id="waba_phone_number"
                value={editFormData.waba_phone_number}
                onChange={(e) => setEditFormData({ ...editFormData, waba_phone_number: e.target.value })}
                className="col-span-3"
                placeholder="+65xxxxxxxx"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="waba_display_name" className="text-right">
                Display Name
              </Label>
              <Input
                id="waba_display_name"
                value={editFormData.waba_display_name}
                onChange={(e) => setEditFormData({ ...editFormData, waba_display_name: e.target.value })}
                className="col-span-3"
                placeholder="Business Display Name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="bot_name" className="text-right">
                Bot Name
              </Label>
              <Input
                id="bot_name"
                value={editFormData.bot_name}
                onChange={(e) => setEditFormData({ ...editFormData, bot_name: e.target.value })}
                className="col-span-3"
                placeholder="Bot Name"
              />
            </div>
          </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button variant="outline" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSaveAgent} disabled={saving}>
                {saving ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
