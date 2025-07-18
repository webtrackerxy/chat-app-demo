import { useState, useCallback } from 'react'
import { chatApi } from '@api/chatApi'
import { UserListResponse, Conversation, DirectConversationRequest } from '@chat-types'

export interface UsePrivateMessagingReturn {
  users: UserListResponse[]
  directConversations: Conversation[]
  isLoading: boolean
  error: string | null
  loadUsers: (currentUserId: string) => Promise<void>
  loadDirectConversations: (userId: string) => Promise<void>
  createDirectConversation: (user1Id: string, user2Id: string) => Promise<Conversation | null>
  clearError: () => void
}

export const usePrivateMessaging = (): UsePrivateMessagingReturn => {
  const [users, setUsers] = useState<UserListResponse[]>([])
  const [directConversations, setDirectConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const loadUsers = useCallback(async (currentUserId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await chatApi.getAllUsers(currentUserId)

      if (response.success) {
        setUsers(response.data)
      } else {
        setError(response.error || 'Failed to load users')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadDirectConversations = useCallback(async (userId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await chatApi.getDirectConversations(userId)

      if (response.success) {
        setDirectConversations(response.data)
      } else {
        setError(response.error || 'Failed to load direct conversations')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createDirectConversation = useCallback(
    async (user1Id: string, user2Id: string): Promise<Conversation | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const request: DirectConversationRequest = { user1Id, user2Id }
        const response = await chatApi.createDirectConversation(request)

        if (response.success) {
          // Add the new conversation to the list
          setDirectConversations((prev) => [response.data, ...prev])
          return response.data
        } else {
          setError(response.error || 'Failed to create direct conversation')
          return null
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return {
    users,
    directConversations,
    isLoading,
    error,
    loadUsers,
    loadDirectConversations,
    createDirectConversation,
    clearError,
  }
}
