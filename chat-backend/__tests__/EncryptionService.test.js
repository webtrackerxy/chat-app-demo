const EncryptionService = require('../src/services/EncryptionService')
const { PrismaClient } = require('../generated/prisma')

// Mock Prisma Client
jest.mock('../generated/prisma', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      update: jest.fn(),
      findUnique: jest.fn(),
    },
    conversationKey: {
      findFirst: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    conversationParticipant: {
      findMany: jest.fn(),
    },
  })),
}))

describe('EncryptionService', () => {
  let encryptionService
  let mockPrisma

  beforeEach(() => {
    mockPrisma = new PrismaClient()
    encryptionService = new EncryptionService(mockPrisma)
    // Clear all mocks
    jest.clearAllMocks()
  })

  describe('Key Generation', () => {
    test('should generate RSA key pair', () => {
      const { publicKey, privateKey } = encryptionService.generateUserKeyPair()
      
      expect(publicKey).toBeDefined()
      expect(privateKey).toBeDefined()
      expect(typeof publicKey).toBe('string')
      expect(typeof privateKey).toBe('string')
      expect(publicKey).toContain('BEGIN PUBLIC KEY')
      expect(privateKey).toContain('BEGIN PRIVATE KEY')
    })

    test('should generate conversation key', () => {
      const conversationKey = encryptionService.generateConversationKey()
      
      expect(conversationKey).toBeDefined()
      expect(conversationKey).toBeInstanceOf(Buffer)
      expect(conversationKey.length).toBe(32) // 256 bits
    })

    test('should generate unique key IDs', () => {
      const keyId1 = encryptionService.generateKeyId()
      const keyId2 = encryptionService.generateKeyId()
      
      expect(keyId1).toBeDefined()
      expect(keyId2).toBeDefined()
      expect(keyId1).not.toBe(keyId2)
      expect(keyId1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })
  })

  describe('Text Encryption/Decryption', () => {
    test('should encrypt and decrypt text correctly', () => {
      const originalText = 'Hello, this is a secret message! 🔐'
      const key = encryptionService.generateConversationKey()
      
      const encrypted = encryptionService.encryptText(originalText, key)
      expect(encrypted).toHaveProperty('encryptedText')
      expect(encrypted).toHaveProperty('iv')
      expect(encrypted).toHaveProperty('tag')
      
      const decrypted = encryptionService.decryptText(encrypted, key)
      expect(decrypted).toBe(originalText)
    })

    test('should handle unicode characters', () => {
      const originalText = 'Hello 世界! 🌍🚀💬 Testing émojis and ñ characters'
      const key = encryptionService.generateConversationKey()
      
      const encrypted = encryptionService.encryptText(originalText, key)
      const decrypted = encryptionService.decryptText(encrypted, key)
      
      expect(decrypted).toBe(originalText)
    })

    test('should fail decryption with wrong key', () => {
      const originalText = 'Secret message'
      const key1 = encryptionService.generateConversationKey()
      const key2 = encryptionService.generateConversationKey()
      
      const encrypted = encryptionService.encryptText(originalText, key1)
      
      expect(() => {
        encryptionService.decryptText(encrypted, key2)
      }).toThrow('Decryption failed')
    })

    test('should fail with tampered ciphertext', () => {
      const originalText = 'Secret message'
      const key = encryptionService.generateConversationKey()
      
      const encrypted = encryptionService.encryptText(originalText, key)
      // Tamper with the encrypted text
      encrypted.encryptedText = encrypted.encryptedText.slice(0, -10) + 'tampered123'
      
      expect(() => {
        encryptionService.decryptText(encrypted, key)
      }).toThrow('Decryption failed')
    })
  })

  describe('Private Key Encryption', () => {
    test('should encrypt and decrypt private key with password', () => {
      const { privateKey } = encryptionService.generateUserKeyPair()
      const password = 'strong-password-123'
      
      const encrypted = encryptionService.encryptPrivateKey(privateKey, password)
      expect(encrypted).toHaveProperty('encryptedPrivateKey')
      expect(encrypted).toHaveProperty('salt')
      expect(encrypted).toHaveProperty('iv')
      expect(encrypted).toHaveProperty('tag')
      
      const decrypted = encryptionService.decryptPrivateKey(encrypted, password)
      expect(decrypted).toBe(privateKey)
    })

    test('should fail with wrong password', () => {
      const { privateKey } = encryptionService.generateUserKeyPair()
      const password = 'correct-password'
      const wrongPassword = 'wrong-password'
      
      const encrypted = encryptionService.encryptPrivateKey(privateKey, password)
      
      expect(() => {
        encryptionService.decryptPrivateKey(encrypted, wrongPassword)
      }).toThrow('Private key decryption failed')
    })
  })

  describe('RSA Key Exchange', () => {
    test('should encrypt and decrypt conversation key with RSA', () => {
      const { publicKey, privateKey } = encryptionService.generateUserKeyPair()
      const conversationKey = encryptionService.generateConversationKey()
      
      const encryptedKey = encryptionService.encryptConversationKey(conversationKey, publicKey)
      expect(typeof encryptedKey).toBe('string')
      
      const decryptedKey = encryptionService.decryptConversationKey(encryptedKey, privateKey)
      expect(Buffer.compare(conversationKey, decryptedKey)).toBe(0)
    })

    test('should fail with wrong private key', () => {
      const { publicKey } = encryptionService.generateUserKeyPair()
      const { privateKey: wrongPrivateKey } = encryptionService.generateUserKeyPair()
      const conversationKey = encryptionService.generateConversationKey()
      
      const encryptedKey = encryptionService.encryptConversationKey(conversationKey, publicKey)
      
      expect(() => {
        encryptionService.decryptConversationKey(encryptedKey, wrongPrivateKey)
      }).toThrow('Conversation key decryption failed')
    })
  })

  describe('Database Integration', () => {
    test('should create user keys in database', async () => {
      const userId = 'test-user-123'
      const password = 'test-password'
      
      mockPrisma.user.update.mockResolvedValue({
        id: userId,
        publicKey: 'mock-public-key',
        privateKey: 'mock-encrypted-private-key',
      })
      
      const result = await encryptionService.createUserKeys(userId, password)
      
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          publicKey: expect.any(String),
          privateKey: expect.any(String),
        },
      })
      
      expect(result).toHaveProperty('publicKey')
      expect(result).toHaveProperty('encryptedPrivateKey')
    })

    test('should get or create conversation key', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'
      
      // Mock user with public key
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: encryptionService.generateUserKeyPair().publicKey,
      })
      
      // Mock no existing conversation key
      mockPrisma.conversationKey.findFirst.mockResolvedValue(null)
      
      // Mock create conversation key
      mockPrisma.conversationKey.create.mockResolvedValue({
        id: 'key-123',
        conversationId,
        userId,
        keyId: 'test-key-id',
        encryptedKey: 'encrypted-key-data',
      })
      
      const result = await encryptionService.getOrCreateConversationKey(conversationId, userId)
      
      expect(result).toHaveProperty('keyId')
      expect(result).toHaveProperty('encryptedKey')
      expect(mockPrisma.conversationKey.create).toHaveBeenCalled()
    })

    test('should distribute conversation key to participants', async () => {
      const conversationId = 'conv-123'
      const participants = [
        {
          user: {
            id: 'user1',
            publicKey: encryptionService.generateUserKeyPair().publicKey,
          },
        },
        {
          user: {
            id: 'user2',
            publicKey: encryptionService.generateUserKeyPair().publicKey,
          },
        },
      ]
      
      mockPrisma.conversationParticipant.findMany.mockResolvedValue(participants)
      mockPrisma.conversationKey.upsert.mockResolvedValue({})
      
      const keyId = await encryptionService.distributeConversationKey(conversationId)
      
      expect(typeof keyId).toBe('string')
      expect(mockPrisma.conversationKey.upsert).toHaveBeenCalledTimes(2)
    })

    test('should check if user has keys', async () => {
      const userId = 'user-123'
      
      // Test user with keys
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: 'public-key',
        privateKey: 'private-key',
      })
      
      const hasKeys = await encryptionService.hasUserKeys(userId)
      expect(hasKeys).toBe(true)
      
      // Test user without keys
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: null,
        privateKey: null,
      })
      
      const hasNoKeys = await encryptionService.hasUserKeys(userId)
      expect(hasNoKeys).toBe(false)
    })
  })

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const userId = 'test-user'
      const password = 'test-password'
      
      mockPrisma.user.update.mockRejectedValue(new Error('Database connection failed'))
      
      await expect(encryptionService.createUserKeys(userId, password))
        .rejects.toThrow('Failed to create user keys')
    })

    test('should handle missing user public key', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'
      
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        publicKey: null,
      })
      
      await expect(encryptionService.getOrCreateConversationKey(conversationId, userId))
        .rejects.toThrow('User does not have encryption keys set up')
    })

    test('should handle invalid encryption data', () => {
      const key = encryptionService.generateConversationKey()
      const invalidData = {
        encryptedText: 'invalid-base64!@#',
        iv: 'invalid-iv',
        tag: 'invalid-tag',
      }
      
      expect(() => {
        encryptionService.decryptText(invalidData, key)
      }).toThrow('Decryption failed')
    })
  })

  describe('Security Properties', () => {
    test('should generate different IVs for each encryption', () => {
      const text = 'Same message'
      const key = encryptionService.generateConversationKey()
      
      const encrypted1 = encryptionService.encryptText(text, key)
      const encrypted2 = encryptionService.encryptText(text, key)
      
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
      expect(encrypted1.encryptedText).not.toBe(encrypted2.encryptedText)
      
      // But both should decrypt to the same text
      expect(encryptionService.decryptText(encrypted1, key)).toBe(text)
      expect(encryptionService.decryptText(encrypted2, key)).toBe(text)
    })

    test('should use different salts for password encryption', () => {
      const privateKey = 'test-private-key'
      const password = 'same-password'
      
      const encrypted1 = encryptionService.encryptPrivateKey(privateKey, password)
      const encrypted2 = encryptionService.encryptPrivateKey(privateKey, password)
      
      expect(encrypted1.salt).not.toBe(encrypted2.salt)
      expect(encrypted1.encryptedPrivateKey).not.toBe(encrypted2.encryptedPrivateKey)
    })

    test('should handle empty and edge case inputs', () => {
      const key = encryptionService.generateConversationKey()
      
      // Empty string
      const emptyEncrypted = encryptionService.encryptText('', key)
      expect(encryptionService.decryptText(emptyEncrypted, key)).toBe('')
      
      // Single character
      const singleCharEncrypted = encryptionService.encryptText('a', key)
      expect(encryptionService.decryptText(singleCharEncrypted, key)).toBe('a')
      
      // Very long text
      const longText = 'a'.repeat(10000)
      const longEncrypted = encryptionService.encryptText(longText, key)
      expect(encryptionService.decryptText(longEncrypted, key)).toBe(longText)
    })
  })

  describe('Performance', () => {
    test('should encrypt/decrypt within reasonable time', () => {
      const text = 'Performance test message with reasonable length for timing'
      const key = encryptionService.generateConversationKey()
      
      const startTime = Date.now()
      const encrypted = encryptionService.encryptText(text, key)
      const encryptTime = Date.now() - startTime
      
      const decryptStart = Date.now()
      const decrypted = encryptionService.decryptText(encrypted, key)
      const decryptTime = Date.now() - decryptStart
      
      expect(decrypted).toBe(text)
      expect(encryptTime).toBeLessThan(100) // Should be under 100ms
      expect(decryptTime).toBeLessThan(100) // Should be under 100ms
    })

    test('should handle concurrent operations', async () => {
      const text = 'Concurrent test message'
      const key = encryptionService.generateConversationKey()
      
      const operations = Array.from({ length: 10 }, () =>
        Promise.resolve().then(() => {
          const encrypted = encryptionService.encryptText(text, key)
          return encryptionService.decryptText(encrypted, key)
        }),
      )
      
      const results = await Promise.all(operations)
      results.forEach(result => {
        expect(result).toBe(text)
      })
    })
  })
})