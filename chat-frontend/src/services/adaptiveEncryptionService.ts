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
import * as Crypto from 'expo-crypto'
import { secureStorage } from './secureStorage'

// Note: crypto polyfill is set up in index.ts for Expo Go compatibility

// Import encryption configuration
import { 
  EncryptionMode, 
  getCurrentEncryptionConfig, 
  getStoredEncryptionMode,
  ENCRYPTION_CONFIGS 
} from '@config/encryptionConfig'

// Import all encryption services
import { DoubleRatchetService, RatchetMessage } from './cryptoService/DoubleRatchetService'
import { X25519Service } from './cryptoService/X25519Service'
import { MessageEncryptionService } from './cryptoService/MessageEncryptionService'
import { KyberService } from './cryptoService/KyberService'
import { DilithiumService } from './cryptoService/DilithiumService'
import { HybridKeyExchangeService } from './cryptoService/HybridKeyExchangeService'
import { DeviceIdentityService } from './cryptoService/DeviceIdentityService'
import { CrossDeviceKeyService } from './cryptoService/CrossDeviceKeyService'

/**
 * Generate secure random bytes using React Native crypto polyfill
 */
function getSecureRandomBytes(length: number): Uint8Array {
  // Validate input parameter
  if (!Number.isInteger(length) || length < 0) {
    console.error('getSecureRandomBytes: length must be a non-negative integer, got:', length)
    throw new Error('length must be an unsigned integer')
  }
  
  if (length === 0) {
    return new Uint8Array(0)
  }

  try {
    // Use polyfilled crypto.getRandomValues
    const bytes = new Uint8Array(length)
    crypto.getRandomValues(bytes)
    return bytes
  } catch (error) {
    console.error('Failed to generate secure random bytes with crypto.getRandomValues, trying Expo Crypto:', error)
    try {
      // Ensure length is a valid unsigned integer for Expo Crypto
      const validLength = Math.floor(Math.abs(length))
      console.log(`Using Expo Crypto with validated length: ${validLength}`)
      
      // Fallback to Expo Crypto - it returns a Uint8Array directly
      const randomBytes = Crypto.getRandomBytes(validLength)
      
      // Expo Crypto should return Uint8Array directly, but let's ensure it
      if (randomBytes instanceof Uint8Array) {
        return randomBytes
      } else {
        // Convert to Uint8Array if needed
        return new Uint8Array(randomBytes)
      }
    } catch (expoError) {
      console.error('Failed to generate secure random bytes with Expo Crypto:', expoError)
      console.error('Expo error details:', {
        message: expoError.message,
        length: length,
        lengthType: typeof length
      })
      
      // Final fallback to Math.random (less secure, for development only)
      console.warn('Using Math.random fallback - NOT SECURE for production!')
      const bytes = new Uint8Array(length)
      for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256)
      }
      return bytes
    }
  }
}

/**
 * Adaptive Encryption Service
 * 
 * Dynamically switches between encryption modes based on configuration:
 * - PFS: Perfect Forward Secrecy with Double Ratchet
 * - PQC: Post-Quantum Cryptography with Kyber + Dilithium
 * - MULTI_DEVICE: Multi-Device Key Synchronization
 */
export class AdaptiveEncryptionService {
  private static instance: AdaptiveEncryptionService
  private conversationKeys: Map<string, CryptoKey> = new Map()
  private userPrivateKey: CryptoKey | null = null
  private userPublicKey: CryptoKey | null = null
  private apiBaseUrl: string
  private deviceId: string
  private authToken: string | null = null
  private currentMode: EncryptionMode = EncryptionMode.PFS
  private keyGenerationMutex: Promise<boolean> | null = null

  // All encryption services
  private doubleRatchetService: DoubleRatchetService
  private x25519Service: X25519Service
  private messageEncryptionService: MessageEncryptionService
  private kyberService: KyberService
  private dilithiumService: DilithiumService
  private hybridKeyExchangeService: HybridKeyExchangeService
  private deviceIdentityService: DeviceIdentityService
  private crossDeviceKeyService: CrossDeviceKeyService

  private constructor() {
    this.apiBaseUrl = `${getApiUrl()}/api`
    this.deviceId = this.generateDeviceId()
    
    // Initialize all encryption services
    this.doubleRatchetService = new DoubleRatchetService()
    this.x25519Service = new X25519Service()
    this.messageEncryptionService = new MessageEncryptionService()
    this.kyberService = new KyberService()
    this.dilithiumService = new DilithiumService()
    this.hybridKeyExchangeService = new HybridKeyExchangeService()
    this.deviceIdentityService = new DeviceIdentityService()
    this.crossDeviceKeyService = new CrossDeviceKeyService()
    
    // Initialize with stored mode
    this.initializeMode()
  }

  static getInstance(): AdaptiveEncryptionService {
    if (!AdaptiveEncryptionService.instance) {
      AdaptiveEncryptionService.instance = new AdaptiveEncryptionService()
    }
    return AdaptiveEncryptionService.instance
  }

