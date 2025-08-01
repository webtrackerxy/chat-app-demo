# Advanced Encryption for Production Implementation Plan

## Overview

This document outlines the implementation plan for adding three critical advanced encryption features to the chat application:

1. **Perfect Forward Secrecy (PFS)** - Enhanced security with ephemeral keys
2. **Post-Quantum Cryptography (PQC)** - Future-proof encryption algorithms  
3. **Multi-Device Key Sync** - Synchronize encryption keys across devices

## Current State Analysis

### Existing Implementation
- **Current Status**: Demo mode with mock encryption (base64 encoding)
- **Architecture**: RSA-2048 + AES-256-GCM (planned for production)
- **Key Management**: Static per-conversation keys
- **Storage**: Local AsyncStorage with password protection
- **Limitations**: No forward secrecy, quantum-vulnerable, single-device only

### Security Gaps Addressed
- **Key Compromise**: Current static keys compromise all past/future messages
- **Quantum Threat**: RSA-2048 vulnerable to quantum computers
- **Device Loss**: No secure way to sync keys across multiple devices
- **Scale Issues**: Key distribution doesn't scale with large groups

## Phase 1: Perfect Forward Secrecy Implementation

### 1.1 Double Ratchet Algorithm Architecture

```typescript
// Core PFS Architecture based on Signal Protocol
interface DoubleRatchetState {
  // Root chain for generating new chain keys
  rootKey: CryptoKey;
  rootChainKey: CryptoKey;
  
  // Sending chain state  
  sendingChainKey: CryptoKey;
  sendingMessageNumber: number;
  sendingChainLength: number;
  
  // Receiving chain state
  receivingChainKey: CryptoKey;
  receivingMessageNumber: number;
  receivingChainLength: number;
  
  // Ephemeral key pairs for DH ratchet
  sendingEphemeralKey: CryptoKeyPair;
  receivingEphemeralPublicKey: CryptoKey;
  
  // Skipped message keys for out-of-order delivery
  skippedMessageKeys: Map<string, CryptoKey>;
}

class DoubleRatchetService {
  private ratchetStates: Map<string, DoubleRatchetState> = new Map();
  
  // Initialize ratchet for new conversation
  async initializeRatchet(
    conversationId: string,
    sharedSecret: ArrayBuffer,
    receiverPublicKey?: CryptoKey
  ): Promise<void> {
    const rootKey = await this.deriveRootKey(sharedSecret);
    const sendingEphemeral = await this.generateEphemeralKeyPair();
    
    const state: DoubleRatchetState = {
      rootKey,
      rootChainKey: rootKey,
      sendingChainKey: await this.deriveChainKey(rootKey, 'sending'),
      receivingChainKey: await this.deriveChainKey(rootKey, 'receiving'),
      sendingMessageNumber: 0,
      receivingMessageNumber: 0,
      sendingChainLength: 0,
      receivingChainLength: 0,
      sendingEphemeralKey: sendingEphemeral,
      receivingEphemeralPublicKey: receiverPublicKey,
      skippedMessageKeys: new Map(),
    };
    
    this.ratchetStates.set(conversationId, state);
  }
  
  // Encrypt message with forward secrecy
  async encryptMessage(
    conversationId: string,
    plaintext: string
  ): Promise<RatchetEncryptedMessage> {
    const state = this.ratchetStates.get(conversationId);
    if (!state) throw new Error('Ratchet not initialized');
    
    // Derive message key from current chain key
    const messageKey = await this.deriveMessageKey(
      state.sendingChainKey,
      state.sendingMessageNumber
    );
    
    // Encrypt message
    const encryptedData = await this.encryptWithMessageKey(plaintext, messageKey);
    
    // Advance sending chain
    state.sendingChainKey = await this.advanceChainKey(state.sendingChainKey);
    state.sendingMessageNumber++;
    
    // Perform DH ratchet step periodically
    if (state.sendingMessageNumber % this.RATCHET_STEP_INTERVAL === 0) {
      await this.performDHRatchetStep(conversationId);
    }
    
    return {
      encryptedData,
      ephemeralPublicKey: await crypto.subtle.exportKey(
        'raw',
        state.sendingEphemeralKey.publicKey
      ),
      messageNumber: state.sendingMessageNumber - 1,
      chainLength: state.sendingChainLength,
    };
  }
  
  // Decrypt message with forward secrecy
  async decryptMessage(
    conversationId: string,
    encryptedMessage: RatchetEncryptedMessage
  ): Promise<string> {
    const state = this.ratchetStates.get(conversationId);
    if (!state) throw new Error('Ratchet not initialized');
    
    // Check for out-of-order messages
    const messageKeyId = `${encryptedMessage.chainLength}-${encryptedMessage.messageNumber}`;
    let messageKey = state.skippedMessageKeys.get(messageKeyId);
    
    if (!messageKey) {
      // Skip messages to reach this one
      messageKey = await this.skipToMessage(
        state,
        encryptedMessage.messageNumber
      );
    }
    
    // Decrypt message
    const plaintext = await this.decryptWithMessageKey(
      encryptedMessage.encryptedData,
      messageKey
    );
    
    // Clean up used message key
    state.skippedMessageKeys.delete(messageKeyId);
    
    return plaintext;
  }
  
  private readonly RATCHET_STEP_INTERVAL = 100; // Messages between DH steps
  private readonly MAX_SKIP = 1000; // Maximum message skip for out-of-order
}
```

