import { X25519Service } from './X25519Service';
import { ChainKeyService } from './ChainKeyService';
import { MessageEncryptionService, EncryptedPayload } from './MessageEncryptionService';
import { chatAPI } from '@api/chatApi';

/**
 * Ratchet message structure for transmission
 */
export interface RatchetMessage {
  encryptedData: EncryptedPayload;
  ephemeralPublicKey: Uint8Array;
  messageNumber: number;
  chainLength: number;
  previousChainLength: number;
  timestamp: number; // Timestamp for associated data consistency
}

/**
 * Internal ratchet state
 */
export interface RatchetState {
  // Root key for deriving new chain keys
  rootKey: Uint8Array;
  
  // Sending chain state
  sendingChainKey: Uint8Array;
  sendingMessageNumber: number;
  sendingChainLength: number;
  
  // Receiving chain state
  receivingChainKey: Uint8Array;
  receivingMessageNumber: number;
  receivingChainLength: number;
  
  // Current ephemeral key pairs for DH ratchet
  sendingEphemeralKey: { publicKey: Uint8Array; privateKey: Uint8Array };
  receivingEphemeralPublicKey: Uint8Array | null;
  
  // Skipped message keys for out-of-order delivery
  skippedMessageKeys: Map<string, Uint8Array>;
  
  // Metadata
  conversationId: string;
  userId: string;
  createdAt: number;
  lastUpdated: number;
}

/**
 * Double Ratchet Service for Perfect Forward Secrecy
 * 
 * Implements the Signal Protocol's Double Ratchet algorithm for secure messaging
 * with perfect forward secrecy. Each message is encrypted with a unique key,
 * and keys are continually updated to provide break-in recovery.
 */
export class DoubleRatchetService {
  private states: Map<string, RatchetState> = new Map();
  private x25519Service: X25519Service;
  private chainKeyService: ChainKeyService;
  private encryptionService: MessageEncryptionService;
  
  // Configuration constants
  private readonly RATCHET_STEP_INTERVAL = 100; // Messages between DH ratchet steps
  private readonly MAX_SKIP = 1000; // Maximum messages to skip for out-of-order
  private readonly KEY_CLEANUP_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days
  
  constructor() {
    this.x25519Service = new X25519Service();
    this.chainKeyService = new ChainKeyService();
    this.encryptionService = new MessageEncryptionService();
  }

  /**
   * Initialize the ratchet services
   */
  async initialize(): Promise<void> {
    await Promise.all([
      this.x25519Service.initialize(),
      this.chainKeyService.initialize(),
      this.encryptionService.initialize(),
    ]);
  }

