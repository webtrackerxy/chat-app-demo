// Load environment variables
require('dotenv').config()

const express = require('express')
const cors = require('cors')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs')
const path = require('path')
const { Server } = require('socket.io')
const http = require('http')
const multer = require('multer')
const DatabaseService = require('./src/database/DatabaseService')
const EncryptionService = require('./src/services/EncryptionService')
const ratchetRoutes = require('./routes/ratchet')
const encryptionRoutes = require('./routes/encryption')
const productionEncryptionRoutes = require('./routes/production-encryption')

const app = express()
const PORT = process.env.PORT || 3000
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads'
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*'
const server = http.createServer(app)

// Initialize database service
const db = new DatabaseService()

// Initialize encryption service
const encryptionService = new EncryptionService()

// Setup log file - clear on server start
const logFile = path.join(__dirname, 'server.log')
fs.writeFileSync(logFile, '') // Clear log file on start

const logToFile = (message) => {
  const timestamp = new Date().toISOString()
  const logEntry = `[${timestamp}] ${message}\n`
  fs.appendFileSync(logFile, logEntry)
}

app.use(
  cors({
    origin: CORS_ORIGIN,
  }),
)
app.use(express.json())

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, UPLOAD_DIR)
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const fileExtension = path.extname(file.originalname)
    cb(null, `${file.fieldname}-${uniqueSuffix}${fileExtension}`)
  },
})

const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    'audio/mpeg': true,
    'audio/wav': true,
    'audio/ogg': true,
    'audio/webm': true,
    'audio/m4a': true,
    'audio/mp4': true,
    'video/mp4': true,
    'video/quicktime': true,
    'video/mpeg': true,
    'video/webm': true,
    'video/avi': true,
    'video/mov': true,
    'video/x-msvideo': true,
    'application/pdf': true,
    'text/plain': true,
    'text/markdown': true,
    'application/octet-stream': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'application/vnd.ms-excel': true,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
  }

  if (allowedTypes[file.mimetype]) {
    cb(null, true)
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false)
  }
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1, // Maximum 1 file per request
  },
})

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, UPLOAD_DIR)))

// Simple request logging middleware - runs after route matching
app.use((req, res, next) => {
  // Override res.json to log when response is sent (after route processing)
  const originalJson = res.json
  res.json = function (data) {
    const action = `${req.method} ${req.route ? req.route.path : req.path}`
    const requestData = {
      body: req.body,
      query: req.query,
      params: req.params,
    }

    const logMessage = `Action: ${action}`
    const logData = `Data: ${JSON.stringify(requestData, null, 2)}`
    const logConversations = `Conversations: ${JSON.stringify(conversations, null, 2)}`

    console.log(logMessage)
    console.log(logData)
    console.log(logConversations)

    // Also log to file
    logToFile(logMessage)
    logToFile(logData)
    logToFile(logConversations)
    logToFile('---')

    return originalJson.call(this, data)
  }

  next()
})

// Simulated delay middleware
const simulateDelay = (req, res, next) => {
  const delay = Math.random() * 1000 + 500 // 500-1500ms delay
  setTimeout(next, delay)
}

app.use(simulateDelay)

// In-memory fake database - conversations contain messages
let conversations = [
  {
    id: 'general',
    title: 'General',
    participants: [],
    createdAt: new Date('2024-01-01T09:00:00'),
    updatedAt: new Date('2024-01-01T10:01:00'),
    messages: [
      {
        id: '1',
        text: 'Welcome to the General conversation! 🎉',
        senderId: 'system',
        senderName: 'System',
        timestamp: new Date('2024-01-01T10:00:00'),
      },
      {
        id: '2',
        text: 'Hello everyone!',
        senderId: 'user1',
        senderName: 'Alice',
        timestamp: new Date('2024-01-01T10:01:00'),
      },
    ],
  },
  {
    id: 'tech-talk',
    title: 'Tech Talk',
    participants: ['user1', 'user2'],
    createdAt: new Date('2024-01-01T09:30:00'),
    updatedAt: new Date('2024-01-01T10:30:00'),
    messages: [
      {
        id: '3',
        text: "Let's discuss the latest in tech!",
        senderId: 'user2',
        senderName: 'Bob',
        timestamp: new Date('2024-01-01T10:30:00'),
      },
    ],
  },
]

// In-memory user presence tracking
let userPresence = new Map() // userId -> { userId, userName, isOnline, lastSeen, socketId }

// Helper function to update message with read receipts and reactions
const initializeMessageExtras = (message) => {
  if (!message.readBy) message.readBy = []
  if (!message.reactions) message.reactions = []
  return message
}

// Initialize existing messages with new structure
conversations.forEach((conv) => {
  conv.messages.forEach((msg) => initializeMessageExtras(msg))
})

