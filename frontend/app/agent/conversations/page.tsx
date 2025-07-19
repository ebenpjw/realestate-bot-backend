'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useSocket } from '@/lib/socket/SocketContext'
import { conversationsApi, type Conversation, type ConversationDetails } from '@/lib/api/services'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ConversationList } from '@/components/agent/ConversationList'
import { ConversationView } from '@/components/agent/ConversationView'
import { ConversationSearch } from '@/components/agent/ConversationSearch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import {
  Search,
  Filter,
  MessageSquare,
  Circle,
} from 'lucide-react'

// Use the API types instead of local interfaces


export default function ConversationsPage() {
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [conversationDetails, setConversationDetails] = useState<ConversationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showSearch, setShowSearch] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load conversations from API
  const loadConversations = async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      setError(null)
      const response = await conversationsApi.getConversations(user.id, statusFilter === 'all' ? undefined : statusFilter)
      setConversations(response.conversations)
    } catch (err) {
      console.error('Failed to load conversations:', err)
      setError('Failed to load conversations')
    } finally {
      setLoading(false)
    }
  }

  // Load conversation details and messages
  const loadConversationDetails = async (conversationId: string) => {
    try {
      setLoadingMessages(true)
      const details = await conversationsApi.getConversationDetails(conversationId)
      setConversationDetails(details)
    } catch (err) {
      console.error('Failed to load conversation details:', err)
      setError('Failed to load conversation details')
    } finally {
      setLoadingMessages(false)
    }
  }

  // Load conversations on mount and when user/filter changes
  useEffect(() => {
    loadConversations()
  }, [user?.id, statusFilter])

  // Filter conversations based on search and status
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !searchQuery ||
      (conv.leadName && conv.leadName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      conv.phoneNumber.includes(searchQuery)

    return matchesSearch
  })

  // Handle conversation selection
  const handleConversationSelect = async (conversation: Conversation) => {
    setSelectedConversation(conversation)
    await loadConversationDetails(conversation.id)

    // Mark conversation as read
    try {
      await conversationsApi.markAsRead(conversation.id)
      // Update local state to reflect read status
      setConversations(prev => prev.map(conv =>
        conv.id === conversation.id
          ? { ...conv, unreadCount: 0 }
          : conv
      ))
    } catch (err) {
      console.error('Failed to mark conversation as read:', err)
    }
  }

  // Real-time message handling
  useEffect(() => {
    if (!socket || !connected) return

    const handleNewMessage = (data: any) => {
      // Update conversation list
      setConversations(prev => prev.map(conv =>
        conv.id === data.conversationId
          ? {
              ...conv,
              lastMessageAt: new Date().toISOString(),
              unreadCount: conv.unreadCount + 1
            }
          : conv
      ))

      // Add message to current conversation details
      if (conversationDetails?.id === data.conversationId) {
        setConversationDetails(prev => prev ? {
          ...prev,
          messages: [...prev.messages, {
            id: data.messageId,
            conversationId: data.conversationId,
            sender: data.sender,
            message: data.message,
            timestamp: data.timestamp,
            messageType: data.messageType || 'text',
            deliveryStatus: 'delivered',
            createdAt: data.timestamp
          }]
        } : null)
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('message_status_update', (data: any) => {
      if (conversationDetails) {
        setConversationDetails(prev => prev ? {
          ...prev,
          messages: prev.messages.map(msg =>
            msg.id === data.messageId
              ? { ...msg, deliveryStatus: data.status }
              : msg
          )
        } : null)
      }
    })

    return () => {
      socket.off('new_message', handleNewMessage)
      socket.off('message_status_update')
    }
  }, [socket, connected, conversationDetails])

  const handleSendMessage = async (message: string) => {
    if (!selectedConversation) return

    try {
      const newMessage = await conversationsApi.sendMessage({
        conversationId: selectedConversation.id,
        message,
        messageType: 'text'
      })

      // Update conversation details with new message
      if (conversationDetails) {
        setConversationDetails(prev => prev ? {
          ...prev,
          messages: [...prev.messages, newMessage]
        } : null)
      }

      // Update conversation list
      setConversations(prev => prev.map(conv =>
        conv.id === selectedConversation.id
          ? {
              ...conv,
              lastMessageAt: newMessage.timestamp
            }
          : conv
      ))

      // Send via socket for real-time updates
      if (socket && connected) {
        socket.emit('send_message', {
        conversationId: selectedConversation.id,
        leadId: selectedConversation.leadId,
        message,
        agentId: user?.id
      })
    }
  }

  return (
    <Card className="h-full overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Conversations List Panel */}
        <ResizablePanel defaultSize={30} minSize={25} maxSize={50}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Conversations
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowSearch(!showSearch)}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Filter className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Search */}
              {showSearch && (
                <ConversationSearch
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                />
              )}

              {/* Stats */}
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{filteredConversations.length} conversations</span>
                <div className="flex items-center gap-1">
                  <Circle className={`w-2 h-2 ${connected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} />
                  <Badge variant="outline" className="text-xs">
                    {connected ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            {/* Conversation List */}
            <CardContent className="flex-1 overflow-y-auto p-0">
              {error && (
                <div className="p-4 text-center text-red-600">
                  {error}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadConversations}
                    className="ml-2"
                  >
                    Retry
                  </Button>
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <LoadingSpinner />
                </div>
              ) : filteredConversations.length > 0 ? (
                <ConversationList
                  conversations={filteredConversations}
                  selectedConversation={selectedConversation}
                  onConversationSelect={handleConversationSelect}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground p-6">
                  <MessageSquare className="h-8 w-8 mb-2" />
                  <p className="text-sm">No conversations found</p>
                </div>
              )}
            </CardContent>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Conversation View Panel */}
        <ResizablePanel defaultSize={70}>
          <div className="h-full flex flex-col">
            {selectedConversation && conversationDetails ? (
              loadingMessages ? (
                <div className="flex-1 flex items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : (
                <ConversationView
                  conversation={selectedConversation}
                  messages={conversationDetails.messages}
                  onSendMessage={handleSendMessage}
                  connected={connected}
                />
              )
            ) : selectedConversation ? (
              <div className="flex-1 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">Select a conversation</h3>
                  <p className="text-sm text-muted-foreground">Choose a conversation from the list to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </Card>
  )
}
