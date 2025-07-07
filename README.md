# React Native Case
Write a basic chat app using the latest version of Expo.

- 🧠 React Native frontend (Expo + NativeWind)
- 🛰️ Express.js backend with simulated delay
- 🔁 Shared TypeScript types via chat-types package
- 🧰 Zustand swapper with unified useChat() hook
- ⚡ Fast local development without a database or Firebase

## 🗂️ Monorepo Structure
/chat-app
│
├── /chat-types ✅ Shared TS types (Message, Conversation)
│ └── index.ts
│
├── /chat-frontend ✅ Expo + NativeWind + unified useChat
│ ├── /src
│ │ ├── /api ✅ REST client (uses chat-types)
│ │ ├── /hooks ✅ useChat abstraction layer
│ │ ├── /store ✅ Zustand
│ │ ├── /screens ✅ ChatRoom, ChatList, etc.
│ │ └── App.tsx
│ ├── package.json
│ └── tsconfig.json
│
├── /chat-backend ✅ Express API server with fake DB + delay
│ ├── index.js ✅ Main server logic
│ └── package.json
│
├── .gitignore
└── README.md
---
## 🚀 Quick Start
### 1. Clone and install
```bash
# backend
cd chat-backend && yarn install && yarn start
# frontend
cd chat-frontend && yarn install && npx expo start --localhost

# Testing
cd chat-backend && yarn test
cd chat-frontend && yarn test