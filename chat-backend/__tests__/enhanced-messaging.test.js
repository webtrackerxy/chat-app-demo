const request = require('supertest')
const express = require('express')
const DatabaseService = require('../src/database/DatabaseService')
const fs = require('fs')
const path = require('path')

// Test database file
const TEST_DB_PATH = path.join(__dirname, 'enhanced-messaging-test.db')

describe('Enhanced Messaging Features (Phases 2-4)', () => {
  let app
  let dbService
  let testUsers = []
  let testConversations = []

  // Increase timeout for this test suite
  jest.setTimeout(30000)

  beforeAll(async () => {
    // Set test database URL
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`
    
    // Initialize database service
    dbService = new DatabaseService()
    await dbService.connect()
    
    // Push schema to create tables
    const { exec } = require('child_process')
    const util = require('util')
    const execAsync = util.promisify(exec)
    
    try {
      await execAsync('npx prisma db push --force-reset', { 
        cwd: path.join(__dirname, '..'),
        env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
      })
    } catch (error) {
      console.log('Schema push error (may be expected):', error.message)
    }

    // Create a minimal Express app with actual endpoints
    app = express()
    app.use(express.json())

    // Phase 2: Private Messaging endpoints
    app.get('/api/users', async (req, res) => {
      try {
        const { currentUserId } = req.query
        
        if (!currentUserId) {
          return res.status(400).json({
            success: false,
            error: 'Current user ID is required',
          })
        }

        const users = await dbService.getAllUsersForDirectMessages(currentUserId)
        
        res.json({
          success: true,
          data: users,
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch users',
        })
      }
    })

    app.post('/api/conversations/direct', async (req, res) => {
      try {
        const { user1Id, user2Id } = req.body
        
        if (!user1Id || !user2Id) {
          return res.status(400).json({
            success: false,
            error: 'Both user IDs are required',
          })
        }

        const conversation = await dbService.createDirectConversation(user1Id, user2Id)
        
        const formattedConversation = {
          id: conversation.id,
          type: conversation.type,
          title: conversation.participants
            .filter(p => p.userId !== user1Id)
            .map(p => p.user.username)[0] || 'Direct Message',
          participants: conversation.participants.map(p => p.user.username),
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
          lastMessage: null,
        }

        res.json({
          success: true,
          data: formattedConversation,
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to create direct conversation',
        })
      }
    })

    app.get('/api/conversations/direct', async (req, res) => {
      try {
        const { userId } = req.query
        
        if (!userId) {
          return res.status(400).json({
            success: false,
            error: 'User ID is required',
          })
        }

        const directConversations = await dbService.getDirectConversationsForUser(userId)
        
        const formattedConversations = directConversations.map(conv => ({
          id: conv.id,
          type: conv.type,
          title: conv.participants
            .filter(p => p.userId !== userId)
            .map(p => p.user.username)[0] || 'Direct Message',
          participants: conv.participants.map(p => p.user.username),
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          lastMessage: conv.messages.length > 0 ? {
            id: conv.messages[0].id,
            text: conv.messages[0].text,
            senderId: conv.messages[0].senderId,
            senderName: conv.messages[0].sender.username,
            timestamp: conv.messages[0].timestamp,
          } : null,
        }))

        res.json({
          success: true,
          data: formattedConversations,
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch direct conversations',
        })
      }
    })

    // Phase 3: Threading endpoints
    app.post('/api/messages/:messageId/reply', async (req, res) => {
      try {
        const { messageId } = req.params
        const { text, senderId, conversationId } = req.body
        
        if (!text || !senderId || !conversationId) {
          return res.status(400).json({
            success: false,
            error: 'Text, senderId, and conversationId are required',
          })
        }

        const replyMessage = await dbService.createThread(messageId, {
          text,
          senderId,
          conversationId,
        })

        const formattedMessage = {
          id: replyMessage.id,
          text: replyMessage.text,
          senderId: replyMessage.senderId,
          senderName: replyMessage.sender.username,
          timestamp: replyMessage.timestamp,
          threadId: replyMessage.threadId,
          replyToId: replyMessage.replyToId,
          reactions: replyMessage.reactions.map(r => ({
            emoji: r.emoji,
            userId: r.userId,
          })),
          readBy: replyMessage.readReceipts.map(r => ({
            userId: r.userId,
            userName: r.userName,
            readAt: r.readAt,
          })),
        }

        res.json({
          success: true,
          data: formattedMessage,
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to create thread reply',
        })
      }
    })

    app.get('/api/threads/:threadId', async (req, res) => {
      try {
        const { threadId } = req.params
        
        const threadMessages = await dbService.getThread(threadId)
        
        const formattedMessages = threadMessages.map(msg => ({
          id: msg.id,
          text: msg.text,
          senderId: msg.senderId,
          senderName: msg.sender.username,
          timestamp: msg.timestamp,
          threadId: msg.threadId,
          replyToId: msg.replyToId,
          reactions: msg.reactions.map(r => ({
            emoji: r.emoji,
            userId: r.userId,
          })),
          readBy: msg.readReceipts.map(r => ({
            userId: r.userId,
            userName: r.userName,
            readAt: r.readAt,
          })),
        }))

        res.json({
          success: true,
          data: formattedMessages,
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch thread',
        })
      }
    })

    // Phase 4: Search endpoints
    app.get('/api/search/messages', async (req, res) => {
      try {
        const { query, conversationId, limit = 50 } = req.query
        
        if (!query || query.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Search query is required',
          })
        }

        const searchResults = await dbService.searchMessages(
          query.trim(), 
          conversationId || null, 
          parseInt(limit),
        )
        
        const formattedResults = searchResults.map(msg => ({
          id: msg.id,
          text: msg.text,
          senderId: msg.senderId,
          senderName: msg.sender.username,
          timestamp: msg.timestamp,
          conversationId: msg.conversationId,
          conversationName: msg.conversation.name || `Conversation ${msg.conversation.id}`,
          conversationType: msg.conversation.type,
          threadId: msg.threadId,
          replyToId: msg.replyToId,
        }))

        res.json({
          success: true,
          data: formattedResults,
          meta: {
            query: query.trim(),
            conversationId: conversationId || null,
            totalResults: formattedResults.length,
          },
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to search messages',
        })
      }
    })

    app.get('/api/search/conversations', async (req, res) => {
      try {
        const { query, userId } = req.query
        
        if (!query || query.trim().length === 0) {
          return res.status(400).json({
            success: false,
            error: 'Search query is required',
          })
        }

        if (!userId) {
          return res.status(400).json({
            success: false,
            error: 'User ID is required',
          })
        }

        const userConversations = await dbService.getConversationsForUser(userId)
        
        const filteredConversations = userConversations.filter(conv => {
          const searchTerm = query.trim().toLowerCase()
          
          if (conv.name && conv.name.toLowerCase().includes(searchTerm)) {
            return true
          }
          
          const participantNames = conv.participants.map(p => p.user.username.toLowerCase())
          return participantNames.some(name => name.includes(searchTerm))
        })
        
        const formattedConversations = filteredConversations.map(conv => ({
          id: conv.id,
          type: conv.type,
          title: conv.name || conv.title,
          participants: conv.participants.map(p => p.user.username),
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          lastMessage: conv.messages.length > 0 ? {
            id: conv.messages[0].id,
            text: conv.messages[0].text,
            senderId: conv.messages[0].senderId,
            senderName: conv.messages[0].sender.username,
            timestamp: conv.messages[0].timestamp,
          } : null,
        }))

        res.json({
          success: true,
          data: formattedConversations,
          meta: {
            query: query.trim(),
            totalResults: formattedConversations.length,
          },
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to search conversations',
        })
      }
    })
  })

  afterAll(async () => {
    await dbService.disconnect()
    
    // Clean up test database file
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
  })

  beforeEach(async () => {
    // Clean up all data before each test
    await dbService.prisma.readReceipt.deleteMany()
    await dbService.prisma.messageReaction.deleteMany()
    await dbService.prisma.messageFile.deleteMany()
    await dbService.prisma.message.deleteMany()
    await dbService.prisma.conversationParticipant.deleteMany()
    await dbService.prisma.conversation.deleteMany()
    await dbService.prisma.user.deleteMany()
    
    testUsers = []
    testConversations = []
  })

  describe('Phase 2: Private Messaging', () => {
    test('should get all users except current user', async () => {
      // Create test users
      const user1 = await dbService.createUser({ username: 'alice', status: 'online' })
      const user2 = await dbService.createUser({ username: 'bob', status: 'offline' })
      const user3 = await dbService.createUser({ username: 'charlie', status: 'online' })
      testUsers = [user1, user2, user3]

      const response = await request(app)
        .get(`/api/users?currentUserId=${user1.id}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.data.map(u => u.username)).toEqual(['bob', 'charlie'])
      expect(response.body.data.find(u => u.username === 'alice')).toBeUndefined()
    })

    test('should create direct conversation between two users', async () => {
      // Create test users
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      const response = await request(app)
        .post('/api/conversations/direct')
        .send({ user1Id: user1.id, user2Id: user2.id })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.type).toBe('direct')
      expect(response.body.data.participants).toEqual(['alice', 'bob'])
      expect(response.body.data.title).toBe('bob') // Title should be the other user's name
    })

    test('should return existing direct conversation if it already exists', async () => {
      // Create test users
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      // Create conversation first time
      const firstResponse = await request(app)
        .post('/api/conversations/direct')
        .send({ user1Id: user1.id, user2Id: user2.id })
        .expect(200)

      // Try to create same conversation again
      const secondResponse = await request(app)
        .post('/api/conversations/direct')
        .send({ user1Id: user1.id, user2Id: user2.id })
        .expect(200)

      expect(firstResponse.body.data.id).toBe(secondResponse.body.data.id)
    })

    test('should get direct conversations for user', async () => {
      // Create test users
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      const user3 = await dbService.createUser({ username: 'charlie' })
      testUsers = [user1, user2, user3]

      // Create direct conversations
      await dbService.createDirectConversation(user1.id, user2.id)
      await dbService.createDirectConversation(user1.id, user3.id)

      const response = await request(app)
        .get(`/api/conversations/direct?userId=${user1.id}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.data.every(conv => conv.type === 'direct')).toBe(true)
    })
  })

  describe('Phase 3: Message Threading', () => {
    test('should create thread reply to a message', async () => {
      // Setup users and conversation
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      const conversation = await dbService.createConversation(
        { name: 'Test Chat', type: 'group' },
        [user1.id, user2.id],
      )
      testConversations = [conversation]

      // Create parent message
      const parentMessage = await dbService.saveMessage({
        text: 'Original message',
        senderId: user1.id,
        conversationId: conversation.id,
      })

      // Create thread reply
      const response = await request(app)
        .post(`/api/messages/${parentMessage.id}/reply`)
        .send({
          text: 'This is a reply',
          senderId: user2.id,
          conversationId: conversation.id,
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.text).toBe('This is a reply')
      expect(response.body.data.replyToId).toBe(parentMessage.id)
      expect(response.body.data.threadId).toBe(parentMessage.id)
      expect(response.body.data.senderName).toBe('bob')
    })

    test('should get all messages in a thread', async () => {
      // Setup users and conversation
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      const conversation = await dbService.createConversation(
        { name: 'Test Chat', type: 'group' },
        [user1.id, user2.id],
      )
      testConversations = [conversation]

      // Create parent message
      const parentMessage = await dbService.saveMessage({
        text: 'Original message',
        senderId: user1.id,
        conversationId: conversation.id,
      })

      // Create multiple thread replies
      await dbService.createThread(parentMessage.id, {
        text: 'First reply',
        senderId: user2.id,
        conversationId: conversation.id,
      })

      await dbService.createThread(parentMessage.id, {
        text: 'Second reply',
        senderId: user1.id,
        conversationId: conversation.id,
      })

      const response = await request(app)
        .get(`/api/threads/${parentMessage.id}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(3) // Parent + 2 replies
      expect(response.body.data[0].text).toBe('Original message')
      expect(response.body.data[1].text).toBe('First reply')
      expect(response.body.data[2].text).toBe('Second reply')
    })
  })

  describe('Phase 4: Message Search', () => {
    test('should search messages across all conversations', async () => {
      // Setup users and conversations
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      const conv1 = await dbService.createConversation(
        { name: 'Chat 1', type: 'group' },
        [user1.id, user2.id],
      )
      const conv2 = await dbService.createConversation(
        { name: 'Chat 2', type: 'group' },
        [user1.id, user2.id],
      )
      testConversations = [conv1, conv2]

      // Create messages
      await dbService.saveMessage({
        text: 'Hello world from chat 1',
        senderId: user1.id,
        conversationId: conv1.id,
      })
      await dbService.saveMessage({
        text: 'Hello universe from chat 2',
        senderId: user2.id,
        conversationId: conv2.id,
      })
      await dbService.saveMessage({
        text: 'Goodbye world',
        senderId: user1.id,
        conversationId: conv1.id,
      })

      const response = await request(app)
        .get('/api/search/messages?query=hello')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(2)
      expect(response.body.meta.query).toBe('hello')
      expect(response.body.meta.totalResults).toBe(2)
      
      const texts = response.body.data.map(r => r.text)
      expect(texts).toContain('Hello world from chat 1')
      expect(texts).toContain('Hello universe from chat 2')
    })

    test('should search messages within specific conversation', async () => {
      // Setup users and conversations
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      const conv1 = await dbService.createConversation(
        { name: 'Chat 1', type: 'group' },
        [user1.id, user2.id],
      )
      const conv2 = await dbService.createConversation(
        { name: 'Chat 2', type: 'group' },
        [user1.id, user2.id],
      )
      testConversations = [conv1, conv2]

      // Create messages
      await dbService.saveMessage({
        text: 'Hello world from chat 1',
        senderId: user1.id,
        conversationId: conv1.id,
      })
      await dbService.saveMessage({
        text: 'Hello universe from chat 2',
        senderId: user2.id,
        conversationId: conv2.id,
      })

      const response = await request(app)
        .get(`/api/search/messages?query=hello&conversationId=${conv1.id}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0].text).toBe('Hello world from chat 1')
      expect(response.body.data[0].conversationId).toBe(conv1.id)
    })

    test('should search conversations by name and participants', async () => {
      // Setup users
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      const user3 = await dbService.createUser({ username: 'charlie' })
      testUsers = [user1, user2, user3]

      // Create conversations
      const conv1 = await dbService.createConversation(
        { name: 'Project Alpha', type: 'group' },
        [user1.id, user2.id],
      )
      const conv2 = await dbService.createConversation(
        { name: 'Random Chat', type: 'group' },
        [user1.id, user3.id],
      )
      testConversations = [conv1, conv2]

      // Search by conversation name
      const nameSearchResponse = await request(app)
        .get(`/api/search/conversations?query=alpha&userId=${user1.id}`)
        .expect(200)

      expect(nameSearchResponse.body.success).toBe(true)
      expect(nameSearchResponse.body.data).toHaveLength(1)
      expect(nameSearchResponse.body.data[0].title).toBe('Project Alpha')

      // Search by participant name
      const participantSearchResponse = await request(app)
        .get(`/api/search/conversations?query=charlie&userId=${user1.id}`)
        .expect(200)

      expect(participantSearchResponse.body.success).toBe(true)
      expect(participantSearchResponse.body.data).toHaveLength(1)
      expect(participantSearchResponse.body.data[0].participants).toContain('charlie')
    })

    test('should handle empty search results', async () => {
      const user1 = await dbService.createUser({ username: 'alice' })
      testUsers = [user1]

      const response = await request(app)
        .get('/api/search/messages?query=nonexistent')
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(0)
      expect(response.body.meta.totalResults).toBe(0)
    })

    test('should validate search query', async () => {
      const response = await request(app)
        .get('/api/search/messages?query=')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Search query is required')
    })
  })

  describe('Error Handling', () => {
    test('should handle missing parameters for direct conversation creation', async () => {
      const response = await request(app)
        .post('/api/conversations/direct')
        .send({ user1Id: 'user1' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Both user IDs are required')
    })

    test('should handle missing parameters for thread reply', async () => {
      const response = await request(app)
        .post('/api/messages/msg123/reply')
        .send({ text: 'reply' })
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Text, senderId, and conversationId are required')
    })

    test('should handle missing userId for conversation search', async () => {
      const response = await request(app)
        .get('/api/search/conversations?query=test')
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('User ID is required')
    })
  })
})