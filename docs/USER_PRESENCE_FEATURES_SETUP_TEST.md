# User Presence Features Setup and Testing Guide

This comprehensive guide covers the setup and testing process for all enhanced real-time features including user presence, message reactions, read receipts, and typing indicators.

## 🎯 Overview of Enhanced Features

The chat application now includes these advanced real-time features:

1. **User Presence** - Online/offline status tracking with manual toggle
2. **Message Reactions** - Emoji reactions with one-per-user restriction
3. **Read Receipts** - Automatic message read tracking and display
4. **Typing Indicators** - Real-time typing status with timeout
5. **Enhanced WebSocket** - Optimized real-time communication

## 🚀 Prerequisites

Before testing these features, ensure you have:

### System Requirements
- **Node.js** (v16+ recommended)
- **npm** or **yarn** package manager
- **Multiple browser tabs/windows** for multi-user testing
- **Modern browser** with WebSocket support

### Dependencies Already Installed
```bash
# Backend dependencies
cd chat-backend
npm install
# Includes: socket.io, express, cors, uuid, winston

# Frontend dependencies  
cd chat-frontend
npm install
# Includes: socket.io-client, react, react-native, zustand
```

## 📦 Project Setup

### 1. Backend Server Setup

#### Start the Backend Server
```bash
cd chat-backend
npm start
```

**Expected Output:**
```
Chat backend server with WebSocket running on port 3000
WebSocket server initialized with CORS enabled
```

#### Verify Backend is Running
```bash
curl http://localhost:3000/api/conversations
# Should return JSON with conversation list
```

### 2. Frontend Application Setup

#### Start the Frontend Application
```bash
cd chat-frontend
npm start
# Or for web testing:
npm run web
```

**Expected Output:**
```
› Press w │ open web
› Press r │ reload app
› Press m │ toggle menu
```

### 3. Environment Configuration

#### Backend Configuration
The backend automatically configures:
- **Port**: 3000 (default)
- **CORS**: Enabled for all origins
- **WebSocket**: Socket.IO server with room support
- **Logging**: Winston logger for debugging

#### Frontend Configuration
The frontend connects to:
- **Socket Server**: `http://localhost:3000`
- **Storage Mode**: Backend mode (for enhanced features)
- **Auto-reconnect**: Enabled with retry logic

## 🧪 Testing Enhanced Features

### Phase 1: Basic Setup Test

#### 1. Connection Test
1. **Start backend server**: `cd chat-backend && npm start`
2. **Open frontend**: Navigate to the chat app
3. **Check connection status**: Look for 🟢 Connected in header
4. **Verify WebSocket**: Check browser console for "Socket connected"

#### 2. Multi-User Setup
1. **Open multiple browser tabs** (3-4 recommended)
2. **Set different usernames** for each tab:
   - Tab 1: "Alice"
   - Tab 2: "Bob" 
   - Tab 3: "Charlie"
3. **Join same conversation** ("General" conversation)
4. **Verify all tabs show connected status**

### Phase 2: User Presence Testing

#### 1. Online Status Display
**Test Steps:**
1. Open multiple tabs with different users
2. Check header subtitle shows: "Alice and Bob are online"
3. Verify count updates when users join/leave

**Expected Behavior:**
- Header shows online user count and names
- Real-time updates when users connect/disconnect
- Automatic online status when users join

#### 2. Presence Toggle Testing
**Test Steps:**
1. In any tab, locate presence toggle button (top-right header)
2. Click to toggle between 🟢 Online and 🔴 Offline
3. Verify other tabs immediately reflect the status change
4. Test with multiple users toggling simultaneously

**Expected Behavior:**
- Instant status updates across all connected clients
- Header subtitle updates to reflect online/offline changes
- Visual feedback on the toggle button

#### 3. Automatic Presence Management
**Test Steps:**
1. Close a browser tab (user disconnects)
2. Verify other tabs show updated online user list
3. Refresh a tab (user reconnects)
4. Verify user automatically appears as online

### Phase 3: Message Reactions Testing

#### 1. Basic Reaction Functionality
**Test Steps:**
1. Send a message from one tab
2. In another tab, click on reaction emojis below the message
3. Verify reaction appears in top row with count
4. Test all available emojis: 👍 ❤️ 😂 😮 😢 😡

**Expected Behavior:**
- Reaction appears instantly across all tabs
- Count updates correctly (e.g., "👍 1", "❤️ 2")
- Visual feedback on selected emoji (blue highlight)

#### 2. One-Emoji-Per-User Restriction
**Test Steps:**
1. React to a message with 👍 from one user
2. Click ❤️ from the same user
3. Verify 👍 is removed and ❤️ is added
4. Click ❤️ again to toggle off
5. Verify reaction is completely removed

**Expected Behavior:**
- Only one emoji per user per message
- Clicking different emoji replaces existing one
- Clicking same emoji toggles it off
- Real-time updates across all clients