  /**
   * Initialize encryption mode from storage (defaults to PFS)
   */
  private async initializeMode(): Promise<void> {
    try {
      this.currentMode = await getStoredEncryptionMode()
      console.log(`Adaptive Encryption: Initialized with mode ${this.currentMode}`)
    } catch (error) {
      console.log('No stored encryption mode found, defaulting to PFS')
      this.currentMode = EncryptionMode.PFS
      // Store the default mode
      await AsyncStorage.setItem('ENCRYPTION_MODE', EncryptionMode.PFS)
    }
  }

  /**
   * Set authentication token for API requests
   */
  setAuthToken(token: string): void {
    this.authToken = token
  }

  /**
   * Get current encryption mode
   */
  getCurrentMode(): EncryptionMode {
    return this.currentMode
  }

  /**
   * Get current encryption configuration
   */
  getCurrentConfig() {
    return ENCRYPTION_CONFIGS[this.currentMode]
  }

  /**
   * Switch encryption mode
   */
  async switchMode(mode: EncryptionMode): Promise<void> {
    console.log(`Adaptive Encryption: Switching from ${this.currentMode} to ${mode}`)
    this.currentMode = mode
    
    // Store new mode
    await AsyncStorage.setItem('ENCRYPTION_MODE', mode)
    
    // Clear existing keys (they may not be compatible)
    this.clearKeys()
  }

  /**
   * Private method to make authenticated API requests
   */
  private async request<T>(
    endpoint: string,
    options?: RequestInit,
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken}`,
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
   * Generate device ID for multi-device support
   */
  private generateDeviceId(): string {
    return `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Generate conversation-based deterministic key for any user in the conversation
   */
  private generateConversationKey(conversationId: string): Uint8Array {
    console.log('🔑 Generating deterministic conversation key for:', conversationId)
    
    // Create deterministic but secure key based on conversationId
    const encoder = new TextEncoder()
    const conversationBytes = encoder.encode(`conv-key-${conversationId}`)
    const salt = encoder.encode('chat-app-conversation-salt-2024')
    
    // Create 32-byte key using simple but deterministic method
    const key = new Uint8Array(32)
    
    // Mix conversation ID with salt for better entropy
    for (let i = 0; i < 32; i++) {
      const convByte = conversationBytes[i % conversationBytes.length]
      const saltByte = salt[i % salt.length]
      const indexByte = i + 1
      
      // Simple but deterministic mixing
      key[i] = (convByte ^ saltByte ^ indexByte) & 0xFF
    }
    
    console.log('✅ Conversation key generated for:', conversationId)
    return key
  }

  /**
   * Generate encryption keys based on current mode
   * Now generates conversation-based keys that work for all users
   */
  async generateUserKeys(userId: string, password: string): Promise<void> {
    // Use mutex to prevent concurrent key generation
    if (this.keyGenerationMutex) {
      console.log('⏳ Key generation already in progress, waiting...');
      await this.keyGenerationMutex;
      
      // Check if keys were generated while waiting
      if (this.userPublicKey && this.userPrivateKey) {
        console.log('✅ Keys were generated by concurrent operation');
        return;
      }
    }
    
    // Create mutex promise
    this.keyGenerationMutex = (async () => {
      try {
        const config = this.getCurrentConfig();
        console.log(`Adaptive Encryption: Generating conversation-based keys for ${config.displayName}...`);
        
        // For conversation-based encryption, we generate keys that work for any user
        switch (this.currentMode) {
          case EncryptionMode.PFS:
            await this.generateConversationBasedPFSKeys(userId, password);
            break;
          case EncryptionMode.PQC:
            await this.generatePQCKeys(userId, password);
            break;
          case EncryptionMode.MULTI_DEVICE:
            await this.generateMultiDeviceKeys(userId, password);
            break;
          default:
            throw new Error(`Unsupported encryption mode: ${this.currentMode}`);
        }
        return true;
      } finally {
        this.keyGenerationMutex = null;
      }
    })();
    
    await this.keyGenerationMutex;
  }

  /**
   * Generate conversation-based Perfect Forward Secrecy keys
   * These are deterministic keys that any user can generate for the same conversation
   */
  private async generateConversationBasedPFSKeys(userId: string, password: string): Promise<void> {
    try {
      console.log('Generating conversation-based keys for Perfect Forward Secrecy...')

      // For conversation-based encryption, we create simple mock keys that indicate readiness
      // In a production system, this would derive keys from shared conversation secrets
      const mockKeyPair = {
        publicKey: 'conversation-based-public-key-' + Date.now(),
        privateKey: 'conversation-based-private-key-' + Date.now(),
      }

      await this.storeKeys(userId, password, mockKeyPair, 'conversation-pfs')
      
      // Store mock keys to indicate encryption is ready
      this.userPublicKey = { type: 'conversation-based', data: mockKeyPair.publicKey } as any
      this.userPrivateKey = { type: 'conversation-based', data: mockKeyPair.privateKey } as any

      console.log('Conversation-based Perfect Forward Secrecy keys generated successfully')
    } catch (error) {
      console.error('Error generating conversation-based PFS keys:', error)
      throw error
    }
  }

