const DatabaseService = require('../src/database/DatabaseService')
const { PrismaClient } = require('../generated/prisma')

// Mock Prisma Client
jest.mock('../generated/prisma', () => ({
  PrismaClient: jest.fn()
}))

describe('DatabaseService', () => {
  let dbService
  let mockPrisma

  beforeEach(() => {
    // Create mock Prisma instance
    mockPrisma = {
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      $transaction: jest.fn(),
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
      },
      conversation: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn()
      },
      conversationParticipant: {
        createMany: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn()
      },
      message: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        count: jest.fn()
      },
      messageFile: {
        create: jest.fn(),
        findMany: jest.fn()
      },
      messageReaction: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        findMany: jest.fn()
      },
      readReceipt: {
        upsert: jest.fn(),
        findMany: jest.fn()
      }
    }

    // Mock PrismaClient constructor
    PrismaClient.mockImplementation(() => mockPrisma)
    
    dbService = new DatabaseService()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Connection Management', () => {
    test('should connect to database successfully', async () => {
      mockPrisma.$connect.mockResolvedValue()
      
      await dbService.connect()
      
      expect(mockPrisma.$connect).toHaveBeenCalledTimes(1)
    })

    test('should handle connection errors', async () => {
      const error = new Error('Connection failed')
      mockPrisma.$connect.mockRejectedValue(error)
      
      await expect(dbService.connect()).rejects.toThrow('Connection failed')
    })

    test('should disconnect from database', async () => {
      mockPrisma.$disconnect.mockResolvedValue()
      
      await dbService.disconnect()
      
      expect(mockPrisma.$disconnect).toHaveBeenCalledTimes(1)
    })
  })

  describe('User Operations', () => {
    test('should create a new user', async () => {
      const userData = { username: 'testuser', status: 'online' }
      const expectedUser = { id: '1', ...userData, createdAt: new Date() }
      
      mockPrisma.user.create.mockResolvedValue(expectedUser)
      
      const result = await dbService.createUser(userData)
      
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: userData
      })
      expect(result).toEqual(expectedUser)
    })

    test('should get user by username', async () => {
      const username = 'testuser'
      const expectedUser = { id: '1', username, status: 'online' }
      
      mockPrisma.user.findUnique.mockResolvedValue(expectedUser)
      
      const result = await dbService.getUserByUsername(username)
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { username }
      })
      expect(result).toEqual(expectedUser)
    })

    test('should get user by ID', async () => {
      const userId = '1'
      const expectedUser = { id: userId, username: 'testuser' }
      
      mockPrisma.user.findUnique.mockResolvedValue(expectedUser)
      
      const result = await dbService.getUserById(userId)
      
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId }
      })
      expect(result).toEqual(expectedUser)
    })

    test('should update user status', async () => {
      const userId = '1'
      const status = 'offline'
      const lastSeen = new Date()
      const expectedUser = { id: userId, status, lastSeen }
      
      mockPrisma.user.update.mockResolvedValue(expectedUser)
      
      const result = await dbService.updateUserStatus(userId, status, lastSeen)
      
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { status, lastSeen }
      })
      expect(result).toEqual(expectedUser)
    })
  })

  describe('Conversation Operations', () => {
    test('should create conversation with participants', async () => {
      const conversationData = { name: 'Test Chat', type: 'group' }
      const participantIds = ['user1', 'user2']
      const mockConversation = { id: 'conv1', ...conversationData }
      const mockConversationWithDetails = {
        ...mockConversation,
        participants: [
          { user: { id: 'user1', username: 'User1' } },
          { user: { id: 'user2', username: 'User2' } }
        ],
        messages: []
      }

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const transactionPrisma = {
          conversation: {
            create: jest.fn().mockResolvedValue(mockConversation),
            findUnique: jest.fn().mockResolvedValue(mockConversationWithDetails)
          },
          conversationParticipant: {
            createMany: jest.fn().mockResolvedValue({ count: 2 })
          }
        }
        return await callback(transactionPrisma)
      })

      const result = await dbService.createConversation(conversationData, participantIds)

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockConversationWithDetails)
    })

    test('should get conversations for user', async () => {
      const userId = 'user1'
      const expectedConversations = [
        {
          id: 'conv1',
          name: 'Test Chat',
          participants: [{ user: { username: 'User1' } }],
          messages: []
        }
      ]

      mockPrisma.conversation.findMany.mockResolvedValue(expectedConversations)

      const result = await dbService.getConversationsForUser(userId)

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          participants: {
            some: {
              userId,
              leftAt: null
            }
          }
        },
        include: {
          participants: {
            include: { user: true }
          },
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            include: {
              sender: true,
              files: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })
      expect(result).toEqual(expectedConversations)
    })
  })

  describe('Message Operations', () => {
    test('should save message to database', async () => {
      const messageData = {
        text: 'Hello World',
        senderId: 'user1',
        conversationId: 'conv1'
      }
      const savedMessage = {
        id: 'msg1',
        ...messageData,
        timestamp: new Date(),
        sender: { username: 'User1' },
        files: [],
        reactions: [],
        readReceipts: []
      }

      mockPrisma.message.create.mockResolvedValue(savedMessage)
      mockPrisma.conversation.update.mockResolvedValue({})

      const result = await dbService.saveMessage(messageData)

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          ...messageData,
          timestamp: expect.any(Date)
        },
        include: {
          sender: true,
          files: true,
          reactions: true,
          readReceipts: true
        }
      })
      expect(mockPrisma.conversation.update).toHaveBeenCalledWith({
        where: { id: messageData.conversationId },
        data: { updatedAt: expect.any(Date) }
      })
      expect(result).toEqual(savedMessage)
    })

    test('should get messages with pagination', async () => {
      const conversationId = 'conv1'
      const page = 1
      const limit = 50
      const expectedMessages = [
        {
          id: 'msg1',
          text: 'Hello',
          sender: { username: 'User1' },
          files: [],
          reactions: [],
          readReceipts: []
        }
      ]

      mockPrisma.message.findMany.mockResolvedValue(expectedMessages)

      const result = await dbService.getMessages(conversationId, page, limit)

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: { conversationId },
        include: {
          sender: true,
          files: true,
          reactions: true,
          readReceipts: true,
          replyTo: {
            include: { sender: true }
          }
        },
        orderBy: { timestamp: 'desc' },
        skip: 0,
        take: 50
      })
      expect(result).toEqual(expectedMessages)
    })

    test('should delete message', async () => {
      const messageId = 'msg1'
      const deletedMessage = { id: messageId }

      mockPrisma.message.delete.mockResolvedValue(deletedMessage)

      const result = await dbService.deleteMessage(messageId)

      expect(mockPrisma.message.delete).toHaveBeenCalledWith({
        where: { id: messageId }
      })
      expect(result).toEqual(deletedMessage)
    })
  })

  describe('Reaction Operations', () => {
    test('should add new reaction', async () => {
      const messageId = 'msg1'
      const userId = 'user1'
      const emoji = '👍'

      mockPrisma.messageReaction.findUnique.mockResolvedValue(null) // No existing reaction
      mockPrisma.messageReaction.create.mockResolvedValue({ messageId, userId, emoji })

      const result = await dbService.toggleReaction(messageId, userId, emoji)

      expect(mockPrisma.messageReaction.findUnique).toHaveBeenCalledWith({
        where: {
          messageId_userId: { messageId, userId }
        }
      })
      expect(mockPrisma.messageReaction.create).toHaveBeenCalledWith({
        data: { messageId, userId, emoji }
      })
      expect(result).toEqual({ action: 'added', emoji })
    })

    test('should remove existing same reaction', async () => {
      const messageId = 'msg1'
      const userId = 'user1'
      const emoji = '👍'
      const existingReaction = { id: 'reaction1', emoji }

      mockPrisma.messageReaction.findUnique.mockResolvedValue(existingReaction)
      mockPrisma.messageReaction.delete.mockResolvedValue(existingReaction)

      const result = await dbService.toggleReaction(messageId, userId, emoji)

      expect(mockPrisma.messageReaction.delete).toHaveBeenCalledWith({
        where: { id: existingReaction.id }
      })
      expect(result).toEqual({ action: 'removed', emoji })
    })

    test('should update to different emoji', async () => {
      const messageId = 'msg1'
      const userId = 'user1'
      const newEmoji = '❤️'
      const existingReaction = { id: 'reaction1', emoji: '👍' }
      const updatedReaction = { ...existingReaction, emoji: newEmoji }

      mockPrisma.messageReaction.findUnique.mockResolvedValue(existingReaction)
      mockPrisma.messageReaction.update.mockResolvedValue(updatedReaction)

      const result = await dbService.toggleReaction(messageId, userId, newEmoji)

      expect(mockPrisma.messageReaction.update).toHaveBeenCalledWith({
        where: { id: existingReaction.id },
        data: { emoji: newEmoji }
      })
      expect(result).toEqual({ action: 'updated', emoji: newEmoji })
    })
  })

  describe('Read Receipt Operations', () => {
    test('should mark message as read', async () => {
      const messageId = 'msg1'
      const userId = 'user1'
      const userName = 'User1'
      const readReceipt = { messageId, userId, userName, readAt: new Date() }

      mockPrisma.readReceipt.upsert.mockResolvedValue(readReceipt)

      const result = await dbService.markMessageAsRead(messageId, userId, userName)

      expect(mockPrisma.readReceipt.upsert).toHaveBeenCalledWith({
        where: {
          messageId_userId: { messageId, userId }
        },
        update: { readAt: expect.any(Date) },
        create: {
          messageId,
          userId,
          userName,
          readAt: expect.any(Date)
        }
      })
      expect(result).toEqual(readReceipt)
    })
  })

  describe('Search Operations', () => {
    test('should search messages by text', async () => {
      const query = 'hello'
      const limit = 50
      const expectedResults = [
        {
          id: 'msg1',
          text: 'Hello World',
          sender: { username: 'User1' },
          conversation: { id: 'conv1', name: 'Test Chat' }
        }
      ]

      mockPrisma.message.findMany.mockResolvedValue(expectedResults)

      const result = await dbService.searchMessages(query, null, limit)

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: {
          text: {
            contains: query,
            mode: 'insensitive'
          }
        },
        include: {
          sender: true,
          conversation: true
        },
        orderBy: { timestamp: 'desc' },
        take: limit
      })
      expect(result).toEqual(expectedResults)
    })

    test('should search messages in specific conversation', async () => {
      const query = 'hello'
      const conversationId = 'conv1'
      const limit = 50

      mockPrisma.message.findMany.mockResolvedValue([])

      await dbService.searchMessages(query, conversationId, limit)

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: {
          text: {
            contains: query,
            mode: 'insensitive'
          },
          conversationId
        },
        include: {
          sender: true,
          conversation: true
        },
        orderBy: { timestamp: 'desc' },
        take: limit
      })
    })
  })

  describe('Threading Operations', () => {
    test('should create thread reply', async () => {
      const parentMessageId = 'msg1'
      const replyData = {
        text: 'Reply text',
        senderId: 'user2',
        conversationId: 'conv1'
      }
      const parentMessage = { id: parentMessageId, threadId: null }
      const savedReply = {
        id: 'msg2',
        ...replyData,
        threadId: parentMessageId,
        replyToId: parentMessageId
      }

      // Mock getMessageById and saveMessage
      dbService.getMessageById = jest.fn().mockResolvedValue(parentMessage)
      dbService.saveMessage = jest.fn().mockResolvedValue(savedReply)

      const result = await dbService.createThread(parentMessageId, replyData)

      expect(dbService.getMessageById).toHaveBeenCalledWith(parentMessageId)
      expect(dbService.saveMessage).toHaveBeenCalledWith({
        ...replyData,
        threadId: parentMessageId,
        replyToId: parentMessageId
      })
      expect(result).toEqual(savedReply)
    })
  })

  describe('Utility Operations', () => {
    test('should get conversation statistics', async () => {
      const conversationId = 'conv1'
      const messageCount = 25
      const participantCount = 3

      mockPrisma.message.count.mockResolvedValue(messageCount)
      mockPrisma.conversationParticipant.count.mockResolvedValue(participantCount)

      const result = await dbService.getConversationStats(conversationId)

      expect(mockPrisma.message.count).toHaveBeenCalledWith({
        where: { conversationId }
      })
      expect(mockPrisma.conversationParticipant.count).toHaveBeenCalledWith({
        where: { conversationId, leftAt: null }
      })
      expect(result).toEqual({ messageCount, participantCount })
    })
  })
})