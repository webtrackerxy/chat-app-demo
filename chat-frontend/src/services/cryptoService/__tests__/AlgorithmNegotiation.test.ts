import { AlgorithmNegotiationService, CryptoCapabilities, NegotiationContext } from '../AlgorithmNegotiationService';

describe('Algorithm Negotiation Tests', () => {
  let negotiationService: AlgorithmNegotiationService;

  beforeAll(async () => {
    negotiationService = new AlgorithmNegotiationService();
    await negotiationService.initialize();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully', async () => {
      const newService = new AlgorithmNegotiationService();
      await expect(newService.initialize()).resolves.not.toThrow();
    });

    test('should get local capabilities', () => {
      const capabilities = negotiationService.getLocalCapabilities();
      
      expect(capabilities.protocolVersion).toBe('2.0.0');
      expect(capabilities.keyExchange.x25519).toBe(true);
      expect(capabilities.keyExchange.kyber768).toBe(true);
      expect(capabilities.keyExchange.hybrid).toBe(true);
      expect(capabilities.signatures.dilithium3).toBe(true);
      expect(capabilities.encryption.chacha20poly1305).toBe(true);
      expect(capabilities.features.perfectForwardSecrecy).toBe(true);
      expect(capabilities.features.postQuantumReady).toBe(true);
      expect(capabilities.features.doubleRatchet).toBe(true);
      expect(capabilities.security.quantumResistant).toBe(true);
      expect(capabilities.security.hybridMode).toBe(true);
    });
  });

  describe('Basic Algorithm Negotiation', () => {
    test('should negotiate hybrid algorithms when both parties support them', async () => {
      const localCapabilities = negotiationService.getLocalCapabilities();
      const remoteCapabilities = negotiationService.getLocalCapabilities();
      
      const context: NegotiationContext = {
        localCapabilities,
        remoteCapabilities
      };
      
      const result = await negotiationService.negotiateAlgorithms(context);
      
      expect(result.keyExchange).toBe('hybrid');
      expect(result.signature).toBe('dilithium3');
      expect(result.encryption).toBe('chacha20poly1305');
      expect(result.securityLevel).toBe(3);
      expect(result.quantumResistant).toBe(true);
      expect(result.features.perfectForwardSecrecy).toBe(true);
      expect(result.features.doubleRatchet).toBe(true);
      expect(result.features.postQuantum).toBe(true);
    });

    test('should negotiate classical algorithms when PQC not available', async () => {
      const localCapabilities = negotiationService.getLocalCapabilities();
      const remoteCapabilities: CryptoCapabilities = {
        protocolVersion: '1.0.0',
        keyExchange: { x25519: true, kyber768: false, hybrid: false },
        signatures: { dilithium3: false },
        encryption: { chacha20poly1305: true },
        features: { perfectForwardSecrecy: true, postQuantumReady: false, doubleRatchet: true },
        security: { minimumSecurityLevel: 1, quantumResistant: false, hybridMode: false }
      };
      
      const context: NegotiationContext = {
        localCapabilities,
        remoteCapabilities
      };
      
      const result = await negotiationService.negotiateAlgorithms(context);
      
      expect(result.keyExchange).toBe('x25519');
      expect(result.signature).toBe(null);
      expect(result.encryption).toBe('chacha20poly1305');
      expect(result.securityLevel).toBe(1);
      expect(result.quantumResistant).toBe(false);
    });

    test('should negotiate Kyber when hybrid not available but PQC supported', async () => {
      const localCapabilities = negotiationService.getLocalCapabilities();
      const remoteCapabilities: CryptoCapabilities = {
        protocolVersion: '2.0.0',
        keyExchange: { x25519: true, kyber768: true, hybrid: false },
        signatures: { dilithium3: true },
        encryption: { chacha20poly1305: true },
        features: { perfectForwardSecrecy: true, postQuantumReady: true, doubleRatchet: true },
        security: { minimumSecurityLevel: 3, quantumResistant: true, hybridMode: false }
      };
      
      const context: NegotiationContext = {
        localCapabilities,
        remoteCapabilities
      };
      
      const result = await negotiationService.negotiateAlgorithms(context);
      
      expect(result.keyExchange).toBe('kyber768');
      expect(result.signature).toBe('dilithium3');
      expect(result.encryption).toBe('chacha20poly1305');
      expect(result.securityLevel).toBe(3);
      expect(result.quantumResistant).toBe(true);
    });
  });

  describe('Security Level Negotiation', () => {
    test('should respect minimum security level requirements', async () => {
      const localCapabilities: CryptoCapabilities = {
        ...negotiationService.getLocalCapabilities(),
        security: { minimumSecurityLevel: 3, quantumResistant: true, hybridMode: true }
      };
      const remoteCapabilities: CryptoCapabilities = {
        ...negotiationService.getLocalCapabilities(),
        security: { minimumSecurityLevel: 1, quantumResistant: false, hybridMode: false }
      };
      
      const context: NegotiationContext = {
        localCapabilities,
        remoteCapabilities
      };
      
      const result = await negotiationService.negotiateAlgorithms(context);
      
      // Should achieve the higher security level
      expect(result.securityLevel).toBe(3);
      expect(result.keyExchange).toBe('hybrid');
    });

    test('should fail when minimum security level cannot be met', async () => {
      const localCapabilities: CryptoCapabilities = {
        protocolVersion: '2.0.0',
        keyExchange: { x25519: false, kyber768: false, hybrid: false },
        signatures: { dilithium3: false },
        encryption: { chacha20poly1305: true },
        features: { perfectForwardSecrecy: false, postQuantumReady: false, doubleRatchet: false },
        security: { minimumSecurityLevel: 3, quantumResistant: false, hybridMode: false }
      };
      const remoteCapabilities = negotiationService.getLocalCapabilities();
      
      const context: NegotiationContext = {
        localCapabilities,
        remoteCapabilities
      };
      
      await expect(negotiationService.negotiateAlgorithms(context)).rejects.toThrow('No compatible key exchange algorithm found');
    });
  });

  describe('Quantum Resistance Requirements', () => {
    test('should enforce quantum resistance when required', async () => {
      const localCapabilities = negotiationService.getLocalCapabilities();
      const remoteCapabilities = negotiationService.getLocalCapabilities();
      
      const context: NegotiationContext = {
        localCapabilities,
        remoteCapabilities,
        requireQuantumResistant: true
      };
      
      const result = await negotiationService.negotiateAlgorithms(context);
      
      expect(result.quantumResistant).toBe(true);
      expect(result.keyExchange).toBe('hybrid');
      expect(result.signature).toBe('dilithium3');
    });

    test('should fail when quantum resistance required but not available', async () => {
      const localCapabilities = negotiationService.getLocalCapabilities();
      const remoteCapabilities: CryptoCapabilities = {
        protocolVersion: '1.0.0',
        keyExchange: { x25519: true, kyber768: false, hybrid: false },
        signatures: { dilithium3: false },
        encryption: { chacha20poly1305: true },
        features: { perfectForwardSecrecy: true, postQuantumReady: false, doubleRatchet: true },
        security: { minimumSecurityLevel: 1, quantumResistant: false, hybridMode: false }
      };
      
      const context: NegotiationContext = {
        localCapabilities,
        remoteCapabilities,
        requireQuantumResistant: true
      };
      
      await expect(negotiationService.negotiateAlgorithms(context)).rejects.toThrow('Quantum-resistant key exchange required');
    });
  });

  describe('Protocol Version Negotiation', () => {
    test('should negotiate compatible protocol versions', async () => {
      const localCapabilities: CryptoCapabilities = {
        ...negotiationService.getLocalCapabilities(),
        protocolVersion: '2.0.0'
      };
      const remoteCapabilities: CryptoCapabilities = {
        ...negotiationService.getLocalCapabilities(),
        protocolVersion: '1.1.0'
      };
      
      const context: NegotiationContext = {
        localCapabilities,
        remoteCapabilities
      };
      
      const result = await negotiationService.negotiateAlgorithms(context);
      
      expect(result.protocolVersion).toBe('1.1.0'); // Lower version for compatibility
    });

    test('should fail with incompatible protocol versions', async () => {
      const localCapabilities: CryptoCapabilities = {
        ...negotiationService.getLocalCapabilities(),
        protocolVersion: '3.0.0' // Unsupported version
      };
      const remoteCapabilities = negotiationService.getLocalCapabilities();
      
      const context: NegotiationContext = {
        localCapabilities,
        remoteCapabilities
      };
      
      await expect(negotiationService.negotiateAlgorithms(context)).rejects.toThrow('No compatible protocol version found');
    });
  });

  describe('Capability Compatibility', () => {
    test('should detect compatible capabilities', () => {
      const local = negotiationService.getLocalCapabilities();
      const remote = negotiationService.getLocalCapabilities();
      
      const compatible = negotiationService.areCapabilitiesCompatible(local, remote);
      expect(compatible).toBe(true);
    });

    test('should detect incompatible capabilities', () => {
      const local = negotiationService.getLocalCapabilities();
      const remote: CryptoCapabilities = {
        protocolVersion: '1.0.0',
        keyExchange: { x25519: false, kyber768: false, hybrid: false },
        signatures: { dilithium3: false },
        encryption: { chacha20poly1305: false },
        features: { perfectForwardSecrecy: false, postQuantumReady: false, doubleRatchet: false },
        security: { minimumSecurityLevel: 1, quantumResistant: false, hybridMode: false }
      };
      
      const compatible = negotiationService.areCapabilitiesCompatible(local, remote);
      expect(compatible).toBe(false);
    });
  });

  describe('Capability Recommendations', () => {
    test('should recommend high security capabilities', () => {
      const recommendations = negotiationService.getRecommendedCapabilities(3, true);
      
      expect(recommendations.security.minimumSecurityLevel).toBe(3);
      expect(recommendations.security.quantumResistant).toBe(true);
      expect(recommendations.security.hybridMode).toBe(true);
      expect(recommendations.keyExchange.hybrid).toBe(true);
      expect(recommendations.signatures.dilithium3).toBe(true);
    });

    test('should recommend standard security capabilities', () => {
      const recommendations = negotiationService.getRecommendedCapabilities(1, false);
      
      expect(recommendations.security.minimumSecurityLevel).toBe(1);
      expect(recommendations.security.quantumResistant).toBe(false);
      expect(recommendations.security.hybridMode).toBe(false);
      expect(recommendations.keyExchange.x25519).toBe(true);
      expect(recommendations.keyExchange.kyber768).toBe(false);
      expect(recommendations.signatures.dilithium3).toBe(false);
    });

    test('should get classical-only capabilities', () => {
      const classical = negotiationService.getClassicalOnlyCapabilities();
      
      expect(classical.protocolVersion).toBe('1.0.0');
      expect(classical.keyExchange.x25519).toBe(true);
      expect(classical.keyExchange.kyber768).toBe(false);
      expect(classical.keyExchange.hybrid).toBe(false);
      expect(classical.signatures.dilithium3).toBe(false);
      expect(classical.features.postQuantumReady).toBe(false);
      expect(classical.security.quantumResistant).toBe(false);
    });
  });

  describe('Negotiation Result Validation', () => {
    test('should validate negotiation results', async () => {
      const local = negotiationService.getLocalCapabilities();
      const remote = negotiationService.getLocalCapabilities();
      
      const context: NegotiationContext = { localCapabilities: local, remoteCapabilities: remote };
      const result = await negotiationService.negotiateAlgorithms(context);
      
      const isValid = negotiationService.validateNegotiationResult(result, {
        minimumSecurityLevel: 3,
        requireQuantumResistant: true,
        requirePFS: true
      });
      
      expect(isValid).toBe(true);
    });

    test('should reject insufficient security level', async () => {
      const local = negotiationService.getLocalCapabilities();
      const remote: CryptoCapabilities = {
        protocolVersion: '1.0.0',
        keyExchange: { x25519: true, kyber768: false, hybrid: false },
        signatures: { dilithium3: false },
        encryption: { chacha20poly1305: true },
        features: { perfectForwardSecrecy: true, postQuantumReady: false, doubleRatchet: true },
        security: { minimumSecurityLevel: 1, quantumResistant: false, hybridMode: false }
      };
      
      const context: NegotiationContext = { localCapabilities: local, remoteCapabilities: remote };
      const result = await negotiationService.negotiateAlgorithms(context);
      
      const isValid = negotiationService.validateNegotiationResult(result, {
        minimumSecurityLevel: 3
      });
      
      expect(isValid).toBe(false);
    });

    test('should reject non-quantum-resistant result when required', async () => {
      const local = negotiationService.getLocalCapabilities();
      const remote: CryptoCapabilities = {
        protocolVersion: '1.0.0',
        keyExchange: { x25519: true, kyber768: false, hybrid: false },
        signatures: { dilithium3: false },
        encryption: { chacha20poly1305: true },
        features: { perfectForwardSecrecy: true, postQuantumReady: false, doubleRatchet: true },
        security: { minimumSecurityLevel: 1, quantumResistant: false, hybridMode: false }
      };
      
      const context: NegotiationContext = { localCapabilities: local, remoteCapabilities: remote };
      const result = await negotiationService.negotiateAlgorithms(context);
      
      const isValid = negotiationService.validateNegotiationResult(result, {
        requireQuantumResistant: true
      });
      
      expect(isValid).toBe(false);
    });
  });

  describe('Fallback and Upgrade Detection', () => {
    test('should detect fallback availability', async () => {
      const local = negotiationService.getLocalCapabilities();
      const remote = negotiationService.getLocalCapabilities();
      
      const context: NegotiationContext = { localCapabilities: local, remoteCapabilities: remote };
      const result = await negotiationService.negotiateAlgorithms(context);
      
      expect(result.fallbackAvailable).toBe(true);
      expect(result.upgradeAvailable).toBe(true);
    });

    test('should detect when no fallback available', async () => {
      const local: CryptoCapabilities = {
        protocolVersion: '2.0.0',
        keyExchange: { x25519: false, kyber768: true, hybrid: true },
        signatures: { dilithium3: true },
        encryption: { chacha20poly1305: true },
        features: { perfectForwardSecrecy: true, postQuantumReady: true, doubleRatchet: true },
        security: { minimumSecurityLevel: 3, quantumResistant: true, hybridMode: true }
      };
      const remote: CryptoCapabilities = {
        protocolVersion: '2.0.0',
        keyExchange: { x25519: false, kyber768: false, hybrid: false },
        signatures: { dilithium3: false },
        encryption: { chacha20poly1305: false },
        features: { perfectForwardSecrecy: false, postQuantumReady: false, doubleRatchet: false },
        security: { minimumSecurityLevel: 3, quantumResistant: false, hybridMode: false }
      };
      
      await expect(negotiationService.negotiateAlgorithms({
        localCapabilities: local,
        remoteCapabilities: remote
      })).rejects.toThrow();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle missing encryption algorithms', async () => {
      const local = negotiationService.getLocalCapabilities();
      const remote: CryptoCapabilities = {
        ...negotiationService.getLocalCapabilities(),
        encryption: { chacha20poly1305: false }
      };
      
      const context: NegotiationContext = { localCapabilities: local, remoteCapabilities: remote };
      
      await expect(negotiationService.negotiateAlgorithms(context)).rejects.toThrow('No compatible encryption algorithm found');
    });

    test('should handle uninitialized service', async () => {
      const uninitializedService = new AlgorithmNegotiationService();
      const context: NegotiationContext = {
        localCapabilities: negotiationService.getLocalCapabilities(),
        remoteCapabilities: negotiationService.getLocalCapabilities()
      };
      
      await expect(uninitializedService.negotiateAlgorithms(context)).rejects.toThrow('not initialized');
    });

    test('should generate unique negotiation IDs', async () => {
      const local = negotiationService.getLocalCapabilities();
      const remote = negotiationService.getLocalCapabilities();
      const context: NegotiationContext = { localCapabilities: local, remoteCapabilities: remote };
      
      const result1 = await negotiationService.negotiateAlgorithms(context);
      const result2 = await negotiationService.negotiateAlgorithms(context);
      
      expect(result1.negotiationId).not.toBe(result2.negotiationId);
      expect(result1.negotiationId).toMatch(/^neg_\d+_[a-z0-9]+$/);
      expect(result2.negotiationId).toMatch(/^neg_\d+_[a-z0-9]+$/);
    });
  });

  describe('Preference Overrides', () => {
    test('should handle preference overrides', async () => {
      const local = negotiationService.getLocalCapabilities();
      const remote = negotiationService.getLocalCapabilities();
      
      const context: NegotiationContext = {
        localCapabilities: local,
        remoteCapabilities: remote,
        preferenceOverrides: {
          security: { minimumSecurityLevel: 1, quantumResistant: false, hybridMode: false }
        }
      };
      
      const result = await negotiationService.negotiateAlgorithms(context);
      
      // Should still negotiate the best available despite overrides
      expect(result.keyExchange).toBe('hybrid');
      expect(result.securityLevel).toBe(3);
    });
  });

  describe('Concurrent Negotiations', () => {
    test('should handle multiple concurrent negotiations', async () => {
      const negotiations = [];
      
      for (let i = 0; i < 5; i++) {
        const local = negotiationService.getLocalCapabilities();
        const remote = negotiationService.getLocalCapabilities();
        
        negotiations.push(negotiationService.negotiateAlgorithms({
          localCapabilities: local,
          remoteCapabilities: remote
        }));
      }
      
      const results = await Promise.all(negotiations);
      
      results.forEach(result => {
        expect(result.keyExchange).toBe('hybrid');
        expect(result.signature).toBe('dilithium3');
        expect(result.encryption).toBe('chacha20poly1305');
        expect(result.quantumResistant).toBe(true);
        expect(result.negotiationId).toMatch(/^neg_\d+_[a-z0-9]+$/);
      });
      
      // All negotiation IDs should be unique
      const ids = results.map(r => r.negotiationId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('Metadata and Timestamps', () => {
    test('should include proper metadata in negotiation results', async () => {
      const local = negotiationService.getLocalCapabilities();
      const remote = negotiationService.getLocalCapabilities();
      const context: NegotiationContext = { localCapabilities: local, remoteCapabilities: remote };
      
      const startTime = Date.now();
      const result = await negotiationService.negotiateAlgorithms(context);
      const endTime = Date.now();
      
      expect(result.timestamp).toBeGreaterThanOrEqual(startTime);
      expect(result.timestamp).toBeLessThanOrEqual(endTime);
      expect(result.negotiationId).toBeDefined();
      expect(result.protocolVersion).toBe('2.0.0');
    });
  });
});