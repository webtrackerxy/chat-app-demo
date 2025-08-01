/**
 * Kyber-768 (ML-KEM) Key Encapsulation Mechanism Service
 * 
 * Implements NIST FIPS 203 ML-KEM (Module-Lattice-based Key Encapsulation Mechanism)
 * using Kyber-768 for post-quantum security.
 * 
 * Security Level: NIST Level 3 (192-bit classical security equivalent)
 * Quantum Security: ~128-bit against quantum attacks
 * 
 * Key Features:
 * - Quantum-resistant key encapsulation
 * - Hybrid compatibility with classical cryptography
 * - Standardized FIPS 203 implementation
 * - Performance optimized for real-time messaging
 */

import { ml_kem768 } from '@noble/post-quantum/ml-kem';

export interface KyberKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface KyberEncapsulation {
  ciphertext: Uint8Array;
  sharedSecret: Uint8Array;
}

export interface KyberMetrics {
  keyGenTime: number;
  encapsulationTime: number;
  decapsulationTime: number;
  publicKeySize: number;
  privateKeySize: number;
  ciphertextSize: number;
  sharedSecretSize: number;
}

/**
 * Kyber-768 Key Encapsulation Mechanism Service
 * 
 * Provides post-quantum secure key establishment using the ML-KEM standard.
 * Designed to work alongside classical cryptography in hybrid mode.
 */
export class KyberService {
  private static readonly ALGORITHM_NAME = 'ML-KEM-768';
  private static readonly SECURITY_LEVEL = 3; // NIST Level 3
  private static readonly QUANTUM_SECURITY_BITS = 128;
  
  // ML-KEM-768 Parameters (FIPS 203)
  private static readonly PUBLIC_KEY_SIZE = 1184;
  private static readonly PRIVATE_KEY_SIZE = 2400;
  private static readonly CIPHERTEXT_SIZE = 1088;
  private static readonly SHARED_SECRET_SIZE = 32;
  
  private initialized: boolean = false;
  private performanceMetrics: KyberMetrics | null = null;

