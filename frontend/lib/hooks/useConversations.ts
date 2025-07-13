import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { conversationsApi, Conversation, ConversationDetails, Message, SendMessageRequest } from '@/lib/api/services/conversationsApi'
import { useAuth } from '@/lib/auth/AuthContext'
import { toast } from 'sonner'

// Query Keys
export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (agentId?: string, status?: string) => [...conversationKeys.lists(), agentId, status] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: string) => [...conversationKeys.details(), id] as const,
  messages: (id: string) => [...conversationKeys.all, 'messages', id] as const,
  search: (query: string, filters?: any) => [...conversationKeys.all, 'search', query, filters] as const,
  analytics: (id: string) => [...conversationKeys.all, 'analytics', id] as const,
  suggestions: (id: string, context?: string) => [...conversationKeys.all, 'suggestions', id, context] as const,
}

// Conversations List Hook
export function useConversations(
  agentId?: string,
  status?: string,
  limit = 50
) {
  return useInfiniteQuery({
    queryKey: conversationKeys.list(agentId, status),
    queryFn: ({ pageParam = 0 }) => 
      conversationsApi.getConversations(agentId, status, limit, pageParam),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.hasMore) {
        return pages.length * limit
      }
      return undefined
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    initialPageParam: 0,
  })
}

// Conversation Details Hook
export function useConversationDetails(conversationId: string) {
  return useQuery({
    queryKey: conversationKeys.detail(conversationId),
    queryFn: () => conversationsApi.getConversationDetails(conversationId),
    enabled: !!conversationId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Messages Hook
export function useMessages(conversationId: string, limit = 50) {
  return useInfiniteQuery({
    queryKey: conversationKeys.messages(conversationId),
    queryFn: ({ pageParam = 0 }) => 
      conversationsApi.getMessages(conversationId, limit, pageParam),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.hasMore) {
        return pages.length * limit
      }
      return undefined
    },
    enabled: !!conversationId,
    staleTime: 30 * 1000, // 30 seconds
    initialPageParam: 0,
  })
}

// Search Conversations Hook
export function useSearchConversations(
  query: string,
  agentId?: string,
  filters?: {
    status?: string
    dateFrom?: string
    dateTo?: string
    source?: string
  }
) {
  return useQuery({
    queryKey: conversationKeys.search(query, { agentId, ...filters }),
    queryFn: () => conversationsApi.searchConversations(query, agentId, filters),
    enabled: query.length > 2, // Only search if query is at least 3 characters
    staleTime: 1 * 60 * 1000, // 1 minute
  })
}

// Conversation Analytics Hook
export function useConversationAnalytics(conversationId: string) {
  return useQuery({
    queryKey: conversationKeys.analytics(conversationId),
    queryFn: () => conversationsApi.getConversationAnalytics(conversationId),
    enabled: !!conversationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Suggested Responses Hook
export function useSuggestedResponses(conversationId: string, context?: string) {
  return useQuery({
    queryKey: conversationKeys.suggestions(conversationId, context),
    queryFn: () => conversationsApi.getSuggestedResponses(conversationId, context),
    enabled: !!conversationId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

// Send Message Mutation
export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SendMessageRequest) => conversationsApi.sendMessage(request),
    onSuccess: (data, variables) => {
      // Update messages cache
      queryClient.setQueryData(
        conversationKeys.messages(variables.conversationId),
        (old: any) => {
          if (!old) return old
          
          const newMessage = data
          const firstPage = old.pages[0]
          
          return {
            ...old,
            pages: [
              {
                ...firstPage,
                messages: [newMessage, ...firstPage.messages],
                total: firstPage.total + 1,
              },
              ...old.pages.slice(1),
            ],
          }
        }
      )

      // Invalidate conversation details to update last message
      queryClient.invalidateQueries({
        queryKey: conversationKeys.detail(variables.conversationId)
      })

      // Invalidate conversations list to update last message time
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })

      toast.success('Message sent successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to send message', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Update Conversation Status Mutation
export function useUpdateConversationStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      conversationId, 
      status, 
      notes 
    }: { 
      conversationId: string
      status: 'active' | 'waiting' | 'converted' | 'lost' | 'paused'
      notes?: string 
    }) => conversationsApi.updateConversationStatus(conversationId, status, notes),
    onSuccess: (data, variables) => {
      // Update conversation in cache
      queryClient.setQueryData(
        conversationKeys.detail(variables.conversationId),
        (old: ConversationDetails | undefined) => {
          if (!old) return old
          return { ...old, status: variables.status }
        }
      )

      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })

      toast.success('Conversation status updated')
    },
    onError: (error: any) => {
      toast.error('Failed to update conversation status', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Update Lead Profile Mutation
export function useUpdateLeadProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      conversationId, 
      profile 
    }: { 
      conversationId: string
      profile: {
        leadName?: string
        email?: string
        budget?: string
        timeline?: string
        propertyType?: string
        locationPreference?: string
        notes?: string
      }
    }) => conversationsApi.updateLeadProfile(conversationId, profile),
    onSuccess: (data, variables) => {
      // Update conversation details in cache
      queryClient.setQueryData(
        conversationKeys.detail(variables.conversationId),
        data
      )

      // Invalidate conversations list to update lead name
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })

      toast.success('Lead profile updated')
    },
    onError: (error: any) => {
      toast.error('Failed to update lead profile', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Mark as Read Mutation
export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      conversationId, 
      messageIds 
    }: { 
      conversationId: string
      messageIds?: string[] 
    }) => conversationsApi.markAsRead(conversationId, messageIds),
    onSuccess: (data, variables) => {
      // Update conversations list to clear unread count
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })
    },
  })
}

// Archive Conversation Mutation
export function useArchiveConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      conversationId, 
      reason 
    }: { 
      conversationId: string
      reason?: string 
    }) => conversationsApi.archiveConversation(conversationId, reason),
    onSuccess: (data, variables) => {
      // Remove from conversations list
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })

      toast.success('Conversation archived')
    },
    onError: (error: any) => {
      toast.error('Failed to archive conversation', {
        description: error.message || 'Please try again',
      })
    },
  })
}

// Transfer Conversation Mutation
export function useTransferConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      conversationId, 
      targetAgentId, 
      notes 
    }: { 
      conversationId: string
      targetAgentId: string
      notes?: string 
    }) => conversationsApi.transferConversation(conversationId, targetAgentId, notes),
    onSuccess: (data, variables) => {
      // Invalidate conversations list
      queryClient.invalidateQueries({
        queryKey: conversationKeys.lists()
      })

      // Update conversation details
      queryClient.setQueryData(
        conversationKeys.detail(variables.conversationId),
        data
      )

      toast.success('Conversation transferred successfully')
    },
    onError: (error: any) => {
      toast.error('Failed to transfer conversation', {
        description: error.message || 'Please try again',
      })
    },
  })
}
