

# Real-time Chat App
A full-featured real-time chat application built with React Native (Expo) and WebSocket technology.

https://github.com/user-attachments/assets/7b6296ed-787a-4359-a45c-78fd69927a44

## ✨ Features

### 🚀 Real-time Messaging
- **Instant message delivery** using WebSocket (Socket.IO)
- **Typing indicators** with automatic timeout
- **Connection status** indicators
- **Room-based conversations** for efficient messaging

### 🏗️ Architecture
- 🧠 **React Native frontend** (Expo + NativeWind + TypeScript)
- 🛰️ **Express.js backend** with WebSocket server
- 🔁 **Shared TypeScript types** via chat-types package
- 🧰 **Zustand state management** with unified useChat() hook
- ⚡ **Fast local development** without external databases
- 🔄 **Dual mode support**: Real-time (WebSocket) + Local (in-memory)

### 📱 User Experience
- **Instant messaging**: No more 3-5 second delays
- **Live typing indicators**: See when others are typing
- **Connection monitoring**: Visual connection status
- **Responsive design**: Works on web, iOS, and Android
- **Offline fallback**: Graceful degradation when disconnected

## 🗂️ Monorepo Structure
<pre>
/chat-app-demo
│
├── /chat-types ✅ Shared TS types (Message, Conversation)
│ └── index.ts
│
├── /chat-frontend ✅ Expo + NativeWind + Real-time hooks
│ ├── /src
│ │ ├── /api ✅ REST client (uses chat-types)
│ │ ├── /hooks ✅ useChat + useRealtimeMessages + useTypingIndicator
│ │ ├── /services ✅ WebSocket client (socketService)
│ │ ├── /context ✅ SocketContext for connection management
│ │ ├── /store ✅ Zustand state management
│ │ ├── /components ✅ MessageInput with typing indicators
│ │ ├── /screens ✅ ChatRoom with real-time features
│ │ └── App.tsx
│ ├── package.json (+ socket.io-client)
│ └── tsconfig.json
│
├── /chat-backend ✅ Express + Socket.IO WebSocket server
│ ├── index.js ✅ REST API + WebSocket handlers
│ └── package.json (+ socket.io)
│
├── REALTIME_IMPROVEMENTS.md ✅ Implementation suggestions
├── REALTIME_FLOW_SETUP_TEST.md ✅ Setup and testing guide
├── .gitignore
└── README.md
</pre>
## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Backend (Express + Socket.IO server)
cd chat-backend
npm install
npm start
# ✅ Server running on http://localhost:3000

# Frontend (React Native + Expo)
cd chat-frontend  
npm install
npx expo start --localhost
# ✅ Expo dev server running
```

### 2. Test Real-time Features
1. **Open multiple browser tabs** or devices
2. **Set different usernames** for each session
3. **Join the same conversation**
4. **Send messages** → should appear instantly on all devices
5. **Start typing** → others will see typing indicators

### 3. Verify WebSocket Connection
- Look for **🟢 Connected** in the chat header (backend mode)
- Check browser console for "Socket connected" messages
- Test typing indicators between multiple users

### 4. Run Tests
```bash
# Backend tests
cd chat-backend && npm test

# Frontend tests  
cd chat-frontend && npm test
```

## 🛠️ Technology Stack

### Backend
- **Express.js** - REST API server
- **Socket.IO** - WebSocket server for real-time communication
- **CORS** - Cross-origin resource sharing
- **UUID** - Unique message and conversation IDs
- **Winston** - Logging and debugging

### Frontend  
- **React Native** (via Expo) - Cross-platform mobile development
- **TypeScript** - Type safety and better developer experience
- **Socket.IO Client** - WebSocket client for real-time features
- **Zustand** - Lightweight state management
- **NativeWind** - Tailwind CSS for React Native
- **React Navigation** - Screen navigation

### Shared
- **TypeScript interfaces** - Shared types between frontend and backend
- **Jest** - Testing framework
- **ESLint/Prettier** - Code formatting and linting

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

## 🔧 Configuration

### Storage Modes
The app supports two storage modes:

#### Backend Mode (Real-time)
- Uses WebSocket for instant messaging
- Features typing indicators and connection status
- Requires backend server running

#### Local Mode (Fallback)  
- Uses in-memory storage with polling
- Works without backend server
- Good for development and testing

### Environment Setup
```bash
# Backend server
PORT=3000                    # Server port
CORS_ORIGIN=*               # CORS allowed origins

# Frontend client  
SOCKET_SERVER_URL=http://localhost:3000  # WebSocket server URL
```

## 📱 Platform Support

- **Web** - Works in modern browsers with WebSocket support
- **iOS** - Full React Native support via Expo
- **Android** - Full React Native support via Expo
- **Desktop** - Via Expo for Web

## 🔮 Future Enhancements

- **Message read receipts** - Track when messages are read
- **User presence** - Online/offline status indicators  
- **File sharing** - Upload and share images/files
- **Voice messages** - Record and send audio
- **Push notifications** - Background message alerts
- **Message reactions** - Emoji reactions to messages
- **Private messaging** - Direct messages between users
- **Message persistence** - Database storage for chat history
