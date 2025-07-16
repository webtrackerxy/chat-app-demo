const { PrismaClient } = require('../../generated/prisma')

class DatabaseService {
  constructor() {
    this.prisma = new PrismaClient()
  }

  async connect() {
    try {
      await this.prisma.$connect()
      console.log('✅ Database connected successfully')
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      throw error
    }
  }

  async disconnect() {
    await this.prisma.$disconnect()
    console.log('🔌 Database disconnected')
  }

  // User operations
  async createUser(userData) {
    return await this.prisma.user.create({
      data: userData
    })
  }

  async getUserByUsername(username) {
    return await this.prisma.user.findUnique({
      where: { username }
    })
  }

  async getUserById(id) {
    return await this.prisma.user.findUnique({
      where: { id }
    })
  }

  async updateUserStatus(userId, status, lastSeen = new Date()) {
    return await this.prisma.user.update({
      where: { id: userId },
      data: { status, lastSeen }
    })
  }

  // Conversation operations
  async createConversation(conversationData, participantUserIds) {
    return await this.prisma.$transaction(async (prisma) => {
      // Create conversation
      const conversation = await prisma.conversation.create({
        data: conversationData
      })

      // Add participants
      if (participantUserIds && participantUserIds.length > 0) {
        await prisma.conversationParticipant.createMany({
          data: participantUserIds.map(userId => ({
            conversationId: conversation.id,
            userId
          }))
        })
      }

      return await prisma.conversation.findUnique({
        where: { id: conversation.id },
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
        }
      })
    })
  }

  async getConversationsForUser(userId) {
    return await this.prisma.conversation.findMany({
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
  }

  async getConversationById(conversationId) {
    return await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: { user: true }
        }
      }
    })
  }

  // Message operations
  async saveMessage(messageData) {
    const message = await this.prisma.message.create({
      data: {
        ...messageData,
        timestamp: new Date()
      },
      include: {
        sender: true,
        files: true,
        reactions: true,
        readReceipts: true
      }
    })

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: messageData.conversationId },
      data: { updatedAt: new Date() }
    })

    return message
  }

  async getMessages(conversationId, page = 1, limit = 50) {
    const skip = (page - 1) * limit

    return await this.prisma.message.findMany({
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
      skip,
      take: limit
    })
  }

  async getMessageById(messageId) {
    return await this.prisma.message.findUnique({
      where: { id: messageId },
      include: {
        sender: true,
        files: true,
        reactions: true,
        readReceipts: true,
        replyTo: {
          include: { sender: true }
        }
      }
    })
  }

  async deleteMessage(messageId) {
    return await this.prisma.message.delete({
      where: { id: messageId }
    })
  }

  // File operations
  async saveMessageFile(fileData) {
    return await this.prisma.messageFile.create({
      data: fileData
    })
  }

  async getMessageFiles(messageId) {
    return await this.prisma.messageFile.findMany({
      where: { messageId }
    })
  }

  // Reaction operations
  async toggleReaction(messageId, userId, emoji) {
    const existingReaction = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId: {
          messageId,
          userId
        }
      }
    })

    if (existingReaction) {
      if (existingReaction.emoji === emoji) {
        // Remove reaction if it's the same emoji
        await this.prisma.messageReaction.delete({
          where: { id: existingReaction.id }
        })
        return { action: 'removed', emoji }
      } else {
        // Update to new emoji
        const updated = await this.prisma.messageReaction.update({
          where: { id: existingReaction.id },
          data: { emoji }
        })
        return { action: 'updated', emoji: updated.emoji }
      }
    } else {
      // Create new reaction
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji }
      })
      return { action: 'added', emoji }
    }
  }

  async getMessageReactions(messageId) {
    return await this.prisma.messageReaction.findMany({
      where: { messageId }
    })
  }

  // Read receipt operations
  async markMessageAsRead(messageId, userId, userName) {
    return await this.prisma.readReceipt.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId
        }
      },
      update: { readAt: new Date() },
      create: {
        messageId,
        userId,
        userName,
        readAt: new Date()
      }
    })
  }

  async getReadReceipts(messageId) {
    return await this.prisma.readReceipt.findMany({
      where: { messageId }
    })
  }

  // Search operations (basic implementation)
  async searchMessages(query, conversationId = null, limit = 50) {
    const where = {
      text: {
        contains: query,
        mode: 'insensitive'
      }
    }

    if (conversationId) {
      where.conversationId = conversationId
    }

    return await this.prisma.message.findMany({
      where,
      include: {
        sender: true,
        conversation: true
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    })
  }

  // Threading operations (for future use)
  async createThread(parentMessageId, replyMessageData) {
    // Generate thread ID if it doesn't exist
    const parentMessage = await this.getMessageById(parentMessageId)
    const threadId = parentMessage.threadId || parentMessageId

    return await this.saveMessage({
      ...replyMessageData,
      threadId,
      replyToId: parentMessageId
    })
  }

  async getThread(threadId) {
    return await this.prisma.message.findMany({
      where: {
        OR: [
          { id: threadId },
          { threadId }
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
  }

  // Utility methods
  async getConversationParticipants(conversationId) {
    return await this.prisma.conversationParticipant.findMany({
      where: {
        conversationId,
        leftAt: null
      },
      include: { user: true }
    })
  }

  async addParticipantToConversation(conversationId, userId) {
    return await this.prisma.conversationParticipant.create({
      data: {
        conversationId,
        userId
      }
    })
  }

  async removeParticipantFromConversation(conversationId, userId) {
    return await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      },
      data: { leftAt: new Date() }
    })
  }

  // Get conversation statistics
  async getConversationStats(conversationId) {
    const messageCount = await this.prisma.message.count({
      where: { conversationId }
    })

    const participantCount = await this.prisma.conversationParticipant.count({
      where: { conversationId, leftAt: null }
    })

    return { messageCount, participantCount }
  }
}

module.exports = DatabaseService