  /**
   * Initialize a new ratchet state for a conversation
   * 
   * @param conversationId - Unique conversation identifier
   * @param userId - Current user ID
   * @param sharedSecret - Initial shared secret from key exchange
   * @param isInitiator - Whether this user initiated the conversation
   * @param remoteEphemeralPublicKey - Remote party's initial ephemeral public key
   */
  async initializeRatchet(
    conversationId: string,
    userId: string,
    sharedSecret: Uint8Array,
    isInitiator: boolean,
    remoteEphemeralPublicKey?: Uint8Array
  ): Promise<void> {
    await this.initialize();
    
    const stateKey = this.getStateKey(conversationId, userId);
    console.log('🔐 DoubleRatchetService.initializeRatchet: Creating ratchet state with key:', stateKey);
    console.log('🔐 DoubleRatchetService.initializeRatchet: Parameters:', {
      conversationId,
      userId,
      sharedSecretLength: sharedSecret.length,
      isInitiator
    });

    if (sharedSecret.length !== 32) {
      throw new Error('Shared secret must be 32 bytes');
    }

    // Derive initial root and chain keys from shared secret
    const { rootKey, chainKey } = await this.x25519Service.deriveKeys(
      sharedSecret,
      `${conversationId}-${userId}-init`
    );

    // Generate initial ephemeral key pair
    const ephemeralKeyPair = await this.x25519Service.generateKeyPair();

    const now = Date.now();
    const state: RatchetState = {
      rootKey,
      sendingChainKey: chainKey,
      receivingChainKey: new Uint8Array(32), // Will be derived when receiving
      sendingMessageNumber: 0,
      receivingMessageNumber: 0,
      sendingChainLength: 0,
      receivingChainLength: 0,
      sendingEphemeralKey: ephemeralKeyPair,
      receivingEphemeralPublicKey: remoteEphemeralPublicKey || null,
      skippedMessageKeys: new Map(),
      conversationId,
      userId,
      createdAt: now,
      lastUpdated: now,
    };

    const finalStateKey = this.getStateKey(conversationId, userId);
    console.log('🔐 DoubleRatchetService.initializeRatchet: Storing state with key:', finalStateKey);
    console.log('🔐 DoubleRatchetService.initializeRatchet: State details:', {
      sendingMessageNumber: state.sendingMessageNumber,
      receivingMessageNumber: state.receivingMessageNumber,
      sendingChainLength: state.sendingChainLength,
      receivingChainLength: state.receivingChainLength
    });
    
    this.states.set(finalStateKey, state);
    console.log('🔐 DoubleRatchetService.initializeRatchet: States after storing:', Array.from(this.states.keys()));
    
    // Persist to backend
    await this.persistRatchetState(state);
    
    console.log(`✅ Double Ratchet initialized for conversation ${conversationId}, user ${userId}`);
  }

