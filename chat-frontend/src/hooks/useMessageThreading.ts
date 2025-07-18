import { useState, useCallback } from 'react'
import { chatApi } from '@api/chatApi'
import { Message, ThreadReplyRequest } from '@chat-types'

export interface UseMessageThreadingReturn {
  threads: Record<string, Message[]>
  isLoading: boolean
  error: string | null
  loadThread: (threadId: string) => Promise<void>
  createThreadReply: (
    messageId: string,
    text: string,
    senderId: string,
    conversationId: string,
  ) => Promise<Message | null>
  getThreadMessages: (threadId: string) => Message[]
  clearError: () => void
}

export const useMessageThreading = (): UseMessageThreadingReturn => {
  const [threads, setThreads] = useState<Record<string, Message[]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const loadThread = useCallback(async (threadId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await chatApi.getThread(threadId)

      if (response.success) {
        setThreads((prev) => ({
          ...prev,
          [threadId]: response.data,
        }))
      } else {
        setError(response.error || 'Failed to load thread')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const createThreadReply = useCallback(
    async (
      messageId: string,
      text: string,
      senderId: string,
      conversationId: string,
    ): Promise<Message | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const request: ThreadReplyRequest = {
          text,
          senderId,
          conversationId,
        }

        const response = await chatApi.createThreadReply(messageId, request)

        if (response.success) {
          const newMessage = response.data
          const threadId = newMessage.threadId || messageId

          // Add the new message to the thread
          setThreads((prev) => ({
            ...prev,
            [threadId]: [...(prev[threadId] || []), newMessage],
          }))

          return newMessage
        } else {
          setError(response.error || 'Failed to create thread reply')
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

  const getThreadMessages = useCallback(
    (threadId: string): Message[] => {
      return threads[threadId] || []
    },
    [threads],
  )

  return {
    threads,
    isLoading,
    error,
    loadThread,
    createThreadReply,
    getThreadMessages,
    clearError,
  }
}
