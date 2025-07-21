'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useRealTimeNotifications } from '@/lib/hooks/useRealTimeNotifications'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { showErrorToast, showSuccessToast } from '@/lib/utils/errorHandling'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { TemplateSelector } from '@/components/messages/TemplateSelector'
import { LeadSelector } from '@/components/messages/LeadSelector'
import { MessageComposer } from '@/components/messages/MessageComposer'
import { BulkMessageProgress } from '@/components/messages/BulkMessageProgress'
import { TemplateCreator } from '@/components/messages/TemplateCreator'
import { CampaignHistory } from '@/components/messages/CampaignHistory'
import messagesApi, { Template, Lead, Campaign } from '@/lib/api/services/messagesApi'
import {
  MessageSquare,
  Send,
  Users,
  Plus,
  Clock,
  Loader2
} from 'lucide-react'



export default function MessagesPage() {
  const { user } = useAuth()
  const { connected, socket } = useRealTimeNotifications()

  // State management
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<Template[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({})
  const [sending, setSending] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{
    campaignId: string
    sent: number
    failed: number
    total: number
    currentLead?: string
    progress?: number
  } | null>(null)

  // Fetch initial data
  useEffect(() => {
    if (user?.id) {
      fetchInitialData()
    }
  }, [user?.id])

  // WebSocket event listeners for real-time updates
  useEffect(() => {
    if (!socket || !connected) return

    // Listen for bulk message progress updates
    const handleBulkProgress = (data: any) => {
      setBulkProgress({
        campaignId: data.campaignId,
        sent: data.sent,
        failed: data.failed,
        total: data.total,
        currentLead: data.currentLead,
        progress: data.progress
      })
    }

    // Listen for bulk message completion
    const handleBulkCompleted = (data: any) => {
      setBulkProgress(prev => prev ? {
        ...prev,
        sent: data.sent,
        failed: data.failed,
        currentLead: undefined
      } : null)
      setSending(false)
      showSuccessToast(`Bulk campaign completed! ${data.sent} sent, ${data.failed} failed`)
    }

    // Listen for bulk message failure
    const handleBulkFailed = (data: any) => {
      setBulkProgress(prev => prev ? {
        ...prev,
        currentLead: undefined
      } : null)
      setSending(false)
      showErrorToast(`Bulk campaign failed: ${data.error}`)
    }

    socket.on('bulk_message_progress', handleBulkProgress)
    socket.on('bulk_message_completed', handleBulkCompleted)
    socket.on('bulk_message_failed', handleBulkFailed)

    return () => {
      socket.off('bulk_message_progress', handleBulkProgress)
      socket.off('bulk_message_completed', handleBulkCompleted)
      socket.off('bulk_message_failed', handleBulkFailed)
    }
  }, [socket, connected])

  const fetchInitialData = async () => {
    try {
      setLoading(true)

      const [templatesData, leadsData, campaignsData] = await Promise.all([
        messagesApi.getTemplates(),
        messagesApi.getLeads({ limit: 100 }),
        messagesApi.getCampaigns({ limit: 20 })
      ])

      setTemplates(templatesData.templates || [])
      setLeads(leadsData.leads || [])
      setCampaigns(campaignsData.campaigns || [])

    } catch (error) {
      console.error('Error fetching initial data:', error)
      showErrorToast('Failed to load messaging data')
    } finally {
      setLoading(false)
    }
  }



  // Handle template selection
  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template)
    // Reset template parameters
    const params: Record<string, string> = {}
    template.parameters.forEach((param, index) => {
      params[`param_${index + 1}`] = ''
    })
    setTemplateParams(params)
  }

  // Handle lead selection
  const handleLeadToggle = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    )
  }

  // Handle select all leads
  const handleSelectAllLeads = () => {
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(leads.map(lead => lead.id))
    }
  }

  // Send individual message
  const handleSendMessage = async () => {
    if (!selectedTemplate || selectedLeads.length !== 1) {
      showErrorToast('Please select a template and exactly one lead')
      return
    }

    try {
      setSending(true)

      await messagesApi.sendMessage({
        templateId: selectedTemplate.id,
        leadId: selectedLeads[0],
        templateParams,
        templateName: selectedTemplate.elementName
      })

      showSuccessToast('Message sent successfully!')
      setSelectedLeads([])
      setTemplateParams({})

    } catch (error: any) {
      console.error('Error sending message:', error)
      showErrorToast(error.response?.data?.error || 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  // Send bulk messages
  const handleSendBulkMessages = async () => {
    if (!selectedTemplate || selectedLeads.length === 0) {
      showErrorToast('Please select a template and at least one lead')
      return
    }

    try {
      setSending(true)

      const response = await messagesApi.sendBulkMessages({
        templateId: selectedTemplate.id,
        leadIds: selectedLeads,
        templateParams,
        templateName: selectedTemplate.elementName,
        campaignName: `Bulk Campaign - ${selectedTemplate.name} - ${new Date().toLocaleDateString()}`
      })

      setBulkProgress({
        campaignId: response.campaignId,
        sent: 0,
        failed: 0,
        total: selectedLeads.length
      })

      showSuccessToast(`Bulk campaign started! Sending to ${selectedLeads.length} leads.`)

    } catch (error: any) {
      console.error('Error starting bulk campaign:', error)
      showErrorToast(error.response?.data?.error || 'Failed to start bulk campaign')
      setSending(false)
    }
  }



  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Messages</h1>
          <p className="text-muted-foreground">
            Send individual and bulk WhatsApp messages using approved templates
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant={connected ? "default" : "destructive"}>
            {connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </div>

      {/* Bulk Progress Indicator */}
      {bulkProgress && (
        <BulkMessageProgress
          progress={bulkProgress}
          onProgressUpdate={setBulkProgress}
          onComplete={() => {
            setBulkProgress(null)
            setSending(false)
            // Refresh campaigns list
            fetchInitialData()
          }}
        />
      )}

      {/* Main Content */}
      <Tabs defaultValue="send" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="send" className="flex items-center space-x-2" data-testid="tab-send">
            <Send className="h-4 w-4" />
            <span>Send Messages</span>
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center space-x-2" data-testid="tab-create">
            <Plus className="h-4 w-4" />
            <span>Create Template</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center space-x-2" data-testid="tab-history">
            <Clock className="h-4 w-4" />
            <span>Campaign History</span>
          </TabsTrigger>
        </TabsList>

        {/* Send Messages Tab */}
        <TabsContent value="send" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template Selection */}
            <TemplateSelector
              templates={templates}
              selectedTemplate={selectedTemplate}
              onTemplateSelect={handleTemplateSelect}
              loading={loading}
              onRefresh={fetchInitialData}
            />

            {/* Lead Selection */}
            <LeadSelector
              leads={leads}
              selectedLeads={selectedLeads}
              onLeadToggle={handleLeadToggle}
              onSelectAll={handleSelectAllLeads}
              loading={loading}
              onRefresh={fetchInitialData}
            />

            {/* Message Composition */}
            <MessageComposer
              selectedTemplate={selectedTemplate}
              selectedLeads={selectedLeads}
              templateParams={templateParams}
              onTemplateParamsChange={setTemplateParams}
              onSendMessage={handleSendMessage}
              onSendBulkMessage={handleSendBulkMessages}
              sending={sending}
            />
          </div>
        </TabsContent>

        {/* Create Template Tab */}
        <TabsContent value="create">
          <TemplateCreator
            onTemplateCreated={(templateId) => {
              // Refresh templates list
              fetchInitialData()
              showSuccessToast('Template created! It will appear after approval.')
            }}
          />
        </TabsContent>

        {/* Campaign History Tab */}
        <TabsContent value="history">
          <CampaignHistory
            campaigns={campaigns}
            loading={loading}
            onRefresh={fetchInitialData}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