### 1.2 Ephemeral Key Management

```typescript
interface EphemeralKeyManager {
  // Generate X25519 ephemeral key pairs
  generateEphemeralKeyPair(): Promise<CryptoKeyPair>;
  
  // Perform ECDH key agreement
  performKeyAgreement(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer>;
  
  // Derive keys using HKDF
  deriveKeys(sharedSecret: ArrayBuffer, info: string): Promise<{
    rootKey: CryptoKey;
    chainKey: CryptoKey;
  }>;
  
  // Secure key deletion
  secureDeleteKey(key: CryptoKey): Promise<void>;
}

class X25519EphemeralKeyManager implements EphemeralKeyManager {
  async generateEphemeralKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: 'X25519',
      },
      true, // extractable for export
      ['deriveKey']
    );
  }
  
  async performKeyAgreement(
    privateKey: CryptoKey,
    publicKey: CryptoKey
  ): Promise<ArrayBuffer> {
    const sharedKey = await crypto.subtle.deriveKey(
      {
        name: 'X25519',
        public: publicKey,
      },
      privateKey,
      {
        name: 'HKDF',
        hash: 'SHA-256',
      },
      false,
      ['deriveKey']
    );
    
    return await crypto.subtle.exportKey('raw', sharedKey);
  }
  
  async deriveKeys(sharedSecret: ArrayBuffer, info: string): Promise<{
    rootKey: CryptoKey;
    chainKey: CryptoKey;
  }> {
    const hkdf = await crypto.subtle.importKey(
      'raw',
      sharedSecret,
      'HKDF',
      false,
      ['deriveKey']
    );
    
    const rootKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode('root-key-salt'),
        info: new TextEncoder().encode(`${info}-root`),
      },
      hkdf,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
    
    const chainKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode('chain-key-salt'),
        info: new TextEncoder().encode(`${info}-chain`),
      },
      hkdf,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt']
    );
    
    return { rootKey, chainKey };
  }
}
```

### 1.3 Database Schema Extensions for PFS

```sql
-- Ratchet state storage
CREATE TABLE conversation_ratchet_states (
    id UUID PRIMARY KEY,
    conversation_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    root_key_encrypted TEXT NOT NULL,
    sending_chain_key_encrypted TEXT NOT NULL,
    receiving_chain_key_encrypted TEXT NOT NULL,
    sending_message_number INTEGER DEFAULT 0,
    receiving_message_number INTEGER DEFAULT 0,
    sending_chain_length INTEGER DEFAULT 0,
    receiving_chain_length INTEGER DEFAULT 0,
    sending_ephemeral_private_key TEXT,
    receiving_ephemeral_public_key TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(conversation_id, user_id)
);

-- Skipped message keys for out-of-order delivery
CREATE TABLE skipped_message_keys (
    id UUID PRIMARY KEY,
    ratchet_state_id UUID REFERENCES conversation_ratchet_states(id),
    message_key_id VARCHAR(255) NOT NULL,
    encrypted_key TEXT NOT NULL,
    chain_length INTEGER NOT NULL,
    message_number INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    INDEX(ratchet_state_id, message_key_id)
);

-- Enhanced message table for PFS
ALTER TABLE messages ADD COLUMN ratchet_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN ephemeral_public_key TEXT;
ALTER TABLE messages ADD COLUMN message_number INTEGER;
ALTER TABLE messages ADD COLUMN chain_length INTEGER;
```

