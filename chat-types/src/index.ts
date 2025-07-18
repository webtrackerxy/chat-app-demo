// Represents a file attachment in a message
export interface FileAttachment {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  type: 'image' | 'audio' | 'video' | 'document';
  url: string;
  uploadedAt: Date;
  duration?: number; // Optional: For audio files
  thumbnail?: string; // Optional: For videos/images
}

// Represents a single chat message exchanged within a conversation
export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  type: 'text' | 'image' | 'audio' | 'video' | 'document'; // Message type
  file?: FileAttachment; // Optional: File attachment
  readBy?: ReadReceipt[]; // Optional: Array of read receipts
  reactions?: MessageReaction[]; // Optional: Array of reactions
  threadId?: string; // Optional: Thread ID for threading support
  replyToId?: string; // Optional: Parent message ID for threading
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
  isOnline?: boolean; // Optional: Online status
  lastSeen?: Date; // Optional: Last seen timestamp
}

// Payload structure to create a new message within a conversation
export interface CreateMessageRequest {
  text: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  encrypted?: boolean;
  encryptionKeyId?: string;
}

// Payload structure to create a file message
export interface CreateFileMessageRequest {
  conversationId: string;
  senderId: string;
  senderName: string;
  fileData: FileAttachment;
}

// Payload structure to create a new conversation with selected participants
export interface CreateConversationRequest {
  title: string;
  participants: string[];
}

// Represents a read receipt for a message
export interface ReadReceipt {
  userId: string;
  userName: string;
  readAt: Date;
}

// Represents a reaction to a message
export interface MessageReaction {
  id: string;
  userId: string;
  userName: string;
  emoji: string;
  timestamp: Date;
}

// Represents user presence status
export interface UserPresence {
  userId: string;
  userName: string;
  isOnline: boolean;
  lastSeen?: Date;
  conversationId?: string; // Optional: Current conversation user is in
}

// Payload structure to mark a message as read
export interface MarkMessageReadRequest {
  messageId: string;
  conversationId: string;
  userId: string;
  userName: string;
}

// Payload structure to add a reaction to a message
export interface AddReactionRequest {
  messageId: string;
  conversationId: string;
  userId: string;
  userName: string;
  emoji: string;
}

// Payload structure to remove a reaction from a message
export interface RemoveReactionRequest {
  messageId: string;
  conversationId: string;
  userId: string;
  reactionId: string;
}

// Payload structure for user presence updates
export interface UserPresenceUpdate {
  userId: string;
  userName: string;
  isOnline: boolean;
  conversationId?: string;
}

// Generic API response wrapper for client-server communication
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string; // Optional: Error message if request fails
}

// Database-specific types for persistence

// Database user model
export interface DbUser {
  id: string;
  username: string;
  publicKey?: string;
  privateKey?: string; // Encrypted private key stored on server
  lastSeen: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

// Database conversation model
export interface DbConversation {
  id: string;
  type: 'group' | 'direct';
  name?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

// Enhanced message with database fields
export interface DbMessage extends Message {
  threadId?: string; // For threading support
  replyToId?: string; // For threading support
  encrypted?: boolean;
  encryptionKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Pagination response
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    hasMore: boolean;
    total?: number;
  };
}

// User creation request
export interface CreateUserRequest {
  username: string;
  publicKey?: string;
}

// Message history request
export interface MessageHistoryRequest {
  conversationId: string;
  page?: number;
  limit?: number;
}

// Search request
export interface SearchMessagesRequest {
  query: string;
  conversationId?: string;
  limit?: number;
}

// Search result
export interface SearchResult {
  message: Message;
  conversation: Conversation;
  highlightedText?: string;
}

// Thread-related types
export interface Thread {
  id: string;
  parentMessageId: string;
  messages: Message[];
  createdAt: Date;
}

export interface CreateThreadRequest {
  parentMessageId: string;
  message: CreateMessageRequest;
}

// Phase 2: Private Messaging types
export interface DirectConversationRequest {
  user1Id: string;
  user2Id: string;
}

export interface UserListResponse {
  id: string;
  username: string;
  status: string;
  lastSeen: Date;
}

// Phase 3: Threading types
export interface ThreadReplyRequest {
  text: string;
  senderId: string;
  conversationId: string;
}

// Phase 4: Search types
export interface MessageSearchRequest {
  query: string;
  conversationId?: string;
  limit?: number;
}

export interface ConversationSearchRequest {
  query: string;
  userId: string;
}

export interface MessageSearchResult {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  timestamp: Date;
  conversationId: string;
  conversationName: string;
  conversationType: 'group' | 'direct';
  threadId?: string;
  replyToId?: string;
}

export interface SearchResponse<T> {
  data: T[];
  meta: {
    query: string;
    conversationId?: string;
    totalResults: number;
  };
}

// Key management types
export interface UserKeyGenerationRequest {
  userId: string;
  password: string; // For encrypting private key
}

export interface ConversationKeyRequest {
  conversationId: string;
  userId: string;
}

export interface EncryptedUserKeys {
  publicKey: string;
  encryptedPrivateKey: string;
  keyId: string;
}

export interface ConversationKeyResponse {
  keyId: string;
  encryptedKey: string; // Encrypted with user's public key
  conversationId: string;
}

// Encryption-related types and utilities
export * from './encryption';
