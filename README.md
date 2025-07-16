

# Real-time Chat App
A full-featured real-time chat application with multimedia file sharing, built with React Native (Expo) and WebSocket technology.

https://github.com/user-attachments/assets/7b6296ed-787a-4359-a45c-78fd69927a44

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
- 🔁 **Shared TypeScript types** via chat-types package
- 🧰 **Zustand state management** with unified useChat() hook
- ⚡ **Fast local development** without external databases
- 🔄 **Dual mode support**: Real-time (WebSocket) + Local (in-memory)
- 🎣 **Advanced React hooks**: useUserPresence, useMessageReactions, useReadReceipts, useRealtimeMessages
- 🌍 **Environment configuration** - Centralized .env configuration for all services
- 📁 **File upload system** - Multer-based backend with real-time broadcasting
- 🛣️ **Path mappings** - Clean import paths with TypeScript path resolution
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
- **Dark/Light theme**: Seamless theme switching with automatic component adaptation
- **Design tokens**: Consistent styling system with semantic color mapping
- **Compact design**: Optimized message sizes for mobile-first experience
- **Responsive design**: Works on web, iOS, and Android
- **Offline fallback**: Graceful degradation when disconnected

## 🗂️ Monorepo Structure
<pre>
/chat-app-demo
│
├── /chat-types ✅ Shared TS types (Message, Conversation)
│ └── index.ts
│
├── /chat-frontend ✅ Expo + NativeWind + Real-time hooks + Multimedia
│ ├── .env ✅ Environment configuration
│ ├── .prettierrc ✅ Code formatting configuration
│ ├── eslint.config.js ✅ ESLint configuration
│ ├── /src
│ │ ├── /api ✅ REST client (uses chat-types via @chat-types)
│ │ ├── /hooks ✅ useChat + useRealtimeMessages + useTypingIndicator + useUserPresence + useMessageReactions + useReadReceipts
│ │ ├── /services ✅ WebSocket client (socketService) + fileUploadService
│ │ ├── /context ✅ SocketContext for connection management
│ │ ├── /store ✅ Zustand state management
│ │ ├── /config ✅ Environment variable management
│ │ ├── /components ✅ MessageInput + MessageItem + FilePicker + VoiceRecorder + FileMessage + VideoPlayer + ThemeToggle
│ │ ├── /screens ✅ ChatRoom with real-time features + presence controls + file sharing + dark/light themes
│ │ ├── /theme ✅ Design tokens system + ThemeContext + dark/light mode + semantic colors
│ │ ├── /types ✅ Local type definitions with path mapping support
│ │ ├── /__tests__ ✅ Component and integration tests
│ │ └── App.tsx
│ ├── package.json (+ expo-image-picker, expo-audio, expo-file-system)
│ ├── tsconfig.json ✅ TypeScript configuration with path mappings
│ └── jest.config.js ✅ Jest configuration with module name mapping
│
├── /chat-backend ✅ Express + Socket.IO WebSocket server + File Upload
│ ├── .env ✅ Environment configuration
│ ├── index.js ✅ REST API + WebSocket handlers + file upload endpoints + real-time events
│ ├── /uploads ✅ File storage directory
│ ├── /__tests__ ✅ Backend API and upload tests
│ └── package.json (+ socket.io, multer, dotenv)
│
├── REALTIME_IMPROVEMENTS.md ✅ Implementation suggestions
├── REALTIME_FLOW_SETUP_TEST.md ✅ Setup and testing guide
├── USER_PRESENCE_FEATURES.md ✅ User guide for enhanced features
├── USER_PRESENCE_FEATURES_SETUP_TEST.md ✅ Setup and testing guide for enhanced features
├── MULTI_MEDIA_FILES_SETUP_TEST.md ✅ Multimedia file sharing testing guide
├── ENV_CONFIG.md ✅ Environment configuration documentation
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
# Backend (Express + Socket.IO server + File Upload)
cd chat-backend
npm install
npm start
# ✅ Server running on http://localhost:3000 with file upload support