## Phase 2: Post-Quantum Cryptography Integration

### 2.1 Hybrid Cryptographic Architecture

```typescript
// Hybrid PQC + Classical Implementation
interface HybridKeyPair {
  classical: {
    rsa: CryptoKeyPair;      // RSA-2048 for backward compatibility
    ecdh: CryptoKeyPair;     // X25519 for key agreement
  };
  postQuantum: {
    kyber: KyberKeyPair;     // Kyber-768 for key encapsulation
    dilithium: DilithiumKeyPair; // Dilithium-3 for signatures
  };
}

class HybridEncryptionService {
  // Generate hybrid key pair (classical + post-quantum)
  async generateHybridKeyPair(): Promise<HybridKeyPair> {
    const [rsaKeyPair, ecdhKeyPair, kyberKeyPair, dilithiumKeyPair] = await Promise.all([
      crypto.subtle.generateKey(
        {
          name: 'RSA-OAEP',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256',
        },
        true,
        ['encrypt', 'decrypt']
      ),
      crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveKey']),
      this.kyberService.generateKeyPair(),
      this.dilithiumService.generateKeyPair(),
    ]);
    
    return {
      classical: {
        rsa: rsaKeyPair,
        ecdh: ecdhKeyPair,
      },
      postQuantum: {
        kyber: kyberKeyPair,
        dilithium: dilithiumKeyPair,
      },
    };
  }
  
  // Hybrid key encapsulation (classical + PQC)
  async hybridKeyEncapsulation(
    recipientPublicKeys: HybridPublicKeys
  ): Promise<{
    encapsulatedKey: ArrayBuffer;
    sharedSecret: ArrayBuffer;
  }> {
    // Classical key agreement with X25519
    const ephemeralECDH = await crypto.subtle.generateKey(
      { name: 'X25519' },
      true,
      ['deriveKey']
    );
    
    const classicalShared = await crypto.subtle.deriveKey(
      {
        name: 'X25519',
        public: recipientPublicKeys.classical.ecdh,
      },
      ephemeralECDH.privateKey,
      { name: 'HKDF', hash: 'SHA-256' },
      true,
      ['deriveKey']
    );
    
    // Post-quantum key encapsulation with Kyber
    const kyberResult = await this.kyberService.encapsulate(
      recipientPublicKeys.postQuantum.kyber
    );
    
    // Combine classical and post-quantum secrets
    const combinedSecret = await this.combineSecrets(
      await crypto.subtle.exportKey('raw', classicalShared),
      kyberResult.sharedSecret
    );
    
    return {
      encapsulatedKey: this.encodeHybridCiphertext({
        ephemeralPublicKey: await crypto.subtle.exportKey('raw', ephemeralECDH.publicKey),
        kyberCiphertext: kyberResult.ciphertext,
      }),
      sharedSecret: combinedSecret,
    };
  }
  
  // Hybrid key decapsulation  
  async hybridKeyDecapsulation(
    encapsulatedKey: ArrayBuffer,
    recipientPrivateKeys: HybridPrivateKeys
  ): Promise<ArrayBuffer> {
    const hybridCiphertext = this.decodeHybridCiphertext(encapsulatedKey);
    
    // Classical key agreement
    const ephemeralPublicKey = await crypto.subtle.importKey(
      'raw',
      hybridCiphertext.ephemeralPublicKey,
      { name: 'X25519' },
      false,
      []
    );
    
    const classicalShared = await crypto.subtle.deriveKey(
      {
        name: 'X25519',
        public: ephemeralPublicKey,
      },
      recipientPrivateKeys.classical.ecdh,
      { name: 'HKDF', hash: 'SHA-256' },
      true,
      ['deriveKey']
    );
    
    // Post-quantum decapsulation
    const kyberShared = await this.kyberService.decapsulate(
      hybridCiphertext.kyberCiphertext,
      recipientPrivateKeys.postQuantum.kyber
    );
    
    // Combine secrets
    return await this.combineSecrets(
      await crypto.subtle.exportKey('raw', classicalShared),
      kyberShared
    );
  }
  
  // Secure secret combination using HKDF
  private async combineSecrets(
    classicalSecret: ArrayBuffer,
    postQuantumSecret: ArrayBuffer
  ): Promise<ArrayBuffer> {
    const combined = new Uint8Array(classicalSecret.byteLength + postQuantumSecret.byteLength);
    combined.set(new Uint8Array(classicalSecret), 0);
    combined.set(new Uint8Array(postQuantumSecret), classicalSecret.byteLength);
    
    const hkdf = await crypto.subtle.importKey(
      'raw',
      combined,
      'HKDF',
      false,
      ['deriveKey']
    );
    
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode('hybrid-key-combination'),
        info: new TextEncoder().encode('pqc-classical-hybrid'),
      },
      hkdf,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    return await crypto.subtle.exportKey('raw', derivedKey);
  }
}
```

