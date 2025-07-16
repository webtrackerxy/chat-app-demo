import { useEffect, useCallback } from 'react'
import { socketService } from '@services/socketService'
import { ReadReceipt } from '@chat-types'

export interface UseReadReceiptsProps {
  conversationId: string
  userId: string
  userName: string
  isEnabled?: boolean
}

export const useReadReceipts = ({
  conversationId,
  userId,
  userName,
  isEnabled = true,
}: UseReadReceiptsProps) => {
  // Listen for read receipt updates
  useEffect(() => {
    if (!isEnabled || !socketService.isConnected()) return

    const handleMessageRead = (data: { messageId: string; readReceipt: ReadReceipt }) => {
      console.log('Message read receipt received:', data)
      // This will be handled by the parent component or store
    }

    socketService.onMessageRead(handleMessageRead)

    return () => {
      socketService.offMessageRead(handleMessageRead)
    }
  }, [isEnabled])

  // Mark a message as read
  const markAsRead = useCallback(
    (messageId: string) => {
      if (!isEnabled || !socketService.isConnected()) return

      socketService.markMessageAsRead(messageId, conversationId, userId, userName)
    },
    [conversationId, userId, userName, isEnabled],
  )

  // Mark multiple messages as read
  const markMultipleAsRead = useCallback(
    (messageIds: string[]) => {
      if (!isEnabled || !socketService.isConnected()) return

      messageIds.forEach((messageId) => {
        socketService.markMessageAsRead(messageId, conversationId, userId, userName)
      })
    },
    [conversationId, userId, userName, isEnabled],
  )

  // Auto-mark messages as read when they come into view
  const autoMarkAsRead = useCallback(
    (messageId: string, delay: number = 1000) => {
      if (!isEnabled || !socketService.isConnected()) return

      // Mark as read after a delay to simulate "reading time"
      setTimeout(() => {
        socketService.markMessageAsRead(messageId, conversationId, userId, userName)
      }, delay)
    },
    [conversationId, userId, userName, isEnabled],
  )

  // Get read status text for a message
  const getReadStatusText = useCallback(
    (readBy: ReadReceipt[] = []) => {
      if (readBy.length === 0) return ''

      const readByOthers = readBy.filter((receipt) => receipt.userId !== userId)

      if (readByOthers.length === 0) return ''

      if (readByOthers.length === 1) {
        return `Read by ${readByOthers[0].userName}`
      } else if (readByOthers.length === 2) {
        return `Read by ${readByOthers[0].userName} and ${readByOthers[1].userName}`
      } else {
        return `Read by ${readByOthers[0].userName} and ${readByOthers.length - 1} others`
      }
    },
    [userId],
  )

  // Check if a message has been read by a specific user
  const hasBeenReadBy = useCallback((readBy: ReadReceipt[] = [], targetUserId: string) => {
    return readBy.some((receipt) => receipt.userId === targetUserId)
  }, [])

  // Check if current user has read a message
  const hasCurrentUserRead = useCallback(
    (readBy: ReadReceipt[] = []) => {
      return hasBeenReadBy(readBy, userId)
    },
    [hasBeenReadBy, userId],
  )

  // Get read receipts for a specific message
  const getMessageReadReceipts = useCallback((messageId: string) => {
    // This would typically fetch from a store or API
    // For now, returning empty array as placeholder
    return []
  }, [])

  return {
    markAsRead,
    markMultipleAsRead,
    autoMarkAsRead,
    getReadStatusText,
    hasBeenReadBy,
    hasCurrentUserRead,
    getMessageReadReceipts,
    isConnected: socketService.isConnected(),
  }
}
