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

describe('Perfect Forward Secrecy Performance Tests', () => {
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
      await ratchetService.deleteRatchetState('perf-test', 'user1');
      await ratchetService.deleteRatchetState('perf-test', 'user2');
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('Encryption Performance', () => {
    beforeEach(async () => {
      const conversationId = 'perf-test';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);
    });

    test('should encrypt 1000 messages within acceptable time', async () => {
      const conversationId = 'perf-test';
      const messageCount = 1000;
      const testMessage = 'Performance test message with reasonable length for accurate benchmarking';

      const startTime = performance.now();
      
      for (let i = 0; i < messageCount; i++) {
        await ratchetService.encryptMessage(conversationId, 'user1', `${testMessage} ${i}`);
      }
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerMessage = totalTime / messageCount;

      console.log(`Encryption Performance:`);
      console.log(`  Total time for ${messageCount} encryptions: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time per encryption: ${avgTimePerMessage.toFixed(2)}ms`);
      console.log(`  Messages per second: ${((messageCount / totalTime) * 1000).toFixed(0)}`);

      // Should encrypt each message in less than 10ms on average
      expect(avgTimePerMessage).toBeLessThan(10);
    }, 30000); // 30 second timeout

    test('should handle large message volumes efficiently', async () => {
      const conversationId = 'perf-test';
      const messageCount = 5000;
      const testMessage = 'Large volume test message for throughput testing';

      const startTime = performance.now();

      // Encrypt and decrypt messages in batches for efficiency
      const batchSize = 100;
      for (let batch = 0; batch < messageCount / batchSize; batch++) {
        const encryptionPromises = [];
        
        for (let i = 0; i < batchSize; i++) {
          const messageIndex = batch * batchSize + i;
          encryptionPromises.push(
            ratchetService.encryptMessage(conversationId, 'user1', `${testMessage} ${messageIndex}`)
          );
        }
        
        const encryptedMessages = await Promise.all(encryptionPromises);
        
        // Decrypt the batch
        const decryptionPromises = encryptedMessages.map(encrypted =>
          ratchetService.decryptMessage(conversationId, 'user2', encrypted)
        );
        
        await Promise.all(decryptionPromises);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerRoundTrip = totalTime / messageCount;

      console.log(`Large Volume Performance:`);
      console.log(`  Total time for ${messageCount} round trips: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time per round trip: ${avgTimePerRoundTrip.toFixed(2)}ms`);
      console.log(`  Round trips per second: ${((messageCount / totalTime) * 1000).toFixed(0)}`);

      // Should handle high volume efficiently
      expect(avgTimePerRoundTrip).toBeLessThan(25);
    }, 60000); // 60 second timeout
  });

  describe('Key Management Performance', () => {
    test('should generate key pairs quickly', async () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await x25519Service.generateKeyPair();
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(`Key Pair Generation:`);
      console.log(`  Average time: ${avgTime.toFixed(2)}ms per key pair`);

      expect(avgTime).toBeLessThan(5); // Should generate keys quickly
    });

    test('should advance chain keys efficiently', async () => {
      const iterations = 10000;
      let currentKey = chainKeyService.generateChainKey();
      
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        currentKey = await chainKeyService.advanceChainKey(currentKey);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(`Chain Key Advancement:`);
      console.log(`  Average time: ${avgTime.toFixed(4)}ms per advancement`);
      console.log(`  Advancements per second: ${((iterations / (endTime - startTime)) * 1000).toFixed(0)}`);

      expect(avgTime).toBeLessThan(1); // Should advance very quickly
    });

    test('should derive message keys efficiently', async () => {
      const iterations = 1000;
      const chainKey = chainKeyService.generateChainKey();
      
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        await chainKeyService.deriveMessageKey(chainKey, i);
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      console.log(`Message Key Derivation:`);
      console.log(`  Average time: ${avgTime.toFixed(3)}ms per derivation`);

      expect(avgTime).toBeLessThan(2); // Should derive quickly
    });
  });

  describe('Memory Usage', () => {
    test('should manage memory with many skipped keys', async () => {
      const conversationId = 'perf-test';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);

      // Create many messages with gaps to generate skipped keys
      const messageCount = 500;
      const messages = [];
      
      for (let i = 0; i < messageCount; i++) {
        const encrypted = await ratchetService.encryptMessage(
          conversationId,
          'user1',
          `Message ${i}`
        );
        messages.push(encrypted);
      }

      // Decrypt every 5th message to create many skipped keys
      const decryptStart = performance.now();
      for (let i = 4; i < messages.length; i += 5) {
        await ratchetService.decryptMessage(conversationId, 'user2', messages[i]);
      }
      const decryptEnd = performance.now();

      console.log(`Skipped Key Management:`);
      console.log(`  Time to handle ${messageCount / 5} out-of-order messages: ${(decryptEnd - decryptStart).toFixed(2)}ms`);

      // Check that skipped keys are being managed efficiently
      const stats = await ratchetService.getRatchetStatistics(conversationId, 'user2');
      expect(stats!.skippedKeysCount).toBeGreaterThan(0);
      expect(stats!.skippedKeysCount).toBeLessThan(messageCount); // Should not store all keys

      console.log(`  Skipped keys stored: ${stats!.skippedKeysCount}`);
    }, 30000);

    test('should handle concurrent operations', async () => {
      const conversationId = 'perf-test';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);

      const concurrentOperations = 50;
      const operationsPerSet = 10;

      const startTime = performance.now();

      // Create multiple concurrent encryption operations
      const encryptionSets = [];
      for (let set = 0; set < concurrentOperations; set++) {
        const operations = [];
        for (let op = 0; op < operationsPerSet; op++) {
          operations.push(
            ratchetService.encryptMessage(
              conversationId,
              'user1',
              `Concurrent message ${set}-${op}`
            )
          );
        }
        encryptionSets.push(Promise.all(operations));
      }

      const allEncrypted = await Promise.all(encryptionSets);
      const endTime = performance.now();

      const totalOperations = concurrentOperations * operationsPerSet;
      const totalTime = endTime - startTime;
      const avgTime = totalTime / totalOperations;

      console.log(`Concurrent Operations:`);
      console.log(`  Total operations: ${totalOperations}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time per operation: ${avgTime.toFixed(2)}ms`);
      console.log(`  Operations per second: ${((totalOperations / totalTime) * 1000).toFixed(0)}`);

      expect(avgTime).toBeLessThan(15); // Should handle concurrency well
    }, 30000);
  });

  describe('Scalability Tests', () => {
    test('should scale with conversation count', async () => {
      const conversationCount = 10;
      const messagesPerConversation = 100;
      
      const startTime = performance.now();

      // Initialize multiple conversations
      const conversations = [];
      for (let i = 0; i < conversationCount; i++) {
        const conversationId = `scale-test-${i}`;
        const sharedSecret = x25519Service.randomBytes(32);
        
        await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
        await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);
        
        conversations.push(conversationId);
      }

      // Send messages across all conversations
      for (const conversationId of conversations) {
        for (let msg = 0; msg < messagesPerConversation; msg++) {
          const encrypted = await ratchetService.encryptMessage(
            conversationId,
            'user1',
            `Message ${msg} in ${conversationId}`
          );
          
          await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
        }
      }

      const endTime = performance.now();
      const totalOperations = conversationCount * messagesPerConversation * 2; // encrypt + decrypt
      const avgTime = (endTime - startTime) / totalOperations;

      console.log(`Scalability Test:`);
      console.log(`  Conversations: ${conversationCount}`);
      console.log(`  Messages per conversation: ${messagesPerConversation}`);
      console.log(`  Total operations: ${totalOperations}`);
      console.log(`  Average time per operation: ${avgTime.toFixed(2)}ms`);

      expect(avgTime).toBeLessThan(20); // Should scale reasonably

      // Cleanup
      for (const conversationId of conversations) {
        await ratchetService.deleteRatchetState(conversationId, 'user1');
        await ratchetService.deleteRatchetState(conversationId, 'user2');
      }
    }, 45000);

    test('should handle varying message sizes', async () => {
      const conversationId = 'perf-test';
      const sharedSecret = x25519Service.randomBytes(32);
      await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
      await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);

      const messageSizes = [10, 100, 1000, 5000, 10000]; // bytes
      const results = [];

      for (const size of messageSizes) {
        const message = 'x'.repeat(size);
        const iterations = Math.max(10, Math.floor(1000 / size)); // Adjust iterations based on size
        
        const startTime = performance.now();
        
        for (let i = 0; i < iterations; i++) {
          const encrypted = await ratchetService.encryptMessage(
            conversationId,
            'user1',
            `${message}-${i}`
          );
          
          await ratchetService.decryptMessage(conversationId, 'user2', encrypted);
        }
        
        const endTime = performance.now();
        const avgTime = (endTime - startTime) / iterations;
        const throughput = (size * iterations) / ((endTime - startTime) / 1000); // bytes per second
        
        results.push({ size, avgTime, throughput });
      }

      console.log(`Message Size Performance:`);
      console.log(`  Size (bytes) | Avg Time (ms) | Throughput (bytes/s)`);
      console.log(`  -------------|---------------|-------------------`);
      
      results.forEach(({ size, avgTime, throughput }) => {
        console.log(`  ${size.toString().padStart(11)} | ${avgTime.toFixed(2).padStart(13)} | ${Math.round(throughput).toLocaleString().padStart(17)}`);
      });

      // Performance should degrade gracefully with message size
      expect(results[0].avgTime).toBeLessThan(results[results.length - 1].avgTime);
      
      // Even large messages should be processed reasonably quickly
      expect(results[results.length - 1].avgTime).toBeLessThan(100);
    }, 60000);
  });

  describe('Service-Specific Performance', () => {
    test('should benchmark MessageEncryptionService', async () => {
      const metrics = await encryptionService.getPerformanceMetrics(1024, 100);
      
      console.log(`MessageEncryptionService Performance:`);
      console.log(`  Encryption time: ${metrics.encryptionTime.toFixed(2)}ms`);
      console.log(`  Decryption time: ${metrics.decryptionTime.toFixed(2)}ms`);
      console.log(`  Throughput: ${metrics.throughputMBps.toFixed(2)} MB/s`);

      expect(metrics.encryptionTime).toBeLessThan(5);
      expect(metrics.decryptionTime).toBeLessThan(5);
      expect(metrics.throughputMBps).toBeGreaterThan(1);
    });

    test('should benchmark ChainKeyService advancement', async () => {
      const initialKey = chainKeyService.generateChainKey();
      const metrics = await chainKeyService.getAdvancementMetrics(initialKey, 1000);
      
      console.log(`ChainKeyService Performance:`);
      console.log(`  Total time for 1000 steps: ${metrics.totalTime.toFixed(2)}ms`);
      console.log(`  Average time per step: ${metrics.averageTime.toFixed(3)}ms`);
      console.log(`  Steps per second: ${Math.round(metrics.stepsPerSecond)}`);

      expect(metrics.averageTime).toBeLessThan(1);
      expect(metrics.stepsPerSecond).toBeGreaterThan(1000);
    });
  });

  describe('Resource Cleanup Performance', () => {
    test('should cleanup resources efficiently', async () => {
      // Create multiple conversations with states
      const conversationCount = 20;
      const conversations = [];
      
      for (let i = 0; i < conversationCount; i++) {
        const conversationId = `cleanup-test-${i}`;
        const sharedSecret = x25519Service.randomBytes(32);
        
        await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
        conversations.push(conversationId);
      }

      // Cleanup all states
      const startTime = performance.now();
      
      for (const conversationId of conversations) {
        await ratchetService.deleteRatchetState(conversationId, 'user1');
      }
      
      const endTime = performance.now();
      const avgCleanupTime = (endTime - startTime) / conversationCount;

      console.log(`Cleanup Performance:`);
      console.log(`  Average cleanup time: ${avgCleanupTime.toFixed(2)}ms per state`);

      expect(avgCleanupTime).toBeLessThan(10); // Should cleanup quickly
    });
  });
});

