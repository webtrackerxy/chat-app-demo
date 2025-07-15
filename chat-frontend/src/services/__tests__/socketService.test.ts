import { socketService } from '../socketService';
import { Socket } from 'socket.io-client';
import { 
  ReadReceipt, 
  MessageReaction, 
  UserPresenceUpdate 
} from '../../../../chat-types/src';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
  };
  
  return jest.fn(() => mockSocket);
});

describe('SocketService', () => {
  let mockSocket: any;
  let mockIo: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIo = require('socket.io-client');
    mockSocket = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      disconnect: jest.fn(),
      connected: false,
    };
    mockIo.mockReturnValue(mockSocket);
  });

  describe('Connection management', () => {
    it('should connect to default server URL', () => {
      const socket = socketService.connect();
      
      expect(mockIo).toHaveBeenCalledWith('http://localhost:3000');
      expect(socket).toBe(mockSocket);
    });

    it('should connect to custom server URL', () => {
      const customUrl = 'http://localhost:8080';
      const socket = socketService.connect(customUrl);
      
      expect(mockIo).toHaveBeenCalledWith(customUrl);
      expect(socket).toBe(mockSocket);
    });

    it('should disconnect and clear socket', () => {
      socketService.connect();
      socketService.disconnect();
      
      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(socketService.getSocket()).toBeNull();
    });

    it('should return connection status', () => {
      socketService.connect();
      mockSocket.connected = true;
      
      expect(socketService.isConnected()).toBe(true);
      
      mockSocket.connected = false;
      expect(socketService.isConnected()).toBe(false);
    });

    it('should return false when not connected', () => {
      expect(socketService.isConnected()).toBe(false);
    });
  });

  describe('User presence methods', () => {
    beforeEach(() => {
      socketService.connect();
    });

    describe('setUserOnline', () => {
      it('should emit user_online event with required data', () => {
        const userId = 'user123';
        const userName = 'John Doe';
        const conversationId = 'conv456';
        
        socketService.setUserOnline(userId, userName, conversationId);
        
        expect(mockSocket.emit).toHaveBeenCalledWith('user_online', {
          userId,
          userName,
          conversationId,
        });
      });

      it('should emit user_online event without conversationId', () => {
        const userId = 'user123';
        const userName = 'John Doe';
        
        socketService.setUserOnline(userId, userName);
        
        expect(mockSocket.emit).toHaveBeenCalledWith('user_online', {
          userId,
          userName,
          conversationId: undefined,
        });
      });

      it('should not emit when socket is not connected', () => {
        socketService.disconnect();
        
        socketService.setUserOnline('user123', 'John Doe');
        
        expect(mockSocket.emit).not.toHaveBeenCalled();
      });
    });

    describe('onUserPresenceUpdate', () => {
      it('should register presence update listener', () => {
        const callback = jest.fn();
        
        socketService.onUserPresenceUpdate(callback);
        
        expect(mockSocket.on).toHaveBeenCalledWith('user_presence_update', callback);
      });

      it('should not register listener when socket is not connected', () => {
        socketService.disconnect();
        const callback = jest.fn();
        
        socketService.onUserPresenceUpdate(callback);
        
        expect(mockSocket.on).not.toHaveBeenCalled();
      });
    });

    describe('offUserPresenceUpdate', () => {
      it('should remove presence update listener', () => {
        const callback = jest.fn();
        
        socketService.offUserPresenceUpdate(callback);
        
        expect(mockSocket.off).toHaveBeenCalledWith('user_presence_update', callback);
      });

      it('should remove all presence update listeners when no callback provided', () => {
        socketService.offUserPresenceUpdate();
        
        expect(mockSocket.off).toHaveBeenCalledWith('user_presence_update', undefined);
      });
    });
  });

  describe('Read receipts methods', () => {
    beforeEach(() => {
      socketService.connect();
    });

    describe('markMessageAsRead', () => {
      it('should emit mark_message_read event with correct data', () => {
        const messageId = 'msg123';
        const conversationId = 'conv456';
        const userId = 'user789';
        const userName = 'Jane Smith';
        
        socketService.markMessageAsRead(messageId, conversationId, userId, userName);
        
        expect(mockSocket.emit).toHaveBeenCalledWith('mark_message_read', {
          messageId,
          conversationId,
          userId,
          userName,
        });
      });

      it('should not emit when socket is not connected', () => {
        socketService.disconnect();
        
        socketService.markMessageAsRead('msg123', 'conv456', 'user789', 'Jane Smith');
        
        expect(mockSocket.emit).not.toHaveBeenCalled();
      });
    });

    describe('onMessageRead', () => {
      it('should register message read listener', () => {
        const callback = jest.fn();
        
        socketService.onMessageRead(callback);
        
        expect(mockSocket.on).toHaveBeenCalledWith('message_read', callback);
      });

      it('should handle message read events correctly', () => {
        const callback = jest.fn();
        const readData = {
          messageId: 'msg123',
          readReceipt: {
            userId: 'user789',
            userName: 'Jane Smith',
            readAt: new Date(),
          } as ReadReceipt,
        };
        
        socketService.onMessageRead(callback);
        
        // Simulate receiving the event
        const registeredCallback = mockSocket.on.mock.calls[0][1];
        registeredCallback(readData);
        
        expect(callback).toHaveBeenCalledWith(readData);
      });
    });

    describe('offMessageRead', () => {
      it('should remove message read listener', () => {
        const callback = jest.fn();
        
        socketService.offMessageRead(callback);
        
        expect(mockSocket.off).toHaveBeenCalledWith('message_read', callback);
      });

      it('should remove all message read listeners when no callback provided', () => {
        socketService.offMessageRead();
        
        expect(mockSocket.off).toHaveBeenCalledWith('message_read', undefined);
      });
    });
  });

  describe('Message reactions methods', () => {
    beforeEach(() => {
      socketService.connect();
    });

    describe('addReaction', () => {
      it('should emit add_reaction event with correct data', () => {
        const messageId = 'msg123';
        const conversationId = 'conv456';
        const userId = 'user789';
        const userName = 'Jane Smith';
        const emoji = '👍';
        
        socketService.addReaction(messageId, conversationId, userId, userName, emoji);
        
        expect(mockSocket.emit).toHaveBeenCalledWith('add_reaction', {
          messageId,
          conversationId,
          userId,
          userName,
          emoji,
        });
      });

      it('should not emit when socket is not connected', () => {
        socketService.disconnect();
        
        socketService.addReaction('msg123', 'conv456', 'user789', 'Jane Smith', '👍');
        
        expect(mockSocket.emit).not.toHaveBeenCalled();
      });
    });

    describe('removeReaction', () => {
      it('should emit remove_reaction event with correct data', () => {
        const messageId = 'msg123';
        const conversationId = 'conv456';
        const userId = 'user789';
        const reactionId = 'reaction123';
        
        socketService.removeReaction(messageId, conversationId, userId, reactionId);
        
        expect(mockSocket.emit).toHaveBeenCalledWith('remove_reaction', {
          messageId,
          conversationId,
          userId,
          reactionId,
        });
      });

      it('should not emit when socket is not connected', () => {
        socketService.disconnect();
        
        socketService.removeReaction('msg123', 'conv456', 'user789', 'reaction123');
        
        expect(mockSocket.emit).not.toHaveBeenCalled();
      });
    });

    describe('onReactionAdded', () => {
      it('should register reaction added listener', () => {
        const callback = jest.fn();
        
        socketService.onReactionAdded(callback);
        
        expect(mockSocket.on).toHaveBeenCalledWith('reaction_added', callback);
      });

      it('should handle reaction added events correctly', () => {
        const callback = jest.fn();
        const reactionData = {
          messageId: 'msg123',
          reaction: {
            id: 'reaction123',
            userId: 'user789',
            userName: 'Jane Smith',
            emoji: '👍',
            timestamp: new Date(),
          } as MessageReaction,
        };
        
        socketService.onReactionAdded(callback);
        
        // Simulate receiving the event
        const registeredCallback = mockSocket.on.mock.calls[0][1];
        registeredCallback(reactionData);
        
        expect(callback).toHaveBeenCalledWith(reactionData);
      });
    });

    describe('onReactionRemoved', () => {
      it('should register reaction removed listener', () => {
        const callback = jest.fn();
        
        socketService.onReactionRemoved(callback);
        
        expect(mockSocket.on).toHaveBeenCalledWith('reaction_removed', callback);
      });

      it('should handle reaction removed events correctly', () => {
        const callback = jest.fn();
        const reactionData = {
          messageId: 'msg123',
          reactionId: 'reaction123',
          userId: 'user789',
        };
        
        socketService.onReactionRemoved(callback);
        
        // Simulate receiving the event
        const registeredCallback = mockSocket.on.mock.calls[0][1];
        registeredCallback(reactionData);
        
        expect(callback).toHaveBeenCalledWith(reactionData);
      });
    });

    describe('offReactionAdded', () => {
      it('should remove reaction added listener', () => {
        const callback = jest.fn();
        
        socketService.offReactionAdded(callback);
        
        expect(mockSocket.off).toHaveBeenCalledWith('reaction_added', callback);
      });

      it('should remove all reaction added listeners when no callback provided', () => {
        socketService.offReactionAdded();
        
        expect(mockSocket.off).toHaveBeenCalledWith('reaction_added', undefined);
      });
    });

    describe('offReactionRemoved', () => {
      it('should remove reaction removed listener', () => {
        const callback = jest.fn();
        
        socketService.offReactionRemoved(callback);
        
        expect(mockSocket.off).toHaveBeenCalledWith('reaction_removed', callback);
      });

      it('should remove all reaction removed listeners when no callback provided', () => {
        socketService.offReactionRemoved();
        
        expect(mockSocket.off).toHaveBeenCalledWith('reaction_removed', undefined);
      });
    });
  });

  describe('Connection event handlers', () => {
    beforeEach(() => {
      socketService.connect();
    });

    describe('onConnect', () => {
      it('should register connect listener', () => {
        const callback = jest.fn();
        
        socketService.onConnect(callback);
        
        expect(mockSocket.on).toHaveBeenCalledWith('connect', callback);
      });
    });

    describe('onDisconnect', () => {
      it('should register disconnect listener', () => {
        const callback = jest.fn();
        
        socketService.onDisconnect(callback);
        
        expect(mockSocket.on).toHaveBeenCalledWith('disconnect', callback);
      });
    });

    describe('offConnect', () => {
      it('should remove connect listener', () => {
        const callback = jest.fn();
        
        socketService.offConnect(callback);
        
        expect(mockSocket.off).toHaveBeenCalledWith('connect', callback);
      });
    });

    describe('offDisconnect', () => {
      it('should remove disconnect listener', () => {
        const callback = jest.fn();
        
        socketService.offDisconnect(callback);
        
        expect(mockSocket.off).toHaveBeenCalledWith('disconnect', callback);
      });
    });
  });

  describe('Legacy methods compatibility', () => {
    beforeEach(() => {
      socketService.connect();
    });

    describe('joinConversation', () => {
      it('should emit join_conversation event', () => {
        const conversationId = 'conv123';
        
        socketService.joinConversation(conversationId);
        
        expect(mockSocket.emit).toHaveBeenCalledWith('join_conversation', conversationId);
      });
    });

    describe('sendMessage', () => {
      it('should emit send_message event with correct data', () => {
        const messageData = {
          text: 'Hello, world!',
          senderId: 'user123',
          senderName: 'John Doe',
          conversationId: 'conv456',
        };
        
        socketService.sendMessage(messageData);
        
        expect(mockSocket.emit).toHaveBeenCalledWith('send_message', messageData);
      });
    });

    describe('typing indicators', () => {
      it('should emit typing_start event', () => {
        const conversationId = 'conv123';
        const userId = 'user456';
        const userName = 'Jane Smith';
        
        socketService.startTyping(conversationId, userId, userName);
        
        expect(mockSocket.emit).toHaveBeenCalledWith('typing_start', {
          conversationId,
          userId,
          userName,
        });
      });

      it('should emit typing_stop event', () => {
        const conversationId = 'conv123';
        const userId = 'user456';
        
        socketService.stopTyping(conversationId, userId);
        
        expect(mockSocket.emit).toHaveBeenCalledWith('typing_stop', {
          conversationId,
          userId,
        });
      });
    });
  });

  describe('Error handling', () => {
    it('should handle socket disconnection gracefully', () => {
      socketService.connect();
      socketService.disconnect();
      
      // Should not throw errors when calling methods on disconnected socket
      expect(() => {
        socketService.setUserOnline('user123', 'John Doe');
        socketService.markMessageAsRead('msg123', 'conv456', 'user789', 'Jane Smith');
        socketService.addReaction('msg123', 'conv456', 'user789', 'Jane Smith', '👍');
        socketService.removeReaction('msg123', 'conv456', 'user789', 'reaction123');
      }).not.toThrow();
    });

    it('should handle methods called before connection', () => {
      // Should not throw errors when calling methods before connecting
      expect(() => {
        socketService.setUserOnline('user123', 'John Doe');
        socketService.markMessageAsRead('msg123', 'conv456', 'user789', 'Jane Smith');
        socketService.addReaction('msg123', 'conv456', 'user789', 'Jane Smith', '👍');
      }).not.toThrow();
      
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  describe('Event listener cleanup', () => {
    it('should provide cleanup methods for all event listeners', () => {
      socketService.connect();
      
      const callbacks = {
        presence: jest.fn(),
        messageRead: jest.fn(),
        reactionAdded: jest.fn(),
        reactionRemoved: jest.fn(),
        connect: jest.fn(),
        disconnect: jest.fn(),
        error: jest.fn(),
      };
      
      // Test that all cleanup methods exist and work
      expect(() => {
        socketService.offUserPresenceUpdate(callbacks.presence);
        socketService.offMessageRead(callbacks.messageRead);
        socketService.offReactionAdded(callbacks.reactionAdded);
        socketService.offReactionRemoved(callbacks.reactionRemoved);
        socketService.offConnect(callbacks.connect);
        socketService.offDisconnect(callbacks.disconnect);
        socketService.offError(callbacks.error);
      }).not.toThrow();
      
      // Verify that off was called for each event type
      expect(mockSocket.off).toHaveBeenCalledWith('user_presence_update', callbacks.presence);
      expect(mockSocket.off).toHaveBeenCalledWith('message_read', callbacks.messageRead);
      expect(mockSocket.off).toHaveBeenCalledWith('reaction_added', callbacks.reactionAdded);
      expect(mockSocket.off).toHaveBeenCalledWith('reaction_removed', callbacks.reactionRemoved);
      expect(mockSocket.off).toHaveBeenCalledWith('connect', callbacks.connect);
      expect(mockSocket.off).toHaveBeenCalledWith('disconnect', callbacks.disconnect);
      expect(mockSocket.off).toHaveBeenCalledWith('error', callbacks.error);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete user presence flow', () => {
      socketService.connect();
      
      const presenceCallback = jest.fn();
      const connectCallback = jest.fn();
      
      // Set up listeners
      socketService.onUserPresenceUpdate(presenceCallback);
      socketService.onConnect(connectCallback);
      
      // Set user online
      socketService.setUserOnline('user123', 'John Doe', 'conv456');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('user_online', {
        userId: 'user123',
        userName: 'John Doe',
        conversationId: 'conv456',
      });
      
      expect(mockSocket.on).toHaveBeenCalledWith('user_presence_update', presenceCallback);
      expect(mockSocket.on).toHaveBeenCalledWith('connect', connectCallback);
    });

    it('should handle complete message reaction flow', () => {
      socketService.connect();
      
      const reactionAddedCallback = jest.fn();
      const reactionRemovedCallback = jest.fn();
      
      // Set up listeners
      socketService.onReactionAdded(reactionAddedCallback);
      socketService.onReactionRemoved(reactionRemovedCallback);
      
      // Add reaction
      socketService.addReaction('msg123', 'conv456', 'user789', 'Jane Smith', '👍');
      
      // Remove reaction
      socketService.removeReaction('msg123', 'conv456', 'user789', 'reaction123');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('add_reaction', {
        messageId: 'msg123',
        conversationId: 'conv456',
        userId: 'user789',
        userName: 'Jane Smith',
        emoji: '👍',
      });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('remove_reaction', {
        messageId: 'msg123',
        conversationId: 'conv456',
        userId: 'user789',
        reactionId: 'reaction123',
      });
      
      expect(mockSocket.on).toHaveBeenCalledWith('reaction_added', reactionAddedCallback);
      expect(mockSocket.on).toHaveBeenCalledWith('reaction_removed', reactionRemovedCallback);
    });

    it('should handle complete read receipts flow', () => {
      socketService.connect();
      
      const messageReadCallback = jest.fn();
      
      // Set up listener
      socketService.onMessageRead(messageReadCallback);
      
      // Mark message as read
      socketService.markMessageAsRead('msg123', 'conv456', 'user789', 'Jane Smith');
      
      expect(mockSocket.emit).toHaveBeenCalledWith('mark_message_read', {
        messageId: 'msg123',
        conversationId: 'conv456',
        userId: 'user789',
        userName: 'Jane Smith',
      });
      
      expect(mockSocket.on).toHaveBeenCalledWith('message_read', messageReadCallback);
    });
  });
});