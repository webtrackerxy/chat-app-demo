import { useState, useCallback } from 'react'
import { chatApi } from '@api/chatApi'
import {
  MessageSearchResult,
  Conversation,
  MessageSearchRequest,
  ConversationSearchRequest,
} from '@chat-types'

export interface UseMessageSearchReturn {
  messageResults: MessageSearchResult[]
  conversationResults: Conversation[]
  isLoading: boolean
  error: string | null
  searchMessages: (query: string, conversationId?: string, limit?: number) => Promise<void>
  searchConversations: (query: string, userId: string) => Promise<void>
  clearResults: () => void
  clearError: () => void
  lastQuery: string | null
  resultCount: number
}

export const useMessageSearch = (): UseMessageSearchReturn => {
  const [messageResults, setMessageResults] = useState<MessageSearchResult[]>([])
  const [conversationResults, setConversationResults] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastQuery, setLastQuery] = useState<string | null>(null)
  const [resultCount, setResultCount] = useState(0)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const clearResults = useCallback(() => {
    setMessageResults([])
    setConversationResults([])
    setLastQuery(null)
    setResultCount(0)
    setError(null)
  }, [])

  const searchMessages = useCallback(
    async (query: string, conversationId?: string, limit?: number) => {
      if (!query.trim()) {
        setError('Search query cannot be empty')
        return
      }

      setIsLoading(true)
      setError(null)
      setLastQuery(query.trim())

      try {
        const request: MessageSearchRequest = {
          query: query.trim(),
          conversationId,
          limit,
        }

        const response = await chatApi.searchMessagesAdvanced(request)

        if (response.success) {
          setMessageResults(response.data.data)
          setResultCount(response.data.meta.totalResults)
        } else {
          setError(response.error || 'Failed to search messages')
          setMessageResults([])
          setResultCount(0)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error occurred')
        setMessageResults([])
        setResultCount(0)
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const searchConversations = useCallback(async (query: string, userId: string) => {
    if (!query.trim()) {
      setError('Search query cannot be empty')
      return
    }

    if (!userId) {
      setError('User ID is required')
      return
    }

    setIsLoading(true)
    setError(null)
    setLastQuery(query.trim())

    try {
      const request: ConversationSearchRequest = {
        query: query.trim(),
        userId,
      }

      const response = await chatApi.searchConversations(request)

      if (response.success) {
        setConversationResults(response.data.data)
        setResultCount(response.data.meta.totalResults)
      } else {
        setError(response.error || 'Failed to search conversations')
        setConversationResults([])
        setResultCount(0)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
      setConversationResults([])
      setResultCount(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return {
    messageResults,
    conversationResults,
    isLoading,
    error,
    searchMessages,
    searchConversations,
    clearResults,
    clearError,
    lastQuery,
    resultCount,
  }
}