### 2.2 NIST PQC Algorithm Integration

```typescript
// Kyber Key Encapsulation Mechanism
interface KyberService {
  generateKeyPair(): Promise<KyberKeyPair>;
  encapsulate(publicKey: KyberPublicKey): Promise<{
    ciphertext: ArrayBuffer;
    sharedSecret: ArrayBuffer;
  }>;
  decapsulate(ciphertext: ArrayBuffer, privateKey: KyberPrivateKey): Promise<ArrayBuffer>;
}

// Dilithium Digital Signature Algorithm
interface DilithiumService {
  generateKeyPair(): Promise<DilithiumKeyPair>;
  sign(message: ArrayBuffer, privateKey: DilithiumPrivateKey): Promise<ArrayBuffer>;
  verify(
    signature: ArrayBuffer,
    message: ArrayBuffer,
    publicKey: DilithiumPublicKey
  ): Promise<boolean>;
}

class NISTPostQuantumService {
  private kyber: KyberService;
  private dilithium: DilithiumService;
  
  constructor() {
    // Initialize with WebAssembly implementations of NIST algorithms
    this.kyber = new WebAssemblyKyberService();
    this.dilithium = new WebAssemblyDilithiumService();
  }
  
  // Migration strategy: gradual rollout with feature flags
  async shouldUsePQC(userId: string): Promise<boolean> {
    // Check user preferences and system capabilities
    const userPrefs = await this.getUserPreferences(userId);
    const systemSupport = await this.checkPQCSupport();
    
    return userPrefs.enablePQC && systemSupport;
  }
  
  // Backward compatibility with classical algorithms
  async createCompatibleMessage(
    plaintext: string,
    recipientCapabilities: CryptoCapabilities
  ): Promise<EncryptedMessage> {
    if (recipientCapabilities.supportsPQC) {
      return await this.hybridEncrypt(plaintext, recipientCapabilities.hybridKeys);
    } else {
      return await this.classicalEncrypt(plaintext, recipientCapabilities.classicalKeys);
    }
  }
}
```

### 2.3 Algorithm Migration Strategy

