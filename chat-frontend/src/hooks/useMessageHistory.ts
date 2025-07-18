import { useState, useEffect, useCallback } from 'react'
import { Message, MessageHistoryRequest } from '@chat-types'
import { chatApi } from '@api/chatApi'

interface UseMessageHistoryResult {
  messages: Message[]
  isLoading: boolean
  error: string | null
  hasMore: boolean
  currentPage: number
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  loadInitialMessages: (conversationId: string) => Promise<void>
}

export const useMessageHistory = (): UseMessageHistoryResult => {
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)

  const loadMessages = useCallback(
    async (params: MessageHistoryRequest, append = false) => {
      if (isLoading) return

      setIsLoading(true)
      setError(null)

      try {
        const response = await chatApi.getMessageHistory(params)

        if (response.success && response.data) {
          const newMessages = response.data.data || []

          if (append) {
            setMessages((prev) => [...prev, ...newMessages])
          } else {
            setMessages(newMessages)
          }

          setHasMore(response.data.pagination.hasMore)
          setCurrentPage(response.data.pagination.page)
        } else {
          setError(response.error || 'Failed to load messages')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setIsLoading(false)
      }
    },
    [isLoading],
  )

  const loadInitialMessages = useCallback(
    async (conversationId: string) => {
      setCurrentConversationId(conversationId)
      setCurrentPage(1)
      setHasMore(true)
      setMessages([])

      await loadMessages({
        conversationId,
        page: 1,
        limit: 50,
      })
    },
    [loadMessages],
  )

  const loadMore = useCallback(async () => {
    if (!currentConversationId || !hasMore || isLoading) return

    const nextPage = currentPage + 1
    await loadMessages(
      {
        conversationId: currentConversationId,
        page: nextPage,
        limit: 50,
      },
      true,
    )
  }, [currentConversationId, hasMore, isLoading, currentPage, loadMessages])

  const refresh = useCallback(async () => {
    if (!currentConversationId) return

    setCurrentPage(1)
    setHasMore(true)

    await loadMessages({
      conversationId: currentConversationId,
      page: 1,
      limit: 50,
    })
  }, [currentConversationId, loadMessages])

  return {
    messages,
    isLoading,
    error,
    hasMore,
    currentPage,
    loadMore,
    refresh,
    loadInitialMessages,
  }
}