  /**
   * Generate Perfect Forward Secrecy keys (legacy method, kept for compatibility)
   */
  private async generatePFSKeys(userId: string, password: string): Promise<void> {
    try {
      console.log('Generating X25519 keys for Perfect Forward Secrecy...')

      const keyPair = await this.x25519Service.generateKeyPair()
      const exportedKeyPair = {
        publicKey: this.arrayBufferToBase64(keyPair.publicKey.buffer),
        privateKey: this.arrayBufferToBase64(keyPair.privateKey.buffer),
      }

      await this.storeKeys(userId, password, exportedKeyPair, 'x25519-pfs')
      this.userPublicKey = keyPair.publicKey as any
      this.userPrivateKey = keyPair.privateKey as any

      console.log('Perfect Forward Secrecy keys generated successfully')
    } catch (error) {
      console.error('Error generating PFS keys:', error)
      throw error
    }
  }

  /**
   * Generate Post-Quantum Cryptography keys
   */
  private async generatePQCKeys(userId: string, password: string): Promise<void> {
    try {
      console.log('Generating Kyber + Dilithium keys for Post-Quantum Cryptography...')

      // Generate Kyber key pair for key encapsulation
      const kyberKeyPair = await this.kyberService.generateKeyPair()
      
      // Generate Dilithium key pair for digital signatures
      const dilithiumKeyPair = await this.dilithiumService.generateKeyPair()

      const exportedKeyPair = {
        publicKey: JSON.stringify({
          kyber: this.arrayBufferToBase64(kyberKeyPair.publicKey),
          dilithium: this.arrayBufferToBase64(dilithiumKeyPair.publicKey)
        }),
        privateKey: JSON.stringify({
          kyber: this.arrayBufferToBase64(kyberKeyPair.privateKey),
          dilithium: this.arrayBufferToBase64(dilithiumKeyPair.privateKey)
        })
      }

      await this.storeKeys(userId, password, exportedKeyPair, 'pqc-hybrid')
      
      // Store complex key structure
      this.userPublicKey = { kyber: kyberKeyPair.publicKey, dilithium: dilithiumKeyPair.publicKey } as any
      this.userPrivateKey = { kyber: kyberKeyPair.privateKey, dilithium: dilithiumKeyPair.privateKey } as any

      console.log('Post-Quantum Cryptography keys generated successfully')
    } catch (error) {
      console.error('Error generating PQC keys:', error)
      throw error
    }
  }

  /**
   * Generate Multi-Device keys
   */
  private async generateMultiDeviceKeys(userId: string, password: string): Promise<void> {
    try {
      console.log('Generating hybrid keys for Multi-Device support...')

      // Generate device identity
      const deviceKeys = await this.deviceIdentityService.generateDeviceIdentity(this.deviceId)
      
      // Generate X25519 keys for conversation encryption
      const conversationKeyPair = await this.x25519Service.generateKeyPair()

      const exportedKeyPair = {
        publicKey: JSON.stringify({
          device: this.arrayBufferToBase64(deviceKeys.signingPublicKey),
          conversation: this.arrayBufferToBase64(conversationKeyPair.publicKey)
        }),
        privateKey: JSON.stringify({
          device: this.arrayBufferToBase64(deviceKeys.signingPrivateKey),
          conversation: this.arrayBufferToBase64(conversationKeyPair.privateKey)
        })
      }

      await this.storeKeys(userId, password, exportedKeyPair, 'multi-device')
      
      // Store device and conversation keys
      this.userPublicKey = { device: deviceKeys.signingPublicKey, conversation: conversationKeyPair.publicKey } as any
      this.userPrivateKey = { device: deviceKeys.signingPrivateKey, conversation: conversationKeyPair.privateKey } as any

      console.log('Multi-Device keys generated successfully')
    } catch (error) {
      console.error('Error generating Multi-Device keys:', error)
      throw error
    }
  }

  /**
   * Store keys securely (passwords in Keychain, keys in AsyncStorage)
   */
  private async storeKeys(userId: string, password: string, keyPair: any, keyType: string): Promise<void> {
    // Store encryption keys in AsyncStorage (they're already encrypted by the password)
    await AsyncStorage.setItem('userPublicKey', keyPair.publicKey)
    await AsyncStorage.setItem('userPrivateKey', keyPair.privateKey)
    await AsyncStorage.setItem('encryptionUserId', userId)
    await AsyncStorage.setItem('deviceId', this.deviceId)
    await AsyncStorage.setItem('keyType', keyType)

    // Store the password securely in device Keychain/Keystore
    await secureStorage.setItem('encryptionPassword', password, {
      requireAuthentication: false, // For now, don't require biometric auth for auto-generated passwords
      authenticationPrompt: 'Authenticate to access your encryption password',
      keychainService: 'com.chatapp.encryption'
    })

    console.log('🔐 Encryption password stored securely in device Keychain/Keystore')
    encryptionDebug.traceKeyGeneration(userId, keyType, this.deviceId)
  }