```typescript
interface CryptoMigrationManager {
  // Detect algorithm support across devices
  detectAlgorithmSupport(deviceId: string): Promise<SupportedAlgorithms>;
  
  // Migrate keys gradually
  migrateUserKeys(userId: string, fromAlgorithm: string, toAlgorithm: string): Promise<void>;
  
  // Handle mixed-capability conversations
  negotiateConversationCrypto(participantCapabilities: CryptoCapabilities[]): Promise<CryptoConfig>;
}

interface SupportedAlgorithms {
  classical: {
    rsa2048: boolean;
    x25519: boolean;
    aesGcm: boolean;
  };
  postQuantum: {
    kyber768: boolean;
    dilithium3: boolean;
    falcon512: boolean; // Alternative to Dilithium
  };
  hybrid: boolean;
}

// Progressive enhancement approach
class AlgorithmNegotiationService {
  async negotiateBestAlgorithms(
    participantCapabilities: SupportedAlgorithms[]
  ): Promise<CryptoConfig> {
    // Find common supported algorithms
    const commonSupport = this.findCommonSupport(participantCapabilities);
    
    // Prefer post-quantum when available
    if (commonSupport.postQuantum.kyber768) {
      return {
        keyEncapsulation: 'hybrid-kyber-x25519',
        signature: 'hybrid-dilithium-ecdsa',
        encryption: 'aes-256-gcm',
        forwardSecrecy: true,
      };
    }
    
    // Fallback to classical with forward secrecy
    return {
      keyEncapsulation: 'x25519',
      signature: 'ecdsa-p256',
      encryption: 'aes-256-gcm',
      forwardSecrecy: true,
    };
  }
}
```

## Phase 3: Multi-Device Key Synchronization

### 3.1 Device Management Architecture

```typescript
interface DeviceRegistrationService {
  // Register new device with verification
  registerDevice(userId: string, deviceInfo: DeviceInfo): Promise<DeviceRegistration>;
  
  // Verify device ownership through challenge-response
  verifyDeviceOwnership(deviceId: string, challenge: ArrayBuffer): Promise<boolean>;
  
  // Revoke compromised devices
  revokeDevice(userId: string, deviceId: string): Promise<void>;
  
  // List user's registered devices
  getUserDevices(userId: string): Promise<RegisteredDevice[]>;
}

interface DeviceInfo {
  deviceId: string;
  platform: 'ios' | 'android' | 'web' | 'desktop';
  appVersion: string;
  publicKey: CryptoKey;
  attestation?: DeviceAttestation; // Hardware attestation when available
}

interface RegisteredDevice {
  deviceId: string;
  platform: string;
  registeredAt: Date;
  lastSeen: Date;
  verified: boolean;
  trustLevel: 'unverified' | 'verified' | 'trusted';
  capabilities: SupportedAlgorithms;
}

class DeviceRegistrationService {
  async registerDevice(userId: string, deviceInfo: DeviceInfo): Promise<DeviceRegistration> {
    // Generate device-specific key pair
    const deviceKeyPair = await crypto.subtle.generateKey(
      { name: 'X25519' },
      true,
      ['deriveKey']
    );
    
    // Create device identity certificate
    const certificate = await this.createDeviceCertificate(deviceInfo, deviceKeyPair);
    
    // Store device registration
    const registration: DeviceRegistration = {
      deviceId: deviceInfo.deviceId,
      userId,
      publicKey: await crypto.subtle.exportKey('raw', deviceKeyPair.publicKey),
      certificate,
      status: 'pending_verification',
      registeredAt: new Date(),
    };
    
    await this.storage.storeDeviceRegistration(registration);
    
    // Initiate verification process
    await this.initiateDeviceVerification(registration);
    
    return registration;
  }
  
  // Cross-device verification using existing verified device
  async verifyNewDevice(
    existingDeviceId: string,
    newDeviceId: string
  ): Promise<boolean> {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    
    // Send challenge to new device
    await this.sendVerificationChallenge(newDeviceId, challenge);
    
    // Get response from new device
    const response = await this.waitForChallengeResponse(newDeviceId);
    
    // Verify using existing device's keys
    return await this.verifyChallengeResponse(existingDeviceId, challenge, response);
  }
}
```

### 3.2 Key Synchronization Protocol

