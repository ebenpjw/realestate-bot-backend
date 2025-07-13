'use client'

import { useState } from 'react'
import {
  UserPlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  EllipsisVerticalIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface Agent {
  id: string
  name: string
  email: string
  phone: string
  status: 'active' | 'inactive' | 'pending' | 'suspended'
  joinedAt: string
  lastActive: string
  totalConversations: number
  conversionRate: number
  monthlyCost: number
  wabaConnected: boolean
  region: string
}

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Sarah Chen',
    email: 'sarah.chen@propertyhub.sg',
    phone: '+65 9123 4567',
    status: 'active',
    joinedAt: '2024-06-15',
    lastActive: '2 minutes ago',
    totalConversations: 234,
    conversionRate: 28.5,
    monthlyCost: 245,
    wabaConnected: true,
    region: 'Singapore'
  },
  {
    id: '2',
    name: 'Michael Wong',
    email: 'michael.wong@propertyhub.sg',
    phone: '+65 9234 5678',
    status: 'pending',
    joinedAt: '2024-07-01',
    lastActive: 'Never',
    totalConversations: 0,
    conversionRate: 0,
    monthlyCost: 0,
    wabaConnected: false,
    region: 'Singapore'
  },
  {
    id: '3',
    name: 'Lisa Tan',
    email: 'lisa.tan@propertyhub.sg',
    phone: '+65 9345 6789',
    status: 'active',
    joinedAt: '2024-06-20',
    lastActive: '1 hour ago',
    totalConversations: 189,
    conversionRate: 31.2,
    monthlyCost: 198,
    wabaConnected: true,
    region: 'Singapore'
  },
  {
    id: '4',
    name: 'David Lim',
    email: 'david.lim@propertyhub.sg',
    phone: '+65 9456 7890',
    status: 'inactive',
    joinedAt: '2024-05-10',
    lastActive: '3 days ago',
    totalConversations: 156,
    conversionRate: 22.1,
    monthlyCost: 0,
    wabaConnected: false,
    region: 'Singapore'
  }
]

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
      return <CheckCircleIcon className="h-4 w-4" />
    case 'inactive':
      return <XCircleIcon className="h-4 w-4" />
    case 'pending':
      return <ClockIcon className="h-4 w-4" />
    case 'suspended':
      return <XCircleIcon className="h-4 w-4" />
    default:
      return <ClockIcon className="h-4 w-4" />
  }
}

export default function AgentsPage() {
  const [agents] = useState(mockAgents)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [loading, setLoading] = useState(false)

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleInviteAgent = () => {
    setLoading(true)
    // Simulate API call
    setTimeout(() => setLoading(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Agent Management</h1>
          <p className="text-gray-600 mt-1">
            Manage and monitor all PropertyHub agents
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
              <UserPlusIcon className="h-4 w-4 mr-2" />
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
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
              <FunnelIcon className="h-4 w-4 mr-2" />
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
                          {agent.name.charAt(0)}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {agent.name}
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
                        <ChatBubbleLeftRightIcon className="h-4 w-4 text-gray-400 mr-1" />
                        {agent.totalConversations} conversations
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {agent.conversionRate}% conversion rate
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <CurrencyDollarIcon className="h-4 w-4 text-gray-400 mr-1" />
                      ${agent.monthlyCost}/month
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      agent.wabaConnected
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {agent.wabaConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {agent.lastActive}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-gray-400 hover:text-gray-600">
                      <EllipsisVerticalIcon className="h-5 w-5" />
                    </button>
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
              ${agents.reduce((sum, a) => sum + a.monthlyCost, 0)}
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
    </div>
  )
}
