import {
  EncryptedPayload,
  ConversationKey,
  KeyPair,
  ENCRYPTION_CONFIG,
  isValidBase64Key,
  generateSecurePassword,
} from '@chat-types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getApiUrl } from '@config/env'
import { encryptionDebug } from '@utils/encryptionDebug'

// Mock implementations for crypto functions that are not available in React Native
// These are for demo purposes only - do not use in production without proper encryption
const mockCryptoFunctions = {
  generateConversationKey: async (): Promise<CryptoKey> => {
    console.warn('Mock crypto: generateConversationKey called - not secure for production')
    // Return a mock CryptoKey with some identifiable properties
    return {
      type: 'secret',
      extractable: true,
      algorithm: { name: 'AES-GCM', length: 256 },
      usages: ['encrypt', 'decrypt'],
      // Add a unique ID for debugging
      mockId: 'conv-key-' + Math.random().toString(36).substr(2, 9),
    } as any
  },
  generateUserKeyPair: async (): Promise<CryptoKeyPair> => {
    console.warn('Mock crypto: generateUserKeyPair called - not secure for production')
    const keyId = Math.random().toString(36).substr(2, 9)
    return {
      publicKey: {
        type: 'public',
        extractable: true,
        algorithm: { name: 'RSA-OAEP', modulusLength: 2048 },
        usages: ['encrypt'],
        mockId: 'pub-key-' + keyId,
      } as any,
      privateKey: {
        type: 'private',
        extractable: true,
        algorithm: { name: 'RSA-OAEP', modulusLength: 2048 },
        usages: ['decrypt'],
        mockId: 'priv-key-' + keyId,
      } as any,
    }
  },
  generateKeyId: (): string => {
    return 'mock-key-id-' + Math.random().toString(36).substr(2, 9)
  },
  encryptText: async (text: string, key: CryptoKey): Promise<EncryptedPayload> => {
    console.warn('Mock crypto: encryptText called - not secure for production')
    // Return mock encrypted payload (not actually encrypted)
    return {
      encryptedText: btoa(text), // Just base64 encode for demo
      iv: 'mock-iv-' + Math.random().toString(36).substr(2, 9),
      tag: 'mock-tag-' + Math.random().toString(36).substr(2, 9),
      keyId: 'mock-key-id',
    }
  },
  decryptText: async (payload: EncryptedPayload, key: CryptoKey): Promise<string> => {
    console.warn('Mock crypto: decryptText called - not secure for production')
    // Just base64 decode for demo
    try {
      return atob(payload.encryptedText)
    } catch {
      return payload.encryptedText // Return as-is if not base64
    }
  },
  encryptConversationKey: async (
    conversationKey: CryptoKey,
    userPublicKey: CryptoKey,
  ): Promise<string> => {
    console.warn('Mock crypto: encryptConversationKey called - not secure for production')
    return 'mock-encrypted-key-' + Math.random().toString(36).substr(2, 9)
  },
  decryptConversationKey: async (
    encryptedKey: string,
    userPrivateKey: CryptoKey,
  ): Promise<CryptoKey> => {
    console.warn('Mock crypto: decryptConversationKey called - not secure for production')
    return {} as CryptoKey
  },
  exportKey: async (key: CryptoKey): Promise<string> => {
    console.warn('Mock crypto: exportKey called - not secure for production')
    return 'mock-exported-key-' + Math.random().toString(36).substr(2, 9)
  },
  importKey: async (keyData: string): Promise<CryptoKey> => {
    console.warn('Mock crypto: importKey called - not secure for production')
    return {} as CryptoKey
  },
  exportKeyPair: async (keyPair: CryptoKeyPair): Promise<KeyPair> => {
    console.warn('Mock crypto: exportKeyPair called - not secure for production')
    return {
      publicKey: 'mock-public-key-' + Math.random().toString(36).substr(2, 9),
      privateKey: 'mock-private-key-' + Math.random().toString(36).substr(2, 9),
    }
  },
  importPublicKey: async (publicKeyData: string): Promise<CryptoKey> => {
    console.warn('Mock crypto: importPublicKey called - not secure for production')
    return {} as CryptoKey
  },
  importPrivateKey: async (privateKeyData: string): Promise<CryptoKey> => {
    console.warn('Mock crypto: importPrivateKey called - not secure for production')
    return {} as CryptoKey
  },
}

