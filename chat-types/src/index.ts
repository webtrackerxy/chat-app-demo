// Represents a file attachment in a message
export interface FileAttachment {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  type: 'image' | 'audio' | 'document';
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
  type: 'text' | 'image' | 'audio' | 'document'; // Message type
  file?: FileAttachment; // Optional: File attachment
  readBy?: ReadReceipt[]; // Optional: Array of read receipts
  reactions?: MessageReaction[]; // Optional: Array of reactions
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
