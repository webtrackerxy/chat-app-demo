/**
 * @jest-environment jsdom
 */

import { EncryptionService } from '../encryptionService'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

// Mock environment config
jest.mock('@config/env', () => ({
  getApiUrl: () => 'http://localhost:3000',
}))

// Mock fetch
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>

// Mock WebCrypto
const mockCrypto = {
  subtle: {
    generateKey: jest.fn(),
    exportKey: jest.fn(),
    importKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  },
  getRandomValues: jest.fn(),
  randomUUID: jest.fn(),
}

// Make crypto globally available
;(global as any).crypto = mockCrypto

describe('EncryptionService', () => {
  let encryptionService: EncryptionService
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>

  beforeEach(() => {
    encryptionService = EncryptionService.getInstance()
    jest.clearAllMocks()

    // Reset singleton instance for clean tests
    ;(EncryptionService as any).instance = undefined
    encryptionService = EncryptionService.getInstance()
  })

  describe('Singleton Pattern', () => {
    test('should return the same instance', () => {
      const instance1 = EncryptionService.getInstance()
      const instance2 = EncryptionService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })

  describe('User Key Management', () => {
    test('should generate user keys successfully', async () => {
      const userId = 'test-user-123'
      const password = 'test-password-123'

      // Mock key generation
      const mockKeyPair = {
        publicKey: { type: 'public' },
        privateKey: { type: 'private' },
      }

      mockCrypto.subtle.generateKey.mockResolvedValue(mockKeyPair as any)
      mockCrypto.subtle.exportKey
        .mockResolvedValueOnce(new ArrayBuffer(8)) // public key
        .mockResolvedValueOnce(new ArrayBuffer(8)) // private key

      // Mock API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              publicKey: 'mock-public-key',
              encryptedPrivateKey: 'mock-encrypted-private-key',
            },
          }),
      } as Response)

      await encryptionService.generateUserKeys(userId, password)

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt'],
      )

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/users/test-user-123/keys',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ password }),
        }),
      )

      expect(mockAsyncStorage.setItem).toHaveBeenCalledTimes(3)
    })

    test('should load existing keys from storage', async () => {
      const password = 'test-password'

      mockAsyncStorage.getItem
        .mockResolvedValueOnce('mock-public-key') // userPublicKey
        .mockResolvedValueOnce('mock-private-key') // userPrivateKey
        .mockResolvedValueOnce(password) // encryptionPassword

      mockCrypto.subtle.importKey.mockResolvedValue({ type: 'key' } as any)

      const result = await encryptionService.loadUserKeys(password)

      expect(result).toBe(true)
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledTimes(2)
    })

    test('should fail to load keys with wrong password', async () => {
      const correctPassword = 'correct-password'
      const wrongPassword = 'wrong-password'

      mockAsyncStorage.getItem
        .mockResolvedValueOnce('mock-public-key')
        .mockResolvedValueOnce('mock-private-key')
        .mockResolvedValueOnce(correctPassword)

      const result = await encryptionService.loadUserKeys(wrongPassword)

      expect(result).toBe(false)
    })

    test('should check if user has keys', async () => {
      // Test with keys
      mockAsyncStorage.getItem
        .mockResolvedValueOnce('public-key')
        .mockResolvedValueOnce('private-key')

      const hasKeys = await encryptionService.hasUserKeys()
      expect(hasKeys).toBe(true)

      // Test without keys
      mockAsyncStorage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce(null)

      const noKeys = await encryptionService.hasUserKeys()
      expect(noKeys).toBe(false)
    })
  })

  describe('Conversation Key Management', () => {
    test('should get conversation key from API', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'

      // Mock API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              keyId: 'key-123',
              encryptedKey: 'encrypted-conversation-key',
              conversationId,
            },
          }),
      } as Response)

      // Mock key decryption
      mockCrypto.subtle.decrypt.mockResolvedValue(new ArrayBuffer(32))
      mockCrypto.subtle.importKey.mockResolvedValue({ type: 'conversation-key' } as any)

      // Set up service with mock private key
      ;(encryptionService as any).userPrivateKey = { type: 'private-key' }

      const conversationKey = await encryptionService.getConversationKey(conversationId, userId)

      expect(conversationKey).toBeDefined()
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/conversations/conv-123/keys',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ userId }),
        }),
      )
    })

    test('should cache conversation keys', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'
      const mockKey = { type: 'conversation-key' }

      // Set up cached key
      ;(encryptionService as any).conversationKeys.set(conversationId, mockKey)

      const result = await encryptionService.getConversationKey(conversationId, userId)

      expect(result).toBe(mockKey)
      expect(mockFetch).not.toHaveBeenCalled()
    })

    test('should enable encryption for conversation', async () => {
      const conversationId = 'conv-123'

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { keyId: 'new-key-123' },
          }),
      } as Response)

      await encryptionService.enableEncryption(conversationId)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/conversations/conv-123/distribute-key',
        expect.objectContaining({
          method: 'POST',
        }),
      )
    })
  })

  describe('Message Encryption/Decryption', () => {
    beforeEach(() => {
      // Mock conversation key
      const mockKey = { type: 'conversation-key' }
      ;(encryptionService as any).conversationKeys.set('conv-123', mockKey)
    })

    test('should encrypt message', async () => {
      const text = 'Hello, secret message!'
      const conversationId = 'conv-123'
      const userId = 'user-123'

      // Mock encryption
      const mockEncrypted = new ArrayBuffer(32)
      const mockIV = new Uint8Array(12)
      mockCrypto.getRandomValues.mockReturnValue(mockIV)
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted)
      mockCrypto.randomUUID.mockReturnValue('key-id-123')

      const result = await encryptionService.encryptMessage(text, conversationId, userId)

      expect(result).toBeDefined()
      expect(typeof result).toBe('object')

      // Should be EncryptedPayload object
      const parsed = result
      expect(parsed).toHaveProperty('encryptedText')
      expect(parsed).toHaveProperty('iv')
      expect(parsed).toHaveProperty('tag')
      expect(parsed).toHaveProperty('keyId')
    })

    test('should decrypt message', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'

      // Mock decryption
      const originalText = 'Hello, secret message!'
      mockCrypto.subtle.decrypt.mockResolvedValue(new TextEncoder().encode(originalText).buffer)

      const payload = {
        encryptedText: 'encrypted-data',
        iv: 'initialization-vector',
        tag: 'auth-tag',
        keyId: 'key-id-123',
      }
      const result = await encryptionService.decryptMessage(payload, conversationId, userId)

      expect(result).toBe(originalText)
    })

    test('should handle encryption errors', async () => {
      const text = 'Test message'
      const conversationId = 'conv-123'
      const userId = 'user-123'

      mockCrypto.subtle.encrypt.mockRejectedValue(new Error('Encryption failed'))

      await expect(encryptionService.encryptMessage(text, conversationId, userId)).rejects.toThrow(
        'Encryption failed',
      )
    })

    test('should handle decryption errors', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'

      mockCrypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'))

      const invalidPayload = {
        encryptedText: 'invalid-data',
        iv: 'invalid-iv',
        tag: 'invalid-tag',
        keyId: 'invalid-key-id',
      }
      await expect(
        encryptionService.decryptMessage(invalidPayload, conversationId, userId),
      ).rejects.toThrow('Decryption failed')
    })
  })

  describe('Encryption Status', () => {
    test('should check if encryption is enabled', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response)

      const result = await encryptionService.isEncryptionEnabled(conversationId, userId)

      expect(result).toBe(true)
    })

    test('should return encryption status', () => {
      // Test without keys
      const statusWithoutKeys = encryptionService.getEncryptionStatus()
      expect(statusWithoutKeys.hasKeys).toBe(false)
      expect(statusWithoutKeys.keysLoaded).toBe(false)

      // Test with keys
      ;(encryptionService as any).userPublicKey = { type: 'public' }
      ;(encryptionService as any).userPrivateKey = { type: 'private' }

      const statusWithKeys = encryptionService.getEncryptionStatus()
      expect(statusWithKeys.hasKeys).toBe(true)
      expect(statusWithKeys.keysLoaded).toBe(true)
    })
  })

  describe('Key Management Operations', () => {
    test('should clear keys from memory', () => {
      // Set up some keys
      ;(encryptionService as any).userPublicKey = { type: 'public' }
      ;(encryptionService as any).userPrivateKey = { type: 'private' }
      ;(encryptionService as any).conversationKeys.set('conv-1', { type: 'key' })

      encryptionService.clearKeys()

      expect((encryptionService as any).userPublicKey).toBeNull()
      expect((encryptionService as any).userPrivateKey).toBeNull()
      expect((encryptionService as any).conversationKeys.size).toBe(0)
    })

    test('should remove keys from storage', async () => {
      await encryptionService.removeKeys()

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('userPublicKey')
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('userPrivateKey')
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('encryptionPassword')
    })

    test('should export user public key', async () => {
      const mockPublicKey = { type: 'public' }
      ;(encryptionService as any).userPublicKey = mockPublicKey

      mockCrypto.subtle.exportKey.mockResolvedValue(new ArrayBuffer(8))

      const result = await encryptionService.exportUserPublicKey()

      expect(result).toBeDefined()
      expect(typeof result).toBe('string')
    })
  })

  describe('Utility Functions', () => {
    test('should validate base64 keys', () => {
      const validBase64 = btoa('test-key-data')
      const invalidBase64 = 'not-base64!@#'

      expect(encryptionService.isValidKey(validBase64)).toBe(true)
      expect(encryptionService.isValidKey(invalidBase64)).toBe(false)
    })

    test('should generate secure passwords', () => {
      const password1 = encryptionService.generateSecurePassword()
      const password2 = encryptionService.generateSecurePassword()

      expect(password1).toBeDefined()
      expect(password2).toBeDefined()
      expect(password1).not.toBe(password2)
      expect(password1.length).toBe(32)
      expect(password2.length).toBe(32)
    })

    test('should generate custom length passwords', () => {
      const shortPassword = encryptionService.generateSecurePassword()
      const longPassword = encryptionService.generateSecurePassword()

      expect(shortPassword.length).toBe(16)
      expect(longPassword.length).toBe(64)
    })
  })

  describe('Error Handling', () => {
    test('should handle API failures gracefully', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      } as Response)

      await expect(encryptionService.getConversationKey(conversationId, userId)).rejects.toThrow()
    })

    test('should handle missing private key', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'

      // Clear private key
      ;(encryptionService as any).userPrivateKey = null

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: { encryptedKey: 'test-key' },
          }),
      } as Response)

      await expect(encryptionService.getConversationKey(conversationId, userId)).rejects.toThrow(
        'User private key not loaded',
      )
    })

    test('should handle network errors', async () => {
      const userId = 'user-123'
      const password = 'test-password'

      mockFetch.mockRejectedValue(new Error('Network error'))

      // Mock successful key generation
      mockCrypto.subtle.generateKey.mockResolvedValue({
        publicKey: {},
        privateKey: {},
      } as any)
      mockCrypto.subtle.exportKey.mockResolvedValue(new ArrayBuffer(8))

      await expect(encryptionService.generateUserKeys(userId, password)).rejects.toThrow()
    })
  })

  describe('Concurrent Operations', () => {
    test('should handle multiple encryption operations', async () => {
      const conversationId = 'conv-123'
      const userId = 'user-123'

      // Set up mock conversation key
      const mockKey = { type: 'conversation-key' }
      ;(encryptionService as any).conversationKeys.set(conversationId, mockKey)

      // Mock successful encryption
      mockCrypto.getRandomValues.mockReturnValue(new Uint8Array(12))
      mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32))
      mockCrypto.randomUUID.mockReturnValue('key-id')

      const operations = Array.from({ length: 5 }, (_, i) =>
        encryptionService.encryptMessage(`Message ${i}`, conversationId, userId),
      )

      const results = await Promise.all(operations)

      expect(results).toHaveLength(5)
      results.forEach((result) => {
        expect(typeof result).toBe('string')
        expect(typeof result).toBe('object')
      })
    })
  })
})