export class EncryptionService {
  private static instance: EncryptionService
  private conversationKeys: Map<string, CryptoKey> = new Map()
  private userPrivateKey: CryptoKey | null = null
  private userPublicKey: CryptoKey | null = null
  private apiBaseUrl: string

  private constructor() {
    this.apiBaseUrl = `${getApiUrl()}/api`
  }

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService()
    }
    return EncryptionService.instance
  }

  /**
   * Private method to make API requests
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        ...options,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('API request failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Generate encryption keys for the current user
   */
  async generateUserKeys(userId: string, password: string): Promise<void> {
    try {
      console.log('Demo mode: Generating user keys locally')

      // Generate key pair
      const keyPair = await mockCryptoFunctions.generateUserKeyPair()
      const exportedKeyPair = await mockCryptoFunctions.exportKeyPair(keyPair)

      // Debug trace
      encryptionDebug.traceKeyGeneration(userId, 'user', (keyPair.publicKey as any).mockId)

      // In demo mode, skip API calls and store keys locally
      await AsyncStorage.setItem('userPublicKey', exportedKeyPair.publicKey)
      await AsyncStorage.setItem('userPrivateKey', exportedKeyPair.privateKey)
      await AsyncStorage.setItem('encryptionPassword', password)
      await AsyncStorage.setItem('encryptionUserId', userId)

      // Load keys into memory
      this.userPublicKey = keyPair.publicKey
      this.userPrivateKey = keyPair.privateKey

      console.log('Demo mode: Keys generated and stored locally')
    } catch (error) {
      console.error('Error generating user keys:', error)
      encryptionDebug.traceError(
        'generateUserKeys',
        error instanceof Error ? error : new Error(String(error)),
        userId,
      )
      throw error
    }
  }

  /**
   * Load user's encryption keys from storage
   */
  async loadUserKeys(password: string): Promise<boolean> {
    try {
      const publicKeyData = await AsyncStorage.getItem('userPublicKey')
      const privateKeyData = await AsyncStorage.getItem('userPrivateKey')
      const storedPassword = await AsyncStorage.getItem('encryptionPassword')
      const storedUserId = await AsyncStorage.getItem('encryptionUserId')

      if (!publicKeyData || !privateKeyData || !storedPassword) {
        encryptionDebug.traceKeyLoading(storedUserId || 'unknown', false, 'user')
        return false
      }

      // Verify password
      if (storedPassword !== password) {
        encryptionDebug.traceError(
          'loadUserKeys',
          new Error('Invalid password'),
          storedUserId || 'unknown',
        )
        throw new Error('Invalid password')
      }

      // Import keys
      this.userPublicKey = await mockCryptoFunctions.importPublicKey(publicKeyData)
      this.userPrivateKey = await mockCryptoFunctions.importPrivateKey(privateKeyData)

      encryptionDebug.traceKeyLoading(storedUserId || 'unknown', true, 'user')
      return true
    } catch (error) {
      const storedUserId = await AsyncStorage.getItem('encryptionUserId')
      console.error('Error loading user keys:', error)
      encryptionDebug.traceError(
        'loadUserKeys',
        error instanceof Error ? error : new Error(String(error)),
        storedUserId || 'unknown',
      )
      return false
    }
  }

  /**
   * Check if user has encryption keys
   */
  async hasUserKeys(): Promise<boolean> {
    const publicKeyData = await AsyncStorage.getItem('userPublicKey')
    const privateKeyData = await AsyncStorage.getItem('userPrivateKey')
    return !!(publicKeyData && privateKeyData)
  }

  /**
   * Get or create conversation key for encryption
   */
  async getConversationKey(conversationId: string, userId: string): Promise<CryptoKey> {
    // Check if we already have the key in memory
    if (this.conversationKeys.has(conversationId)) {
      return this.conversationKeys.get(conversationId)!
    }

    try {
      console.log('Demo mode: Getting conversation key locally')

      // In demo mode, generate a mock conversation key locally
      const conversationKey = await mockCryptoFunctions.generateConversationKey()

      // Store in memory for future use
      this.conversationKeys.set(conversationId, conversationKey)

      return conversationKey
    } catch (error) {
      console.error('Error getting conversation key:', error)
      throw error
    }
  }

  /**
   * Encrypt a message for a conversation
   */
  async encryptMessage(
    text: string,
    conversationId: string,
    userId: string,
  ): Promise<EncryptedPayload> {
    try {
      const conversationKey = await this.getConversationKey(conversationId, userId)
      const encryptedPayload = await mockCryptoFunctions.encryptText(text, conversationKey)

      // Debug trace
      encryptionDebug.traceMessageEncryption(text, encryptedPayload, userId, conversationId)

      return encryptedPayload
    } catch (error) {
      console.error('Error encrypting message:', error)
      encryptionDebug.traceError(
        'encryptMessage',
        error instanceof Error ? error : new Error(String(error)),
        userId,
        conversationId,
      )
      throw error
    }
  }

  /**
   * Decrypt a message from a conversation
   */
  async decryptMessage(
    encryptedPayload: EncryptedPayload,
    conversationId: string,
    userId: string,
  ): Promise<string> {
    try {
      const conversationKey = await this.getConversationKey(conversationId, userId)
      const decryptedText = await mockCryptoFunctions.decryptText(encryptedPayload, conversationKey)

      // Debug trace
      encryptionDebug.traceMessageDecryption(
        encryptedPayload,
        decryptedText,
        userId,
        conversationId,
      )

      return decryptedText
    } catch (error) {
      console.error('Error decrypting message:', error)
      encryptionDebug.traceError(
        'decryptMessage',
        error instanceof Error ? error : new Error(String(error)),
        userId,
        conversationId,
      )
      throw error
    }
  }

  /**
   * Check if encryption is enabled for a conversation
   */
  async isEncryptionEnabled(conversationId: string, userId: string): Promise<boolean> {
    try {
      console.log('Demo mode: Checking encryption status locally')
      // In demo mode, check if we have a conversation key
      return this.conversationKeys.has(conversationId)
    } catch (error) {
      return false
    }
  }

  /**
   * Enable encryption for a conversation
   */
  async enableEncryption(conversationId: string): Promise<void> {
    try {
      console.log('Demo mode: Enabling encryption locally')
      // In demo mode, just generate a conversation key to enable encryption
      const conversationKey = await mockCryptoFunctions.generateConversationKey()
      this.conversationKeys.set(conversationId, conversationKey)

      // Debug trace
      const storedUserId = await AsyncStorage.getItem('encryptionUserId')
      encryptionDebug.traceEncryptionToggle(conversationId, true, storedUserId || 'unknown')
      encryptionDebug.traceKeyGeneration(
        storedUserId || 'unknown',
        'conversation',
        (conversationKey as any).mockId,
      )
    } catch (error) {
      console.error('Error enabling encryption:', error)
      const storedUserId = await AsyncStorage.getItem('encryptionUserId')
      encryptionDebug.traceError(
        'enableEncryption',
        error instanceof Error ? error : new Error(String(error)),
        storedUserId || 'unknown',
        conversationId,
      )
      throw error
    }
  }

  /**
   * Clear encryption keys from memory (for logout)
   */
  clearKeys(): void {
    this.conversationKeys.clear()
    this.userPrivateKey = null
    this.userPublicKey = null
  }

  /**
   * Remove encryption keys from storage
   */
  async removeKeys(): Promise<void> {
    await AsyncStorage.removeItem('userPublicKey')
    await AsyncStorage.removeItem('userPrivateKey')
    await AsyncStorage.removeItem('encryptionPassword')
    this.clearKeys()
  }

  /**
   * Get encryption status for UI
   */
  getEncryptionStatus(): {
    hasKeys: boolean
    keysLoaded: boolean
  } {
    return {
      hasKeys: this.userPublicKey !== null && this.userPrivateKey !== null,
      keysLoaded: this.userPublicKey !== null && this.userPrivateKey !== null,
    }
  }

  /**
   * Generate a secure password for key encryption
   */
  generateSecurePassword(): string {
    return generateSecurePassword(32)
  }

  /**
   * Validate if a string is properly formatted base64
   */
  isValidKey(key: string): boolean {
    return isValidBase64Key(key)
  }

  /**
   * Export user's public key for sharing
   */
  async exportUserPublicKey(): Promise<string | null> {
    if (!this.userPublicKey) {
      return null
    }

    try {
      const exported = await crypto.subtle.exportKey('spki', this.userPublicKey)
      return this.arrayBufferToBase64(exported)
    } catch (error) {
      console.error('Error exporting public key:', error)
      return null
    }
  }

  /**
   * Utility method to convert ArrayBuffer to base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  /**
   * Utility method to convert base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance()
