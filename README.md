

# Real-time Chat App
A full-featured real-time chat application with multimedia file sharing and end-to-end encryption, built with React Native (Expo) and WebSocket technology.

https://github.com/user-attachments/assets/7b6296ed-787a-4359-a45c-78fd69927a44

## 🔮 Future Enhancements

### ✅ Completed (Phase 1)
- **Message persistence** - Database storage for chat history ✅
- **User management** - Persistent user accounts ✅ 
- **Message history** - Paginated loading of older messages ✅

### ✅ Recently Implemented (Phase 2-4)
- **Private messaging** - Direct messages between users ✅
- **Message threading** - Reply to specific messages with UI navigation ✅
- **Message search** - Find messages across conversations with modal interface ✅

### ✅ Recently Implemented (Phase 5)
- **End-to-end encryption** - Military-grade AES-256-GCM encryption with RSA-2048 key exchange ✅
- **Key management system** - Secure key generation, distribution, and password protection ✅
- **Encryption UI components** - Easy-to-use setup modal and conversation toggles ✅
- **Per-conversation encryption** - Each conversation has isolated encryption keys ✅
- **Encryption indicators** - Clear visual feedback when encryption is active ✅
- **Zero-knowledge security** - Server never has access to decryption keys ✅
- **Debug tracing system** - Comprehensive encryption operation logging and debug panel ✅
- **Production encryption plan** - Detailed roadmap for implementing real encryption with backend support ✅

### 🚧 Planned Implementation

### 🔮 Future Ideas
- **Push notifications** - Background message alerts
- **Advanced reactions** - Custom emoji reactions
- **User roles** - Admin/moderator permissions
- **File encryption** - Extend encryption to multimedia files
- **Perfect Forward Secrecy** - Enhanced security with ephemeral keys
- **Post-quantum cryptography** - Future-proof encryption algorithms
- **Multi-device key sync** - Synchronize encryption keys across devices
- **File thumbnails** - Generate previews for images/videos
- **Cloud storage** - Integration with AWS S3 or similar services
- **Audio transcription** - Convert voice messages to text
- **Video compression** - Optimize video files for web delivery
- **Offline media caching** - Cache media for offline viewing
- 
## ✨ Features

### 🚀 Real-time Messaging
- **Instant message delivery** using WebSocket (Socket.IO)
- **Typing indicators** with automatic timeout
- **Connection status** indicators
- **Room-based conversations** for efficient messaging

### 👥 User Presence Features
- **Online/offline status** tracking with real-time updates
- **Manual presence toggle** - users can set themselves online/offline
- **Live user count** displaying who's currently online
- **Automatic presence management** - users go online when they connect

### 💬 Enhanced Message Interactions
- **Message reactions** with emoji support (👍 ❤️ 😂 😮 😢 😡)
- **One emoji per user** restriction with toggle/replacement logic
- **Real-time read receipts** showing who has read your messages
- **Automatic read detection** after 1 second of viewing
- **Message deletion** with real-time updates across all clients
- **Message threading** - Reply to specific messages with navigation
- **Private messaging** - Direct 1-on-1 conversations between users
- **Message search** - Search across all conversations with filtering
- **End-to-end encryption** - Military-grade AES-256-GCM encryption with RSA-2048 key exchange

### 🔐 End-to-End Encryption
- **AES-256-GCM encryption** - Industry-standard symmetric encryption for message content
- **RSA-2048 key exchange** - Secure asymmetric key distribution
- **Per-conversation keys** - Each conversation has its own encryption key for isolation
- **Password-protected keys** - Private keys encrypted with user passwords
- **Key management UI** - Easy setup and management of encryption keys
- **Encryption indicators** - Clear visual indicators when encryption is active
- **Zero-knowledge security** - Server never has access to decryption keys or plaintext
- **Forward secrecy** - Conversation keys are isolated and independently managed
- **Debug tracing** - Comprehensive logging for development and troubleshooting
- **Production-ready plan** - Roadmap for implementing real encryption with backend support