  /**
   * Encrypt a message using the Double Ratchet protocol
   * 
   * @param conversationId - Conversation ID
   * @param userId - Current user ID
   * @param plaintext - Message to encrypt
   * @returns Encrypted ratchet message
   */
  async encryptMessage(
    conversationId: string,
    userId: string,
    plaintext: string
  ): Promise<RatchetMessage> {
    console.log('🔐 DoubleRatchetService.encryptMessage started:', {
      conversationId,
      userId,
      plaintextLength: plaintext.length,
      plaintextPreview: plaintext.substring(0, 20) + '...'
    });

    const state = await this.getState(conversationId, userId);
    console.log('🔐 Retrieved ratchet state:', {
      hasState: !!state,
      sendingMessageNumber: state?.sendingMessageNumber,
      sendingChainLength: state?.sendingChainLength,
      receivingChainLength: state?.receivingChainLength
    });
    
    if (!state) {
      console.error('❌ Ratchet state not found for conversation:', conversationId, 'user:', userId);
      throw new Error('Ratchet state not found. Initialize ratchet first.');
    }

    // Check if we need to perform a DH ratchet step
    const needsRatchetStep = state.sendingMessageNumber > 0 && 
        state.sendingMessageNumber % this.RATCHET_STEP_INTERVAL === 0;
    console.log('🔐 Checking DH ratchet step:', {
      sendingMessageNumber: state.sendingMessageNumber,
      ratchetStepInterval: this.RATCHET_STEP_INTERVAL,
      needsRatchetStep
    });

    if (needsRatchetStep) {
      console.log('🔐 Performing DH ratchet step...');
      await this.performDHRatchetStep(state);
      console.log('✅ DH ratchet step completed');
    }

    // Derive message key from current sending chain key
    console.log('🔐 Deriving message key from chain key...');
    const messageKey = await this.chainKeyService.deriveMessageKey(
      state.sendingChainKey,
      state.sendingMessageNumber
    );
    console.log('✅ Message key derived:', {
      messageKeyLength: messageKey.length,
      messageNumber: state.sendingMessageNumber
    });

    // Create associated data for authentication
    console.log('🔐 Creating associated data for authentication...');
    const timestamp = Date.now();
    const associatedData = this.encryptionService.createAssociatedData({
      senderId: userId,
      messageNumber: state.sendingMessageNumber,
      chainLength: state.sendingChainLength,
      timestamp: timestamp,
      ephemeralPublicKey: state.sendingEphemeralKey.publicKey,
    });
    console.log('✅ Associated data created:', {
      associatedDataLength: associatedData.length,
      senderId: userId,
      messageNumber: state.sendingMessageNumber,
      chainLength: state.sendingChainLength
    });

    // Encrypt message
    console.log('🔐 Calling MessageEncryptionService.encryptMessage...');
    console.log('🔐 Encryption parameters:', {
      plaintextLength: plaintext.length,
      messageKeyLength: messageKey.length,
      associatedDataLength: associatedData.length
    });
    
    const encryptedData = await this.encryptionService.encryptMessage(
      plaintext,
      messageKey,
      associatedData
    );
    
    console.log('✅ Message encryption completed:', {
      ciphertextLength: encryptedData.ciphertext.length,
      nonceLength: encryptedData.nonce.length,
      tagLength: encryptedData.tag.length,
      hasAssociatedData: !!encryptedData.associatedData
    });

    // Create ratchet message
    console.log('🔐 Creating ratchet message structure...');
    const ratchetMessage: RatchetMessage = {
      encryptedData,
      ephemeralPublicKey: state.sendingEphemeralKey.publicKey,
      messageNumber: state.sendingMessageNumber,
      chainLength: state.sendingChainLength,
      previousChainLength: state.receivingChainLength,
      timestamp: timestamp,
    };
    console.log('✅ Ratchet message created:', {
      messageNumber: ratchetMessage.messageNumber,
      chainLength: ratchetMessage.chainLength,
      previousChainLength: ratchetMessage.previousChainLength,
      ephemeralPublicKeyLength: ratchetMessage.ephemeralPublicKey.length
    });

    // Advance sending chain
    console.log('🔐 Advancing sending chain...');
    const oldChainKey = state.sendingChainKey.slice(); // Copy for debugging
    state.sendingChainKey = await this.chainKeyService.advanceChainKey(state.sendingChainKey);
    state.sendingMessageNumber++;
    state.lastUpdated = Date.now();
    console.log('✅ Sending chain advanced:', {
      oldMessageNumber: state.sendingMessageNumber - 1,
      newMessageNumber: state.sendingMessageNumber,
      chainKeyChanged: !oldChainKey.every((byte, i) => byte === state.sendingChainKey[i])
    });

    // Clear the message key from memory
    console.log('🔐 Clearing message key from memory for messageKey...', messageKey);
    this.chainKeyService.secureZero(messageKey);
    console.log('✅ Message key cleared');

    // Persist updated state
    console.log('🔐 Persisting updated ratchet state...');
    await this.persistRatchetState(state);
    console.log('✅ Ratchet state persisted');

    console.log('🎉 DoubleRatchetService.encryptMessage completed successfully');
    return ratchetMessage;
  }

