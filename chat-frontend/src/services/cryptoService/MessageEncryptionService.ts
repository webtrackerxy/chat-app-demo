import sodium from 'libsodium-wrappers';

/**
 * Encrypted message payload structure
 */
export interface EncryptedPayload {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
  tag: Uint8Array;
  associatedData?: Uint8Array;
}

/**
 * Message Encryption Service for Perfect Forward Secrecy
 * 
 * Provides authenticated encryption using ChaCha20-Poly1305 AEAD (Authenticated Encryption with Associated Data).
 * This service encrypts individual messages with unique keys derived from the chain key.
 */
export class MessageEncryptionService {
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
   * Encrypt a message using ChaCha20-Poly1305 AEAD
   * 
   * @param plaintext - Message to encrypt
   * @param messageKey - Unique key for this message (32 bytes)
   * @param associatedData - Optional authenticated but unencrypted data
   * @returns Encrypted payload with ciphertext, nonce, and authentication tag
   */
  async encryptMessage(
    plaintext: string,
    messageKey: Uint8Array,
    associatedData?: Uint8Array
  ): Promise<EncryptedPayload> {
    await this.initialize();
    
    console.log('🔐 Encrypting message--:', {plaintext,messageKey, associatedData} )
    if (messageKey.length !== 32) {
      throw new Error('Message key must be 32 bytes');
    }
    
    // Convert plaintext to bytes
    const plaintextBytes = sodium.from_string(plaintext);
    
    // Generate random nonce (12 bytes for ChaCha20-Poly1305)
    let nonceLength: number;
    try {
      nonceLength = parseInt(String(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES), 10);
      if (isNaN(nonceLength) || nonceLength <= 0) {
        console.warn('Invalid nonce length from libsodium:', sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES, 'using fallback');
        nonceLength = 12; // Standard nonce length for ChaCha20-Poly1305
      }
    } catch (error) {
      console.warn('Error accessing libsodium nonce length constant:', error, 'using fallback');
      nonceLength = 12; // Standard nonce length for ChaCha20-Poly1305
    }
    
    // Final validation
    if (!Number.isInteger(nonceLength) || nonceLength <= 0) {
      console.error('Invalid nonce length after processing:', nonceLength, typeof nonceLength);
      throw new Error('Invalid nonce length: must be a positive integer');
    }
    
    console.log(`🔐 Generating nonce with length: ${nonceLength}`);
    const nonce = sodium.randombytes_buf(nonceLength);
    console.log(`🔐 Generating nonce: ${nonce}`);
    
    // Encrypt with authenticated encryption
    console.log('🔐 Encrypt with authenticated encryption', plaintextBytes, associatedData, nonce, messageKey);
    const encrypted = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
      plaintextBytes,
      associatedData || null,
      null, // nsec (not used in this construction)
      nonce,
      messageKey
    );
    
    console.log('🔐 Encrypt with authenticated encryption: encrypted--',nonceLength,  encrypted);

    // Split ciphertext and authentication tag
    // ChaCha20-Poly1305 appends the 16-byte tag to the ciphertext
    const ciphertext = encrypted.slice(0, -16);
    const tag = encrypted.slice(-16);
    
