/**
 * Dilithium-3 Digital Signature Service
 * 
 * Implements NIST FIPS 204 ML-DSA (Module-Lattice-based Digital Signature Algorithm)
 * using Dilithium-3 for post-quantum digital signatures.
 * 
 * Security Level: NIST Level 3 (192-bit classical security equivalent)
 * Quantum Security: ~128-bit against quantum attacks
 * 
 * Key Features:
 * - Quantum-resistant digital signatures
 * - Message authentication and non-repudiation
 * - Standardized FIPS 204 implementation
 * - Hybrid compatibility with classical signatures
 */

import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';

export interface DilithiumKeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface DilithiumSignature {
  signature: Uint8Array;
  message: Uint8Array;
  timestamp: number;
}

export interface DilithiumMetrics {
  keyGenTime: number;
  signTime: number;
  verifyTime: number;
  publicKeySize: number;
  privateKeySize: number;
  signatureSize: number;
  throughputSigsPerSecond: number;
  throughputVerificationsPerSecond: number;
}

/**
 * Dilithium-3 Digital Signature Service
 * 
 * Provides post-quantum secure digital signatures using the ML-DSA standard.
 * Designed for message authentication and non-repudiation in hybrid systems.
 */
export class DilithiumService {
  private static readonly ALGORITHM_NAME = 'ML-DSA-65';
  private static readonly SECURITY_LEVEL = 3; // NIST Level 3
  private static readonly QUANTUM_SECURITY_BITS = 128;
  
  // ML-DSA-65 (Dilithium-3) Parameters (FIPS 204)
  private static readonly PUBLIC_KEY_SIZE = 1952;
  private static readonly PRIVATE_KEY_SIZE = 4000;
  private static readonly SIGNATURE_SIZE = 3293;
  
  private initialized: boolean = false;
  private performanceMetrics: DilithiumMetrics | null = null;