// Stress tests for edge cases
describe('Stress Tests', () => {
  let ratchetService: DoubleRatchetService;
  
  beforeAll(async () => {
    ratchetService = new DoubleRatchetService();
    await ratchetService.initialize();
  });

  test('should handle rapid successive operations', async () => {
    const conversationId = 'stress-test';
    const x25519Service = new X25519Service();
    await x25519Service.initialize();
    
    const sharedSecret = x25519Service.randomBytes(32);
    await ratchetService.initializeRatchet(conversationId, 'user1', sharedSecret, true);
    await ratchetService.initializeRatchet(conversationId, 'user2', sharedSecret, false);

    const rapidOperations = 100;
    const startTime = performance.now();

    // Rapidly encrypt messages without waiting
    const encryptionPromises = [];
    for (let i = 0; i < rapidOperations; i++) {
      encryptionPromises.push(
        ratchetService.encryptMessage(conversationId, 'user1', `Rapid message ${i}`)
      );
    }

    const encryptedMessages = await Promise.all(encryptionPromises);
    
    // Rapidly decrypt messages
    const decryptionPromises = encryptedMessages.map(encrypted =>
      ratchetService.decryptMessage(conversationId, 'user2', encrypted)
    );

    const decryptedMessages = await Promise.all(decryptionPromises);
    
    const endTime = performance.now();
    const totalTime = endTime - startTime;

    console.log(`Stress Test - Rapid Operations:`);
    console.log(`  Time for ${rapidOperations} rapid operations: ${totalTime.toFixed(2)}ms`);
    console.log(`  Operations per second: ${Math.round((rapidOperations * 2 / totalTime) * 1000)}`);

    // Verify all messages were processed correctly
    expect(decryptedMessages).toHaveLength(rapidOperations);
    decryptedMessages.forEach((message, index) => {
      expect(message).toBe(`Rapid message ${index}`);
    });

    // Cleanup
    await ratchetService.deleteRatchetState(conversationId, 'user1');
    await ratchetService.deleteRatchetState(conversationId, 'user2');
  }, 30000);
});