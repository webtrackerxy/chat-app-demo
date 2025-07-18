const request = require('supertest')
const express = require('express')
const DatabaseService = require('../src/database/DatabaseService')

// Create a test express app with our routes
const createTestApp = () => {
  const app = express()
  app.use(express.json())

  // Mock database service
  const mockDb = {
    createUser: jest.fn(),
    getUserByUsername: jest.fn(),
    getConversationsForUser: jest.fn(),
    getMessages: jest.fn(),
    saveMessage: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
  }

  // User management endpoints
  app.post('/api/users', async (req, res) => {
    try {
      const { username } = req.body
      
      if (!username) {
        return res.status(400).json({
          success: false,
          error: 'Username is required',
        })
      }

      // Check if user already exists
      const existingUser = await mockDb.getUserByUsername(username)
      if (existingUser) {
        return res.json({
          success: true,
          data: existingUser,
        })
      }

      // Create new user
      const newUser = await mockDb.createUser({
        username,
        status: 'online',
      })

      res.json({
        success: true,
        data: newUser,
      })
    } catch (error) {
      console.error('Error creating user:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to create user',
      })
    }
  })

  app.get('/api/users/:username', async (req, res) => {
    try {
      const { username } = req.params
      const user = await mockDb.getUserByUsername(username)
      
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        })
      }

      res.json({
        success: true,
        data: user,
      })
    } catch (error) {
      console.error('Error fetching user:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch user',
      })
    }
  })

  // Conversations endpoint
  app.get('/api/conversations', async (req, res) => {
    try {
      const { userId } = req.query
      
      if (!userId) {
        // Fallback response for backward compatibility
        return res.json({
          success: true,
          data: [],
        })
      }

      // Use database for user-specific conversations
      const userConversations = await mockDb.getConversationsForUser(userId)
      
      // Transform database format to match frontend expectations
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
          timestamp: conv.messages[0].timestamp,
        } : null,
      }))

      res.json({
        success: true,
        data: formattedConversations,
      })
    } catch (error) {
      console.error('Error fetching conversations:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversations',
      })
    }
  })

  // Messages endpoint with pagination
  app.get('/api/conversations/:id/messages', async (req, res) => {
    try {
      const { id } = req.params
      const { page = 1, limit = 50 } = req.query

      const messages = await mockDb.getMessages(id, parseInt(page), parseInt(limit))
      
      // Transform database format to match frontend expectations
      const formattedMessages = messages.map(msg => ({
        id: msg.id,
        text: msg.text,
        senderId: msg.senderId,
        senderName: msg.sender.username,
        timestamp: msg.timestamp,
        file: msg.files.length > 0 ? {
          id: msg.files[0].id,
          name: msg.files[0].filename,
          path: msg.files[0].path,
          type: msg.files[0].type,
          size: msg.files[0].size,
        } : null,
        reactions: msg.reactions.map(r => ({
          emoji: r.emoji,
          userId: r.userId,
        })),
        readBy: msg.readReceipts.map(r => ({
          userId: r.userId,
          userName: r.userName,
          readAt: r.readAt,
        })),
      })).reverse() // Reverse to match expected order

      return res.json({
        success: true,
        data: formattedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: messages.length === parseInt(limit),
        },
      })
    } catch (error) {
      console.error('Error fetching messages:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to fetch messages',
      })
    }
  })

  return { app, mockDb }
}