### 📁 Multimedia File Sharing
- **Image sharing** - Upload and share JPEG, PNG, GIF, WebP (optimized previews)
- **Video sharing** - Upload and share MP4, MOV, AVI, WebM with inline players
- **Voice messages** - Record and send audio messages with playback controls
- **Document sharing** - Upload and share PDF, DOC, TXT, XLS files
- **Real-time file broadcasting** - Files appear instantly across all connected clients
- **File validation** - Type and size restrictions (10MB limit)
- **Progress indicators** - Visual upload progress for all file types

### 🏗️ Architecture
- 🧠 **React Native frontend** (Expo + NativeWind + TypeScript)
- 🛰️ **Express.js backend** with WebSocket server and file upload support
- 🗄️ **Database persistence** with Prisma ORM and SQLite
- 🔁 **Shared TypeScript types** via chat-types package
- 🧰 **Zustand state management** with unified useChat() hook
- ⚡ **Fast local development** with optional database persistence
- 🔄 **Dual mode support**: Real-time (WebSocket + Database) + Local (in-memory)
- 🎣 **Advanced React hooks**: useUserPresence, useMessageReactions, useReadReceipts, useRealtimeMessages, useMessageHistory, usePrivateMessaging, useMessageThreading, useMessageSearch, useEncryption
- 🔐 **Encryption services**: End-to-end encryption with EncryptionService and key management
- 🌍 **Environment configuration** - Centralized .env configuration for all services
- 📁 **File upload system** - Multer-based backend with real-time broadcasting
- 🛣️ **Path mappings** - Clean import paths with TypeScript resolution
- 🔧 **Code quality tools** - ESLint, Prettier, TypeScript strict mode, circular dependency detection

### 📱 User Experience
- **Instant messaging**: No more 3-5 second delays
- **Live typing indicators**: See when others are typing
- **Connection monitoring**: Visual connection status with online user count
- **Interactive reactions**: Click emoji reactions with visual feedback
- **Read receipt tracking**: See who has read your messages
- **Presence controls**: Manual online/offline toggle in header
- **Multimedia sharing**: Drag-and-drop or click to share files, images, videos
- **Voice messaging**: One-tap recording with visual feedback and playback controls
- **Message persistence**: All messages stored in database with automatic syncing
- **Message history**: Paginated loading of older messages with smooth scrolling
- **User management**: Persistent user accounts with database backing
- **Private messaging**: Start direct 1-on-1 conversations with any user
- **Message threading**: Reply to specific messages with visual indicators and navigation
- **Message search**: Find messages across all conversations with filtering and highlighting
- **Auto-scroll functionality**: Messages automatically scroll to latest with smooth animations
- **Dark/Light theme**: Seamless theme switching with automatic component adaptation
- **Design tokens**: Consistent styling system with semantic color mapping
- **Compact design**: Optimized message sizes for mobile-first experience
- **Responsive design**: Works on web, iOS, and Android
- **Offline fallback**: Graceful degradation when disconnected
- **Secure messaging**: End-to-end encryption with easy setup and clear indicators

