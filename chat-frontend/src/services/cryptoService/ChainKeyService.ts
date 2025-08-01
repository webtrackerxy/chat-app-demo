import sodium from 'libsodium-wrappers';

/**
 * Chain Key Management Service for Perfect Forward Secrecy
 * 
 * Manages the advancement of chain keys in the Double Ratchet protocol.
 * Each message gets its own unique key derived from the current chain key,
 * which is then advanced to provide forward secrecy.
 */
export class ChainKeyService {
  private initialized = false;

  /**
   * Initialize the libsodium library
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await sodium.ready;
      this.initialized = true;
    }
  }

  /**
   * Advance chain key using HMAC-based key derivation
   * 
   * This creates a new chain key from the current one, ensuring that
   * old chain keys cannot be used to derive future message keys.
   * 
   * @param chainKey - Current chain key (32 bytes)
   * @returns New chain key (32 bytes)
   */
  async advanceChainKey(chainKey: Uint8Array): Promise<Uint8Array> {
    await this.initialize();
    
    if (chainKey.length !== 32) {
      throw new Error('Chain key must be 32 bytes');
    }
    
    // Use HMAC with a constant message to advance the chain key
    const message = new Uint8Array([0x01]); // Chain key advancement constant
    
    return sodium.crypto_auth(message, chainKey);
  }

  /**
   * Derive message key from chain key for a specific message number
   * 
   * This creates a unique key for encrypting a single message,
   * while keeping the chain key secret.
   * 
   * @param chainKey - Current chain key (32 bytes)
   * @param messageNumber - Sequential message number
   * @returns Message key (32 bytes)
   */
  async deriveMessageKey(chainKey: Uint8Array, messageNumber: number): Promise<Uint8Array> {
    await this.initialize();
    
    if (chainKey.length !== 32) {
      throw new Error('Chain key must be 32 bytes');
    }
    
    if (messageNumber < 0 || messageNumber > 0xFFFFFFFF) {
      throw new Error('Message number must be a valid 32-bit unsigned integer');
    }
    
    // Convert message number to big-endian bytes
    const messageNumberBytes = new Uint8Array(4);
    new DataView(messageNumberBytes.buffer).setUint32(0, messageNumber, false);
    
    // Use HMAC with message number to derive message key
    return sodium.crypto_auth(messageNumberBytes, chainKey);
  }

  /**
   * Derive multiple keys from chain key for different cryptographic purposes
   * 
   * This creates separate keys for encryption, authentication, and initialization vector
   * to provide defense in depth.
   * 
   * @param chainKey - Current chain key (32 bytes)
   * @param messageNumber - Sequential message number
   * @returns Object containing message key, MAC key, and IV
   */
  async deriveMessageKeys(chainKey: Uint8Array, messageNumber: number): Promise<{
    messageKey: Uint8Array;
    macKey: Uint8Array;
    iv: Uint8Array;
  }> {
    await this.initialize();
    
    if (chainKey.length !== 32) {
      throw new Error('Chain key must be 32 bytes');
    }
    
    // First derive a master key for this message
    const masterKey = await this.deriveMessageKey(chainKey, messageNumber);
    
    // Use KDF to derive multiple keys from the master key
    const derivedMaterial = sodium.crypto_kdf_derive_from_key(
      96, // 32 + 32 + 32 bytes for message key + MAC key + IV
      1,  // subkey id
      'MSGKEYS', // context (8 bytes)
      masterKey
    );
    
    return {
      messageKey: derivedMaterial.slice(0, 32),
      macKey: derivedMaterial.slice(32, 64),
      iv: derivedMaterial.slice(64, 96),
    };
  }

  /**
   * Skip messages in the chain to handle out-of-order delivery
   * 
   * This advances the chain key multiple times and stores the
   * intermediate message keys for later use.
   * 
   * @param chainKey - Current chain key
   * @param currentMessageNumber - Current message number
   * @param targetMessageNumber - Target message number to skip to
   * @returns Object containing new chain key and skipped message keys
   */
  async skipToMessage(
    chainKey: Uint8Array,
    currentMessageNumber: number,
    targetMessageNumber: number
  ): Promise<{
    newChainKey: Uint8Array;
    skippedKeys: Map<number, Uint8Array>;
  }> {
    await this.initialize();
    
    if (targetMessageNumber <= currentMessageNumber) {
      throw new Error('Target message number must be greater than current');
    }
    
    const maxSkip = 1000; // Maximum messages to skip (prevent DoS)
    const skipCount = targetMessageNumber - currentMessageNumber;
    
    if (skipCount > maxSkip) {
      throw new Error(`Cannot skip more than ${maxSkip} messages`);
    }
    
    let currentChainKey = new Uint8Array(chainKey);
    const skippedKeys = new Map<number, Uint8Array>();
    
    // Generate and store keys for all skipped messages
    for (let i = currentMessageNumber; i < targetMessageNumber; i++) {
      // Derive message key before advancing chain key
      const messageKey = await this.deriveMessageKey(currentChainKey, i);
      skippedKeys.set(i, messageKey);
      
      // Advance chain key for next message
      currentChainKey = await this.advanceChainKey(currentChainKey);
    }
    
    return {
      newChainKey: currentChainKey,
      skippedKeys,
    };
  }

