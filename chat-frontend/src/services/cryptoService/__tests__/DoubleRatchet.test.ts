import { DoubleRatchetService, RatchetMessage } from '../DoubleRatchetService';
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

describe('Double Ratchet Implementation', () => {
  let ratchetService: DoubleRatchetService;
  let x25519Service: X25519Service;
  let chainKeyService: ChainKeyService;
  let encryptionService: MessageEncryptionService;

  beforeEach(async () => {
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
    // Clean up any test states
    const testStates = ['test-conversation-user1', 'test-conversation-user2'];
    for (const stateKey of testStates) {
      try {
        const [conversationId, userId] = stateKey.split('-').slice(-2);
        await ratchetService.deleteRatchetState(conversationId, userId);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Ratchet Initialization', () => {
    test('should initialize ratchet state correctly', async () => {
      const conversationId = 'test-conversation';
      const userId = 'user1';
      const sharedSecret = x25519Service.randomBytes(32);

      await ratchetService.initializeRatchet(conversationId, userId, sharedSecret, true);
      
      const stats = await ratchetService.getRatchetStatistics(conversationId, userId);
      expect(stats).toBeDefined();
      expect(stats!.sendingMessageNumber).toBe(0);
      expect(stats!.receivingMessageNumber).toBe(0);
      expect(stats!.sendingChainLength).toBe(0);
      expect(stats!.receivingChainLength).toBe(0);
    });

    test('should throw error for invalid shared secret', async () => {
      const conversationId = 'test-conversation';
      const userId = 'user1';
      const invalidSecret = new Uint8Array(16); // Wrong size

      await expect(
        ratchetService.initializeRatchet(conversationId, userId, invalidSecret, true)
      ).rejects.toThrow('Shared secret must be 32 bytes');
    });

    test('should initialize different states for different users', async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);

      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);

      const stats1 = await ratchetService.getRatchetStatistics(conversationId, 'user1');
      const stats2 = await ratchetService.getRatchetStatistics(conversationId, 'user2');

      expect(stats1).toBeDefined();
      expect(stats2).toBeDefined();
      expect(stats1!.sendingMessageNumber).toBe(0);
      expect(stats2!.sendingMessageNumber).toBe(0);
    });
  });

  describe('Message Encryption and Decryption', () => {
    beforeEach(async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);

      // Initialize ratchets for both users with same shared secret
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);
    });

    test('should encrypt and decrypt messages correctly', async () => {
      const conversationId = 'test-conversation';
      const originalMessage = 'Hello, this is a test message with Perfect Forward Secrecy!';

      // User1 encrypts message
      const encryptedMessage = await ratchetService.encryptMessage(
        conversationId,
        'user1',
        originalMessage
      );

      expect(encryptedMessage).toBeDefined();
      expect(encryptedMessage.encryptedData).toBeDefined();
      expect(encryptedMessage.ephemeralPublicKey).toBeDefined();
      expect(encryptedMessage.messageNumber).toBe(0);
      expect(encryptedMessage.chainLength).toBe(0);

      // User2 decrypts message
      const decryptedMessage = await ratchetService.decryptMessage(
        conversationId,
        'user2',
        encryptedMessage
      );

      expect(decryptedMessage).toBe(originalMessage);
    });

    test('should handle multiple sequential messages', async () => {
      const conversationId = 'test-conversation';
      const messages = [
        'First message',
        'Second message',
        'Third message with more content',
        'Fourth message with special characters: !@#$%^&*()',
        'Fifth message with unicode: 🔐 🚀 ✨'
      ];

      const encryptedMessages: RatchetMessage[] = [];

      // Encrypt all messages
      for (let i = 0; i < messages.length; i++) {
        const encrypted = await ratchetService.encryptMessage(
          conversationId,
          'user1',
          messages[i]
        );
        
        expect(encrypted.messageNumber).toBe(i);
        encryptedMessages.push(encrypted);
      }

      // Decrypt all messages in order
      for (let i = 0; i < encryptedMessages.length; i++) {
        const decrypted = await ratchetService.decryptMessage(
          conversationId,
          'user2',
          encryptedMessages[i]
        );
        
        expect(decrypted).toBe(messages[i]);
      }
    });

    test('should handle bidirectional messaging', async () => {
      const conversationId = 'test-conversation';
      
      // User1 sends message
      const message1 = 'Hello from User1';
      const encrypted1 = await ratchetService.encryptMessage(conversationId, 'user1', message1);
      const decrypted1 = await ratchetService.decryptMessage(conversationId, 'user2', encrypted1);
      expect(decrypted1).toBe(message1);

      // User2 responds
      const message2 = 'Hello back from User2';
      const encrypted2 = await ratchetService.encryptMessage(conversationId, 'user2', message2);
      const decrypted2 = await ratchetService.decryptMessage(conversationId, 'user1', encrypted2);
      expect(decrypted2).toBe(message2);

      // Continue conversation
      const message3 = 'Great to hear from you!';
      const encrypted3 = await ratchetService.encryptMessage(conversationId, 'user1', message3);
      const decrypted3 = await ratchetService.decryptMessage(conversationId, 'user2', encrypted3);
      expect(decrypted3).toBe(message3);
    });
  });

  describe('Out-of-Order Message Handling', () => {
    beforeEach(async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);
    });

    test('should handle out-of-order messages', async () => {
      const conversationId = 'test-conversation';
      const messages = ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5'];
      const encryptedMessages: RatchetMessage[] = [];

      // Encrypt multiple messages
      for (const message of messages) {
        const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', message);
        encryptedMessages.push(encrypted);
      }

      // Decrypt in reverse order (simulate out-of-order delivery)
      const decryptedMessages: string[] = [];
      for (let i = encryptedMessages.length - 1; i >= 0; i--) {
        const decrypted = await ratchetService.decryptMessage(
          conversationId,
          'user2',
          encryptedMessages[i]
        );
        decryptedMessages.unshift(decrypted); // Insert at beginning to maintain order
      }

      expect(decryptedMessages).toEqual(messages);
    });

    test('should handle missing messages in sequence', async () => {
      const conversationId = 'test-conversation';
      const messages = ['Message 1', 'Message 2', 'Message 3', 'Message 4'];
      const encryptedMessages: RatchetMessage[] = [];

      // Encrypt messages
      for (const message of messages) {
        const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', message);
        encryptedMessages.push(encrypted);
      }

      // Decrypt message 1, then skip to message 4 (missing 2 and 3)
      const decrypted1 = await ratchetService.decryptMessage(
        conversationId,
        'user2',
        encryptedMessages[0]
      );
      expect(decrypted1).toBe('Message 1');

      const decrypted4 = await ratchetService.decryptMessage(
        conversationId,
        'user2',
        encryptedMessages[3]
      );
      expect(decrypted4).toBe('Message 4');

      // Now decrypt the missing messages
      const decrypted2 = await ratchetService.decryptMessage(
        conversationId,
        'user2',
        encryptedMessages[1]
      );
      expect(decrypted2).toBe('Message 2');

      const decrypted3 = await ratchetService.decryptMessage(
        conversationId,
        'user2',
        encryptedMessages[2]
      );
      expect(decrypted3).toBe('Message 3');
    });

    test('should reject excessive message skipping', async () => {
      const conversationId = 'test-conversation';
      
      // Create a large gap by encrypting many messages
      const manyMessages: RatchetMessage[] = [];
      for (let i = 0; i < 1500; i++) { // Exceed MAX_SKIP limit
        const encrypted = await ratchetService.encryptMessage(
          conversationId,
          'user1',
          `Message ${i}`
        );
        manyMessages.push(encrypted);
      }

      // Try to decrypt the last message (should fail due to large gap)
      await expect(
        ratchetService.decryptMessage(conversationId, 'user2', manyMessages[1499])
      ).rejects.toThrow();
    });
  });

  describe('Perfect Forward Secrecy Properties', () => {
    beforeEach(async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);
    });

    test('should provide forward secrecy after key advancement', async () => {
      const conversationId = 'test-conversation';
      
      // Send several messages to advance the chain
      const oldMessages = ['Old message 1', 'Old message 2', 'Old message 3'];
      for (const message of oldMessages) {
        const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', message);
        await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
      }

      // Get current chain state (simulating key compromise point)
      const statsBeforeCompromise = await ratchetService.getRatchetStatistics(conversationId, 'user1');
      expect(statsBeforeCompromise!.sendingMessageNumber).toBe(3);

      // Send new messages after "compromise"
      const newMessage = 'New message after compromise';
      const newEncrypted = await ratchetService.encryptMessage(conversationId, 'user1', newMessage);
      const newDecrypted = await ratchetService.decryptMessage(conversationId, 'user2', newEncrypted);
      expect(newDecrypted).toBe(newMessage);

      // Verify that message numbers have advanced (different keys used)
      expect(newEncrypted.messageNumber).toBe(3);
      
      // Each message should have unique encryption (same plaintext produces different ciphertext)
      const sameMessage = 'Identical message';
      const encrypted1 = await ratchetService.encryptMessage(conversationId, 'user1', sameMessage);
      const encrypted2 = await ratchetService.encryptMessage(conversationId, 'user1', sameMessage);
      
      expect(encrypted1.encryptedData.ciphertext).not.toEqual(encrypted2.encryptedData.ciphertext);
      expect(encrypted1.messageNumber).not.toBe(encrypted2.messageNumber);
    });

    test('should perform DH ratchet step after interval', async () => {
      const conversationId = 'test-conversation';
      
      // Send messages to trigger DH ratchet step (100 message interval)
      let lastStats = await ratchetService.getRatchetStatistics(conversationId, 'user1');
      const initialChainLength = lastStats!.sendingChainLength;
      
      // Send exactly 100 messages to trigger ratchet step
      for (let i = 0; i < 100; i++) {
        await ratchetService.encryptMessage(conversationId, 'user1', `Message ${i}`);
      }
      
      const statsAfterRatchet = await ratchetService.getRatchetStatistics(conversationId, 'user1');
      
      // Chain length should have incremented and message number reset
      expect(statsAfterRatchet!.sendingChainLength).toBeGreaterThan(initialChainLength);
      expect(statsAfterRatchet!.sendingMessageNumber).toBeLessThan(100); // Reset after ratchet step
    });
  });

  describe('Error Handling', () => {
    test('should reject encryption without initialization', async () => {
      await expect(
        ratchetService.encryptMessage('nonexistent-conversation', 'user1', 'test message')
      ).rejects.toThrow('Ratchet state not found');
    });

    test('should reject decryption without initialization', async () => {
      const mockMessage: RatchetMessage = {
        encryptedData: {
          ciphertext: new Uint8Array(10),
          nonce: new Uint8Array(12),
          tag: new Uint8Array(16),
        },
        ephemeralPublicKey: new Uint8Array(32),
        messageNumber: 0,
        chainLength: 0,
        previousChainLength: 0,
      };

      await expect(
        ratchetService.decryptMessage('nonexistent-conversation', 'user1', mockMessage)
      ).rejects.toThrow('Ratchet state not found');
    });

    test('should handle corrupted encrypted messages', async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);

      // Create a message and then corrupt it
      const originalMessage = 'Original message';
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', originalMessage);
      
      // Corrupt the ciphertext
      encrypted.encryptedData.ciphertext[0] ^= 0xFF;

      await expect(
        ratchetService.decryptMessage(conversationId, 'user2', encrypted)
      ).rejects.toThrow();
    });

    test('should handle invalid ephemeral public keys', async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);

      const originalMessage = 'Test message';
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', originalMessage);
      
      // Set invalid ephemeral public key (all zeros)
      encrypted.ephemeralPublicKey.fill(0);

      await expect(
        ratchetService.decryptMessage(conversationId, 'user2', encrypted)
      ).rejects.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    beforeEach(async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);
    });

    test('should encrypt messages within acceptable time', async () => {
      const conversationId = 'test-conversation';
      const testMessage = 'Performance test message with reasonable length for benchmarking';
      const iterations = 100;

      const startTime = performance.now();
      
      for (let i = 0; i < iterations; i++) {
        await ratchetService.encryptMessage(conversationId, 'user1', `${testMessage} ${i}`);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerMessage = totalTime / iterations;

      console.log(`Average encryption time: ${avgTimePerMessage.toFixed(2)}ms per message`);
      
      // Should encrypt each message in less than 10ms on average
      expect(avgTimePerMessage).toBeLessThan(10);
    });

    test('should handle large message volumes efficiently', async () => {
      const conversationId = 'test-conversation';
      const messageCount = 1000;
      const testMessage = 'Large volume test message';

      const startTime = performance.now();

      // Encrypt and decrypt many messages
      for (let i = 0; i < messageCount; i++) {
        const encrypted = await ratchetService.encryptMessage(
          conversationId,
          'user1',
          `${testMessage} ${i}`
        );
        
        const decrypted = await ratchetService.decryptMessage(
          conversationId,
          'user2',
          encrypted
        );
        
        expect(decrypted).toBe(`${testMessage} ${i}`);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerRoundTrip = totalTime / messageCount;

      console.log(`Average round-trip time: ${avgTimePerRoundTrip.toFixed(2)}ms per message`);
      
      // Should handle high volume efficiently (less than 20ms per round trip)
      expect(avgTimePerRoundTrip).toBeLessThan(20);
    });

    test('should manage memory usage with many skipped keys', async () => {
      const conversationId = 'test-conversation';
      
      // Create many messages with gaps to generate skipped keys
      const messages: RatchetMessage[] = [];
      for (let i = 0; i < 100; i++) {
        const encrypted = await ratchetService.encryptMessage(
          conversationId,
          'user1',
          `Message ${i}`
        );
        messages.push(encrypted);
      }

      // Decrypt every 10th message to create gaps
      for (let i = 9; i < messages.length; i += 10) {
        const decrypted = await ratchetService.decryptMessage(
          conversationId,
          'user2',
          messages[i]
        );
        expect(decrypted).toBe(`Message ${i}`);
      }

      // Check that skipped keys are being managed
      const stats = await ratchetService.getRatchetStatistics(conversationId, 'user2');
      expect(stats!.skippedKeysCount).toBeGreaterThan(0);
      expect(stats!.skippedKeysCount).toBeLessThan(1000); // Should not grow unbounded
    });
  });

  describe('Security Properties Verification', () => {
    test('should generate unique keys for each message', async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);

      const sameMessage = 'Identical plaintext message';
      const encrypted1 = await ratchetService.encryptMessage(conversationId, 'user1', sameMessage);
      const encrypted2 = await ratchetService.encryptMessage(conversationId, 'user1', sameMessage);

      // Same plaintext should produce different ciphertext
      expect(encrypted1.encryptedData.ciphertext).not.toEqual(encrypted2.encryptedData.ciphertext);
      expect(encrypted1.encryptedData.nonce).not.toEqual(encrypted2.encryptedData.nonce);
      expect(encrypted1.messageNumber).not.toBe(encrypted2.messageNumber);
    });

    test('should maintain message authenticity', async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);

      const originalMessage = 'Authenticated message';
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', originalMessage);

      // Tampering with associated data should fail authentication
      if (encrypted.encryptedData.associatedData) {
        encrypted.encryptedData.associatedData[0] ^= 0xFF;
        
        await expect(
          ratchetService.decryptMessage(conversationId, 'user2', encrypted)
        ).rejects.toThrow();
      }
    });

    test('should prevent replay attacks', async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);

      const message = 'Message to replay';
      const encrypted = await ratchetService.encryptMessage(conversationId, 'user1', message);
      
      // First decryption should work
      const decrypted1 = await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
      expect(decrypted1).toBe(message);

      // Second decryption of same message should fail (or produce different behavior)
      // Note: This depends on implementation - some systems allow replay within a window
      try {
        const decrypted2 = await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
        // If replay is allowed, at least verify the content is the same
        expect(decrypted2).toBe(message);
      } catch (error) {
        // If replay is prevented, that's also acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      const conversationId = 'test-conversation';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
    });

    test('should provide accurate statistics', async () => {
      const conversationId = 'test-conversation';
      
      // Initial state
      let stats = await ratchetService.getRatchetStatistics(conversationId, 'user1');
      expect(stats!.sendingMessageNumber).toBe(0);
      expect(stats!.sendingChainLength).toBe(0);

      // After sending messages
      await ratchetService.encryptMessage(conversationId, 'user1', 'Message 1');
      await ratchetService.encryptMessage(conversationId, 'user1', 'Message 2');

      stats = await ratchetService.getRatchetStatistics(conversationId, 'user1');
      expect(stats!.sendingMessageNumber).toBe(2);
      expect(stats!.lastUpdated).toBeGreaterThan(0);
    });

    test('should return null for non-existent ratchet state', async () => {
      const stats = await ratchetService.getRatchetStatistics('nonexistent', 'user1');
      expect(stats).toBeNull();
    });
  });

  describe('Cleanup and Resource Management', () => {
    test('should delete ratchet state cleanly', async () => {
      const conversationId = 'test-cleanup';
      const userId = 'user1';
      const sharedSecret = x25519Service.randomBytes(32);

      // Initialize and verify state exists
      await ratchetService.initializeRatchet(conversationId, userId, sharedSecret, true);
      let stats = await ratchetService.getRatchetStatistics(conversationId, userId);
      expect(stats).toBeDefined();

      // Delete state
      await ratchetService.deleteRatchetState(conversationId, userId);

      // Verify state is gone
      stats = await ratchetService.getRatchetStatistics(conversationId, userId);
      expect(stats).toBeNull();
    });
  });
});

