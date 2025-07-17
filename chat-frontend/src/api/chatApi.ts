import {
  Message,
  Conversation,
  CreateMessageRequest,
  CreateConversationRequest,
  ApiResponse,
  DbUser,
  CreateUserRequest,
  MessageHistoryRequest,
  PaginatedResponse,
  SearchMessagesRequest,
  SearchResult,
  DirectConversationRequest,
  UserListResponse,
  ThreadReplyRequest,
  MessageSearchRequest,
  ConversationSearchRequest,
  MessageSearchResult,
  SearchResponse,
} from '@chat-types'
import { getApiUrl } from '@config/env'

const API_BASE_URL = `${getApiUrl()}/api`

class ChatApi {
  private getDeviceHeaders() {
    return {
      'X-Platform': 'ios',
      'X-App-Version': '1.0.0',
      'X-Device-ID': 'simulator-device',
      'X-OS-Version': '15.0',
    }
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
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null as any,
      }
    }
  }

  async getConversations(userId?: string): Promise<ApiResponse<Conversation[]>> {
    const params = userId ? `?userId=${encodeURIComponent(userId)}` : ''
    return this.request<Conversation[]>(`/conversations${params}`)
  }

  async getMessages(conversationId: string): Promise<ApiResponse<Message[]>> {
    return this.request<Message[]>(`/conversations/${conversationId}/messages`)
  }

  async getMessageHistory(params: MessageHistoryRequest): Promise<ApiResponse<PaginatedResponse<Message>>> {
    const { conversationId, page = 1, limit = 50 } = params
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    })
    return this.request<PaginatedResponse<Message>>(`/conversations/${conversationId}/messages?${queryParams}`)
  }

  async createConversation(data: CreateConversationRequest): Promise<ApiResponse<Conversation>> {
    return this.request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async sendMessage(data: CreateMessageRequest): Promise<ApiResponse<Message>> {
    return this.request<Message>('/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async deleteMessage(messageId: string): Promise<ApiResponse<{ id: string }>> {
    return this.request<{ id: string }>(`/messages/${messageId}`, {
      method: 'DELETE',
    })
  }

  async deleteConversation(conversationId: string): Promise<ApiResponse<boolean>> {
    return this.request<boolean>(`/conversations/${conversationId}`, {
      method: 'DELETE',
    })
  }

  async updateConversation(
    conversationId: string,
    title: string,
  ): Promise<ApiResponse<Conversation>> {
    return this.request<Conversation>(`/conversations/${conversationId}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    })
  }

  // User management methods
  async createUser(data: CreateUserRequest): Promise<ApiResponse<DbUser>> {
    return this.request<DbUser>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getUser(username: string): Promise<ApiResponse<DbUser>> {
    return this.request<DbUser>(`/users/${encodeURIComponent(username)}`)
  }

  // Search methods (for future implementation)
  async searchMessages(params: SearchMessagesRequest): Promise<ApiResponse<SearchResult[]>> {
    const queryParams = new URLSearchParams({
      query: params.query,
      limit: (params.limit || 50).toString()
    })
    if (params.conversationId) {
      queryParams.append('conversationId', params.conversationId)
    }
    return this.request<SearchResult[]>(`/search/messages?${queryParams}`)
  }

  // Phase 2: Private Messaging API methods
  async getAllUsers(currentUserId: string): Promise<ApiResponse<UserListResponse[]>> {
    const queryParams = new URLSearchParams({
      currentUserId
    })
    return this.request<UserListResponse[]>(`/users?${queryParams}`)
  }

  async createDirectConversation(data: DirectConversationRequest): Promise<ApiResponse<Conversation>> {
    return this.request<Conversation>('/conversations/direct', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getDirectConversations(userId: string): Promise<ApiResponse<Conversation[]>> {
    const queryParams = new URLSearchParams({
      userId
    })
    return this.request<Conversation[]>(`/conversations/direct?${queryParams}`)
  }

  // Phase 3: Message Threading API methods
  async createThreadReply(messageId: string, data: ThreadReplyRequest): Promise<ApiResponse<Message>> {
    return this.request<Message>(`/messages/${messageId}/reply`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async getThread(threadId: string): Promise<ApiResponse<Message[]>> {
    return this.request<Message[]>(`/threads/${threadId}`)
  }

  // Phase 4: Message Search API methods
  async searchMessagesAdvanced(params: MessageSearchRequest): Promise<ApiResponse<SearchResponse<MessageSearchResult>>> {
    const queryParams = new URLSearchParams({
      query: params.query,
      limit: (params.limit || 50).toString()
    })
    if (params.conversationId) {
      queryParams.append('conversationId', params.conversationId)
    }
    return this.request<SearchResponse<MessageSearchResult>>(`/search/messages?${queryParams}`)
  }

  async searchConversations(params: ConversationSearchRequest): Promise<ApiResponse<SearchResponse<Conversation>>> {
    const queryParams = new URLSearchParams({
      query: params.query,
      userId: params.userId
    })
    return this.request<SearchResponse<Conversation>>(`/search/conversations?${queryParams}`)
  }
}

export const chatApi = new ChatApi()