// Routes
// Conversation management routes
app.get('/api/conversations', async (req, res) => {
  try {
    const { userId } = req.query
    
    if (!userId) {
      // Fallback to in-memory for backward compatibility
      const conversationsWithLastMessage = conversations.map((conv) => {
        const lastMessage =
          conv.messages.length > 0
            ? conv.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
            : null

        return {
          ...conv,
          lastMessage: lastMessage || null,
        }
      })

      return res.json({
        success: true,
        data: conversationsWithLastMessage,
      })
    }

    // Use database for user-specific conversations
    const userConversations = await db.getConversationsForUser(userId)
    
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
        timestamp: conv.messages[0].timestamp
      } : null
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

// Get messages from a conversation with pagination
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params
    const { page = 1, limit = 50 } = req.query

    // Check in-memory storage first (where messages are actually stored)
    const conversation = conversations.find((conv) => conv.id === id)

    if (conversation && conversation.messages.length > 0) {
      // Return messages sorted by timestamp
      const sortedMessages = conversation.messages.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      )

      return res.json({
        success: true,
        data: sortedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: false
        }
      })
    }

    // Try database as fallback
    try {
      const messages = await db.getMessages(id, parseInt(page), parseInt(limit))
      
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
          size: msg.files[0].size
        } : null,
        reactions: msg.reactions.map(r => ({
          emoji: r.emoji,
          userId: r.userId
        })),
        readBy: msg.readReceipts.map(r => ({
          userId: r.userId,
          userName: r.userName,
          readAt: r.readAt
        }))
      })).reverse() // Reverse to match expected order

      return res.json({
        success: true,
        data: formattedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          hasMore: messages.length === parseInt(limit)
        }
      })
    } catch (dbError) {
      console.log('Database query failed:', dbError.message)
    }

    // If conversation not found in both storage systems
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      })
    }

    // If conversation exists but has no messages
    res.json({
      success: true,
      data: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: false
      }
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages',
    })
  }
})

// Add conversation endpoint
app.post('/api/conversations', async (req, res) => {
  try {
    const { name, type = 'group', createdBy, participants = [] } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Conversation name is required'
      })
    }

    // Create conversation in database
    const conversationData = {
      name,
      type,
      createdBy: createdBy || null
    }

    const conversation = await db.createConversation(conversationData, participants)
    
    // Also add to in-memory for backward compatibility
    const memoryConversation = {
      id: conversation.id,
      title: conversation.name,
      participants: conversation.participants?.map(p => p.user.username) || [],
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: []
    }
    conversations.push(memoryConversation)

    res.json({
      success: true,
      data: {
        id: conversation.id,
        name: conversation.name,
        type: conversation.type,
        participants: conversation.participants?.map(p => p.user.username) || [],
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messages: []
      }
    })
  } catch (error) {
    console.error('Error creating conversation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation',
    })
  }
})
// Add message to conversation endpoint
app.post('/api/messages', async (req, res) => {
  try {
    const { text, senderId, senderName, conversationId, encrypted = false, encryptionKeyId } = req.body

    // Validate required fields
    if (!text || !senderId || !conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Text, senderId, and conversationId are required',
      })
    }

    // Check if conversation exists in database
    const dbConversation = await db.getConversationById(conversationId)
    if (!dbConversation) {
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
      type: 'text', // Default message type
      file: null, // File attachment (if any)
      encrypted: encrypted,
      encryptionKeyId: encryptionKeyId || null
    }

    try {
      // Save message to database first
      const savedMessage = await db.saveMessage({
        id: newMessage.id,
        text: text,
        senderId: senderId,
        conversationId: conversationId,
        encrypted: encrypted,
        encryptionKey: encryptionKeyId || null
      })

      console.log('Message saved to database:', savedMessage.id)
      
      // Also keep in memory for backward compatibility with existing hardcoded conversations
      const conversation = conversations.find((conv) => conv.id === conversationId)
      if (conversation) {
        conversation.messages.push(newMessage)
        conversation.updatedAt = new Date()
      }

      // Return formatted message
      res.json({
        success: true,
        data: {
          id: savedMessage.id,
          text: savedMessage.text,
          senderId: savedMessage.senderId,
          senderName: savedMessage.sender.username,
          timestamp: savedMessage.timestamp,
          encrypted: savedMessage.encrypted,
          encryptionKeyId: savedMessage.encryptionKey
        },
      })
    } catch (dbError) {
      console.error('Error storing message in database:', dbError)
      
      // Fallback to in-memory only if database fails
      const conversation = conversations.find((conv) => conv.id === conversationId)
      if (conversation) {
        conversation.messages.push(newMessage)
        conversation.updatedAt = new Date()
        
        res.json({
          success: true,
          data: newMessage,
        })
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to save message',
        })
      }
    }
  } catch (error) {
    console.error('Error sending message:', error)

    res.status(500).json({
      success: false,
      error: 'Failed to send message',
    })
  }
})

// Delete message endpoint
app.delete('/api/messages/:messageId', (req, res) => {
  try {
    const { messageId } = req.params

    // Find the conversation containing the message
    let foundConversation = null
    let messageIndex = -1

    for (const conversation of conversations) {
      messageIndex = conversation.messages.findIndex((msg) => msg.id === messageId)
      if (messageIndex !== -1) {
        foundConversation = conversation
        break
      }
    }

    if (!foundConversation || messageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      })
    }

    // Remove message from conversation's messages array
    const deletedMessage = foundConversation.messages.splice(messageIndex, 1)[0]

    // Broadcast message deletion to all clients in the conversation room
    io.to(foundConversation.id).emit('message_deleted', {
      messageId: deletedMessage.id,
      conversationId: foundConversation.id,
    })

    console.log(`Message ${deletedMessage.id} deleted from conversation ${foundConversation.id}`)
    logToFile(`Message ${deletedMessage.id} deleted from conversation ${foundConversation.id}`)

    res.json({
      success: true,
      data: { id: deletedMessage.id },
    })
  } catch (error) {
    console.error('Error deleting message:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete message',
    })
  }
})