  /**
   * Initialize the Dilithium service
   * Verifies ML-DSA-65 parameters and prepares for operations
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Verify ML-DSA-65 is available and working
      const testKeyPair = ml_dsa65.keygen();
      const testMessage = new Uint8Array([1, 2, 3, 4, 5]);
      const testSignature = ml_dsa65.sign(testKeyPair.secretKey, testMessage);
      const isValid = ml_dsa65.verify(testKeyPair.publicKey, testMessage, testSignature);

      if (!isValid) {
        throw new Error('ML-DSA-65 test vector verification failed');
      }

      // Clear test data from memory
      this.secureZero(testKeyPair.secretKey);
      this.secureZero(testSignature);

      this.initialized = true;
      console.log(`${DilithiumService.ALGORITHM_NAME} service initialized successfully`);
    } catch (error) {
      throw new Error(`Failed to initialize Dilithium service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a new Dilithium-3 key pair
   * 
   * @returns Promise<DilithiumKeyPair> - New key pair with public and private keys
   * @throws Error if service not initialized or key generation fails
   */
  async generateKeyPair(): Promise<DilithiumKeyPair> {
    this.ensureInitialized();

    const startTime = performance.now();
    
    try {
      const keyPair = ml_dsa65.keygen();
      
      const endTime = performance.now();
      const keyGenTime = endTime - startTime;

      // Validate key sizes
      if (keyPair.publicKey.length !== DilithiumService.PUBLIC_KEY_SIZE) {
        throw new Error(`Invalid public key size: expected ${DilithiumService.PUBLIC_KEY_SIZE}, got ${keyPair.publicKey.length}`);
      }
      
      if (keyPair.secretKey.length !== DilithiumService.PRIVATE_KEY_SIZE) {
        throw new Error(`Invalid private key size: expected ${DilithiumService.PRIVATE_KEY_SIZE}, got ${keyPair.secretKey.length}`);
      }

      // Update performance metrics
      this.updateKeyGenMetrics(keyGenTime);

      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.secretKey
      };
    } catch (error) {
      throw new Error(`Dilithium key generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign a message using Dilithium-3
   * 
   * @param privateKey - Signer's Dilithium-3 private key
   * @param message - Message to sign (as bytes)
   * @returns Promise<DilithiumSignature> - Signature with metadata
   * @throws Error if private key is invalid or signing fails
   */
  async sign(privateKey: Uint8Array, message: Uint8Array): Promise<DilithiumSignature> {
    this.ensureInitialized();
    this.validatePrivateKey(privateKey);
    this.validateMessage(message);

    const startTime = performance.now();

    try {
      const signature = ml_dsa65.sign(privateKey, message);
      
      const endTime = performance.now();
      const signTime = endTime - startTime;

      // Validate signature size
      if (signature.length !== DilithiumService.SIGNATURE_SIZE) {
        throw new Error(`Invalid signature size: expected ${DilithiumService.SIGNATURE_SIZE}, got ${signature.length}`);
      }

      // Update performance metrics
      this.updateSignMetrics(signTime);

      return {
        signature,
        message: new Uint8Array(message), // Copy to avoid mutations
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Dilithium signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sign a text message using Dilithium-3
   * 
   * @param privateKey - Signer's Dilithium-3 private key
   * @param message - Text message to sign
   * @returns Promise<DilithiumSignature> - Signature with metadata
   */
  async signMessage(privateKey: Uint8Array, message: string): Promise<DilithiumSignature> {
    const messageBytes = new TextEncoder().encode(message);
    return this.sign(privateKey, messageBytes);
  }

  /**
   * Verify a Dilithium-3 signature
   * 
   * @param publicKey - Signer's Dilithium-3 public key
   * @param message - Original message (as bytes)
   * @param signature - Signature to verify
   * @returns Promise<boolean> - True if signature is valid
   * @throws Error if inputs are invalid
   */
  async verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    this.ensureInitialized();
    this.validatePublicKey(publicKey);
    this.validateMessage(message);
    this.validateSignature(signature);

    const startTime = performance.now();

    try {
      const isValid = ml_dsa65.verify(publicKey, message, signature);
      
      const endTime = performance.now();
      const verifyTime = endTime - startTime;

      // Update performance metrics
      this.updateVerifyMetrics(verifyTime);

      return isValid;
    } catch (error) {
      // Verification failure is not an error, just return false
      console.warn(`Dilithium verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Verify a text message signature
   * 
   * @param publicKey - Signer's Dilithium-3 public key
   * @param message - Original text message
   * @param signature - Signature to verify
   * @returns Promise<boolean> - True if signature is valid
   */
  async verifyMessage(publicKey: Uint8Array, message: string, signature: Uint8Array): Promise<boolean> {
    const messageBytes = new TextEncoder().encode(message);
    return this.verify(publicKey, messageBytes, signature);
  }

  /**
   * Verify a complete DilithiumSignature object
   * 
   * @param publicKey - Signer's Dilithium-3 public key
   * @param signatureObj - Complete signature object
   * @returns Promise<boolean> - True if signature is valid
   */
  async verifySignatureObject(publicKey: Uint8Array, signatureObj: DilithiumSignature): Promise<boolean> {
    return this.verify(publicKey, signatureObj.message, signatureObj.signature);
  }

  /**
   * Validate a Dilithium-3 public key
   * 
   * @param publicKey - Public key to validate
   * @returns boolean - True if valid, false otherwise
   */
  validatePublicKey(publicKey: Uint8Array): boolean {
    if (!publicKey || publicKey.length !== DilithiumService.PUBLIC_KEY_SIZE) {
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
   * Validate a Dilithium-3 private key
   * 
   * @param privateKey - Private key to validate
   * @returns boolean - True if valid, false otherwise
   */
  validatePrivateKey(privateKey: Uint8Array): boolean {
    if (!privateKey || privateKey.length !== DilithiumService.PRIVATE_KEY_SIZE) {
      return false;
    }
    
    // Check for all-zero key (invalid)
    if (privateKey.every(byte => byte === 0)) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate a Dilithium-3 signature
   * 
   * @param signature - Signature to validate
   * @returns boolean - True if valid format, false otherwise
   */
  validateSignature(signature: Uint8Array): boolean {
    if (!signature || signature.length !== DilithiumService.SIGNATURE_SIZE) {
      return false;
    }
    
    return true;
  }

  /**
   * Validate a message for signing/verification
   * 
   * @param message - Message to validate
   * @returns boolean - True if valid, false otherwise
   */
  validateMessage(message: Uint8Array): boolean {
    if (!message) {
      return false;
    }
    
    // Allow empty messages (valid for some use cases)
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
    signatureSize: number;
    standard: string;
  } {
    return {
      name: DilithiumService.ALGORITHM_NAME,
      securityLevel: DilithiumService.SECURITY_LEVEL,
      quantumSecurityBits: DilithiumService.QUANTUM_SECURITY_BITS,
      publicKeySize: DilithiumService.PUBLIC_KEY_SIZE,
      privateKeySize: DilithiumService.PRIVATE_KEY_SIZE,
      signatureSize: DilithiumService.SIGNATURE_SIZE,
      standard: 'NIST FIPS 204'
    };
  }

  /**
   * Get performance metrics
   * 
   * @returns DilithiumMetrics | null - Performance data or null if not available
   */
  getPerformanceMetrics(): DilithiumMetrics | null {
    return this.performanceMetrics ? { ...this.performanceMetrics } : null;
  }

  /**
   * Benchmark Dilithium operations
   * 
   * @param iterations - Number of iterations for benchmarking
   * @returns Promise<DilithiumMetrics> - Comprehensive performance metrics
   */
  async benchmarkOperations(iterations: number = 100): Promise<DilithiumMetrics> {
    this.ensureInitialized();

    if (iterations <= 0) {
      throw new Error('Iterations must be greater than 0');
    }

    let totalKeyGenTime = 0;
    let totalSignTime = 0;
    let totalVerifyTime = 0;

    console.log(`Starting Dilithium-3 benchmark with ${iterations} iterations...`);

    const testMessage = new TextEncoder().encode('Benchmark message for Dilithium-3 performance testing');

    for (let i = 0; i < iterations; i++) {
      // Key generation benchmark
      const keyGenStart = performance.now();
      const keyPair = await this.generateKeyPair();
      const keyGenEnd = performance.now();
      totalKeyGenTime += (keyGenEnd - keyGenStart);

      // Signing benchmark
      const signStart = performance.now();
      const signature = await this.sign(keyPair.privateKey, testMessage);
      const signEnd = performance.now();
      totalSignTime += (signEnd - signStart);

      // Verification benchmark
      const verifyStart = performance.now();
      const isValid = await this.verify(keyPair.publicKey, testMessage, signature.signature);
      const verifyEnd = performance.now();
      totalVerifyTime += (verifyEnd - verifyStart);

      // Verify correctness
      if (!isValid) {
        throw new Error(`Benchmark verification failed at iteration ${i}`);
      }

      // Clean up sensitive data
      this.secureZero(keyPair.privateKey);
      this.secureZero(signature.signature);
    }

    const avgKeyGenTime = totalKeyGenTime / iterations;
    const avgSignTime = totalSignTime / iterations;
    const avgVerifyTime = totalVerifyTime / iterations;

    const metrics: DilithiumMetrics = {
      keyGenTime: avgKeyGenTime,
      signTime: avgSignTime,
      verifyTime: avgVerifyTime,
      publicKeySize: DilithiumService.PUBLIC_KEY_SIZE,
      privateKeySize: DilithiumService.PRIVATE_KEY_SIZE,
      signatureSize: DilithiumService.SIGNATURE_SIZE,
      throughputSigsPerSecond: avgSignTime > 0 ? 1000 / avgSignTime : 0,
      throughputVerificationsPerSecond: avgVerifyTime > 0 ? 1000 / avgVerifyTime : 0
    };

    this.performanceMetrics = metrics;

    console.log('Dilithium-3 Benchmark Results:');
    console.log(`  Key Generation: ${metrics.keyGenTime.toFixed(2)}ms average`);
    console.log(`  Signing: ${metrics.signTime.toFixed(2)}ms average`);
    console.log(`  Verification: ${metrics.verifyTime.toFixed(2)}ms average`);
    console.log(`  Signing Throughput: ${Math.round(metrics.throughputSigsPerSecond)} sigs/sec`);
    console.log(`  Verification Throughput: ${Math.round(metrics.throughputVerificationsPerSecond)} verifications/sec`);
    console.log(`  Public Key Size: ${metrics.publicKeySize} bytes`);
    console.log(`  Private Key Size: ${metrics.privateKeySize} bytes`);
    console.log(`  Signature Size: ${metrics.signatureSize} bytes`);

    return metrics;
  }

  /**
   * Create a detached signature (signature without the message)
   * 
   * @param privateKey - Signer's private key
   * @param message - Message to sign
   * @returns Promise<Uint8Array> - Detached signature
   */
  async createDetachedSignature(privateKey: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
    const signatureObj = await this.sign(privateKey, message);
    return signatureObj.signature;
  }

  /**
   * Verify a detached signature
   * 
   * @param publicKey - Signer's public key
   * @param message - Original message
   * @param signature - Detached signature
   * @returns Promise<boolean> - True if signature is valid
   */
  async verifyDetachedSignature(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
    return this.verify(publicKey, message, signature);
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
   * Generate cryptographically secure random bytes
   * 
   * @param length - Number of bytes to generate
   * @returns Uint8Array - Random bytes
   */
  randomBytes(length: number): Uint8Array {
    // Validate input parameter
    if (!Number.isInteger(length) || length < 0) {
      console.error('DilithiumService.randomBytes: length must be a non-negative integer, got:', length, typeof length);
      throw new Error('length must be an unsigned integer');
    }
    
    if (length === 0) {
      return new Uint8Array(0);
    }

    console.log(`🔐 DilithiumService generating ${length} random bytes`);
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Dilithium service not initialized. Call initialize() first.');
    }
  }

  private updateKeyGenMetrics(keyGenTime: number): void {
    if (!this.performanceMetrics) {
      this.performanceMetrics = {
        keyGenTime,
        signTime: 0,
        verifyTime: 0,
        publicKeySize: DilithiumService.PUBLIC_KEY_SIZE,
        privateKeySize: DilithiumService.PRIVATE_KEY_SIZE,
        signatureSize: DilithiumService.SIGNATURE_SIZE,
        throughputSigsPerSecond: 0,
        throughputVerificationsPerSecond: 0
      };
    } else {
      this.performanceMetrics.keyGenTime = keyGenTime;
    }
  }

  private updateSignMetrics(signTime: number): void {
    if (!this.performanceMetrics) {
      this.performanceMetrics = {
        keyGenTime: 0,
        signTime,
        verifyTime: 0,
        publicKeySize: DilithiumService.PUBLIC_KEY_SIZE,
        privateKeySize: DilithiumService.PRIVATE_KEY_SIZE,
        signatureSize: DilithiumService.SIGNATURE_SIZE,
        throughputSigsPerSecond: signTime > 0 ? 1000 / signTime : 0,
        throughputVerificationsPerSecond: 0
      };
    } else {
      this.performanceMetrics.signTime = signTime;
      this.performanceMetrics.throughputSigsPerSecond = signTime > 0 ? 1000 / signTime : 0;
    }
  }

  private updateVerifyMetrics(verifyTime: number): void {
    if (!this.performanceMetrics) {
      this.performanceMetrics = {
        keyGenTime: 0,
        signTime: 0,
        verifyTime,
        publicKeySize: DilithiumService.PUBLIC_KEY_SIZE,
        privateKeySize: DilithiumService.PRIVATE_KEY_SIZE,
        signatureSize: DilithiumService.SIGNATURE_SIZE,
        throughputSigsPerSecond: 0,
        throughputVerificationsPerSecond: verifyTime > 0 ? 1000 / verifyTime : 0
      };
    } else {
      this.performanceMetrics.verifyTime = verifyTime;
      this.performanceMetrics.throughputVerificationsPerSecond = verifyTime > 0 ? 1000 / verifyTime : 0;
    }
  }
}

// Create and export a singleton instance
export const dilithiumService = new DilithiumService();