```typescript
interface KeySyncService {
  // Sync keys to newly registered device
  syncKeysToDevice(userId: string, targetDeviceId: string): Promise<void>;
  
  // Handle key updates across all devices
  broadcastKeyUpdate(userId: string, keyUpdate: KeyUpdate): Promise<void>;
  
  // Resolve key conflicts between devices
  resolveKeyConflicts(userId: string, conflicts: KeyConflict[]): Promise<void>;
}

interface KeySyncProtocol {
  // Establish secure channel between devices
  establishSecureChannel(deviceA: string, deviceB: string): Promise<SecureChannel>;
  
  // Encrypted key transfer
  transferKeys(channel: SecureChannel, keys: EncryptedKeyBundle): Promise<void>;
  
  // Verify key integrity after transfer
  verifyKeyIntegrity(originalKeys: KeyBundle, receivedKeys: KeyBundle): Promise<boolean>;
}

class SecureKeySyncService implements KeySyncService {
  async syncKeysToDevice(userId: string, targetDeviceId: string): Promise<void> {
    // Get user's master keys
    const masterKeys = await this.getMasterKeys(userId);
    
    // Get target device public key
    const targetDevice = await this.deviceRegistry.getDevice(targetDeviceId);
    
    // Encrypt keys for target device
    const encryptedKeyBundle = await this.encryptKeysForDevice(
      masterKeys,
      targetDevice.publicKey
    );
    
    // Send encrypted bundle through secure channel
    await this.sendEncryptedKeyBundle(targetDeviceId, encryptedKeyBundle);
    
    // Wait for confirmation
    await this.waitForSyncConfirmation(targetDeviceId);
  }
  
  async encryptKeysForDevice(
    keyBundle: KeyBundle,
    devicePublicKey: CryptoKey
  ): Promise<EncryptedKeyBundle> {
    // Generate ephemeral key for this sync session
    const ephemeralKeyPair = await crypto.subtle.generateKey(
      { name: 'X25519' },
      true,
      ['deriveKey']
    );
    
    // Derive shared secret with target device
    const sharedSecret = await crypto.subtle.deriveKey(
      {
        name: 'X25519',
        public: devicePublicKey,
      },
      ephemeralKeyPair.privateKey,
      { name: 'HKDF', hash: 'SHA-256' },
      false,
      ['deriveKey']
    );
    
    // Derive encryption key from shared secret
    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new TextEncoder().encode('key-sync-salt'),
        info: new TextEncoder().encode('device-key-transfer'),
      },
      sharedSecret,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Encrypt key bundle
    const serializedKeys = JSON.stringify(keyBundle);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      new TextEncoder().encode(serializedKeys)
    );
    
    return {
      ephemeralPublicKey: await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey),
      encryptedData: new Uint8Array(encryptedData),
      iv,
      timestamp: Date.now(),
    };
  }
}
```

### 3.3 Backup and Recovery System

```typescript
interface KeyBackupService {
  // Create encrypted backup of user's keys
  createKeyBackup(userId: string, recoveryPassword: string): Promise<EncryptedBackup>;
  
  // Restore keys from backup
  restoreFromBackup(backup: EncryptedBackup, recoveryPassword: string): Promise<KeyBundle>;
  
  // Secure cloud storage integration
  uploadBackupToCloud(backup: EncryptedBackup): Promise<BackupHandle>;
  downloadBackupFromCloud(handle: BackupHandle): Promise<EncryptedBackup>;
}

interface EncryptedBackup {
  version: string;
  timestamp: Date;
  encryptedData: ArrayBuffer;
  salt: ArrayBuffer;
  keyDerivationInfo: {
    algorithm: 'PBKDF2';
    iterations: number;
    hash: 'SHA-256';
  };
  integrity: {
    algorithm: 'HMAC-SHA-256';
    tag: ArrayBuffer;
  };
}

class SecureKeyBackupService implements KeyBackupService {
  async createKeyBackup(userId: string, recoveryPassword: string): Promise<EncryptedBackup> {
    // Get all user keys
    const keyBundle = await this.getAllUserKeys(userId);
    
    // Generate salt for key derivation
    const salt = crypto.getRandomValues(new Uint8Array(32));
    
    // Derive encryption key from password
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(recoveryPassword),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    const encryptionKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Encrypt key bundle
    const serializedKeys = JSON.stringify(keyBundle);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      new TextEncoder().encode(serializedKeys)
    );
    
    // Create HMAC for integrity verification
    const hmacKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const integrityTag = await crypto.subtle.sign(
      'HMAC',
      hmacKey,
      encryptedData
    );
    
    return {
      version: '1.0',
      timestamp: new Date(),
      encryptedData,
      salt,
      keyDerivationInfo: {
        algorithm: 'PBKDF2',
        iterations: 100000,
        hash: 'SHA-256',
      },
      integrity: {
        algorithm: 'HMAC-SHA-256',
        tag: integrityTag,
      },
    };
  }
  
  // Distributed backup across multiple cloud providers
  async createDistributedBackup(
    backup: EncryptedBackup
  ): Promise<DistributedBackupHandles> {
    // Split backup using Shamir's Secret Sharing (3-of-5 threshold)
    const shares = await this.createSecretShares(backup.encryptedData, 5, 3);
    
    // Upload shares to different cloud providers
    const handles = await Promise.all([
      this.uploadToProvider('aws-s3', shares[0]),
      this.uploadToProvider('google-cloud', shares[1]),
      this.uploadToProvider('azure-blob', shares[2]),
      this.uploadToProvider('dropbox', shares[3]),
      this.uploadToProvider('icloud', shares[4]),
    ]);
    
    return {
      threshold: 3,
      totalShares: 5,
      handles,
      metadata: {
        timestamp: backup.timestamp,
        version: backup.version,
      },
    };
  }
}
```