  /**
   * Decrypt a message using the Double Ratchet protocol
   * 
   * @param conversationId - Conversation ID
   * @param userId - Current user ID
   * @param ratchetMessage - Encrypted ratchet message
   * @returns Decrypted plaintext message
   */
  async decryptMessage(
    conversationId: string,
    userId: string,
    ratchetMessage: RatchetMessage
  ): Promise<string> {
    console.log('🔓 DoubleRatchetService.decryptMessage started:', {
      conversationId,
      userId,
      messageNumber: ratchetMessage.messageNumber,
      chainLength: ratchetMessage.chainLength,
      ephemeralKeyLength: ratchetMessage.ephemeralPublicKey.length
    });

    const state = await this.getState(conversationId, userId);
    console.log('🔓 Retrieved ratchet state for decryption:', {
      hasState: !!state,
      sendingMessageNumber: state?.sendingMessageNumber,
      receivingMessageNumber: state?.receivingMessageNumber,
      sendingChainLength: state?.sendingChainLength,
      receivingChainLength: state?.receivingChainLength
    });
    
    if (!state) {
      console.error('❌ Ratchet state not found for decryption');
      throw new Error('Ratchet state not found. Initialize ratchet first.');
    }

    // Check if we need to perform a DH ratchet step (new ephemeral key received)
    // Only perform ratchet step if:
    // 1. Message has a valid ephemeral key (not empty)
    // 2. We don't have a receiving key yet OR the ephemeral key is different
    const hasValidEphemeralKey = ratchetMessage.ephemeralPublicKey.length > 0 && 
                                 this.x25519Service.validatePublicKey(ratchetMessage.ephemeralPublicKey);
    
    const needsRatchetStep = hasValidEphemeralKey && 
                           (!state.receivingEphemeralPublicKey || 
                            !this.equalBytes(state.receivingEphemeralPublicKey, ratchetMessage.ephemeralPublicKey));
    
    console.log('🔍 DH Ratchet step check:', {
      hasReceivingKey: !!state.receivingEphemeralPublicKey,
      ephemeralKeyValid: hasValidEphemeralKey,
      ephemeralKeyLength: ratchetMessage.ephemeralPublicKey.length,
      ephemeralKeyType: ratchetMessage.ephemeralPublicKey.constructor.name,
      needsRatchetStep: needsRatchetStep
    });
    
    if (needsRatchetStep) {
      await this.performReceivingDHRatchetStep(state, ratchetMessage.ephemeralPublicKey);
    }

    // Try to decrypt with current chain
    console.log('🔓 Attempting to get message key...');
    let messageKey = await this.tryGetMessageKey(state, ratchetMessage);
    console.log('🔓 Message key from tryGetMessageKey:', {
      hasKey: !!messageKey,
      keyLength: messageKey?.length || 0
    });
    
    if (!messageKey) {
      console.log('🔓 First attempt failed, trying skipToMessage...');
      // Handle out-of-order messages by skipping ahead
      messageKey = await this.skipToMessage(state, ratchetMessage);
      console.log('🔓 Message key from skipToMessage:', {
        hasKey: !!messageKey,
        keyLength: messageKey?.length || 0
      });
    }

    // Parse associated data from the message
    const associatedData = ratchetMessage.encryptedData.associatedData;
    
    if (associatedData) {
      // Verify associated data integrity
      const parsedData = this.encryptionService.parseAssociatedData(associatedData);
      
      if (parsedData.messageNumber !== ratchetMessage.messageNumber ||
          parsedData.chainLength !== ratchetMessage.chainLength) {
        throw new Error('Associated data integrity check failed');
      }
    }

    // Decrypt the message
    console.log('🔓 Attempting to decrypt with MessageEncryptionService:', {
      hasMessageKey: !!messageKey,
      messageKeyLength: messageKey?.length || 0,
      ciphertextLength: ratchetMessage.encryptedData.ciphertext.length,
      nonceLength: ratchetMessage.encryptedData.nonce.length,
      tagLength: ratchetMessage.encryptedData.tag.length,
      hasAssociatedData: !!associatedData
    });
    
    const plaintext = await this.encryptionService.decryptMessage(
      ratchetMessage.encryptedData,
      messageKey
    );
    
    console.log('✅ DoubleRatchet decryption successful, plaintext length:', plaintext.length);

    // Update receiving chain state
    if (ratchetMessage.messageNumber >= state.receivingMessageNumber) {
      state.receivingMessageNumber = ratchetMessage.messageNumber + 1;
    }
    
    state.lastUpdated = Date.now();

    // Clear the message key from memory
    this.chainKeyService.secureZero(messageKey);

    // Persist updated state
    await this.persistRatchetState(state);

    return plaintext;
  }

