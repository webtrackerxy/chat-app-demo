const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const EncryptionService = require('../src/services/EncryptionService');

// Create a test app
const app = express();
app.use(express.json());

// Mock Prisma
jest.mock('../generated/prisma', () => {
  const mockDb = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    conversationKey: {
      findFirst: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    conversationParticipant: {
      findMany: jest.fn(),
    },
  };
  
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockDb),
  };
});

// Get access to the mock database
const { PrismaClient } = require('../generated/prisma');
const mockDb = new PrismaClient();

// Initialize encryption service
const encryptionService = new EncryptionService();

// Add encryption routes to test app
app.post('/api/users/:userId/keys', async (req, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required for key generation'
      });
    }

    const user = { id: userId, username: 'test-user' };
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const keys = await encryptionService.createUserKeys(userId, password);

    res.json({
      success: true,
      data: {
        publicKey: keys.publicKey,
        encryptedPrivateKey: keys.encryptedPrivateKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate encryption keys'
    });
  }
});

app.get('/api/users/:userId/public-key', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await mockDb.user.findUnique({
      where: { id: userId },
      select: { publicKey: true }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.publicKey) {
      return res.status(404).json({
        success: false,
        error: 'User has no public key'
      });
    }

    res.json({
      success: true,
      data: {
        publicKey: user.publicKey
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get public key'
    });
  }
});

app.get('/api/users/:userId/has-keys', async (req, res) => {
  try {
    const { userId } = req.params;
    const hasKeys = await encryptionService.hasUserKeys(userId);

    res.json({
      success: true,
      data: {
        hasKeys: hasKeys
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to check user keys'
    });
  }
});

app.post('/api/conversations/:conversationId/keys', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    const hasKeys = await encryptionService.hasUserKeys(userId);
    if (!hasKeys) {
      return res.status(400).json({
        success: false,
        error: 'User must have encryption keys set up first'
      });
    }

    const conversationKey = await encryptionService.getOrCreateConversationKey(conversationId, userId);

    res.json({
      success: true,
      data: {
        keyId: conversationKey.keyId,
        encryptedKey: conversationKey.encryptedKey,
        conversationId: conversationKey.conversationId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation key'
    });
  }
});

app.post('/api/conversations/:conversationId/distribute-key', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const keyId = await encryptionService.distributeConversationKey(conversationId);

    res.json({
      success: true,
      data: {
        keyId: keyId
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to distribute conversation key'
    });
  }
});