#### 3. Multi-User Reaction Testing
**Test Steps:**
1. Have 3 users react to same message with different emojis
2. Verify each user can only have one reaction
3. Test reaction tooltips show correct user names
4. Verify reaction counts are accurate

**Expected Behavior:**
- Each user maintains only one reaction
- Reaction bubbles show correct counts
- Tooltips display user names correctly

### Phase 4: Read Receipts Testing

#### 1. Basic Read Receipt Functionality
**Test Steps:**
1. Send message from "Alice" tab
2. View the message in "Bob" tab (wait 1 second)
3. Check "Alice" tab for read receipt below the message
4. Verify shows "Read by Bob"

**Expected Behavior:**
- Read receipts appear automatically after 1 second
- Only visible on sender's messages
- Shows reader's name correctly

#### 2. Multiple Reader Testing
**Test Steps:**
1. Send message from one user
2. Have 2-3 other users read the message
3. Verify read receipt updates to show all readers
4. Test display formats:
   - "Read by Alice"
   - "Read by Alice and Bob"
   - "Read by Alice and 2 others"

**Expected Behavior:**
- Read receipts update in real-time
- Correct formatting for different reader counts
- Excludes sender from read receipt list

#### 3. Read Receipt Edge Cases
**Test Steps:**
1. Send message and immediately switch tabs
2. Verify read receipt still registers
3. Test with users joining/leaving during reading
4. Verify read receipts persist across page refreshes

### Phase 5: Typing Indicators Testing

#### 1. Basic Typing Indicator
**Test Steps:**
1. Start typing in message input from one tab
2. Verify other tabs show "Alice is typing..."
3. Stop typing and verify indicator disappears after 1 second
4. Send message and verify indicator disappears immediately

**Expected Behavior:**
- Typing indicator appears instantly
- Shows correct username
- Disappears after 1 second timeout
- Clears immediately on message send

#### 2. Multiple Users Typing
**Test Steps:**
1. Have 2 users start typing simultaneously
2. Verify displays "Alice and Bob are typing..."
3. Have third user start typing
4. Verify updates to show appropriate format

**Expected Behavior:**
- Handles multiple concurrent typers
- Proper formatting for different counts
- Real-time updates as users start/stop typing

### Phase 6: Integration Testing

#### 1. All Features Working Together
**Test Steps:**
1. Have multiple users online
2. Send messages with reactions
3. Verify read receipts while typing
4. Toggle presence while reacting
5. Test all features work simultaneously

**Expected Behavior:**
- No conflicts between features
- All real-time updates work correctly
- Performance remains smooth

#### 2. Connection Resilience Testing
**Test Steps:**
1. Disconnect internet on one tab
2. Verify shows 🔴 Disconnected status
3. Reconnect internet
4. Verify automatic reconnection and feature restoration

**Expected Behavior:**
- Graceful handling of disconnections
- Automatic reconnection when available
- Feature restoration after reconnection

## 🔍 Debugging and Troubleshooting

### Common Issues and Solutions

#### 1. Features Not Working
**Problem**: Enhanced features not appearing
**Diagnostic Steps:**
1. Check storage mode is set to "Backend"
2. Verify WebSocket connection (🟢 Connected)
3. Check browser console for errors
4. Ensure backend server is running

**Solutions:**
- Switch to backend mode in app settings
- Restart backend server: `cd chat-backend && npm start`
- Check firewall/antivirus blocking port 3000
- Clear browser cache and reload

#### 2. Reactions Not Updating
**Problem**: Emoji reactions not appearing or updating
**Diagnostic Steps:**
1. Check WebSocket connection status
2. Verify backend logs for reaction events
3. Check browser console for WebSocket events
4. Test with fresh browser tab

**Solutions:**
- Refresh the page to reset WebSocket connection
- Check backend server logs for errors
- Verify backend is running on port 3000
- Test with different browser/incognito mode

#### 3. Read Receipts Not Showing
**Problem**: Read receipts not appearing under messages
**Diagnostic Steps:**
1. Verify viewing your own sent messages
2. Check if other users have actually read messages
3. Wait for 1-second auto-read timeout
4. Verify backend mode is enabled

**Solutions:**
- Send message from one tab, read from another
- Ensure other users are actually viewing messages
- Check that backend server is processing read events
- Verify WebSocket connection is stable

#### 4. Typing Indicators Not Working
**Problem**: Typing indicators not appearing
**Diagnostic Steps:**
1. Check WebSocket connection status
2. Verify typing in message input triggers events
3. Check backend logs for typing events
4. Test with multiple users

**Solutions:**
- Ensure message input has focus when typing
- Check that typing events are being sent to backend
- Verify backend is broadcasting typing events
- Test with fresh browser sessions

### Debug Tools and Commands

#### Backend Debugging
```bash
# Check server logs
cd chat-backend
npm start
# Look for WebSocket connection messages

# Test API endpoints
curl http://localhost:3000/api/conversations
curl http://localhost:3000/health

# Check server logs in real-time
tail -f server.log
```

