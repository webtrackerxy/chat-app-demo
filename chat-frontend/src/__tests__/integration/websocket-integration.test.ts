import { act, renderHook } from '@testing-library/react-native';
import { socketService } from '../../services/socketService';
import { useRealtimeMessages } from '../../hooks/useRealtimeMessages';
import { useReadReceipts } from '../../hooks/useReadReceipts';
import { useUserPresence } from '../../hooks/useUserPresence';
import { useMessageReactions } from '../../hooks/useMessageReactions';

// Mock socketService
jest.mock('../../services/socketService', () => ({
  socketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn(),
    getSocket: jest.fn(),
    joinConversation: jest.fn(),
    sendMessage: jest.fn(),
    onNewMessage: jest.fn(),
    offNewMessage: jest.fn(),
    markMessageAsRead: jest.fn(),
    onMessageRead: jest.fn(),
    offMessageRead: jest.fn(),
    setUserOnline: jest.fn(),
    onUserPresenceUpdate: jest.fn(),
    offUserPresenceUpdate: jest.fn(),
    addReaction: jest.fn(),
    removeReaction: jest.fn(),
    onReactionAdded: jest.fn(),
    onReactionRemoved: jest.fn(),
    offReactionAdded: jest.fn(),
    offReactionRemoved: jest.fn(),
    onConnect: jest.fn(),
    onDisconnect: jest.fn(),
    offConnect: jest.fn(),
  },
}));

