const { Server } = require('socket.io')
const { createServer } = require('http')
const Client = require('socket.io-client')

describe('Enhanced Features Simple Tests', () => {
  let httpServer
  let io
  let clientSocket

  beforeEach((done) => {
    httpServer = createServer()
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    })

    httpServer.listen(() => {
      const port = httpServer.address().port
      clientSocket = new Client(`http://localhost:${port}`, {
        forceNew: true,
        timeout: 2000,
      })

      // Simple mock data
      const conversations = [
        {
          id: 'test-conversation',
          messages: [
            {
              id: 'test-message-1',
              text: 'Test message 1',
              senderId: 'user1',
              senderName: 'User One',
              timestamp: new Date(),
              readBy: [],
              reactions: [],
            },
          ],
        },
      ]

      io.on('connection', (socket) => {
        // Simple handlers that just acknowledge receipt
        socket.on('mark_message_read', (data) => {
          const { messageId, conversationId, userId, userName } = data

          const conversation = conversations.find((conv) => conv.id === conversationId)
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' })
            return
          }

          const message = conversation.messages.find((msg) => msg.id === messageId)
          if (!message) {
            socket.emit('error', { message: 'Message not found' })
            return
          }

          // Add read receipt
          const readReceipt = {
            userId,
            userName,
            readAt: new Date(),
          }

          message.readBy.push(readReceipt)

          socket.emit('message_read', {
            messageId,
            readReceipt,
          })
        })

        socket.on('add_reaction', (data) => {
          const { messageId, conversationId, userId, userName, emoji } = data

          const conversation = conversations.find((conv) => conv.id === conversationId)
          if (!conversation) {
            socket.emit('error', { message: 'Conversation not found' })
            return
          }

          const message = conversation.messages.find((msg) => msg.id === messageId)
          if (!message) {
            socket.emit('error', { message: 'Message not found' })
            return
          }

          const reaction = {
            id: `reaction-${Date.now()}`,
            userId,
            userName,
            emoji,
            timestamp: new Date(),
          }

          message.reactions.push(reaction)

          socket.emit('reaction_added', {
            messageId,
            reaction,
          })
        })

        socket.on('user_online', (data) => {
          const { userId, userName } = data
          socket.emit('user_presence_update', {
            userId,
            userName,
            isOnline: true,
          })
        })
      })

      clientSocket.on('connect', done)
      clientSocket.on('connect_error', done)
    })
  })

  afterEach((done) => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect()
    }
    if (io) {
      io.close()
    }
    if (httpServer) {
      httpServer.close(done)
    } else {
      done()
    }
  })

  describe('Read Receipts', () => {
    it('should mark message as read and emit read receipt', (done) => {
      const testData = {
        messageId: 'test-message-1',
        conversationId: 'test-conversation',
        userId: 'test-user-1',
        userName: 'Test User 1',
      }

      clientSocket.on('message_read', (data) => {
        expect(data.messageId).toBe(testData.messageId)
        expect(data.readReceipt.userId).toBe(testData.userId)
        expect(data.readReceipt.userName).toBe(testData.userName)
        expect(data.readReceipt.readAt).toBeDefined()
        done()
      })

      setTimeout(() => {
        clientSocket.emit('mark_message_read', testData)
      }, 100)
    })
  })

  describe('Message Reactions', () => {
    it('should add reaction and emit reaction_added event', (done) => {
      const testData = {
        messageId: 'test-message-1',
        conversationId: 'test-conversation',
        userId: 'test-user-1',
        userName: 'Test User 1',
        emoji: '👍',
      }

      clientSocket.on('reaction_added', (data) => {
        expect(data.messageId).toBe(testData.messageId)
        expect(data.reaction.userId).toBe(testData.userId)
        expect(data.reaction.userName).toBe(testData.userName)
        expect(data.reaction.emoji).toBe(testData.emoji)
        expect(data.reaction.id).toBeDefined()
        expect(data.reaction.timestamp).toBeDefined()
        done()
      })

      setTimeout(() => {
        clientSocket.emit('add_reaction', testData)
      }, 100)
    })
  })

  describe('User Presence', () => {
    it('should emit user_online event and receive presence update', (done) => {
      const testData = {
        userId: 'test-user-1',
        userName: 'Test User 1',
      }

      clientSocket.on('user_presence_update', (data) => {
        expect(data.userId).toBe(testData.userId)
        expect(data.userName).toBe(testData.userName)
        expect(data.isOnline).toBe(true)
        done()
      })

      setTimeout(() => {
        clientSocket.emit('user_online', testData)
      }, 100)
    })
  })

  describe('Error Handling', () => {
    it('should handle read receipt for non-existent message', (done) => {
      const testData = {
        messageId: 'non-existent-message',
        conversationId: 'test-conversation',
        userId: 'test-user-1',
        userName: 'Test User 1',
      }

      clientSocket.on('error', (data) => {
        expect(data.message).toBe('Message not found')
        done()
      })

      setTimeout(() => {
        clientSocket.emit('mark_message_read', testData)
      }, 100)
    })

    it('should handle reaction for non-existent conversation', (done) => {
      const testData = {
        messageId: 'test-message-1',
        conversationId: 'non-existent-conversation',
        userId: 'test-user-1',
        userName: 'Test User 1',
        emoji: '👍',
      }

      clientSocket.on('error', (data) => {
        expect(data.message).toBe('Conversation not found')
        done()
      })

      setTimeout(() => {
        clientSocket.emit('add_reaction', testData)
      }, 100)
    })
  })
})
