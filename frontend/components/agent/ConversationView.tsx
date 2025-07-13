'use client'

import { useState, useRef, useEffect } from 'react'
import { format } from 'date-fns'
import {
  PaperAirplaneIcon,
  PhoneIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
  EllipsisVerticalIcon,
} from '@heroicons/react/24/outline'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
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

interface ConversationViewProps {
  conversation: Conversation
  messages: Message[]
  onSendMessage: (message: string) => void
  connected: boolean
}

export function ConversationView({
  conversation,
  messages,
  onSendMessage,
  connected,
}: ConversationViewProps) {
  const [newMessage, setNewMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`
    }
  }, [newMessage])

  const handleSendMessage = () => {
    if (!newMessage.trim() || !connected) return

    onSendMessage(newMessage.trim())
    setNewMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'sent':
        return '✓'
      case 'delivered':
        return '✓✓'
      case 'read':
        return '✓✓'
      default:
        return ''
    }
  }

  const getSenderName = (sender: string) => {
    switch (sender) {
      case 'lead':
        return conversation.leadName
      case 'bot':
        return 'Doro (Bot)'
      case 'agent':
        return 'You'
      default:
        return sender
    }
  }

  const getSenderColor = (sender: string) => {
    switch (sender) {
      case 'lead':
        return 'text-gray-900'
      case 'bot':
        return 'text-primary-600'
      case 'agent':
        return 'text-green-600'
      default:
        return 'text-gray-900'
    }
  }

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-primary-700">
                {conversation.leadName.charAt(0)}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {conversation.leadName}
              </h2>
              <div className="flex items-center space-x-2">
                <p className="text-sm text-gray-500">{conversation.phoneNumber}</p>
                <span className={clsx(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                  getStatusColor(conversation.status)
                )}>
                  {conversation.status}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button className="btn-ghost p-2">
              <PhoneIcon className="h-5 w-5" />
            </button>
            <button className="btn-ghost p-2">
              <CalendarDaysIcon className="h-5 w-5" />
            </button>
            <button className="btn-ghost p-2">
              <InformationCircleIcon className="h-5 w-5" />
            </button>

            <Menu as="div" className="relative">
              <Menu.Button className="btn-ghost p-2">
                <EllipsisVerticalIcon className="h-5 w-5" />
              </Menu.Button>

              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={clsx(
                          active ? 'bg-gray-100' : '',
                          'block w-full px-4 py-2 text-left text-sm text-gray-700'
                        )}
                      >
                        View Lead Profile
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={clsx(
                          active ? 'bg-gray-100' : '',
                          'block w-full px-4 py-2 text-left text-sm text-gray-700'
                        )}
                      >
                        Schedule Appointment
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        className={clsx(
                          active ? 'bg-gray-100' : '',
                          'block w-full px-4 py-2 text-left text-sm text-gray-700'
                        )}
                      >
                        Export Conversation
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message, index) => {
          const isFromLead = message.sender === 'lead'
          const isFromBot = message.sender === 'bot'
          const previousMessage = messages[index - 1]
          const showTimestamp = index === 0 ||
            (previousMessage && new Date(message.timestamp).getTime() - new Date(previousMessage.timestamp).getTime() > 300000) // 5 minutes

          return (
            <div key={message.id}>
              {showTimestamp && (
                <div className="text-center text-xs text-gray-500 mb-4">
                  {format(new Date(message.timestamp), 'MMM d, yyyy h:mm a')}
                </div>
              )}

              <div className={clsx(
                'flex',
                isFromLead ? 'justify-start' : 'justify-end'
              )}>
                <div className={clsx(
                  'max-w-xs lg:max-w-md px-4 py-2 rounded-2xl',
                  isFromLead 
                    ? 'bg-white text-gray-900 rounded-bl-sm' 
                    : isFromBot
                    ? 'bg-primary-100 text-primary-900 rounded-br-sm'
                    : 'bg-primary-600 text-white rounded-br-sm'
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={clsx(
                      'text-xs font-medium',
                      getSenderColor(message.sender)
                    )}>
                      {getSenderName(message.sender)}
                    </span>
                    {message.templateName && (
                      <span className="text-xs text-gray-500 ml-2">
                        Template: {message.templateName}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs opacity-70">
                      {format(new Date(message.timestamp), 'h:mm a')}
                    </span>
                    {!isFromLead && (
                      <span className="text-xs opacity-70">
                        {getMessageStatusIcon(message.status)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-900 px-4 py-2 rounded-2xl rounded-bl-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={connected ? "Type a message..." : "Disconnected - cannot send messages"}
              disabled={!connected}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || !connected}
            className="btn-primary p-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>

        {!connected && (
          <p className="text-xs text-red-500 mt-2">
            Connection lost. Trying to reconnect...
          </p>
        )}
      </div>
    </div>
  )
}
