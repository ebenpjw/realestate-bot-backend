'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthContext'
import { useAdminWABAOverview } from '@/lib/hooks/useDashboard'
import {
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  PhoneIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline'
import { RefreshCw } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface WABAAccount {
  id: string
  agentName: string
  agentEmail: string
  phoneNumber: string
  businessName: string
  status: 'connected' | 'pending' | 'error' | 'suspended' | 'disconnected'
  verificationStatus: 'verified' | 'pending' | 'rejected'
  lastSync: string
  messagesSent: number
  messagesReceived: number
  templatesActive: number
  templatesPending: number
  appId?: string
  partnerAppInfo?: any
}

interface Template {
  id: string
  name: string
  category: string
  status: 'approved' | 'pending' | 'rejected'
  language: string
  lastUsed: string
  usageCount: number
  agentName?: string
}

// Helper functions
const getStatusIcon = (status: string) => {
  switch (status) {
    case 'connected':
      return <CheckCircleIcon className="h-4 w-4 text-green-600" />
    case 'pending':
      return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
    case 'error':
    case 'suspended':
      return <XCircleIcon className="h-4 w-4 text-red-600" />
    default:
      return <XCircleIcon className="h-4 w-4 text-gray-400" />
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected':
      return 'text-green-600 bg-green-50'
    case 'pending':
      return 'text-yellow-600 bg-yellow-50'
    case 'error':
    case 'suspended':
      return 'text-red-600 bg-red-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

const getTemplateStatusIcon = (status: string) => {
  switch (status.toUpperCase()) {
    case 'APPROVED':
      return <CheckCircleIcon className="h-4 w-4 text-green-600" />
    case 'PENDING':
      return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
    case 'FAILED':
    case 'REJECTED':
      return <XCircleIcon className="h-4 w-4 text-red-600" />
    default:
      return <ExclamationTriangleIcon className="h-4 w-4 text-gray-400" />
  }
}

const getVerificationStatusColor = (status: string) => {
  switch (status) {
    case 'verified':
      return 'text-green-600 bg-green-50'
    case 'pending':
      return 'text-yellow-600 bg-yellow-50'
    case 'rejected':
      return 'text-red-600 bg-red-50'
    default:
      return 'text-gray-600 bg-gray-50'
  }
}

export default function WABAPage() {
  const router = useRouter()
  const { user, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('accounts')
  const [selectedAgentId, setSelectedAgentId] = useState<string>('')

  // Fetch real WABA data
  const { data: wabaData, isLoading, error, refetch } = useAdminWABAOverview(selectedAgentId)

  // Check admin permission
  if (!hasPermission('manage_system')) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <div className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access WABA management.</p>
          </div>
        </Card>
      </div>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <div className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Error Loading Data</h2>
            <p className="text-gray-600 mb-4">Failed to load WABA management data</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </div>
        </Card>
      </div>
    )
  }

  const accounts = wabaData?.accounts || []
  const templates = wabaData?.templates || []
  const totalAccounts = wabaData?.totalAccounts || 0
  const activeAccounts = wabaData?.activeAccounts || 0
  const activeTemplates = wabaData?.activeTemplates || 0

  const handleAddAccount = () => {
    router.push('/admin/agents?action=add')
  }

  const handleConfigureAccount = (accountId: string) => {
    router.push(`/admin/agents/${accountId}/waba`)
  }

  const handleViewDetails = (accountId: string) => {
    router.push(`/admin/agents/${accountId}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">WABA Management</h1>
          <p className="text-gray-600 mt-1">
            Manage WhatsApp Business API accounts and templates
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="default"
            onClick={handleAddAccount}
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Agent
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Accounts</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {totalAccounts}
              </p>
            </div>
            <ChatBubbleLeftRightIcon className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Accounts</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {activeAccounts}
              </p>
            </div>
            <CheckCircleIcon className="h-8 w-8 text-green-600" />
          </div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Templates</p>
              <p className="text-2xl font-semibold text-gray-900 mt-2">
                {activeTemplates}
              </p>
            </div>
            <DocumentTextIcon className="h-8 w-8 text-purple-600" />
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('accounts')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'accounts'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            WABA Accounts
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'templates'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Message Templates
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'accounts' && (
        <div className="space-y-4">
          {accounts.map((account) => (
            <Card key={account.id} className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center">
                    <PhoneIcon className="h-6 w-6 text-primary-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-gray-900">
                      {account.businessName}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {account.agentName} • {account.phoneNumber}
                    </p>
                    
                    <div className="flex items-center space-x-4 mt-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                        {getStatusIcon(account.status)}
                        <span className="ml-1">{account.status}</span>
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(account.verificationStatus)}`}>
                        {getStatusIcon(account.verificationStatus)}
                        <span className="ml-1">Verification: {account.verificationStatus}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div>
                        <p className="text-xs text-gray-500">Messages Sent</p>
                        <p className="text-sm font-medium text-gray-900">{account.messagesSent.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Messages Received</p>
                        <p className="text-sm font-medium text-gray-900">{account.messagesReceived.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Active Templates</p>
                        <p className="text-sm font-medium text-gray-900">{account.templatesActive}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfigureAccount(account.id)}
                  >
                    <Cog6ToothIcon className="h-4 w-4 mr-1" />
                    Configure
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewDetails(account.id)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Agent Selector */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Message Templates</h3>
                <p className="text-sm text-gray-500 mt-1">View templates for a specific agent</p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="appearance-none bg-white border border-gray-300 rounded-md px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select an agent...</option>
                    {accounts
                      .filter(account => account.status === 'connected')
                      .map(account => (
                        <option key={account.id} value={account.id}>
                          {account.agentName} ({account.businessName})
                        </option>
                      ))}
                  </select>
                  <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </Card>

          {/* Templates Table */}
          {selectedAgentId && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Template
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {templates.map((template) => (
                  <tr key={template.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {template.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        Language: {template.language.toUpperCase()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {template.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(template.status)}`}>
                        {getTemplateStatusIcon(template.status)}
                        <span className="ml-1">{template.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {template.usageCount.toLocaleString()} times
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {template.lastUsed}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
          )}

          {/* Show message when no agent selected */}
          {!selectedAgentId && (
            <Card className="p-12">
              <div className="text-center">
                <DocumentTextIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">Select an Agent</h3>
                <p className="mt-2 text-sm text-gray-500">
                  Choose an agent from the dropdown above to view their message templates.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