// File upload endpoint
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.log('Multer error:', err)
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'File size too large'
        })
      }
      if (err.message && err.message.includes('not allowed')) {
        return res.status(400).json({
          success: false,
          error: err.message
        })
      }
      return res.status(500).json({
        success: false,
        error: 'Upload failed'
      })
    }

    try {
      console.log('Upload request received:')
      console.log('req.file:', req.file)
      console.log('req.body:', req.body)
      console.log('req.headers:', req.headers)

      if (!req.file) {
        console.log('No file in request')
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        })
      }

      // Get file metadata
      const fileMetadata = {
        id: uuidv4(),
        originalName: req.file.originalname,
        filename: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
        url: `/uploads/${req.file.filename}`,
      }

      // Determine file type category
      if (req.file.mimetype.startsWith('image/')) {
        fileMetadata.type = 'image'
      } else if (req.file.mimetype.startsWith('audio/')) {
        fileMetadata.type = 'audio'
      } else if (req.file.mimetype.startsWith('video/')) {
        fileMetadata.type = 'video'
      } else {
        fileMetadata.type = 'document'
      }

      console.log('File uploaded:', fileMetadata)
      logToFile(`File uploaded: ${JSON.stringify(fileMetadata)}`)

      res.json({
        success: true,
        data: fileMetadata,
      })
    } catch (error) {
      console.error('Error uploading file:', error)
      res.status(500).json({
        success: false,
        error: 'Failed to upload file',
      })
    }
  })
})

// File download endpoint
app.get('/api/files/:filename', (req, res) => {
  try {
    const { filename } = req.params
    const filePath = path.join(__dirname, UPLOAD_DIR, filename)

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
      })
    }

    // Get file stats
    const stats = fs.statSync(filePath)
    const fileSize = stats.size

    // Set appropriate headers
    res.setHeader('Content-Length', fileSize)
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

    // Stream the file
    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('Error downloading file:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to download file',
    })
  }
})

// Delete conversation endpoint
app.delete('/api/conversations/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params

    // Find conversation index
    const conversationIndex = conversations.findIndex((conv) => conv.id === conversationId)

    if (conversationIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      })
    }

    // Remove conversation (messages are automatically deleted since they're nested)
    conversations.splice(conversationIndex, 1)

    res.json({
      success: true,
      data: true,
    })
  } catch (error) {
    console.error('Error deleting conversation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation',
    })
  }
})

// Update conversation endpoint
app.put('/api/conversations/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params
    const { title } = req.body

    // Find conversation
    const conversation = conversations.find((conv) => conv.id === conversationId)

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found',
      })
    }

    // Update conversation title and timestamp
    conversation.title = title
    conversation.updatedAt = new Date()

    res.json({
      success: true,
      data: conversation,
    })
  } catch (error) {
    console.error('Error updating conversation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update conversation',
    })
  }
})

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error)
  console.error('Error stack:', error.stack)
  console.error('Request path:', req.path)
  console.error('Request method:', req.method)

  // Handle multer errors specifically
  if (error instanceof multer.MulterError) {
    console.error('Multer error type:', error.code)

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large',
      })
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field',
      })
    }
  }

  // Handle file filter errors
  if (
    error.message &&
    error.message.includes('File type') &&
    error.message.includes('not allowed')
  ) {
    return res.status(400).json({
      success: false,
      error: error.message,
    })
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error',
  })
})

// Initialize Socket.IO server
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
})