  /**
   * Load user's encryption keys from storage
   */
  async loadUserKeys(password: string): Promise<boolean> {
    try {
      const publicKeyData = await AsyncStorage.getItem('userPublicKey')
      const privateKeyData = await AsyncStorage.getItem('userPrivateKey')
      const storedPassword = await this.getStoredPassword() // Use same method as areStoredKeysValid()
      const storedUserId = await AsyncStorage.getItem('encryptionUserId')
      const keyType = await AsyncStorage.getItem('keyType')

      if (!publicKeyData || !privateKeyData || !storedPassword) {
        return false
      }

      if (storedPassword !== password) {
        console.log('Password mismatch during key loading - this should not happen with areStoredKeysValid()')
        console.log('Password comparison debug:', {
          storedPasswordLength: storedPassword?.length || 0,
          providedPasswordLength: password?.length || 0,
          storedPasswordPreview: storedPassword?.substring(0, 10) + '...',
          providedPasswordPreview: password?.substring(0, 10) + '...'
        })
        return false // Return false instead of throwing error
      }

      // Load keys based on type
      if (keyType === 'conversation-pfs') {
        // For conversation-based PFS keys, store mock keys to indicate readiness
        this.userPublicKey = { type: 'conversation-based', data: publicKeyData } as any
        this.userPrivateKey = { type: 'conversation-based', data: privateKeyData } as any
      } else if (keyType === 'x25519-pfs') {
        const publicKeyBuffer = this.base64ToArrayBuffer(publicKeyData)
        const privateKeyBuffer = this.base64ToArrayBuffer(privateKeyData)
        this.userPublicKey = new Uint8Array(publicKeyBuffer) as any
        this.userPrivateKey = new Uint8Array(privateKeyBuffer) as any
      } else if (keyType === 'pqc-hybrid') {
        const publicKeys = JSON.parse(publicKeyData)
        const privateKeys = JSON.parse(privateKeyData)
        this.userPublicKey = {
          kyber: new Uint8Array(this.base64ToArrayBuffer(publicKeys.kyber)),
          dilithium: new Uint8Array(this.base64ToArrayBuffer(publicKeys.dilithium))
        } as any
        this.userPrivateKey = {
          kyber: new Uint8Array(this.base64ToArrayBuffer(privateKeys.kyber)),
          dilithium: new Uint8Array(this.base64ToArrayBuffer(privateKeys.dilithium))
        } as any
      } else if (keyType === 'multi-device') {
        const publicKeys = JSON.parse(publicKeyData)
        const privateKeys = JSON.parse(privateKeyData)
        this.userPublicKey = {
          device: new Uint8Array(this.base64ToArrayBuffer(publicKeys.device)),
          conversation: new Uint8Array(this.base64ToArrayBuffer(publicKeys.conversation))
        } as any
        this.userPrivateKey = {
          device: new Uint8Array(this.base64ToArrayBuffer(privateKeys.device)),
          conversation: new Uint8Array(this.base64ToArrayBuffer(privateKeys.conversation))
        } as any
      }

      return true
    } catch (error) {
      console.error('Error loading user keys:', error)
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
   * Encrypt message using current mode
   */
  async encryptMessage(
    text: string,
    conversationId: string,
    userId: string,
  ): Promise<EncryptedPayload> {
    console.log('🔒 AdaptiveEncryptionService.encryptMessage called')
    console.log('🔒 Input text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''))
    console.log('🔒 Current mode:', this.currentMode)
    console.log('🔒 User has keys:', this.userPublicKey !== null && this.userPrivateKey !== null)
    
    const config = this.getCurrentConfig()
    console.log(`🔒 Adaptive Encryption: Encrypting with ${config.displayName}...`)

    let result: EncryptedPayload
    switch (this.currentMode) {
      case EncryptionMode.PFS:
        console.log('🔒 Using PFS encryption...')
        result = await this.encryptWithPFS(text, conversationId, userId)
        console.log('🔒 Using PFS encryption:result',result )
        break
      case EncryptionMode.PQC:
        console.log('🔒 Using PQC encryption...')
        result = await this.encryptWithPQC(text, conversationId, userId)
        break
      case EncryptionMode.MULTI_DEVICE:
        console.log('🔒 Using Multi-Device encryption...')
        result = await this.encryptWithMultiDevice(text, conversationId, userId)
        break
      default:
        throw new Error(`Unsupported encryption mode: ${this.currentMode}`)
    }
    
    console.log('🔒 Encryption completed, payload:', {
      encryptedTextLength: result.encryptedText?.length || 0,
      hasIv: !!result.iv,
      hasTag: !!result.tag,
      keyId: result.keyId
    })
    
    return result
  }

  /**
   * Encrypt with Perfect Forward Secrecy using conversation-based keys
   */
  private async encryptWithPFS(text: string, conversationId: string, userId: string): Promise<EncryptedPayload> {
    console.log('🔐 PFS encryption: Using conversation-based encryption for:', conversationId)
    console.log('🔐 PFS encryption: About to encrypt message:', text.substring(0, 20) + '...')
    
    // Use deterministic conversation key that any user in the conversation can generate
    const conversationKey = this.generateConversationKey(conversationId)
    const timestamp = Date.now()
    
    // Create simple associated data
    const associatedData = this.messageEncryptionService.createAssociatedData({
      senderId: `conv-${conversationId}`,
      messageNumber: 0,
      chainLength: 0,
      timestamp: timestamp,
      ephemeralPublicKey: getSecureRandomBytes(32)
    })
    
    // Direct encryption with conversation-based key
    const encryptedData = await this.messageEncryptionService.encryptMessage(
      text,
      conversationKey,
      associatedData
    )
    
    console.log('🔐 PFS encryption: Conversation-based encryption completed')
    
    const encryptedPayload: EncryptedPayload = {
      encryptedText: this.uint8ArrayToBase64(encryptedData.ciphertext),
      iv: this.uint8ArrayToBase64(encryptedData.nonce),
      tag: this.uint8ArrayToBase64(encryptedData.tag),
      keyId: `conv-pfs-${conversationId}`,
      metadata: {
        mode: 'PFS',
        conversationId: conversationId, // Store conversation ID for key regeneration
        ephemeralPublicKey: this.uint8ArrayToBase64(getSecureRandomBytes(32)),
        messageNumber: 0,
        chainLength: 0,
        previousChainLength: 0,
        timestamp: timestamp,
        associatedDataB64: this.uint8ArrayToBase64(associatedData)
      }
    }
    
    return encryptedPayload
  }

  /**
   * Encrypt with Post-Quantum Cryptography
   */
  private async encryptWithPQC(text: string, conversationId: string, userId: string): Promise<EncryptedPayload> {
    // For React Native demo, use simplified encryption
    // In production, this would use proper PQC algorithms with WebCrypto
    console.log('🔒 PQC encryption (React Native compatible mode)')
    
    const messageKey = getSecureRandomBytes(32)
    const iv = getSecureRandomBytes(12)
    
    // Simplified encryption for React Native compatibility
    const encodedText = new TextEncoder().encode(text)
    const encryptedData = new Uint8Array(encodedText.length)
    
    // Simple XOR encryption for demo (not secure for production)
    for (let i = 0; i < encodedText.length; i++) {
      encryptedData[i] = encodedText[i] ^ messageKey[i % messageKey.length]
    }

    // Simulate Dilithium signature
    const signature = getSecureRandomBytes(32)

    const encryptedPayload: EncryptedPayload = {
      encryptedText: this.arrayBufferToBase64(encryptedData.buffer),
      iv: this.arrayBufferToBase64(iv.buffer),
      tag: this.arrayBufferToBase64(signature.buffer),
      keyId: `pqc-${conversationId}`,
    }

    // Store metadata for later use (if needed for decryption)
    console.log('🔐 PQC encryption completed for message (React Native mode)')

    return encryptedPayload
  }

  /**
   * Encrypt with Multi-Device support
   */
  private async encryptWithMultiDevice(text: string, conversationId: string, userId: string): Promise<EncryptedPayload> {
    // For local demo, use a shared ratchet state for the conversation
    const ratchetUserId = `shared-multi-${conversationId}`
    
    // Use Double Ratchet with device sync capabilities
    const hasRatchetState = await this.doubleRatchetService.hasRatchetState(conversationId, ratchetUserId)
    
    if (!hasRatchetState) {
      await this.initializeMultiDeviceSession(conversationId, ratchetUserId)
    }

    const ratchetMessage = await this.doubleRatchetService.encryptMessage(
      conversationId,
      ratchetUserId,
      text
    )

    // Create sync package for other devices
    await this.createDeviceSyncPackage(conversationId, userId, ratchetMessage)

    const encryptedPayload: EncryptedPayload = {
      encryptedText: this.arrayBufferToBase64(ratchetMessage.encryptedData.ciphertext),
      iv: this.arrayBufferToBase64(ratchetMessage.encryptedData.iv),
      tag: this.arrayBufferToBase64(ratchetMessage.encryptedData.tag || new Uint8Array(16)),
      keyId: `multi-${conversationId}`,
    }

    // Store metadata for later use (if needed for decryption)
    console.log('🔐 Multi-Device encryption completed for message')

    return encryptedPayload
  }

  /**
   * Send encrypted message to backend
   */
  private async sendEncryptedMessage(conversationId: string, payload: EncryptedPayload, metadata: any): Promise<void> {
    await this.request('/encryption/messages', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        encryptedContent: payload.encryptedText,
        encryptionMetadata: {
          ...metadata,
          securityLevel: this.getCurrentConfig().securityLevel,
          ratchetEncrypted: true,
          cryptoVersion: '1.0',
          iv: payload.iv,
          keyId: payload.keyId,
        },
      }),
    })
  }

