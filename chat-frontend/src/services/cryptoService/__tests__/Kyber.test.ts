import { KyberService } from '../KyberService';

describe('Kyber-768 (ML-KEM) Tests', () => {
  let kyberService: KyberService;

  beforeAll(async () => {
    kyberService = new KyberService();
    await kyberService.initialize();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully', async () => {
      const newService = new KyberService();
      await expect(newService.initialize()).resolves.not.toThrow();
    });

    test('should get algorithm information', () => {
      const info = kyberService.getAlgorithmInfo();
      
      expect(info.name).toBe('ML-KEM-768');
      expect(info.securityLevel).toBe(3);
      expect(info.quantumSecurityBits).toBe(128);
      expect(info.publicKeySize).toBe(1184);
      expect(info.privateKeySize).toBe(2400);
      expect(info.ciphertextSize).toBe(1088);
      expect(info.sharedSecretSize).toBe(32);
      expect(info.standard).toBe('NIST FIPS 203');
    });
  });

  describe('Key Generation', () => {
    test('should generate valid key pairs', async () => {
      const keyPair = await kyberService.generateKeyPair();
      
      expect(keyPair.publicKey).toHaveLength(1184);
      expect(keyPair.privateKey).toHaveLength(2400);
      expect(kyberService.validatePublicKey(keyPair.publicKey)).toBe(true);
      expect(kyberService.validatePrivateKey(keyPair.privateKey)).toBe(true);
    });

    test('should generate unique key pairs', async () => {
      const keyPair1 = await kyberService.generateKeyPair();
      const keyPair2 = await kyberService.generateKeyPair();
      
      expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey);
      expect(keyPair1.privateKey).not.toEqual(keyPair2.privateKey);
    });

    test('should generate keys within acceptable time', async () => {
      const startTime = performance.now();
      await kyberService.generateKeyPair();
      const endTime = performance.now();
      
      const generationTime = endTime - startTime;
      expect(generationTime).toBeLessThan(100); // Should be fast
    });
  });

  describe('Key Encapsulation', () => {
    let keyPair: any;

    beforeEach(async () => {
      keyPair = await kyberService.generateKeyPair();
    });

    test('should encapsulate successfully', async () => {
      const encapsulation = await kyberService.encapsulate(keyPair.publicKey);
      
      expect(encapsulation.ciphertext).toHaveLength(1088);
      expect(encapsulation.sharedSecret).toHaveLength(32);
    });

    test('should generate unique encapsulations', async () => {
      const encaps1 = await kyberService.encapsulate(keyPair.publicKey);
      const encaps2 = await kyberService.encapsulate(keyPair.publicKey);
      
      // Different ciphertexts (due to randomness)
      expect(encaps1.ciphertext).not.toEqual(encaps2.ciphertext);
      // Different shared secrets
      expect(encaps1.sharedSecret).not.toEqual(encaps2.sharedSecret);
    });

    test('should reject invalid public keys', async () => {
      const invalidKeys = [
        new Uint8Array(1184), // All zeros
        new Uint8Array(1184).fill(0xFF), // All ones
        new Uint8Array(1000), // Wrong size
        new Uint8Array(1500), // Wrong size
      ];

      for (const invalidKey of invalidKeys) {
        await expect(kyberService.encapsulate(invalidKey)).rejects.toThrow();
      }
    });
  });

  describe('Key Decapsulation', () => {
    let keyPair: any;
    let encapsulation: any;

    beforeEach(async () => {
      keyPair = await kyberService.generateKeyPair();
      encapsulation = await kyberService.encapsulate(keyPair.publicKey);
    });

    test('should decapsulate successfully', async () => {
      const decapsulatedSecret = await kyberService.decapsulate(
        encapsulation.ciphertext,
        keyPair.privateKey
      );
      
      expect(decapsulatedSecret).toHaveLength(32);
      expect(decapsulatedSecret).toEqual(encapsulation.sharedSecret);
    });

    test('should reject invalid ciphertexts', async () => {
      const invalidCiphertexts = [
        new Uint8Array(1088), // All zeros
        new Uint8Array(1000), // Wrong size
        new Uint8Array(1200), // Wrong size
      ];

      for (const invalidCiphertext of invalidCiphertexts) {
        await expect(
          kyberService.decapsulate(invalidCiphertext, keyPair.privateKey)
        ).rejects.toThrow();
      }
    });

    test('should reject invalid private keys', async () => {
      const invalidKeys = [
        new Uint8Array(2400), // All zeros
        new Uint8Array(2000), // Wrong size
        new Uint8Array(3000), // Wrong size
      ];

      for (const invalidKey of invalidKeys) {
        await expect(
          kyberService.decapsulate(encapsulation.ciphertext, invalidKey)
        ).rejects.toThrow();
      }
    });

    test('should fail with wrong private key', async () => {
      const wrongKeyPair = await kyberService.generateKeyPair();
      
      await expect(
        kyberService.decapsulate(encapsulation.ciphertext, wrongKeyPair.privateKey)
      ).rejects.toThrow();
    });
  });

  describe('End-to-End Key Exchange', () => {
    test('should perform complete key exchange', async () => {
      // Alice generates key pair
      const aliceKeys = await kyberService.generateKeyPair();
      
      // Bob encapsulates with Alice's public key
      const bobEncapsulation = await kyberService.encapsulate(aliceKeys.publicKey);
      
      // Alice decapsulates with her private key
      const aliceSharedSecret = await kyberService.decapsulate(
        bobEncapsulation.ciphertext,
        aliceKeys.privateKey
      );
      
      // Shared secrets should match
      expect(aliceSharedSecret).toEqual(bobEncapsulation.sharedSecret);
    });

    test('should handle multiple concurrent exchanges', async () => {
      const numExchanges = 10;
      const exchanges = [];

      for (let i = 0; i < numExchanges; i++) {
        exchanges.push((async () => {
          const keyPair = await kyberService.generateKeyPair();
          const encapsulation = await kyberService.encapsulate(keyPair.publicKey);
          const decapsulatedSecret = await kyberService.decapsulate(
            encapsulation.ciphertext,
            keyPair.privateKey
          );
          return {
            original: encapsulation.sharedSecret,
            decapsulated: decapsulatedSecret
          };
        })());
      }

      const results = await Promise.all(exchanges);
      
      results.forEach(({ original, decapsulated }) => {
        expect(decapsulated).toEqual(original);
      });
    });
  });

  describe('Key Validation', () => {
    test('should validate public keys correctly', async () => {
      const validKeyPair = await kyberService.generateKeyPair();
      expect(kyberService.validatePublicKey(validKeyPair.publicKey)).toBe(true);

      // Invalid cases
      expect(kyberService.validatePublicKey(new Uint8Array(1184))).toBe(false); // All zeros
      expect(kyberService.validatePublicKey(new Uint8Array(1184).fill(0xFF))).toBe(false); // All ones
      expect(kyberService.validatePublicKey(new Uint8Array(1000))).toBe(false); // Wrong size
      expect(kyberService.validatePublicKey(new Uint8Array(0))).toBe(false); // Empty
    });

    test('should validate private keys correctly', async () => {
      const validKeyPair = await kyberService.generateKeyPair();
      expect(kyberService.validatePrivateKey(validKeyPair.privateKey)).toBe(true);

      // Invalid cases
      expect(kyberService.validatePrivateKey(new Uint8Array(2400))).toBe(false); // All zeros
      expect(kyberService.validatePrivateKey(new Uint8Array(2000))).toBe(false); // Wrong size
      expect(kyberService.validatePrivateKey(new Uint8Array(0))).toBe(false); // Empty
    });

    test('should validate ciphertexts correctly', async () => {
      const keyPair = await kyberService.generateKeyPair();
      const encapsulation = await kyberService.encapsulate(keyPair.publicKey);
      
      expect(kyberService.validateCiphertext(encapsulation.ciphertext)).toBe(true);

      // Invalid cases
      expect(kyberService.validateCiphertext(new Uint8Array(1088))).toBe(true); // All zeros is technically valid format
      expect(kyberService.validateCiphertext(new Uint8Array(1000))).toBe(false); // Wrong size
      expect(kyberService.validateCiphertext(new Uint8Array(0))).toBe(false); // Empty
    });
  });

  describe('Performance Benchmarks', () => {
    test('should benchmark operations', async () => {
      const iterations = 10;
      const metrics = await kyberService.benchmarkOperations(iterations);
      
      expect(metrics.keyGenTime).toBeGreaterThan(0);
      expect(metrics.encapsulationTime).toBeGreaterThan(0);
      expect(metrics.decapsulationTime).toBeGreaterThan(0);
      expect(metrics.publicKeySize).toBe(1184);
      expect(metrics.privateKeySize).toBe(2400);
      expect(metrics.ciphertextSize).toBe(1088);
      expect(metrics.sharedSecretSize).toBe(32);

      // Performance thresholds (may need adjustment based on hardware)
      expect(metrics.keyGenTime).toBeLessThan(50);
      expect(metrics.encapsulationTime).toBeLessThan(10);
      expect(metrics.decapsulationTime).toBeLessThan(10);
    });

    test('should get performance metrics', () => {
      const initialMetrics = kyberService.getPerformanceMetrics();
      expect(initialMetrics).toBeDefined();
    });
  });

  describe('Security Properties', () => {
    test('should generate cryptographically secure random bytes', () => {
      const bytes1 = kyberService.randomBytes(32);
      const bytes2 = kyberService.randomBytes(32);
      
      expect(bytes1).toHaveLength(32);
      expect(bytes2).toHaveLength(32);
      expect(bytes1).not.toEqual(bytes2);
    });

    test('should perform constant-time comparison', () => {
      const data1 = new Uint8Array([1, 2, 3, 4]);
      const data2 = new Uint8Array([1, 2, 3, 4]);
      const data3 = new Uint8Array([1, 2, 3, 5]);
      const data4 = new Uint8Array([1, 2, 3]); // Different length

      expect(kyberService.constantTimeEquals(data1, data2)).toBe(true);
      expect(kyberService.constantTimeEquals(data1, data3)).toBe(false);
      expect(kyberService.constantTimeEquals(data1, data4)).toBe(false);
    });

    test('should securely zero memory', () => {
      const sensitiveData = new Uint8Array([1, 2, 3, 4, 5]);
      const originalData = new Uint8Array(sensitiveData);
      
      kyberService.secureZero(sensitiveData);
      
      expect(sensitiveData).not.toEqual(originalData);
      expect(sensitiveData.every(byte => byte === 0)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized service', async () => {
      const uninitializedService = new KyberService();
      
      await expect(uninitializedService.generateKeyPair()).rejects.toThrow('not initialized');
    });

    test('should handle invalid input lengths', async () => {
      await expect(kyberService.randomBytes(0)).rejects.toThrow();
      await expect(kyberService.randomBytes(-1)).rejects.toThrow();
    });

    test('should handle benchmark with invalid iterations', async () => {
      await expect(kyberService.benchmarkOperations(0)).rejects.toThrow();
      await expect(kyberService.benchmarkOperations(-1)).rejects.toThrow();
    });
  });

  describe('Memory Safety', () => {
    test('should clear sensitive data after operations', async () => {
      const keyPair = await kyberService.generateKeyPair();
      const encapsulation = await kyberService.encapsulate(keyPair.publicKey);
      
      // Create copies to verify clearing
      const originalPrivateKey = new Uint8Array(keyPair.privateKey);
      const originalSharedSecret = new Uint8Array(encapsulation.sharedSecret);
      
      // Clear the sensitive data
      kyberService.secureZero(keyPair.privateKey);
      kyberService.secureZero(encapsulation.sharedSecret);
      
      // Verify data was cleared
      expect(keyPair.privateKey).not.toEqual(originalPrivateKey);
      expect(encapsulation.sharedSecret).not.toEqual(originalSharedSecret);
      expect(keyPair.privateKey.every(byte => byte === 0)).toBe(true);
      expect(encapsulation.sharedSecret.every(byte => byte === 0)).toBe(true);
    });
  });
});