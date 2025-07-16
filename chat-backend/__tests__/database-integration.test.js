const DatabaseService = require('../src/database/DatabaseService')
const { PrismaClient } = require('../generated/prisma')
const fs = require('fs')
const path = require('path')

// Test database file
const TEST_DB_PATH = path.join(__dirname, 'test.db')

describe('Database Integration Tests', () => {
  let dbService
  let testUsers = []
  let testConversations = []

  beforeAll(async () => {
    // Use a test database
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`
    
    dbService = new DatabaseService()
    await dbService.connect()
    
    // Clean up any existing test data
    await dbService.prisma.readReceipt.deleteMany()
    await dbService.prisma.messageReaction.deleteMany()
    await dbService.prisma.messageFile.deleteMany()
    await dbService.prisma.message.deleteMany()
    await dbService.prisma.conversationParticipant.deleteMany()
    await dbService.prisma.conversation.deleteMany()
    await dbService.prisma.user.deleteMany()
  })

  afterAll(async () => {
    await dbService.disconnect()
    
    // Clean up test database file
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH)
    }
  })

  beforeEach(async () => {
    // Clean up test data before each test
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

  describe('User Lifecycle', () => {
    test('should create, retrieve, and update users', async () => {
      // Create users
      const user1 = await dbService.createUser({
        username: 'alice',
        status: 'online'
      })
      const user2 = await dbService.createUser({
        username: 'bob',
        status: 'offline'
      })

      testUsers = [user1, user2]

      // Verify users were created
      expect(user1).toMatchObject({
        username: 'alice',
        status: 'online'
      })
      expect(user1.id).toBeDefined()
      expect(user1.createdAt).toBeDefined()

      // Retrieve user by username
      const retrievedUser = await dbService.getUserByUsername('alice')
      expect(retrievedUser.id).toBe(user1.id)
      expect(retrievedUser.username).toBe('alice')

      // Retrieve user by ID
      const userById = await dbService.getUserById(user1.id)
      expect(userById.username).toBe('alice')

      // Update user status
      const updatedUser = await dbService.updateUserStatus(user1.id, 'away')
      expect(updatedUser.status).toBe('away')

      // Verify update persisted
      const verifyUpdate = await dbService.getUserById(user1.id)
      expect(verifyUpdate.status).toBe('away')
    })
  })

  describe('Conversation Management', () => {
    test('should create conversations with participants', async () => {
      // Create test users first
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      const user3 = await dbService.createUser({ username: 'charlie' })
      testUsers = [user1, user2, user3]

      // Create a group conversation
      const groupConv = await dbService.createConversation(
        {
          name: 'Test Group',
          type: 'group',
          createdBy: user1.id
        },
        [user1.id, user2.id, user3.id]
      )

      testConversations = [groupConv]

      expect(groupConv).toMatchObject({
        name: 'Test Group',
        type: 'group',
        createdBy: user1.id
      })
      expect(groupConv.participants).toHaveLength(3)
      expect(groupConv.participants.map(p => p.user.username)).toContain('alice')
      expect(groupConv.participants.map(p => p.user.username)).toContain('bob')
      expect(groupConv.participants.map(p => p.user.username)).toContain('charlie')

      // Create a direct conversation
      const directConv = await dbService.createConversation(
        {
          type: 'direct',
          createdBy: user1.id
        },
        [user1.id, user2.id]
      )

      testConversations.push(directConv)

      expect(directConv.type).toBe('direct')
      expect(directConv.participants).toHaveLength(2)
    })

    test('should retrieve conversations for specific user', async () => {
      // Create test users
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      const user3 = await dbService.createUser({ username: 'charlie' })
      testUsers = [user1, user2, user3]

      // Create conversations
      const conv1 = await dbService.createConversation(
        { name: 'Alice & Bob', type: 'direct' },
        [user1.id, user2.id]
      )
      const conv2 = await dbService.createConversation(
        { name: 'Group Chat', type: 'group' },
        [user1.id, user2.id, user3.id]
      )
      const conv3 = await dbService.createConversation(
        { name: 'Bob & Charlie', type: 'direct' },
        [user2.id, user3.id]
      )

      testConversations = [conv1, conv2, conv3]

      // Get conversations for alice (should be in conv1 and conv2)
      const aliceConversations = await dbService.getConversationsForUser(user1.id)
      expect(aliceConversations).toHaveLength(2)
      
      const convIds = aliceConversations.map(c => c.id)
      expect(convIds).toContain(conv1.id)
      expect(convIds).toContain(conv2.id)
      expect(convIds).not.toContain(conv3.id)

      // Get conversations for bob (should be in all three)
      const bobConversations = await dbService.getConversationsForUser(user2.id)
      expect(bobConversations).toHaveLength(3)
    })
  })

  describe('Message Persistence and Retrieval', () => {
    test('should save and retrieve messages with pagination', async () => {
      // Setup users and conversation
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      const conversation = await dbService.createConversation(
        { name: 'Test Chat', type: 'group' },
        [user1.id, user2.id]
      )
      testConversations = [conversation]

      // Create multiple messages
      const messages = []
      for (let i = 1; i <= 25; i++) {
        const message = await dbService.saveMessage({
          text: `Message ${i}`,
          senderId: i % 2 === 0 ? user1.id : user2.id,
          conversationId: conversation.id
        })
        messages.push(message)
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      // Test pagination
      const page1 = await dbService.getMessages(conversation.id, 1, 10)
      expect(page1).toHaveLength(10)
      
      // Messages should be ordered by timestamp desc (newest first)
      expect(page1[0].text).toBe('Message 25')
      expect(page1[9].text).toBe('Message 16')

      const page2 = await dbService.getMessages(conversation.id, 2, 10)
      expect(page2).toHaveLength(10)
      expect(page2[0].text).toBe('Message 15')
      expect(page2[9].text).toBe('Message 6')

      const page3 = await dbService.getMessages(conversation.id, 3, 10)
      expect(page3).toHaveLength(5) // Remaining messages
      expect(page3[0].text).toBe('Message 5')
      expect(page3[4].text).toBe('Message 1')
    })

    test('should handle message deletion', async () => {
      // Setup
      const user1 = await dbService.createUser({ username: 'alice' })
      testUsers = [user1]

      const conversation = await dbService.createConversation(
        { name: 'Test Chat', type: 'group' },
        [user1.id]
      )
      testConversations = [conversation]

      // Create a message
      const message = await dbService.saveMessage({
        text: 'Message to delete',
        senderId: user1.id,
        conversationId: conversation.id
      })

      // Verify message exists
      const retrievedMessage = await dbService.getMessageById(message.id)
      expect(retrievedMessage.text).toBe('Message to delete')

      // Delete message
      await dbService.deleteMessage(message.id)

      // Verify message is deleted
      const deletedMessage = await dbService.getMessageById(message.id)
      expect(deletedMessage).toBe(null)
    })
  })

  describe('Message Reactions', () => {
    test('should handle reaction lifecycle', async () => {
      // Setup
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      const conversation = await dbService.createConversation(
        { name: 'Test Chat', type: 'group' },
        [user1.id, user2.id]
      )
      testConversations = [conversation]

      const message = await dbService.saveMessage({
        text: 'React to this message',
        senderId: user1.id,
        conversationId: conversation.id
      })

      // Add reaction
      const addResult = await dbService.toggleReaction(message.id, user2.id, '👍')
      expect(addResult).toEqual({ action: 'added', emoji: '👍' })

      // Verify reaction exists
      const reactions = await dbService.getMessageReactions(message.id)
      expect(reactions).toHaveLength(1)
      expect(reactions[0]).toMatchObject({
        messageId: message.id,
        userId: user2.id,
        emoji: '👍'
      })

      // Toggle same reaction (should remove)
      const removeResult = await dbService.toggleReaction(message.id, user2.id, '👍')
      expect(removeResult).toEqual({ action: 'removed', emoji: '👍' })

      // Verify reaction removed
      const reactionsAfterRemove = await dbService.getMessageReactions(message.id)
      expect(reactionsAfterRemove).toHaveLength(0)

      // Add different reaction
      await dbService.toggleReaction(message.id, user2.id, '❤️')
      
      // Change to different emoji
      const updateResult = await dbService.toggleReaction(message.id, user2.id, '😂')
      expect(updateResult).toEqual({ action: 'updated', emoji: '😂' })

      // Verify updated reaction
      const finalReactions = await dbService.getMessageReactions(message.id)
      expect(finalReactions).toHaveLength(1)
      expect(finalReactions[0].emoji).toBe('😂')
    })
  })

  describe('Read Receipts', () => {
    test('should handle read receipts', async () => {
      // Setup
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      const user3 = await dbService.createUser({ username: 'charlie' })
      testUsers = [user1, user2, user3]

      const conversation = await dbService.createConversation(
        { name: 'Test Chat', type: 'group' },
        [user1.id, user2.id, user3.id]
      )
      testConversations = [conversation]

      const message = await dbService.saveMessage({
        text: 'Message to read',
        senderId: user1.id,
        conversationId: conversation.id
      })

      // Mark as read by different users
      await dbService.markMessageAsRead(message.id, user2.id, 'bob')
      await dbService.markMessageAsRead(message.id, user3.id, 'charlie')

      // Verify read receipts
      const readReceipts = await dbService.getReadReceipts(message.id)
      expect(readReceipts).toHaveLength(2)
      
      const userNames = readReceipts.map(r => r.userName)
      expect(userNames).toContain('bob')
      expect(userNames).toContain('charlie')

      // Mark as read again by same user (should update timestamp)
      const firstReadTime = readReceipts.find(r => r.userName === 'bob').readAt
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 100))
      
      await dbService.markMessageAsRead(message.id, user2.id, 'bob')
      
      const updatedReceipts = await dbService.getReadReceipts(message.id)
      expect(updatedReceipts).toHaveLength(2) // Still 2, not 3
      
      const updatedBobReceipt = updatedReceipts.find(r => r.userName === 'bob')
      expect(new Date(updatedBobReceipt.readAt).getTime()).toBeGreaterThan(new Date(firstReadTime).getTime())
    })
  })

  describe('Message Search', () => {
    test('should search messages across conversations', async () => {
      // Setup
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      const conv1 = await dbService.createConversation(
        { name: 'Chat 1', type: 'group' },
        [user1.id, user2.id]
      )
      const conv2 = await dbService.createConversation(
        { name: 'Chat 2', type: 'group' },
        [user1.id, user2.id]
      )
      testConversations = [conv1, conv2]

      // Create messages with searchable content
      await dbService.saveMessage({
        text: 'Hello world from chat 1',
        senderId: user1.id,
        conversationId: conv1.id
      })
      await dbService.saveMessage({
        text: 'Hello universe from chat 2',
        senderId: user2.id,
        conversationId: conv2.id
      })
      await dbService.saveMessage({
        text: 'Goodbye world',
        senderId: user1.id,
        conversationId: conv1.id
      })

      // Search for "hello" across all conversations
      const helloResults = await dbService.searchMessages('hello')
      expect(helloResults).toHaveLength(2)
      
      const texts = helloResults.map(r => r.text)
      expect(texts).toContain('Hello world from chat 1')
      expect(texts).toContain('Hello universe from chat 2')

      // Search for "world" in specific conversation
      const worldInConv1 = await dbService.searchMessages('world', conv1.id)
      expect(worldInConv1).toHaveLength(2)
      expect(worldInConv1.map(r => r.text)).toContain('Hello world from chat 1')
      expect(worldInConv1.map(r => r.text)).toContain('Goodbye world')

      // Search with no results
      const noResults = await dbService.searchMessages('nonexistent')
      expect(noResults).toHaveLength(0)
    })
  })

  describe('Threading (Prepared for Future)', () => {
    test('should create threaded messages', async () => {
      // Setup
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      testUsers = [user1, user2]

      const conversation = await dbService.createConversation(
        { name: 'Test Chat', type: 'group' },
        [user1.id, user2.id]
      )
      testConversations = [conversation]

      // Create parent message
      const parentMessage = await dbService.saveMessage({
        text: 'Parent message',
        senderId: user1.id,
        conversationId: conversation.id
      })

      // Create thread reply
      const replyMessage = await dbService.createThread(parentMessage.id, {
        text: 'Reply to parent',
        senderId: user2.id,
        conversationId: conversation.id
      })

      expect(replyMessage.replyToId).toBe(parentMessage.id)
      expect(replyMessage.threadId).toBe(parentMessage.id)

      // Get thread messages
      const threadMessages = await dbService.getThread(parentMessage.id)
      expect(threadMessages).toHaveLength(2)
      expect(threadMessages[0].id).toBe(parentMessage.id)
      expect(threadMessages[1].id).toBe(replyMessage.id)
    })
  })

  describe('Conversation Statistics', () => {
    test('should provide accurate conversation statistics', async () => {
      // Setup
      const user1 = await dbService.createUser({ username: 'alice' })
      const user2 = await dbService.createUser({ username: 'bob' })
      const user3 = await dbService.createUser({ username: 'charlie' })
      testUsers = [user1, user2, user3]

      const conversation = await dbService.createConversation(
        { name: 'Test Chat', type: 'group' },
        [user1.id, user2.id, user3.id]
      )
      testConversations = [conversation]

      // Create some messages
      for (let i = 0; i < 5; i++) {
        await dbService.saveMessage({
          text: `Message ${i + 1}`,
          senderId: user1.id,
          conversationId: conversation.id
        })
      }

      // Get statistics
      const stats = await dbService.getConversationStats(conversation.id)
      expect(stats.messageCount).toBe(5)
      expect(stats.participantCount).toBe(3)

      // Remove a participant
      await dbService.removeParticipantFromConversation(conversation.id, user3.id)

      // Check updated statistics
      const updatedStats = await dbService.getConversationStats(conversation.id)
      expect(updatedStats.messageCount).toBe(5) // Messages unchanged
      expect(updatedStats.participantCount).toBe(2) // One less participant
    })
  })
})