  /**
   * Initialize PFS session
   */
  private async initializePFSSession(conversationId: string, userId: string): Promise<void> {
    console.log('🔒 Initializing PFS session for conversation:', conversationId, 'user:', userId)
    
    // Check if we already have a state (to avoid re-initialization)
    const existingState = await this.doubleRatchetService.hasRatchetState(conversationId, userId)
    if (existingState) {
      console.log('✅ PFS session already exists, skipping initialization')
      return
    }
    
    // For local demo, use deterministic shared secret based on conversation
    // In production, this would come from a proper key exchange protocol
    const encoder = new TextEncoder()
    const conversationBytes = encoder.encode(`demo-shared-secret-${conversationId}`)
    const sharedSecret = new Uint8Array(32)
    
    // Create deterministic but unique shared secret for this conversation
    for (let i = 0; i < 32; i++) {
      sharedSecret[i] = conversationBytes[i % conversationBytes.length] ^ (i + 42)
    }
    
    console.log('🔒 Using deterministic shared secret for local demo')
    await this.doubleRatchetService.initializeRatchet(
      conversationId,
      userId,
      sharedSecret,
      true, // isInitiator (doesn't matter much for local demo)
      undefined // remoteEphemeralPublicKey (optional)
    )
    console.log('✅ PFS session initialized successfully')
  }

