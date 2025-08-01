# User Presence Features Guide

This document provides step-by-step instructions for using all the enhanced real-time features in the chat application.

## Prerequisites

Before using these features, ensure you have:
1. **Backend Mode**: Features only work when storage mode is set to 'backend'
2. **WebSocket Connection**: A stable connection to the backend server
3. **Multiple Users**: Some features are best demonstrated with multiple users online

## Feature Overview

The chat application includes four main enhanced features:
1. **User Presence** - Online/offline status tracking
2. **Message Reactions** - Emoji reactions to messages (one per user)
3. **Read Receipts** - Track when messages are read
4. **Typing Indicators** - See when others are typing

---

## 1. User Presence Features

### How to Check Online Status

**Location**: Chat room header
- **Connected Status**: Look for 🟢 Connected or 🔴 Disconnected in the subtitle
- **Online Users**: Header shows "John and Mary are online" or "No one else is online"

### How to Toggle Your Presence Status

**Location**: Top-right corner of chat room header
1. Look for the presence toggle button showing either:
   - 🟢 Online (you're currently online)
   - 🔴 Offline (you're currently offline)
2. **Click the button** to toggle your status
3. Other users will see your status change immediately

### User Presence Indicators

**What You'll See**:
- **Header subtitle**: Shows count and names of online users
- **Real-time updates**: When users join/leave, the display updates instantly
- **Automatic status**: Users are automatically set online when they connect

---

## 2. Message Reactions

### How to React to Messages

**Method 1: Quick Reaction Buttons**
1. **Location**: Below each message in the bottom row
2. **Available emojis**: 👍 ❤️ 😂 😮 😢 😡
3. **Click any emoji** to add your reaction
4. **Selected emoji** will be highlighted with blue background

**Method 2: Existing Reaction Bubbles**
1. **Location**: Above quick reaction buttons (top row)
2. **Shows**: Emoji with count (e.g., "👍 2")
3. **Click existing reaction** to add/remove your reaction

### Reaction Rules (One Emoji Per User)

**Important**: Each user can only have ONE emoji reaction per message

**Behavior**:
- **First click**: Adds your reaction
- **Click same emoji**: Removes your reaction (toggle off)
- **Click different emoji**: Replaces your existing reaction
- **Visual feedback**: Your selected emoji is highlighted in blue

### Example Reaction Flow

```
1. User clicks ❤️  → "❤️ 1" appears, heart button highlighted
2. User clicks 👍  → Heart removed, "👍 1" appears, thumbs up highlighted  
3. User clicks 👍  → Thumbs up removed, no reaction shown
```

---

## 3. Read Receipts

### How Read Receipts Work

**Automatic**: Messages are automatically marked as read after 1 second of viewing
**Manual**: You can also manually mark messages as read (handled by the system)

### Where to See Read Receipts

**Location**: Below your own messages (right-aligned italic text)

**Display Examples**:
- `Read by John` (single user)
- `Read by John and Mary` (two users)
- `Read by John and 2 others` (multiple users)

### Read Receipt Rules

- **Only visible**: On messages you sent
- **Excludes you**: Your own read status is not shown
- **Real-time**: Updates immediately when others read your messages
- **Automatic**: No manual action required from readers

---

## 4. Typing Indicators

### How to See Typing Status

**Location**: Above the message input box
**Display**: "John is typing..." or "John and Mary are typing..."

### How Typing Detection Works

**Automatic**: The system detects when you start/stop typing
- **Starts**: When you begin typing in the message input
- **Stops**: When you stop typing for a few seconds or send the message

---

## 5. Testing the Features

### Single User Testing

1. **Open chat room** with backend mode enabled
2. **Check connection status** in header (should show 🟢 Connected)
3. **Toggle presence** using the button in header
4. **Send a message** to yourself (won't show read receipts)
5. **React to existing messages** using emoji buttons

### Multi-User Testing

1. **Open multiple browser tabs/windows** with different usernames
2. **Join same conversation** on all instances
3. **Test presence**: Toggle online/offline on one tab, watch others update
4. **Test reactions**: React to messages, see real-time updates across tabs
5. **Test read receipts**: Send message from one tab, read from others
6. **Test typing**: Start typing in one tab, see indicator in others

---

## 6. Troubleshooting

### Features Not Working?

**Check Connection Status**:
- Header should show 🟢 Connected
- If 🔴 Disconnected, refresh the page or restart backend

**Check Storage Mode**:
- Features only work in backend mode
- Switch from local to backend mode if needed

**Check Backend Server**:
- Ensure backend server is running on port 3000
- Check server logs for WebSocket connections

### Common Issues

**Problem**: Reactions not updating
**Solution**: Refresh the page, check WebSocket connection

**Problem**: Read receipts not showing
**Solution**: Ensure you're viewing your own messages, others have read them

**Problem**: Presence toggle not working
**Solution**: Check connection status, ensure backend is running

**Problem**: Multiple reaction emojis showing
**Solution**: Each user should only have one emoji - this was recently fixed

---

## 7. Technical Architecture

### Backend Components
- **WebSocket Server**: Handles real-time communication
- **Reaction Handler**: Enforces one-emoji-per-user rule
- **Presence Tracker**: Manages online/offline status
- **Read Receipt Manager**: Tracks message read status

### Frontend Components
- **useUserPresence**: Manages presence state and UI controls
- **useMessageReactions**: Handles reaction logic and state
- **useReadReceipts**: Tracks read status and displays receipts
- **useRealtimeMessages**: Coordinates real-time message updates

### Data Flow
1. **User Action** → Frontend Hook → WebSocket Event → Backend Handler
2. **Backend Processing** → Database Update → Broadcast to Room
3. **Real-time Update** → All Connected Clients → UI Update

---

## 8. Feature Limitations

- **Backend Mode Only**: Features disabled in local storage mode
- **WebSocket Required**: No fallback for non-WebSocket connections
- **One Emoji Rule**: Users limited to one reaction emoji per message
- **Auto Read Receipts**: 1-second delay before marking as read
- **Room-based**: Features work within conversation rooms only

---

## 9. Development Notes

For developers working on these features:

### Key Files
- `chat-backend/index.js` - WebSocket event handlers
- `chat-frontend/src/hooks/useUserPresence.ts` - Presence management
- `chat-frontend/src/hooks/useMessageReactions.ts` - Reaction logic
- `chat-frontend/src/hooks/useReadReceipts.ts` - Read receipt handling
- `chat-frontend/src/components/MessageItem.tsx` - Message UI component

### Testing
- Comprehensive test suites in `__tests__` directories
- Integration tests for WebSocket events
- Component tests for UI interactions
- End-to-end scenarios for complete user flows

---

## Support

If you encounter issues with these features:
1. Check the troubleshooting section above
2. Verify your setup meets the prerequisites
3. Review server logs for WebSocket connection issues
4. Test with multiple users to verify real-time functionality

All features are designed to work seamlessly together and provide a rich, real-time chat experience!