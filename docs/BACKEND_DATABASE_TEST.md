# Backend and Database Testing Guide

This document outlines the comprehensive testing procedures for the chat application's backend and database functionality.

## Test Environment Setup

### Prerequisites
- Node.js installed
- SQLite database configured
- Backend server running on port 3000

### Starting the Backend Server
```bash
cd chat-backend
node index.js
```

## Unit Testing

### Running All Unit Tests
```bash
npm test
```

### Running Specific Test Suites
```bash
# Enhanced messaging features tests
npm test -- __tests__/enhanced-features-unit.test.js

# Database service tests
npm test -- __tests__/DatabaseService.test.js

# Integration tests
npm test -- __tests__/database-integration.test.js
```

## Manual API Testing

### Phase 1: User Management

#### Create Users
```bash
# Create user Alice
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"alice"}'

# Create user Bob
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"username":"bob"}'
```

#### Get All Users
```bash
curl -X GET "http://localhost:3000/api/users?currentUserId=USER_ID"
```

### Phase 2: Private Messaging

#### Create Direct Conversation
```bash
curl -X POST http://localhost:3000/api/conversations/direct \
  -H "Content-Type: application/json" \
  -d '{"user1Id":"USER1_ID","user2Id":"USER2_ID"}'
```

#### Get Direct Conversations for User
```bash
curl -X GET "http://localhost:3000/api/conversations/direct?userId=USER_ID"
```

### Phase 3: Message Threading

#### Create Thread Reply
```bash
curl -X POST http://localhost:3000/api/messages/MESSAGE_ID/reply \
  -H "Content-Type: application/json" \
  -d '{"text":"This is a reply","senderId":"USER_ID","senderName":"Alice"}'
```

#### Get Thread Messages
```bash
curl -X GET "http://localhost:3000/api/threads/THREAD_ID"
```

### Phase 4: Message Search

#### Search Messages (All Conversations)
```bash
curl -X GET "http://localhost:3000/api/search/messages?query=welcome"
```

#### Search Messages (Specific Conversation)
```bash
curl -X GET "http://localhost:3000/api/search/messages?query=hello&conversationId=CONV_ID"
```

#### Search Conversations
```bash
curl -X GET "http://localhost:3000/api/search/conversations?query=general"
```

## Database Testing

### SQLite Compatibility Tests

The following features have been tested for SQLite compatibility:

1. **Text Search**: Uses `contains` operator (SQLite compatible)
   - ✅ Removed `mode: 'insensitive'` parameter
   - ✅ Works with case-sensitive search

2. **Foreign Key Relationships**: 
   - ✅ User-Conversation relationships
   - ✅ Message-Thread relationships
   - ✅ Direct conversation constraints

3. **Transaction Support**:
   - ✅ Conversation creation with participants
   - ✅ Message threading operations

### Database Schema Validation

#### Key Tables and Relationships
- `User` - User accounts and status
- `Conversation` - Chat conversations (group/direct)
- `ConversationParticipant` - User-conversation relationships
- `Message` - Chat messages with threading support
- `MessageReaction` - Message reactions
- `ReadReceipt` - Message read status
- `MessageFile` - File attachments

## WebSocket Testing

### Connection Testing
```bash
# Check if WebSocket server is running
lsof -i :3000
```

### Real-time Message Testing
1. Connect two WebSocket clients
2. Send messages from one client
3. Verify real-time delivery to other client
4. Test message persistence in database

## Performance Testing

### Database Query Performance
- Search queries: Test with large message datasets
- Thread retrieval: Test with deep conversation threads
- User lookup: Test with many users

### Concurrent Connection Testing
- Multiple WebSocket connections
- Simultaneous message sending
- Database transaction handling

## Error Handling Testing

### Invalid Input Testing
```bash
# Test empty search query
curl -X GET "http://localhost:3000/api/search/messages?query="

# Test non-existent user ID
curl -X GET "http://localhost:3000/api/users?currentUserId=invalid-id"

# Test invalid conversation creation
curl -X POST http://localhost:3000/api/conversations/direct \
  -H "Content-Type: application/json" \
  -d '{"user1Id":"invalid","user2Id":"invalid"}'
```

### Database Connection Testing
- Test behavior when database is unavailable
- Test transaction rollback scenarios
- Test constraint violation handling

## Test Data Cleanup

### Reset Database for Testing
```bash
# Remove SQLite database file
rm chat-backend/prisma/dev.db

# Regenerate database schema
npx prisma db push
```

## Continuous Integration Testing

### Pre-commit Testing Checklist
- [ ] All unit tests pass
- [ ] API endpoints respond correctly
- [ ] Database queries execute without errors
- [ ] WebSocket connections establish successfully
- [ ] Search functionality works with SQLite

### Test Coverage Requirements
- Database methods: 100% coverage
- API endpoints: 95% coverage
- Error handling: 90% coverage

## Known Issues and Limitations

### SQLite Limitations
- Case-insensitive search requires manual implementation
- Full-text search capabilities are limited
- No built-in similarity matching

### Performance Considerations
- Large message history may slow search queries
- Deep thread hierarchies may impact load times
- Concurrent write operations may cause locks

## Troubleshooting

### Common Issues

1. **Port 3000 Already in Use**
   ```bash
   lsof -i :3000
   kill -9 PID
   ```

2. **Database Connection Errors**
   - Check SQLite file permissions
   - Verify Prisma schema is up to date
   - Ensure database migrations are applied

3. **Search Not Working**
   - Verify `mode: 'insensitive'` is removed from queries
   - Check SQLite compatibility of Prisma queries
   - Restart server after code changes

4. **WebSocket Connection Failures**
   - Check CORS configuration
   - Verify client connection URL
   - Check server logs for errors

### Debug Commands
```bash
# Check server logs
tail -f chat-backend/server.log

# Verify database schema
npx prisma studio

# Test database connectivity
npx prisma db pull
```