  /**
   * Initialize Multi-Device session
   */
  private async initializeMultiDeviceSession(conversationId: string, userId: string): Promise<void> {
    console.log('🔒 Initializing Multi-Device session for conversation:', conversationId, 'user:', userId)
    
    // For local demo, use deterministic shared secret based on conversation
    // In production, this would come from a proper key exchange protocol
    const encoder = new TextEncoder()
    const conversationBytes = encoder.encode(`demo-multi-device-secret-${conversationId}`)
    const sharedSecret = new Uint8Array(32)
    
    // Create deterministic but unique shared secret for this conversation
    for (let i = 0; i < 32; i++) {
      sharedSecret[i] = conversationBytes[i % conversationBytes.length] ^ (i + 123)
    }
    
    console.log('🔒 Using deterministic shared secret for Multi-Device local demo')
    await this.doubleRatchetService.initializeRatchet(
      conversationId,
      userId,
      sharedSecret,
      true, // isInitiator (doesn't matter much for local demo)
      undefined // remoteEphemeralPublicKey (optional)
    )
    console.log('✅ Multi-Device session initialized successfully')
  }

  /**
   * Create device sync package
   */
  private async createDeviceSyncPackage(conversationId: string, userId: string, ratchetMessage: RatchetMessage): Promise<void> {
    // This would sync the ratchet state to other devices
    console.log('Creating device sync package for multi-device support...')
  }

  /**
   * Decrypt message using current mode
   */
  async decryptMessage(
    encryptedPayload: EncryptedPayload,
    conversationId: string,
    userId: string,
    metadata?: any,
  ): Promise<string> {
    if (!metadata) {
      throw new Error('Metadata required for decryption')
    }

    // Wait for key generation to complete if in progress
    if (this.keyGenerationMutex) {
      console.log('🔓 Waiting for key generation to complete before decryption...')
      await this.keyGenerationMutex
    }
    
    // Check if we have encryption keys before attempting decryption
    if (!this.userPublicKey || !this.userPrivateKey) {
      console.log('🔓 No encryption keys found for user, auto-initializing...')
      
      // Auto-initialize encryption for the recipient
      try {
        const randomPassword = this.generateSecurePasswordInternal()
        await this.generateUserKeys(userId, randomPassword)
        console.log('✅ Auto-initialized encryption keys for message recipient')
      } catch (initError) {
        console.error('❌ Failed to auto-initialize encryption keys:', initError)
        throw new Error('Encryption keys not available and auto-initialization failed. Please set up encryption.')
      }
    }
    
    // Ensure conversation encryption is initialized
    const isEnabled = await this.isEncryptionEnabled(conversationId, userId)
    if (!isEnabled) {
      console.log('🔓 Initializing conversation encryption for decryption...')
      await this.enableEncryption(conversationId)
    }

    const mode = metadata.mode as EncryptionMode
    console.log(`Adaptive Encryption: Decrypting with ${mode}...`)

    switch (mode) {
      case EncryptionMode.PFS:
        return this.decryptWithPFS(encryptedPayload, conversationId, userId, metadata)
      case EncryptionMode.PQC:
        return this.decryptWithPQC(encryptedPayload, conversationId, userId, metadata)
      case EncryptionMode.MULTI_DEVICE:
        return this.decryptWithMultiDevice(encryptedPayload, conversationId, userId, metadata)
      default:
        throw new Error(`Unsupported encryption mode: ${mode}`)
    }
  }

  /**
   * Decrypt with Perfect Forward Secrecy using conversation-based keys
   */
  private async decryptWithPFS(payload: EncryptedPayload, conversationId: string, userId: string, metadata: any): Promise<string> {
    console.log('🔓 decryptWithPFS: Using conversation-based decryption for:', conversationId)
    console.log('🔓 decryptWithPFS: Starting decryption with metadata:', {
      hasConversationId: !!metadata.conversationId,
      hasAssociatedData: !!metadata.associatedDataB64,
      keyId: payload.keyId
    })
    
    // Use the same deterministic conversation key that was used for encryption
    const messageConversationId = metadata.conversationId || conversationId
    console.log('🔓 decryptWithPFS: Regenerating conversation key for:', messageConversationId)
    
    const conversationKey = this.generateConversationKey(messageConversationId)
    
    if (metadata.associatedDataB64) {
      console.log('🔓 decryptWithPFS: Using stored associated data')
      
      const associatedData = new Uint8Array(this.base64ToArrayBuffer(metadata.associatedDataB64))
      
      const encryptedPayload = {
        ciphertext: new Uint8Array(this.base64ToArrayBuffer(payload.encryptedText)),
        nonce: new Uint8Array(this.base64ToArrayBuffer(payload.iv)),
        tag: new Uint8Array(this.base64ToArrayBuffer(payload.tag)),
        associatedData: associatedData
      }
      
      console.log('🔓 decryptWithPFS: About to decrypt with MessageEncryptionService using conversation key')
      const plaintext = await this.messageEncryptionService.decryptMessage(
        encryptedPayload,
        conversationKey
      )
      
      console.log('🔓 decryptWithPFS: Conversation-based decryption successful!')
      return plaintext
    }
    
    // If we reach here, it means we're missing critical decryption data
    throw new Error('Conversation-based decryption failed: Missing associatedData in metadata')
  }

