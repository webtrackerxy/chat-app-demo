import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { MessageItem } from '../MessageItem';
import { Message } from '../../../../chat-types/src';

// Mock the auto-mark as read timer
jest.useFakeTimers();

const mockMessage: Message = {
  id: 'test-message-1',
  text: 'Hello, this is a test message!',
  senderId: 'sender-1',
  senderName: 'Test Sender',
  timestamp: new Date('2024-01-01T10:00:00'),
  readBy: [],
  reactions: [],
};

const mockProps = {
  message: mockMessage,
  isMyMessage: false,
  currentUserId: 'current-user',
  onReaction: jest.fn(),
  onMarkAsRead: jest.fn(),
  onDelete: jest.fn(),
};

describe('MessageItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  describe('Basic rendering', () => {
    it('should render message content correctly', () => {
      const { getByText } = render(<MessageItem {...mockProps} />);

      expect(getByText('Test Sender')).toBeTruthy();
      expect(getByText('Hello, this is a test message!')).toBeTruthy();
      expect(getByText('10:00:00 AM')).toBeTruthy();
    });

    it('should apply correct styles for own message', () => {
      const { getByText } = render(
        <MessageItem {...mockProps} isMyMessage={true} />
      );

      const messageContainer = getByText('Hello, this is a test message!').parent?.parent;
      expect(messageContainer).toHaveStyle({
        alignSelf: 'flex-end',
        backgroundColor: '#007AFF',
      });
    });

    it('should apply correct styles for other message', () => {
      const { getByText } = render(
        <MessageItem {...mockProps} isMyMessage={false} />
      );

      const messageContainer = getByText('Hello, this is a test message!').parent?.parent;
      expect(messageContainer).toHaveStyle({
        alignSelf: 'flex-start',
        backgroundColor: '#4CAF50',
      });
    });
  });

  describe('Auto-mark as read functionality', () => {
    it('should call onMarkAsRead after 1 second for other messages', async () => {
      render(<MessageItem {...mockProps} isMyMessage={false} />);

      expect(mockProps.onMarkAsRead).not.toHaveBeenCalled();

      // Fast-forward time by 1 second
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(mockProps.onMarkAsRead).toHaveBeenCalledTimes(1);
      });
    });

    it('should not call onMarkAsRead for own messages', () => {
      render(<MessageItem {...mockProps} isMyMessage={true} />);

      jest.advanceTimersByTime(1000);

      expect(mockProps.onMarkAsRead).not.toHaveBeenCalled();
    });

    it('should not call onMarkAsRead when callback is not provided', () => {
      render(
        <MessageItem {...mockProps} onMarkAsRead={undefined} isMyMessage={false} />
      );

      jest.advanceTimersByTime(1000);

      expect(mockProps.onMarkAsRead).not.toHaveBeenCalled();
    });

    it('should cleanup timer on unmount', () => {
      const { unmount } = render(<MessageItem {...mockProps} isMyMessage={false} />);

      unmount();
      jest.advanceTimersByTime(1000);

      expect(mockProps.onMarkAsRead).not.toHaveBeenCalled();
    });
  });

  describe('Message reactions', () => {
    it('should display existing reactions', () => {
      const messageWithReactions: Message = {
        ...mockMessage,
        reactions: [
          {
            id: 'reaction-1',
            userId: 'user-1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
          {
            id: 'reaction-2',
            userId: 'user-2',
            userName: 'User Two',
            emoji: '👍',
            timestamp: new Date(),
          },
          {
            id: 'reaction-3',
            userId: 'user-3',
            userName: 'User Three',
            emoji: '❤️',
            timestamp: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem {...mockProps} message={messageWithReactions} />
      );

      expect(getByText('👍')).toBeTruthy();
      expect(getByText('2')).toBeTruthy(); // Count for 👍
      expect(getByText('❤️')).toBeTruthy();
      expect(getByText('1')).toBeTruthy(); // Count for ❤️
    });

    it('should highlight reaction when current user has reacted', () => {
      const messageWithReactions: Message = {
        ...mockMessage,
        reactions: [
          {
            id: 'reaction-1',
            userId: 'current-user',
            userName: 'Current User',
            emoji: '👍',
            timestamp: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem {...mockProps} message={messageWithReactions} />
      );

      const reactionBubble = getByText('👍').parent;
      expect(reactionBubble).toHaveStyle({
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
      });
    });

    it('should call onReaction when existing reaction is pressed', () => {
      const messageWithReactions: Message = {
        ...mockMessage,
        reactions: [
          {
            id: 'reaction-1',
            userId: 'user-1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem {...mockProps} message={messageWithReactions} />
      );

      fireEvent.press(getByText('👍'));

      expect(mockProps.onReaction).toHaveBeenCalledWith('👍');
    });

    it('should display quick reaction buttons', () => {
      const { getByText } = render(<MessageItem {...mockProps} />);

      const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];

      commonEmojis.forEach(emoji => {
        expect(getByText(emoji)).toBeTruthy();
      });
    });

    it('should call onReaction when quick reaction button is pressed', () => {
      const { getAllByText } = render(<MessageItem {...mockProps} />);

      // Get the quick reaction button (not the existing reaction)
      const quickReactionButton = getAllByText('👍')[0];
      fireEvent.press(quickReactionButton);

      expect(mockProps.onReaction).toHaveBeenCalledWith('👍');
    });

    it('should not display reactions when showReactions is false', () => {
      const { queryByText } = render(
        <MessageItem {...mockProps} showReactions={false} />
      );

      expect(queryByText('👍')).toBeNull();
      expect(queryByText('❤️')).toBeNull();
    });

    it('should not display quick reaction buttons when onReaction is not provided', () => {
      const { queryByText } = render(
        <MessageItem {...mockProps} onReaction={undefined} />
      );

      // Quick reaction buttons should not be visible
      const quickReactionContainer = queryByText('👍')?.parent?.parent;
      expect(quickReactionContainer).toBeNull();
    });
  });

  describe('Read receipts', () => {
    it('should display read receipts for own messages', () => {
      const messageWithReadReceipts: Message = {
        ...mockMessage,
        readBy: [
          {
            userId: 'user-1',
            userName: 'User One',
            readAt: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReadReceipts}
          isMyMessage={true}
        />
      );

      expect(getByText('Read by User One')).toBeTruthy();
    });

    it('should not display read receipts for other messages', () => {
      const messageWithReadReceipts: Message = {
        ...mockMessage,
        readBy: [
          {
            userId: 'user-1',
            userName: 'User One',
            readAt: new Date(),
          },
        ],
      };

      const { queryByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReadReceipts}
          isMyMessage={false}
        />
      );

      expect(queryByText('Read by User One')).toBeNull();
    });

    it('should display read receipts for multiple users', () => {
      const messageWithReadReceipts: Message = {
        ...mockMessage,
        readBy: [
          {
            userId: 'user-1',
            userName: 'User One',
            readAt: new Date(),
          },
          {
            userId: 'user-2',
            userName: 'User Two',
            readAt: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReadReceipts}
          isMyMessage={true}
        />
      );

      expect(getByText('Read by User One and User Two')).toBeTruthy();
    });

    it('should display condensed read receipts for many users', () => {
      const messageWithReadReceipts: Message = {
        ...mockMessage,
        readBy: [
          {
            userId: 'user-1',
            userName: 'User One',
            readAt: new Date(),
          },
          {
            userId: 'user-2',
            userName: 'User Two',
            readAt: new Date(),
          },
          {
            userId: 'user-3',
            userName: 'User Three',
            readAt: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReadReceipts}
          isMyMessage={true}
        />
      );

      expect(getByText('Read by User One and 2 others')).toBeTruthy();
    });

    it('should not display read receipts when only current user has read', () => {
      const messageWithReadReceipts: Message = {
        ...mockMessage,
        readBy: [
          {
            userId: 'current-user',
            userName: 'Current User',
            readAt: new Date(),
          },
        ],
      };

      const { queryByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReadReceipts}
          isMyMessage={true}
        />
      );

      expect(queryByText(/Read by/)).toBeNull();
    });

    it('should filter out current user from read receipts display', () => {
      const messageWithReadReceipts: Message = {
        ...mockMessage,
        readBy: [
          {
            userId: 'current-user',
            userName: 'Current User',
            readAt: new Date(),
          },
          {
            userId: 'user-1',
            userName: 'User One',
            readAt: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReadReceipts}
          isMyMessage={true}
        />
      );

      expect(getByText('Read by User One')).toBeTruthy();
    });

    it('should not display read receipts when showReadReceipts is false', () => {
      const messageWithReadReceipts: Message = {
        ...mockMessage,
        readBy: [
          {
            userId: 'user-1',
            userName: 'User One',
            readAt: new Date(),
          },
        ],
      };

      const { queryByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReadReceipts}
          isMyMessage={true}
          showReadReceipts={false}
        />
      );

      expect(queryByText('Read by User One')).toBeNull();
    });
  });

  describe('Delete functionality', () => {
    it('should display delete button when showDeleteButton is true', () => {
      const { getByText } = render(
        <MessageItem {...mockProps} showDeleteButton={true} />
      );

      expect(getByText('🗑️')).toBeTruthy();
    });

    it('should call onDelete when delete button is pressed', () => {
      const { getByText } = render(
        <MessageItem {...mockProps} showDeleteButton={true} />
      );

      fireEvent.press(getByText('🗑️'));

      expect(mockProps.onDelete).toHaveBeenCalledTimes(1);
    });

    it('should call onDelete on long press when showDeleteButton is true', () => {
      const { getByText } = render(
        <MessageItem {...mockProps} showDeleteButton={true} />
      );

      fireEvent(getByText('Hello, this is a test message!').parent?.parent, 'longPress');

      expect(mockProps.onDelete).toHaveBeenCalledTimes(1);
    });

    it('should not display delete button when showDeleteButton is false', () => {
      const { queryByText } = render(
        <MessageItem {...mockProps} showDeleteButton={false} />
      );

      expect(queryByText('🗑️')).toBeNull();
    });

    it('should not respond to long press when showDeleteButton is false', () => {
      const { getByText } = render(
        <MessageItem {...mockProps} showDeleteButton={false} />
      );

      fireEvent(getByText('Hello, this is a test message!').parent?.parent, 'longPress');

      expect(mockProps.onDelete).not.toHaveBeenCalled();
    });
  });

  describe('Layout and positioning', () => {
    it('should position reactions correctly for own messages', () => {
      const messageWithReactions: Message = {
        ...mockMessage,
        reactions: [
          {
            id: 'reaction-1',
            userId: 'user-1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReactions}
          isMyMessage={true}
        />
      );

      const reactionsContainer = getByText('👍').parent?.parent?.parent;
      expect(reactionsContainer).toHaveStyle({
        alignSelf: 'flex-end',
      });
    });

    it('should position reactions correctly for other messages', () => {
      const messageWithReactions: Message = {
        ...mockMessage,
        reactions: [
          {
            id: 'reaction-1',
            userId: 'user-1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReactions}
          isMyMessage={false}
        />
      );

      const reactionsContainer = getByText('👍').parent?.parent?.parent;
      expect(reactionsContainer).toHaveStyle({
        alignSelf: 'flex-start',
      });
    });

    it('should handle empty reactions array', () => {
      const messageWithEmptyReactions: Message = {
        ...mockMessage,
        reactions: [],
      };

      const { queryByText } = render(
        <MessageItem {...mockProps} message={messageWithEmptyReactions} />
      );

      // Only quick reaction buttons should be visible
      expect(queryByText('👍')).toBeTruthy(); // Quick reaction
      expect(queryByText('1')).toBeNull(); // No reaction count
    });

    it('should handle missing reactions property', () => {
      const messageWithoutReactions: Message = {
        ...mockMessage,
        reactions: undefined,
      };

      const { queryByText } = render(
        <MessageItem {...mockProps} message={messageWithoutReactions} />
      );

      // Quick reaction buttons should still be visible
      expect(queryByText('👍')).toBeTruthy();
    });
  });

  describe('Edge cases', () => {
    it('should handle message without readBy property', () => {
      const messageWithoutReadBy: Message = {
        ...mockMessage,
        readBy: undefined,
      };

      const { queryByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithoutReadBy}
          isMyMessage={true}
        />
      );

      expect(queryByText(/Read by/)).toBeNull();
    });

    it('should handle empty readBy array', () => {
      const messageWithEmptyReadBy: Message = {
        ...mockMessage,
        readBy: [],
      };

      const { queryByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithEmptyReadBy}
          isMyMessage={true}
        />
      );

      expect(queryByText(/Read by/)).toBeNull();
    });

    it('should handle missing currentUserId', () => {
      const messageWithReactions: Message = {
        ...mockMessage,
        reactions: [
          {
            id: 'reaction-1',
            userId: 'user-1',
            userName: 'User One',
            emoji: '👍',
            timestamp: new Date(),
          },
        ],
      };

      const { getByText } = render(
        <MessageItem
          {...mockProps}
          message={messageWithReactions}
          currentUserId={undefined}
        />
      );

      // Should not highlight reaction as active
      const reactionBubble = getByText('👍').parent;
      expect(reactionBubble).not.toHaveStyle({
        backgroundColor: '#007AFF',
      });
    });
  });
});