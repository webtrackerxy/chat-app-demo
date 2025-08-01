import { HybridKeyExchangeService } from '../HybridKeyExchangeService';

describe('Hybrid Key Exchange Tests', () => {
  let hybridService: HybridKeyExchangeService;

  beforeAll(async () => {
    hybridService = new HybridKeyExchangeService();
    await hybridService.initialize();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully', async () => {
      const newService = new HybridKeyExchangeService();
      await expect(newService.initialize()).resolves.not.toThrow();
    });

    test('should get algorithm information', () => {
      const info = hybridService.getAlgorithmInfo();
      
      expect(info.name).toBe('Hybrid-X25519-Kyber768-Dilithium3');
      expect(info.securityLevel).toBe(3);
      expect(info.components).toEqual(['X25519', 'Kyber-768', 'Dilithium-3']);
      expect(info.standards).toEqual(['RFC 7748', 'NIST FIPS 203', 'NIST FIPS 204']);
      expect(info.keyExchangeMethods).toEqual(['ECDH', 'KEM']);
      expect(info.signatureMethods).toEqual(['Dilithium-3']);
    });
  });

  describe('Hybrid Key Generation', () => {
    test('should generate hybrid key pairs', async () => {
      const keyPair = await hybridService.generateKeyPair();
      
      // Classical keys
      expect(keyPair.classical.publicKey).toHaveLength(32);
      expect(keyPair.classical.privateKey).toHaveLength(32);
      
      // Post-quantum keys
      expect(keyPair.postQuantum.kyber.publicKey).toHaveLength(1184);
      expect(keyPair.postQuantum.kyber.privateKey).toHaveLength(2400);
      expect(keyPair.postQuantum.dilithium.publicKey).toHaveLength(1952);
      expect(keyPair.postQuantum.dilithium.privateKey).toHaveLength(4000);
      
      // Combined keys
      expect(keyPair.combined.publicKey.length).toBeGreaterThan(0);
      expect(keyPair.combined.privateKey.length).toBeGreaterThan(0);
    });

    test('should generate unique key pairs', async () => {
      const keyPair1 = await hybridService.generateKeyPair();
      const keyPair2 = await hybridService.generateKeyPair();
      
      expect(keyPair1.classical.publicKey).not.toEqual(keyPair2.classical.publicKey);
      expect(keyPair1.postQuantum.kyber.publicKey).not.toEqual(keyPair2.postQuantum.kyber.publicKey);
      expect(keyPair1.postQuantum.dilithium.publicKey).not.toEqual(keyPair2.postQuantum.dilithium.publicKey);
      expect(keyPair1.combined.publicKey).not.toEqual(keyPair2.combined.publicKey);
    });

    test('should generate keys within acceptable time', async () => {
      const startTime = performance.now();
      await hybridService.generateKeyPair();
      const endTime = performance.now();
      
      const generationTime = endTime - startTime;
      expect(generationTime).toBeLessThan(1000); // Should be reasonably fast
    });
  });

  describe('Hybrid Key Exchange', () => {
    let initiatorKeys: any;
    let responderKeys: any;

    beforeEach(async () => {
      initiatorKeys = await hybridService.generateKeyPair();
      responderKeys = await hybridService.generateKeyPair();
    });

    test('should perform complete hybrid key exchange', async () => {
      // Initiator performs key exchange
      const keyExchange = await hybridService.performKeyExchange(
        initiatorKeys,
        responderKeys.combined.publicKey
      );
      
      // Verify key exchange structure
      expect(keyExchange.classical.ephemeralPublicKey).toBeDefined();
      expect(keyExchange.classical.sharedSecret).toHaveLength(32);
      expect(keyExchange.postQuantum.kyberCiphertext).toHaveLength(1088);
      expect(keyExchange.postQuantum.kyberSharedSecret).toHaveLength(32);
      expect(keyExchange.postQuantum.signature).toBeDefined();
      expect(keyExchange.combined.finalSharedSecret).toHaveLength(32);
      expect(keyExchange.combined.authenticatedData).toBeDefined();
      
      // Verify metadata
      expect(keyExchange.metadata.algorithms).toEqual(['X25519', 'Kyber-768', 'Dilithium-3']);
      expect(keyExchange.metadata.securityLevel).toBe(3);
      expect(keyExchange.metadata.timestamp).toBeGreaterThan(0);
      
      // Responder verifies and processes key exchange
      const responderSharedSecret = await hybridService.verifyKeyExchange(
        responderKeys,
        keyExchange
      );
      
      // Shared secrets should match
      expect(responderSharedSecret).toEqual(keyExchange.combined.finalSharedSecret);
    });

    test('should detect signature tampering', async () => {
      const keyExchange = await hybridService.performKeyExchange(
        initiatorKeys,
        responderKeys.combined.publicKey
      );
      
      // Tamper with signature
      const tamperedKeyExchange = { ...keyExchange };
      tamperedKeyExchange.postQuantum = { ...keyExchange.postQuantum };
      tamperedKeyExchange.postQuantum.signature = { ...keyExchange.postQuantum.signature };
      tamperedKeyExchange.postQuantum.signature.signature = new Uint8Array(keyExchange.postQuantum.signature.signature);
      tamperedKeyExchange.postQuantum.signature.signature[0] ^= 0xFF;
      
      // Verification should fail
      await expect(
        hybridService.verifyKeyExchange(responderKeys, tamperedKeyExchange)
      ).rejects.toThrow('signature verification failed');
    });

    test('should detect ciphertext tampering', async () => {
      const keyExchange = await hybridService.performKeyExchange(
        initiatorKeys,
        responderKeys.combined.publicKey
      );
      
      // Tamper with Kyber ciphertext
      const tamperedKeyExchange = { ...keyExchange };
      tamperedKeyExchange.postQuantum = { ...keyExchange.postQuantum };
      tamperedKeyExchange.postQuantum.kyberCiphertext = new Uint8Array(keyExchange.postQuantum.kyberCiphertext);
      tamperedKeyExchange.postQuantum.kyberCiphertext[0] ^= 0xFF;
      
      // Verification should fail due to shared secret mismatch
      await expect(
        hybridService.verifyKeyExchange(responderKeys, tamperedKeyExchange)
      ).rejects.toThrow();
    });

    test('should handle multiple concurrent key exchanges', async () => {
      const numExchanges = 5;
      const exchanges = [];

      for (let i = 0; i < numExchanges; i++) {
        exchanges.push((async () => {
          const initKeys = await hybridService.generateKeyPair();
          const respKeys = await hybridService.generateKeyPair();
          
          const keyExchange = await hybridService.performKeyExchange(
            initKeys,
            respKeys.combined.publicKey
          );
          
          const verifiedSecret = await hybridService.verifyKeyExchange(
            respKeys,
            keyExchange
          );
          
          return {
            original: keyExchange.combined.finalSharedSecret,
            verified: verifiedSecret
          };
        })());
      }

      const results = await Promise.all(exchanges);
      
      results.forEach(({ original, verified }) => {
        expect(verified).toEqual(original);
      });
    });
  });

  describe('Algorithm Support Detection', () => {
    test('should check algorithm support without capabilities', () => {
      const support = hybridService.checkAlgorithmSupport();
      
      expect(support.x25519).toBe(true);
      expect(support.kyber768).toBe(true);
      expect(support.dilithium3).toBe(true);
      expect(support.hybrid).toBe(true);
    });

    test('should check algorithm support with remote capabilities', () => {
      const remoteCapabilities = ['X25519', 'Kyber-768', 'Dilithium-3'];
      const support = hybridService.checkAlgorithmSupport(remoteCapabilities);
      
      expect(support.x25519).toBe(true);
      expect(support.kyber768).toBe(true);
      expect(support.dilithium3).toBe(true);
      expect(support.hybrid).toBe(true);
    });

    test('should detect partial support', () => {
      const remoteCapabilities = ['X25519']; // Only classical support
      const support = hybridService.checkAlgorithmSupport(remoteCapabilities);
      
      expect(support.x25519).toBe(true);
      expect(support.kyber768).toBe(false);
      expect(support.dilithium3).toBe(false);
      expect(support.hybrid).toBe(false);
    });

    test('should support ML-KEM and ML-DSA aliases', () => {
      const remoteCapabilities = ['X25519', 'ML-KEM-768', 'ML-DSA-65'];
      const support = hybridService.checkAlgorithmSupport(remoteCapabilities);
      
      expect(support.x25519).toBe(true);
      expect(support.kyber768).toBe(true);
      expect(support.dilithium3).toBe(true);
      expect(support.hybrid).toBe(true);
    });
  });

  describe('Performance Benchmarks', () => {
    test('should benchmark hybrid operations', async () => {
      const iterations = 3; // Fewer iterations as hybrid is slower
      const metrics = await hybridService.benchmarkOperations(iterations);
      
      expect(metrics.keyGenTime).toBeGreaterThan(0);
      expect(metrics.keyExchangeTime).toBeGreaterThan(0);
      expect(metrics.verificationTime).toBeGreaterThan(0);
      expect(metrics.classicalKeySize).toBe(32);
      expect(metrics.postQuantumKeySize).toBe(1184 + 1952);
      expect(metrics.combinedKeySize).toBeGreaterThan(metrics.classicalKeySize);
      expect(metrics.signatureSize).toBe(3293);
      expect(metrics.totalOverhead).toBeGreaterThan(0);

      // Performance thresholds (may need adjustment based on hardware)
      expect(metrics.keyGenTime).toBeLessThan(1000);
      expect(metrics.keyExchangeTime).toBeLessThan(500);
      expect(metrics.verificationTime).toBeLessThan(300);
    });

    test('should get performance metrics', () => {
      const metrics = hybridService.getPerformanceMetrics();
      expect(metrics).toBeDefined();
    });
  });

  describe('Security Properties', () => {
    test('should combine classical and post-quantum security', async () => {
      const initiatorKeys = await hybridService.generateKeyPair();
      const responderKeys = await hybridService.generateKeyPair();
      
      const keyExchange = await hybridService.performKeyExchange(
        initiatorKeys,
        responderKeys.combined.publicKey
      );
      
      // Should have both classical and post-quantum components
      expect(keyExchange.classical.sharedSecret).toHaveLength(32);
      expect(keyExchange.postQuantum.kyberSharedSecret).toHaveLength(32);
      
      // Final shared secret should be different from individual components
      expect(keyExchange.combined.finalSharedSecret).not.toEqual(keyExchange.classical.sharedSecret);
      expect(keyExchange.combined.finalSharedSecret).not.toEqual(keyExchange.postQuantum.kyberSharedSecret);
    });

    test('should provide quantum resistance', async () => {
      const info = hybridService.getAlgorithmInfo();
      expect(info.securityLevel).toBe(3); // NIST Level 3 provides quantum resistance
      expect(info.components).toContain('Kyber-768');
      expect(info.components).toContain('Dilithium-3');
    });

    test('should authenticate key exchange', async () => {
      const initiatorKeys = await hybridService.generateKeyPair();
      const responderKeys = await hybridService.generateKeyPair();
      
      const keyExchange = await hybridService.performKeyExchange(
        initiatorKeys,
        responderKeys.combined.publicKey
      );
      
      // Should include Dilithium signature for authentication
      expect(keyExchange.postQuantum.signature).toBeDefined();
      expect(keyExchange.postQuantum.signature.signature).toHaveLength(3293);
      expect(keyExchange.combined.authenticatedData).toBeDefined();
    });
  });

  describe('Public Key Parsing', () => {
    test('should parse combined public keys correctly', async () => {
      const keyPair = await hybridService.generateKeyPair();
      
      // Combined public key should be parseable (tested indirectly through key exchange)
      const testKeys = await hybridService.generateKeyPair();
      const keyExchange = await hybridService.performKeyExchange(
        testKeys,
        keyPair.combined.publicKey
      );
      
      expect(keyExchange).toBeDefined();
      expect(keyExchange.combined.finalSharedSecret).toHaveLength(32);
    });
  });

  describe('Memory Safety', () => {
    test('should clear sensitive data after operations', async () => {
      const keyPair = await hybridService.generateKeyPair();
      
      // Create copies to verify clearing
      const originalClassicalPrivate = new Uint8Array(keyPair.classical.privateKey);
      const originalKyberPrivate = new Uint8Array(keyPair.postQuantum.kyber.privateKey);
      const originalDilithiumPrivate = new Uint8Array(keyPair.postQuantum.dilithium.privateKey);
      
      // Simulate clearing (the service would do this internally)
      hybridService['secureZero'](keyPair.classical.privateKey);
      hybridService['secureZero'](keyPair.postQuantum.kyber.privateKey);
      hybridService['secureZero'](keyPair.postQuantum.dilithium.privateKey);
      
      // Verify data was cleared
      expect(keyPair.classical.privateKey).not.toEqual(originalClassicalPrivate);
      expect(keyPair.postQuantum.kyber.privateKey).not.toEqual(originalKyberPrivate);
      expect(keyPair.postQuantum.dilithium.privateKey).not.toEqual(originalDilithiumPrivate);
    });
  });

  describe('Error Handling', () => {
    test('should handle uninitialized service', async () => {
      const uninitializedService = new HybridKeyExchangeService();
      
      await expect(uninitializedService.generateKeyPair()).rejects.toThrow('not initialized');
    });

    test('should handle invalid public keys', async () => {
      const keyPair = await hybridService.generateKeyPair();
      const invalidPublicKey = new Uint8Array(10); // Too small
      
      await expect(
        hybridService.performKeyExchange(keyPair, invalidPublicKey)
      ).rejects.toThrow();
    });

    test('should handle malformed key exchange data', async () => {
      const keyPair = await hybridService.generateKeyPair();
      const malformedExchange = {
        classical: { ephemeralPublicKey: new Uint8Array(32), sharedSecret: new Uint8Array(32) },
        postQuantum: { 
          kyberCiphertext: new Uint8Array(1088), 
          kyberSharedSecret: new Uint8Array(32),
          signature: { signature: new Uint8Array(3293), message: new Uint8Array(0), timestamp: 0 }
        },
        combined: { finalSharedSecret: new Uint8Array(32), authenticatedData: new Uint8Array(0) },
        metadata: { timestamp: 0, algorithms: [], securityLevel: 0 }
      };
      
      await expect(
        hybridService.verifyKeyExchange(keyPair, malformedExchange)
      ).rejects.toThrow();
    });

    test('should handle benchmark with invalid iterations', async () => {
      await expect(hybridService.benchmarkOperations(0)).rejects.toThrow();
      await expect(hybridService.benchmarkOperations(-1)).rejects.toThrow();
    });
  });

  describe('Compatibility and Interoperability', () => {
    test('should maintain consistent key exchange results', async () => {
      const initiatorKeys = await hybridService.generateKeyPair();
      const responderKeys = await hybridService.generateKeyPair();
      
      // Perform key exchange multiple times with same keys
      const exchange1 = await hybridService.performKeyExchange(
        initiatorKeys,
        responderKeys.combined.publicKey
      );
      
      const exchange2 = await hybridService.performKeyExchange(
        initiatorKeys,
        responderKeys.combined.publicKey
      );
      
      // Classical ECDH should be the same (deterministic with same keys)
      expect(exchange1.classical.sharedSecret).toEqual(exchange2.classical.sharedSecret);
      
      // But Kyber encapsulation should be different (randomized)
      expect(exchange1.postQuantum.kyberCiphertext).not.toEqual(exchange2.postQuantum.kyberCiphertext);
      expect(exchange1.postQuantum.kyberSharedSecret).not.toEqual(exchange2.postQuantum.kyberSharedSecret);
      
      // Final shared secrets should be different
      expect(exchange1.combined.finalSharedSecret).not.toEqual(exchange2.combined.finalSharedSecret);
    });

    test('should work with different key pair generations', async () => {
      // Test that keys generated at different times work together
      const keys1 = await hybridService.generateKeyPair();
      
      // Simulate time passing
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const keys2 = await hybridService.generateKeyPair();
      
      const keyExchange = await hybridService.performKeyExchange(
        keys1,
        keys2.combined.publicKey
      );
      
      const verifiedSecret = await hybridService.verifyKeyExchange(keys2, keyExchange);
      
      expect(verifiedSecret).toEqual(keyExchange.combined.finalSharedSecret);
    });
  });
});