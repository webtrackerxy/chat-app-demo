const request = require('supertest')
const express = require('express')
const DatabaseService = require('../src/database/DatabaseService')
const fs = require('fs')
const path = require('path')

// Test database file
const TEST_DB_PATH = path.join(__dirname, 'e2e-test.db')

describe('End-to-End Database Tests', () => {
  let app
  let dbService

  beforeAll(async () => {
    // Set test database URL
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`
    
    // Initialize database service
    dbService = new DatabaseService()
    await dbService.connect()

    // Create a minimal Express app with actual endpoints
    app = express()
    app.use(express.json())

    // User creation endpoint
    app.post('/api/users', async (req, res) => {
      try {
        const { username } = req.body
        
        if (!username) {
          return res.status(400).json({
            success: false,
            error: 'Username is required'
          })
        }

        // Check if user already exists
        const existingUser = await dbService.getUserByUsername(username)
        if (existingUser) {
          return res.json({
            success: true,
            data: existingUser
          })
        }

        // Create new user
        const newUser = await dbService.createUser({
          username,
          status: 'online'
        })

        res.json({
          success: true,
          data: newUser
        })
      } catch (error) {
        console.error('Error creating user:', error)
        res.status(500).json({
          success: false,
          error: 'Failed to create user'
        })
      }
    })

    // Get user endpoint
    app.get('/api/users/:username', async (req, res) => {
      try {
        const { username } = req.params
        const user = await dbService.getUserByUsername(username)
        
        if (!user) {
          return res.status(404).json({
            success: false,
            error: 'User not found'
          })
        }

        res.json({
          success: true,
          data: user
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch user'
        })
      }
    })

    // Conversations endpoint
    app.get('/api/conversations', async (req, res) => {
      try {
        const { userId } = req.query
        
        if (!userId) {
          return res.json({
            success: true,
            data: []
          })
        }

        const userConversations = await dbService.getConversationsForUser(userId)
        
        const formattedConversations = userConversations.map(conv => ({
          id: conv.id,
          title: conv.name || conv.title,
          participants: conv.participants.map(p => p.user.username),
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
          lastMessage: conv.messages.length > 0 ? {
            id: conv.messages[0].id,
            text: conv.messages[0].text,
            senderId: conv.messages[0].senderId,
            senderName: conv.messages[0].sender.username,
            timestamp: conv.messages[0].timestamp
          } : null
        }))

        res.json({
          success: true,
          data: formattedConversations,
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch conversations',
        })
      }
    })

    // Messages endpoint
    app.get('/api/conversations/:id/messages', async (req, res) => {
      try {
        const { id } = req.params
        const { page = 1, limit = 50 } = req.query

        const messages = await dbService.getMessages(id, parseInt(page), parseInt(limit))
        
        const formattedMessages = messages.map(msg => ({
          id: msg.id,
          text: msg.text,
          senderId: msg.senderId,
          senderName: msg.sender.username,
          timestamp: msg.timestamp,
          reactions: msg.reactions.map(r => ({
            emoji: r.emoji,
            userId: r.userId
          })),
          readBy: msg.readReceipts.map(r => ({
            userId: r.userId,
            userName: r.userName,
            readAt: r.readAt
          }))
        })).reverse()

        return res.json({
          success: true,
          data: formattedMessages,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            hasMore: messages.length === parseInt(limit)
          }
        })
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch messages'
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
  })

  describe('User Management Flow', () => {
    test('should create and retrieve users through API', async () => {
      // Create a user via API
      const createResponse = await request(app)
        .post('/api/users')
        .send({ username: 'testuser' })
        .expect(200)

      expect(createResponse.body.success).toBe(true)
      expect(createResponse.body.data.username).toBe('testuser')
      expect(createResponse.body.data.id).toBeDefined()

      const userId = createResponse.body.data.id

      // Retrieve the user via API
      const getResponse = await request(app)
        .get('/api/users/testuser')
        .expect(200)

      expect(getResponse.body.success).toBe(true)
      expect(getResponse.body.data.id).toBe(userId)
      expect(getResponse.body.data.username).toBe('testuser')

      // Verify user exists in database
      const userFromDb = await dbService.getUserById(userId)
      expect(userFromDb.username).toBe('testuser')
    })

    test('should handle duplicate user creation', async () => {
      // Create user first time
      await request(app)
        .post('/api/users')
        .send({ username: 'duplicate' })
        .expect(200)

      // Try to create same user again
      const secondResponse = await request(app)
        .post('/api/users')
        .send({ username: 'duplicate' })
        .expect(200)

      expect(secondResponse.body.success).toBe(true)
      expect(secondResponse.body.data.username).toBe('duplicate')

      // Verify only one user exists in database
      const allUsers = await dbService.prisma.user.findMany({
        where: { username: 'duplicate' }
      })
      expect(allUsers).toHaveLength(1)
    })
  })

  describe('Conversation and Message Flow', () => {
    test('should create conversation and messages, then retrieve them', async () => {
      // Create test users
      const user1Response = await request(app)
        .post('/api/users')
        .send({ username: 'alice' })

      const user2Response = await request(app)
        .post('/api/users')
        .send({ username: 'bob' })

      const user1 = user1Response.body.data
      const user2 = user2Response.body.data

      // Create conversation via database service
      const conversation = await dbService.createConversation(
        {
          name: 'Test Chat',
          type: 'group',
          createdBy: user1.id
        },
        [user1.id, user2.id]
      )

      // Add messages via database service
      const message1 = await dbService.saveMessage({
        text: 'Hello from Alice',
        senderId: user1.id,
        conversationId: conversation.id
      })

      const message2 = await dbService.saveMessage({
        text: 'Hi Alice, this is Bob',
        senderId: user2.id,
        conversationId: conversation.id
      })

      // Retrieve conversations via API
      const conversationsResponse = await request(app)
        .get(`/api/conversations?userId=${user1.id}`)
        .expect(200)

      expect(conversationsResponse.body.success).toBe(true)
      expect(conversationsResponse.body.data).toHaveLength(1)
      expect(conversationsResponse.body.data[0].title).toBe('Test Chat')
      expect(conversationsResponse.body.data[0].participants).toContain('alice')
      expect(conversationsResponse.body.data[0].participants).toContain('bob')

      // Retrieve messages via API
      const messagesResponse = await request(app)
        .get(`/api/conversations/${conversation.id}/messages`)
        .expect(200)

      expect(messagesResponse.body.success).toBe(true)
      expect(messagesResponse.body.data).toHaveLength(2)
      expect(messagesResponse.body.data[0].text).toBe('Hello from Alice')
      expect(messagesResponse.body.data[1].text).toBe('Hi Alice, this is Bob')
    })

    test('should handle message reactions and read receipts', async () => {
      // Setup users and conversation
      const user1Response = await request(app)
        .post('/api/users')
        .send({ username: 'alice' })

      const user2Response = await request(app)
        .post('/api/users')
        .send({ username: 'bob' })

      const user1 = user1Response.body.data
      const user2 = user2Response.body.data

      const conversation = await dbService.createConversation(
        { name: 'Test Chat', type: 'group' },
        [user1.id, user2.id]
      )

      // Create a message
      const message = await dbService.saveMessage({
        text: 'React to this message',
        senderId: user1.id,
        conversationId: conversation.id
      })

      // Add reaction
      await dbService.toggleReaction(message.id, user2.id, '👍')

      // Mark as read
      await dbService.markMessageAsRead(message.id, user2.id, 'bob')

      // Retrieve messages with reactions and read receipts
      const messagesResponse = await request(app)
        .get(`/api/conversations/${conversation.id}/messages`)
        .expect(200)

      const retrievedMessage = messagesResponse.body.data[0]
      expect(retrievedMessage.reactions).toHaveLength(1)
      expect(retrievedMessage.reactions[0].emoji).toBe('👍')
      expect(retrievedMessage.reactions[0].userId).toBe(user2.id)

      expect(retrievedMessage.readBy).toHaveLength(1)
      expect(retrievedMessage.readBy[0].userId).toBe(user2.id)
      expect(retrievedMessage.readBy[0].userName).toBe('bob')
    })
  })

  describe('Message Pagination', () => {
    test('should paginate messages correctly', async () => {
      // Setup user and conversation
      const userResponse = await request(app)
        .post('/api/users')
        .send({ username: 'testuser' })

      const user = userResponse.body.data

      const conversation = await dbService.createConversation(
        { name: 'Pagination Test', type: 'group' },
        [user.id]
      )

      // Create 25 messages
      for (let i = 1; i <= 25; i++) {
        await dbService.saveMessage({
          text: `Message ${i}`,
          senderId: user.id,
          conversationId: conversation.id
        })
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Get first page (10 messages)
      const page1Response = await request(app)
        .get(`/api/conversations/${conversation.id}/messages?page=1&limit=10`)
        .expect(200)

      expect(page1Response.body.data).toHaveLength(10)
      expect(page1Response.body.pagination.page).toBe(1)
      expect(page1Response.body.pagination.hasMore).toBe(true)
      // Should get newest messages first
      expect(page1Response.body.data[0].text).toBe('Message 25')

      // Get second page
      const page2Response = await request(app)
        .get(`/api/conversations/${conversation.id}/messages?page=2&limit=10`)
        .expect(200)

      expect(page2Response.body.data).toHaveLength(10)
      expect(page2Response.body.pagination.page).toBe(2)
      expect(page2Response.body.pagination.hasMore).toBe(true)
      expect(page2Response.body.data[0].text).toBe('Message 15')

      // Get third page (remaining 5 messages)
      const page3Response = await request(app)
        .get(`/api/conversations/${conversation.id}/messages?page=3&limit=10`)
        .expect(200)

      expect(page3Response.body.data).toHaveLength(5)
      expect(page3Response.body.pagination.page).toBe(3)
      expect(page3Response.body.pagination.hasMore).toBe(false)
      expect(page3Response.body.data[0].text).toBe('Message 5')
    })
  })

  describe('Database Persistence', () => {
    test('should persist data across service restarts', async () => {
      // Create user and conversation
      const userResponse = await request(app)
        .post('/api/users')
        .send({ username: 'persistent' })

      const user = userResponse.body.data

      const conversation = await dbService.createConversation(
        { name: 'Persistent Chat', type: 'group' },
        [user.id]
      )

      await dbService.saveMessage({
        text: 'This should persist',
        senderId: user.id,
        conversationId: conversation.id
      })

      // Disconnect and reconnect database service
      await dbService.disconnect()
      
      const newDbService = new DatabaseService()
      await newDbService.connect()

      // Verify data persists
      const persistedUser = await newDbService.getUserByUsername('persistent')
      expect(persistedUser.username).toBe('persistent')

      const persistedConversations = await newDbService.getConversationsForUser(user.id)
      expect(persistedConversations).toHaveLength(1)
      expect(persistedConversations[0].name).toBe('Persistent Chat')

      const persistedMessages = await newDbService.getMessages(conversation.id)
      expect(persistedMessages).toHaveLength(1)
      expect(persistedMessages[0].text).toBe('This should persist')

      await newDbService.disconnect()
    })
  })

  describe('Data Integrity', () => {
    test('should maintain referential integrity', async () => {
      // Create users
      const user1Response = await request(app)
        .post('/api/users')
        .send({ username: 'user1' })

      const user2Response = await request(app)
        .post('/api/users')
        .send({ username: 'user2' })

      const user1 = user1Response.body.data
      const user2 = user2Response.body.data

      // Create conversation
      const conversation = await dbService.createConversation(
        { name: 'Integrity Test', type: 'group' },
        [user1.id, user2.id]
      )

      // Create message
      const message = await dbService.saveMessage({
        text: 'Test message',
        senderId: user1.id,
        conversationId: conversation.id
      })

      // Add reaction and read receipt
      await dbService.toggleReaction(message.id, user2.id, '👍')
      await dbService.markMessageAsRead(message.id, user2.id, 'user2')

      // Verify all relationships exist
      const messageWithDetails = await dbService.getMessageById(message.id)
      expect(messageWithDetails.sender.username).toBe('user1')
      expect(messageWithDetails.reactions).toHaveLength(1)
      expect(messageWithDetails.readReceipts).toHaveLength(1)

      // Delete message (should cascade delete reactions and read receipts)
      await dbService.deleteMessage(message.id)

      // Verify cascading deletes worked
      const reactions = await dbService.getMessageReactions(message.id)
      const readReceipts = await dbService.getReadReceipts(message.id)
      
      expect(reactions).toHaveLength(0)
      expect(readReceipts).toHaveLength(0)
    })
  })
})