  /**
   * Perform DH ratchet step when sending (generate new ephemeral key pair)
   * 
   * @param state - Current ratchet state
   */
  private async performDHRatchetStep(state: RatchetState): Promise<void> {
    console.log(`Performing DH ratchet step for sending chain`);
    
    // Generate new ephemeral key pair
    const newEphemeralKeyPair = await this.x25519Service.generateKeyPair();

    if (state.receivingEphemeralPublicKey) {
      // Compute new shared secret with remote's ephemeral public key
      const dhOutput = await this.x25519Service.computeSharedSecret(
        newEphemeralKeyPair.privateKey,
        state.receivingEphemeralPublicKey
      );

      // Derive new root and chain keys
      const { newRootKey, newChainKey } = await this.x25519Service.ratchetKeys(
        state.rootKey,
        dhOutput
      );

      // Update state with new keys
      this.x25519Service.secureZero(state.rootKey);
      this.chainKeyService.secureZero(state.sendingChainKey);
      
      state.rootKey = newRootKey;
      state.sendingChainKey = newChainKey;
      state.sendingChainLength++;
      state.sendingMessageNumber = 0;

      // Clear the DH output
      this.chainKeyService.secureZero(dhOutput);
    }

    // Update ephemeral key pair (clear old private key)
    this.x25519Service.secureZero(state.sendingEphemeralKey.privateKey);
    state.sendingEphemeralKey = newEphemeralKeyPair;
  }

  /**
   * Perform DH ratchet step when receiving (new ephemeral public key received)
   * 
   * @param state - Current ratchet state
   * @param newEphemeralPublicKey - New ephemeral public key from remote party
   */
  private async performReceivingDHRatchetStep(
    state: RatchetState,
    newEphemeralPublicKey: Uint8Array
  ): Promise<void> {
    console.log(`Performing DH ratchet step for receiving chain`);
    console.log('🔍 Validating ephemeral public key:', {
      keyLength: newEphemeralPublicKey.length,
      keyType: newEphemeralPublicKey.constructor.name,
      firstBytes: Array.from(newEphemeralPublicKey.slice(0, 8)),
      lastBytes: Array.from(newEphemeralPublicKey.slice(-8)),
      isAllZeros: newEphemeralPublicKey.every(byte => byte === 0)
    });
    
    if (!this.x25519Service.validatePublicKey(newEphemeralPublicKey)) {
      console.error('❌ Ephemeral public key validation failed');
      throw new Error('Invalid ephemeral public key received');
    }
    console.log('✅ Ephemeral public key validation passed');

    // Compute shared secret with new ephemeral public key
    const dhOutput = await this.x25519Service.computeSharedSecret(
      state.sendingEphemeralKey.privateKey,
      newEphemeralPublicKey
    );

    // Derive new root and receiving chain keys
    const { newRootKey, newChainKey } = await this.x25519Service.ratchetKeys(
      state.rootKey,
      dhOutput
    );

    // Update state
    this.x25519Service.secureZero(state.rootKey);
    if (state.receivingChainKey.length > 0) {
      this.chainKeyService.secureZero(state.receivingChainKey);
    }
    
    state.rootKey = newRootKey;
    state.receivingChainKey = newChainKey;
    state.receivingEphemeralPublicKey = new Uint8Array(newEphemeralPublicKey);
    state.receivingChainLength++;
    state.receivingMessageNumber = 0;

    // Clear the DH output
    this.chainKeyService.secureZero(dhOutput);
  }

  /**
   * Try to get message key for current receiving chain position
   * 
   * @param state - Current ratchet state
   * @param ratchetMessage - Incoming ratchet message
   * @returns Message key if available, null otherwise
   */
  private async tryGetMessageKey(
    state: RatchetState,
    ratchetMessage: RatchetMessage
  ): Promise<Uint8Array | null> {
    if (ratchetMessage.messageNumber === state.receivingMessageNumber) {
      // Message is next in sequence
      const messageKey = await this.chainKeyService.deriveMessageKey(
        state.receivingChainKey,
        ratchetMessage.messageNumber
      );
      
      // Advance receiving chain
      state.receivingChainKey = await this.chainKeyService.advanceChainKey(
        state.receivingChainKey
      );
      
      return messageKey;
    }
    
    // Check if we have a skipped key for this message
    const keyId = this.chainKeyService.createMessageKeyId(
      ratchetMessage.chainLength,
      ratchetMessage.messageNumber
    );
    
    const skippedKey = state.skippedMessageKeys.get(keyId);
    if (skippedKey) {
      // Remove from skipped keys (one-time use)
      state.skippedMessageKeys.delete(keyId);
      return new Uint8Array(skippedKey);
    }
    
    return null;
  }

