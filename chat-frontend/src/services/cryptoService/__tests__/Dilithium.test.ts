import { DilithiumService } from '../DilithiumService';

describe('Dilithium-3 (ML-DSA) Tests', () => {
  let dilithiumService: DilithiumService;

  beforeAll(async () => {
    dilithiumService = new DilithiumService();
    await dilithiumService.initialize();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully', async () => {
      const newService = new DilithiumService();
      await expect(newService.initialize()).resolves.not.toThrow();
    });

    test('should get algorithm information', () => {
      const info = dilithiumService.getAlgorithmInfo();
      
      expect(info.name).toBe('ML-DSA-65');
      expect(info.securityLevel).toBe(3);
      expect(info.quantumSecurityBits).toBe(128);
      expect(info.publicKeySize).toBe(1952);
      expect(info.privateKeySize).toBe(4000);
      expect(info.signatureSize).toBe(3293);
      expect(info.standard).toBe('NIST FIPS 204');
    });
  });

  describe('Key Generation', () => {
    test('should generate valid key pairs', async () => {
      const keyPair = await dilithiumService.generateKeyPair();
      
      expect(keyPair.publicKey).toHaveLength(1952);
      expect(keyPair.privateKey).toHaveLength(4000);
      expect(dilithiumService.validatePublicKey(keyPair.publicKey)).toBe(true);
      expect(dilithiumService.validatePrivateKey(keyPair.privateKey)).toBe(true);
    });

    test('should generate unique key pairs', async () => {
      const keyPair1 = await dilithiumService.generateKeyPair();
      const keyPair2 = await dilithiumService.generateKeyPair();
      
      expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
    });

    test('should generate keys within acceptable time', async () => {
      const startTime = performance.now();
      await dilithiumService.generateKeyPair();
      const endTime = performance.now();
      
      const generationTime = endTime - startTime;
      expect(generationTime).toBeLessThan(200); // Should be reasonably fast
    });
  });

  describe('Message Signing', () => {
    let keyPair: any;

    beforeEach(async () => {
      keyPair = await dilithiumService.generateKeyPair();
    });

    test('should sign messages successfully', async () => {
      const message = new TextEncoder().encode('Test message for Dilithium signing');
      const signature = await dilithiumService.sign(keyPair.privateKey, message);
      
      expect(signature.signature).toHaveLength(3293);
      expect(signature.message).toEqual(message);
      expect(signature.timestamp).toBeGreaterThan(0);
      expect(dilithiumService.validateSignature(signature.signature)).toBe(true);
    });

    test('should sign text messages successfully', async () => {
      const message = 'Hello, this is a test message for Dilithium-3 signing!';
      const signature = await dilithiumService.signMessage(keyPair.privateKey, message);
      
      expect(signature.signature).toHaveLength(3293);
      expect(signature.message).toEqual(new TextEncoder().encode(message));
      expect(signature.timestamp).toBeGreaterThan(0);
    });

    test('should generate unique signatures for identical messages', async () => {
      const message = new TextEncoder().encode('Identical message');
      
      const signature1 = await dilithiumService.sign(keyPair.privateKey, message);
      const signature2 = await dilithiumService.sign(keyPair.privateKey, message);
      
      // Signatures should be different due to randomness in Dilithium
      expect(signature1.signature).not.toEqual(signature2.signature);
      expect(signature1.timestamp).not.toBe(signature2.timestamp);
    });

    test('should handle empty messages', async () => {
      const emptyMessage = new Uint8Array(0);
      const signature = await dilithiumService.sign(keyPair.privateKey, emptyMessage);
      
      expect(signature.signature).toHaveLength(3293);
      expect(signature.message).toEqual(emptyMessage);
    });

    test('should reject invalid private keys', async () => {
      const message = new TextEncoder().encode('Test message');
      const invalidKeys = [
        new Uint8Array(4000), // All zeros
        new Uint8Array(3000), // Wrong size
        new Uint8Array(5000), // Wrong size
      ];

      for (const invalidKey of invalidKeys) {
        await expect(
          dilithiumService.sign(invalidKey, message)
        ).rejects.toThrow();
      }
    });
  });

  describe('Signature Verification', () => {
    let keyPair: any;
    let message: Uint8Array;
    let signature: any;

    beforeEach(async () => {
      keyPair = await dilithiumService.generateKeyPair();
      message = new TextEncoder().encode('Test message for verification');
      signature = await dilithiumService.sign(keyPair.privateKey, message);
    });

    test('should verify valid signatures', async () => {
      const isValid = await dilithiumService.verify(
        keyPair.publicKey,
        message,
        signature.signature
      );
      
      expect(isValid).toBe(true);
    });

    test('should verify text message signatures', async () => {
      const textMessage = 'Hello, Dilithium!';
      const textSignature = await dilithiumService.signMessage(keyPair.privateKey, textMessage);
      
      const isValid = await dilithiumService.verifyMessage(
        keyPair.publicKey,
        textMessage,
        textSignature.signature
      );
      
      expect(isValid).toBe(true);
    });

    test('should verify signature objects', async () => {
      const isValid = await dilithiumService.verifySignatureObject(
        keyPair.publicKey,
        signature
      );
      
      expect(isValid).toBe(true);
    });

    test('should reject invalid signatures', async () => {
      // Tamper with signature
      const tamperedSignature = new Uint8Array(signature.signature);
      tamperedSignature[0] ^= 0xFF;
      
      const isValid = await dilithiumService.verify(
        keyPair.publicKey,
        message,
        tamperedSignature
      );
      
      expect(isValid).toBe(false);
    });

    test('should reject wrong public key', async () => {
      const wrongKeyPair = await dilithiumService.generateKeyPair();
      
      const isValid = await dilithiumService.verify(
        wrongKeyPair.publicKey,
        message,
        signature.signature
      );
      
      expect(isValid).toBe(false);
    });

    test('should reject tampered messages', async () => {
      const tamperedMessage = new Uint8Array(message);
      tamperedMessage[0] ^= 0xFF;
      
      const isValid = await dilithiumService.verify(
        keyPair.publicKey,
        tamperedMessage,
        signature.signature
      );
      
      expect(isValid).toBe(false);
    });

    test('should handle verification of invalid signature formats gracefully', async () => {
      const invalidSignatures = [
        new Uint8Array(3293), // All zeros
        new Uint8Array(3000), // Wrong size
        new Uint8Array(0),    // Empty
      ];

      for (const invalidSig of invalidSignatures) {
        const isValid = await dilithiumService.verify(
          keyPair.publicKey,
          message,
          invalidSig
        );
        expect(isValid).toBe(false);
      }
    });
  });

  describe('Detached Signatures', () => {
    let keyPair: any;
    let message: Uint8Array;

    beforeEach(async () => {
      keyPair = await dilithiumService.generateKeyPair();
      message = new TextEncoder().encode('Message for detached signature test');
    });

    test('should create and verify detached signatures', async () => {
      const detachedSig = await dilithiumService.createDetachedSignature(
        keyPair.privateKey,
        message
      );
      
      expect(detachedSig).toHaveLength(3293);
      
      const isValid = await dilithiumService.verifyDetachedSignature(
        keyPair.publicKey,
        message,
        detachedSig
      );
      
      expect(isValid).toBe(true);
    });
  });

  describe('Key Validation', () => {
    test('should validate public keys correctly', async () => {
      const validKeyPair = await dilithiumService.generateKeyPair();
      expect(dilithiumService.validatePublicKey(validKeyPair.publicKey)).toBe(true);

      // Invalid cases
      expect(dilithiumService.validatePublicKey(new Uint8Array(1952))).toBe(false); // All zeros
      expect(dilithiumService.validatePublicKey(new Uint8Array(1952).fill(0xFF))).toBe(false); // All ones
      expect(dilithiumService.validatePublicKey(new Uint8Array(1000))).toBe(false); // Wrong size
      expect(dilithiumService.validatePublicKey(new Uint8Array(0))).toBe(false); // Empty
    });

    test('should validate private keys correctly', async () => {
      const validKeyPair = await dilithiumService.generateKeyPair();
      expect(dilithiumService.validatePrivateKey(validKeyPair.privateKey)).toBe(true);

      // Invalid cases
      expect(dilithiumService.validatePrivateKey(new Uint8Array(4000))).toBe(false); // All zeros
      expect(dilithiumService.validatePrivateKey(new Uint8Array(3000))).toBe(false); // Wrong size
      expect(dilithiumService.validatePrivateKey(new Uint8Array(0))).toBe(false); // Empty
    });

    test('should validate signatures correctly', async () => {
      const keyPair = await dilithiumService.generateKeyPair();
      const message = new TextEncoder().encode('Test');
      const signature = await dilithiumService.sign(keyPair.privateKey, message);
      
      expect(dilithiumService.validateSignature(signature.signature)).toBe(true);

      // Invalid cases
      expect(dilithiumService.validateSignature(new Uint8Array(3000))).toBe(false); // Wrong size
      expect(dilithiumService.validateSignature(new Uint8Array(0))).toBe(false); // Empty
    });

    test('should validate messages correctly', async () => {
      const validMessage = new TextEncoder().encode('Valid message');
      const emptyMessage = new Uint8Array(0);
      
      expect(dilithiumService.validateMessage(validMessage)).toBe(true);
      expect(dilithiumService.validateMessage(emptyMessage)).toBe(true); // Empty is valid
    });
  });

  describe('Performance Benchmarks', () => {
    test('should benchmark operations', async () => {
      const iterations = 5; // Fewer iterations as Dilithium is slower
      const metrics = await dilithiumService.benchmarkOperations(iterations);
      
      expect(metrics.keyGenTime).toBeGreaterThan(0);
      expect(metrics.signTime).toBeGreaterThan(0);
      expect(metrics.verifyTime).toBeGreaterThan(0);
      expect(metrics.publicKeySize).toBe(1952);
      expect(metrics.privateKeySize).toBe(4000);
      expect(metrics.signatureSize).toBe(3293);
      expect(metrics.throughputSigsPerSecond).toBeGreaterThan(0);
      expect(metrics.throughputVerificationsPerSecond).toBeGreaterThan(0);

      // Performance thresholds (may need adjustment based on hardware)
      expect(metrics.keyGenTime).toBeLessThan(500);
      expect(metrics.signTime).toBeLessThan(100);
      expect(metrics.verifyTime).toBeLessThan(50);
    });

    test('should get performance metrics', () => {
      const metrics = dilithiumService.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Security Properties', () => {
    test('should generate cryptographically secure random bytes', () => {
      const bytes1 = dilithiumService.randomBytes(32);
      const bytes2 = dilithiumService.randomBytes(32);
      
      expect(bytes1).toHaveLength(32);
      expect(bytes2).toHaveLength(32);
      expect(bytes1).not.toEqual(bytes2);
    });

    test('should securely zero memory', () => {
      const sensitiveData = new Uint8Array([1, 2, 3, 4, 5]);
      const originalData = new Uint8Array(sensitiveData);
      
      dilithiumService.secureZero(sensitiveData);
      
      expect(sensitiveData).not.toEqual(originalData);
      expect(sensitiveData.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    test('should handle concurrent signing operations', async () => {
      const keyPair = await dilithiumService.generateKeyPair();
      const numOperations = 5;
      const operations = [];

      for (let i = 0; i < numOperations; i++) {
        const message = new TextEncoder().encode(`Concurrent message ${i}`);
        operations.push(dilithiumService.sign(keyPair.privateKey, message));
      }

      const signatures = await Promise.all(operations);
      
      expect(signatures).toHaveLength(numOperations);
      signatures.forEach((sig, index) => {
        expect(sig.signature).toHaveLength(3293);
        expect(sig.message).toEqual(new TextEncoder().encode(`Concurrent message ${index}`));
      });
    });

    test('should handle concurrent verification operations', async () => {
      const keyPair = await dilithiumService.generateKeyPair();
      const message = new TextEncoder().encode('Message for concurrent verification');
      const signature = await dilithiumService.sign(keyPair.privateKey, message);
      
      const verifications = [];
      for (let i = 0; i < 5; i++) {
        verifications.push(
          dilithiumService.verify(keyPair.publicKey, message, signature.signature)
        );
      }

      const results = await Promise.all(verifications);
      results.forEach(result => expect(result).toBe(true));
    });
  });

  describe('Large Message Handling', () => {
    test('should handle large messages', async () => {
      const keyPair = await dilithiumService.generateKeyPair();
      const largeMessage = new Uint8Array(100000).fill(42); // 100KB message
      
      const signature = await dilithiumService.sign(keyPair.privateKey, largeMessage);
      const isValid = await dilithiumService.verify(
        keyPair.publicKey,
        largeMessage,
        signature.signature
      );
      
      expect(isValid).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized service', async () => {
      const uninitializedService = new DilithiumService();
      
      await expect(uninitializedService.generateKeyPair()).rejects.toThrow('not initialized');
    });

    test('should handle invalid input lengths', async () => {
      await expect(dilithiumService.randomBytes(0)).rejects.toThrow();
      await expect(dilithiumService.randomBytes(-1)).rejects.toThrow();
    });

    test('should handle benchmark with invalid iterations', async () => {
      await expect(dilithiumService.benchmarkOperations(0)).rejects.toThrow();
      await expect(dilithiumService.benchmarkOperations(-1)).rejects.toThrow();
    });
  });

  describe('Message Format Compatibility', () => {
    test('should handle various text encodings', async () => {
      const keyPair = await dilithiumService.generateKeyPair();
      const messages = [
        'Simple ASCII message',
        'Message with émojis 🚀 ✨ 🔐',
        'Unicode: 你好世界 こんにちは सनम',
        'Mixed: Hello 世界! 🌍',
        '', // Empty string
      ];

      for (const textMessage of messages) {
        const signature = await dilithiumService.signMessage(keyPair.privateKey, textMessage);
        const isValid = await dilithiumService.verifyMessage(
          keyPair.publicKey,
          textMessage,
          signature.signature
        );
        expect(isValid).toBe(true);
      }
    });
  });

  describe('Memory Safety', () => {
    test('should clear sensitive data after operations', async () => {
      const keyPair = await dilithiumService.generateKeyPair();
      const message = new TextEncoder().encode('Test message');
      const signature = await dilithiumService.sign(keyPair.privateKey, message);
      
      // Create copies to verify clearing
      const originalPrivateKey = new Uint8Array(keyPair.privateKey);
      const originalSignature = new Uint8Array(signature.signature);
      
      // Clear the sensitive data
      dilithiumService.secureZero(keyPair.privateKey);
      dilithiumService.secureZero(signature.signature);
      
      // Verify data was cleared
      expect(keyPair.privateKey).not.toEqual(originalPrivateKey);
      expect(signature.signature).not.toEqual(originalSignature);
      expect(keyPair.privateKey.every(byte => byte === 0)).toBe(true);
      expect(signature.signature.every(byte => byte === 0)).toBe(true);
    });
  });
});