## Implementation Timeline & Dependencies

### Phase 1: Perfect Forward Secrecy (4-5 weeks)

**Week 1-2: Core PFS Implementation**
- Implement Double Ratchet algorithm
- Create ephemeral key management
- Add X25519 key agreement

**Week 3-4: Integration & Storage**
- Database schema updates
- Message encryption/decryption with PFS
- Ratchet state persistence

**Week 5: Testing & Optimization**
- Unit tests for all PFS components
- Performance optimization
- Security audit

### Phase 2: Post-Quantum Cryptography (5-6 weeks)

**Week 1-2: NIST Algorithm Integration**
- WebAssembly Kyber implementation
- WebAssembly Dilithium implementation
- Hybrid key generation

**Week 3-4: Hybrid Encryption Protocol**
- Classical + PQC key combination
- Backward compatibility layer
- Algorithm negotiation

**Week 5-6: Migration & Testing**
- Gradual rollout strategy
- Compatibility testing
- Performance benchmarks

### Phase 3: Multi-Device Key Sync (3-4 weeks)

**Week 1-2: Device Management**
- Device registration protocol
- Cross-device verification  
- Key synchronization service

**Week 3-4: Backup & Recovery**
- Encrypted key backup system
- Distributed backup storage
- Recovery workflows

## Security Considerations

### Threat Model
- **State-level adversaries** with quantum computers
- **Device compromise** scenarios
- **Network surveillance** and MITM attacks
- **Cloud provider compromise**
- **Social engineering** attacks on recovery systems

### Security Properties Achieved
- **Forward secrecy**: Compromised keys don't decrypt past messages
- **Quantum resistance**: Protection against quantum computer attacks
- **Multi-device security**: Secure key sync without single points of failure
- **Recovery capability**: Secure backup without weakening encryption
- **Backward compatibility**: Gradual migration without breaking existing users

### Security Audit Requirements
- **Cryptographic implementation review**
- **Protocol security analysis**  
- **Side-channel attack resistance**
- **Key management security**
- **Backup system security**

## Dependencies & Requirements

### Cryptographic Libraries
```json
{
  "frontend": {
    "libsodium-wrappers": "^0.7.11",
    "pqc-kyber": "^1.0.0", 
    "pqc-dilithium": "^1.0.0",
    "react-native-keychain": "^8.1.0",
    "react-native-secure-storage": "^1.0.0"
  },
  "backend": {
    "node-forge": "^1.3.1",
    "libsodium-wrappers": "^0.7.11",
    "kyber-crystals": "^1.0.0",
    "dilithium-crystals": "^1.0.0"
  }
}
```

### Infrastructure Requirements
- **Hardware Security Modules** for key protection
- **Secure cloud storage** for distributed backups
- **Certificate Authority** for device verification
- **Monitoring infrastructure** for security alerts

This comprehensive plan addresses all three advanced encryption features with detailed technical specifications, implementation timelines, and security considerations for production deployment.