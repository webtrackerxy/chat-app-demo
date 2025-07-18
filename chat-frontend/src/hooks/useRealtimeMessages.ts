import { useEffect, useState, useCallback } from 'react'
import { socketService } from '@services/socketService'
import { Message } from '@chat-types'

export interface UseRealtimeMessagesProps {
  conversationId: string
  isEnabled?: boolean
}

export const useRealtimeMessages = ({
  conversationId,
  isEnabled = true,
}: UseRealtimeMessagesProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize connection and join conversation
  useEffect(() => {
    if (!isEnabled) return

    const handleConnect = () => {
      setIsConnected(true)
      setError(null)
      console.log('Socket connected for conversation:', conversationId)
    }

    const handleDisconnect = () => {
      setIsConnected(false)
      console.log('Socket disconnected')
    }

    const handleError = (error: any) => {
      console.error('Socket error:', error)
      setError(error.message || 'Connection error')
    }

    // Connect to socket if not already connected
    if (!socketService.isConnected()) {
      socketService.connect()
    }

    // Set up connection listeners
    socketService.onConnect(handleConnect)
    socketService.onDisconnect(handleDisconnect)
    socketService.onError(handleError)

    // Join conversation room
    socketService.joinConversation(conversationId)

    // If already connected, update state
    if (socketService.isConnected()) {
      setIsConnected(true)
    }

    return () => {
      socketService.offConnect(handleConnect)
      socketService.offDisconnect(handleDisconnect)
      socketService.offError(handleError)
    }
  }, [conversationId, isEnabled])

  // Listen for new messages and read receipts
  useEffect(() => {
    if (!isEnabled) return

    const handleNewMessage = (message: Message) => {
      console.log('Received new message:', message)
      setMessages((prev) => {
        // Check if message already exists to avoid duplicates
        const exists = prev.some((m) => m.id === message.id)
        if (exists) {
          return prev
        }
        return [...prev, message]
      })
    }

    const handleMessageRead = (data: { messageId: string; readReceipt: any }) => {
      console.log('Message read receipt received:', data)
      setMessages((prev) => {
        return prev.map((message) => {
          if (message.id === data.messageId) {
            const existingReadBy = message.readBy || []
            const hasReadReceipt = existingReadBy.some(
              (receipt) => receipt.userId === data.readReceipt.userId,
            )

            if (!hasReadReceipt) {
              return {
                ...message,
                readBy: [...existingReadBy, data.readReceipt],
              }
            }
          }
          return message
        })
      })
    }

    const handleMessageDeleted = (data: { messageId: string; conversationId: string }) => {
      console.log('Message deleted received:', data)
      console.log('Current messages count before deletion:', messages.length)
      setMessages((prev) => {
        const filtered = prev.filter((message) => message.id !== data.messageId)
        console.log('Messages count after deletion:', filtered.length)
        console.log('Deleted message found:', prev.length !== filtered.length)
        return filtered
      })
    }

    socketService.onNewMessage(handleNewMessage)
    socketService.onMessageRead(handleMessageRead)
    socketService.onMessageDeleted(handleMessageDeleted)

    return () => {
      socketService.offNewMessage(handleNewMessage)
      socketService.offMessageRead(handleMessageRead)
      socketService.offMessageDeleted(handleMessageDeleted)
    }
  }, [isEnabled])

  // Send message function
  const sendMessage = useCallback(
    (text: string, senderId: string, senderName: string) => {
      if (!isConnected) {
        setError('Not connected to server')
        return
      }

      socketService.sendMessage({
        text,
        senderId,
        senderName,
        conversationId,
      })
    },
    [conversationId, isConnected],
  )

  // Delete message function
  const deleteMessage = useCallback(
    (messageId: string, userId: string) => {
      console.log('useRealtimeMessages.deleteMessage called:', {
        messageId,
        userId,
        conversationId,
      })
      console.log('isConnected:', isConnected)

      if (!isConnected) {
        console.error('Not connected to server')
        setError('Not connected to server')
        return
      }

      socketService.deleteMessage(messageId, conversationId, userId)
    },
    [conversationId, isConnected],
  )

  // Clear messages (useful for conversation switches)
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // Manually set messages (for initial load from API)
  const setInitialMessages = useCallback(
    (initialMessages: Message[]) => {
      console.log(
        'Setting initial messages:',
        initialMessages.length,
        'messages for conversation:',
        conversationId,
      )
      // Only set messages if we have actual messages to prevent clearing existing ones
      if (initialMessages.length > 0) {
        setMessages(initialMessages)
      }
    },
    [conversationId],
  )

  return {
    messages,
    isConnected,
    error,
    sendMessage,
    deleteMessage,
    clearMessages,
    setInitialMessages,
  }
}
