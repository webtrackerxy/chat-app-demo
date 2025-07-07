import { Message, Conversation, CreateMessageRequest, CreateConversationRequest, ApiResponse } from '../../../chat-types/src';
import { chatApi } from './chatApi';
import { StorageMode } from '../screens/NameInputScreen';

interface StorageApiInterface {
  getConversations(): Promise<ApiResponse<Conversation[]>>;
  getMessages(conversationId: string): Promise<ApiResponse<Message[]>>;
  createConversation(data: CreateConversationRequest): Promise<ApiResponse<Conversation>>;
  sendMessage(data: CreateMessageRequest): Promise<ApiResponse<Message>>;
  deleteConversation?(conversationId: string): Promise<ApiResponse<boolean>>;
  updateConversation?(conversationId: string, title: string): Promise<ApiResponse<Conversation>>;
  deleteMessage?(messageId: string): Promise<ApiResponse<boolean>>;
}

// Simple in-memory storage for local mode (since AsyncStorage isn't installed)
class InMemoryStorageApi implements StorageApiInterface {
  private conversations: Conversation[] = [];
  private initialized = false;
  private idCounter = 0;

  private generateId(): string {
    // Use timestamp + counter + random to ensure uniqueness
    this.idCounter = (this.idCounter + 1) % 999999;
    return `${Date.now()}_${this.idCounter}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeDefaults(): void {
    if (this.initialized) return;
    
    // Create default "General" conversation with nested messages
    const defaultConversation: Conversation = {
      id: 'general',
      title: 'General',
      participants: [], // Can be shared by all users
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [
        {
          id: 'welcome-msg',
          senderId: 'system',
          senderName: 'System',
          text: 'Welcome to the General conversation! This is a shared space for everyone.',
          timestamp: new Date()
        }
      ]
    };

    this.conversations.push(defaultConversation);
    this.initialized = true;
  }

  async getConversations(): Promise<ApiResponse<Conversation[]>> {
    this.initializeDefaults();
    
    try {
      const conversationsWithLastMessage = this.conversations.map(conv => {
        const lastMessage = conv.messages.length > 0 
          ? conv.messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
          : undefined;
        
        return {
          ...conv,
          lastMessage
        };
      });

      return {
        success: true,
        data: conversationsWithLastMessage,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get conversations',
        data: []
      };
    }
  }

  async getMessages(conversationId: string): Promise<ApiResponse<Message[]>> {
    this.initializeDefaults();
    
    try {
      const conversation = this.conversations.find(conv => conv.id === conversationId);
      
      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found',
          data: []
        };
      }

      // Return messages sorted by timestamp
      const sortedMessages = conversation.messages.sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      return {
        success: true,
        data: sortedMessages,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get messages',
        data: []
      };
    }
  }


  async createConversation(data: CreateConversationRequest): Promise<ApiResponse<Conversation>> {
    try {
      const newConversation: Conversation = {
        id: this.generateId(),
        title: data.title,
        participants: data.participants,
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: []
      };

      this.conversations.push(newConversation);

      return {
        success: true,
        data: newConversation,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create conversation',
        data: null as any
      };
    }
  }

  async sendMessage(data: CreateMessageRequest): Promise<ApiResponse<Message>> {
    try {
      // Find the conversation
      const conversation = this.conversations.find(conv => conv.id === data.conversationId);
      
      if (!conversation) {
        return {
          success: false,
          error: 'Conversation not found',
          data: null as any
        };
      }

      const newMessage: Message = {
        id: this.generateId(),
        senderId: data.senderId,
        senderName: data.senderName,
        text: data.text,
        timestamp: new Date()
      };

      // Add message to conversation's messages array
      conversation.messages.push(newMessage);
      conversation.updatedAt = new Date();

      return {
        success: true,
        data: newMessage,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
        data: null as any
      };
    }
  }

  async deleteConversation(conversationId: string): Promise<ApiResponse<boolean>> {
    try {
      // Prevent deletion of default General conversation
      if (conversationId === 'general') {
        return {
          success: false,
          error: 'Cannot delete the default General conversation',
          data: false
        };
      }

      this.conversations = this.conversations.filter(conv => conv.id !== conversationId);

      return {
        success: true,
        data: true,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete conversation',
        data: false
      };
    }
  }

  async updateConversation(conversationId: string, title: string): Promise<ApiResponse<Conversation>> {
    try {
      // Prevent editing of default General conversation
      if (conversationId === 'general') {
        return {
          success: false,
          error: 'Cannot edit the default General conversation',
          data: null as any
        };
      }

      const conversationIndex = this.conversations.findIndex(conv => conv.id === conversationId);
      
      if (conversationIndex === -1) {
        return {
          success: false,
          error: 'Conversation not found',
          data: null as any
        };
      }

      this.conversations[conversationIndex].title = title;

      return {
        success: true,
        data: this.conversations[conversationIndex],
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update conversation',
        data: null as any
      };
    }
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<boolean>> {
    try {
      // Find the conversation containing the message
      let foundConversation = null;
      let messageIndex = -1;
      
      for (const conversation of this.conversations) {
        messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
        if (messageIndex !== -1) {
          foundConversation = conversation;
          break;
        }
      }
      
      if (!foundConversation || messageIndex === -1) {
        return {
          success: false,
          error: 'Message not found',
          data: false
        };
      }
      
      // Remove message from conversation's messages array
      foundConversation.messages.splice(messageIndex, 1);

      return {
        success: true,
        data: true,
        error: undefined
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete message',
        data: false
      };
    }
  }
}

// Backend API wrapper
class BackendStorageApi implements StorageApiInterface {
  async getConversations(): Promise<ApiResponse<Conversation[]>> {
    return chatApi.getConversations();
  }

  async getMessages(conversationId: string): Promise<ApiResponse<Message[]>> {
    return chatApi.getMessages(conversationId);
  }

  async createConversation(data: CreateConversationRequest): Promise<ApiResponse<Conversation>> {
    return chatApi.createConversation(data);
  }

  async sendMessage(data: CreateMessageRequest): Promise<ApiResponse<Message>> {
    return chatApi.sendMessage(data);
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<boolean>> {
    const response = await chatApi.deleteMessage(messageId);
    if (response.success) {
      return {
        success: true,
        data: true,
        error: undefined
      };
    } else {
      return {
        success: false,
        data: false,
        error: response.error
      };
    }
  }

  async deleteConversation(conversationId: string): Promise<ApiResponse<boolean>> {
    const response = await chatApi.deleteConversation(conversationId);
    if (response.success) {
      return {
        success: true,
        data: true,
        error: undefined
      };
    } else {
      return {
        success: false,
        data: false,
        error: response.error
      };
    }
  }

  async updateConversation(conversationId: string, title: string): Promise<ApiResponse<Conversation>> {
    return chatApi.updateConversation(conversationId, title);
  }
}

class StorageApiFactory {
  private static inMemoryApi = new InMemoryStorageApi();
  private static backendApi = new BackendStorageApi();

  static getApi(mode: StorageMode): StorageApiInterface {
    return mode === 'local' ? this.inMemoryApi : this.backendApi;
  }
}

export { StorageApiFactory, type StorageApiInterface };