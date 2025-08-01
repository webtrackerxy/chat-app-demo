const DatabaseService = require('../src/database/DatabaseService')

// Mock Prisma Client
const mockPrisma = {
  user: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  conversation: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  conversationParticipant: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
  },
  messageReaction: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  readReceipt: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  messageFile: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn((callback) => callback(mockPrisma)),
}

describe('Enhanced Messaging Features - Database Methods', () => {
  let dbService

  beforeEach(() => {
    jest.clearAllMocks()
    dbService = new DatabaseService()
    dbService.prisma = mockPrisma
  })

  describe('Phase 2: Private Messaging Database Methods', () => {
    test('getAllUsersForDirectMessages should exclude current user', async () => {
      const mockUsers = [
        { id: 'user2', username: 'bob', status: 'online', lastSeen: new Date() },
        { id: 'user3', username: 'charlie', status: 'offline', lastSeen: new Date() }
      ]

      mockPrisma.user.findMany.mockResolvedValue(mockUsers)

      const result = await dbService.getAllUsersForDirectMessages('user1')

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          id: { not: 'user1' }
        },
        select: {
          id: true,
          username: true,
          status: true,
          lastSeen: true
        },
        orderBy: { username: 'asc' }
      })
      expect(result).toEqual(mockUsers)
    })

    test('createDirectConversation should create conversation with two participants', async () => {
      const mockConversation = {
        id: 'conv1',
        type: 'direct',
        createdBy: 'user1',
        participants: [
          { userId: 'user1', user: { username: 'alice' } },
          { userId: 'user2', user: { username: 'bob' } }
        ]
      }

      // Mock finding no existing conversation
      mockPrisma.conversation.findMany.mockResolvedValue([])
      mockPrisma.conversation.create.mockResolvedValue({ id: 'conv1', type: 'direct' })
      mockPrisma.conversationParticipant.createMany.mockResolvedValue({})
      mockPrisma.conversation.findUnique.mockResolvedValue(mockConversation)

      const result = await dbService.createDirectConversation('user1', 'user2')

      expect(mockPrisma.conversation.create).toHaveBeenCalledWith({
        data: {
          type: 'direct',
          createdBy: 'user1'
        }
      })
      expect(mockPrisma.conversationParticipant.createMany).toHaveBeenCalledWith({
        data: [
          { conversationId: 'conv1', userId: 'user1' },
          { conversationId: 'conv1', userId: 'user2' }
        ]
      })
      expect(result).toEqual(mockConversation)
    })

    test('findDirectConversation should find existing conversation between two users', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          type: 'direct',
          participants: [
            { userId: 'user1', user: { username: 'alice' } },
            { userId: 'user2', user: { username: 'bob' } }
          ]
        }
      ]

      mockPrisma.conversation.findMany.mockResolvedValue(mockConversations)

      const result = await dbService.findDirectConversation('user1', 'user2')

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          type: 'direct',
          participants: {
            every: {
              userId: { in: ['user1', 'user2'] },
              leftAt: null
            }
          }
        },
        include: {
          participants: {
            include: { user: true }
          }
        }
      })
      expect(result).toEqual(mockConversations[0])
    })

    test('getDirectConversationsForUser should return only direct conversations', async () => {
      const mockConversations = [
        {
          id: 'conv1',
          type: 'direct',
          participants: [{ user: { username: 'bob' } }],
          messages: []
        }
      ]

      mockPrisma.conversation.findMany.mockResolvedValue(mockConversations)

      const result = await dbService.getDirectConversationsForUser('user1')

      expect(mockPrisma.conversation.findMany).toHaveBeenCalledWith({
        where: {
          type: 'direct',
          participants: {
            some: {
              userId: 'user1',
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
              sender: true
            }
          }
        },
        orderBy: { updatedAt: 'desc' }
      })
      expect(result).toEqual(mockConversations)
    })
  })

  describe('Phase 3: Message Threading Database Methods', () => {
    test('createThread should create reply with correct threadId and replyToId', async () => {
      const parentMessage = { 
        id: 'msg1', 
        threadId: null,
        sender: { username: 'alice' },
        files: [],
        reactions: [],
        readReceipts: []
      }
      const replyData = {
        text: 'This is a reply',
        senderId: 'user2',
        conversationId: 'conv1'
      }

      mockPrisma.message.findUnique.mockResolvedValue(parentMessage)
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg2',
        text: 'This is a reply',
        senderId: 'user2',
        conversationId: 'conv1',
        threadId: 'msg1',
        replyToId: 'msg1',
        timestamp: new Date(),
        sender: { username: 'bob' },
        files: [],
        reactions: [],
        readReceipts: []
      })
      mockPrisma.conversation.update.mockResolvedValue({})

      const result = await dbService.createThread('msg1', replyData)

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          ...replyData,
          threadId: 'msg1',
          replyToId: 'msg1',
          timestamp: expect.any(Date)
        },
        include: {
          sender: true,
          files: true,
          reactions: true,
          readReceipts: true
        }
      })
      expect(result.threadId).toBe('msg1')
      expect(result.replyToId).toBe('msg1')
    })

    test('getThread should return all messages in chronological order', async () => {
      const mockThreadMessages = [
        { id: 'msg1', text: 'Original', timestamp: new Date('2023-01-01') },
        { id: 'msg2', text: 'Reply 1', timestamp: new Date('2023-01-02') },
        { id: 'msg3', text: 'Reply 2', timestamp: new Date('2023-01-03') }
      ]

      mockPrisma.message.findMany.mockResolvedValue(mockThreadMessages)

      const result = await dbService.getThread('msg1')

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { id: 'msg1' },
            { threadId: 'msg1' }
          ]
        },
        include: {
          sender: true,
          files: true,
          reactions: true,
          readReceipts: true
        },
        orderBy: { timestamp: 'asc' }
      })
      expect(result).toEqual(mockThreadMessages)
    })
  })

  describe('Phase 4: Message Search Database Methods', () => {
    test('searchMessages should find messages containing query text', async () => {
      const mockSearchResults = [
        {
          id: 'msg1',
          text: 'Hello world',
          sender: { username: 'alice' },
          conversation: { name: 'General', type: 'group' }
        },
        {
          id: 'msg2',
          text: 'Hello universe',
          sender: { username: 'bob' },
          conversation: { name: 'Random', type: 'group' }
        }
      ]

      mockPrisma.message.findMany.mockResolvedValue(mockSearchResults)

      const result = await dbService.searchMessages('hello')

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: {
          text: {
            contains: 'hello',
            mode: 'insensitive'
          }
        },
        include: {
          sender: true,
          conversation: true
        },
        orderBy: { timestamp: 'desc' },
        take: 50
      })
      expect(result).toEqual(mockSearchResults)
    })

    test('searchMessages should filter by conversationId when provided', async () => {
      const mockSearchResults = [
        {
          id: 'msg1',
          text: 'Hello world',
          sender: { username: 'alice' },
          conversation: { name: 'General' }
        }
      ]

      mockPrisma.message.findMany.mockResolvedValue(mockSearchResults)

      const result = await dbService.searchMessages('hello', 'conv1', 10)

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith({
        where: {
          text: {
            contains: 'hello',
            mode: 'insensitive'
          },
          conversationId: 'conv1'
        },
        include: {
          sender: true,
          conversation: true
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      })
      expect(result).toEqual(mockSearchResults)
    })
  })

  describe('Integration scenarios', () => {
    test('should handle direct conversation workflow', async () => {
      // Test the complete workflow of creating a direct conversation
      
      // Step 1: Check if conversation exists (returns empty)
      mockPrisma.conversation.findMany.mockResolvedValueOnce([])
      
      // Step 2: Create new conversation
      mockPrisma.conversation.create.mockResolvedValueOnce({ id: 'conv1', type: 'direct' })
      mockPrisma.conversationParticipant.createMany.mockResolvedValueOnce({})
      mockPrisma.conversation.findUnique.mockResolvedValueOnce({
        id: 'conv1',
        type: 'direct',
        participants: [
          { userId: 'user1', user: { username: 'alice' } },
          { userId: 'user2', user: { username: 'bob' } }
        ]
      })

      const result = await dbService.createDirectConversation('user1', 'user2')

      expect(result.type).toBe('direct')
      expect(result.participants).toHaveLength(2)
    })

    test('should handle message threading workflow', async () => {
      // Test creating a thread reply and retrieving the thread
      
      // Mock parent message
      mockPrisma.message.findUnique.mockResolvedValueOnce({
        id: 'msg1',
        threadId: null
      })
      
      // Mock creating thread reply
      mockPrisma.message.create.mockResolvedValueOnce({
        id: 'msg2',
        threadId: 'msg1',
        replyToId: 'msg1',
        text: 'Reply',
        sender: { username: 'bob' },
        files: [],
        reactions: [],
        readReceipts: []
      })
      mockPrisma.conversation.update.mockResolvedValueOnce({})

      // Mock getting thread
      mockPrisma.message.findMany.mockResolvedValueOnce([
        { id: 'msg1', text: 'Original' },
        { id: 'msg2', text: 'Reply', threadId: 'msg1', replyToId: 'msg1' }
      ])

      // Create thread reply
      const reply = await dbService.createThread('msg1', {
        text: 'Reply',
        senderId: 'user2',
        conversationId: 'conv1'
      })

      // Get complete thread
      const thread = await dbService.getThread('msg1')

      expect(reply.threadId).toBe('msg1')
      expect(reply.replyToId).toBe('msg1')
      expect(thread).toHaveLength(2)
    })
  })
})