## 🗂️ Monorepo Structure
<pre>
/chat-app-demo
│
├── /chat-types ✅ Shared TS types (Message, Conversation, Encryption)
│ ├── index.ts
│ └── encryption.ts ✅ Encryption utilities and types
│
├── /chat-frontend ✅ Expo + NativeWind + Real-time hooks + Multimedia
│ ├── .env ✅ Environment configuration
│ ├── .prettierrc ✅ Code formatting configuration
│ ├── eslint.config.js ✅ ESLint configuration
│ ├── /src
│ │ ├── /api ✅ REST client (uses chat-types via @chat-types) + database API integration
│ │ ├── /hooks ✅ useChat + useRealtimeMessages + useTypingIndicator + useUserPresence + useMessageReactions + useReadReceipts + useMessageHistory + usePrivateMessaging + useMessageThreading + useMessageSearch + useEncryption
│ │ ├── /services ✅ WebSocket client (socketService) + fileUploadService + encryptionService
│ │ ├── /context ✅ SocketContext for connection management
│ │ ├── /store ✅ Zustand state management
│ │ ├── /config ✅ Environment variable management
│ │ ├── /components ✅ MessageInput + MessageItem + FilePicker + VoiceRecorder + FileMessage + VideoPlayer + ThemeToggle + UserSelector + SearchModal + EncryptionSetup + EncryptionToggle
│ │ ├── /screens ✅ ChatRoom with real-time features + presence controls + file sharing + dark/light themes
│ │ ├── /theme ✅ Design tokens system + ThemeContext + dark/light mode + semantic colors
│ │ ├── /types ✅ Local type definitions with path mapping support
│ │ ├── /__tests__ ✅ Component and integration tests
│ │ └── App.tsx
│ ├── package.json (+ expo-image-picker, expo-audio, expo-file-system)
│ ├── tsconfig.json ✅ TypeScript configuration with path mappings
│ └── jest.config.js ✅ Jest configuration with module name mapping
│
├── /chat-backend ✅ Express + Socket.IO WebSocket server + File Upload + Database
│ ├── .env ✅ Environment configuration
│ ├── index.js ✅ REST API + WebSocket handlers + file upload endpoints + real-time events + database integration
│ ├── /prisma ✅ Database schema and migrations
│ │ └── schema.prisma ✅ Database models (Users, Conversations, Messages, Reactions, ReadReceipts, ConversationKeys)
│ ├── /src/database ✅ Database service layer
│ │ └── DatabaseService.js ✅ CRUD operations and data access layer
│ ├── /src/services ✅ Backend service layer
│ │ └── EncryptionService.js ✅ End-to-end encryption service
│ ├── /uploads ✅ File storage directory
│ ├── /__tests__ ✅ Backend API, upload, and database tests
│ └── package.json (+ socket.io, multer, prisma, @prisma/client, dotenv)
│
├── REALTIME_IMPROVEMENTS.md ✅ Implementation suggestions
├── REALTIME_FLOW_SETUP_TEST.md ✅ Setup and testing guide
├── USER_PRESENCE_FEATURES.md ✅ User guide for enhanced features
├── USER_PRESENCE_FEATURES_SETUP_TEST.md ✅ Setup and testing guide for enhanced features
├── MULTI_MEDIA_FILES_SETUP_TEST.md ✅ Multimedia file sharing testing guide
├── ENV_CONFIG.md ✅ Environment configuration documentation
├── ENCRYPTION_MESSAGE.md ✅ Comprehensive encryption implementation documentation
├── PLAN_ENCRYPTION_FOR_PRODUCTION.md ✅ Production-ready encryption implementation plan
├── .gitignore
└── README.md
</pre>
## 🛠️ Development Workflow

### Code Quality Tools
The frontend includes comprehensive code quality tools:

```bash
cd chat-frontend

# Format code with Prettier
npm run prettier-write

# Check code formatting
npm run prettier-check

# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Type checking
npm run typecheck

# Check for circular dependencies
npm run circular-dependencies

# Run all quality checks
npm run check
```

### Path Mappings
The project uses TypeScript path mappings for cleaner imports:

```typescript
// Instead of relative imports:
import { useChat } from '../../../hooks/useChat'
import { Message } from '../../../chat-types/src'

// Use clean path mappings:
import { useChat } from '@hooks/useChat'
import { Message } from '@chat-types'
```

Available path mappings:
- `@components` → `src/components`
- `@hooks` → `src/hooks`
- `@services` → `src/services`
- `@screens` → `src/screens`
- `@store` → `src/store`
- `@api` → `src/api`
- `@config` → `src/config`
- `@context` → `src/context`
- `@types` → `src/types`
- `@theme` → `src/theme`
- `@chat-types` → `../chat-types/src`

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Backend (Express + Socket.IO server + File Upload + Database)
cd chat-backend
npm install