    console.log('🔐 Encrypt with authenticated encryption: ciphertext', ciphertext, 'tag', tag);
    return {
      ciphertext,
      nonce,
      tag,
      associatedData,
    };
  }

  /**
   * Decrypt a message using ChaCha20-Poly1305 AEAD
   * 
   * @param payload - Encrypted payload
   * @param messageKey - Unique key for this message (32 bytes)
   * @returns Decrypted plaintext message
   */
  async decryptMessage(
    payload: EncryptedPayload,
    messageKey: Uint8Array
  ): Promise<string> {
    await this.initialize();
    
    if (messageKey.length !== 32) {
      throw new Error('Message key must be 32 bytes');
    }
    
    const expectedNonceLength = sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES;
    console.log('🔓 MessageEncryptionService.decryptMessage: Nonce length validation:', {
      actualLength: payload.nonce.length,
      expectedLength: expectedNonceLength,
      constantValue: sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES
    });
    
    if (payload.nonce.length !== expectedNonceLength) {
      console.error('❌ Nonce length mismatch in decryption:', {
        actual: payload.nonce.length,
        expected: expectedNonceLength,
        nonce: Array.from(payload.nonce.slice(0, 16)) // Show first 16 bytes for debugging
      });
      throw new Error('Invalid nonce length');
    }
    
    if (payload.tag.length !== 16) {
      throw new Error('Invalid authentication tag length');
    }
    
    // Combine ciphertext and tag for libsodium
    const combined = new Uint8Array(payload.ciphertext.length + payload.tag.length);
    combined.set(payload.ciphertext);
    combined.set(payload.tag, payload.ciphertext.length);
    
    console.log('🔓 MessageEncryptionService.decryptMessage: About to decrypt with libsodium:', {
      combinedLength: combined.length,
      associatedDataLength: payload.associatedData?.length || 0,
      nonceLength: payload.nonce.length,
      messageKeyLength: messageKey.length,
      associatedDataFirst16Bytes: payload.associatedData ? Array.from(payload.associatedData.slice(0, 16)) : null
    });
    
    try {
      // Decrypt and verify
      const decrypted = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
        null, // nsec (not used)
        combined,
        payload.associatedData || null,
        payload.nonce,
        messageKey
      );
      
      console.log('🔓 MessageEncryptionService.decryptMessage: Decryption successful, plaintext length:', decrypted.length);
      return sodium.to_string(decrypted);
    } catch (error) {
      console.error('🔓 MessageEncryptionService.decryptMessage: libsodium decryption failed:', error);
      console.error('🔓 MessageEncryptionService.decryptMessage: Debug info:', {
        combinedHex: Array.from(combined.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(''),
        nonceHex: Array.from(payload.nonce).map(b => b.toString(16).padStart(2, '0')).join(''),
        keyHex: Array.from(messageKey.slice(0, 16)).map(b => b.toString(16).padStart(2, '0')).join('') + '...'
      });
      throw new Error('Decryption failed: invalid key or corrupted data');
    }
  }

  /**
   * Encrypt binary data (for file encryption)
   * 
   * @param data - Binary data to encrypt
   * @param messageKey - Unique key for this data (32 bytes)
   * @param associatedData - Optional authenticated but unencrypted data
   * @returns Encrypted payload
   */
  async encryptBinaryData(
    data: Uint8Array,
    messageKey: Uint8Array,
    associatedData?: Uint8Array
  ): Promise<EncryptedPayload> {
    await this.initialize();
    
    if (messageKey.length !== 32) {
      throw new Error('Message key must be 32 bytes');
    }
    
    // Generate random nonce
    let nonceLength: number;
    try {
      nonceLength = parseInt(String(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES), 10);
      if (isNaN(nonceLength) || nonceLength <= 0) {
        console.warn('Invalid nonce length from libsodium:', sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES, 'using fallback');
        nonceLength = 12; // Standard nonce length for ChaCha20-Poly1305
      }
    } catch (error) {
      console.warn('Error accessing libsodium nonce length constant:', error, 'using fallback');
      nonceLength = 12; // Standard nonce length for ChaCha20-Poly1305
    }
    
    // Final validation
    if (!Number.isInteger(nonceLength) || nonceLength <= 0) {
      console.error('Invalid nonce length after processing:', nonceLength, typeof nonceLength);
      throw new Error('Invalid nonce length: must be a positive integer');
    }
    
    console.log(`🔐 Generating nonce with length: ${nonceLength} (encrypt method)`);
    const nonce = sodium.randombytes_buf(nonceLength);
    
    // Encrypt with authenticated encryption
    const encrypted = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
      data,
      associatedData || null,
      null,
      nonce,
      messageKey
    );
    
    // Split ciphertext and authentication tag
    const ciphertext = encrypted.slice(0, -16);
    const tag = encrypted.slice(-16);
    
    return {
      ciphertext,
      nonce,
      tag,
      associatedData,
    };
  }

  /**
   * Decrypt binary data (for file decryption)
   * 
   * @param payload - Encrypted payload
   * @param messageKey - Unique key for this data (32 bytes)
   * @returns Decrypted binary data
   */
  async decryptBinaryData(
    payload: EncryptedPayload,
    messageKey: Uint8Array
  ): Promise<Uint8Array> {
    await this.initialize();
    
    if (messageKey.length !== 32) {
      throw new Error('Message key must be 32 bytes');
    }
    
    // Combine ciphertext and tag
    const combined = new Uint8Array(payload.ciphertext.length + payload.tag.length);
    combined.set(payload.ciphertext);
    combined.set(payload.tag, payload.ciphertext.length);
    
    try {
      // Decrypt and verify
      return sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
        null,
        combined,
        payload.associatedData || null,
        payload.nonce,
        messageKey
      );
    } catch (error) {
      throw new Error('Decryption failed: invalid key or corrupted data');
    }
  }

  /**
   * Create associated data for message authentication
   * Includes metadata that should be authenticated but not encrypted
   * 
   * @param metadata - Message metadata
   * @returns Serialized associated data
   */
  createAssociatedData(metadata: {
    senderId: string;
    messageNumber: number;
    chainLength: number;
    timestamp: number;
    ephemeralPublicKey?: Uint8Array;
  }): Uint8Array {
    console.log('🔐 MessageEncryptionService.createAssociatedData: Input metadata:', {
      senderId: metadata.senderId,
      messageNumber: metadata.messageNumber,
      chainLength: metadata.chainLength,
      timestamp: metadata.timestamp,
      timestampType: typeof metadata.timestamp,
      ephemeralPublicKeyLength: metadata.ephemeralPublicKey?.length || 0
    });
    
    // Create a structured format for associated data
    const encoder = new TextEncoder();
    const senderIdBytes = encoder.encode(metadata.senderId);
    
    // Calculate total size
    const totalSize = 4 + // senderId length
                     senderIdBytes.length +
                     4 + // messageNumber
                     4 + // chainLength  
                     8 + // timestamp
                     4 + // ephemeralPublicKey length
                     (metadata.ephemeralPublicKey?.length || 0);
    
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;
    
    // Sender ID
    view.setUint32(offset, senderIdBytes.length, false);
    offset += 4;
    new Uint8Array(buffer, offset, senderIdBytes.length).set(senderIdBytes);
    offset += senderIdBytes.length;
    
    // Message number
    view.setUint32(offset, metadata.messageNumber, false);
    offset += 4;
    
    // Chain length
    view.setUint32(offset, metadata.chainLength, false);
    offset += 4;
    
    // Timestamp
    const timestamp = metadata.timestamp || 0;
    if (typeof timestamp !== 'number' || !isFinite(timestamp)) {
      console.error('Invalid timestamp in createAssociatedData:', timestamp, typeof timestamp);
      throw new Error(`Invalid timestamp: ${timestamp}`);
    }
    view.setBigUint64(offset, BigInt(Math.floor(timestamp)), false);
    offset += 8;
    
    // Ephemeral public key
    const ephemeralKeyLength = metadata.ephemeralPublicKey?.length || 0;
    view.setUint32(offset, ephemeralKeyLength, false);
    offset += 4;
    
    if (metadata.ephemeralPublicKey) {
      new Uint8Array(buffer, offset, ephemeralKeyLength).set(metadata.ephemeralPublicKey);
    }
    
    const result = new Uint8Array(buffer);
    console.log('🔐 MessageEncryptionService.createAssociatedData: Created associated data:', {
      length: result.length,
      first16Bytes: Array.from(result.slice(0, 16)),
      totalSize: totalSize
    });
    
    return result;
  }

  /**
   * Parse associated data back into metadata
   * 
   * @param associatedData - Serialized associated data
   * @returns Parsed metadata
   */
  parseAssociatedData(associatedData: Uint8Array): {
    senderId: string;
    messageNumber: number;
    chainLength: number;
    timestamp: number;
    ephemeralPublicKey?: Uint8Array;
  } {
    const view = new DataView(associatedData.buffer, associatedData.byteOffset);
    let offset = 0;
    
    // Sender ID
    const senderIdLength = view.getUint32(offset, false);
    offset += 4;
    const senderIdBytes = associatedData.slice(offset, offset + senderIdLength);
    const senderId = new TextDecoder().decode(senderIdBytes);
    offset += senderIdLength;
    
    // Message number
    const messageNumber = view.getUint32(offset, false);
    offset += 4;
    
    // Chain length
    const chainLength = view.getUint32(offset, false);
    offset += 4;
    
    // Timestamp
    const timestamp = Number(view.getBigUint64(offset, false));
    offset += 8;
    
    // Ephemeral public key
    const ephemeralKeyLength = view.getUint32(offset, false);
    offset += 4;
    
    let ephemeralPublicKey: Uint8Array | undefined;
    if (ephemeralKeyLength > 0) {
      ephemeralPublicKey = associatedData.slice(offset, offset + ephemeralKeyLength);
    }
    
    return {
      senderId,
      messageNumber,
      chainLength,
      timestamp,
      ephemeralPublicKey,
    };
  }

  /**
   * Export encrypted payload to base64 strings for storage/transmission
   * 
   * @param payload - Encrypted payload
   * @returns Base64-encoded payload
   */
  exportEncryptedPayload(payload: EncryptedPayload): {
    ciphertext: string;
    nonce: string;
    tag: string;
    associatedData?: string;
  } {
    return {
      ciphertext: sodium.to_base64(payload.ciphertext),
      nonce: sodium.to_base64(payload.nonce),
      tag: sodium.to_base64(payload.tag),
      associatedData: payload.associatedData ? sodium.to_base64(payload.associatedData) : undefined,
    };
  }

  /**
   * Import encrypted payload from base64 strings
   * 
   * @param exportedPayload - Base64-encoded payload
   * @returns Encrypted payload
   */
  importEncryptedPayload(exportedPayload: {
    ciphertext: string;
    nonce: string;
    tag: string;
    associatedData?: string;
  }): EncryptedPayload {
    return {
      ciphertext: sodium.from_base64(exportedPayload.ciphertext),
      nonce: sodium.from_base64(exportedPayload.nonce),
      tag: sodium.from_base64(exportedPayload.tag),
      associatedData: exportedPayload.associatedData ? 
        sodium.from_base64(exportedPayload.associatedData) : undefined,
    };
  }

  /**
   * Verify the integrity of an encrypted payload
   * 
   * @param payload - Encrypted payload to verify
   * @returns True if payload structure is valid
   */
  verifyPayloadIntegrity(payload: EncryptedPayload): boolean {
    try {
      // Check required fields
      if (!payload.ciphertext || !payload.nonce || !payload.tag) {
        return false;
      }
      
      // Check field types
      if (!(payload.ciphertext instanceof Uint8Array) ||
          !(payload.nonce instanceof Uint8Array) ||
          !(payload.tag instanceof Uint8Array)) {
        return false;
      }
      
      // Check field lengths
      if (payload.nonce.length !== sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES) {
        return false;
      }
      
      if (payload.tag.length !== 16) {
        return false;
      }
      
      // Check ciphertext is not empty
      if (payload.ciphertext.length === 0) {
        return false;
      }
      
      // Check associated data if present
      if (payload.associatedData && !(payload.associatedData instanceof Uint8Array)) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Calculate the overhead size of encryption
   * 
   * @returns Encryption overhead in bytes
   */
  getEncryptionOverhead(): number {
    return sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES + // nonce
           16; // authentication tag
  }

  /**
   * Get maximum plaintext size for a given ciphertext size
   * 
   * @param ciphertextSize - Size of ciphertext
   * @returns Maximum plaintext size
   */
  getMaxPlaintextSize(ciphertextSize: number): number {
    const overhead = this.getEncryptionOverhead();
    return Math.max(0, ciphertextSize - overhead);
  }

  /**
   * Estimate ciphertext size for a given plaintext
   * 
   * @param plaintextSize - Size of plaintext
   * @returns Estimated ciphertext size
   */
  estimateCiphertextSize(plaintextSize: number): number {
    return plaintextSize + this.getEncryptionOverhead();
  }

  /**
   * Securely clear encrypted payload from memory
   * 
   * @param payload - Payload to clear
   */
  secureZero(payload: EncryptedPayload): void {
    // Overwrite sensitive data
    payload.ciphertext.set(sodium.randombytes_buf(payload.ciphertext.length));
    payload.nonce.set(sodium.randombytes_buf(payload.nonce.length));
    payload.tag.set(sodium.randombytes_buf(payload.tag.length));
    
    if (payload.associatedData) {
      payload.associatedData.set(sodium.randombytes_buf(payload.associatedData.length));
    }
    
    // Then zero everything
    payload.ciphertext.fill(0);
    payload.nonce.fill(0);
    payload.tag.fill(0);
    
    if (payload.associatedData) {
      payload.associatedData.fill(0);
    }
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get encryption performance metrics
   * 
   * @param testDataSize - Size of test data in bytes
   * @param iterations - Number of test iterations
   * @returns Performance metrics
   */
  async getPerformanceMetrics(
    testDataSize: number = 1024,
    iterations: number = 100
  ): Promise<{
    encryptionTime: number;
    decryptionTime: number;
    throughputMBps: number;
  }> {
    await this.initialize();
    
    // Generate test data
    const testKey = sodium.randombytes_buf(32);
    const testData = sodium.randombytes_buf(testDataSize);
    const testMessage = sodium.to_string(testData);
    
    // Measure encryption time
    const encryptStart = performance.now();
    let lastPayload: EncryptedPayload | null = null;
    
    for (let i = 0; i < iterations; i++) {
      lastPayload = await this.encryptMessage(testMessage, testKey);
    }
    
    const encryptEnd = performance.now();
    const encryptionTime = encryptEnd - encryptStart;
    
    // Measure decryption time
    const decryptStart = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      await this.decryptMessage(lastPayload!, testKey);
    }
    
    const decryptEnd = performance.now();
    const decryptionTime = decryptEnd - decryptStart;
    
    // Calculate throughput
    const totalBytes = testDataSize * iterations * 2; // encrypt + decrypt
    const totalTime = (encryptionTime + decryptionTime) / 1000; // convert to seconds
    const throughputMBps = (totalBytes / (1024 * 1024)) / totalTime;
    
    // Clean up
    testKey.set(sodium.randombytes_buf(testKey.length));
    if (lastPayload) {
      this.secureZero(lastPayload);
    }
    
    return {
      encryptionTime: encryptionTime / iterations,
      decryptionTime: decryptionTime / iterations,
      throughputMBps,
    };
  }
}

// Export singleton instance
export const messageEncryptionService = new MessageEncryptionService();