  /**
   * Initialize the Kyber service
   * Verifies ML-KEM-768 parameters and prepares for operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Verify ML-KEM-768 is available and working
      const testKeyPair = ml_kem768.keygen();
      const testEncaps = ml_kem768.encapsulate(testKeyPair.publicKey);
      const testDecaps = ml_kem768.decapsulate(testEncaps.cipherText, testKeyPair.secretKey);

      // Verify shared secrets match
      if (!this.constantTimeEquals(testEncaps.sharedSecret, testDecaps)) {
        throw new Error('ML-KEM-768 test vector verification failed');
      }

      // Clear test data from memory
      this.secureZero(testKeyPair.secretKey);
      this.secureZero(testEncaps.sharedSecret);
      this.secureZero(testDecaps);

      this.initialized = true;
      console.log(`${KyberService.ALGORITHM_NAME} service initialized successfully`);
    } catch (error) {
      throw new Error(`Failed to initialize Kyber service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a new Kyber-768 key pair
   * 
   * @returns Promise<KyberKeyPair> - New key pair with public and private keys
   * @throws Error if service not initialized or key generation fails
   */
  async generateKeyPair(): Promise<KyberKeyPair> {
    this.ensureInitialized();

    const startTime = performance.now();
    
    try {
      const keyPair = ml_kem768.keygen();
      
      const endTime = performance.now();
      const keyGenTime = endTime - startTime;

      // Validate key sizes
      if (keyPair.publicKey.length !== KyberService.PUBLIC_KEY_SIZE) {
        throw new Error(`Invalid public key size: expected ${KyberService.PUBLIC_KEY_SIZE}, got ${keyPair.publicKey.length}`);
      }
      
      if (keyPair.secretKey.length !== KyberService.PRIVATE_KEY_SIZE) {
        throw new Error(`Invalid private key size: expected ${KyberService.PRIVATE_KEY_SIZE}, got ${keyPair.secretKey.length}`);
      }

      // Update performance metrics
      this.updateKeyGenMetrics(keyGenTime);

      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.secretKey
      };
    } catch (error) {
      throw new Error(`Kyber key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encapsulate a shared secret using the recipient's public key
   * 
   * @param publicKey - Recipient's Kyber-768 public key
   * @returns Promise<KyberEncapsulation> - Ciphertext and shared secret
   * @throws Error if public key is invalid or encapsulation fails
   */
  async encapsulate(publicKey: Uint8Array): Promise<KyberEncapsulation> {
    this.ensureInitialized();
    this.validatePublicKey(publicKey);

    const startTime = performance.now();

    try {
      const encapsulation = ml_kem768.encapsulate(publicKey);
      
      const endTime = performance.now();
      const encapsulationTime = endTime - startTime;

      // Validate ciphertext size
      if (encapsulation.cipherText.length !== KyberService.CIPHERTEXT_SIZE) {
        throw new Error(`Invalid ciphertext size: expected ${KyberService.CIPHERTEXT_SIZE}, got ${encapsulation.cipherText.length}`);
      }
      
      // Validate shared secret size
      if (encapsulation.sharedSecret.length !== KyberService.SHARED_SECRET_SIZE) {
        throw new Error(`Invalid shared secret size: expected ${KyberService.SHARED_SECRET_SIZE}, got ${encapsulation.sharedSecret.length}`);
      }

      // Update performance metrics
      this.updateEncapsulationMetrics(encapsulationTime);

      return {
        ciphertext: encapsulation.cipherText,
        sharedSecret: encapsulation.sharedSecret
      };
    } catch (error) {
      throw new Error(`Kyber encapsulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decapsulate the shared secret using the private key
   * 
   * @param ciphertext - Encapsulated ciphertext
   * @param privateKey - Recipient's Kyber-768 private key
   * @returns Promise<Uint8Array> - Decapsulated shared secret
   * @throws Error if inputs are invalid or decapsulation fails
   */
  async decapsulate(ciphertext: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array> {
    this.ensureInitialized();
    this.validateCiphertext(ciphertext);
    this.validatePrivateKey(privateKey);

    const startTime = performance.now();

    try {
      const sharedSecret = ml_kem768.decapsulate(ciphertext, privateKey);
      
      const endTime = performance.now();
      const decapsulationTime = endTime - startTime;

      // Validate shared secret size
      if (sharedSecret.length !== KyberService.SHARED_SECRET_SIZE) {
        throw new Error(`Invalid shared secret size: expected ${KyberService.SHARED_SECRET_SIZE}, got ${sharedSecret.length}`);
      }

      // Update performance metrics
      this.updateDecapsulationMetrics(decapsulationTime);

      return sharedSecret;
    } catch (error) {
      throw new Error(`Kyber decapsulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate a Kyber-768 public key
   * 
   * @param publicKey - Public key to validate
   * @returns boolean - True if valid, false otherwise
   */
  validatePublicKey(publicKey: Uint8Array): boolean {
    if (!publicKey || publicKey.length !== KyberService.PUBLIC_KEY_SIZE) {
      return false;
    }
    
    // Check for all-zero key (invalid)
    if (publicKey.every(byte => byte === 0)) {
      return false;
    }
    
    // Check for all-one key (highly unlikely to be valid)
    if (publicKey.every(byte => byte === 0xFF)) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate a Kyber-768 private key
   * 
   * @param privateKey - Private key to validate
   * @returns boolean - True if valid, false otherwise
   */
  validatePrivateKey(privateKey: Uint8Array): boolean {
    if (!privateKey || privateKey.length !== KyberService.PRIVATE_KEY_SIZE) {
      return false;
    }
    
    // Check for all-zero key (invalid)
    if (privateKey.every(byte => byte === 0)) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate Kyber-768 ciphertext
   * 
   * @param ciphertext - Ciphertext to validate
   * @returns boolean - True if valid, false otherwise
   */
  validateCiphertext(ciphertext: Uint8Array): boolean {
    if (!ciphertext || ciphertext.length !== KyberService.CIPHERTEXT_SIZE) {
      return false;
    }
    
    return true;
  }

  /**
   * Get algorithm information and parameters
   * 
   * @returns Object containing algorithm details
   */
  getAlgorithmInfo(): {
    name: string;
    securityLevel: number;
    quantumSecurityBits: number;
    publicKeySize: number;
    privateKeySize: number;
    ciphertextSize: number;
    sharedSecretSize: number;
    standard: string;
  } {
    return {
      name: KyberService.ALGORITHM_NAME,
      securityLevel: KyberService.SECURITY_LEVEL,
      quantumSecurityBits: KyberService.QUANTUM_SECURITY_BITS,
      publicKeySize: KyberService.PUBLIC_KEY_SIZE,
      privateKeySize: KyberService.PRIVATE_KEY_SIZE,
      ciphertextSize: KyberService.CIPHERTEXT_SIZE,
      sharedSecretSize: KyberService.SHARED_SECRET_SIZE,
      standard: 'NIST FIPS 203'
    };
  }

  /**
   * Get performance metrics
   * 
   * @returns KyberMetrics | null - Performance data or null if not available
   */
  getPerformanceMetrics(): KyberMetrics | null {
    return this.performanceMetrics ? { ...this.performanceMetrics } : null;
  }

  /**
   * Benchmark Kyber operations
   * 
   * @param iterations - Number of iterations for benchmarking
   * @returns Promise<KyberMetrics> - Comprehensive performance metrics
   */
  async benchmarkOperations(iterations: number = 100): Promise<KyberMetrics> {
    this.ensureInitialized();

    if (iterations <= 0) {
      throw new Error('Iterations must be greater than 0');
    }

    let totalKeyGenTime = 0;
    let totalEncapsulationTime = 0;
    let totalDecapsulationTime = 0;

    console.log(`Starting Kyber-768 benchmark with ${iterations} iterations...`);

    for (let i = 0; i < iterations; i++) {
      // Key generation benchmark
      const keyGenStart = performance.now();
      const keyPair = await this.generateKeyPair();
      const keyGenEnd = performance.now();
      totalKeyGenTime += (keyGenEnd - keyGenStart);

      // Encapsulation benchmark
      const encapsStart = performance.now();
      const encapsulation = await this.encapsulate(keyPair.publicKey);
      const encapsEnd = performance.now();
      totalEncapsulationTime += (encapsEnd - encapsStart);

      // Decapsulation benchmark
      const decapsStart = performance.now();
      const decapsulatedSecret = await this.decapsulate(encapsulation.ciphertext, keyPair.privateKey);
      const decapsEnd = performance.now();
      totalDecapsulationTime += (decapsEnd - decapsStart);

      // Verify correctness
      if (!this.constantTimeEquals(encapsulation.sharedSecret, decapsulatedSecret)) {
        throw new Error(`Benchmark verification failed at iteration ${i}`);
      }

      // Clean up sensitive data
      this.secureZero(keyPair.privateKey);
      this.secureZero(encapsulation.sharedSecret);
      this.secureZero(decapsulatedSecret);
    }

    const metrics: KyberMetrics = {
      keyGenTime: totalKeyGenTime / iterations,
      encapsulationTime: totalEncapsulationTime / iterations,
      decapsulationTime: totalDecapsulationTime / iterations,
      publicKeySize: KyberService.PUBLIC_KEY_SIZE,
      privateKeySize: KyberService.PRIVATE_KEY_SIZE,
      ciphertextSize: KyberService.CIPHERTEXT_SIZE,
      sharedSecretSize: KyberService.SHARED_SECRET_SIZE
    };

    this.performanceMetrics = metrics;

    console.log('Kyber-768 Benchmark Results:');
    console.log(`  Key Generation: ${metrics.keyGenTime.toFixed(2)}ms average`);
    console.log(`  Encapsulation: ${metrics.encapsulationTime.toFixed(2)}ms average`);
    console.log(`  Decapsulation: ${metrics.decapsulationTime.toFixed(2)}ms average`);
    console.log(`  Public Key Size: ${metrics.publicKeySize} bytes`);
    console.log(`  Private Key Size: ${metrics.privateKeySize} bytes`);
    console.log(`  Ciphertext Size: ${metrics.ciphertextSize} bytes`);

    return metrics;
  }

  /**
   * Securely clear sensitive data from memory
   * 
   * @param data - Uint8Array to clear
   */
  secureZero(data: Uint8Array): void {
    if (data && data.length > 0) {
      data.fill(0);
    }
  }

  /**
   * Constant-time comparison to prevent timing attacks
   * 
   * @param a - First array
   * @param b - Second array
   * @returns boolean - True if arrays are equal
   */
  constantTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }

    return result === 0;
  }

  /**
   * Generate cryptographically secure random bytes
   * 
   * @param length - Number of bytes to generate
   * @returns Uint8Array - Random bytes
   */
  randomBytes(length: number): Uint8Array {
    // Validate input parameter
    if (!Number.isInteger(length) || length < 0) {
      console.error('KyberService.randomBytes: length must be a non-negative integer, got:', length, typeof length);
      throw new Error('length must be an unsigned integer');
    }
    
    if (length === 0) {
      return new Uint8Array(0);
    }

    console.log(`🔐 KyberService generating ${length} random bytes`);
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Kyber service not initialized. Call initialize() first.');
    }
  }

  private updateKeyGenMetrics(keyGenTime: number): void {
    if (!this.performanceMetrics) {
      this.performanceMetrics = {
        keyGenTime,
        encapsulationTime: 0,
        decapsulationTime: 0,
        publicKeySize: KyberService.PUBLIC_KEY_SIZE,
        privateKeySize: KyberService.PRIVATE_KEY_SIZE,
        ciphertextSize: KyberService.CIPHERTEXT_SIZE,
        sharedSecretSize: KyberService.SHARED_SECRET_SIZE
      };
    } else {
      this.performanceMetrics.keyGenTime = keyGenTime;
    }
  }

  private updateEncapsulationMetrics(encapsulationTime: number): void {
    if (!this.performanceMetrics) {
      this.performanceMetrics = {
        keyGenTime: 0,
        encapsulationTime,
        decapsulationTime: 0,
        publicKeySize: KyberService.PUBLIC_KEY_SIZE,
        privateKeySize: KyberService.PRIVATE_KEY_SIZE,
        ciphertextSize: KyberService.CIPHERTEXT_SIZE,
        sharedSecretSize: KyberService.SHARED_SECRET_SIZE
      };
    } else {
      this.performanceMetrics.encapsulationTime = encapsulationTime;
    }
  }

  private updateDecapsulationMetrics(decapsulationTime: number): void {
    if (!this.performanceMetrics) {
      this.performanceMetrics = {
        keyGenTime: 0,
        encapsulationTime: 0,
        decapsulationTime,
        publicKeySize: KyberService.PUBLIC_KEY_SIZE,
        privateKeySize: KyberService.PRIVATE_KEY_SIZE,
        ciphertextSize: KyberService.CIPHERTEXT_SIZE,
        sharedSecretSize: KyberService.SHARED_SECRET_SIZE
      };
    } else {
      this.performanceMetrics.decapsulationTime = decapsulationTime;
    }
  }
}

// Create and export a singleton instance
export const kyberService = new KyberService();