// Socket event handlers
io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  logToFile(`User connected: ${socket.id}`)

  // Join conversation rooms
  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId)
    console.log(`Socket ${socket.id} joined conversation ${conversationId}`)
    logToFile(`Socket ${socket.id} joined conversation ${conversationId}`)
  })

  // Handle file messages
  socket.on('send_file_message', async (data) => {
    try {
      const { senderId, senderName, conversationId, fileData } = data

      // Validate required fields
      if (!senderId || !conversationId || !fileData) {
        socket.emit('error', { message: 'SenderId, conversationId, and fileData are required' })
        return
      }

      // Check if conversation exists in database
      const dbConversation = await db.getConversationById(conversationId)
      if (!dbConversation) {
        socket.emit('error', { message: 'Conversation not found' })
        return
      }

      const messageText = fileData.type === 'image'
        ? 'Image'
        : fileData.type === 'audio'
          ? 'Voice message'
          : fileData.type === 'video'
            ? 'Video'
            : fileData.originalName

      const newMessage = {
        id: uuidv4(),
        text: messageText,
        senderId,
        senderName,
        timestamp: new Date(),
        type: fileData.type, // 'image', 'audio', or 'document'
        file: fileData, // File metadata
        readBy: [],
        reactions: [],
      }

      try {
        // Save message to database first
        const savedMessage = await db.saveMessage({
          id: newMessage.id,
          text: messageText,
          senderId: senderId,
          conversationId: conversationId
        })

        // Save file attachment
        if (fileData) {
          await db.saveMessageFile({
            messageId: savedMessage.id,
            filename: fileData.originalName,
            path: fileData.url,
            type: fileData.mimeType,
            size: fileData.size
          })
        }

        console.log('File message saved to database:', savedMessage.id)
        
        // Also keep in memory for backward compatibility
        const conversation = conversations.find((conv) => conv.id === conversationId)
        if (conversation) {
          conversation.messages.push(newMessage)
          conversation.updatedAt = new Date()
        }

        // Broadcast to conversation room
        const broadcastMessage = {
          id: savedMessage.id,
          text: savedMessage.text,
          senderId: savedMessage.senderId,
          senderName: savedMessage.sender.username,
          timestamp: savedMessage.timestamp,
          type: fileData.type,
          file: fileData,
          readBy: [],
          reactions: []
        }
        
        io.to(conversationId).emit('new_message', broadcastMessage)

        console.log(`File message sent to conversation ${conversationId}:`, broadcastMessage)
        logToFile(`File message sent to conversation ${conversationId}: ${JSON.stringify(broadcastMessage)}`)
      } catch (dbError) {
        console.error('Error storing file message in database:', dbError)
        
        // Fallback to in-memory only
        const conversation = conversations.find((conv) => conv.id === conversationId)
        if (conversation) {
          conversation.messages.push(newMessage)
          conversation.updatedAt = new Date()
          
          // Broadcast to conversation room
          io.to(conversationId).emit('new_message', newMessage)

          console.log(`File message sent to conversation ${conversationId} (fallback):`, newMessage)
          logToFile(`File message sent to conversation ${conversationId} (fallback): ${JSON.stringify(newMessage)}`)
        } else {
          socket.emit('error', { message: 'Failed to send file message' })
        }
      }
    } catch (error) {
      console.error('Error sending file message via socket:', error)
      socket.emit('error', { message: 'Failed to send file message' })
    }
  })

  // Handle new messages
  socket.on('send_message', async (data) => {
    try {
      const { text, senderId, senderName, conversationId, encrypted = false, encryptionKeyId } = data

      // Validate required fields
      if (!text || !senderId || !conversationId) {
        socket.emit('error', { message: 'Text, senderId, and conversationId are required' })
        return
      }

      // Check if conversation exists in database or in-memory (for backward compatibility)
      const dbConversation = await db.getConversationById(conversationId)
      const memoryConversation = conversations.find((conv) => conv.id === conversationId)
      
      if (!dbConversation && !memoryConversation) {
        socket.emit('error', { message: 'Conversation not found' })
        return
      }

      const newMessage = {
        id: uuidv4(),
        text,
        senderId,
        senderName,
        timestamp: new Date(),
        type: 'text', // Default message type
        file: null, // File attachment (if any)
        readBy: [],
        reactions: [],
        encrypted: encrypted,
        encryptionKeyId: encryptionKeyId || null
      }

      let savedMessage = null
      
      try {
        // Only save to database if conversation exists in database
        if (dbConversation) {
          savedMessage = await db.saveMessage({
            id: newMessage.id,
            text: text,
            senderId: senderId,
            conversationId: conversationId,
            encrypted: encrypted,
            encryptionKey: encryptionKeyId || null
          })
          console.log('WebSocket message saved to database:', savedMessage.id)
        } else {
          console.log('Skipping database save for in-memory conversation:', conversationId)
        }
        
        // Always keep in memory for real-time functionality
        const conversation = conversations.find((conv) => conv.id === conversationId)
        if (conversation) {
          conversation.messages.push(newMessage)
          conversation.updatedAt = new Date()
        }

        // Broadcast formatted message to conversation room
        const broadcastMessage = savedMessage ? {
          // Database message format
          id: savedMessage.id,
          text: savedMessage.text,
          senderId: savedMessage.senderId,
          senderName: savedMessage.sender.username,
          timestamp: savedMessage.timestamp,
          type: 'text',
          file: null,
          readBy: [],
          reactions: [],
          encrypted: savedMessage.encrypted,
          encryptionKeyId: savedMessage.encryptionKey
        } : {
          // In-memory message format
          id: newMessage.id,
          text: newMessage.text,
          senderId: newMessage.senderId,
          senderName: newMessage.senderName,
          timestamp: newMessage.timestamp,
          type: 'text',
          file: null,
          readBy: [],
          reactions: [],
          encrypted: newMessage.encrypted,
          encryptionKeyId: newMessage.encryptionKeyId
        }
        
        io.to(conversationId).emit('new_message', broadcastMessage)

        console.log(`Message sent to conversation ${conversationId}:`, broadcastMessage)
        logToFile(`Message sent to conversation ${conversationId}: ${JSON.stringify(broadcastMessage)}`)
      } catch (dbError) {
        console.error('Error storing WebSocket message in database:', dbError)
        
        // Fallback to in-memory only
        const conversation = conversations.find((conv) => conv.id === conversationId)
        if (conversation) {
          conversation.messages.push(newMessage)
          conversation.updatedAt = new Date()
          
          // Broadcast to conversation room
          io.to(conversationId).emit('new_message', newMessage)

          console.log(`Message sent to conversation ${conversationId} (fallback):`, newMessage)
          logToFile(`Message sent to conversation ${conversationId} (fallback): ${JSON.stringify(newMessage)}`)
        } else {
          socket.emit('error', { message: 'Failed to send message' })
        }
      }
    } catch (error) {
      console.error('Error sending message via socket:', error)
      socket.emit('error', { message: 'Failed to send message' })
    }
  })

  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { conversationId, userId, userName } = data
    socket.to(conversationId).emit('user_typing', {
      userId,
      userName,
    })
    console.log(`User ${userName} started typing in ${conversationId}`)
  })

  socket.on('typing_stop', (data) => {
    const { conversationId, userId } = data
    socket.to(conversationId).emit('user_stopped_typing', {
      userId,
    })
    console.log(`User ${userId} stopped typing in ${conversationId}`)
  })

  // Handle user presence
  socket.on('user_online', (data) => {
    const { userId, userName, conversationId } = data
    userPresence.set(userId, {
      userId,
      userName,
      isOnline: true,
      lastSeen: new Date(),
      socketId: socket.id,
      conversationId,
    })

    // Broadcast to all users in the conversation
    if (conversationId) {
      socket.to(conversationId).emit('user_presence_update', {
        userId,
        userName,
        isOnline: true,
      })
    }

    console.log(`User ${userName} is now online`)
    logToFile(`User ${userName} is now online`)
  })

  // Handle read receipts
  socket.on('mark_message_read', async (data) => {
    try {
      const { messageId, conversationId, userId, userName } = data

      if (!messageId || !userId || !userName) {
        socket.emit('error', { message: 'MessageId, userId, and userName are required' })
        return
      }

      // Store read receipt in database first (only for database messages)
      try {
        // Check if message exists in database before creating read receipt
        const dbMessage = await db.getMessageById(messageId)
        if (dbMessage) {
          await db.markMessageAsRead(messageId, userId, userName)
          console.log('Read receipt saved to database:', messageId, userId)
        } else {
          console.log('Skipping database read receipt for in-memory message:', messageId)
        }
      } catch (dbError) {
        console.log('Read receipt not saved to database (likely in-memory message):', messageId)
        // Continue with in-memory storage for hardcoded demo messages
      }

      // Also handle in-memory for backward compatibility
      const conversation = conversations.find((conv) => conv.id === conversationId)
      if (conversation) {
        const message = conversation.messages.find((msg) => msg.id === messageId)
        if (message) {
          // Check if user already read this message
          const existingReadReceipt = message.readBy.find((receipt) => receipt.userId === userId)
          if (!existingReadReceipt) {
            // Add read receipt to in-memory message
            const readReceipt = {
              userId,
              userName,
              readAt: new Date(),
            }
            message.readBy.push(readReceipt)
          }
        }
      }

      // Broadcast read receipt to conversation room
      io.to(conversationId).emit('message_read', {
        messageId,
        readReceipt: {
          userId,
          userName,
          readAt: new Date()
        }
      })

      console.log(`Message ${messageId} marked as read by ${userName}`)
      logToFile(`Message ${messageId} marked as read by ${userName}`)
    } catch (error) {
      console.error('Error marking message as read:', error)
      socket.emit('error', { message: 'Failed to mark message as read' })
    }
  })

  // Handle message reactions
  socket.on('add_reaction', async (data) => {
    try {
      const { messageId, conversationId, userId, userName, emoji } = data

      if (!messageId || !userId || !emoji) {
        socket.emit('error', { message: 'MessageId, userId, and emoji are required' })
        return
      }

      // Handle reaction in database first (only for database messages)
      try {
        // Check if message exists in database before creating reaction
        const dbMessage = await db.getMessageById(messageId)
        if (dbMessage) {
          const reactionResult = await db.toggleReaction(messageId, userId, emoji)
          console.log('Reaction processed in database:', reactionResult)
          
          if (reactionResult.action === 'removed') {
            // Broadcast reaction removal
            io.to(conversationId).emit('reaction_removed', {
              messageId,
              userId,
              emoji: reactionResult.emoji
            })
            console.log(`Reaction ${emoji} removed from message ${messageId} by ${userName}`)
            return
          }
        } else {
          console.log('Skipping database reaction for in-memory message:', messageId)
        }
      } catch (dbError) {
        console.log('Reaction not saved to database (likely in-memory message):', messageId)
        // Continue with in-memory processing for hardcoded demo messages
      }

      // Also handle in-memory for backward compatibility
      const conversation = conversations.find((conv) => conv.id === conversationId)
      if (conversation) {
        const message = conversation.messages.find((msg) => msg.id === messageId)
        if (message) {
          // Check if user already has any reaction (only one emoji allowed per user)
          const existingUserReaction = message.reactions.find((reaction) => reaction.userId === userId)

          if (existingUserReaction) {
            // If user is trying to react with the same emoji, remove it (toggle)
            if (existingUserReaction.emoji === emoji) {
              message.reactions = message.reactions.filter((r) => r.id !== existingUserReaction.id)

              // Broadcast reaction removal
              io.to(conversationId).emit('reaction_removed', {
                messageId,
                reactionId: existingUserReaction.id,
                userId,
              })
              return
            } else {
              // If user is trying to react with a different emoji, replace the existing one
              message.reactions = message.reactions.filter((r) => r.id !== existingUserReaction.id)

              // Broadcast old reaction removal
              io.to(conversationId).emit('reaction_removed', {
                messageId,
                reactionId: existingUserReaction.id,
                userId,
              })
            }
          }

          // Add reaction to in-memory message
          const reaction = {
            id: uuidv4(),
            userId,
            userName,
            emoji,
            timestamp: new Date(),
          }
          message.reactions.push(reaction)
        }
      }

      // Broadcast reaction addition to conversation room
      io.to(conversationId).emit('reaction_added', {
        messageId,
        reaction: {
          id: uuidv4(),
          userId,
          userName,
          emoji,
          timestamp: new Date()
        }
      })

      console.log(`Reaction ${emoji} added to message ${messageId} by ${userName}`)
      logToFile(`Reaction ${emoji} added to message ${messageId} by ${userName}`)
    } catch (error) {
      console.error('Error adding reaction:', error)
      socket.emit('error', { message: 'Failed to add reaction' })
    }
  })

  socket.on('remove_reaction', (data) => {
    try {
      const { messageId, conversationId, userId, reactionId } = data

      // Find the conversation and message
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

      // Find and remove the reaction
      const reactionIndex = message.reactions.findIndex(
        (reaction) => reaction.id === reactionId && reaction.userId === userId,
      )

      if (reactionIndex === -1) {
        socket.emit('error', { message: 'Reaction not found' })
        return
      }

      const removedReaction = message.reactions.splice(reactionIndex, 1)[0]

      // Broadcast reaction removal to conversation room
      io.to(conversationId).emit('reaction_removed', {
        messageId,
        reactionId,
        userId,
      })

      console.log(
        `Reaction ${removedReaction.emoji} removed from message ${messageId} by ${userId}`,
      )
      logToFile(`Reaction ${removedReaction.emoji} removed from message ${messageId} by ${userId}`)
    } catch (error) {
      console.error('Error removing reaction:', error)
      socket.emit('error', { message: 'Failed to remove reaction' })
    }
  })

  // Handle message deletion via WebSocket
  socket.on('delete_message', async (data) => {
    console.log('WebSocket delete_message received:', data)
    console.log('Socket ID:', socket.id)

    try {
      const { messageId, conversationId, userId } = data
      console.log('Attempting to delete message:', { messageId, conversationId, userId })

      if (!messageId || !conversationId || !userId) {
        socket.emit('error', { message: 'MessageId, conversationId, and userId are required' })
        return
      }

      // Check message in database first
      let dbMessage = null
      try {
        dbMessage = await db.getMessageById(messageId)
        if (dbMessage) {
          // Check permissions in database
          if (dbMessage.senderId !== userId) {
            socket.emit('error', { message: 'You can only delete your own messages' })
            return
          }
          
          // Delete from database
          await db.deleteMessage(messageId)
          console.log('Message deleted from database:', messageId)
        } else {
          console.log('Message not found in database, checking in-memory:', messageId)
        }
      } catch (dbError) {
        console.log('Database deletion failed (likely in-memory message):', messageId)
        // Continue with in-memory deletion for hardcoded demo messages
      }

      // Also handle in-memory deletion for backward compatibility
      const conversation = conversations.find((conv) => conv.id === conversationId)
      if (conversation) {
        const messageIndex = conversation.messages.findIndex((msg) => msg.id === messageId)
        if (messageIndex !== -1) {
          const message = conversation.messages[messageIndex]
          
          // Check permissions for in-memory message if database check wasn't performed
          if (!dbMessage && message.senderId !== userId) {
            socket.emit('error', { message: 'You can only delete your own messages' })
            return
          }
          
          // Remove message from conversation
          const deletedMessage = conversation.messages.splice(messageIndex, 1)[0]
          console.log('Message removed from in-memory conversation:', deletedMessage.id)
        }
      }

      // If neither database nor memory had the message, it doesn't exist
      if (!dbMessage && (!conversation || conversation.messages.findIndex((msg) => msg.id === messageId) === -1)) {
        socket.emit('error', { message: 'Message not found' })
        return
      }

      // Broadcast deletion to all clients in the conversation room
      const broadcastData = {
        messageId: messageId,
        conversationId: conversationId,
      }
      console.log('Broadcasting message_deleted event:', broadcastData)
      io.to(conversationId).emit('message_deleted', broadcastData)

      console.log(
        `Message ${messageId} deleted via WebSocket by user ${userId} in conversation ${conversationId}`,
      )
      logToFile(
        `Message ${messageId} deleted via WebSocket by user ${userId} in conversation ${conversationId}`,
      )
    } catch (error) {
      console.error('Error deleting message via WebSocket:', error)
      socket.emit('error', { message: 'Failed to delete message' })
    }
  })

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
    logToFile(`User disconnected: ${socket.id}`)

    // Update user presence on disconnect
    for (const [userId, presence] of userPresence.entries()) {
      if (presence.socketId === socket.id) {
        presence.isOnline = false
        presence.lastSeen = new Date()

        // Broadcast offline status to conversation if user was in one
        if (presence.conversationId) {
          socket.to(presence.conversationId).emit('user_presence_update', {
            userId,
            userName: presence.userName,
            isOnline: false,
            lastSeen: presence.lastSeen,
          })
        }

        console.log(`User ${presence.userName} is now offline`)
        logToFile(`User ${presence.userName} is now offline`)
        break
      }
    }
  })
})

