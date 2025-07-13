'use client'

import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

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

interface ConversationListProps {
  conversations: Conversation[]
  selectedConversation: Conversation | null
  onConversationSelect: (conversation: Conversation) => void
}

export function ConversationList({
  conversations,
  selectedConversation,
  onConversationSelect,
}: ConversationListProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800'
      case 'qualified':
        return 'bg-green-100 text-green-800'
      case 'booked':
        return 'bg-purple-100 text-purple-800'
      case 'lost':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getIntentIcon = (intent?: string) => {
    switch (intent) {
      case 'buy':
        return '🏠'
      case 'rent':
        return '🔑'
      case 'browse':
        return '👀'
      case 'invest':
        return '💰'
      default:
        return '💬'
    }
  }

  const formatTime = (timeString: string) => {
    // Handle relative time strings like "2 minutes ago"
    if (timeString.includes('ago') || timeString.includes('Just now')) {
      return timeString
    }
    
    try {
      const date = new Date(timeString)
      return formatDistanceToNow(date, { addSuffix: true })
    } catch {
      return timeString
    }
  }

  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          onClick={() => onConversationSelect(conversation)}
          className={clsx(
            'p-4 cursor-pointer transition-colors hover:bg-gray-50',
            selectedConversation?.id === conversation.id && 'bg-primary-50 border-r-2 border-primary-500'
          )}
        >
          <div className="flex items-start space-x-3">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
                {conversation.avatar ? (
                  <img
                    src={conversation.avatar}
                    alt={conversation.leadName}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <span className="text-sm font-medium text-primary-700">
                    {conversation.leadName.charAt(0)}
                  </span>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {conversation.leadName}
                  </p>
                  <span className="text-xs">
                    {getIntentIcon(conversation.intent)}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {conversation.unreadCount > 0 && (
                    <span className="bg-primary-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {conversation.unreadCount}
                    </span>
                  )}
                  <span className={clsx(
                    'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                    getStatusColor(conversation.status)
                  )}>
                    {conversation.status}
                  </span>
                </div>
              </div>

              <p className="text-xs text-gray-500 mb-2">
                {conversation.phoneNumber}
              </p>

              <p className="text-sm text-gray-600 truncate mb-1">
                {conversation.lastMessage}
              </p>

              <p className="text-xs text-gray-400">
                {formatTime(conversation.lastMessageTime)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
