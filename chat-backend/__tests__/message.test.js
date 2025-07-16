const request = require('supertest')
const express = require('express')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')

const createTestApp = () => {
  const app = express()
  app.use(cors())
  app.use(express.json())

  let conversations = [
    {
      id: 'test-conv-1',
      title: 'Test Conversation',
      participants: ['user1', 'user2'],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ]

  let messages = []

  app.get('/api/conversations/:id/messages', (req, res) => {
    const { id } = req.params
    const conversationMessages = messages
      .filter((msg) => msg.conversationId === id)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

    res.json({ success: true, data: conversationMessages })
  })

  app.post('/api/messages', (req, res) => {
    const { text, conversationId, senderId, senderName } = req.body

    if (!text || !conversationId || !senderId || !senderName) {
      return res.status(400).json({
        success: false,
        error: 'Text, conversationId, senderId, and senderName are required',
      })
    }

    const conversation = conversations.find((c) => c.id === conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      })
    }

    const newMessage = {
      id: uuidv4(),
      text,
      senderId,
      senderName,
      timestamp: new Date(),
      conversationId,
    }

    messages.push(newMessage)
    conversation.updatedAt = new Date()

    res.json({ success: true, data: newMessage })
  })

  return app
}

describe('Message Handling', () => {
  let app

  beforeEach(() => {
    app = createTestApp()
  })

  describe('Message Creation', () => {
    it('should create message with all required fields', async () => {
      const messageData = {
        text: 'Hello, world!',
        conversationId: 'test-conv-1',
        senderId: 'user1',
        senderName: 'Alice',
      }

      const response = await request(app).post('/api/messages').send(messageData).expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.text).toBe(messageData.text)
      expect(response.body.data.conversationId).toBe(messageData.conversationId)
      expect(response.body.data.senderId).toBe(messageData.senderId)
      expect(response.body.data.senderName).toBe(messageData.senderName)
      expect(response.body.data.id).toBeDefined()
      expect(new Date(response.body.data.timestamp)).toBeInstanceOf(Date)
    })

    it('should generate unique message IDs', async () => {
      const messageData1 = {
        text: 'Message 1',
        conversationId: 'test-conv-1',
        senderId: 'user1',
        senderName: 'Alice',
      }

      const messageData2 = {
        text: 'Message 2',
        conversationId: 'test-conv-1',
        senderId: 'user2',
        senderName: 'Bob',
      }

      const response1 = await request(app).post('/api/messages').send(messageData1).expect(200)

      const response2 = await request(app).post('/api/messages').send(messageData2).expect(200)

      expect(response1.body.data.id).not.toBe(response2.body.data.id)
    })

    it('should handle long text messages', async () => {
      const longText = 'A'.repeat(1000)
      const messageData = {
        text: longText,
        conversationId: 'test-conv-1',
        senderId: 'user1',
        senderName: 'Alice',
      }

      const response = await request(app).post('/api/messages').send(messageData).expect(200)

      expect(response.body.data.text).toBe(longText)
    })

    it('should handle special characters in text', async () => {
      const specialText = '🚀 Hello! @user #hashtag $special %chars &symbols *asterisks'
      const messageData = {
        text: specialText,
        conversationId: 'test-conv-1',
        senderId: 'user1',
        senderName: 'Alice',
      }

      const response = await request(app).post('/api/messages').send(messageData).expect(200)

      expect(response.body.data.text).toBe(specialText)
    })
  })

  describe('Message Validation', () => {
    it('should reject message without text', async () => {
      const messageData = {
        conversationId: 'test-conv-1',
        senderId: 'user1',
        senderName: 'Alice',
      }

      const response = await request(app).post('/api/messages').send(messageData).expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('required')
    })

    it('should reject message without conversationId', async () => {
      const messageData = {
        text: 'Hello',
        senderId: 'user1',
        senderName: 'Alice',
      }

      const response = await request(app).post('/api/messages').send(messageData).expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('required')
    })

    it('should reject message without senderId', async () => {
      const messageData = {
        text: 'Hello',
        conversationId: 'test-conv-1',
        senderName: 'Alice',
      }

      const response = await request(app).post('/api/messages').send(messageData).expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('required')
    })

    it('should reject message without senderName', async () => {
      const messageData = {
        text: 'Hello',
        conversationId: 'test-conv-1',
        senderId: 'user1',
      }

      const response = await request(app).post('/api/messages').send(messageData).expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('required')
    })

    it('should reject empty text', async () => {
      const messageData = {
        text: '',
        conversationId: 'test-conv-1',
        senderId: 'user1',
        senderName: 'Alice',
      }

      const response = await request(app).post('/api/messages').send(messageData).expect(400)

      expect(response.body.success).toBe(false)
    })

    it('should reject message for non-existent conversation', async () => {
      const messageData = {
        text: 'Hello',
        conversationId: 'non-existent-conv',
        senderId: 'user1',
        senderName: 'Alice',
      }

      const response = await request(app).post('/api/messages').send(messageData).expect(404)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Conversation not found')
    })
  })

  describe('Message Retrieval', () => {
    beforeEach(async () => {
      // Add test messages
      const messages = [
        {
          text: 'First message',
          conversationId: 'test-conv-1',
          senderId: 'user1',
          senderName: 'Alice',
        },
        {
          text: 'Second message',
          conversationId: 'test-conv-1',
          senderId: 'user2',
          senderName: 'Bob',
        },
        {
          text: 'Third message',
          conversationId: 'test-conv-1',
          senderId: 'user1',
          senderName: 'Alice',
        },
      ]

      for (const msg of messages) {
        await request(app).post('/api/messages').send(msg).expect(200)

        // Small delay to ensure timestamp ordering
        await new Promise((resolve) => setTimeout(resolve, 1))
      }
    })

    it('should retrieve all messages for a conversation', async () => {
      const response = await request(app).get('/api/conversations/test-conv-1/messages').expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveLength(3)
      expect(response.body.data[0].text).toBe('First message')
      expect(response.body.data[1].text).toBe('Second message')
      expect(response.body.data[2].text).toBe('Third message')
    })

    it('should return messages in chronological order (oldest first)', async () => {
      const response = await request(app).get('/api/conversations/test-conv-1/messages').expect(200)

      const timestamps = response.body.data.map((msg) => new Date(msg.timestamp))

      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i].getTime()).toBeGreaterThanOrEqual(timestamps[i - 1].getTime())
      }
    })

    it('should return empty array for conversation with no messages', async () => {
      const response = await request(app).get('/api/conversations/empty-conv/messages').expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toEqual([])
    })

    it('should include all message properties', async () => {
      const response = await request(app).get('/api/conversations/test-conv-1/messages').expect(200)

      const message = response.body.data[0]
      expect(message).toHaveProperty('id')
      expect(message).toHaveProperty('text')
      expect(message).toHaveProperty('senderId')
      expect(message).toHaveProperty('senderName')
      expect(message).toHaveProperty('timestamp')
      expect(message).toHaveProperty('conversationId')
    })
  })

  describe('Message Ordering and Timestamps', () => {
    it('should maintain correct timestamp ordering with rapid message posting', async () => {
      const messages = []
      const messageTexts = ['Msg1', 'Msg2', 'Msg3', 'Msg4', 'Msg5']

      // Post messages rapidly
      for (const text of messageTexts) {
        const response = await request(app)
          .post('/api/messages')
          .send({
            text,
            conversationId: 'test-conv-1',
            senderId: 'user1',
            senderName: 'Alice',
          })
          .expect(200)

        messages.push(response.body.data)
      }

      // Retrieve messages
      const response = await request(app).get('/api/conversations/test-conv-1/messages').expect(200)

      const retrievedMessages = response.body.data

      // Check that messages are in the correct order
      for (let i = 0; i < messageTexts.length; i++) {
        expect(retrievedMessages[i].text).toBe(messageTexts[i])
      }
    })

    it('should assign timestamps correctly', async () => {
      const beforeTime = new Date()

      const response = await request(app)
        .post('/api/messages')
        .send({
          text: 'Timestamp test',
          conversationId: 'test-conv-1',
          senderId: 'user1',
          senderName: 'Alice',
        })
        .expect(200)

      const afterTime = new Date()
      const messageTime = new Date(response.body.data.timestamp)

      expect(messageTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime())
      expect(messageTime.getTime()).toBeLessThanOrEqual(afterTime.getTime())
    })
  })
})
