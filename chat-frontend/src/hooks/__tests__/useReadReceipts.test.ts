import { renderHook, act } from '@testing-library/react-native';
import { useReadReceipts } from '../useReadReceipts';
import { socketService } from '../../services/socketService';

// Mock socketService
jest.mock('../../services/socketService', () => ({
  socketService: {
    isConnected: jest.fn(),
    markMessageAsRead: jest.fn(),
    onMessageRead: jest.fn(),
    offMessageRead: jest.fn(),
  },
}));

describe('useReadReceipts', () => {
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
      const { result } = renderHook(() => useReadReceipts(mockProps));

      expect(result.current.markAsRead).toBeInstanceOf(Function);
      expect(result.current.markMultipleAsRead).toBeInstanceOf(Function);
      expect(result.current.autoMarkAsRead).toBeInstanceOf(Function);
      expect(result.current.getReadStatusText).toBeInstanceOf(Function);
      expect(result.current.hasBeenReadBy).toBeInstanceOf(Function);
      expect(result.current.hasCurrentUserRead).toBeInstanceOf(Function);
      expect(result.current.isConnected).toBe(true);
    });

    it('should set up message read listeners when enabled', () => {
      renderHook(() => useReadReceipts(mockProps));

      expect(socketService.onMessageRead).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should not set up listeners when disabled', () => {
      renderHook(() => useReadReceipts({ ...mockProps, isEnabled: false }));

      expect(socketService.onMessageRead).not.toHaveBeenCalled();
    });
  });

  describe('markAsRead', () => {
    it('should call socketService.markMessageAsRead when connected', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      act(() => {
        result.current.markAsRead('test-message-id');
      });

      expect(socketService.markMessageAsRead).toHaveBeenCalledWith(
        'test-message-id',
        mockProps.conversationId,
        mockProps.userId,
        mockProps.userName
      );
    });

    it('should not call socketService when not connected', () => {
      (socketService.isConnected as jest.Mock).mockReturnValue(false);
      const { result } = renderHook(() => useReadReceipts(mockProps));

      act(() => {
        result.current.markAsRead('test-message-id');
      });

      expect(socketService.markMessageAsRead).not.toHaveBeenCalled();
    });

    it('should not call socketService when disabled', () => {
      const { result } = renderHook(() => useReadReceipts({ ...mockProps, isEnabled: false }));

      act(() => {
        result.current.markAsRead('test-message-id');
      });

      expect(socketService.markMessageAsRead).not.toHaveBeenCalled();
    });
  });

  describe('markMultipleAsRead', () => {
    it('should call markAsRead for each message', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      act(() => {
        result.current.markMultipleAsRead(['msg1', 'msg2', 'msg3']);
      });

      expect(socketService.markMessageAsRead).toHaveBeenCalledTimes(3);
      expect(socketService.markMessageAsRead).toHaveBeenCalledWith('msg1', mockProps.conversationId, mockProps.userId, mockProps.userName);
      expect(socketService.markMessageAsRead).toHaveBeenCalledWith('msg2', mockProps.conversationId, mockProps.userId, mockProps.userName);
      expect(socketService.markMessageAsRead).toHaveBeenCalledWith('msg3', mockProps.conversationId, mockProps.userId, mockProps.userName);
    });
  });

  describe('autoMarkAsRead', () => {
    it('should call markAsRead after specified delay', (done) => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      act(() => {
        result.current.autoMarkAsRead('test-message-id', 100);
      });

      setTimeout(() => {
        expect(socketService.markMessageAsRead).toHaveBeenCalledWith(
          'test-message-id',
          mockProps.conversationId,
          mockProps.userId,
          mockProps.userName
        );
        done();
      }, 150);
    });

    it('should use default delay of 1000ms', (done) => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      act(() => {
        result.current.autoMarkAsRead('test-message-id');
      });

      // Should not be called immediately
      expect(socketService.markMessageAsRead).not.toHaveBeenCalled();

      // Should be called after 1000ms
      setTimeout(() => {
        expect(socketService.markMessageAsRead).toHaveBeenCalledWith(
          'test-message-id',
          mockProps.conversationId,
          mockProps.userId,
          mockProps.userName
        );
        done();
      }, 1100);
    });
  });

  describe('getReadStatusText', () => {
    it('should return empty string for no read receipts', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const text = result.current.getReadStatusText([]);
      expect(text).toBe('');
    });

    it('should return empty string when only current user has read', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const readBy = [
        { userId: 'test-user', userName: 'Test User', readAt: new Date() }
      ];

      const text = result.current.getReadStatusText(readBy);
      expect(text).toBe('');
    });

    it('should return single user read status', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const readBy = [
        { userId: 'other-user', userName: 'Other User', readAt: new Date() }
      ];

      const text = result.current.getReadStatusText(readBy);
      expect(text).toBe('Read by Other User');
    });

    it('should return two users read status', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const readBy = [
        { userId: 'user1', userName: 'User One', readAt: new Date() },
        { userId: 'user2', userName: 'User Two', readAt: new Date() }
      ];

      const text = result.current.getReadStatusText(readBy);
      expect(text).toBe('Read by User One and User Two');
    });

    it('should return multiple users read status', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const readBy = [
        { userId: 'user1', userName: 'User One', readAt: new Date() },
        { userId: 'user2', userName: 'User Two', readAt: new Date() },
        { userId: 'user3', userName: 'User Three', readAt: new Date() }
      ];

      const text = result.current.getReadStatusText(readBy);
      expect(text).toBe('Read by User One and 2 others');
    });
  });

  describe('hasBeenReadBy', () => {
    it('should return true when user has read the message', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const readBy = [
        { userId: 'target-user', userName: 'Target User', readAt: new Date() }
      ];

      const hasRead = result.current.hasBeenReadBy(readBy, 'target-user');
      expect(hasRead).toBe(true);
    });

    it('should return false when user has not read the message', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const readBy = [
        { userId: 'other-user', userName: 'Other User', readAt: new Date() }
      ];

      const hasRead = result.current.hasBeenReadBy(readBy, 'target-user');
      expect(hasRead).toBe(false);
    });

    it('should handle empty readBy array', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const hasRead = result.current.hasBeenReadBy([], 'target-user');
      expect(hasRead).toBe(false);
    });
  });

  describe('hasCurrentUserRead', () => {
    it('should return true when current user has read the message', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const readBy = [
        { userId: 'test-user', userName: 'Test User', readAt: new Date() }
      ];

      const hasRead = result.current.hasCurrentUserRead(readBy);
      expect(hasRead).toBe(true);
    });

    it('should return false when current user has not read the message', () => {
      const { result } = renderHook(() => useReadReceipts(mockProps));

      const readBy = [
        { userId: 'other-user', userName: 'Other User', readAt: new Date() }
      ];

      const hasRead = result.current.hasCurrentUserRead(readBy);
      expect(hasRead).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should cleanup listeners on unmount', () => {
      const { unmount } = renderHook(() => useReadReceipts(mockProps));

      unmount();

      expect(socketService.offMessageRead).toHaveBeenCalledWith(expect.any(Function));
    });
  });
});