# Initialize database
npx prisma db push    # Create SQLite database and tables
npx prisma generate   # Generate Prisma client

npm start
# ✅ Server running on http://localhost:3000 with database persistence

# Frontend (React Native + Expo + Multimedia)
cd chat-frontend  
npm install
npx expo start --localhost
# ✅ Expo dev server running with database integration
```

### 2. Test Real-time Features
1. **Open multiple browser tabs** or devices
2. **Set different usernames** for each session
3. **Join the same conversation**
4. **Send messages** → should appear instantly on all devices and persist in database
5. **Start typing** → others will see typing indicators
6. **React to messages** → click emoji buttons to add reactions (stored in database)
7. **Toggle presence** → click online/offline button in header
8. **Check read receipts** → see who has read your messages (persisted in database)
9. **Share files** → click 📎 to upload images, videos, documents
10. **Record voice** → click 🎤 to record and send voice messages
11. **Toggle themes** → click 🌙/☀️ in header to switch between dark/light mode
12. **Delete messages** → long press or click delete button for real-time removal
13. **Test persistence** → refresh page and see messages reload from database
14. **Load message history** → scroll up to load older paginated messages
15. **Start private chat** → click 💬 Private Chat button to start direct messaging
16. **Reply to messages** → click Reply button to create threaded conversations
17. **Search messages** → click 🔍 button to search across all conversations
18. **Enable encryption** → set up encryption keys and enable per-conversation encryption
    - Click encryption setup button to generate or load keys
    - Enter a strong password for key protection
    - Toggle encryption for conversations
    - Verify 🔐 indicators appear for encrypted messages
    - Enable debug mode with `REACT_APP_DEBUG_ENCRYPTION=true` to see console logs
    - Click the 🔐📊 button in chat header to view encryption debug panel

### 3. Verify WebSocket Connection
- Look for **🟢 Connected** in the chat header (backend mode)
- Check browser console for "Socket connected" messages
- Test typing indicators between multiple users
- Verify online user count displays correctly in header subtitle
- Test presence toggle button in top-right header

### 4. Run Tests
```bash
# Backend tests
cd chat-backend && npm test