// User management endpoints
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
    const existingUser = await db.getUserByUsername(username)
    if (existingUser) {
      return res.json({
        success: true,
        data: existingUser
      })
    }

    // Create new user
    const newUser = await db.createUser({
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

app.get('/api/users/:username', async (req, res) => {
  try {
    const { username } = req.params
    const user = await db.getUserByUsername(username)
    
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
    console.error('Error fetching user:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    })
  }
})

// Phase 2: Private Messaging API endpoints
app.get('/api/users', async (req, res) => {
  try {
    const { currentUserId } = req.query
    
    if (!currentUserId) {
      return res.status(400).json({
        success: false,
        error: 'Current user ID is required'
      })
    }

    const users = await db.getAllUsersForDirectMessages(currentUserId)
    
    res.json({
      success: true,
      data: users
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users'
    })
  }
})

app.post('/api/conversations/direct', async (req, res) => {
  try {
    const { user1Id, user2Id } = req.body
    
    if (!user1Id || !user2Id) {
      return res.status(400).json({
        success: false,
        error: 'Both user IDs are required'
      })
    }

    if (user1Id === user2Id) {
      return res.status(400).json({
        success: false,
        error: 'Cannot create direct conversation with yourself'
      })
    }

    const conversation = await db.createDirectConversation(user1Id, user2Id)
    
    // Transform to frontend format
    const formattedConversation = {
      id: conversation.id,
      type: conversation.type,
      title: conversation.participants
        .filter(p => p.userId !== user1Id)
        .map(p => p.user.username)[0] || 'Direct Message',
      participants: conversation.participants.map(p => p.user.username),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessage: null
    }

    res.json({
      success: true,
      data: formattedConversation
    })
  } catch (error) {
    console.error('Error creating direct conversation:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create direct conversation'
    })
  }
})

app.get('/api/conversations/direct', async (req, res) => {
  try {
    const { userId } = req.query
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      })
    }

    const directConversations = await db.getDirectConversationsForUser(userId)
    
    // Transform to frontend format
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
        timestamp: conv.messages[0].timestamp
      } : null
    }))

    res.json({
      success: true,
      data: formattedConversations
    })
  } catch (error) {
    console.error('Error fetching direct conversations:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch direct conversations'
    })
  }
})

