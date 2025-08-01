# Implementation Plan: Advanced Messaging Features

## 🎯 Feature Overview
1. **Private Messaging** - Direct 1-on-1 conversations between users
2. **Message Persistence** - Database storage with SQLite/PostgreSQL
3. **Message Threading** - Reply to specific messages with thread UI
4. **Message Search** - Full-text search across all conversations
5. **Message Encryption** - End-to-end encryption with crypto libraries

## 📋 Phase 1: Database & Persistence (Foundation)
**Priority: High** | **Estimated Time: 2-3 days**

### Backend Changes:
- Install database dependencies (`sqlite3` or `pg`, `prisma`)
- Create database schema (users, conversations, messages, threads)
- Implement data models and migrations
- Add database connection and query layers
- Update WebSocket handlers to use database
- Add message history API endpoints

### Database Schema:
```sql
users: id, username, publicKey, lastSeen, status
conversations: id, type(group/direct), name, createdAt, updatedAt
conversation_participants: conversationId, userId, joinedAt, role
messages: id, conversationId, senderId, text, threadId, encrypted, timestamp
message_files: id, messageId, filename, path, type, size
```

### Frontend Changes:
- Update `useChat` hook to load message history from API
- Add loading states for historical messages
- Implement pagination for message history
- Update message storage to use database IDs
- Add offline message queueing

## 📋 Phase 2: Private Messaging
**Priority: High** | **Estimated Time: 1-2 days**

### Frontend Changes:
- Add "Start Direct Message" functionality to ChatListScreen
- Create user selection component for DM creation
- Update conversation types (group vs direct)
- Add DM-specific UI indicators and styling
- Update navigation to support direct message flows

### Backend Changes:
- Add direct conversation creation endpoints
- Implement user discovery/search API
- Update WebSocket room management for private rooms
- Add participant management for direct messages

### New Components:
- `UserSearchModal` - Select users for direct messages
- `DMIndicator` - Visual indicator for direct message conversations
- `UserListItem` - Display users in search results

## 📋 Phase 3: Message Threading
**Priority: Medium** | **Estimated Time: 2-3 days**

### Frontend Changes:
- Add "Reply" button to MessageItem component
- Create ThreadView component for viewing reply chains
- Implement thread navigation and breadcrumbs
- Add thread indicators in main chat view
- Update MessageInput to handle reply context

### Backend Changes:
- Extend message schema with `threadId` and `replyToId`
- Add thread creation and retrieval APIs
- Update WebSocket events for threaded messages
- Implement thread notification logic

### New Components:
- `ThreadView` - Display message threads
- `ThreadIndicator` - Show thread status in messages
- `ReplyPreview` - Show original message being replied to
- `ThreadNavigation` - Navigate between thread and main chat

## 📋 Phase 4: Message Search
**Priority: Medium** | **Estimated Time: 2-3 days**

### Frontend Changes:
- Create SearchScreen with search input and filters
- Add search results component with message previews
- Implement search navigation from ChatListScreen
- Add search suggestions and recent searches
- Create search result highlighting

### Backend Changes:
- Implement full-text search with database indexing
- Add search API endpoints with pagination
- Create search filters (date, user, conversation)
- Add search result ranking and relevance

### New Components:
- `SearchScreen` - Message search interface
- `SearchResults` - Search result display
- `SearchFilters` - Filter search results
- `SearchSuggestions` - Show search suggestions

## 📋 Phase 5: Message Encryption
**Priority: Low** | **Estimated Time: 3-4 days**

### Frontend Changes:
- Implement key generation and management
- Add encryption/decryption utilities
- Create key exchange UI and flows
- Add encryption status indicators
- Handle encrypted message display

### Backend Changes:
- Add public key storage and exchange
- Implement encrypted message storage
- Add key management APIs
- Create secure message routing
- Add encryption status tracking

### New Components:
- `EncryptionSettings` - Manage encryption keys
- `KeyExchangeModal` - Exchange keys with users
- `EncryptionIndicator` - Show message encryption status
- `SecureMessageInput` - Encrypt messages before sending

## 🛠️ Technical Requirements

### Dependencies to Add:
```bash
# Backend
npm install prisma @prisma/client sqlite3
npm install bcrypt jsonwebtoken
npm install node-rsa crypto-js  # For encryption

# Frontend  
npm install @react-native-async-storage/async-storage
npm install react-native-keychain  # For secure key storage
npm install crypto-js  # For encryption
```

### New Hooks:
- `usePrivateMessages` - Manage DM functionality
- `useMessageSearch` - Handle search operations
- `useEncryption` - Manage encryption/decryption
- `useThreads` - Handle message threading
- `useMessageHistory` - Load and paginate historical messages