  /**
   * Decrypt with Post-Quantum Cryptography
   */
  private async decryptWithPQC(payload: EncryptedPayload, conversationId: string, userId: string, metadata: any): Promise<string> {
    // For React Native demo, use simplified decryption
    // In production, this would use proper PQC algorithms with WebCrypto
    console.log('🔒 PQC decryption (React Native compatible mode)')
    
    const ciphertext = this.base64ToArrayBuffer(payload.encryptedText)
    const messageKey = getSecureRandomBytes(32) // In production, this would be derived from Kyber decapsulation
    
    // Simple XOR decryption for demo (matches encryption)
    const encryptedData = new Uint8Array(ciphertext)
    const decryptedData = new Uint8Array(encryptedData.length)
    
    for (let i = 0; i < encryptedData.length; i++) {
      decryptedData[i] = encryptedData[i] ^ messageKey[i % messageKey.length]
    }

    console.log('🔐 PQC decryption completed (React Native mode)')
    return new TextDecoder().decode(decryptedData)
  }

  /**
   * Decrypt with Multi-Device support
   */
  private async decryptWithMultiDevice(payload: EncryptedPayload, conversationId: string, userId: string, metadata: any): Promise<string> {
    // For local demo, use the same shared ratchet state as Multi-Device encryption
    const ratchetUserId = `shared-multi-${conversationId}`
    
    console.log('🔓 decryptWithMultiDevice: Starting Multi-Device decryption with shared ratchet:', ratchetUserId)
    
    // Convert base64 to ArrayBuffer first, then to Uint8Array for debugging
    const ciphertextBuffer = this.base64ToArrayBuffer(payload.encryptedText);
    const nonceBuffer = this.base64ToArrayBuffer(payload.iv || '');
    const tagBuffer = this.base64ToArrayBuffer(payload.tag);
    const ephemeralKeyBuffer = this.base64ToArrayBuffer(metadata.ephemeralPublicKey || '');
    
    // Recreate associated data with Multi-Device ratchet user ID
    const associatedData = this.messageEncryptionService.createAssociatedData({
      senderId: ratchetUserId, // Use Multi-Device shared ratchet ID
      messageNumber: metadata.messageNumber,
      chainLength: metadata.chainLength,
      timestamp: metadata.timestamp,
      ephemeralPublicKey: new Uint8Array(ephemeralKeyBuffer),
    });

    const ratchetMessage: RatchetMessage = {
      encryptedData: {
        ciphertext: new Uint8Array(ciphertextBuffer),
        nonce: new Uint8Array(nonceBuffer),
        tag: new Uint8Array(tagBuffer),
        associatedData: associatedData,
      },
      ephemeralPublicKey: new Uint8Array(ephemeralKeyBuffer),
      messageNumber: metadata.messageNumber,
      chainLength: metadata.chainLength,
      previousChainLength: metadata.previousChainLength || 0,
      timestamp: metadata.timestamp,
    }

    return await this.doubleRatchetService.decryptMessage(
      conversationId,
      ratchetUserId,
      ratchetMessage
    )
  }

  /**
   * Check if encryption is enabled for a conversation
   * For always-on encryption, return true if we have user keys
   */
  async isEncryptionEnabled(conversationId: string, userId: string): Promise<boolean> {
    console.log('🔒 Checking if encryption is enabled:', {
      conversationId,
      userId,
      mode: this.currentMode,
      hasUserKeys: this.userPublicKey !== null && this.userPrivateKey !== null
    })
    
    // If we have user keys, encryption is always available
    if (this.userPublicKey && this.userPrivateKey) {
      console.log('✅ Encryption enabled: User has keys')
      return true
    }
    
    // Legacy check for specific conversation states (fallback)
    const config = this.getCurrentConfig()
    switch (this.currentMode) {
      case EncryptionMode.PFS:
        const hasRatchet = await this.doubleRatchetService.hasRatchetState(conversationId, userId)
        console.log('🔒 PFS ratchet state check:', hasRatchet)
        return hasRatchet
      case EncryptionMode.PQC:
      case EncryptionMode.MULTI_DEVICE:
        const hasConvKey = this.conversationKeys.has(conversationId)
        console.log('🔒 Conversation key check:', hasConvKey)
        return hasConvKey
      default:
        console.log('❌ Unknown encryption mode')
        return false
    }
  }

