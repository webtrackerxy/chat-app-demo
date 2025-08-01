import sodium from 'libsodium-wrappers';

/**
 * X25519 Key Agreement Service for Perfect Forward Secrecy
 * 
 * Provides elliptic curve Diffie-Hellman key agreement using Curve25519.
 * This service is used for generating ephemeral keys in the Double Ratchet protocol.
 */
export class X25519Service {
  private initialized = false;

  /**
   * Initialize the libsodium library
   */
  async initialize(): Promise<void> {
    if (!this.initialized) {
      await sodium.ready;
      this.initialized = true;
    }
  }

  /**
   * Generate a new X25519 key pair for ephemeral key exchange
   * 
   * @returns Object containing public and private key as Uint8Arrays
   */
  async generateKeyPair(): Promise<{
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  }> {
    await this.initialize();
    const keyPair = sodium.crypto_box_keypair();
    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    };
  }

  /**
   * Compute shared secret using X25519 key agreement
   * 
   * @param privateKey - Our private key
   * @param publicKey - Remote party's public key
   * @returns Shared secret as Uint8Array (32 bytes)
   */
  async computeSharedSecret(
    privateKey: Uint8Array,
    publicKey: Uint8Array
  ): Promise<Uint8Array> {
    await this.initialize();
    
    if (privateKey.length !== 32) {
      throw new Error('Private key must be 32 bytes');
    }
    
    if (publicKey.length !== 32) {
      throw new Error('Public key must be 32 bytes');
    }
    
    return sodium.crypto_scalarmult(privateKey, publicKey);
  }

  /**
   * Derive multiple keys from shared secret using HKDF-like construction
   * 
   * @param sharedSecret - Shared secret from key agreement
   * @param info - Context information for key derivation
   * @returns Object containing derived root key and chain key
   */
  async deriveKeys(
    sharedSecret: Uint8Array,
    info: string
  ): Promise<{
    rootKey: Uint8Array;
    chainKey: Uint8Array;
  }> {
    await this.initialize();
    
    if (sharedSecret.length !== 32) {
      throw new Error('Shared secret must be 32 bytes');
    }
    
    // Use libsodium's KDF to derive multiple keys from shared secret
    const salt = sodium.from_string('double-ratchet-salt');
    const infoBytes = sodium.from_string(info);
    
    // Create a master key using the shared secret and salt
    const masterKey = sodium.crypto_generichash(32, sharedSecret, salt);
    
    // Derive 64 bytes: 32 for root key, 32 for chain key
    const derivedKeys = sodium.crypto_kdf_derive_from_key(
      64,        // output length
      1,         // subkey id
      'RATCHET',  // context (8 bytes)
      masterKey
    );
    
    return {
      rootKey: derivedKeys.slice(0, 32),
      chainKey: derivedKeys.slice(32, 64),
    };
  }

  /**
   * Derive new root and chain keys from existing root key and DH output
   * Used during DH ratchet steps to generate new key material
   * 
   * @param rootKey - Current root key
   * @param dhOutput - Output from new DH key agreement
   * @returns New root key and chain key
   */
  async ratchetKeys(
    rootKey: Uint8Array,
    dhOutput: Uint8Array
  ): Promise<{
    newRootKey: Uint8Array;
    newChainKey: Uint8Array;
  }> {
    await this.initialize();
    
    if (rootKey.length !== 32) {
      throw new Error('Root key must be 32 bytes');
    }
    
    if (dhOutput.length !== 32) {
      throw new Error('DH output must be 32 bytes');
    }
    
    // Combine root key and DH output
    const combined = new Uint8Array(64);
    combined.set(rootKey, 0);
    combined.set(dhOutput, 32);
    
    // Use HKDF-like construction to derive new keys
    const salt = sodium.from_string('ratchet-step-salt');
    const derivationKey = sodium.crypto_generichash(32, combined, salt);
    
    // Derive new root key and chain key
    const newKeys = sodium.crypto_kdf_derive_from_key(
      64,         // output length
      2,          // subkey id (different from initial derivation)
      'NEXTRCHT',  // context for next ratchet step
      derivationKey
    );
    
    return {
      newRootKey: newKeys.slice(0, 32),
      newChainKey: newKeys.slice(32, 64),
    };
  }

  /**
   * Export key pair to base64 strings for storage/transmission
   * 
   * @param keyPair - Key pair to export
   * @returns Object with base64-encoded keys
   */
  exportKeyPair(keyPair: { publicKey: Uint8Array; privateKey: Uint8Array }): {
    publicKey: string;
    privateKey: string;
  } {
    return {
      publicKey: sodium.to_base64(keyPair.publicKey),
      privateKey: sodium.to_base64(keyPair.privateKey),
    };
  }

  /**
   * Import key pair from base64 strings
   * 
   * @param exportedKeys - Base64-encoded keys
   * @returns Key pair as Uint8Arrays
   */
  importKeyPair(exportedKeys: { publicKey: string; privateKey: string }): {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  } {
    return {
      publicKey: sodium.from_base64(exportedKeys.publicKey),
      privateKey: sodium.from_base64(exportedKeys.privateKey),
    };
  }

  /**
   * Import public key from base64 string
   * 
   * @param publicKeyBase64 - Base64-encoded public key
   * @returns Public key as Uint8Array
   */
  importPublicKey(publicKeyBase64: string): Uint8Array {
    const publicKey = sodium.from_base64(publicKeyBase64);
    if (publicKey.length !== 32) {
      throw new Error('Invalid public key length');
    }
    return publicKey;
  }

  /**
   * Export public key to base64 string
   * 
   * @param publicKey - Public key as Uint8Array
   * @returns Base64-encoded public key
   */
  exportPublicKey(publicKey: Uint8Array): string {
    if (publicKey.length !== 32) {
      throw new Error('Public key must be 32 bytes');
    }
    return sodium.to_base64(publicKey);
  }

  /**
   * Validate that a key is a valid X25519 public key
   * 
   * @param publicKey - Key to validate
   * @returns True if valid, false otherwise
   */
  validatePublicKey(publicKey: Uint8Array): boolean {
    try {
      // Check length
      if (publicKey.length !== 32) {
        return false;
      }
      
      // Check that it's not all zeros
      const allZeros = publicKey.every(byte => byte === 0);
      if (allZeros) {
        return false;
      }
      
      // Check that it's not the identity element (all zeros except last bit)
      const isIdentity = publicKey.slice(0, 31).every(byte => byte === 0) && 
                        publicKey[31] === 1;
      if (isIdentity) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Securely clear sensitive key material from memory
   * 
   * @param key - Key to clear
   */
  secureZero(key: Uint8Array): void {
    // Overwrite with random data first (generate random bytes and copy them)
    const randomBytes = sodium.randombytes_buf(key.length);
    key.set(randomBytes);
    // Then zero it
    key.fill(0);
  }

  /**
   * Generate cryptographically secure random bytes
   * 
   * @param length - Number of bytes to generate
   * @returns Random bytes
   */
  randomBytes(length: number): Uint8Array {
    // Validate input parameter
    if (!Number.isInteger(length) || length < 0) {
      console.error('X25519Service.randomBytes: length must be a non-negative integer, got:', length, typeof length);
      throw new Error('length must be an unsigned integer');
    }
    
    if (length === 0) {
      return new Uint8Array(0);
    }
    
    console.log(`🔐 X25519Service generating ${length} random bytes`);
    return sodium.randombytes_buf(length);
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the underlying libsodium instance (for advanced usage)
   */
  getSodium(): typeof sodium {
    if (!this.initialized) {
      throw new Error('X25519Service not initialized');
    }
    return sodium;
  }
}

// Export singleton instance
export const x25519Service = new X25519Service();