# Frontend (React Native + Expo + Multimedia)
cd chat-frontend  
npm install
npx expo start --localhost
# ✅ Expo dev server running with multimedia capabilities
```

### 2. Test Real-time Features
1. **Open multiple browser tabs** or devices
2. **Set different usernames** for each session
3. **Join the same conversation**
4. **Send messages** → should appear instantly on all devices
5. **Start typing** → others will see typing indicators
6. **React to messages** → click emoji buttons to add reactions
7. **Toggle presence** → click online/offline button in header
8. **Check read receipts** → see who has read your messages
9. **Share files** → click 📎 to upload images, videos, documents
10. **Record voice** → click 🎤 to record and send voice messages
11. **Toggle themes** → click 🌙/☀️ in header to switch between dark/light mode
12. **Delete messages** → long press or click delete button for real-time removal

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
- **Multer** - Multipart file upload handling
- **dotenv** - Environment variable management
- **CORS** - Cross-origin resource sharing
- **UUID** - Unique message and conversation IDs
- **Winston** - Logging and debugging

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
- ✅ **Real-time file sharing** with instant broadcasting
- ✅ **Voice message recording** with live audio controls
- ✅ **Video sharing** with inline playback
- ✅ **Message deletion** with real-time updates
- ✅ **Dark/Light theme system** with automatic component adaptation
- ✅ **Design tokens architecture** with semantic color mapping
- ✅ **Theme persistence** with AsyncStorage
- ✅ **Compact UI design** optimized for mobile

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

#### Backend Mode (Real-time)
- Uses WebSocket for instant messaging
- Features typing indicators and connection status
- Includes user presence, reactions, and read receipts
- **Multimedia file sharing** with real-time broadcasting
- **Voice message recording** and playback
- **Message deletion** with live updates
- Requires backend server running

#### Local Mode (Fallback)  
- Uses in-memory storage with polling
- Works without backend server
- Good for development and testing
- Enhanced features (presence, reactions, read receipts, file sharing) are disabled

### Environment Setup
```bash
# Backend server (.env)
PORT=3000                           # Server port
HOST=localhost                      # Server host
BASE_URL=http://localhost:3000      # API base URL
MAX_FILE_SIZE=10485760             # File upload limit (10MB)
UPLOAD_DIR=uploads                  # File storage directory
CORS_ORIGIN=*                      # CORS allowed origins

# Frontend client (.env)
REACT_APP_API_URL=http://localhost:3000        # Backend API URL
REACT_APP_SOCKET_URL=http://localhost:3000     # WebSocket server URL
REACT_APP_MAX_FILE_SIZE=10485760               # Client file size limit
```

For detailed configuration instructions, see [ENV_CONFIG.md](./ENV_CONFIG.md).

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

## 🔮 Future Enhancements

- **Push notifications** - Background message alerts
- **Private messaging** - Direct messages between users
- **Message persistence** - Database storage for chat history
- **Message threading** - Reply to specific messages
- **Advanced reactions** - Custom emoji reactions
- **User roles** - Admin/moderator permissions
- **Message search** - Find messages across conversations
- **File thumbnails** - Generate previews for images/videos
- **Cloud storage** - Integration with AWS S3 or similar services
- **Audio transcription** - Convert voice messages to text
- **Video compression** - Optimize video files for web delivery
- **Offline media caching** - Cache media for offline viewing
- **Message encryption** - End-to-end message security

## 📚 Documentation

- **[REALTIME_FLOW_SETUP_TEST.md](./REALTIME_FLOW_SETUP_TEST.md)** - Real-time features setup and testing
- **[MULTI_MEDIA_FILES_SETUP_TEST.md](./MULTI_MEDIA_FILES_SETUP_TEST.md)** - Multimedia file sharing testing guide
- **[USER_PRESENCE_FEATURES_SETUP_TEST.md](./USER_PRESENCE_FEATURES_SETUP_TEST.md)** - User presence features testing
- **[ENV_CONFIG.md](./ENV_CONFIG.md)** - Environment configuration documentation

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

# API and upload tests
npm test -- mediaUpload.test.js

# All tests
npm test
```