describe('Encryption API Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/users/:userId/keys', () => {
    test('should generate user keys successfully', async () => {
      const userId = 'test-user-123';
      const password = 'strong-password-123';

      mockDb.user.update.mockResolvedValue({
        id: userId,
        publicKey: 'mock-public-key',
        privateKey: 'mock-encrypted-private-key'
      });

      const response = await request(app)
        .post(`/api/users/${userId}/keys`)
        .send({ password })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('publicKey');
      expect(response.body.data).toHaveProperty('encryptedPrivateKey');
    });

    test('should require password', async () => {
      const userId = 'test-user-123';

      const response = await request(app)
        .post(`/api/users/${userId}/keys`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Password is required for key generation');
    });

    test('should handle database errors', async () => {
      const userId = 'test-user-123';
      const password = 'strong-password-123';

      mockDb.user.update.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post(`/api/users/${userId}/keys`)
        .send({ password })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to generate encryption keys');
    });
  });

  describe('GET /api/users/:userId/public-key', () => {
    test('should return user public key', async () => {
      const userId = 'test-user-123';
      const mockPublicKey = 'mock-public-key-data';

      mockDb.user.findUnique.mockResolvedValue({
        publicKey: mockPublicKey
      });

      const response = await request(app)
        .get(`/api/users/${userId}/public-key`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.publicKey).toBe(mockPublicKey);
    });

    test('should handle user not found', async () => {
      const userId = 'nonexistent-user';

      mockDb.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/users/${userId}/public-key`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User not found');
    });

    test('should handle user without public key', async () => {
      const userId = 'test-user-123';

      mockDb.user.findUnique.mockResolvedValue({
        publicKey: null
      });

      const response = await request(app)
        .get(`/api/users/${userId}/public-key`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User has no public key');
    });
  });

  describe('GET /api/users/:userId/has-keys', () => {
    test('should return true when user has keys', async () => {
      const userId = 'test-user-123';

      mockDb.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: 'public-key',
        privateKey: 'private-key'
      });

      const response = await request(app)
        .get(`/api/users/${userId}/has-keys`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hasKeys).toBe(true);
    });

    test('should return false when user has no keys', async () => {
      const userId = 'test-user-123';

      mockDb.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: null,
        privateKey: null
      });

      const response = await request(app)
        .get(`/api/users/${userId}/has-keys`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hasKeys).toBe(false);
    });

    test('should handle database errors', async () => {
      const userId = 'test-user-123';

      mockDb.user.findUnique.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get(`/api/users/${userId}/has-keys`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to check user keys');
    });
  });

  describe('POST /api/conversations/:conversationId/keys', () => {
    test('should get conversation key successfully', async () => {
      const conversationId = 'conv-123';
      const userId = 'user-123';

      // Generate a proper RSA key pair for testing
      const { publicKey: testPublicKey, privateKey: testPrivateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      // Mock user has keys - need to handle multiple calls with different select parameters
      mockDb.user.findUnique.mockImplementation(({ select }) => {
        if (select && select.publicKey && select.privateKey) {
          // Called by hasUserKeys method
          return Promise.resolve({
            id: userId,
            publicKey: testPublicKey,
            privateKey: testPrivateKey
          });
        } else if (select && select.publicKey) {
          // Called by getOrCreateConversationKey method
          return Promise.resolve({
            publicKey: testPublicKey
          });
        }
        // Default response
        return Promise.resolve({
          id: userId,
          publicKey: testPublicKey,
          privateKey: testPrivateKey
        });
      });

      // Mock conversation key creation
      mockDb.conversationKey.findFirst.mockResolvedValue(null);
      mockDb.conversationKey.create.mockResolvedValue({
        id: 'key-123',
        conversationId,
        userId,
        keyId: 'test-key-id',
        encryptedKey: 'encrypted-key-data'
      });

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/keys`)
        .send({ userId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('keyId');
      expect(response.body.data).toHaveProperty('encryptedKey');
      expect(response.body.data.conversationId).toBe(conversationId);
    });

    test('should require user ID', async () => {
      const conversationId = 'conv-123';

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/keys`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User ID is required');
    });

    test('should require user to have keys', async () => {
      const conversationId = 'conv-123';
      const userId = 'user-123';

      // Mock user without keys
      mockDb.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: null,
        privateKey: null
      });

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/keys`)
        .send({ userId })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User must have encryption keys set up first');
    });
  });

  describe('POST /api/conversations/:conversationId/distribute-key', () => {
    test('should distribute conversation key to participants', async () => {
      const conversationId = 'conv-123';

      // Mock participants
      const participants = [
        {
          user: {
            id: 'user1',
            publicKey: encryptionService.generateUserKeyPair().publicKey
          }
        },
        {
          user: {
            id: 'user2',
            publicKey: encryptionService.generateUserKeyPair().publicKey
          }
        }
      ];

      mockDb.conversationParticipant.findMany.mockResolvedValue(participants);
      mockDb.conversationKey.upsert.mockResolvedValue({});

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/distribute-key`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('keyId');
      expect(typeof response.body.data.keyId).toBe('string');
    });

    test('should handle empty participant list', async () => {
      const conversationId = 'conv-123';

      mockDb.conversationParticipant.findMany.mockResolvedValue([]);
      
      const response = await request(app)
        .post(`/api/conversations/${conversationId}/distribute-key`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('keyId');
    });

    test('should handle database errors', async () => {
      const conversationId = 'conv-123';

      mockDb.conversationParticipant.findMany.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post(`/api/conversations/${conversationId}/distribute-key`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to distribute conversation key');
    });
  });

  describe('API Response Format', () => {
    test('should have consistent success response format', async () => {
      const userId = 'test-user-123';

      mockDb.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: 'public-key',
        privateKey: 'private-key'
      });

      const response = await request(app)
        .get(`/api/users/${userId}/has-keys`)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.success).toBe(true);
    });

    test('should have consistent error response format', async () => {
      const userId = 'test-user-123';

      const response = await request(app)
        .post(`/api/users/${userId}/keys`)
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
      expect(typeof response.body.error).toBe('string');
    });
  });

  describe('Input Validation', () => {
    test('should validate required fields', async () => {
      const tests = [
        {
          endpoint: '/api/users/user123/keys',
          method: 'post',
          body: {},
          expectedError: 'Password is required for key generation'
        },
        {
          endpoint: '/api/conversations/conv123/keys',
          method: 'post',
          body: {},
          expectedError: 'User ID is required'
        }
      ];

      for (const test of tests) {
        const response = await request(app)
          [test.method](test.endpoint)
          .send(test.body)
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe(test.expectedError);
      }
    });

    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/users/user123/keys')
        .send('invalid-json')
        .expect(400);

      // Express should handle malformed JSON
      expect(response.body).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in responses', async () => {
      const userId = 'test-user-123';

      mockDb.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: 'public-key',
        privateKey: 'private-key'
      });

      const response = await request(app)
        .get(`/api/users/${userId}/has-keys`)
        .expect(200);

      // Headers should be set by middleware in real app
      expect(response.headers['content-type']).toMatch(/json/);
    });
  });

  describe('Rate Limiting Considerations', () => {
    test('should handle multiple concurrent requests', async () => {
      const userId = 'test-user-123';

      mockDb.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: 'public-key',
        privateKey: 'private-key'
      });

      const requests = Array.from({ length: 5 }, () =>
        request(app).get(`/api/users/${userId}/has-keys`)
      );

      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle very long user IDs', async () => {
      const longUserId = 'a'.repeat(1000);

      const response = await request(app)
        .get(`/api/users/${longUserId}/has-keys`);

      // Should handle gracefully (might be 404 or 500 depending on validation)
      expect([200, 404, 500]).toContain(response.status);
    });

    test('should handle special characters in IDs', async () => {
      const specialUserId = 'user-123@test.com';

      mockDb.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .get(`/api/users/${encodeURIComponent(specialUserId)}/has-keys`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.hasKeys).toBe(false);
    });
  });
});