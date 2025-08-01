import io, { Socket } from 'socket.io-client'
import {
  Message,
  ReadReceipt,
  MessageReaction,
  UserPresence,
  MarkMessageReadRequest,
  AddReactionRequest,
  RemoveReactionRequest,
  UserPresenceUpdate,
  FileAttachment,
  CreateFileMessageRequest,
} from '@chat-types'
import { getSocketUrl } from '@config/env'

export interface TypingData {
  conversationId: string
  userId: string
  userName: string
}

class SocketService {
  private socket: Socket | null = null
  private serverUrl: string = getSocketUrl()

  connect(serverUrl?: string): Socket {
    if (serverUrl) {
      this.serverUrl = serverUrl
    }

    this.socket = io(this.serverUrl)
    return this.socket
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  getSocket(): Socket | null {
    return this.socket
  }

  // Conversation management
  joinConversation(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('join_conversation', conversationId)
    }
  }

  // Message handling
  sendMessage(message: {
    text: string
    senderId: string
    senderName: string
    conversationId: string
  }): void {
    console.log('📡 SocketService.sendMessage called')
    console.log('📡 Message data:', {
      textLength: message.text.length,
      senderId: message.senderId,
      conversationId: message.conversationId,
      textPreview: message.text.substring(0, 100) + (message.text.length > 100 ? '...' : '')
    })
    console.log('📡 Socket connected:', !!this.socket)
    
    if (this.socket) {
      console.log('📡 Emitting send_message event to server...')
      this.socket.emit('send_message', message)
      console.log('📡 Message emitted to server via WebSocket')
    } else {
      console.error('📡 ERROR: Socket not connected, cannot send message')
    }
  }

  // File message handling
  sendFileMessage(data: {
    senderId: string
    senderName: string
    conversationId: string
    fileData: FileAttachment
  }): void {
    if (this.socket) {
      this.socket.emit('send_file_message', data)
    }
  }

  onNewMessage(callback: (message: Message) => void): void {
    if (this.socket) {
      this.socket.on('new_message', callback)
    }
  }

  offNewMessage(callback?: (message: Message) => void): void {
    if (this.socket) {
      this.socket.off('new_message', callback)
    }
  }

  // Typing indicators
  startTyping(conversationId: string, userId: string, userName: string): void {
    if (this.socket) {
      this.socket.emit('typing_start', { conversationId, userId, userName })
    }
  }

  stopTyping(conversationId: string, userId: string): void {
    if (this.socket) {
      this.socket.emit('typing_stop', { conversationId, userId })
    }
  }

  onUserTyping(callback: (data: { userId: string; userName: string }) => void): void {
    if (this.socket) {
      this.socket.on('user_typing', callback)
    }
  }

  onUserStoppedTyping(callback: (data: { userId: string }) => void): void {
    if (this.socket) {
      this.socket.on('user_stopped_typing', callback)
    }
  }

  offUserTyping(callback?: (data: { userId: string; userName: string }) => void): void {
    if (this.socket) {
      this.socket.off('user_typing', callback)
    }
  }

  offUserStoppedTyping(callback?: (data: { userId: string }) => void): void {
    if (this.socket) {
      this.socket.off('user_stopped_typing', callback)
    }
  }

  // Connection status
  onConnect(callback: () => void): void {
    if (this.socket) {
      this.socket.on('connect', callback)
    }
  }

  onDisconnect(callback: () => void): void {
    if (this.socket) {
      this.socket.on('disconnect', callback)
    }
  }

  onError(callback: (error: any) => void): void {
    if (this.socket) {
      this.socket.on('error', callback)
    }
  }

  // User presence
  setUserOnline(userId: string, userName: string, conversationId?: string): void {
    if (this.socket) {
      this.socket.emit('user_online', { userId, userName, conversationId })
    }
  }

  onUserPresenceUpdate(callback: (data: UserPresenceUpdate) => void): void {
    if (this.socket) {
      this.socket.on('user_presence_update', callback)
    }
  }

  offUserPresenceUpdate(callback?: (data: UserPresenceUpdate) => void): void {
    if (this.socket) {
      this.socket.off('user_presence_update', callback)
    }
  }

  // Read receipts
  markMessageAsRead(
    messageId: string,
    conversationId: string,
    userId: string,
    userName: string,
  ): void {
    if (this.socket) {
      this.socket.emit('mark_message_read', { messageId, conversationId, userId, userName })
    }
  }

  onMessageRead(callback: (data: { messageId: string; readReceipt: ReadReceipt }) => void): void {
    if (this.socket) {
      this.socket.on('message_read', callback)
    }
  }

  offMessageRead(callback?: (data: { messageId: string; readReceipt: ReadReceipt }) => void): void {
    if (this.socket) {
      this.socket.off('message_read', callback)
    }
  }

  // Message reactions
  addReaction(
    messageId: string,
    conversationId: string,
    userId: string,
    userName: string,
    emoji: string,
  ): void {
    if (this.socket) {
      this.socket.emit('add_reaction', { messageId, conversationId, userId, userName, emoji })
    }
  }

  removeReaction(
    messageId: string,
    conversationId: string,
    userId: string,
    reactionId: string,
  ): void {
    if (this.socket) {
      this.socket.emit('remove_reaction', { messageId, conversationId, userId, reactionId })
    }
  }

  onReactionAdded(
    callback: (data: { messageId: string; reaction: MessageReaction }) => void,
  ): void {
    if (this.socket) {
      this.socket.on('reaction_added', callback)
    }
  }

  onReactionRemoved(
    callback: (data: { messageId: string; reactionId: string; userId: string }) => void,
  ): void {
    if (this.socket) {
      this.socket.on('reaction_removed', callback)
    }
  }

  offReactionAdded(
    callback?: (data: { messageId: string; reaction: MessageReaction }) => void,
  ): void {
    if (this.socket) {
      this.socket.off('reaction_added', callback)
    }
  }

  offReactionRemoved(
    callback?: (data: { messageId: string; reactionId: string; userId: string }) => void,
  ): void {
    if (this.socket) {
      this.socket.off('reaction_removed', callback)
    }
  }

  // Message deletion methods
  deleteMessage(messageId: string, conversationId: string, userId: string): void {
    console.log('SocketService.deleteMessage called:', { messageId, conversationId, userId })
    console.log('Socket connected:', !!this.socket)
    if (this.socket) {
      console.log('Emitting delete_message event')
      this.socket.emit('delete_message', { messageId, conversationId, userId })
    } else {
      console.error('Socket not connected, cannot delete message')
    }
  }

  onMessageDeleted(callback: (data: { messageId: string; conversationId: string }) => void): void {
    if (this.socket) {
      this.socket.on('message_deleted', callback)
    }
  }

  offMessageDeleted(
    callback?: (data: { messageId: string; conversationId: string }) => void,
  ): void {
    if (this.socket) {
      this.socket.off('message_deleted', callback)
    }
  }

  // Cleanup listeners
  offConnect(callback?: () => void): void {
    if (this.socket) {
      this.socket.off('connect', callback)
    }
  }

  offDisconnect(callback?: () => void): void {
    if (this.socket) {
      this.socket.off('disconnect', callback)
    }
  }

  offError(callback?: (error: any) => void): void {
    if (this.socket) {
      this.socket.off('error', callback)
    }
  }
}

export const socketService = new SocketService()