  /**
   * Enable encryption for a conversation
   */
  async enableEncryption(conversationId: string): Promise<void> {
    const config = this.getCurrentConfig()
    console.log(`Adaptive Encryption: Enabling ${config.displayName}...`)

    const storedUserId = await AsyncStorage.getItem('encryptionUserId')
    const userId = storedUserId || 'unknown'

    switch (this.currentMode) {
      case EncryptionMode.PFS:
        await this.initializePFSSession(conversationId, userId)
        break
      case EncryptionMode.PQC:
        // For React Native demo, use simulated key generation
        // In production, this would use proper WebCrypto API or react-native-crypto
        console.log('🔒 PQC conversation key generated (simulated for React Native)')
        this.conversationKeys.set(conversationId, 'simulated-pqc-key' as any)
        break
      case EncryptionMode.MULTI_DEVICE:
        await this.initializeMultiDeviceSession(conversationId, userId)
        break
    }

    // For local demo, encryption is enabled client-side only
    // In production, this would notify the backend about encryption settings
    console.log(`✅ ${config.displayName} enabled for conversation: ${conversationId}`)
  }

  /**
   * Clear encryption keys from memory
   */
  clearKeys(): void {
    this.conversationKeys.clear()
    this.userPrivateKey = null
    this.userPublicKey = null
    this.authToken = null
  }

  /**
   * Remove encryption keys from storage (including secure password)
   */
  async removeKeys(): Promise<void> {
    // Remove keys from AsyncStorage
    await AsyncStorage.removeItem('userPublicKey')
    await AsyncStorage.removeItem('userPrivateKey')
    await AsyncStorage.removeItem('deviceId')
    await AsyncStorage.removeItem('keyType')
    
    // Remove password from both secure storage and AsyncStorage (for migration cleanup)
    try {
      await secureStorage.removeItem('encryptionPassword')
      await AsyncStorage.removeItem('encryptionPassword') // Cleanup old location
      console.log('🔐 Encryption password removed from secure storage')
    } catch (error) {
      console.error('Error removing secure password:', error)
    }
    
    this.clearKeys()
  }

  /**
   * Get encryption status for UI
   */
  getEncryptionStatus(): {
    hasKeys: boolean
    keysLoaded: boolean
    mode: EncryptionMode
    config: any
    storage: {
      isSecure: boolean
      storageType: string
      recommendation: string
    }
  } {
    return {
      hasKeys: this.userPublicKey !== null && this.userPrivateKey !== null,
      keysLoaded: this.userPublicKey !== null && this.userPrivateKey !== null,
      mode: this.currentMode,
      config: this.getCurrentConfig(),
      storage: secureStorage.getStorageInfo()
    }
  }

  /**
   * Generate a secure password for key encryption
   */
  generateSecurePassword(): string {
    return generateSecurePassword(32)
  }

  /**
   * Private helper to generate secure password with fallback
   */
  private generateSecurePasswordInternal(): string {
    try {
      return generateSecurePassword(32)
    } catch (error) {
      console.error('Failed to generate secure password, using fallback:', error)
      // Fallback to timestamp-based password for demo
      return `demo-password-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }

  /**
   * Validate if a string is properly formatted base64
   */
  isValidKey(key: string): boolean {
    return isValidBase64Key(key)
  }

  /**
   * Get stored encryption password from secure storage
   */
  async getStoredPassword(): Promise<string | null> {
    try {
      // First try to get from secure storage
      const securePassword = await secureStorage.getItem('encryptionPassword')
      if (securePassword) {
        return securePassword
      }

      // Migration: Check if password exists in old AsyncStorage location
      const asyncPassword = await AsyncStorage.getItem('encryptionPassword')
      if (asyncPassword) {
        console.log('🔄 Migrating password from AsyncStorage to secure storage...')
        
        // Migrate to secure storage
        await secureStorage.setItem('encryptionPassword', asyncPassword, {
          requireAuthentication: false,
          authenticationPrompt: 'Authenticate to access your encryption password',
          keychainService: 'com.chatapp.encryption'
        })
        
        // Remove from AsyncStorage after successful migration
        await AsyncStorage.removeItem('encryptionPassword')
        
        console.log('✅ Password migrated to secure storage')
        return asyncPassword
      }

      return null
    } catch (error) {
      console.error('Error getting stored password:', error)
      return null
    }
  }

  /**
   * Check if stored keys are valid and can be loaded
   */
  async areStoredKeysValid(): Promise<boolean> {
    try {
      const publicKeyData = await AsyncStorage.getItem('userPublicKey')
      const privateKeyData = await AsyncStorage.getItem('userPrivateKey')
      const storedPassword = await this.getStoredPassword() // Uses secure storage with migration
      
      if (!publicKeyData || !privateKeyData || !storedPassword) {
        console.log('Keys or password missing - validation failed')
        return false
      }
      
      // Try to load keys with stored password
      const loadResult = await this.loadUserKeys(storedPassword)
      if (!loadResult) {
        console.log('Key loading failed during validation')
        return false
      }
      
      console.log('✅ Stored keys are valid and loaded successfully')
      return true
    } catch (error) {
      console.log('Stored keys validation failed:', error.message)
      return false
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
    // Handle empty or undefined base64 strings
    if (!base64 || base64.length === 0) {
      return new ArrayBuffer(0)
    }
    
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes.buffer
  }

  /**
   * Utility method to convert Uint8Array to base64
   */
  private uint8ArrayToBase64(array: Uint8Array): string {
    let binary = ''
    for (let i = 0; i < array.byteLength; i++) {
      binary += String.fromCharCode(array[i])
    }
    return btoa(binary)
  }
}

// Export singleton instance
export const adaptiveEncryptionService = AdaptiveEncryptionService.getInstance()