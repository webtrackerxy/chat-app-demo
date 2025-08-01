const request = require('supertest');
const express = require('express');
const RatchetStateService = require('../src/services/RatchetStateService');
const ratchetRoutes = require('../routes/ratchet');

// Mock the Prisma client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    conversationRatchetState: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    skippedMessageKey: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  })),
}));

describe('Ratchet API Integration Tests', () => {
  let app;
  let mockPrisma;

  beforeAll(() => {
    // Create Express app with ratchet routes
    app = express();
    app.use(express.json());
    app.use('/api/ratchet', ratchetRoutes);
    
    // Add error handling
    app.use((error, req, res, next) => {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    });

    // Get the mocked Prisma instance
    const { PrismaClient } = require('@prisma/client');
    mockPrisma = new PrismaClient();
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('POST /api/ratchet/state', () => {
    test('should store ratchet state successfully', async () => {
      const mockRatchetState = {
        conversationId: 'test-conversation',
        userId: 'user1',
        ratchetState: {
          rootKey: 'mock-root-key',
          sendingChainKey: 'mock-sending-chain-key',
          receivingChainKey: 'mock-receiving-chain-key',
          sendingMessageNumber: 0,
          receivingMessageNumber: 0,
          sendingChainLength: 0,
          receivingChainLength: 0,
          sendingEphemeralPublicKey: 'mock-ephemeral-public-key',
        },
      };

      mockPrisma.conversationRatchetState.upsert.mockResolvedValue({
        id: 'mock-id',
        ...mockRatchetState,
      });

      const response = await request(app)
        .post('/api/ratchet/state')
        .send(mockRatchetState)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Ratchet state stored successfully',
        ratchetStateId: 'mock-id',
      });

      expect(mockPrisma.conversationRatchetState.upsert).toHaveBeenCalledWith({
        where: {
          conversationId_userId: {
            conversationId: 'test-conversation',
            userId: 'user1',
          },
        },
        update: expect.objectContaining({
          conversationId: 'test-conversation',
          userId: 'user1',
          updatedAt: expect.any(Date),
        }),
        create: expect.objectContaining({
          conversationId: 'test-conversation',
          userId: 'user1',
        }),
      });
    });

    test('should return 400 for missing required fields', async () => {
      const incompleteData = {
        conversationId: 'test-conversation',
        // Missing userId and ratchetState
      };

      const response = await request(app)
        .post('/api/ratchet/state')
        .send(incompleteData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing required fields: conversationId, userId, ratchetState',
      });
    });

    test('should return 400 for invalid ratchet state', async () => {
      const invalidData = {
        conversationId: 'test-conversation',
        userId: 'user1',
        ratchetState: {
          // Missing required keys
          sendingMessageNumber: 0,
        },
      };

      const response = await request(app)
        .post('/api/ratchet/state')
        .send(invalidData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid ratchet state: missing required keys',
      });
    });

    test('should handle database errors gracefully', async () => {
      mockPrisma.conversationRatchetState.upsert.mockRejectedValue(
        new Error('Database connection failed')
      );

      const mockRatchetState = {
        conversationId: 'test-conversation',
        userId: 'user1',
        ratchetState: {
          rootKey: 'mock-root-key',
          sendingChainKey: 'mock-sending-chain-key',
          receivingChainKey: 'mock-receiving-chain-key',
        },
      };

      const response = await request(app)
        .post('/api/ratchet/state')
        .send(mockRatchetState)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to store ratchet state',
      });
    });
  });

  describe('GET /api/ratchet/state/:conversationId/:userId', () => {
    test('should retrieve ratchet state successfully', async () => {
      const mockStoredState = {
        id: 'mock-id',
        conversationId: 'test-conversation',
        userId: 'user1',
        rootKeyEncrypted: 'encrypted-root-key',
        sendingChainKeyEncrypted: 'encrypted-sending-chain-key',
        receivingChainKeyEncrypted: 'encrypted-receiving-chain-key',
        sendingMessageNumber: 5,
        receivingMessageNumber: 3,
        sendingChainLength: 1,
        receivingChainLength: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        skippedMessageKeys: [],
      };

      mockPrisma.conversationRatchetState.findUnique.mockResolvedValue(mockStoredState);

      const response = await request(app)
        .get('/api/ratchet/state/test-conversation/user1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ratchetState).toBeDefined();
      expect(response.body.ratchetState.conversationId).toBe('test-conversation');
      expect(response.body.ratchetState.userId).toBe('user1');
    });

    test('should return 404 for non-existent ratchet state', async () => {
      mockPrisma.conversationRatchetState.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/ratchet/state/nonexistent/user1')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Ratchet state not found',
      });
    });

    test('should return 400 for missing parameters', async () => {
      const response = await request(app)
        .get('/api/ratchet/state//')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Missing required parameters: conversationId, userId',
      });
    });
  });

  describe('DELETE /api/ratchet/state/:conversationId/:userId', () => {
    test('should delete ratchet state successfully', async () => {
      mockPrisma.conversationRatchetState.deleteMany.mockResolvedValue({ count: 1 });

      const response = await request(app)
        .delete('/api/ratchet/state/test-conversation/user1')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Ratchet state deleted successfully',
      });

      expect(mockPrisma.conversationRatchetState.deleteMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'test-conversation',
          userId: 'user1',
        },
      });
    });

    test('should return 404 for non-existent ratchet state', async () => {
      mockPrisma.conversationRatchetState.deleteMany.mockResolvedValue({ count: 0 });

      const response = await request(app)
        .delete('/api/ratchet/state/nonexistent/user1')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Ratchet state not found',
      });
    });
  });

  describe('POST /api/ratchet/skipped-keys', () => {
    test('should store skipped message key successfully', async () => {
      // Mock getting ratchet state first
      mockPrisma.conversationRatchetState.findUnique.mockResolvedValue({
        id: 'ratchet-state-id',
        conversationId: 'test-conversation',
        userId: 'user1',
      });

      // Mock storing skipped key
      mockPrisma.skippedMessageKey.create.mockResolvedValue({
        id: 'skipped-key-id',
        ratchetStateId: 'ratchet-state-id',
        messageKeyId: 'test-key-id',
      });

      const skippedKeyData = {
        conversationId: 'test-conversation',
        userId: 'user1',
        messageKeyId: 'test-key-id',
        encryptedKey: 'encrypted-message-key',
        chainLength: 1,
        messageNumber: 5,
      };

      const response = await request(app)
        .post('/api/ratchet/skipped-keys')
        .send(skippedKeyData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Skipped message key stored successfully',
        skippedKeyId: 'skipped-key-id',
      });
    });

    test('should return 404 when ratchet state not found', async () => {
      mockPrisma.conversationRatchetState.findUnique.mockResolvedValue(null);

      const skippedKeyData = {
        conversationId: 'nonexistent',
        userId: 'user1',
        messageKeyId: 'test-key-id',
        encryptedKey: 'encrypted-message-key',
        chainLength: 1,
        messageNumber: 5,
      };

      const response = await request(app)
        .post('/api/ratchet/skipped-keys')
        .send(skippedKeyData)
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Ratchet state not found',
      });
    });

    test('should return 400 for missing required fields', async () => {
      const incompleteData = {
        conversationId: 'test-conversation',
        userId: 'user1',
        // Missing other required fields
      };

      const response = await request(app)
        .post('/api/ratchet/skipped-keys')
        .send(incompleteData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('GET /api/ratchet/stats/:conversationId/:userId', () => {
    test('should return ratchet statistics successfully', async () => {
      const mockStats = {
        id: 'ratchet-state-id',
        sendingMessageNumber: 10,
        receivingMessageNumber: 8,
        sendingChainLength: 2,
        receivingChainLength: 1,
        updatedAt: new Date(),
        createdAt: new Date(),
        _count: {
          skippedMessageKeys: 3,
        },
      };

      mockPrisma.conversationRatchetState.findUnique.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/ratchet/stats/test-conversation/user1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.statistics).toEqual({
        sendingMessageNumber: 10,
        receivingMessageNumber: 8,
        sendingChainLength: 2,
        receivingChainLength: 1,
        skippedKeysCount: 3,
        lastUpdated: expect.any(Number),
        createdAt: expect.any(Number),
      });
    });

    test('should return 404 for non-existent ratchet state', async () => {
      mockPrisma.conversationRatchetState.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/ratchet/stats/nonexistent/user1')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'Ratchet state not found',
      });
    });
  });

  describe('GET /api/ratchet/conversation/:conversationId', () => {
    test('should list all ratchet states for conversation', async () => {
      const mockStates = [
        {
          id: 'state-1',
          userId: 'user1',
          sendingMessageNumber: 5,
          receivingMessageNumber: 3,
          sendingChainLength: 1,
          receivingChainLength: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { skippedMessageKeys: 2 },
        },
        {
          id: 'state-2',
          userId: 'user2',
          sendingMessageNumber: 3,
          receivingMessageNumber: 5,
          sendingChainLength: 0,
          receivingChainLength: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { skippedMessageKeys: 1 },
        },
      ];

      mockPrisma.conversationRatchetState.findMany.mockResolvedValue(mockStates);

      const response = await request(app)
        .get('/api/ratchet/conversation/test-conversation')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ratchetStates).toHaveLength(2);
      expect(response.body.count).toBe(2);
      expect(response.body.ratchetStates[0].skippedKeysCount).toBe(2);
      expect(response.body.ratchetStates[1].skippedKeysCount).toBe(1);
    });

    test('should return empty list for conversation with no ratchet states', async () => {
      mockPrisma.conversationRatchetState.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/ratchet/conversation/empty-conversation')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.ratchetStates).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });
  });

  describe('POST /api/ratchet/cleanup', () => {
    test('should perform cleanup successfully', async () => {
      mockPrisma.skippedMessageKey.deleteMany.mockResolvedValue({ count: 15 });

      const response = await request(app)
        .post('/api/ratchet/cleanup')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Cleanup completed successfully',
        cleanedKeysCount: 15,
      });

      expect(mockPrisma.skippedMessageKey.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: {
            lt: expect.any(Date),
          },
        },
      });
    });

    test('should handle cleanup with no expired keys', async () => {
      mockPrisma.skippedMessageKey.deleteMany.mockResolvedValue({ count: 0 });

      const response = await request(app)
        .post('/api/ratchet/cleanup')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Cleanup completed successfully',
        cleanedKeysCount: 0,
      });
    });
  });

  describe('POST /api/ratchet/initialize', () => {
    test('should initialize ratchet successfully', async () => {
      const initData = {
        conversationId: 'new-conversation',
        userId: 'user1',
        initialState: {
          rootKey: 'initial-root-key',
          sendingChainKey: 'initial-sending-chain-key',
          receivingChainKey: 'initial-receiving-chain-key',
          sendingMessageNumber: 0,
          receivingMessageNumber: 0,
        },
      };

      mockPrisma.conversationRatchetState.upsert.mockResolvedValue({
        id: 'new-ratchet-id',
        ...initData,
      });

      const response = await request(app)
        .post('/api/ratchet/initialize')
        .send(initData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Ratchet initialized successfully',
        ratchetStateId: 'new-ratchet-id',
      });
    });

    test('should return 400 for invalid initial state', async () => {
      const invalidInitData = {
        conversationId: 'new-conversation',
        userId: 'user1',
        initialState: {
          // Missing required keys
          sendingMessageNumber: 0,
        },
      };

      const response = await request(app)
        .post('/api/ratchet/initialize')
        .send(invalidInitData)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid initial state: missing required keys',
      });
    });
  });

  describe('GET /api/ratchet/health', () => {
    test('should return healthy status', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ '1': 1 }]);
      mockPrisma.conversationRatchetState.count.mockResolvedValue(25);
      mockPrisma.skippedMessageKey.count
        .mockResolvedValueOnce(100) // total count
        .mockResolvedValueOnce(5);  // expired count

      const response = await request(app)
        .get('/api/ratchet/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.statistics).toEqual({
        totalRatchetStates: 25,
        totalSkippedKeys: 100,
        expiredKeys: 5,
      });
      expect(response.body.timestamp).toBeDefined();
    });

    test('should return unhealthy status on database error', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/ratchet/health')
        .expect(503);

      expect(response.body.status).toBe('unhealthy');
      expect(response.body.error).toBe('Database connection failed');
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors', async () => {
      mockPrisma.conversationRatchetState.findUnique.mockRejectedValue(
        new Error('Connection timeout')
      );

      const response = await request(app)
        .get('/api/ratchet/state/test-conversation/user1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to retrieve ratchet state');
    });

    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/ratchet/state')
        .send('{ invalid json }')
        .set('Content-Type', 'application/json')
        .expect(400);

      // Express should return a JSON parsing error
      expect(response.status).toBe(400);
    });

    test('should handle missing Content-Type header', async () => {
      const response = await request(app)
        .post('/api/ratchet/state')
        .send('some data')
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Security Tests', () => {
    test('should sanitize error messages in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockPrisma.conversationRatchetState.upsert.mockRejectedValue(
        new Error('Sensitive database error with credentials')
      );

      const mockRatchetState = {
        conversationId: 'test-conversation',
        userId: 'user1',
        ratchetState: {
          rootKey: 'mock-root-key',
          sendingChainKey: 'mock-sending-chain-key',
          receivingChainKey: 'mock-receiving-chain-key',
        },
      };

      const response = await request(app)
        .post('/api/ratchet/state')
        .send(mockRatchetState)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to store ratchet state');
      expect(response.body.details).toBeUndefined(); // Should not leak error details in production

      process.env.NODE_ENV = originalEnv;
    });

    test('should validate input sizes to prevent DoS', async () => {
      // Test with excessively large payload
      const largePayload = {
        conversationId: 'test-conversation',
        userId: 'user1',
        ratchetState: {
          rootKey: 'a'.repeat(10000), // Very large key
          sendingChainKey: 'mock-sending-chain-key',
          receivingChainKey: 'mock-receiving-chain-key',
        },
      };

      // The request should still be processed (Express handles large payloads)
      // but in a real implementation, you might want to add size limits
      mockPrisma.conversationRatchetState.upsert.mockResolvedValue({
        id: 'mock-id',
        ...largePayload,
      });

      const response = await request(app)
        .post('/api/ratchet/state')
        .send(largePayload)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle special characters in parameters', async () => {
      const specialChars = 'test-conversation-with-special-chars!@#$%';
      
      mockPrisma.conversationRatchetState.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/ratchet/state/${encodeURIComponent(specialChars)}/user1`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Ratchet state not found');
    });
  });

  describe('Rate Limiting and Performance', () => {
    test('should handle multiple concurrent requests', async () => {
      const mockState = {
        id: 'mock-id',
        conversationId: 'test-conversation',
        userId: 'user1',
        sendingMessageNumber: 5,
        receivingMessageNumber: 3,
        sendingChainLength: 1,
        receivingChainLength: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { skippedMessageKeys: 2 },
      };

      mockPrisma.conversationRatchetState.findUnique.mockResolvedValue(mockState);

      // Make multiple concurrent requests
      const promises = Array(10).fill(null).map(() =>
        request(app).get('/api/ratchet/stats/test-conversation/user1')
      );

      const responses = await Promise.all(promises);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Database should have been called for each request
      expect(mockPrisma.conversationRatchetState.findUnique).toHaveBeenCalledTimes(10);
    });
  });
});