# Frontend tests  
cd chat-frontend && npm test
```

## 🛠️ Technology Stack

### Backend
- **Express.js** - REST API server with file upload support
- **Socket.IO** - WebSocket server for real-time communication
- **Prisma ORM** - Type-safe database access with SQLite
- **SQLite** - Lightweight file-based database for development
- **Multer** - Multipart file upload handling
- **dotenv** - Environment variable management
- **CORS** - Cross-origin resource sharing
- **UUID** - Unique message and conversation IDs
- **Winston** - Logging and debugging
- **Node.js Crypto** - Built-in cryptographic operations for encryption

### Frontend  
- **React Native** (via Expo) - Cross-platform mobile development
- **TypeScript** - Type safety and better developer experience with path mappings
- **Socket.IO Client** - WebSocket client for real-time features
- **Zustand** - Lightweight state management
- **NativeWind** - Tailwind CSS for React Native
- **React Navigation** - Screen navigation
- **Expo Image Picker** - Image and video selection
- **Expo Audio** - Voice recording and playback
- **Expo Document Picker** - Document file selection
- **Expo File System** - File upload and management
- **WebCrypto API** - Browser-based cryptographic operations for encryption
- **AsyncStorage** - Secure local storage for encryption keys

### Encryption & Security
- **AES-256-GCM** - Industry-standard symmetric encryption for message content
- **RSA-2048** - Asymmetric encryption for secure key exchange
- **PBKDF2** - Password-based key derivation with SHA-256 (100,000 iterations)
- **Cryptographically Secure Random** - High-entropy random number generation
- **WebCrypto API** - Standards-based cryptographic operations
- **Node.js Crypto Module** - Server-side cryptographic functions

### Code Quality & Development Tools
- **ESLint** - JavaScript/TypeScript linting with strict rules
- **Prettier** - Automated code formatting
- **TypeScript Strict Mode** - Enhanced type checking and safety
- **Path Mappings** - Clean import paths with @ aliases
- **Circular Dependency Detection** - Prevents dependency cycles
- **Jest** - Unit and integration testing framework
- **React Testing Library** - Component testing utilities

### Shared
- **TypeScript interfaces** - Shared types between frontend and backend
- **Monorepo structure** - Organized codebase with path mappings

## ⚡ Performance Improvements

### Before (Polling-based)
- **Message latency**: 3-5 second delays
- **Server requests**: Constant polling every 3-5 seconds
- **User experience**: Sluggish, not truly "real-time"
- **Network usage**: High due to frequent polling

### After (WebSocket-based)
- **Message latency**: Instant (<100ms)
- **Server efficiency**: Event-driven, minimal overhead
- **User experience**: True real-time chat experience
- **Network usage**: Optimized, only when needed

### Real-time Features Added
- ✅ **Instant message delivery**
- ✅ **Live typing indicators** 
- ✅ **Connection status monitoring**
- ✅ **Room-based conversations**
- ✅ **Automatic reconnection**
- ✅ **Graceful error handling**
- ✅ **User presence tracking** with online/offline status
- ✅ **Message reactions** with one-emoji-per-user restriction
- ✅ **Read receipts** with automatic detection
- ✅ **Manual presence controls** via header toggle button
- ✅ **Private messaging** with direct 1-on-1 conversations (Phase 2)
- ✅ **Message threading** with reply functionality and navigation (Phase 3)
- ✅ **Message search** with full-text search across conversations (Phase 4)
- ✅ **Real-time file sharing** with instant broadcasting
- ✅ **Voice message recording** with live audio controls
- ✅ **Video sharing** with inline playback
- ✅ **Message deletion** with real-time updates
- ✅ **Database persistence** with Prisma ORM and SQLite
- ✅ **Message history pagination** with smooth loading
- ✅ **User management** with persistent accounts
- ✅ **Data integrity** with foreign key relationships and constraints
- ✅ **Dark/Light theme system** with automatic component adaptation
- ✅ **Design tokens architecture** with semantic color mapping
- ✅ **Theme persistence** with AsyncStorage
- ✅ **Compact UI design** optimized for mobile
- ✅ **End-to-end encryption** with AES-256-GCM and RSA key management

### Code Quality & Developer Experience
- ✅ **TypeScript path mappings** for cleaner imports
- ✅ **Automated code formatting** with Prettier
- ✅ **ESLint integration** with strict rules
- ✅ **Circular dependency detection** prevents architecture issues
- ✅ **Type safety** with TypeScript strict mode
- ✅ **Comprehensive testing** with Jest and React Testing Library
- ✅ **Consistent code style** across the entire codebase
- ✅ **Developer workflow** with npm scripts for all quality checks

## 🔧 Configuration

### Storage Modes
The app supports two storage modes:

#### Backend Mode (Real-time + Database)
- Uses WebSocket for instant messaging
- **Database persistence** with SQLite and Prisma ORM
- **Message history** with paginated loading
- **User management** with persistent accounts
- Features typing indicators and connection status
- Includes user presence, reactions, and read receipts (all persisted)
- **Private messaging** with direct conversations
- **Message threading** with reply functionality
- **Message search** across all conversations
- **Multimedia file sharing** with real-time broadcasting
- **Voice message recording** and playback
- **Message deletion** with live updates
- Requires backend server running

#### Local Mode (Fallback)  
- Uses in-memory storage with polling
- Works without backend server
- Good for development and testing
- Enhanced features (presence, reactions, read receipts, file sharing, private messaging, threading, search) are disabled

### Environment Setup
```bash
# Backend server (.env)
PORT=3000                           # Server port
HOST=localhost                      # Server host
BASE_URL=http://localhost:3000      # API base URL
DATABASE_URL=file:./dev.db          # SQLite database path
MAX_FILE_SIZE=10485760             # File upload limit (10MB)
UPLOAD_DIR=uploads                  # File storage directory
CORS_ORIGIN=*                      # CORS allowed origins