  /**
   * Skip messages to handle out-of-order delivery
   * 
   * @param state - Current ratchet state
   * @param ratchetMessage - Target message to decrypt
   * @returns Message key for target message
   */
  private async skipToMessage(
    state: RatchetState,
    ratchetMessage: RatchetMessage
  ): Promise<Uint8Array> {
    const skipCount = ratchetMessage.messageNumber - state.receivingMessageNumber;
    
    if (skipCount <= 0) {
      throw new Error('Cannot skip to past message');
    }
    
    if (skipCount > this.MAX_SKIP) {
      throw new Error(`Cannot skip more than ${this.MAX_SKIP} messages`);
    }

    console.log(`Skipping ${skipCount} messages to reach message ${ratchetMessage.messageNumber}`);

    // Generate and store keys for all skipped messages
    const { newChainKey, skippedKeys } = await this.chainKeyService.skipToMessage(
      state.receivingChainKey,
      state.receivingMessageNumber,
      ratchetMessage.messageNumber
    );

    // Store skipped keys for later use
    for (const [messageNum, messageKey] of skippedKeys) {
      const keyId = this.chainKeyService.createMessageKeyId(
        state.receivingChainLength,
        messageNum
      );
      state.skippedMessageKeys.set(keyId, new Uint8Array(messageKey));
    }

    // Get the key for the target message
    const targetKey = await this.chainKeyService.deriveMessageKey(
      newChainKey,
      ratchetMessage.messageNumber
    );

    // Update receiving chain state
    state.receivingChainKey = await this.chainKeyService.advanceChainKey(newChainKey);
    state.receivingMessageNumber = ratchetMessage.messageNumber;

    return targetKey;
  }

  /**
   * Check if ratchet state exists for a conversation and user
   * 
   * @param conversationId - Conversation identifier
   * @param userId - User identifier
   * @returns True if ratchet state exists, false otherwise
   */
  async hasRatchetState(conversationId: string, userId: string): Promise<boolean> {
    const state = await this.getState(conversationId, userId);
    console.log(`🔍 Checking ratchet state for ${conversationId}:${userId}:`, state !== null);
    return state !== null;
  }

  /**
   * Get ratchet state for a conversation and user
   * 
   * @param conversationId - Conversation ID
   * @param userId - User ID
   * @returns Ratchet state or null if not found
   */
  private async getState(conversationId: string, userId: string): Promise<RatchetState | null> {
    const stateKey = this.getStateKey(conversationId, userId);
    console.log('🔐 DoubleRatchetService.getState: Looking for state with key:', stateKey);
    console.log('🔐 DoubleRatchetService.getState: Available states:', Array.from(this.states.keys()));
    
    let state = this.states.get(stateKey);
    
    if (!state) {
      console.log('🔐 DoubleRatchetService.getState: State not found in memory, trying to load from storage');
      // Try to load from backend
      state = await this.loadRatchetState(conversationId, userId);
      if (state) {
        console.log('🔐 DoubleRatchetService.getState: State loaded from storage, caching in memory');
        this.states.set(stateKey, state);
      } else {
        console.log('🔐 DoubleRatchetService.getState: No state found in storage either');
      }
    } else {
      console.log('🔐 DoubleRatchetService.getState: State found in memory');
    }
    
    return state;
  }

