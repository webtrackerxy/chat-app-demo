const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Setup log file - clear on server start
const logFile = path.join(__dirname, 'server.log');
fs.writeFileSync(logFile, ''); // Clear log file on start

const logToFile = (message) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logFile, logEntry);
};

app.use(cors());
app.use(express.json());

// Simple request logging middleware - runs after route matching
app.use((req, res, next) => {
  // Override res.json to log when response is sent (after route processing)
  const originalJson = res.json;
  res.json = function(data) {
    const action = `${req.method} ${req.route ? req.route.path : req.path}`;
    const requestData = {
      body: req.body,
      query: req.query,
      params: req.params
    };
    
    const logMessage = `Action: ${action}`;
    const logData = `Data: ${JSON.stringify(requestData, null, 2)}`;
    const logConversations = `Conversations: ${JSON.stringify(conversations, null, 2)}`;
    
    console.log(logMessage);
    console.log(logData);
    console.log(logConversations);
    
    // Also log to file
    logToFile(logMessage);
    logToFile(logData);
    logToFile(logConversations);
    logToFile('---');
    
    return originalJson.call(this, data);
  };
  
  next();
});

// Simulated delay middleware
const simulateDelay = (req, res, next) => {
  const delay = Math.random() * 1000 + 500; // 500-1500ms delay
  setTimeout(next, delay);
};

app.use(simulateDelay);

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
        timestamp: new Date('2024-01-01T10:00:00')
      },
      {
        id: '2',
        text: 'Hello everyone!',
        senderId: 'user1',
        senderName: 'Alice',
        timestamp: new Date('2024-01-01T10:01:00')
      }
    ]
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
        text: 'Let\'s discuss the latest in tech!',
        senderId: 'user2',
        senderName: 'Bob',
        timestamp: new Date('2024-01-01T10:30:00')
      }
    ]
  }
];

// Routes
// Conversation management routes
app.get('/api/conversations', (req, res) => {
  try {
    // Add last message to each conversation
    const conversationsWithLastMessage = conversations.map(conv => {
      const lastMessage = conv.messages.length > 0 
        ? conv.messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]
        : null;
      
      return {
        ...conv,
        lastMessage: lastMessage || null
      };
    });

    res.json({
      success: true,
      data: conversationsWithLastMessage
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

// Get messages from a conversation
app.get('/api/conversations/:id/messages', (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the conversation and return its messages
    const conversation = conversations.find(conv => conv.id === id);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    // Return messages sorted by timestamp
    const sortedMessages = conversation.messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    res.json({
      success: true,
      data: sortedMessages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch messages'
    });
  }
});

// Add conversation endpoint
app.post('/api/conversations', (req, res) => {
  try {
    const { title, participants } = req.body;
    
    const newConversation = {
      id: uuidv4(),
      title,
      participants,
      createdAt: new Date(),
      updatedAt: new Date(),
      messages: [] // Initialize empty messages array
    };
    
    conversations.push(newConversation);
    
    res.json({
      success: true,
      data: newConversation
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation'
    });
  }
});
// Add message to conversation endpoint
app.post('/api/messages', (req, res) => {
  try {
    const { text, senderId, senderName, conversationId } = req.body;
    
    // Find the conversation
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    const newMessage = {
      id: uuidv4(),
      text,
      senderId,
      senderName,
      timestamp: new Date()
    };
    
    // Add message to conversation's messages array
    conversation.messages.push(newMessage);
    
    // Update conversation's updatedAt timestamp
    conversation.updatedAt = new Date();
    
    res.json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    console.error('Error sending message:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
});

// Delete message endpoint
app.delete('/api/messages/:messageId', (req, res) => {
  try {
    const { messageId } = req.params;
    
    // Find the conversation containing the message
    let foundConversation = null;
    let messageIndex = -1;
    
    for (const conversation of conversations) {
      messageIndex = conversation.messages.findIndex(msg => msg.id === messageId);
      if (messageIndex !== -1) {
        foundConversation = conversation;
        break;
      }
    }
    
    if (!foundConversation || messageIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }
    
    // Remove message from conversation's messages array
    const deletedMessage = foundConversation.messages.splice(messageIndex, 1)[0];
    
    res.json({
      success: true,
      data: { id: deletedMessage.id }
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
});

// Delete conversation endpoint
app.delete('/api/conversations/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    
    // Find conversation index
    const conversationIndex = conversations.findIndex(conv => conv.id === conversationId);
    
    if (conversationIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    // Remove conversation (messages are automatically deleted since they're nested)
    conversations.splice(conversationIndex, 1);
    
    res.json({
      success: true,
      data: true
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation'
    });
  }
});

// Update conversation endpoint
app.put('/api/conversations/:conversationId', (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;
    
    // Find conversation
    const conversation = conversations.find(conv => conv.id === conversationId);
    
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }
    
    // Update conversation title and timestamp
    conversation.title = title;
    conversation.updatedAt = new Date();
    
    res.json({
      success: true,
      data: conversation
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update conversation'
    });
  }
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Initialize Socket.IO server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Socket event handlers
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  logToFile(`User connected: ${socket.id}`);
  
  // Join conversation rooms
  socket.on('join_conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    logToFile(`Socket ${socket.id} joined conversation ${conversationId}`);
  });
  
  // Handle new messages
  socket.on('send_message', async (data) => {
    try {
      const { text, senderId, senderName, conversationId } = data;
      
      // Find the conversation
      const conversation = conversations.find(conv => conv.id === conversationId);
      
      if (!conversation) {
        socket.emit('error', { message: 'Conversation not found' });
        return;
      }
      
      const newMessage = {
        id: uuidv4(),
        text,
        senderId,
        senderName,
        timestamp: new Date()
      };
      
      // Add message to conversation's messages array
      conversation.messages.push(newMessage);
      
      // Update conversation's updatedAt timestamp
      conversation.updatedAt = new Date();
      
      // Broadcast to conversation room
      io.to(conversationId).emit('new_message', newMessage);
      
      console.log(`Message sent to conversation ${conversationId}:`, newMessage);
      logToFile(`Message sent to conversation ${conversationId}: ${JSON.stringify(newMessage)}`);
      
    } catch (error) {
      console.error('Error sending message via socket:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });
  
  // Handle typing indicators
  socket.on('typing_start', (data) => {
    const { conversationId, userId, userName } = data;
    socket.to(conversationId).emit('user_typing', {
      userId,
      userName
    });
    console.log(`User ${userName} started typing in ${conversationId}`);
  });
  
  socket.on('typing_stop', (data) => {
    const { conversationId, userId } = data;
    socket.to(conversationId).emit('user_stopped_typing', {
      userId
    });
    console.log(`User ${userId} stopped typing in ${conversationId}`);
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    logToFile(`User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  const startMessage = `Chat backend server with WebSocket running on port ${PORT}`;
  console.log(startMessage);
  logToFile(startMessage);
  logToFile(`Log file: ${logFile}`);
});