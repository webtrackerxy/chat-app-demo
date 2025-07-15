import { renderHook, act } from '@testing-library/react-native';
import { useMessageReactions } from '../useMessageReactions';
import { socketService } from '../../services/socketService';

// Mock socketService
jest.mock('../../services/socketService', () => ({
  socketService: {
    isConnected: jest.fn(),
    addReaction: jest.fn(),
    removeReaction: jest.fn(),
    onReactionAdded: jest.fn(),
    onReactionRemoved: jest.fn(),
    offReactionAdded: jest.fn(),
    offReactionRemoved: jest.fn(),
  },
}));

describe('useMessageReactions', () => {
  const mockProps = {
    conversationId: 'test-conversation',
    userId: 'test-user',
    userName: 'Test User',
    isEnabled: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (socketService.isConnected as jest.Mock).mockReturnValue(true);
  });

  describe('initialization', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() => useMessageReactions(mockProps));

      expect(result.current.addReaction).toBeInstanceOf(Function);
      expect(result.current.removeReaction).toBeInstanceOf(Function);
      expect(result.current.toggleReaction).toBeInstanceOf(Function);
      expect(result.current.getMessageReactions).toBeInstanceOf(Function);
      expect(result.current.getGroupedReactions).toBeInstanceOf(Function);
      expect(result.current.getReactionSummary).toBeInstanceOf(Function);
      expect(result.current.hasUserReacted).toBeInstanceOf(Function);
      expect(result.current.getTotalReactionCount).toBeInstanceOf(Function);
      expect(result.current.getReactionTooltip).toBeInstanceOf(Function);
      expect(result.current.initializeReactions).toBeInstanceOf(Function);
      expect(result.current.clearAllReactions).toBeInstanceOf(Function);
      expect(result.current.isConnected).toBe(true);
    });

    it('should set up reaction listeners when enabled', () => {
      renderHook(() => useMessageReactions(mockProps));

      expect(socketService.onReactionAdded).toHaveBeenCalledWith(expect.any(Function));
      expect(socketService.onReactionRemoved).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not set up listeners when disabled', () => {
      renderHook(() => useMessageReactions({ ...mockProps, isEnabled: false }));

      expect(socketService.onReactionAdded).not.toHaveBeenCalled();
      expect(socketService.onReactionRemoved).not.toHaveBeenCalled();
    });
  });

  describe('addReaction', () => {
    it('should call socketService.addReaction when connected', () => {
      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        result.current.addReaction('test-message-id', '👍');
      });

      expect(socketService.addReaction).toHaveBeenCalledWith(
        'test-message-id',
        mockProps.conversationId,
        mockProps.userId,
        mockProps.userName,
        '👍'
      );
    });

    it('should not call socketService when not connected', () => {
      (socketService.isConnected as jest.Mock).mockReturnValue(false);
      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        result.current.addReaction('test-message-id', '👍');
      });

      expect(socketService.addReaction).not.toHaveBeenCalled();
    });

    it('should not call socketService when disabled', () => {
      const { result } = renderHook(() => useMessageReactions({ ...mockProps, isEnabled: false }));

      act(() => {
        result.current.addReaction('test-message-id', '👍');
      });

      expect(socketService.addReaction).not.toHaveBeenCalled();
    });
  });

  describe('removeReaction', () => {
    it('should call socketService.removeReaction when connected', () => {
      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        result.current.removeReaction('test-message-id', 'reaction-id');
      });

      expect(socketService.removeReaction).toHaveBeenCalledWith(
        'test-message-id',
        mockProps.conversationId,
        mockProps.userId,
        'reaction-id'
      );
    });

    it('should not call socketService when not connected', () => {
      (socketService.isConnected as jest.Mock).mockReturnValue(false);
      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        result.current.removeReaction('test-message-id', 'reaction-id');
      });

      expect(socketService.removeReaction).not.toHaveBeenCalled();
    });
  });

  describe('toggleReaction', () => {
    it('should add reaction when user has not reacted', () => {
      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        result.current.toggleReaction('test-message-id', '👍');
      });

      expect(socketService.addReaction).toHaveBeenCalledWith(
        'test-message-id',
        mockProps.conversationId,
        mockProps.userId,
        mockProps.userName,
        '👍'
      );
    });

    it('should remove reaction when user has already reacted', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      // First add a reaction
      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-id',
            userId: mockProps.userId,
            userName: mockProps.userName,
            emoji: '👍',
            timestamp: new Date(),
          },
        });
      });

      // Then toggle it (should remove)
      act(() => {
        result.current.toggleReaction('test-message-id', '👍');
      });

      expect(socketService.removeReaction).toHaveBeenCalledWith(
        'test-message-id',
        mockProps.conversationId,
        mockProps.userId,
        'reaction-id'
      );
    });
  });

  describe('reaction updates', () => {
    it('should update reactions when receiving reaction_added event', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      const mockReaction = {
        id: 'reaction-id',
        userId: 'other-user',
        userName: 'Other User',
        emoji: '👍',
        timestamp: new Date(),
      };

      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: mockReaction,
        });
      });

      const reactions = result.current.getMessageReactions('test-message-id');
      expect(reactions).toHaveLength(1);
      expect(reactions[0]).toEqual(mockReaction);
    });

    it('should update reactions when receiving reaction_removed event', () => {
      let reactionAddedCallback: Function;
      let reactionRemovedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });
      (socketService.onReactionRemoved as jest.Mock).mockImplementation((callback) => {
        reactionRemovedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      const mockReaction = {
        id: 'reaction-id',
        userId: 'other-user',
        userName: 'Other User',
        emoji: '👍',
        timestamp: new Date(),
      };

      // Add reaction first
      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: mockReaction,
        });
      });

      // Then remove it
      act(() => {
        reactionRemovedCallback({
          messageId: 'test-message-id',
          reactionId: 'reaction-id',
          userId: 'other-user',
        });
      });

      const reactions = result.current.getMessageReactions('test-message-id');
      expect(reactions).toHaveLength(0);
    });

    it('should not add duplicate reactions from same user with same emoji', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      const mockReaction = {
        id: 'reaction-id',
        userId: 'other-user',
        userName: 'Other User',
        emoji: '👍',
        timestamp: new Date(),
      };

      // Add reaction twice
      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: mockReaction,
        });

        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: { ...mockReaction, id: 'reaction-id-2' },
        });
      });

      const reactions = result.current.getMessageReactions('test-message-id');
      expect(reactions).toHaveLength(1);
    });
  });

  describe('getGroupedReactions', () => {
    it('should group reactions by emoji', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-1',
            userId: 'user1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        });

        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-2',
            userId: 'user2',
            userName: 'User Two',
            emoji: '👍',
            timestamp: new Date(),
          },
        });

        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-3',
            userId: 'user3',
            userName: 'User Three',
            emoji: '❤️',
            timestamp: new Date(),
          },
        });
      });

      const grouped = result.current.getGroupedReactions('test-message-id');
      expect(grouped.size).toBe(2);
      expect(grouped.get('👍')).toHaveLength(2);
      expect(grouped.get('❤️')).toHaveLength(1);
    });

    it('should return empty map for message with no reactions', () => {
      const { result } = renderHook(() => useMessageReactions(mockProps));

      const grouped = result.current.getGroupedReactions('test-message-id');
      expect(grouped.size).toBe(0);
    });
  });

  describe('getReactionSummary', () => {
    it('should return reaction summary sorted by count', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        // Add 2 👍 reactions
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-1',
            userId: 'user1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        });

        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-2',
            userId: 'user2',
            userName: 'User Two',
            emoji: '👍',
            timestamp: new Date(),
          },
        });

        // Add 1 ❤️ reaction
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-3',
            userId: 'user3',
            userName: 'User Three',
            emoji: '❤️',
            timestamp: new Date(),
          },
        });
      });

      const summary = result.current.getReactionSummary('test-message-id');
      expect(summary).toHaveLength(2);
      expect(summary[0].emoji).toBe('👍');
      expect(summary[0].count).toBe(2);
      expect(summary[0].users).toEqual(['User One', 'User Two']);
      expect(summary[0].hasCurrentUser).toBe(false);
      expect(summary[1].emoji).toBe('❤️');
      expect(summary[1].count).toBe(1);
      expect(summary[1].users).toEqual(['User Three']);
      expect(summary[1].hasCurrentUser).toBe(false);
    });

    it('should mark hasCurrentUser as true when current user has reacted', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-1',
            userId: mockProps.userId,
            userName: mockProps.userName,
            emoji: '👍',
            timestamp: new Date(),
          },
        });
      });

      const summary = result.current.getReactionSummary('test-message-id');
      expect(summary[0].hasCurrentUser).toBe(true);
    });
  });

  describe('hasUserReacted', () => {
    it('should return true when current user has reacted with emoji', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-1',
            userId: mockProps.userId,
            userName: mockProps.userName,
            emoji: '👍',
            timestamp: new Date(),
          },
        });
      });

      expect(result.current.hasUserReacted('test-message-id', '👍')).toBe(true);
      expect(result.current.hasUserReacted('test-message-id', '❤️')).toBe(false);
    });

    it('should return false when current user has not reacted', () => {
      const { result } = renderHook(() => useMessageReactions(mockProps));

      expect(result.current.hasUserReacted('test-message-id', '👍')).toBe(false);
    });
  });

  describe('getTotalReactionCount', () => {
    it('should return total count of reactions for a message', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-1',
            userId: 'user1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        });

        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-2',
            userId: 'user2',
            userName: 'User Two',
            emoji: '❤️',
            timestamp: new Date(),
          },
        });
      });

      expect(result.current.getTotalReactionCount('test-message-id')).toBe(2);
    });

    it('should return 0 for message with no reactions', () => {
      const { result } = renderHook(() => useMessageReactions(mockProps));

      expect(result.current.getTotalReactionCount('test-message-id')).toBe(0);
    });
  });

  describe('getReactionTooltip', () => {
    it('should return tooltip for single reaction', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-1',
            userId: 'user1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        });
      });

      expect(result.current.getReactionTooltip('test-message-id', '👍')).toBe('User One reacted with 👍');
    });

    it('should return tooltip for multiple reactions', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-1',
            userId: 'user1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        });

        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-2',
            userId: 'user2',
            userName: 'User Two',
            emoji: '👍',
            timestamp: new Date(),
          },
        });

        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-3',
            userId: 'user3',
            userName: 'User Three',
            emoji: '👍',
            timestamp: new Date(),
          },
        });
      });

      expect(result.current.getReactionTooltip('test-message-id', '👍')).toBe('User One and 2 others reacted with 👍');
    });
  });

  describe('initializeReactions', () => {
    it('should initialize reactions for a message', () => {
      const { result } = renderHook(() => useMessageReactions(mockProps));

      const mockReactions = [
        {
          id: 'reaction-1',
          userId: 'user1',
          userName: 'User One',
          emoji: '👍',
          timestamp: new Date(),
        },
      ];

      act(() => {
        result.current.initializeReactions('test-message-id', mockReactions);
      });

      const reactions = result.current.getMessageReactions('test-message-id');
      expect(reactions).toEqual(mockReactions);
    });

    it('should not initialize empty reactions', () => {
      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        result.current.initializeReactions('test-message-id', []);
      });

      const reactions = result.current.getMessageReactions('test-message-id');
      expect(reactions).toEqual([]);
    });
  });

  describe('clearAllReactions', () => {
    it('should clear all reactions', () => {
      let reactionAddedCallback: Function;
      (socketService.onReactionAdded as jest.Mock).mockImplementation((callback) => {
        reactionAddedCallback = callback;
      });

      const { result } = renderHook(() => useMessageReactions(mockProps));

      act(() => {
        reactionAddedCallback({
          messageId: 'test-message-id',
          reaction: {
            id: 'reaction-1',
            userId: 'user1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        });
      });

      expect(result.current.getMessageReactions('test-message-id')).toHaveLength(1);

      act(() => {
        result.current.clearAllReactions();
      });

      expect(result.current.getMessageReactions('test-message-id')).toHaveLength(0);
    });
  });

  describe('cleanup', () => {
    it('should cleanup listeners on unmount', () => {
      const { unmount } = renderHook(() => useMessageReactions(mockProps));

      unmount();

      expect(socketService.offReactionAdded).toHaveBeenCalledWith(expect.any(Function));
      expect(socketService.offReactionRemoved).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});