describe('WebSocket Integration Tests', () => {
  const mockConversationId = 'test-conversation';
  const mockUserId = 'test-user';
  const mockUserName = 'Test User';

  beforeEach(() => {
    jest.clearAllMocks();
    (socketService.isConnected as jest.Mock).mockReturnValue(true);
  });

  describe('Real-time messaging flow', () => {
    it('should handle complete message flow: send -> receive -> read -> react', async () => {
      // Set up callbacks
      let newMessageCallback: Function;
      let messageReadCallback: Function;
      let reactionAddedCallback: Function;
      let presenceUpdateCallback: Function;

      (socketService.onNewMessage as jest.Mock).mockImplementation((callback) => {
        newMessageCallback = callback;
      });
      (socketService.onMessageRead as jest.Mock).mockImplementation((callback) => {
        messageReadCallback = callback;
      });
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });
      (socketService.onUserPresenceUpdate as jest.Mock).mockImplementation((callback) => {
        presenceUpdateCallback = callback;
      });

      // Initialize hooks
      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        })
      );

      const { result: readReceiptsResult } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      const { result: presenceResult } = renderHook(() =>
        useUserPresence({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      // Step 1: User comes online
      act(() => {
        presenceUpdateCallback({
          userId: 'other-user',
          userName: 'Other User',
          isOnline: true,
        });
      });

      expect(presenceResult.current.onlineUsers).toHaveLength(1);
      expect(presenceResult.current.onlineUsers[0].userName).toBe('Other User');

      // Step 2: Receive a new message
      const mockMessage = {
        id: 'test-message-1',
        text: 'Hello, this is a test message!',
        senderId: 'other-user',
        senderName: 'Other User',
        timestamp: new Date(),
        readBy: [],
        reactions: [],
      };

      act(() => {
        newMessageCallback(mockMessage);
      });

      expect(messageResult.current.messages).toHaveLength(1);
      expect(messageResult.current.messages[0]).toEqual(mockMessage);

      // Step 3: Mark message as read
      act(() => {
        readReceiptsResult.current.markAsRead(mockMessage.id);
      });

      expect(socketService.markMessageAsRead).toHaveBeenCalledWith(
        mockMessage.id,
        mockConversationId,
        mockUserId,
        mockUserName
      );

      // Step 4: Receive read receipt
      const readReceipt = {
        userId: mockUserId,
        userName: mockUserName,
        readAt: new Date(),
      };

      act(() => {
        messageReadCallback({
          messageId: mockMessage.id,
          readReceipt,
        });
      });

      // Step 5: Add reaction to message
      act(() => {
        reactionsResult.current.addReaction(mockMessage.id, '👍');
      });

      expect(socketService.addReaction).toHaveBeenCalledWith(
        mockMessage.id,
        mockConversationId,
        mockUserId,
        mockUserName,
        '👍'
      );

      // Step 6: Receive reaction added event
      const mockReaction = {
        id: 'reaction-1',
        userId: mockUserId,
        userName: mockUserName,
        emoji: '👍',
        timestamp: new Date(),
      };

      act(() => {
        reactionAddedCallback({
          messageId: mockMessage.id,
          reaction: mockReaction,
        });
      });

      expect(reactionsResult.current.getMessageReactions(mockMessage.id)).toHaveLength(1);
      expect(reactionsResult.current.getMessageReactions(mockMessage.id)[0]).toEqual(mockReaction);

      // Step 7: User goes offline
      act(() => {
        presenceUpdateCallback({
          userId: 'other-user',
          userName: 'Other User',
          isOnline: false,
          lastSeen: new Date(),
        });
      });

      expect(presenceResult.current.offlineUsers).toHaveLength(1);
      expect(presenceResult.current.offlineUsers[0].userName).toBe('Other User');
    });

    it('should handle concurrent reactions from multiple users', () => {
      let reactionAddedCallback: Function;
      let reactionRemovedCallback: Function;

      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });
      (socketService.onReactionRemoved as jest.Mock).mockImplementation((callback) => {
        reactionRemovedCallback = callback;
      });

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      const messageId = 'test-message-1';

      // Multiple users add reactions
      act(() => {
        reactionAddedCallback({
          messageId,
          reaction: {
            id: 'reaction-1',
            userId: 'user1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        });

        reactionAddedCallback({
          messageId,
          reaction: {
            id: 'reaction-2',
            userId: 'user2',
            userName: 'User Two',
            emoji: '👍',
            timestamp: new Date(),
          },
        });

        reactionAddedCallback({
          messageId,
          reaction: {
            id: 'reaction-3',
            userId: 'user3',
            userName: 'User Three',
            emoji: '❤️',
            timestamp: new Date(),
          },
        });
      });

      // Verify grouped reactions
      const grouped = reactionsResult.current.getGroupedReactions(messageId);
      expect(grouped.get('👍')).toHaveLength(2);
      expect(grouped.get('❤️')).toHaveLength(1);

      // Verify reaction summary
      const summary = reactionsResult.current.getReactionSummary(messageId);
      expect(summary).toHaveLength(2);
      expect(summary[0].emoji).toBe('👍');
      expect(summary[0].count).toBe(2);
      expect(summary[1].emoji).toBe('❤️');
      expect(summary[1].count).toBe(1);

      // Remove one reaction
      act(() => {
        reactionRemovedCallback({
          messageId,
          reactionId: 'reaction-1',
          userId: 'user1',
        });
      });

      // Verify updated reactions
      const updatedGrouped = reactionsResult.current.getGroupedReactions(messageId);
      expect(updatedGrouped.get('👍')).toHaveLength(1);
      expect(updatedGrouped.get('❤️')).toHaveLength(1);
    });

    it('should handle read receipts from multiple users', () => {
      let messageReadCallback: Function;

      (socketService.onMessageRead as jest.Mock).mockImplementation((callback) => {
        messageReadCallback = callback;
      });

      const { result: readReceiptsResult } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      const messageId = 'test-message-1';

      // Simulate multiple read receipts
      const readReceipts = [
        {
          userId: 'user1',
          userName: 'User One',
          readAt: new Date(),
        },
        {
          userId: 'user2',
          userName: 'User Two',
          readAt: new Date(),
        },
        {
          userId: 'user3',
          userName: 'User Three',
          readAt: new Date(),
        },
      ];

      // Test different read status texts
      expect(readReceiptsResult.current.getReadStatusText([])).toBe('');
      expect(readReceiptsResult.current.getReadStatusText([readReceipts[0]])).toBe('Read by User One');
      expect(readReceiptsResult.current.getReadStatusText([readReceipts[0], readReceipts[1]])).toBe('Read by User One and User Two');
      expect(readReceiptsResult.current.getReadStatusText(readReceipts)).toBe('Read by User One and 2 others');
    });

    it('should handle user presence updates with proper online/offline states', () => {
      let presenceUpdateCallback: Function;

      (socketService.onUserPresenceUpdate as jest.Mock).mockImplementation((callback) => {
        presenceUpdateCallback = callback;
      });

      const { result: presenceResult } = renderHook(() =>
        useUserPresence({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      // Test online user status texts
      expect(presenceResult.current.getOnlineUsersText()).toBe('No one else is online');

      // User comes online
      act(() => {
        presenceUpdateCallback({
          userId: 'user1',
          userName: 'User One',
          isOnline: true,
        });
      });

      expect(presenceResult.current.getOnlineUsersText()).toBe('User One is online');

      // Another user comes online
      act(() => {
        presenceUpdateCallback({
          userId: 'user2',
          userName: 'User Two',
          isOnline: true,
        });
      });

      expect(presenceResult.current.getOnlineUsersText()).toBe('User One and User Two are online');

      // Add more users
      act(() => {
        presenceUpdateCallback({
          userId: 'user3',
          userName: 'User Three',
          isOnline: true,
        });

        presenceUpdateCallback({
          userId: 'user4',
          userName: 'User Four',
          isOnline: true,
        });
      });

      expect(presenceResult.current.getOnlineUsersText()).toBe('User One and 3 others are online');

      // User goes offline
      act(() => {
        presenceUpdateCallback({
          userId: 'user1',
          userName: 'User One',
          isOnline: false,
          lastSeen: new Date(),
        });
      });

      expect(presenceResult.current.getOnlineCount()).toBe(3);
      expect(presenceResult.current.isUserOnline('user1')).toBe(false);
      expect(presenceResult.current.isUserOnline('user2')).toBe(true);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle connection loss gracefully', () => {
      (socketService.isConnected as jest.Mock).mockReturnValue(false);

      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        })
      );

      const { result: readReceiptsResult } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      expect(messageResult.current.isConnected).toBe(false);
      expect(readReceiptsResult.current.isConnected).toBe(false);
      expect(reactionsResult.current.isConnected).toBe(false);

      // Operations should not call socket service when disconnected
      act(() => {
        messageResult.current.sendMessage('test message', mockUserId, mockUserName);
        readReceiptsResult.current.markAsRead('test-message-id');
        reactionsResult.current.addReaction('test-message-id', '👍');
      });

      expect(socketService.sendMessage).not.toHaveBeenCalled();
      expect(socketService.markMessageAsRead).not.toHaveBeenCalled();
      expect(socketService.addReaction).not.toHaveBeenCalled();
    });

    it('should handle disabled state properly', () => {
      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: false,
        })
      );

      const { result: readReceiptsResult } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: false,
        })
      );

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: false,
        })
      );

      // Should not set up listeners when disabled
      expect(socketService.onNewMessage).not.toHaveBeenCalled();
      expect(socketService.onMessageRead).not.toHaveBeenCalled();
      expect(socketService.onReactionAdded).not.toHaveBeenCalled();

      // Operations should not call socket service when disabled
      act(() => {
        messageResult.current.sendMessage('test message', mockUserId, mockUserName);
        readReceiptsResult.current.markAsRead('test-message-id');
        reactionsResult.current.addReaction('test-message-id', '👍');
      });

      expect(socketService.sendMessage).not.toHaveBeenCalled();
      expect(socketService.markMessageAsRead).not.toHaveBeenCalled();
      expect(socketService.addReaction).not.toHaveBeenCalled();
    });

    it('should handle duplicate messages and reactions properly', () => {
      let newMessageCallback: Function;
      let reactionAddedCallback: Function;

      (socketService.onNewMessage as jest.Mock).mockImplementation((callback) => {
        newMessageCallback = callback;
      });
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result: messageResult } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        })
      );

      const { result: reactionsResult } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      const mockMessage = {
        id: 'test-message-1',
        text: 'Test message',
        senderId: 'other-user',
        senderName: 'Other User',
        timestamp: new Date(),
        readBy: [],
        reactions: [],
      };

      // Add message twice
      act(() => {
        newMessageCallback(mockMessage);
        newMessageCallback(mockMessage);
      });

      expect(messageResult.current.messages).toHaveLength(1);

      // Add same reaction twice
      const mockReaction = {
        id: 'reaction-1',
        userId: 'other-user',
        userName: 'Other User',
        emoji: '👍',
        timestamp: new Date(),
      };

      act(() => {
        reactionAddedCallback({
          messageId: mockMessage.id,
          reaction: mockReaction,
        });
        reactionAddedCallback({
          messageId: mockMessage.id,
          reaction: mockReaction,
        });
      });

      expect(reactionsResult.current.getMessageReactions(mockMessage.id)).toHaveLength(1);
    });
  });

  describe('Cleanup and memory management', () => {
    it('should cleanup all listeners on unmount', () => {
      const { unmount: unmountMessage } = renderHook(() =>
        useRealtimeMessages({
          conversationId: mockConversationId,
          isEnabled: true,
        })
      );

      const { unmount: unmountReadReceipts } = renderHook(() =>
        useReadReceipts({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      const { unmount: unmountReactions } = renderHook(() =>
        useMessageReactions({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      const { unmount: unmountPresence } = renderHook(() =>
        useUserPresence({
          conversationId: mockConversationId,
          userId: mockUserId,
          userName: mockUserName,
          isEnabled: true,
        })
      );

      // Unmount all hooks
      unmountMessage();
      unmountReadReceipts();
      unmountReactions();
      unmountPresence();

      // Verify cleanup calls
      expect(socketService.offNewMessage).toHaveBeenCalled();
      expect(socketService.offMessageRead).toHaveBeenCalled();
      expect(socketService.offReactionAdded).toHaveBeenCalled();
      expect(socketService.offReactionRemoved).toHaveBeenCalled();
      expect(socketService.offUserPresenceUpdate).toHaveBeenCalled();
      expect(socketService.offConnect).toHaveBeenCalled();
    });

    it('should handle conversation ID changes properly', () => {
      const { result, rerender } = renderHook(
        ({ conversationId }) =>
          useRealtimeMessages({
            conversationId,
            isEnabled: true,
          }),
        {
          initialProps: { conversationId: 'conversation-1' },
        }
      );

      expect(socketService.joinConversation).toHaveBeenCalledWith('conversation-1');

      // Change conversation ID
      rerender({ conversationId: 'conversation-2' });

      expect(socketService.joinConversation).toHaveBeenCalledWith('conversation-2');
    });
  });
});