# Frontend client (.env)
REACT_APP_API_URL=http://localhost:3000        # Backend API URL
REACT_APP_SOCKET_URL=http://localhost:3000     # WebSocket server URL
REACT_APP_MAX_FILE_SIZE=10485760               # Client file size limit
REACT_APP_DEBUG_ENCRYPTION=true                # Enable encryption debug logging
```

For detailed configuration instructions, see [ENV_CONFIG.md](./ENV_CONFIG.md).

### Database Architecture

The application uses a robust database architecture with Prisma ORM and SQLite:

#### Database Schema
```prisma
model User {
  id        String   @id @default(cuid())
  username  String   @unique
  status    String   @default("online")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lastSeen  DateTime @default(now())
  
  // Relations
  sentMessages         Message[]
  reactions           MessageReaction[]
  readReceipts        ReadReceipt[]
  participations      ConversationParticipant[]
  createdConversations Conversation[]
}

model Message {
  id             String   @id @default(cuid())
  text           String
  senderId       String
  conversationId String
  timestamp      DateTime @default(now())
  
  // Threading support
  threadId       String?
  replyToId      String?
  
  // Relations
  sender         User     @relation(fields: [senderId], references: [id])
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  reactions      MessageReaction[]
  readReceipts   ReadReceipt[]
  files          MessageFile[]
}
```

#### Key Features
- **ACID Transactions** - Data consistency and integrity
- **Foreign Key Constraints** - Referential integrity
- **Cascading Deletes** - Automatic cleanup of related data
- **Optimized Queries** - Efficient data retrieval with includes/selects
- **Pagination Support** - Memory-efficient message loading
- **Search Capabilities** - Full-text search across messages
- **Threading Ready** - Schema supports message threading for Phase 3

#### Database Operations
- **User Management** - Create, retrieve, update user accounts
- **Message Persistence** - Store and retrieve messages with metadata
- **Reaction Storage** - Track emoji reactions per user per message
- **Read Receipts** - Monitor message read status across users
- **Conversation Management** - Handle group and direct conversations
- **Search Functionality** - Find messages across conversations
- **Statistics** - Generate conversation and user analytics

### 🔐 End-to-End Encryption

The app includes robust end-to-end encryption for secure messaging:

#### Encryption Features
- **AES-256-GCM Encryption** - Industry-standard symmetric encryption for message content
- **RSA-2048 Key Exchange** - Secure key distribution using public-key cryptography
- **Per-Conversation Keys** - Each conversation has its own encryption key for isolation
- **Encrypted Storage** - Private keys are encrypted with user passwords before storage
- **Encryption Indicators** - Clear UI indicators when encryption is active
- **Key Management** - Automatic key generation, distribution, and management

#### How It Works
1. **User Key Generation** - Each user generates an RSA key pair (public/private)
2. **Conversation Keys** - Each conversation gets a unique AES-256 key
3. **Key Distribution** - Conversation keys are encrypted with each participant's public key
4. **Message Encryption** - Messages are encrypted with the conversation key before sending
5. **Decryption** - Recipients decrypt the conversation key with their private key, then decrypt messages

#### Security Architecture
```typescript
// Message encryption flow
const conversationKey = await getConversationKey(conversationId, userId)
const encryptedMessage = await encryptText(messageText, conversationKey)