### Database Migrations:
```sql
-- Migration 1: Add users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  publicKey TEXT,
  lastSeen DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'offline'
);

-- Migration 2: Update conversations table
ALTER TABLE conversations ADD COLUMN type TEXT DEFAULT 'group';
ALTER TABLE conversations ADD COLUMN createdBy TEXT;

-- Migration 3: Add threading support
ALTER TABLE messages ADD COLUMN threadId TEXT;
ALTER TABLE messages ADD COLUMN replyToId TEXT;

-- Migration 4: Add encryption support
ALTER TABLE messages ADD COLUMN encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN encryptionKey TEXT;
```

## 🔄 Implementation Order

1. **Start with Database/Persistence** - This is the foundation for all other features
2. **Add Private Messaging** - Builds on database, relatively straightforward
3. **Implement Message Threading** - Requires database changes but manageable scope
4. **Build Message Search** - Depends on database having historical data
5. **Add Encryption Last** - Most complex, requires all other features working

## 🎯 Success Criteria

### Phase 1 (Database):
- ✅ Messages persist across app restarts
- ✅ Chat history loads from database
- ✅ Real-time messages save to database
- ✅ Message pagination works smoothly
- ✅ Offline messages queue and sync when connected

### Phase 2 (Private Messaging):
- ✅ Users can start 1-on-1 conversations
- ✅ Direct messages work with real-time features
- ✅ DM conversations separate from group chats
- ✅ User search and selection works
- ✅ DM notifications and presence work

### Phase 3 (Threading):
- ✅ Users can reply to specific messages
- ✅ Thread view shows conversation context
- ✅ Threaded messages sync in real-time
- ✅ Thread navigation is intuitive
- ✅ Thread indicators show unread replies

### Phase 4 (Search):
- ✅ Users can search across all conversations
- ✅ Search results show message context
- ✅ Search works with filters and pagination
- ✅ Search suggestions improve user experience
- ✅ Search performance is acceptable

### Phase 5 (Encryption):
- ✅ Messages encrypted end-to-end
- ✅ Key exchange works securely
- ✅ Encrypted messages display properly
- ✅ Key management is user-friendly
- ✅ Encryption doesn't break existing features

## 🔧 Architecture Changes

### Database Layer:
```typescript
// New database service
class DatabaseService {
  async saveMessage(message: Message): Promise<Message>
  async getMessages(conversationId: string, page: number): Promise<Message[]>
  async searchMessages(query: string, filters: SearchFilters): Promise<SearchResult[]>
  async createThread(parentMessageId: string, replyMessage: Message): Promise<Thread>
  async getThread(threadId: string): Promise<Thread>
}
```

### Encryption Layer:
```typescript
// New encryption service
class EncryptionService {
  async generateKeyPair(): Promise<KeyPair>
  async encryptMessage(message: string, recipientPublicKey: string): Promise<EncryptedMessage>
  async decryptMessage(encryptedMessage: EncryptedMessage): Promise<string>
  async exchangeKeys(userId: string): Promise<void>
}
```

### WebSocket Events:
```typescript
// New WebSocket events
interface WebSocketEvents {
  'direct-message': (data: DirectMessageData) => void
  'thread-reply': (data: ThreadReplyData) => void
  'search-request': (data: SearchRequestData) => void
  'key-exchange': (data: KeyExchangeData) => void
  'encryption-status': (data: EncryptionStatusData) => void
}
```

## 📁 File Structure Changes

```
/chat-backend
├── /prisma
│   ├── schema.prisma
│   └── /migrations
├── /src
│   ├── /database
│   │   ├── DatabaseService.js
│   │   └── models/
│   ├── /encryption
│   │   └── EncryptionService.js
│   └── /routes
│       ├── search.js
│       ├── threads.js
│       └── encryption.js

/chat-frontend/src
├── /components
│   ├── UserSearchModal.tsx
│   ├── ThreadView.tsx
│   ├── SearchScreen.tsx
│   └── EncryptionSettings.tsx
├── /hooks
│   ├── usePrivateMessages.ts
│   ├── useMessageSearch.ts
│   ├── useEncryption.ts
│   └── useThreads.ts
├── /services
│   ├── databaseService.ts
│   ├── encryptionService.ts
│   └── searchService.ts
└── /types
    ├── database.ts
    ├── encryption.ts
    └── search.ts
```

## 🚀 Getting Started

1. **Choose Implementation Phase** - Start with Phase 1 (Database)
2. **Set up Development Environment** - Install new dependencies
3. **Create Database Schema** - Run migrations and set up models
4. **Update Existing Code** - Modify current components to use database
5. **Test Thoroughly** - Ensure existing features still work
6. **Move to Next Phase** - Incrementally add new features

## 📋 Next Steps

Ready to begin implementation? Recommend starting with:

1. **Phase 1: Database Setup** - Creates foundation for all features
2. **Update chat-types** - Add new TypeScript interfaces
3. **Modify backend** - Add database integration
4. **Update frontend** - Connect to new database APIs
5. **Test migration** - Ensure existing functionality works

Would you like to proceed with Phase 1 implementation?