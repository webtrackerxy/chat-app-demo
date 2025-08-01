/**
 * Algorithm Negotiation Service
 * 
 * Handles negotiation between clients to determine the best supported
 * cryptographic algorithms for secure communication.
 * 
 * Features:
 * - Backward compatibility with classical-only systems
 * - Forward compatibility with future quantum-resistant algorithms
 * - Security level negotiation
 * - Graceful degradation when PQC is not available
 * - Protocol version management
 */

export interface CryptoCapabilities {
  // Protocol version
  protocolVersion: string;
  
  // Key exchange algorithms
  keyExchange: {
    x25519: boolean;
    kyber768: boolean;
    hybrid: boolean;
  };
  
  // Signature algorithms
  signatures: {
    ed25519?: boolean;
    dilithium3: boolean;
  };
  
  // Encryption algorithms
  encryption: {
    chacha20poly1305: boolean;
    aes256gcm?: boolean;
  };
  
  // Advanced features
  features: {
    perfectForwardSecrecy: boolean;
    postQuantumReady: boolean;
    doubleRatchet: boolean;
  };
  
  // Security preferences
  security: {
    minimumSecurityLevel: number; // 1, 2, 3, 5 (NIST levels)
    quantumResistant: boolean;
    hybridMode: boolean;
  };
}

export interface NegotiationResult {
  // Selected algorithms
  keyExchange: 'x25519' | 'kyber768' | 'hybrid';
  signature: 'dilithium3' | 'ed25519' | null;
  encryption: 'chacha20poly1305' | 'aes256gcm';
  
  // Security level achieved
  securityLevel: number;
  quantumResistant: boolean;
  
  // Protocol details
  protocolVersion: string;
  features: {
    perfectForwardSecrecy: boolean;
    doubleRatchet: boolean;
    postQuantum: boolean;
  };
  
  // Fallback information
  fallbackAvailable: boolean;
  upgradeAvailable: boolean;
  
  // Metadata
  timestamp: number;
  negotiationId: string;
}

export interface NegotiationContext {
  localCapabilities: CryptoCapabilities;
  remoteCapabilities: CryptoCapabilities;
  preferenceOverrides?: Partial<CryptoCapabilities>;
  requireQuantumResistant?: boolean;
  allowDowngrade?: boolean;
}

/**
 * Algorithm Negotiation Service
 * 
 * Manages cryptographic algorithm negotiation between clients for
 * optimal security and compatibility.
 */
export class AlgorithmNegotiationService {
  private static readonly CURRENT_PROTOCOL_VERSION = '2.0.0';
  private static readonly SUPPORTED_VERSIONS = ['1.0.0', '1.1.0', '2.0.0'];
  
  // Security level mappings (NIST levels)
  private static readonly SECURITY_LEVELS = {
    X25519: 1,
    KYBER768: 3,
    DILITHIUM3: 3,
    HYBRID: 3, // Max of component algorithms
    CHACHA20POLY1305: 1,
    AES256GCM: 1
  };
  
  private initialized: boolean = false;

  /**
   * Initialize the negotiation service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;
    console.log('Algorithm Negotiation Service initialized successfully');
  }

  /**
   * Get current client capabilities
   * 
   * @returns CryptoCapabilities - Current client's cryptographic capabilities
   */
  getLocalCapabilities(): CryptoCapabilities {
    return {
      protocolVersion: AlgorithmNegotiationService.CURRENT_PROTOCOL_VERSION,
      keyExchange: {
        x25519: true,
        kyber768: true,
        hybrid: true
      },
      signatures: {
        dilithium3: true
      },
      encryption: {
        chacha20poly1305: true
      },
      features: {
        perfectForwardSecrecy: true,
        postQuantumReady: true,
        doubleRatchet: true
      },
      security: {
        minimumSecurityLevel: 1,
        quantumResistant: true,
        hybridMode: true
      }
    };
  }

