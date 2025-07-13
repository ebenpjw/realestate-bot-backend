'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/lib/auth/AuthContext'
import { useSocket } from '@/lib/socket/SocketContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ConversationList } from '@/components/agent/ConversationList'
import { ConversationView } from '@/components/agent/ConversationView'
import { ConversationSearch } from '@/components/agent/ConversationSearch'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ChatBubbleLeftRightIcon,
} from '@heroicons/react/24/outline'

interface Conversation {
  id: string
  leadId: string
  leadName: string
  phoneNumber: string
  status: 'new' | 'qualified' | 'booked' | 'lost'
  lastMessage: string
  lastMessageTime: string
  unreadCount: number
  intent?: string
  avatar?: string
}

interface Message {
  id: string
  conversationId: string
  sender: 'lead' | 'bot' | 'agent'
  message: string
  timestamp: string
  messageType: 'text' | 'template' | 'media'
  templateName?: string
  status?: 'sent' | 'delivered' | 'read'
}

// Mock data - this would come from your API
const mockConversations: Conversation[] = [
  {
    id: '1',
    leadId: 'lead-1',
    leadName: 'Sarah Chen',
    phoneNumber: '+65 9123 4567',
    status: 'qualified',
    lastMessage: 'I\'m interested in the 3-bedroom unit at Marina Bay',
    lastMessageTime: '2 minutes ago',
    unreadCount: 2,
    intent: 'buy',
  },
  {
    id: '2',
    leadId: 'lead-2',
    leadName: 'Michael Tan',
    phoneNumber: '+65 9234 5678',
    status: 'new',
    lastMessage: 'What\'s the price range for 2-bedroom units?',
    lastMessageTime: '15 minutes ago',
    unreadCount: 1,
    intent: 'browse',
  },
  {
    id: '3',
    leadId: 'lead-3',
    leadName: 'Jennifer Lim',
    phoneNumber: '+65 9345 6789',
    status: 'booked',
    lastMessage: 'Confirmed for 2pm tomorrow. Thank you!',
    lastMessageTime: '1 hour ago',
    unreadCount: 0,
    intent: 'buy',
  },
]

const mockMessages: Message[] = [
  {
    id: '1',
    conversationId: '1',
    sender: 'lead',
    message: 'Hi, I saw your property listing online',
    timestamp: '2024-01-15T10:00:00Z',
    messageType: 'text',
    status: 'read',
  },
  {
    id: '2',
    conversationId: '1',
    sender: 'bot',
    message: 'Hello! I\'m Doro, your personal property assistant. I\'d be happy to help you find your dream home. What type of property are you looking for?',
    timestamp: '2024-01-15T10:00:30Z',
    messageType: 'text',
    status: 'read',
  },
  {
    id: '3',
    conversationId: '1',
    sender: 'lead',
    message: 'I\'m interested in the 3-bedroom unit at Marina Bay',
    timestamp: '2024-01-15T10:02:00Z',
    messageType: 'text',
    status: 'read',
  },
]

export default function ConversationsPage() {
  const { user } = useAuth()
  const { socket, connected } = useSocket()
  const [conversations, setConversations] = useState<Conversation[]>(mockConversations)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>(mockMessages)
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showSearch, setShowSearch] = useState(false)

  // Filter conversations based on search and status
  const filteredConversations = conversations.filter(conv => {
    const matchesSearch = !searchQuery || 
      conv.leadName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.phoneNumber.includes(searchQuery) ||
      conv.lastMessage.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || conv.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  // Real-time message handling
  useEffect(() => {
    if (!socket || !connected) return

    const handleNewMessage = (data: any) => {
      // Update conversation list
      setConversations(prev => prev.map(conv => 
        conv.id === data.conversationId 
          ? {
              ...conv,
              lastMessage: data.message,
              lastMessageTime: 'Just now',
              unreadCount: conv.unreadCount + 1
            }
          : conv
      ))

      // Add message to current conversation
      if (selectedConversation?.id === data.conversationId) {
        setMessages(prev => [...prev, {
          id: data.messageId,
          conversationId: data.conversationId,
          sender: data.sender,
          message: data.message,
          timestamp: data.timestamp,
          messageType: data.messageType || 'text',
          status: 'delivered'
        }])
      }
    }

    socket.on('new_message', handleNewMessage)
    socket.on('message_status_update', (data: any) => {
      setMessages(prev => prev.map(msg => 
        msg.id === data.messageId 
          ? { ...msg, status: data.status }
          : msg
      ))
    })

    return () => {
      socket.off('new_message', handleNewMessage)
      socket.off('message_status_update')
    }
  }, [socket, connected, selectedConversation])

  const handleConversationSelect = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    
    // Mark as read
    setConversations(prev => prev.map(conv => 
      conv.id === conversation.id 
        ? { ...conv, unreadCount: 0 }
        : conv
    ))

    // Load messages for this conversation
    // In real app, this would be an API call
    const conversationMessages = mockMessages.filter(msg => msg.conversationId === conversation.id)
    setMessages(conversationMessages)
  }

  const handleSendMessage = (message: string) => {
    if (!selectedConversation) return

    const newMessage: Message = {
      id: Date.now().toString(),
      conversationId: selectedConversation.id,
      sender: 'agent',
      message,
      timestamp: new Date().toISOString(),
      messageType: 'text',
      status: 'sent'
    }

    setMessages(prev => [...prev, newMessage])
    
    // Update conversation list
    setConversations(prev => prev.map(conv => 
      conv.id === selectedConversation.id 
        ? {
            ...conv,
            lastMessage: message,
            lastMessageTime: 'Just now'
          }
        : conv
    ))

    // Send via socket
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
    <div className="h-full flex bg-white rounded-xl shadow-apple border border-gray-200 overflow-hidden">
      {/* Conversations List */}
      <div className="w-80 border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">Conversations</h1>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSearch(!showSearch)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <FunnelIcon className="h-5 w-5" />
              </button>
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
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{filteredConversations.length} conversations</span>
            <span className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
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
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <ChatBubbleLeftRightIcon className="h-8 w-8 mb-2" />
              <p className="text-sm">No conversations found</p>
            </div>
          )}
        </div>
      </div>

      {/* Conversation View */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <ConversationView
            conversation={selectedConversation}
            messages={messages}
            onSendMessage={handleSendMessage}
            connected={connected}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
              <p className="text-sm">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
