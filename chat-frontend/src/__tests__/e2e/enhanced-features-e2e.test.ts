import { renderHook, act } from '@testing-library/react-native'
import { useRealtimeMessages } from '@hooks/useRealtimeMessages'
import { useReadReceipts } from '@hooks/useReadReceipts'
import { useUserPresence } from '@hooks/useUserPresence'
import { useMessageReactions } from '@hooks/useMessageReactions'
import { socketService } from '@services/socketService'
import { Message, MessageReaction, ReadReceipt, UserPresence } from '@chat-types'

// Mock the socketService
jest.mock('@services/socketService')

const mockSocketService = socketService as jest.Mocked<typeof socketService>

describe('Enhanced Features End-to-End Tests', () => {
  const mockConversationId = 'test-conversation'
  const mockUserId = 'current-user'
  const mockUserName = 'Current User'
  const mockOtherUserId = 'other-user'
  const mockOtherUserName = 'Other User'

  // Mock callbacks that will be registered
  let newMessageCallback: Function
  let messageReadCallback: Function
  let reactionAddedCallback: Function
  let reactionRemovedCallback: Function
  let presenceUpdateCallback: Function
  let connectCallback: Function
  let disconnectCallback: Function

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock socketService methods
    mockSocketService.isConnected.mockReturnValue(true)
    mockSocketService.connect.mockReturnValue({} as any)
    mockSocketService.disconnect.mockReturnValue(undefined)

    // Capture callbacks when they are registered
    mockSocketService.onNewMessage.mockImplementation((callback) => {
      newMessageCallback = callback
    })
    mockSocketService.onMessageRead.mockImplementation((callback) => {
      messageReadCallback = callback
    })
    mockSocketService.onReactionAdded.mockImplementation((callback) => {
      reactionAddedCallback = callback
    })
    mockSocketService.onReactionRemoved.mockImplementation((callback) => {
      reactionRemovedCallback = callback
    })
    mockSocketService.onUserPresenceUpdate.mockImplementation((callback) => {
      presenceUpdateCallback = callback
    })
    mockSocketService.onConnect.mockImplementation((callback) => {
      connectCallback = callback
    })
    mockSocketService.onDisconnect.mockImplementation((callback) => {
      disconnectCallback = callback
    })
  })

  describe('Complete Message Lifecycle with Enhanced Features', () => {
    it('should handle complete message flow: send -> receive -> read -> react -> presence', async () => {
      // Initialize all hooks
      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        }),
      )

      const { result: readReceiptsResult } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const { result: presenceResult } = renderHook(() =>
        useUserPresence({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      // Step 1: Other user comes online
      act(() => {
        presenceUpdateCallback({
          userId: mockOtherUserId,
          userName: mockOtherUserName,
          isOnline: true,
          conversationId: mockConversationId,
        })
      })

      expect(presenceResult.current.isUserOnline(mockOtherUserId)).toBe(true)
      expect(presenceResult.current.getOnlineCount()).toBe(1)

      // Step 2: Current user sends a message
      act(() => {
        messageResult.current.sendMessage('Hello, how are you?', mockUserId, mockUserName)
      })

      expect(mockSocketService.sendMessage).toHaveBeenCalledWith({
        text: 'Hello, how are you?',
        senderId: mockUserId,
        senderName: mockUserName,
        conversationId: mockConversationId,
      })

      // Step 3: Receive the sent message (as it would come from server)
      const sentMessage: Message = {
        id: 'message-1',
        text: 'Hello, how are you?',
        type: 'text',
        senderId: mockUserId,
        senderName: mockUserName,
        timestamp: new Date(),
        readBy: [],
        reactions: [],
      }

      act(() => {
        newMessageCallback(sentMessage)
      })

      expect(messageResult.current.messages).toHaveLength(1)
      expect(messageResult.current.messages[0]).toEqual(sentMessage)

      // Step 4: Other user receives and reads the message
      act(() => {
        messageReadCallback({
          messageId: sentMessage.id,
          readReceipt: {
            userId: mockOtherUserId,
            userName: mockOtherUserName,
            readAt: new Date(),
          },
        })
      })

      // Step 5: Other user sends a reply
      const replyMessage: Message = {
        id: 'message-2',
        text: 'I am doing great, thanks!',
        type: 'text',
        senderId: mockOtherUserId,
        senderName: mockOtherUserName,
        timestamp: new Date(),
        readBy: [],
        reactions: [],
      }

      act(() => {
        newMessageCallback(replyMessage)
      })

      expect(messageResult.current.messages).toHaveLength(2)
      expect(messageResult.current.messages[1]).toEqual(replyMessage)

      // Step 6: Current user reads the reply
      act(() => {
        readReceiptsResult.current.markAsRead(replyMessage.id)
      })

      expect(mockSocketService.markMessageAsRead).toHaveBeenCalledWith(
        replyMessage.id,
        mockConversationId,
        mockUserId,
        mockUserName,
      )

      // Step 7: Current user adds a reaction to the reply
      act(() => {
        reactionsResult.current.addReaction(replyMessage.id, '👍')
      })

      expect(mockSocketService.addReaction).toHaveBeenCalledWith(
        replyMessage.id,
        mockConversationId,
        mockUserId,
        mockUserName,
        '👍',
      )

      // Step 8: Receive the reaction added event
      const mockReaction: MessageReaction = {
        id: 'reaction-1',
        userId: mockUserId,
        userName: mockUserName,
        emoji: '👍',
        timestamp: new Date(),
      }

      act(() => {
        reactionAddedCallback({
          messageId: replyMessage.id,
          reaction: mockReaction,
        })
      })

      expect(reactionsResult.current.getMessageReactions(replyMessage.id)).toHaveLength(1)
      expect(reactionsResult.current.hasUserReacted(replyMessage.id, '👍')).toBe(true)

      // Step 9: Other user also reacts to the same message
      const otherUserReaction: MessageReaction = {
        id: 'reaction-2',
        userId: mockOtherUserId,
        userName: mockOtherUserName,
        emoji: '👍',
        timestamp: new Date(),
      }

      act(() => {
        reactionAddedCallback({
          messageId: replyMessage.id,
          reaction: otherUserReaction,
        })
      })

      expect(reactionsResult.current.getMessageReactions(replyMessage.id)).toHaveLength(2)
      const reactionSummary = reactionsResult.current.getReactionSummary(replyMessage.id)
      expect(reactionSummary[0].count).toBe(2)
      expect(reactionSummary[0].emoji).toBe('👍')

      // Step 10: Other user goes offline
      act(() => {
        presenceUpdateCallback({
          userId: mockOtherUserId,
          userName: mockOtherUserName,
          isOnline: false,
          lastSeen: new Date(),
          conversationId: mockConversationId,
        })
      })

      expect(presenceResult.current.isUserOnline(mockOtherUserId)).toBe(false)
      expect(presenceResult.current.getOnlineCount()).toBe(0)
    })
  })

  describe('Concurrent User Interactions', () => {
    it('should handle multiple users reacting simultaneously', () => {
      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const messageId = 'message-1'
      const users = [
        { id: 'user1', name: 'User One' },
        { id: 'user2', name: 'User Two' },
        { id: 'user3', name: 'User Three' },
      ]

      const emojis = ['👍', '❤️', '😂']

      // Simulate multiple users adding reactions concurrently
      act(() => {
        users.forEach((user, index) => {
          const reaction: MessageReaction = {
            id: `reaction-${index + 1}`,
            userId: user.id,
            userName: user.name,
            emoji: emojis[index],
            timestamp: new Date(),
          }

          reactionAddedCallback({
            messageId,
            reaction,
          })
        })
      })

      expect(reactionsResult.current.getMessageReactions(messageId)).toHaveLength(3)

      const grouped = reactionsResult.current.getGroupedReactions(messageId)
      expect(grouped.size).toBe(3)
      expect(grouped.get('👍')).toHaveLength(1)
      expect(grouped.get('❤️')).toHaveLength(1)
      expect(grouped.get('😂')).toHaveLength(1)
    })

    it('should handle multiple users reading messages simultaneously', () => {
      const { result: readReceiptsResult } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const messageId = 'message-1'
      const readReceipts: ReadReceipt[] = [
        { userId: 'user1', userName: 'User One', readAt: new Date() },
        { userId: 'user2', userName: 'User Two', readAt: new Date() },
        { userId: 'user3', userName: 'User Three', readAt: new Date() },
      ]

      // Simulate multiple read receipts coming in
      act(() => {
        readReceipts.forEach((receipt) => {
          messageReadCallback({
            messageId,
            readReceipt: receipt,
          })
        })
      })

      expect(readReceiptsResult.current.getReadStatusText(readReceipts)).toBe(
        'Read by User One and 2 others',
      )
    })
  })

  describe('Connection State Management', () => {
    it('should handle connection loss and reconnection gracefully', () => {
      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        }),
      )

      const { result: presenceResult } = renderHook(() =>
        useUserPresence({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      // Initially connected
      expect(messageResult.current.isConnected).toBe(true)
      expect(presenceResult.current.isConnected).toBe(true)

      // Simulate connection loss
      mockSocketService.isConnected.mockReturnValue(false)

      act(() => {
        disconnectCallback()
      })

      expect(messageResult.current.isConnected).toBe(false)
      expect(presenceResult.current.isConnected).toBe(false)

      // Simulate reconnection
      mockSocketService.isConnected.mockReturnValue(true)

      act(() => {
        connectCallback()
      })

      expect(messageResult.current.isConnected).toBe(true)
      expect(presenceResult.current.isConnected).toBe(true)
    })

    it('should not perform actions when disconnected', () => {
      mockSocketService.isConnected.mockReturnValue(false)

      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        }),
      )

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const { result: readReceiptsResult } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      // Try to perform actions when disconnected
      act(() => {
        messageResult.current.sendMessage('Test message', mockUserId, mockUserName)
        reactionsResult.current.addReaction('message-1', '👍')
        readReceiptsResult.current.markAsRead('message-1')
      })

      // Should not call socket methods when disconnected
      expect(mockSocketService.sendMessage).not.toHaveBeenCalled()
      expect(mockSocketService.addReaction).not.toHaveBeenCalled()
      expect(mockSocketService.markMessageAsRead).not.toHaveBeenCalled()
    })
  })

  describe('Feature Toggle Scenarios', () => {
    it('should respect feature toggle settings', () => {
      // Test with all features disabled
      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: false,
        }),
      )

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: false,
        }),
      )

      const { result: readReceiptsResult } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: false,
        }),
      )

      // Should not set up listeners when disabled
      expect(mockSocketService.onNewMessage).not.toHaveBeenCalled()
      expect(mockSocketService.onReactionAdded).not.toHaveBeenCalled()
      expect(mockSocketService.onMessageRead).not.toHaveBeenCalled()

      // Actions should not call socket methods when disabled
      act(() => {
        messageResult.current.sendMessage('Test message', mockUserId, mockUserName)
        reactionsResult.current.addReaction('message-1', '👍')
        readReceiptsResult.current.markAsRead('message-1')
      })

      expect(mockSocketService.sendMessage).not.toHaveBeenCalled()
      expect(mockSocketService.addReaction).not.toHaveBeenCalled()
      expect(mockSocketService.markMessageAsRead).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling Scenarios', () => {
    it('should handle malformed events gracefully', () => {
      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        }),
      )

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      // Test with malformed message
      expect(() => {
        act(() => {
          newMessageCallback({
            id: 'malformed-message',
            // Missing required fields
          })
        })
      }).not.toThrow()

      // Test with malformed reaction
      expect(() => {
        act(() => {
          reactionAddedCallback({
            messageId: 'message-1',
            reaction: {
              // Missing required fields
            },
          })
        })
      }).not.toThrow()

      // Should not crash the application
      expect(messageResult.current.messages).toEqual([])
      expect(reactionsResult.current.getMessageReactions('message-1')).toEqual([])
    })
  })

  describe('Performance and Memory Management', () => {
    it('should clean up event listeners on unmount', () => {
      const { unmount: unmountMessage } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        }),
      )

      const { unmount: unmountReactions } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const { unmount: unmountReadReceipts } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const { unmount: unmountPresence } = renderHook(() =>
        useUserPresence({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      // Unmount all hooks
      unmountMessage()
      unmountReactions()
      unmountReadReceipts()
      unmountPresence()

      // Verify cleanup methods were called
      expect(mockSocketService.offNewMessage).toHaveBeenCalled()
      expect(mockSocketService.offReactionAdded).toHaveBeenCalled()
      expect(mockSocketService.offReactionRemoved).toHaveBeenCalled()
      expect(mockSocketService.offMessageRead).toHaveBeenCalled()
      expect(mockSocketService.offUserPresenceUpdate).toHaveBeenCalled()
    })

    it('should handle rapid state updates without performance issues', () => {
      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const messageId = 'message-1'

      // Simulate rapid reaction updates
      act(() => {
        for (let i = 0; i < 100; i++) {
          const reaction: MessageReaction = {
            id: `reaction-${i}`,
            userId: `user-${i}`,
            userName: `User ${i}`,
            emoji: '👍',
            timestamp: new Date(),
          }

          reactionAddedCallback({
            messageId,
            reaction,
          })
        }
      })

      // Should handle all reactions without performance issues
      expect(reactionsResult.current.getMessageReactions(messageId)).toHaveLength(100)
      expect(reactionsResult.current.getTotalReactionCount(messageId)).toBe(100)
    })
  })

  describe('Cross-Feature Integration', () => {
    it('should maintain consistency across all features', () => {
      // Initialize all hooks
      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        }),
      )

      const { result: readReceiptsResult } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      const { result: presenceResult } = renderHook(() =>
        useUserPresence({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        }),
      )

      // Test that all features work together
      const testMessage: Message = {
        id: 'test-message',
        text: 'Test message for integration',
        type: 'text',
        senderId: mockOtherUserId,
        senderName: mockOtherUserName,
        timestamp: new Date(),
        readBy: [],
        reactions: [],
      }

      // 1. User comes online
      act(() => {
        presenceUpdateCallback({
          userId: mockOtherUserId,
          userName: mockOtherUserName,
          isOnline: true,
          conversationId: mockConversationId,
        })
      })

      // 2. Message is received
      act(() => {
        newMessageCallback(testMessage)
      })

      // 3. Message is read
      act(() => {
        readReceiptsResult.current.markAsRead(testMessage.id)
      })

      // 4. Reaction is added
      act(() => {
        reactionsResult.current.addReaction(testMessage.id, '👍')
      })

      // Verify all features are working together
      expect(messageResult.current.messages).toHaveLength(1)
      expect(presenceResult.current.isUserOnline(mockOtherUserId)).toBe(true)
      expect(mockSocketService.markMessageAsRead).toHaveBeenCalledWith(
        testMessage.id,
        mockConversationId,
        mockUserId,
        mockUserName,
      )
      expect(mockSocketService.addReaction).toHaveBeenCalledWith(
        testMessage.id,
        mockConversationId,
        mockUserId,
        mockUserName,
        '👍',
      )
    })
  })
})