// Phase 3: Message Threading API endpoints
app.post('/api/messages/:messageId/reply', async (req, res) => {
  try {
    const { messageId } = req.params
    const { text, senderId, conversationId } = req.body
    
    if (!text || !senderId || !conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Text, senderId, and conversationId are required'
      })
    }

    // First, check if the parent message exists in the in-memory storage
    const conversation = conversations.find((conv) => conv.id === conversationId)
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      })
    }

    const parentMessage = conversation.messages.find(msg => msg.id === messageId)
    if (!parentMessage) {
      return res.status(404).json({
        success: false,
        error: 'Parent message not found'
      })
    }

    // Create the thread reply message
    const threadId = parentMessage.threadId || messageId
    const replyMessage = {
      id: uuidv4(),
      text,
      senderId,
      senderName: senderId.replace('user_', '').charAt(0).toUpperCase() + senderId.replace('user_', '').slice(1), // Simple name conversion
      timestamp: new Date(),
      type: 'text',
      file: null,
      threadId,
      replyToId: messageId,
      reactions: [],
      readBy: []
    }

    // Add the reply message to the conversation
    conversation.messages.push(replyMessage)
    conversation.updatedAt = new Date()

    // Transform to frontend format
    const formattedMessage = {
      id: replyMessage.id,
      text: replyMessage.text,
      senderId: replyMessage.senderId,
      senderName: replyMessage.senderName,
      timestamp: replyMessage.timestamp,
      threadId: replyMessage.threadId,
      replyToId: replyMessage.replyToId,
      reactions: replyMessage.reactions,
      readBy: replyMessage.readBy
    }

    // Emit the new thread reply to all clients in the conversation room
    io.to(conversationId).emit('new_message', formattedMessage)
    
    console.log(`Thread reply sent: ${formattedMessage.id} in conversation ${conversationId}`)
    logToFile(`Thread reply sent: ${formattedMessage.id} in conversation ${conversationId}`)

    res.json({
      success: true,
      data: formattedMessage
    })
  } catch (error) {
    console.error('Error creating thread reply:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create thread reply'
    })
  }
})