  /**
   * Generate state key for internal storage
   * 
   * @param conversationId - Conversation ID
   * @param userId - User ID
   * @returns State key
   */
  private getStateKey(conversationId: string, userId: string): string {
    return `${conversationId}-${userId}`;
  }

  /**
   * Compare two byte arrays for equality
   * 
   * @param a - First array
   * @param b - Second array
   * @returns True if arrays are equal
   */
  private equalBytes(a: Uint8Array, b: Uint8Array): boolean {
    return this.chainKeyService.constantTimeEquals(a, b);
  }

  /**
   * Persist ratchet state to backend
   * 
   * @param state - Ratchet state to persist
   */
  private async persistRatchetState(state: RatchetState): Promise<void> {
    try {
      // For local demo, store ratchet state in memory only
      // In production, this would persist to secure server storage
      console.log('📝 Ratchet state persisted locally for conversation:', state.conversationId);
      
      // Optional: Could store in AsyncStorage for persistence across app restarts
      // const exportedState = this.exportRatchetState(state);
      // await AsyncStorage.setItem(`ratchet_${state.conversationId}_${state.userId}`, JSON.stringify(exportedState));
      
    } catch (error) {
      console.error('Failed to persist ratchet state:', error);
      // In production, this should trigger backup storage mechanism
    }
  }

  /**
   * Load ratchet state from backend
   * 
   * @param conversationId - Conversation ID
   * @param userId - User ID
   * @returns Loaded ratchet state or null
   */
  private async loadRatchetState(
    conversationId: string,
    userId: string
  ): Promise<RatchetState | null> {
    // For local demo, ratchet states are only stored in memory
    // In production, this would load from secure server storage
    console.log('📝 No server-side ratchet state loading for local demo');
    
    // Optional: Could load from AsyncStorage for persistence across app restarts
    // try {
    //   const stored = await AsyncStorage.getItem(`ratchet_${conversationId}_${userId}`);
    //   if (stored) {
    //     return this.importRatchetState(JSON.parse(stored));
    //   }
    // } catch (error) {
    //   console.error('Failed to load ratchet state from AsyncStorage:', error);
    // }
    
    return null;
  }

  /**
   * Export ratchet state for storage
   * 
   * @param state - Ratchet state to export
   * @returns Exported state object
   */
  private exportRatchetState(state: RatchetState): any {
    return {
      rootKey: this.x25519Service.exportPublicKey(state.rootKey),
      sendingChainKey: this.chainKeyService.exportChainKey(state.sendingChainKey),
      receivingChainKey: this.chainKeyService.exportChainKey(state.receivingChainKey),
      sendingMessageNumber: state.sendingMessageNumber,
      receivingMessageNumber: state.receivingMessageNumber,
      sendingChainLength: state.sendingChainLength,
      receivingChainLength: state.receivingChainLength,
      sendingEphemeralKey: this.x25519Service.exportKeyPair(state.sendingEphemeralKey),
      receivingEphemeralPublicKey: state.receivingEphemeralPublicKey ? 
        this.x25519Service.exportPublicKey(state.receivingEphemeralPublicKey) : null,
      skippedMessageKeys: Array.from(state.skippedMessageKeys.entries()).map(([id, key]) => ({
        id,
        key: this.chainKeyService.exportChainKey(key),
      })),
      conversationId: state.conversationId,
      userId: state.userId,
      createdAt: state.createdAt,
      lastUpdated: state.lastUpdated,
    };
  }