  /**
   * Negotiate algorithms with remote party
   * 
   * @param context - Negotiation context with capabilities
   * @returns Promise<NegotiationResult> - Negotiated algorithm selection
   */
  async negotiateAlgorithms(context: NegotiationContext): Promise<NegotiationResult> {
    this.ensureInitialized();

    const { localCapabilities, remoteCapabilities } = context;

    // Validate protocol compatibility
    const compatibleVersion = this.negotiateProtocolVersion(
      localCapabilities.protocolVersion,
      remoteCapabilities.protocolVersion
    );

    if (!compatibleVersion) {
      throw new Error('No compatible protocol version found');
    }

    // Negotiate key exchange algorithm
    const keyExchange = this.negotiateKeyExchange(context);
    
    // Negotiate signature algorithm
    const signature = this.negotiateSignature(context);
    
    // Negotiate encryption algorithm
    const encryption = this.negotiateEncryption(context);

    // Calculate achieved security level
    const securityLevel = this.calculateSecurityLevel(keyExchange, signature, encryption);
    
    // Check quantum resistance
    const quantumResistant = this.isQuantumResistant(keyExchange, signature);
    
    // Check if minimum security requirements are met
    const minSecurityLevel = Math.max(
      localCapabilities.security.minimumSecurityLevel,
      remoteCapabilities.security.minimumSecurityLevel
    );
    
    if (securityLevel < minSecurityLevel) {
      throw new Error(`Security level ${securityLevel} below minimum required ${minSecurityLevel}`);
    }

    // Check quantum resistance requirements
    if (context.requireQuantumResistant && !quantumResistant) {
      throw new Error('Quantum resistance required but not achievable with negotiated algorithms');
    }

    const result: NegotiationResult = {
      keyExchange,
      signature,
      encryption,
      securityLevel,
      quantumResistant,
      protocolVersion: compatibleVersion,
      features: {
        perfectForwardSecrecy: this.supportsPFS(localCapabilities, remoteCapabilities),
        doubleRatchet: this.supportsDoubleRatchet(localCapabilities, remoteCapabilities),
        postQuantum: quantumResistant
      },
      fallbackAvailable: this.checkFallbackAvailable(context),
      upgradeAvailable: this.checkUpgradeAvailable(context),
      timestamp: Date.now(),
      negotiationId: this.generateNegotiationId()
    };

    console.log('Algorithm negotiation completed:', {
      keyExchange: result.keyExchange,
      signature: result.signature,
      encryption: result.encryption,
      securityLevel: result.securityLevel,
      quantumResistant: result.quantumResistant
    });

    return result;
  }