app.get('/api/threads/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params
    
    const threadMessages = await db.getThread(threadId)
    
    // Transform to frontend format
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
        userId: r.userId
      })),
      readBy: msg.readReceipts.map(r => ({
        userId: r.userId,
        userName: r.userName,
        readAt: r.readAt
      }))
    }))

    res.json({
      success: true,
      data: formattedMessages
    })
  } catch (error) {
    console.error('Error fetching thread:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch thread'
    })
  }
})

// Phase 4: Message Search API endpoints
app.get('/api/search/messages', async (req, res) => {
  try {
    const { query, conversationId, limit = 50 } = req.query
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      })
    }

    const searchResults = await db.searchMessages(
      query.trim(), 
      conversationId || null, 
      parseInt(limit)
    )
    
    // Transform to frontend format
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
      replyToId: msg.replyToId
    }))

    res.json({
      success: true,
      data: formattedResults,
      meta: {
        query: query.trim(),
        conversationId: conversationId || null,
        totalResults: formattedResults.length
      }
    })
  } catch (error) {
    console.error('Error searching messages:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to search messages'
    })
  }
})

app.get('/api/search/conversations', async (req, res) => {
  try {
    const { query, userId } = req.query
    
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      })
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      })
    }

    // Get user's conversations and filter by search query
    const userConversations = await db.getConversationsForUser(userId)
    
    const filteredConversations = userConversations.filter(conv => {
      const searchTerm = query.trim().toLowerCase()
      
      // Search in conversation name
      if (conv.name && conv.name.toLowerCase().includes(searchTerm)) {
        return true
      }
      
      // Search in participant usernames
      const participantNames = conv.participants.map(p => p.user.username.toLowerCase())
      return participantNames.some(name => name.includes(searchTerm))
    })
    
    // Transform to frontend format
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
        timestamp: conv.messages[0].timestamp
      } : null
    }))

    res.json({
      success: true,
      data: formattedConversations,
      meta: {
        query: query.trim(),
        totalResults: formattedConversations.length
      }
    })
  } catch (error) {
    console.error('Error searching conversations:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to search conversations'
    })
  }
})