  /**
   * Import ratchet state from storage
   * 
   * @param exportedState - Exported state object
   * @returns Imported ratchet state
   */
  private importRatchetState(exportedState: any): RatchetState {
    const skippedMessageKeys = new Map<string, Uint8Array>();
    
    for (const skippedKey of exportedState.skippedMessageKeys || []) {
      skippedMessageKeys.set(
        skippedKey.id,
        this.chainKeyService.importChainKey(skippedKey.key)
      );
    }

    return {
      rootKey: this.x25519Service.importPublicKey(exportedState.rootKey),
      sendingChainKey: this.chainKeyService.importChainKey(exportedState.sendingChainKey),
      receivingChainKey: this.chainKeyService.importChainKey(exportedState.receivingChainKey),
      sendingMessageNumber: exportedState.sendingMessageNumber,
      receivingMessageNumber: exportedState.receivingMessageNumber,
      sendingChainLength: exportedState.sendingChainLength,
      receivingChainLength: exportedState.receivingChainLength,
      sendingEphemeralKey: this.x25519Service.importKeyPair(exportedState.sendingEphemeralKey),
      receivingEphemeralPublicKey: exportedState.receivingEphemeralPublicKey ? 
        this.x25519Service.importPublicKey(exportedState.receivingEphemeralPublicKey) : null,
      skippedMessageKeys,
      conversationId: exportedState.conversationId,
      userId: exportedState.userId,
      createdAt: exportedState.createdAt,
      lastUpdated: exportedState.lastUpdated,
    };
  }

  /**
   * Clean up old skipped message keys to prevent memory leaks
   * 
   * @param state - Ratchet state to clean
   */
  private cleanupOldKeys(state: RatchetState): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [keyId] of state.skippedMessageKeys) {
      try {
        const { chainLength, messageNumber } = this.chainKeyService.parseMessageKeyId(keyId);
        
        // Remove keys older than cleanup interval
        if (now - state.createdAt > this.KEY_CLEANUP_INTERVAL) {
          keysToDelete.push(keyId);
        }
      } catch {
        // Invalid key ID format, remove it
        keysToDelete.push(keyId);
      }
    }
    
    for (const keyId of keysToDelete) {
      const key = state.skippedMessageKeys.get(keyId);
      if (key) {
        this.chainKeyService.secureZero(key);
        state.skippedMessageKeys.delete(keyId);
      }
    }
    
    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} old message keys`);
    }
  }

  /**
   * Get current ratchet statistics for monitoring
   * 
   * @param conversationId - Conversation ID
   * @param userId - User ID
   * @returns Ratchet statistics
   */
  async getRatchetStatistics(conversationId: string, userId: string): Promise<{
    sendingMessageNumber: number;
    receivingMessageNumber: number;
    sendingChainLength: number;
    receivingChainLength: number;
    skippedKeysCount: number;
    lastUpdated: number;
  } | null> {
    const state = await this.getState(conversationId, userId);
    
    if (!state) {
      return null;
    }
    
    return {
      sendingMessageNumber: state.sendingMessageNumber,
      receivingMessageNumber: state.receivingMessageNumber,
      sendingChainLength: state.sendingChainLength,
      receivingChainLength: state.receivingChainLength,
      skippedKeysCount: state.skippedMessageKeys.size,
      lastUpdated: state.lastUpdated,
    };
  }

  /**
   * Delete ratchet state (for conversation cleanup)
   * 
   * @param conversationId - Conversation ID
   * @param userId - User ID
   */
  async deleteRatchetState(conversationId: string, userId: string): Promise<void> {
    const stateKey = this.getStateKey(conversationId, userId);
    const state = this.states.get(stateKey);
    
    if (state) {
      // Securely clear all sensitive material
      this.x25519Service.secureZero(state.rootKey);
      this.chainKeyService.secureZero(state.sendingChainKey);
      this.chainKeyService.secureZero(state.receivingChainKey);
      this.x25519Service.secureZero(state.sendingEphemeralKey.privateKey);
      
      for (const [, key] of state.skippedMessageKeys) {
        this.chainKeyService.secureZero(key);
      }
      
      this.states.delete(stateKey);
    }
    
    // Delete from backend
    try {
      await chatAPI.delete(`/api/ratchet/state/${conversationId}/${userId}`);
    } catch (error) {
      console.error('Failed to delete ratchet state from backend:', error);
    }
  }
}

// Export singleton instance
export const doubleRatchetService = new DoubleRatchetService();