  /**
   * Check if capabilities are compatible
   * 
   * @param local - Local capabilities
   * @param remote - Remote capabilities
   * @returns boolean - True if compatible
   */
  areCapabilitiesCompatible(local: CryptoCapabilities, remote: CryptoCapabilities): boolean {
    try {
      const context: NegotiationContext = {
        localCapabilities: local,
        remoteCapabilities: remote
      };
      
      // Try to negotiate - if it doesn't throw, they're compatible
      this.negotiateKeyExchange(context);
      this.negotiateSignature(context);
      this.negotiateEncryption(context);
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get algorithm recommendations for given security level
   * 
   * @param securityLevel - Desired NIST security level (1, 3, 5)
   * @param quantumResistant - Whether quantum resistance is required
   * @returns CryptoCapabilities - Recommended capabilities
   */
  getRecommendedCapabilities(securityLevel: number, quantumResistant: boolean = false): CryptoCapabilities {
    const base = this.getLocalCapabilities();

    if (securityLevel >= 3 || quantumResistant) {
      // High security or quantum resistance - prefer hybrid/PQC
      return {
        ...base,
        security: {
          minimumSecurityLevel: securityLevel,
          quantumResistant,
          hybridMode: true
        }
      };
    } else {
      // Standard security - classical algorithms acceptable
      return {
        ...base,
        keyExchange: {
          x25519: true,
          kyber768: false,
          hybrid: false
        },
        signatures: {
          dilithium3: false
        },
        security: {
          minimumSecurityLevel: securityLevel,
          quantumResistant: false,
          hybridMode: false
        }
      };
    }
  }

  /**
   * Create backwards-compatible capabilities
   * For communicating with classical-only clients
   * 
   * @returns CryptoCapabilities - Classical-only capabilities
   */
  getClassicalOnlyCapabilities(): CryptoCapabilities {
    return {
      protocolVersion: '1.0.0',
      keyExchange: {
        x25519: true,
        kyber768: false,
        hybrid: false
      },
      signatures: {
        dilithium3: false
      },
      encryption: {
        chacha20poly1305: true
      },
      features: {
        perfectForwardSecrecy: true,
        postQuantumReady: false,
        doubleRatchet: true
      },
      security: {
        minimumSecurityLevel: 1,
        quantumResistant: false,
        hybridMode: false
      }
    };
  }

  /**
   * Validate negotiation result for security compliance
   * 
   * @param result - Negotiation result to validate
   * @param requirements - Security requirements
   * @returns boolean - True if compliant
   */
  validateNegotiationResult(
    result: NegotiationResult,
    requirements: {
      minimumSecurityLevel?: number;
      requireQuantumResistant?: boolean;
      requirePFS?: boolean;
    }
  ): boolean {
    if (requirements.minimumSecurityLevel && result.securityLevel < requirements.minimumSecurityLevel) {
      return false;
    }

    if (requirements.requireQuantumResistant && !result.quantumResistant) {
      return false;
    }

    if (requirements.requirePFS && !result.features.perfectForwardSecrecy) {
      return false;
    }

    return true;
  }

  // Private helper methods

  private negotiateProtocolVersion(localVersion: string, remoteVersion: string): string | null {
    // Find highest common version
    const localSupported = AlgorithmNegotiationService.SUPPORTED_VERSIONS.includes(localVersion);
    const remoteSupported = AlgorithmNegotiationService.SUPPORTED_VERSIONS.includes(remoteVersion);

    if (!localSupported || !remoteSupported) {
      return null;
    }

    // Use the lower version for compatibility
    const versions = [localVersion, remoteVersion].sort();
    return versions[0];
  }

  private negotiateKeyExchange(context: NegotiationContext): 'x25519' | 'kyber768' | 'hybrid' {
    const { localCapabilities, remoteCapabilities, requireQuantumResistant } = context;

    // Prefer hybrid if both support it
    if (localCapabilities.keyExchange.hybrid && remoteCapabilities.keyExchange.hybrid) {
      return 'hybrid';
    }

    // If quantum resistance is required, try Kyber
    if (requireQuantumResistant) {
      if (localCapabilities.keyExchange.kyber768 && remoteCapabilities.keyExchange.kyber768) {
        return 'kyber768';
      }
      throw new Error('Quantum-resistant key exchange required but not supported by both parties');
    }

    // Try Kyber for high security
    if (localCapabilities.keyExchange.kyber768 && remoteCapabilities.keyExchange.kyber768) {
      const minSecLevel = Math.max(
        localCapabilities.security.minimumSecurityLevel,
        remoteCapabilities.security.minimumSecurityLevel
      );
      if (minSecLevel >= 3) {
        return 'kyber768';
      }
    }

    // Fall back to X25519
    if (localCapabilities.keyExchange.x25519 && remoteCapabilities.keyExchange.x25519) {
      return 'x25519';
    }

    throw new Error('No compatible key exchange algorithm found');
  }

  private negotiateSignature(context: NegotiationContext): 'dilithium3' | 'ed25519' | null {
    const { localCapabilities, remoteCapabilities, requireQuantumResistant } = context;

    // Prefer Dilithium for post-quantum security
    if (localCapabilities.signatures.dilithium3 && remoteCapabilities.signatures.dilithium3) {
      return 'dilithium3';
    }

    // If quantum resistance is required, Dilithium is mandatory
    if (requireQuantumResistant) {
      throw new Error('Quantum-resistant signatures required but Dilithium not supported by both parties');
    }

    // Fall back to Ed25519 if available
    if (localCapabilities.signatures.ed25519 && remoteCapabilities.signatures.ed25519) {
      return 'ed25519';
    }

    // Signatures are optional in some contexts
    return null;
  }

  private negotiateEncryption(context: NegotiationContext): 'chacha20poly1305' | 'aes256gcm' {
    const { localCapabilities, remoteCapabilities } = context;

    // Prefer ChaCha20-Poly1305 (better performance, constant-time)
    if (localCapabilities.encryption.chacha20poly1305 && remoteCapabilities.encryption.chacha20poly1305) {
      return 'chacha20poly1305';
    }

    // Fall back to AES-256-GCM
    if (localCapabilities.encryption.aes256gcm && remoteCapabilities.encryption.aes256gcm) {
      return 'aes256gcm';
    }

    throw new Error('No compatible encryption algorithm found');
  }

  private calculateSecurityLevel(
    keyExchange: string,
    signature: string | null,
    encryption: string
  ): number {
    const levels = [
      AlgorithmNegotiationService.SECURITY_LEVELS[keyExchange.toUpperCase() as keyof typeof AlgorithmNegotiationService.SECURITY_LEVELS],
      encryption === 'chacha20poly1305' ? AlgorithmNegotiationService.SECURITY_LEVELS.CHACHA20POLY1305 : AlgorithmNegotiationService.SECURITY_LEVELS.AES256GCM
    ];

    if (signature) {
      levels.push(AlgorithmNegotiationService.SECURITY_LEVELS[signature.toUpperCase() as keyof typeof AlgorithmNegotiationService.SECURITY_LEVELS]);
    }

    return Math.min(...levels); // Security is limited by weakest component
  }

  private isQuantumResistant(keyExchange: string, signature: string | null): boolean {
    const quantumResistantKE = keyExchange === 'kyber768' || keyExchange === 'hybrid';
    const quantumResistantSig = signature === null || signature === 'dilithium3';
    
    return quantumResistantKE && quantumResistantSig;
  }

  private supportsPFS(local: CryptoCapabilities, remote: CryptoCapabilities): boolean {
    return local.features.perfectForwardSecrecy && remote.features.perfectForwardSecrecy;
  }

  private supportsDoubleRatchet(local: CryptoCapabilities, remote: CryptoCapabilities): boolean {
    return local.features.doubleRatchet && remote.features.doubleRatchet;
  }

  private checkFallbackAvailable(context: NegotiationContext): boolean {
    // Check if we could fall back to a lower security configuration
    const fallbackContext = {
      ...context,
      localCapabilities: {
        ...context.localCapabilities,
        security: {
          ...context.localCapabilities.security,
          minimumSecurityLevel: 1,
          quantumResistant: false
        }
      },
      remoteCapabilities: {
        ...context.remoteCapabilities,
        security: {
          ...context.remoteCapabilities.security,
          minimumSecurityLevel: 1,
          quantumResistant: false
        }
      }
    };

    return this.areCapabilitiesCompatible(fallbackContext.localCapabilities, fallbackContext.remoteCapabilities);
  }

  private checkUpgradeAvailable(context: NegotiationContext): boolean {
    // Check if both parties support higher security levels
    const { localCapabilities, remoteCapabilities } = context;
    
    return (
      localCapabilities.keyExchange.hybrid &&
      remoteCapabilities.keyExchange.hybrid &&
      localCapabilities.signatures.dilithium3 &&
      remoteCapabilities.signatures.dilithium3
    );
  }

  private generateNegotiationId(): string {
    return `neg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Algorithm Negotiation service not initialized. Call initialize() first.');
    }
  }
}

// Create and export a singleton instance
export const algorithmNegotiationService = new AlgorithmNegotiationService();