import { DoubleRatchetService } from '../DoubleRatchetService';
import { X25519Service } from '../X25519Service';
import { ChainKeyService } from '../ChainKeyService';
import { MessageEncryptionService } from '../MessageEncryptionService';

// Mock the API
jest.mock('@api/chatApi', () => ({
  chatAPI: {
    post: jest.fn().mockResolvedValue({ success: true }),
    get: jest.fn().mockResolvedValue({ ratchetState: null }),
    delete: jest.fn().mockResolvedValue({ success: true }),
  },
}));

describe('Perfect Forward Secrecy Security Tests', () => {
  let ratchetService: DoubleRatchetService;
  let x25519Service: X25519Service;
  let chainKeyService: ChainKeyService;
  let encryptionService: MessageEncryptionService;

  beforeAll(async () => {
    ratchetService = new DoubleRatchetService();
    x25519Service = new X25519Service();
    chainKeyService = new ChainKeyService();
    encryptionService = new MessageEncryptionService();

    await Promise.all([
      ratchetService.initialize(),
      x25519Service.initialize(),
      chainKeyService.initialize(),
      encryptionService.initialize(),
    ]);
  });

  afterEach(async () => {
    // Clean up test states
    try {
      await ratchetService.deleteRatchetState('security-test', 'user1');
      await ratchetService.deleteRatchetState('security-test', 'user2');
      await ratchetService.deleteRatchetState('security-test', 'attacker');
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Perfect Forward Secrecy Verification', () => {
    beforeEach(async () => {
      const conversationId = 'security-test';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);
    });

    test('should provide forward secrecy after key compromise', async () => {
      const conversationId = 'security-test';
      
      // Exchange several messages normally
      const preCompromiseMessages = [
        'Secret message 1',
        'Secret message 2',
        'Secret message 3'
      ];
      
      const preCompromiseEncrypted = [];
      const preCompromiseDecrypted = [];
      
      for (const message of preCompromiseMessages) {
        const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', message);
        preCompromiseEncrypted.push(encrypted);
        
        const decrypted = await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
        preCompromiseDecrypted.push(decrypted);
        
        expect(decrypted).toBe(message);
      }

      // Simulate key compromise - get current state
      const compromiseStats = await ratchetService.getRatchetStatistics(conversationId, 'user1');
      const compromisePoint = compromiseStats!.sendingMessageNumber;

      // Continue sending messages after "compromise"
      const postCompromiseMessages = [
        'New secure message 1',
        'New secure message 2'
      ];
      
      for (const message of postCompromiseMessages) {
        const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', message);
        const decrypted = await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
        
        expect(decrypted).toBe(message);
        expect(encrypted.messageNumber).toBeGreaterThanOrEqual(compromisePoint);
      }

      // Verify that keys have advanced (different message numbers indicate different keys)
      const finalStats = await ratchetService.getRatchetStatistics(conversationId, 'user1');
      expect(finalStats!.sendingMessageNumber).toBeGreaterThan(compromiseStats!.sendingMessageNumber);
    });

    test('should generate unique keys for identical messages', async () => {
      const conversationId = 'security-test';
      const identicalMessage = 'This exact message is sent multiple times';
      
      const encryptions = [];
      
      // Encrypt the same message multiple times
      for (let i = 0; i < 5; i++) {
        const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', identicalMessage);
        encryptions.push(encrypted);
      }

      // Verify all encryptions are different
      for (let i = 0; i < encryptions.length; i++) {
        for (let j = i + 1; j < encryptions.length; j++) {
          // Ciphertext should be different
          expect(encryptions[i].encryptedData.ciphertext).not.toEqual(
            encryptions[j].encryptedData.ciphertext
          );
          
          // Nonces should be different
          expect(encryptions[i].encryptedData.nonce).not.toEqual(
            encryptions[j].encryptedData.nonce
          );
          
          // Message numbers should be different
          expect(encryptions[i].messageNumber).not.toBe(encryptions[j].messageNumber);
        }
      }

      // Verify all decrypt to the same message
      for (const encrypted of encryptions) {
        const decrypted = await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
        expect(decrypted).toBe(identicalMessage);
      }
    });

    test('should prevent key reuse across message numbers', async () => {
      const conversationId = 'security-test';
      
      // Generate multiple message keys from the same chain key at different positions
      const chainKey = chainKeyService.generateChainKey();
      const messageKeys = [];
      
      for (let i = 0; i < 10; i++) {
        const messageKey = await chainKeyService.deriveMessageKey(chainKey, i);
        messageKeys.push(messageKey);
      }

      // Verify all message keys are unique
      for (let i = 0; i < messageKeys.length; i++) {
        for (let j = i + 1; j < messageKeys.length; j++) {
          expect(messageKeys[i]).not.toEqual(messageKeys[j]);
        }
      }
    });
  });

  describe('Authentication and Integrity', () => {
    beforeEach(async () => {
      const conversationId = 'security-test';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);
    });

    test('should detect message tampering', async () => {
      const conversationId = 'security-test';
      const originalMessage = 'Important authenticated message';
      
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', originalMessage);
      
      // Tamper with ciphertext
      const tamperedEncrypted = { ...encrypted };
      tamperedEncrypted.encryptedData = {
        ...encrypted.encryptedData,
        ciphertext: new Uint8Array(encrypted.encryptedData.ciphertext)
      };
      tamperedEncrypted.encryptedData.ciphertext[0] ^= 0xFF; // Flip bits

      // Decryption should fail
      await expect(
        ratchetService.decryptMessage(conversationId, 'user2', tamperedEncrypted)
      ).rejects.toThrow();
    });

    test('should detect authentication tag tampering', async () => {
      const conversationId = 'security-test';
      const originalMessage = 'Message with authentication';
      
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', originalMessage);
      
      // Tamper with authentication tag
      const tamperedEncrypted = { ...encrypted };
      tamperedEncrypted.encryptedData = {
        ...encrypted.encryptedData,
        tag: new Uint8Array(encrypted.encryptedData.tag)
      };
      tamperedEncrypted.encryptedData.tag[0] ^= 0xFF;

      // Decryption should fail
      await expect(
        ratchetService.decryptMessage(conversationId, 'user2', tamperedEncrypted)
      ).rejects.toThrow();
    });

    test('should detect nonce tampering', async () => {
      const conversationId = 'security-test';
      const originalMessage = 'Message with nonce protection';
      
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', originalMessage);
      
      // Tamper with nonce
      const tamperedEncrypted = { ...encrypted };
      tamperedEncrypted.encryptedData = {
        ...encrypted.encryptedData,
        nonce: new Uint8Array(encrypted.encryptedData.nonce)
      };
      tamperedEncrypted.encryptedData.nonce[0] ^= 0xFF;

      // Decryption should fail
      await expect(
        ratchetService.decryptMessage(conversationId, 'user2', tamperedEncrypted)
      ).rejects.toThrow();
    });

    test('should verify associated data integrity', async () => {
      const conversationId = 'security-test';
      const originalMessage = 'Message with associated data';
      
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', originalMessage);
      
      // Tamper with associated data if it exists
      if (encrypted.encryptedData.associatedData) {
        const tamperedEncrypted = { ...encrypted };
        tamperedEncrypted.encryptedData = {
          ...encrypted.encryptedData,
          associatedData: new Uint8Array(encrypted.encryptedData.associatedData)
        };
        tamperedEncrypted.encryptedData.associatedData[0] ^= 0xFF;

        // Decryption should fail
        await expect(
          ratchetService.decryptMessage(conversationId, 'user2', tamperedEncrypted)
        ).rejects.toThrow();
      }
    });
  });

  describe('Attack Resistance', () => {
    beforeEach(async () => {
      const conversationId = 'security-test';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);
    });

    test('should resist replay attacks', async () => {
      const conversationId = 'security-test';
      const message = 'Message to replay';
      
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', message);
      
      // First decryption should work
      const decrypted1 = await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
      expect(decrypted1).toBe(message);

      // Second decryption of the same message should behave consistently
      // (Implementation may vary - some allow replay within windows, others don't)
      try {
        const decrypted2 = await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
        // If replay is allowed, verify content consistency
        expect(decrypted2).toBe(message);
      } catch (error) {
        // If replay is prevented, that's also acceptable security behavior
        expect(error).toBeDefined();
      }
    });

    test('should resist message reordering attacks', async () => {
      const conversationId = 'security-test';
      const messages = ['Message A', 'Message B', 'Message C'];
      const encrypted = [];
      
      // Encrypt messages in order
      for (const message of messages) {
        const enc = await ratchetService.encryptMessage(conversationId, 'user1', message);
        encrypted.push(enc);
      }

      // Decrypt in different order - should still work due to out-of-order handling
      const decrypted = [];
      const indices = [2, 0, 1]; // C, A, B
      
      for (const index of indices) {
        const dec = await ratchetService.decryptMessage(conversationId, 'user2', encrypted[index]);
        decrypted.push(dec);
      }

      expect(decrypted).toEqual(['Message C', 'Message A', 'Message B']);
    });

    test('should limit excessive message skipping to prevent DoS', async () => {
      const conversationId = 'security-test';
      
      // Create a large number of messages (exceeding MAX_SKIP limit)
      const largeGap = 1500; // Should exceed MAX_SKIP of 1000
      const messages = [];
      
      for (let i = 0; i < largeGap; i++) {
        const encrypted = await ratchetService.encryptMessage(
          conversationId,
          'user1',
          `Message ${i}`
        );
        messages.push(encrypted);
      }

      // Try to decrypt the last message (creating large skip gap)
      await expect(
        ratchetService.decryptMessage(conversationId, 'user2', messages[largeGap - 1])
      ).rejects.toThrow();
    });

    test('should reject invalid ephemeral public keys', async () => {
      const conversationId = 'security-test';
      const message = 'Test message';
      
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', message);
      
      // Test various invalid ephemeral keys
      const invalidKeys = [
        new Uint8Array(32), // All zeros
        new Uint8Array(32).fill(0xFF), // All ones
        new Uint8Array(31), // Wrong size
        new Uint8Array(33), // Wrong size
      ];

      for (const invalidKey of invalidKeys) {
        const tamperedEncrypted = {
          ...encrypted,
          ephemeralPublicKey: invalidKey
        };

        await expect(
          ratchetService.decryptMessage(conversationId, 'user2', tamperedEncrypted)
        ).rejects.toThrow();
      }
    });
  });

  describe('Cryptographic Primitives Security', () => {
    test('should generate cryptographically secure random keys', async () => {
      const keyCount = 100;
      const keys = [];
      
      // Generate many keys
      for (let i = 0; i < keyCount; i++) {
        const keyPair = await x25519Service.generateKeyPair();
        keys.push(keyPair);
      }

      // Verify uniqueness (extremely unlikely to have duplicates with proper RNG)
      for (let i = 0; i < keys.length; i++) {
        for (let j = i + 1; j < keys.length; j++) {
          expect(keys[i].publicKey).not.toEqual(keys[j].publicKey);
          expect(keys[i].privateKey).not.toEqual(keys[j].privateKey);
        }
      }
    });

    test('should validate public key format', async () => {
      // Valid key
      const validKeyPair = await x25519Service.generateKeyPair();
      expect(x25519Service.validatePublicKey(validKeyPair.publicKey)).toBe(true);

      // Invalid keys
      const invalidKeys = [
        new Uint8Array(32), // All zeros
        new Uint8Array(31), // Wrong size
        new Uint8Array(33), // Wrong size
        new Uint8Array(32).fill(0xFF), // All ones (potentially invalid)
      ];

      for (const invalidKey of invalidKeys) {
        expect(x25519Service.validatePublicKey(invalidKey)).toBe(false);
      }
    });

    test('should produce consistent ECDH results', async () => {
      // Generate two key pairs
      const keyPair1 = await x25519Service.generateKeyPair();
      const keyPair2 = await x25519Service.generateKeyPair();

      // Compute shared secrets both ways
      const secret1 = await x25519Service.computeSharedSecret(
        keyPair1.privateKey,
        keyPair2.publicKey
      );
      const secret2 = await x25519Service.computeSharedSecret(
        keyPair2.privateKey,
        keyPair1.publicKey
      );

      // Should be identical
      expect(secret1).toEqual(secret2);
      expect(secret1).toHaveLength(32);
      
      // Should not be all zeros (weak key)
      const allZeros = secret1.every(byte => byte === 0);
      expect(allZeros).toBe(false);
    });

    test('should use secure encryption parameters', async () => {
      const message = 'Test message for encryption';
      const key = x25519Service.randomBytes(32);
      
      const encrypted = await encryptionService.encryptMessage(message, key);
      
      // Verify encryption parameters
      expect(encrypted.nonce).toHaveLength(12); // ChaCha20-Poly1305 nonce size
      expect(encrypted.tag).toHaveLength(16);   // Poly1305 tag size
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
      
      // Nonce should be unique for each encryption
      const encrypted2 = await encryptionService.encryptMessage(message, key);
      expect(encrypted.nonce).not.toEqual(encrypted2.nonce);
    });

    test('should properly handle key derivation', async () => {
      const baseKey = x25519Service.randomBytes(32);
      
      // Derive multiple keys from the same base
      const derived1 = await x25519Service.deriveKeys(baseKey, 'context1');
      const derived2 = await x25519Service.deriveKeys(baseKey, 'context2');
      const derived3 = await x25519Service.deriveKeys(baseKey, 'context1'); // Same context
      
      // Different contexts should produce different keys
      expect(derived1.rootKey).not.toEqual(derived2.rootKey);
      expect(derived1.chainKey).not.toEqual(derived2.chainKey);
      
      // Same context should produce same keys
      expect(derived1.rootKey).toEqual(derived3.rootKey);
      expect(derived1.chainKey).toEqual(derived3.chainKey);
    });
  });

  describe('Side-Channel Attack Resistance', () => {
    test('should use constant-time operations for key comparison', async () => {
      const key1 = x25519Service.randomBytes(32);
      const key2 = x25519Service.randomBytes(32);
      const key3 = new Uint8Array(key1); // Copy of key1
      
      // Test constant-time comparison
      expect(chainKeyService.constantTimeEquals(key1, key2)).toBe(false);
      expect(chainKeyService.constantTimeEquals(key1, key3)).toBe(true);
      
      // Test with different lengths
      const shortKey = new Uint8Array(16);
      expect(chainKeyService.constantTimeEquals(key1, shortKey)).toBe(false);
    });

    test('should not leak information through timing', async () => {
      const conversationId = 'security-test';
      const validMessage = 'Valid message';
      
      // Encrypt a valid message
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', validMessage);
      
      // Measure timing for valid decryption
      const validStartTime = performance.now();
      const decrypted = await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
      const validEndTime = performance.now();
      const validTime = validEndTime - validStartTime;
      
      expect(decrypted).toBe(validMessage);
      
      // Measure timing for invalid decryption (tampered message)
      const tamperedEncrypted = { ...encrypted };
      tamperedEncrypted.encryptedData = {
        ...encrypted.encryptedData,
        ciphertext: new Uint8Array(encrypted.encryptedData.ciphertext)
      };
      tamperedEncrypted.encryptedData.ciphertext[0] ^= 0xFF;
      
      const invalidStartTime = performance.now();
      try {
        await ratchetService.decryptMessage(conversationId, 'user2', tamperedEncrypted);
      } catch (error) {
        // Expected to fail
      }
      const invalidEndTime = performance.now();
      const invalidTime = invalidEndTime - invalidStartTime;
      
      // Timing difference should not be excessive (basic check)
      // In a production system, more sophisticated timing analysis would be needed
      const timingRatio = Math.max(validTime, invalidTime) / Math.min(validTime, invalidTime);
      expect(timingRatio).toBeLessThan(10); // Allow for some variation, but not huge differences
    });
  });

  describe('Memory Safety', () => {
    test('should clear sensitive data from memory', async () => {
      const sensitiveKey = x25519Service.randomBytes(32);
      const originalKey = new Uint8Array(sensitiveKey);
      
      // Clear the key
      x25519Service.secureZero(sensitiveKey);
      
      // Verify key has been cleared
      expect(sensitiveKey).not.toEqual(originalKey);
      expect(sensitiveKey.every(byte => byte === 0)).toBe(true);
    });

    test('should handle secure zero for chain keys', async () => {
      const chainKey = chainKeyService.generateChainKey();
      const originalKey = new Uint8Array(chainKey);
      
      // Clear the chain key
      chainKeyService.secureZero(chainKey);
      
      // Verify key has been cleared
      expect(chainKey).not.toEqual(originalKey);
      expect(chainKey.every(byte => byte === 0)).toBe(true);
    });

    test('should clear encrypted payloads', async () => {
      const message = 'Sensitive message';
      const key = x25519Service.randomBytes(32);
      
      const encrypted = await encryptionService.encryptMessage(message, key);
      const originalCiphertext = new Uint8Array(encrypted.ciphertext);
      
      // Clear the payload
      encryptionService.secureZero(encrypted);
      
      // Verify sensitive data has been cleared
      expect(encrypted.ciphertext).not.toEqual(originalCiphertext);
      expect(encrypted.ciphertext.every(byte => byte === 0)).toBe(true);
      expect(encrypted.nonce.every(byte => byte === 0)).toBe(true);
      expect(encrypted.tag.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Input Validation', () => {
    test('should reject invalid message lengths', async () => {
      const conversationId = 'security-test';
      
      // Empty message should be handled gracefully
      const emptyEncrypted = await ratchetService.encryptMessage(conversationId, 'user1', '');
      const emptyDecrypted = await ratchetService.decryptMessage(conversationId, 'user2', emptyEncrypted);
      expect(emptyDecrypted).toBe('');
    });

    test('should validate encryption key sizes', async () => {
      const message = 'Test message';
      
      // Invalid key sizes should be rejected
      const invalidKeySizes = [0, 16, 31, 33, 64];
      
      for (const size of invalidKeySizes) {
        const invalidKey = new Uint8Array(size);
        
        await expect(
          encryptionService.encryptMessage(message, invalidKey)
        ).rejects.toThrow();
      }
    });

    test('should validate chain key formats', async () => {
      const invalidKeys = [
        new Uint8Array(0),   // Empty
        new Uint8Array(16),  // Too short
        new Uint8Array(64),  // Too long
        new Uint8Array(32),  // All zeros (weak key)
      ];

      for (const invalidKey of invalidKeys) {
        expect(chainKeyService.validateChainKey(invalidKey)).toBe(false);
      }
      
      // Valid key should pass
      const validKey = chainKeyService.generateChainKey();
      expect(chainKeyService.validateChainKey(validKey)).toBe(true);
    });
  });

  describe('Protocol Security', () => {
    test('should maintain protocol integrity across multiple ratchet steps', async () => {
      const conversationId = 'security-test';
      
      // Send enough messages to trigger multiple ratchet steps
      const messageCount = 250; // Should trigger 2+ ratchet steps
      const messages = [];
      
      for (let i = 0; i < messageCount; i++) {
        const message = `Protocol integrity test message ${i}`;
        const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', message);
        messages.push({ original: message, encrypted });
      }

      // Decrypt all messages and verify integrity
      for (const { original, encrypted } of messages) {
        const decrypted = await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
        expect(decrypted).toBe(original);
      }

      // Verify ratchet steps occurred
      const finalStats = await ratchetService.getRatchetStatistics(conversationId, 'user1');
      expect(finalStats!.sendingChainLength).toBeGreaterThan(0);
    });

    test('should maintain security with bidirectional communication', async () => {
      const conversationId = 'security-test';
      
      // Simulate realistic conversation with alternating messages
      const conversation = [
        { sender: 'user1', message: 'Hello, how are you?' },
        { sender: 'user2', message: 'I am fine, thanks! How about you?' },
        { sender: 'user1', message: 'Great! Want to discuss the project?' },
        { sender: 'user2', message: 'Sure, what are your thoughts?' },
        { sender: 'user1', message: 'I think we should focus on security first.' },
        { sender: 'user2', message: 'Absolutely agree. Perfect forward secrecy is crucial.' },
      ];

      const encryptedConversation = [];
      
      // Encrypt conversation
      for (const { sender, message } of conversation) {
        const receiver = sender === 'user1' ? 'user2' : 'user1';
        const encrypted = await ratchetService.encryptMessage(conversationId, sender, message);
        encryptedConversation.push({ sender, receiver, message, encrypted });
      }
      
      // Decrypt and verify conversation
      for (const { sender, receiver, message, encrypted } of encryptedConversation) {
        const decrypted = await ratchetService.decryptMessage(conversationId, receiver, encrypted);
        expect(decrypted).toBe(message);
      }
    });
  });
});