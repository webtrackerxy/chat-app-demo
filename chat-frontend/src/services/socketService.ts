import io, { Socket } from 'socket.io-client';

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
}

export interface TypingData {
  conversationId: string;
  userId: string;
  userName: string;
}

class SocketService {
  private socket: Socket | null = null;
  private serverUrl: string = 'http://localhost:3000';
  
  connect(serverUrl?: string): Socket {
    if (serverUrl) {
      this.serverUrl = serverUrl;
    }
    
    this.socket = io(this.serverUrl);
    return this.socket;
  }
  
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
  
  getSocket(): Socket | null {
    return this.socket;
  }
  
  // Conversation management
  joinConversation(conversationId: string): void {
    if (this.socket) {
      this.socket.emit('join_conversation', conversationId);
    }
  }
  
  // Message handling
  sendMessage(message: {
    text: string;
    senderId: string;
    senderName: string;
    conversationId: string;
  }): void {
    if (this.socket) {
      this.socket.emit('send_message', message);
    }
  }
  
  onNewMessage(callback: (message: Message) => void): void {
    if (this.socket) {
      this.socket.on('new_message', callback);
    }
  }
  
  offNewMessage(callback?: (message: Message) => void): void {
    if (this.socket) {
      this.socket.off('new_message', callback);
    }
  }
  
  // Typing indicators
  startTyping(conversationId: string, userId: string, userName: string): void {
    if (this.socket) {
      this.socket.emit('typing_start', { conversationId, userId, userName });
    }
  }
  
  stopTyping(conversationId: string, userId: string): void {
    if (this.socket) {
      this.socket.emit('typing_stop', { conversationId, userId });
    }
  }
  
  onUserTyping(callback: (data: { userId: string; userName: string }) => void): void {
    if (this.socket) {
      this.socket.on('user_typing', callback);
    }
  }
  
  onUserStoppedTyping(callback: (data: { userId: string }) => void): void {
    if (this.socket) {
      this.socket.on('user_stopped_typing', callback);
    }
  }
  
  offUserTyping(callback?: (data: { userId: string; userName: string }) => void): void {
    if (this.socket) {
      this.socket.off('user_typing', callback);
    }
  }
  
  offUserStoppedTyping(callback?: (data: { userId: string }) => void): void {
    if (this.socket) {
      this.socket.off('user_stopped_typing', callback);
    }
  }
  
  // Connection status
  onConnect(callback: () => void): void {
    if (this.socket) {
      this.socket.on('connect', callback);
    }
  }
  
  onDisconnect(callback: () => void): void {
    if (this.socket) {
      this.socket.on('disconnect', callback);
    }
  }
  
  onError(callback: (error: any) => void): void {
    if (this.socket) {
      this.socket.on('error', callback);
    }
  }
  
  // Cleanup listeners
  offConnect(callback?: () => void): void {
    if (this.socket) {
      this.socket.off('connect', callback);
    }
  }
  
  offDisconnect(callback?: () => void): void {
    if (this.socket) {
      this.socket.off('disconnect', callback);
    }
  }
  
  offError(callback?: (error: any) => void): void {
    if (this.socket) {
      this.socket.off('error', callback);
    }
  }
}

export const socketService = new SocketService();