#### Frontend Debugging
```bash
# Check for TypeScript errors
cd chat-frontend
npx tsc --noEmit

# Run tests
npm test

# Start with verbose logging
npm start -- --verbose
```

#### Browser Console Debugging
```javascript
// Check WebSocket connection
console.log('Socket connected:', socketService.isConnected());

// Check message reactions
console.log('Message reactions:', messageReactions);

// Check user presence
console.log('Online users:', onlineUsers);

// Check read receipts
console.log('Read receipts:', readReceipts);
```

## 📊 Performance Testing

### Load Testing Setup
```bash
# Test with multiple concurrent users
# Open 10+ browser tabs with different usernames
# Send messages simultaneously
# Monitor server performance
```

### Performance Metrics to Monitor
- **Message Latency**: Should be <100ms
- **Reaction Updates**: Should be instant
- **Typing Indicators**: Should appear immediately
- **Read Receipts**: Should update within 1 second
- **Presence Updates**: Should be instant

### Expected Performance
- **Real-time Updates**: <50ms latency
- **WebSocket Connections**: Stable with auto-reconnect
- **Memory Usage**: Efficient with cleanup on disconnect
- **CPU Usage**: Low overhead for real-time features

## 🎯 Test Success Criteria

### ✅ Feature Completion Checklist

#### User Presence
- [ ] Online/offline status display in header
- [ ] Manual presence toggle button works
- [ ] Real-time updates across all clients
- [ ] Automatic online status on connection
- [ ] Proper cleanup on disconnection

#### Message Reactions
- [ ] One emoji per user per message restriction
- [ ] Toggle behavior (click same emoji to remove)
- [ ] Replacement behavior (click different emoji)
- [ ] Real-time updates across all clients
- [ ] Visual feedback for selected emojis

#### Read Receipts
- [ ] Automatic read detection after 1 second
- [ ] Display only on sender's messages
- [ ] Real-time updates as users read
- [ ] Proper formatting for multiple readers
- [ ] Excludes sender from read list

#### Typing Indicators
- [ ] Real-time typing status display
- [ ] Automatic timeout after 1 second
- [ ] Multiple users typing support
- [ ] Proper cleanup on message send
- [ ] Correct username display

#### System Integration
- [ ] All features work simultaneously
- [ ] No conflicts between features
- [ ] Stable WebSocket connections
- [ ] Graceful error handling
- [ ] Automatic reconnection

## 🚀 Advanced Testing Scenarios

### Stress Testing
1. **High Message Volume**: Send 50+ messages rapidly
2. **Multiple Reactions**: Have 10+ users react to same message
3. **Concurrent Typing**: Have 5+ users type simultaneously
4. **Rapid Presence Changes**: Toggle online/offline rapidly
5. **Connection Interruptions**: Simulate network issues

### Edge Cases
1. **Long Messages**: Test with very long message content
2. **Special Characters**: Test with emojis, unicode, HTML
3. **Rapid Interactions**: Click reactions/buttons very quickly
4. **Memory Leaks**: Test with prolonged usage sessions
5. **Browser Compatibility**: Test across different browsers

### Production Readiness
1. **Error Handling**: All error states handled gracefully
2. **Performance**: Maintains <100ms response times
3. **Scalability**: Works with 20+ concurrent users
4. **Reliability**: Stable connections with auto-recovery
5. **Security**: Proper input validation and sanitization

## 📋 Test Report Template

```markdown
## Test Execution Report

### Test Environment
- **Date**: [Test Date]
- **Browser**: [Browser/Version]
- **OS**: [Operating System]
- **Backend Version**: [Version]
- **Frontend Version**: [Version]

### Test Results
- **User Presence**: ✅ PASS / ❌ FAIL
- **Message Reactions**: ✅ PASS / ❌ FAIL  
- **Read Receipts**: ✅ PASS / ❌ FAIL
- **Typing Indicators**: ✅ PASS / ❌ FAIL
- **Performance**: ✅ PASS / ❌ FAIL

### Issues Found
1. [Issue Description]
2. [Issue Description]

### Recommendations
1. [Recommendation]
2. [Recommendation]
```

## 🔄 Continuous Testing

### Automated Testing
```bash
# Run all tests
cd chat-backend && npm test
cd chat-frontend && npm test

# Run end-to-end tests
cd chat-frontend && npm run test:e2e
```

### Manual Testing Schedule
- **Daily**: Basic functionality testing
- **Weekly**: Full feature integration testing
- **Monthly**: Performance and load testing
- **Release**: Complete regression testing

---

## 📞 Support and Maintenance

### Getting Help
1. Check troubleshooting section above
2. Review browser console for errors
3. Check backend server logs
4. Verify all prerequisites are met

### Reporting Issues
When reporting issues, include:
- Browser and OS information
- Steps to reproduce
- Expected vs actual behavior
- Console errors and server logs
- Screenshots if applicable

### Future Enhancements
- Message persistence with database
- Push notifications
- File sharing capabilities
- Voice/video calling
- Advanced user management
- Message search and filtering