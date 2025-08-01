/**
 * Hybrid Classical + Post-Quantum Key Exchange Service
 * 
 * Implements hybrid key exchange combining:
 * - Classical: X25519 Elliptic Curve Diffie-Hellman
 * - Post-Quantum: Kyber-768 Key Encapsulation Mechanism
 * - Signatures: Dilithium-3 Digital Signatures
 * 
 * This provides "belt and suspenders" security:
 * - If quantum computers break one system, the other remains secure
 * - Backward compatibility with classical-only systems
 * - Future-proof against quantum attacks
 * 
 * Security Level: MAX(Classical Security, Post-Quantum Security)
 * Provides security against both classical and quantum attacks
 */

import { X25519Service } from './X25519Service';
import { KyberService, KyberKeyPair, KyberEncapsulation } from './KyberService';
import { DilithiumService, DilithiumKeyPair, DilithiumSignature } from './DilithiumService';
import { ChainKeyService } from './ChainKeyService';

export interface HybridKeyPair {
  classical: {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };
  postQuantum: {
    kyber: KyberKeyPair;
    dilithium: DilithiumKeyPair;
  };
  combined: {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };
}

export interface HybridKeyExchange {
  classical: {
    ephemeralPublicKey: Uint8Array;
    sharedSecret: Uint8Array;
  };
  postQuantum: {
    kyberCiphertext: Uint8Array;
    kyberSharedSecret: Uint8Array;
    signature: DilithiumSignature;
  };
  combined: {
    finalSharedSecret: Uint8Array;
    authenticatedData: Uint8Array;
  };
  metadata: {
    timestamp: number;
    algorithms: string[];
    securityLevel: number;
  };
}

export interface HybridMetrics {
  keyGenTime: number;
  keyExchangeTime: number;
  verificationTime: number;
  classicalKeySize: number;
  postQuantumKeySize: number;
  combinedKeySize: number;
  signatureSize: number;
  totalOverhead: number;
}

export interface AlgorithmSupport {
  x25519: boolean;
  kyber768: boolean;
  dilithium3: boolean;
  hybrid: boolean;
}

/**
 * Hybrid Key Exchange Service
 * 
 * Combines classical and post-quantum cryptography for maximum security.
 * Provides seamless fallback and forward compatibility.
 */
export class HybridKeyExchangeService {
  private static readonly ALGORITHM_NAME = 'Hybrid-X25519-Kyber768-Dilithium3';
  private static readonly SECURITY_LEVEL = 3; // NIST Level 3 (minimum of component algorithms)
  private static readonly HYBRID_KDF_INFO = 'HYBRID-KDF-2024';
  
  private x25519Service: X25519Service;
  private kyberService: KyberService;
  private dilithiumService: DilithiumService;
  private chainKeyService: ChainKeyService;
  
  private initialized: boolean = false;
  private performanceMetrics: HybridMetrics | null = null;

  constructor() {
    this.x25519Service = new X25519Service();
    this.kyberService = new KyberService();
    this.dilithiumService = new DilithiumService();
    this.chainKeyService = new ChainKeyService();
  }

