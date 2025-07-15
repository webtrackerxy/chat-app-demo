import { Message, Conversation, CreateMessageRequest, CreateConversationRequest, ApiResponse } from '../../../chat-types/src';
import { getApiUrl } from '../config/env';

const API_BASE_URL = `${getApiUrl()}/api`;

class ChatApi {
  private getDeviceHeaders() {
    return {
      'X-Platform': 'ios',
      'X-App-Version': '1.0.0',
      'X-Device-ID': 'simulator-device',
      'X-OS-Version': '15.0',
    };
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.getDeviceHeaders(),
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null as any,
      };
    }
  }

  async getConversations(): Promise<ApiResponse<Conversation[]>> {
    return this.request<Conversation[]>('/conversations');
  }

  async getMessages(conversationId: string): Promise<ApiResponse<Message[]>> {
    return this.request<Message[]>(`/conversations/${conversationId}/messages`);
  }


  async createConversation(data: CreateConversationRequest): Promise<ApiResponse<Conversation>> {
    return this.request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async sendMessage(data: CreateMessageRequest): Promise<ApiResponse<Message>> {
    return this.request<Message>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<{ id: string }>> {
    return this.request<{ id: string }>(`/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  async deleteConversation(conversationId: string): Promise<ApiResponse<boolean>> {
    return this.request<boolean>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async updateConversation(conversationId: string, title: string): Promise<ApiResponse<Conversation>> {
    return this.request<Conversation>(`/conversations/${conversationId}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  }
}

export const chatApi = new ChatApi();