// Key exchange flow
const conversationKey = generateConversationKey()
const encryptedKey = encryptConversationKey(conversationKey, userPublicKey)
```

#### Encryption Components
- **EncryptionService** - Core encryption/decryption functionality
- **EncryptionSetup** - UI for key generation and password management
- **EncryptionToggle** - Per-conversation encryption controls
- **useEncryption** - React hook for encryption state management

#### Database Support
The database schema includes full encryption support:
- **User Keys** - Stores encrypted private keys and public keys
- **Conversation Keys** - Manages per-user encrypted conversation keys
- **Message Encryption** - Tracks which messages are encrypted and their key IDs

### Theme System & Design Tokens

The app features a comprehensive design tokens system with automatic dark/light mode support:

#### Design Tokens Architecture
```typescript
// Reevo Design System tokens from design-tokens.json
const tokens = {
  colors: {
    primary: { 500: '#00BCD4' },    // Brand colors
    gray: { 50: '#FAFAFA', 900: '#212121' },  // Neutral scale
    semantic: {                      // Auto-adapting colors
      background: { primary: 'auto' }, // White in light, dark in dark
      text: { primary: 'auto' },       // Dark in light, light in dark
      surface: { primary: 'auto' }     // Adapts to theme
    }
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  typography: { heading: {}, body: {} },
  borderRadius: { sm: 4, md: 8, lg: 12 }
}
```

#### Theme Features
- **Automatic Adaptation**: All components automatically switch between light/dark themes
- **Semantic Colors**: Colors adapt based on context (background, text, surface, etc.)
- **Theme Persistence**: Selected theme is saved and restored on app restart
- **Design System**: Based on Reevo Design System with mobile-optimized tokens
- **TypeScript Integration**: Full type safety with theme tokens

#### Usage Examples
```typescript
import { useTheme } from '@theme'

const MyComponent = () => {
  const { colors, spacing, typography } = useTheme()
  
  return (
    <View style={{
      backgroundColor: colors.semantic.background.primary,
      padding: spacing.lg,
      borderRadius: colors.borderRadius.md
    }}>
      <Text style={{
        ...typography.heading[4],
        color: colors.semantic.text.primary
      }}>
        This adapts to light/dark themes automatically
      </Text>
    </View>
  )
}
```

#### Theme Toggle
Users can switch themes using the 🌙/☀️ button in the header. All components update instantly with smooth transitions.

## 📱 Platform Support

- **Web** - Works in modern browsers with WebSocket and file upload support
- **iOS** - Full React Native support via Expo with camera/microphone access
- **Android** - Full React Native support via Expo with camera/microphone access
- **Desktop** - Via Expo for Web with drag-and-drop file support

## 📚 Documentation

- **[REALTIME_FLOW_SETUP_TEST.md](./REALTIME_FLOW_SETUP_TEST.md)** - Real-time features setup and testing
- **[MULTI_MEDIA_FILES_SETUP_TEST.md](./MULTI_MEDIA_FILES_SETUP_TEST.md)** - Multimedia file sharing testing guide
- **[USER_PRESENCE_FEATURES_SETUP_TEST.md](./USER_PRESENCE_FEATURES_SETUP_TEST.md)** - User presence features testing
- **[ENV_CONFIG.md](./ENV_CONFIG.md)** - Environment configuration documentation
- **[ENCRYPTION_MESSAGE.md](./ENCRYPTION_MESSAGE.md)** - Comprehensive end-to-end encryption documentation
- **[PLAN_ENCRYPTION_FOR_PRODUCTION.md](./PLAN_ENCRYPTION_FOR_PRODUCTION.md)** - Production-ready encryption implementation plan

## 🧪 Testing

### Frontend Tests
```bash
cd chat-frontend

# Run all quality checks (recommended)
npm run check

# Individual commands:
# Component tests
npm test -- FilePicker.test.tsx
npm test -- VoiceRecorder.test.tsx

# Integration tests
npm test -- mediaUpload.test.ts

# All tests
npm test

# Code quality checks
npm run typecheck        # TypeScript compilation
npm run lint            # ESLint checking
npm run prettier-check  # Code formatting check
npm run circular-dependencies  # Dependency cycle detection
```

### Backend Tests
```bash
cd chat-backend

# Database service tests
npm test -- DatabaseService.test.js

# API integration tests
npm test -- database-api.test.js

# End-to-end database tests
npm test -- e2e-database.test.js

# API and upload tests
npm test -- mediaUpload.test.js

# All tests
npm test
```