// Encryption endpoints
// Generate encryption keys for a user
app.post('/api/users/:userId/keys', async (req, res) => {
  try {
    const { userId } = req.params
    const { password } = req.body

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required for key generation'
      })
    }

    // Check if user exists
    const user = await db.getUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    // Generate encryption keys
    const keys = await encryptionService.createUserKeys(userId, password)

    res.json({
      success: true,
      data: {
        publicKey: keys.publicKey,
        encryptedPrivateKey: keys.encryptedPrivateKey
      }
    })
  } catch (error) {
    console.error('Error generating user keys:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to generate encryption keys'
    })
  }
})

// Get user's public key
app.get('/api/users/:userId/public-key', async (req, res) => {
  try {
    const { userId } = req.params

    const user = await db.getUser(userId)
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      })
    }

    if (!user.publicKey) {
      return res.status(404).json({
        success: false,
        error: 'User has no public key'
      })
    }

    res.json({
      success: true,
      data: {
        publicKey: user.publicKey
      }
    })
  } catch (error) {
    console.error('Error getting public key:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get public key'
    })
  }
})

// Get or create conversation key for a user
app.post('/api/conversations/:conversationId/keys', async (req, res) => {
  try {
    const { conversationId } = req.params
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      })
    }

    // Check if user has encryption keys
    const hasKeys = await encryptionService.hasUserKeys(userId)
    if (!hasKeys) {
      return res.status(400).json({
        success: false,
        error: 'User must have encryption keys set up first'
      })
    }

    // Get or create conversation key
    const conversationKey = await encryptionService.getOrCreateConversationKey(conversationId, userId)

    res.json({
      success: true,
      data: {
        keyId: conversationKey.keyId,
        encryptedKey: conversationKey.encryptedKey,
        conversationId: conversationKey.conversationId
      }
    })
  } catch (error) {
    console.error('Error getting conversation key:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation key'
    })
  }
})

// Check if user has encryption keys
app.get('/api/users/:userId/has-keys', async (req, res) => {
  try {
    const { userId } = req.params

    const hasKeys = await encryptionService.hasUserKeys(userId)

    res.json({
      success: true,
      data: {
        hasKeys: hasKeys
      }
    })
  } catch (error) {
    console.error('Error checking user keys:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to check user keys'
    })
  }
})

// Distribute conversation key to all participants (for new conversations)
app.post('/api/conversations/:conversationId/distribute-key', async (req, res) => {
  try {
    const { conversationId } = req.params

    // Distribute key to all participants
    const keyId = await encryptionService.distributeConversationKey(conversationId)

    res.json({
      success: true,
      data: {
        keyId: keyId
      }
    })
  } catch (error) {
    console.error('Error distributing conversation key:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to distribute conversation key'
    })
  }
})

// Perfect Forward Secrecy - Ratchet API routes
app.use('/api/ratchet', ratchetRoutes)
app.use('/api/encryption', encryptionRoutes)
app.use('/api/encryption', productionEncryptionRoutes)

// Initialize database and start server
async function startServer() {
  try {
    // Connect to database
    await db.connect()
    
    // Start server
    server.listen(PORT, () => {
      const startMessage = `Chat backend server with WebSocket and Database running on port ${PORT}`
      console.log(startMessage)
      logToFile(startMessage)
      logToFile(`Log file: ${logFile}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...')
  await db.disconnect()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('Shutting down server...')
  await db.disconnect()
  process.exit(0)
})

startServer()
