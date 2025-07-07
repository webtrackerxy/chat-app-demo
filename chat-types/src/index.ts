// Represents a single chat message exchanged within a conversation
export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
}

// Represents a chat conversation between multiple participants
export interface Conversation {
  id: string;
  title: string;
  participants: string[];
  messages: Message[];
  updatedAt: Date;
  createdAt: Date;
  lastMessage?: Message; // Optional: The most recent message in the conversation
}

// Represents a user in the chat system
export interface User {
  id: string;
  name: string;
  avatar?: string; // Optional: User's profile image
}

// Payload structure to create a new message within a conversation
export interface CreateMessageRequest {
  text: string;
  conversationId: string;
  senderId: string;
  senderName: string;
}

// Payload structure to create a new conversation with selected participants
export interface CreateConversationRequest {
  title: string;
  participants: string[];
}

// Generic API response wrapper for client-server communication
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string; // Optional: Error message if request fails
}