describe('Database API Endpoints', () => {
  let app, mockDb

  beforeEach(() => {
    const testApp = createTestApp()
    app = testApp.app
    mockDb = testApp.mockDb
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/users', () => {
    test('should create a new user successfully', async () => {
      const userData = { username: 'testuser' }
      const createdUser = {
        id: 'user1',
        username: 'testuser',
        status: 'online',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      // Expected response should have date strings, not Date objects
      const expectedResponse = {
        ...createdUser,
        createdAt: createdUser.createdAt.toISOString(),
        updatedAt: createdUser.updatedAt.toISOString(),
      }

      mockDb.getUserByUsername.mockResolvedValue(null) // User doesn't exist
      mockDb.createUser.mockResolvedValue(createdUser)

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        data: expectedResponse,
      })
      expect(mockDb.getUserByUsername).toHaveBeenCalledWith('testuser')
      expect(mockDb.createUser).toHaveBeenCalledWith({
        username: 'testuser',
        status: 'online',
      })
    })

    test('should return existing user if already exists', async () => {
      const userData = { username: 'existinguser' }
      const existingUser = {
        id: 'user1',
        username: 'existinguser',
        status: 'online',
      }

      mockDb.getUserByUsername.mockResolvedValue(existingUser)

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        data: existingUser,
      })
      expect(mockDb.getUserByUsername).toHaveBeenCalledWith('existinguser')
      expect(mockDb.createUser).not.toHaveBeenCalled()
    })

    test('should return 400 if username is missing', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({})
        .expect(400)

      expect(response.body).toEqual({
        success: false,
        error: 'Username is required',
      })
    })

    test('should handle database errors', async () => {
      const userData = { username: 'testuser' }
      
      mockDb.getUserByUsername.mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(500)

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to create user',
      })
    })
  })

  describe('GET /api/users/:username', () => {
    test('should return user by username', async () => {
      const user = {
        id: 'user1',
        username: 'testuser',
        status: 'online',
      }

      mockDb.getUserByUsername.mockResolvedValue(user)

      const response = await request(app)
        .get('/api/users/testuser')
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        data: user,
      })
      expect(mockDb.getUserByUsername).toHaveBeenCalledWith('testuser')
    })

    test('should return 404 if user not found', async () => {
      mockDb.getUserByUsername.mockResolvedValue(null)

      const response = await request(app)
        .get('/api/users/nonexistent')
        .expect(404)

      expect(response.body).toEqual({
        success: false,
        error: 'User not found',
      })
    })

    test('should handle database errors', async () => {
      mockDb.getUserByUsername.mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/users/testuser')
        .expect(500)

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch user',
      })
    })
  })

  describe('GET /api/conversations', () => {
    test('should return user conversations', async () => {
      const userId = 'user1'
      const dbConversations = [
        {
          id: 'conv1',
          name: 'Test Chat',
          createdAt: new Date(),
          updatedAt: new Date(),
          participants: [
            { user: { username: 'user1' } },
            { user: { username: 'user2' } },
          ],
          messages: [
            {
              id: 'msg1',
              text: 'Hello',
              senderId: 'user1',
              sender: { username: 'user1' },
              timestamp: new Date(),
            },
          ],
        },
      ]

      mockDb.getConversationsForUser.mockResolvedValue(dbConversations)

      const response = await request(app)
        .get(`/api/conversations?userId=${userId}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]).toMatchObject({
        id: 'conv1',
        title: 'Test Chat',
        participants: ['user1', 'user2'],
        lastMessage: {
          id: 'msg1',
          text: 'Hello',
          senderId: 'user1',
          senderName: 'user1',
        },
      })
      expect(mockDb.getConversationsForUser).toHaveBeenCalledWith(userId)
    })

    test('should return empty array for backward compatibility when no userId', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .expect(200)

      expect(response.body).toEqual({
        success: true,
        data: [],
      })
      expect(mockDb.getConversationsForUser).not.toHaveBeenCalled()
    })

    test('should handle database errors', async () => {
      mockDb.getConversationsForUser.mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/conversations?userId=user1')
        .expect(500)

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch conversations',
      })
    })
  })

  describe('GET /api/conversations/:id/messages', () => {
    test('should return paginated messages', async () => {
      const conversationId = 'conv1'
      const dbMessages = [
        {
          id: 'msg1',
          text: 'Hello World',
          senderId: 'user1',
          sender: { username: 'user1' },
          timestamp: new Date(),
          files: [],
          reactions: [{ emoji: '👍', userId: 'user2' }],
          readReceipts: [
            { userId: 'user2', userName: 'user2', readAt: new Date() },
          ],
        },
      ]

      mockDb.getMessages.mockResolvedValue(dbMessages)

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages?page=1&limit=50`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(1)
      expect(response.body.data[0]).toMatchObject({
        id: 'msg1',
        text: 'Hello World',
        senderId: 'user1',
        senderName: 'user1',
        reactions: [{ emoji: '👍', userId: 'user2' }],
        readBy: [{ userId: 'user2', userName: 'user2' }],
      })
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 50,
        hasMore: false, // Only 1 message, less than limit
      })
      expect(mockDb.getMessages).toHaveBeenCalledWith(conversationId, 1, 50)
    })

    test('should use default pagination values', async () => {
      const conversationId = 'conv1'
      mockDb.getMessages.mockResolvedValue([])

      await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .expect(200)

      expect(mockDb.getMessages).toHaveBeenCalledWith(conversationId, 1, 50)
    })

    test('should indicate hasMore when limit reached', async () => {
      const conversationId = 'conv1'
      const limit = 2
      const dbMessages = new Array(limit).fill(null).map((_, i) => ({
        id: `msg${i}`,
        text: `Message ${i}`,
        senderId: 'user1',
        sender: { username: 'user1' },
        timestamp: new Date(),
        files: [],
        reactions: [],
        readReceipts: [],
      }))

      mockDb.getMessages.mockResolvedValue(dbMessages)

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages?page=1&limit=${limit}`)
        .expect(200)

      expect(response.body.pagination.hasMore).toBe(true)
    })

    test('should handle database errors', async () => {
      mockDb.getMessages.mockRejectedValue(new Error('Database error'))

      const response = await request(app)
        .get('/api/conversations/conv1/messages')
        .expect(500)

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch messages',
      })
    })
  })

  describe('Message Format Transformation', () => {
    test('should handle messages with files', async () => {
      const conversationId = 'conv1'
      const dbMessages = [
        {
          id: 'msg1',
          text: 'Check this file',
          senderId: 'user1',
          sender: { username: 'user1' },
          timestamp: new Date(),
          files: [
            {
              id: 'file1',
              filename: 'test.jpg',
              path: '/uploads/test.jpg',
              type: 'image/jpeg',
              size: 1024,
            },
          ],
          reactions: [],
          readReceipts: [],
        },
      ]

      mockDb.getMessages.mockResolvedValue(dbMessages)

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .expect(200)

      expect(response.body.data[0].file).toEqual({
        id: 'file1',
        name: 'test.jpg',
        path: '/uploads/test.jpg',
        type: 'image/jpeg',
        size: 1024,
      })
    })

    test('should handle messages without files', async () => {
      const conversationId = 'conv1'
      const dbMessages = [
        {
          id: 'msg1',
          text: 'Just text',
          senderId: 'user1',
          sender: { username: 'user1' },
          timestamp: new Date(),
          files: [],
          reactions: [],
          readReceipts: [],
        },
      ]

      mockDb.getMessages.mockResolvedValue(dbMessages)

      const response = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .expect(200)

      expect(response.body.data[0].file).toBe(null)
    })
  })
})