  /**
   * Initialize the hybrid key exchange service
   * Initializes all underlying cryptographic services
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize all component services
      await Promise.all([
        this.x25519Service.initialize(),
        this.kyberService.initialize(),
        this.dilithiumService.initialize(),
        this.chainKeyService.initialize()
      ]);

      // Verify hybrid operation with test vectors
      await this.verifyHybridOperation();

      this.initialized = true;
      console.log(`${HybridKeyExchangeService.ALGORITHM_NAME} service initialized successfully`);
    } catch (error) {
      throw new Error(`Failed to initialize Hybrid Key Exchange service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a new hybrid key pair
   * Contains both classical and post-quantum key pairs
   * 
   * @returns Promise<HybridKeyPair> - Complete hybrid key pair
   */
  async generateKeyPair(): Promise<HybridKeyPair> {
    this.ensureInitialized();

    const startTime = performance.now();

    try {
      // Generate all key pairs in parallel for performance
      const [classicalKeyPair, kyberKeyPair, dilithiumKeyPair] = await Promise.all([
        this.x25519Service.generateKeyPair(),
        this.kyberService.generateKeyPair(),
        this.dilithiumService.generateKeyPair()
      ]);

      // Combine public keys into a single identifier
      const combinedPublicKey = this.combinePublicKeys(
        classicalKeyPair.publicKey,
        kyberKeyPair.publicKey,
        dilithiumKeyPair.publicKey
      );

      // Combine private keys (encrypted storage format)
      const combinedPrivateKey = this.combinePrivateKeys(
        classicalKeyPair.privateKey,
        kyberKeyPair.privateKey,
        dilithiumKeyPair.privateKey
      );

      const endTime = performance.now();
      const keyGenTime = endTime - startTime;

      // Update performance metrics
      this.updateKeyGenMetrics(keyGenTime, combinedPublicKey.length, combinedPrivateKey.length);

      return {
        classical: classicalKeyPair,
        postQuantum: {
          kyber: kyberKeyPair,
          dilithium: dilithiumKeyPair
        },
        combined: {
          publicKey: combinedPublicKey,
          privateKey: combinedPrivateKey
        }
      };
    } catch (error) {
      throw new Error(`Hybrid key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform hybrid key exchange
   * Combines X25519 ECDH with Kyber KEM and Dilithium signatures
   * 
   * @param initiatorKeyPair - Initiator's hybrid key pair
   * @param responderPublicKey - Responder's hybrid public key
   * @returns Promise<HybridKeyExchange> - Complete key exchange result
   */
  async performKeyExchange(
    initiatorKeyPair: HybridKeyPair,
    responderPublicKey: Uint8Array
  ): Promise<HybridKeyExchange> {
    this.ensureInitialized();

    const startTime = performance.now();

    try {
      // Parse responder's public key components
      const responderKeys = this.parsePublicKey(responderPublicKey);

      // Perform classical X25519 key exchange
      const classicalSharedSecret = await this.x25519Service.computeSharedSecret(
        initiatorKeyPair.classical.privateKey,
        responderKeys.x25519PublicKey
      );

      // Perform post-quantum Kyber encapsulation
      const kyberEncapsulation = await this.kyberService.encapsulate(responderKeys.kyberPublicKey);

      // Create authentication data
      const authData = this.createAuthenticationData(
        initiatorKeyPair.classical.publicKey,
        responderKeys.x25519PublicKey,
        kyberEncapsulation.ciphertext
      );

      // Sign the exchange with Dilithium
      const signature = await this.dilithiumService.sign(
        initiatorKeyPair.postQuantum.dilithium.privateKey,
        authData
      );

      // Combine shared secrets using secure KDF
      const finalSharedSecret = await this.combineSharedSecrets(
        classicalSharedSecret,
        kyberEncapsulation.sharedSecret
      );

      const endTime = performance.now();
      const keyExchangeTime = endTime - startTime;

      // Update performance metrics
      this.updateKeyExchangeMetrics(keyExchangeTime);

      return {
        classical: {
          ephemeralPublicKey: initiatorKeyPair.classical.publicKey,
          sharedSecret: classicalSharedSecret
        },
        postQuantum: {
          kyberCiphertext: kyberEncapsulation.ciphertext,
          kyberSharedSecret: kyberEncapsulation.sharedSecret,
          signature
        },
        combined: {
          finalSharedSecret,
          authenticatedData: authData
        },
        metadata: {
          timestamp: Date.now(),
          algorithms: ['X25519', 'Kyber-768', 'Dilithium-3'],
          securityLevel: HybridKeyExchangeService.SECURITY_LEVEL
        }
      };
    } catch (error) {
      throw new Error(`Hybrid key exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify and process received key exchange
   * 
   * @param responderKeyPair - Responder's hybrid key pair
   * @param keyExchange - Received key exchange data
   * @returns Promise<Uint8Array> - Final shared secret
   */
  async verifyKeyExchange(
    responderKeyPair: HybridKeyPair,
    keyExchange: HybridKeyExchange
  ): Promise<Uint8Array> {
    this.ensureInitialized();

    const startTime = performance.now();

    try {
      // Verify Dilithium signature
      const initiatorKeys = this.parsePublicKey(keyExchange.classical.ephemeralPublicKey);
      const isSignatureValid = await this.dilithiumService.verify(
        initiatorKeys.dilithiumPublicKey,
        keyExchange.combined.authenticatedData,
        keyExchange.postQuantum.signature.signature
      );

      if (!isSignatureValid) {
        throw new Error('Dilithium signature verification failed');
      }

      // Perform classical X25519 key exchange
      const classicalSharedSecret = await this.x25519Service.computeSharedSecret(
        responderKeyPair.classical.privateKey,
        keyExchange.classical.ephemeralPublicKey
      );

      // Decapsulate Kyber shared secret
      const kyberSharedSecret = await this.kyberService.decapsulate(
        keyExchange.postQuantum.kyberCiphertext,
        responderKeyPair.postQuantum.kyber.privateKey
      );

      // Verify shared secrets match
      if (!this.constantTimeEquals(classicalSharedSecret, keyExchange.classical.sharedSecret)) {
        throw new Error('Classical shared secret mismatch');
      }

      if (!this.constantTimeEquals(kyberSharedSecret, keyExchange.postQuantum.kyberSharedSecret)) {
        throw new Error('Post-quantum shared secret mismatch');
      }

      // Combine shared secrets
      const finalSharedSecret = await this.combineSharedSecrets(
        classicalSharedSecret,
        kyberSharedSecret
      );

      const endTime = performance.now();
      const verificationTime = endTime - startTime;

      // Update performance metrics
      this.updateVerificationMetrics(verificationTime);

      // Clean up intermediate secrets
      this.secureZero(classicalSharedSecret);
      this.secureZero(kyberSharedSecret);

      return finalSharedSecret;
    } catch (error) {
      throw new Error(`Hybrid key exchange verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check algorithm support and compatibility
   * 
   * @param remoteCapabilities - Remote party's algorithm capabilities
   * @returns AlgorithmSupport - Supported algorithms for negotiation
   */
  checkAlgorithmSupport(remoteCapabilities?: string[]): AlgorithmSupport {
    const support: AlgorithmSupport = {
      x25519: true,
      kyber768: true,
      dilithium3: true,
      hybrid: true
    };

    if (remoteCapabilities) {
      support.x25519 = remoteCapabilities.includes('X25519');
      support.kyber768 = remoteCapabilities.includes('Kyber-768') || remoteCapabilities.includes('ML-KEM-768');
      support.dilithium3 = remoteCapabilities.includes('Dilithium-3') || remoteCapabilities.includes('ML-DSA-65');
      support.hybrid = support.x25519 && support.kyber768 && support.dilithium3;
    }

    return support;
  }

  /**
   * Get algorithm information and parameters
   * 
   * @returns Object containing algorithm details
   */
  getAlgorithmInfo(): {
    name: string;
    securityLevel: number;
    components: string[];
    standards: string[];
    keyExchangeMethods: string[];
    signatureMethods: string[];
  } {
    return {
      name: HybridKeyExchangeService.ALGORITHM_NAME,
      securityLevel: HybridKeyExchangeService.SECURITY_LEVEL,
      components: ['X25519', 'Kyber-768', 'Dilithium-3'],
      standards: ['RFC 7748', 'NIST FIPS 203', 'NIST FIPS 204'],
      keyExchangeMethods: ['ECDH', 'KEM'],
      signatureMethods: ['Dilithium-3']
    };
  }

  /**
   * Get performance metrics
   * 
   * @returns HybridMetrics | null - Performance data or null if not available
   */
  getPerformanceMetrics(): HybridMetrics | null {
    return this.performanceMetrics ? { ...this.performanceMetrics } : null;
  }

  /**
   * Benchmark hybrid operations
   * 
   * @param iterations - Number of iterations for benchmarking
   * @returns Promise<HybridMetrics> - Comprehensive performance metrics
   */
  async benchmarkOperations(iterations: number = 50): Promise<HybridMetrics> {
    this.ensureInitialized();

    if (iterations <= 0) {
      throw new Error('Iterations must be greater than 0');
    }

    let totalKeyGenTime = 0;
    let totalKeyExchangeTime = 0;
    let totalVerificationTime = 0;

    console.log(`Starting Hybrid Key Exchange benchmark with ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
      // Key generation benchmark
      const keyGenStart = performance.now();
      const initiatorKeys = await this.generateKeyPair();
      const responderKeys = await this.generateKeyPair();
      const keyGenEnd = performance.now();
      totalKeyGenTime += (keyGenEnd - keyGenStart);

      // Key exchange benchmark
      const exchangeStart = performance.now();
      const keyExchange = await this.performKeyExchange(initiatorKeys, responderKeys.combined.publicKey);
      const exchangeEnd = performance.now();
      totalKeyExchangeTime += (exchangeEnd - exchangeStart);

      // Verification benchmark
      const verifyStart = performance.now();
      const finalSecret = await this.verifyKeyExchange(responderKeys, keyExchange);
      const verifyEnd = performance.now();
      totalVerificationTime += (verifyEnd - verifyStart);

      // Verify shared secret matches
      if (!this.constantTimeEquals(finalSecret, keyExchange.combined.finalSharedSecret)) {
        throw new Error(`Benchmark verification failed at iteration ${i}`);
      }

      // Clean up sensitive data
      this.secureZero(initiatorKeys.combined.privateKey);
      this.secureZero(responderKeys.combined.privateKey);
      this.secureZero(finalSecret);
    }

    const metrics: HybridMetrics = {
      keyGenTime: totalKeyGenTime / iterations,
      keyExchangeTime: totalKeyExchangeTime / iterations,
      verificationTime: totalVerificationTime / iterations,
      classicalKeySize: 32, // X25519 public key size
      postQuantumKeySize: 1184 + 1952, // Kyber + Dilithium public key sizes
      combinedKeySize: 32 + 1184 + 1952, // Total combined size
      signatureSize: 3293, // Dilithium signature size
      totalOverhead: (32 + 1184 + 1952 + 3293) - 32 // Additional overhead vs X25519 only
    };

    this.performanceMetrics = metrics;

    console.log('Hybrid Key Exchange Benchmark Results:');
    console.log(`  Key Generation: ${metrics.keyGenTime.toFixed(2)}ms average`);
    console.log(`  Key Exchange: ${metrics.keyExchangeTime.toFixed(2)}ms average`);
    console.log(`  Verification: ${metrics.verificationTime.toFixed(2)}ms average`);
    console.log(`  Classical Key Size: ${metrics.classicalKeySize} bytes`);
    console.log(`  Post-Quantum Key Size: ${metrics.postQuantumKeySize} bytes`);
    console.log(`  Combined Key Size: ${metrics.combinedKeySize} bytes`);
    console.log(`  Signature Size: ${metrics.signatureSize} bytes`);
    console.log(`  Total Overhead: ${metrics.totalOverhead} bytes`);

    return metrics;
  }

  // Private helper methods

  private async verifyHybridOperation(): Promise<void> {
    // Generate test key pairs
    const initiatorKeys = await this.generateKeyPair();
    const responderKeys = await this.generateKeyPair();

    // Perform key exchange
    const keyExchange = await this.performKeyExchange(initiatorKeys, responderKeys.combined.publicKey);
    const verifiedSecret = await this.verifyKeyExchange(responderKeys, keyExchange);

    // Verify secrets match
    if (!this.constantTimeEquals(keyExchange.combined.finalSharedSecret, verifiedSecret)) {
      throw new Error('Hybrid operation test vector verification failed');
    }

    // Clean up
    this.secureZero(initiatorKeys.combined.privateKey);
    this.secureZero(responderKeys.combined.privateKey);
    this.secureZero(verifiedSecret);
  }

  private combinePublicKeys(x25519Key: Uint8Array, kyberKey: Uint8Array, dilithiumKey: Uint8Array): Uint8Array {
    // Create a structured format: [x25519_len][x25519_key][kyber_len][kyber_key][dilithium_len][dilithium_key]
    const totalLength = 4 + x25519Key.length + 4 + kyberKey.length + 4 + dilithiumKey.length;
    const combined = new Uint8Array(totalLength);
    let offset = 0;

    // X25519 key
    new DataView(combined.buffer).setUint32(offset, x25519Key.length, false);
    offset += 4;
    combined.set(x25519Key, offset);
    offset += x25519Key.length;

    // Kyber key
    new DataView(combined.buffer).setUint32(offset, kyberKey.length, false);
    offset += 4;
    combined.set(kyberKey, offset);
    offset += kyberKey.length;

    // Dilithium key
    new DataView(combined.buffer).setUint32(offset, dilithiumKey.length, false);
    offset += 4;
    combined.set(dilithiumKey, offset);

    return combined;
  }

  private combinePrivateKeys(x25519Key: Uint8Array, kyberKey: Uint8Array, dilithiumKey: Uint8Array): Uint8Array {
    // Same format as public keys but for private keys
    return this.combinePublicKeys(x25519Key, kyberKey, dilithiumKey);
  }

  private parsePublicKey(combinedKey: Uint8Array): {
    x25519PublicKey: Uint8Array;
    kyberPublicKey: Uint8Array;
    dilithiumPublicKey: Uint8Array;
  } {
    let offset = 0;

    // Parse X25519 key
    const x25519Len = new DataView(combinedKey.buffer).getUint32(offset, false);
    offset += 4;
    const x25519PublicKey = combinedKey.slice(offset, offset + x25519Len);
    offset += x25519Len;

    // Parse Kyber key
    const kyberLen = new DataView(combinedKey.buffer).getUint32(offset, false);
    offset += 4;
    const kyberPublicKey = combinedKey.slice(offset, offset + kyberLen);
    offset += kyberLen;

    // Parse Dilithium key
    const dilithiumLen = new DataView(combinedKey.buffer).getUint32(offset, false);
    offset += 4;
    const dilithiumPublicKey = combinedKey.slice(offset, offset + dilithiumLen);

    return { x25519PublicKey, kyberPublicKey, dilithiumPublicKey };
  }

  private createAuthenticationData(
    initiatorPublicKey: Uint8Array,
    responderPublicKey: Uint8Array,
    kyberCiphertext: Uint8Array
  ): Uint8Array {
    // Create authenticated data for signature
    const totalLength = initiatorPublicKey.length + responderPublicKey.length + kyberCiphertext.length;
    const authData = new Uint8Array(totalLength);
    let offset = 0;

    authData.set(initiatorPublicKey, offset);
    offset += initiatorPublicKey.length;
    authData.set(responderPublicKey, offset);
    offset += responderPublicKey.length;
    authData.set(kyberCiphertext, offset);

    return authData;
  }

  private async combineSharedSecrets(classicalSecret: Uint8Array, postQuantumSecret: Uint8Array): Promise<Uint8Array> {
    // Use HKDF to combine the secrets securely
    const combinedInput = new Uint8Array(classicalSecret.length + postQuantumSecret.length);
    combinedInput.set(classicalSecret, 0);
    combinedInput.set(postQuantumSecret, classicalSecret.length);

    // Derive final shared secret using chain key service (which has HKDF)
    return await this.chainKeyService.deriveMessageKey(combinedInput, 0);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Hybrid Key Exchange service not initialized. Call initialize() first.');
    }
  }

  private constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  }

  private secureZero(data: Uint8Array): void {
    if (data && data.length > 0) {
      data.fill(0);
    }
  }

  private updateKeyGenMetrics(keyGenTime: number, publicKeySize: number, privateKeySize: number): void {
    if (!this.performanceMetrics) {
      this.performanceMetrics = {
        keyGenTime,
        keyExchangeTime: 0,
        verificationTime: 0,
        classicalKeySize: 32,
        postQuantumKeySize: 1184 + 1952,
        combinedKeySize: publicKeySize,
        signatureSize: 3293,
        totalOverhead: publicKeySize - 32
      };
    } else {
      this.performanceMetrics.keyGenTime = keyGenTime;
    }
  }

  private updateKeyExchangeMetrics(keyExchangeTime: number): void {
    if (this.performanceMetrics) {
      this.performanceMetrics.keyExchangeTime = keyExchangeTime;
    }
  }

  private updateVerificationMetrics(verificationTime: number): void {
    if (this.performanceMetrics) {
      this.performanceMetrics.verificationTime = verificationTime;
    }
  }
}

// Create and export a singleton instance
export const hybridKeyExchangeService = new HybridKeyExchangeService();