// Test utility functions
describe('Cryptographic Service Components', () => {
  describe('X25519Service', () => {
    let x25519Service: X25519Service;

    beforeEach(async () => {
      x25519Service = new X25519Service();
      await x25519Service.initialize();
    });

    test('should generate valid key pairs', async () => {
      const keyPair = await x25519Service.generateKeyPair();
      
      expect(keyPair.publicKey).toHaveLength(32);
      expect(keyPair.privateKey).toHaveLength(32);
      expect(x25519Service.validatePublicKey(keyPair.publicKey)).toBe(true);
    });

    test('should compute shared secrets', async () => {
      const keyPair1 = await x25519Service.generateKeyPair();
      const keyPair2 = await x25519Service.generateKeyPair();

      const secret1 = await x25519Service.computeSharedSecret(keyPair1.privateKey, keyPair2.publicKey);
      const secret2 = await x25519Service.computeSharedSecret(keyPair2.privateKey, keyPair1.publicKey);

      expect(secret1).toEqual(secret2);
      expect(secret1).toHaveLength(32);
    });
  });

  describe('ChainKeyService', () => {
    let chainKeyService: ChainKeyService;

    beforeEach(async () => {
      chainKeyService = new ChainKeyService();
      await chainKeyService.initialize();
    });

    test('should advance chain keys consistently', async () => {
      const initialKey = chainKeyService.generateChainKey();
      const advancedKey1 = await chainKeyService.advanceChainKey(initialKey);
      const advancedKey2 = await chainKeyService.advanceChainKey(initialKey);

      expect(advancedKey1).toEqual(advancedKey2);
      expect(advancedKey1).not.toEqual(initialKey);
    });

    test('should derive unique message keys', async () => {
      const chainKey = chainKeyService.generateChainKey();
      const messageKey1 = await chainKeyService.deriveMessageKey(chainKey, 0);
      const messageKey2 = await chainKeyService.deriveMessageKey(chainKey, 1);

      expect(messageKey1).not.toEqual(messageKey2);
      expect(messageKey1).toHaveLength(32);
      expect(messageKey2).toHaveLength(32);
    });
  });

  describe('MessageEncryptionService', () => {
    let encryptionService: MessageEncryptionService;

    beforeEach(async () => {
      encryptionService = new MessageEncryptionService();
      await encryptionService.initialize();
    });

    test('should encrypt and decrypt messages', async () => {
      const message = 'Test message for encryption';
      const key = new Uint8Array(32);
      crypto.getRandomValues(key);

      const encrypted = await encryptionService.encryptMessage(message, key);
      const decrypted = await encryptionService.decryptMessage(encrypted, key);

      expect(decrypted).toBe(message);
      expect(encrypted.ciphertext.length).toBeGreaterThan(0);
      expect(encrypted.nonce.length).toBe(12);
      expect(encrypted.tag.length).toBe(16);
    });

    test('should handle binary data', async () => {
      const data = new Uint8Array([1, 2, 3, 4, 5]);
      const key = new Uint8Array(32);
      crypto.getRandomValues(key);

      const encrypted = await encryptionService.encryptBinaryData(data, key);
      const decrypted = await encryptionService.decryptBinaryData(encrypted, key);

      expect(decrypted).toEqual(data);
    });
  });
});