  /**
   * Generate a fresh chain key from random bytes
   * Used when initializing new ratchet states
   * 
   * @returns Random 32-byte chain key
   */
  generateChainKey(): Uint8Array {
    if (!this.initialized) {
      throw new Error('ChainKeyService not initialized');
    }
    
    return sodium.randombytes_buf(32);
  }

  /**
   * Validate that a chain key has the correct format
   * 
   * @param chainKey - Key to validate
   * @returns True if valid, false otherwise
   */
  validateChainKey(chainKey: Uint8Array): boolean {
    try {
      // Check length
      if (chainKey.length !== 32) {
        return false;
      }
      
      // Check that it's not all zeros (weak key)
      const allZeros = chainKey.every(byte => byte === 0);
      if (allZeros) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a message key identifier for storage/retrieval
   * 
   * @param chainLength - Current chain length
   * @param messageNumber - Message number within chain
   * @returns Unique identifier string
   */
  createMessageKeyId(chainLength: number, messageNumber: number): string {
    return `${chainLength}-${messageNumber}`;
  }

  /**
   * Parse message key identifier back into components
   * 
   * @param keyId - Message key identifier
   * @returns Object with chain length and message number
   */
  parseMessageKeyId(keyId: string): { chainLength: number; messageNumber: number } {
    const parts = keyId.split('-');
    if (parts.length !== 2) {
      throw new Error('Invalid message key ID format');
    }
    
    const chainLength = parseInt(parts[0], 10);
    const messageNumber = parseInt(parts[1], 10);
    
    if (isNaN(chainLength) || isNaN(messageNumber)) {
      throw new Error('Invalid message key ID format');
    }
    
    return { chainLength, messageNumber };
  }

  /**
   * Compute HMAC for message authentication
   * 
   * @param data - Data to authenticate
   * @param key - Authentication key
   * @returns HMAC tag
   */
  async computeHMAC(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    await this.initialize();
    
    if (key.length !== 32) {
      throw new Error('HMAC key must be 32 bytes');
    }
    
    return sodium.crypto_auth(data, key);
  }

  /**
   * Verify HMAC for message authentication
   * 
   * @param data - Data to verify
   * @param tag - HMAC tag to verify
   * @param key - Authentication key
   * @returns True if verification succeeds
   */
  async verifyHMAC(data: Uint8Array, tag: Uint8Array, key: Uint8Array): Promise<boolean> {
    await this.initialize();
    
    if (key.length !== 32) {
      throw new Error('HMAC key must be 32 bytes');
    }
    
    if (tag.length !== 32) {
      throw new Error('HMAC tag must be 32 bytes');
    }
    
    try {
      return sodium.crypto_auth_verify(tag, data, key);
    } catch {
      return false;
    }
  }

  /**
   * Export chain key to base64 string for storage
   * 
   * @param chainKey - Chain key to export
   * @returns Base64-encoded chain key
   */
  exportChainKey(chainKey: Uint8Array): string {
    if (chainKey.length !== 32) {
      throw new Error('Chain key must be 32 bytes');
    }
    return sodium.to_base64(chainKey);
  }

  /**
   * Import chain key from base64 string
   * 
   * @param chainKeyBase64 - Base64-encoded chain key
   * @returns Chain key as Uint8Array
   */
  importChainKey(chainKeyBase64: string): Uint8Array {
    const chainKey = sodium.from_base64(chainKeyBase64);
    if (chainKey.length !== 32) {
      throw new Error('Invalid chain key length');
    }
    return chainKey;
  }

  /**
   * Securely clear sensitive key material from memory
   * 
   * @param key - Key to clear
   */
  secureZero(key: Uint8Array): void {
    // Overwrite with random data first (generate random bytes and copy them)
    const randomBytes = sodium.randombytes_buf(key.length);
    key.set(randomBytes);
    // Then zero it
    key.fill(0);
  }

  /**
   * Constant-time comparison of byte arrays
   * Prevents timing attacks on key comparisons
   * 
   * @param a - First array
   * @param b - Second array
   * @returns True if arrays are equal
   */
  constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    
    return result === 0;
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get chain key advancement statistics for monitoring
   * 
   * @param initialChainKey - Starting chain key
   * @param steps - Number of advancement steps
   * @returns Performance metrics
   */
  async getAdvancementMetrics(
    initialChainKey: Uint8Array,
    steps: number
  ): Promise<{
    totalTime: number;
    averageTime: number;
    stepsPerSecond: number;
  }> {
    await this.initialize();
    
    const startTime = performance.now();
    let currentKey = new Uint8Array(initialChainKey);
    
    for (let i = 0; i < steps; i++) {
      currentKey = await this.advanceChainKey(currentKey);
    }
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / steps;
    const stepsPerSecond = (steps / totalTime) * 1000;
    
    // Clear the final key
    this.secureZero(currentKey);
    
    return {
      totalTime,
      averageTime,
      stepsPerSecond,
    };
  }
}

// Export singleton instance
export const chainKeyService = new ChainKeyService();