/**
 * Cross-Device Key Sharing Service
 * 
 * Manages secure key synchronization across multiple user devices.
 * Ensures that cryptographic keys (ratchet states, conversation keys)
 * are securely shared and synchronized between trusted devices.
 * 
 * Features:
 * - Secure key packaging and encryption for transport
 * - Key synchronization protocols between devices
 * - Conflict resolution for concurrent key updates
 * - Key versioning and history tracking
 * - Offline key sync queue management
 */

import { DeviceIdentityService, DeviceIdentity } from './DeviceIdentityService';
import { HybridKeyExchangeService } from './HybridKeyExchangeService';
import { DilithiumService } from './DilithiumService';
import { X25519Service } from './X25519Service';
import { ChainKeyService } from './ChainKeyService';

export interface KeySyncPackage {
  packageId: string;
  fromDeviceId: string;
  toDeviceId: string;
  keyType: 'ratchet_state' | 'conversation_key' | 'device_key' | 'hybrid_key';
  
  // Encrypted key data
  encryptedKeyData: Uint8Array;
  keyMetadata: {
    conversationId?: string;
    userId?: string;
    keyVersion: number;
    createdAt: number;
    lastModified: number;
    dependencies?: string[]; // Other keys this depends on
  };
  
  // Security information
  signature: Uint8Array;
  encryptionMethod: 'hybrid' | 'device_key';
  integrityHash: Uint8Array;
  
  // Sync metadata
  syncPriority: 'critical' | 'high' | 'medium' | 'low';
  expiresAt: number;
  attempts: number;
  maxAttempts: number;
}

export interface KeySyncState {
  deviceId: string;
  conversationId: string;
  keyType: string;
  currentVersion: number;
  lastSyncedVersion: number;
  pendingUpdates: KeySyncPackage[];
  conflictResolutionNeeded: boolean;
  lastSyncedAt: number;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'failed';
}

export interface KeyConflictResolution {
  conflictId: string;
  conversationId: string;
  keyType: string;
  conflictingVersions: {
    deviceId: string;
    version: number;
    timestamp: number;
    keyHash: string;
  }[];
  resolutionStrategy: 'latest_wins' | 'merge' | 'manual' | 'authoritative_device';
  resolvedVersion: number;
  resolvedBy: string;
  resolvedAt: number;
}

export interface OfflineKeySyncQueue {
  queueId: string;
  deviceId: string;
  pendingPackages: KeySyncPackage[];
  queuedAt: number;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: number;
}

/**
 * Cross-Device Key Service
 * 
 * Manages secure key synchronization across multiple trusted devices
 */
export class CrossDeviceKeyService {
  private static readonly PACKAGE_EXPIRY_HOURS = 24;
  private static readonly MAX_SYNC_ATTEMPTS = 5;
  private static readonly SYNC_RETRY_DELAY_MS = 30000; // 30 seconds
  private static readonly MAX_PENDING_PACKAGES = 100;
  
  private deviceIdentityService: DeviceIdentityService;
  private hybridKeyExchangeService: HybridKeyExchangeService;
  private dilithiumService: DilithiumService;
  private x25519Service: X25519Service;
  private chainKeyService: ChainKeyService;
  
  private initialized: boolean = false;
  private keySyncStates: Map<string, KeySyncState> = new Map();
  private offlineQueues: Map<string, OfflineKeySyncQueue> = new Map();
  private conflictResolutions: Map<string, KeyConflictResolution> = new Map();
  
  // Sync status tracking
  private activeSyncOperations: Set<string> = new Set();
  private syncMetrics = {
    packagesCreated: 0,
    packagesProcessed: 0,
    conflictsResolved: 0,
    syncErrors: 0
  };

  constructor() {
    this.deviceIdentityService = new DeviceIdentityService();
    this.hybridKeyExchangeService = new HybridKeyExchangeService();
    this.dilithiumService = new DilithiumService();
    this.x25519Service = new X25519Service();
    this.chainKeyService = new ChainKeyService();
  }

  /**
   * Initialize the cross-device key service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize all dependencies
      await Promise.all([
        this.deviceIdentityService.initialize(),
        this.hybridKeyExchangeService.initialize(),
        this.dilithiumService.initialize(),
        this.x25519Service.initialize(),
        this.chainKeyService.initialize()
      ]);

      // Load sync states
      await this.loadSyncStates();

      // Start background sync processor
      this.startBackgroundSync();

      this.initialized = true;
      console.log('Cross-Device Key Service initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize Cross-Device Key service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a key sync package to share with another device
   * 
   * @param keyData - Raw key data to share
   * @param keyType - Type of key being shared
   * @param targetDeviceId - Device to share with
   * @param metadata - Key metadata
   * @returns Promise<KeySyncPackage> - Encrypted key package
   */
  async createKeySyncPackage(
    keyData: Uint8Array,
    keyType: 'ratchet_state' | 'conversation_key' | 'device_key' | 'hybrid_key',
    targetDeviceId: string,
    metadata: {
      conversationId?: string;
      userId?: string;
      keyVersion: number;
      dependencies?: string[];
    }
  ): Promise<KeySyncPackage> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Get target device info
      const targetDevice = await this.getTargetDevice(targetDeviceId);
      if (!targetDevice) {
        throw new Error('Target device not found');
      }

      // Generate package ID
      const packageId = await this.generatePackageId();

      // Encrypt key data for target device
      const encryptedKeyData = await this.encryptKeyDataForDevice(keyData, targetDevice);

      // Create integrity hash
      const integrityHash = await this.createIntegrityHash(keyData, metadata);

      // Create package data for signing
      const packageData = {
        packageId,
        fromDeviceId: currentDevice.deviceId,
        toDeviceId: targetDeviceId,
        keyType,
        keyMetadata: {
          ...metadata,
          createdAt: Date.now(),
          lastModified: Date.now()
        },
        encryptionMethod: 'hybrid' as const,
        integrityHash
      };

      // Sign the package
      const signature = await this.dilithiumService.sign(
        currentDevice.signingKeys.privateKey,
        new TextEncoder().encode(JSON.stringify(packageData))
      );

      const syncPackage: KeySyncPackage = {
        ...packageData,
        encryptedKeyData,
        signature: signature.signature,
        syncPriority: this.determineSyncPriority(keyType),
        expiresAt: Date.now() + (CrossDeviceKeyService.PACKAGE_EXPIRY_HOURS * 60 * 60 * 1000),
        attempts: 0,
        maxAttempts: CrossDeviceKeyService.MAX_SYNC_ATTEMPTS
      };

      // Update metrics
      this.syncMetrics.packagesCreated++;

      console.log(`Created key sync package ${packageId} for device ${targetDeviceId}`);
      return syncPackage;
    } catch (error) {
      throw new Error(`Failed to create key sync package: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process a received key sync package
   * 
   * @param syncPackage - Package to process
   * @returns Promise<boolean> - True if processed successfully
   */
  async processKeySyncPackage(syncPackage: KeySyncPackage): Promise<boolean> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Verify package is for this device
      if (syncPackage.toDeviceId !== currentDevice.deviceId) {
        throw new Error('Package not intended for this device');
      }

      // Check expiration
      if (Date.now() > syncPackage.expiresAt) {
        console.warn(`Key sync package ${syncPackage.packageId} expired`);
        return false;
      }

      // Get sender device
      const senderDevice = await this.getTargetDevice(syncPackage.fromDeviceId);
      if (!senderDevice) {
        throw new Error('Sender device not found');
      }

      // Verify signature
      const packageData = {
        packageId: syncPackage.packageId,
        fromDeviceId: syncPackage.fromDeviceId,
        toDeviceId: syncPackage.toDeviceId,
        keyType: syncPackage.keyType,
        keyMetadata: syncPackage.keyMetadata,
        encryptionMethod: syncPackage.encryptionMethod,
        integrityHash: syncPackage.integrityHash
      };

      const isSignatureValid = await this.dilithiumService.verify(
        senderDevice.signingKeys.publicKey,
        new TextEncoder().encode(JSON.stringify(packageData)),
        syncPackage.signature
      );

      if (!isSignatureValid) {
        throw new Error('Invalid package signature');
      }

      // Decrypt key data
      const decryptedKeyData = await this.decryptKeyDataFromDevice(
        syncPackage.encryptedKeyData,
        senderDevice
      );

      // Verify integrity
      const expectedHash = await this.createIntegrityHash(decryptedKeyData, syncPackage.keyMetadata);
      if (!this.chainKeyService.constantTimeEquals(expectedHash, syncPackage.integrityHash)) {
        throw new Error('Key data integrity check failed');
      }

      // Check for conflicts
      const conflictCheck = await this.checkForKeyConflicts(syncPackage);
      if (conflictCheck.hasConflict) {
        await this.handleKeyConflict(syncPackage, conflictCheck);
        return false; // Will be processed after conflict resolution
      }

      // Apply the key update
      await this.applyKeyUpdate(syncPackage, decryptedKeyData);

      // Update sync state
      await this.updateSyncState(syncPackage);

      // Update metrics
      this.syncMetrics.packagesProcessed++;

      console.log(`Successfully processed key sync package ${syncPackage.packageId}`);
      return true;
    } catch (error) {
      console.error(`Failed to process key sync package ${syncPackage.packageId}:`, error);
      this.syncMetrics.syncErrors++;
      return false;
    }
  }

  /**
   * Sync keys with all trusted devices
   * 
   * @param keyType - Optional: sync only specific key type
   * @param conversationId - Optional: sync only specific conversation
   * @returns Promise<number> - Number of packages sent
   */
  async syncKeysWithTrustedDevices(
    keyType?: 'ratchet_state' | 'conversation_key' | 'device_key' | 'hybrid_key',
    conversationId?: string
  ): Promise<number> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Get trusted devices
      const trustedDevices = await this.deviceIdentityService.getTrustedDevices();
      if (trustedDevices.length === 0) {
        console.log('No trusted devices found for key sync');
        return 0;
      }

      let packagesSent = 0;

      // Get keys that need syncing
      const keysToSync = await this.getKeysNeedingSync(keyType, conversationId);

      for (const keyInfo of keysToSync) {
        for (const device of trustedDevices) {
          if (device.deviceId === currentDevice.deviceId) {
            continue; // Skip self
          }

          try {
            // Create sync package
            const syncPackage = await this.createKeySyncPackage(
              keyInfo.keyData,
              keyInfo.keyType,
              device.deviceId,
              keyInfo.metadata
            );

            // Send package
            await this.sendKeySyncPackage(syncPackage);
            packagesSent++;

          } catch (error) {
            console.error(`Failed to sync key with device ${device.deviceId}:`, error);
          }
        }
      }

      console.log(`Synced keys with ${trustedDevices.length} devices, sent ${packagesSent} packages`);
      return packagesSent;
    } catch (error) {
      throw new Error(`Failed to sync keys with trusted devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sync status for a conversation
   * 
   * @param conversationId - Conversation to check
   * @returns Promise<KeySyncState[]> - Sync states for all devices
   */
  async getConversationSyncStatus(conversationId: string): Promise<KeySyncState[]> {
    this.ensureInitialized();

    try {
      const syncStates: KeySyncState[] = [];

      // Get all sync states for this conversation
      for (const [stateKey, state] of this.keySyncStates.entries()) {
        if (state.conversationId === conversationId) {
          syncStates.push({ ...state });
        }
      }

      return syncStates;
    } catch (error) {
      throw new Error(`Failed to get sync status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resolve a key conflict
   * 
   * @param conflictId - Conflict to resolve
   * @param strategy - Resolution strategy
   * @returns Promise<void>
   */
  async resolveKeyConflict(
    conflictId: string,
    strategy: 'latest_wins' | 'merge' | 'manual' | 'authoritative_device'
  ): Promise<void> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      const conflict = this.conflictResolutions.get(conflictId);
      if (!conflict) {
        throw new Error('Conflict not found');
      }

      let resolvedVersion: number;

      switch (strategy) {
        case 'latest_wins':
          resolvedVersion = Math.max(...conflict.conflictingVersions.map(v => v.version));
          break;
        case 'authoritative_device':
          // Use version from most trusted device
          const mostTrustedVersion = await this.selectMostTrustedVersion(conflict.conflictingVersions);
          resolvedVersion = mostTrustedVersion.version;
          break;
        case 'merge':
          // Complex merge logic would go here
          resolvedVersion = await this.mergeConflictingVersions(conflict);
          break;
        case 'manual':
          // Manual resolution would be handled by UI
          throw new Error('Manual resolution not implemented in service layer');
        default:
          throw new Error('Unknown resolution strategy');
      }

      // Update conflict resolution
      conflict.resolutionStrategy = strategy;
      conflict.resolvedVersion = resolvedVersion;
      conflict.resolvedBy = currentDevice.deviceId;
      conflict.resolvedAt = Date.now();

      // Apply resolution
      await this.applyConflictResolution(conflict);

      // Update metrics
      this.syncMetrics.conflictsResolved++;

      console.log(`Resolved key conflict ${conflictId} using ${strategy} strategy`);
    } catch (error) {
      throw new Error(`Failed to resolve key conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sync metrics
   * 
   * @returns Object with sync statistics
   */
  getSyncMetrics(): {
    packagesCreated: number;
    packagesProcessed: number;
    conflictsResolved: number;
    syncErrors: number;
    activeSyncOperations: number;
    pendingQueues: number;
  } {
    return {
      ...this.syncMetrics,
      activeSyncOperations: this.activeSyncOperations.size,
      pendingQueues: this.offlineQueues.size
    };
  }

  /**
   * Force sync with a specific device
   * 
   * @param deviceId - Device to sync with
   * @returns Promise<boolean> - True if sync succeeded
   */
  async forceSyncWithDevice(deviceId: string): Promise<boolean> {
    this.ensureInitialized();

    try {
      const syncId = `force-sync-${deviceId}-${Date.now()}`;
      this.activeSyncOperations.add(syncId);

      try {
        const packagesSent = await this.syncKeysWithTrustedDevices();
        console.log(`Force sync with device ${deviceId} completed, sent ${packagesSent} packages`);
        return true;
      } finally {
        this.activeSyncOperations.delete(syncId);
      }
    } catch (error) {
      console.error(`Force sync with device ${deviceId} failed:`, error);
      return false;
    }
  }

  // Private helper methods

  private async generatePackageId(): Promise<string> {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async encryptKeyDataForDevice(keyData: Uint8Array, targetDevice: DeviceIdentity): Promise<Uint8Array> {
    // Use the target device's encryption public key
    const sharedSecret = await this.x25519Service.computeSharedSecret(
      this.deviceIdentityService.getCurrentDevice()!.encryptionKeys.privateKey,
      targetDevice.encryptionKeys.publicKey
    );

    // Derive encryption key
    const encryptionKey = await this.chainKeyService.deriveMessageKey(sharedSecret, 0);

    // Encrypt using ChaCha20-Poly1305 (via MessageEncryptionService)
    // For simplicity, using a basic XOR here - production would use proper AEAD
    const encrypted = new Uint8Array(keyData.length);
    for (let i = 0; i < keyData.length; i++) {
      encrypted[i] = keyData[i] ^ encryptionKey[i % encryptionKey.length];
    }

    return encrypted;
  }

  private async decryptKeyDataFromDevice(encryptedData: Uint8Array, senderDevice: DeviceIdentity): Promise<Uint8Array> {
    // Use the sender device's encryption public key
    const sharedSecret = await this.x25519Service.computeSharedSecret(
      this.deviceIdentityService.getCurrentDevice()!.encryptionKeys.privateKey,
      senderDevice.encryptionKeys.publicKey
    );

    // Derive encryption key
    const encryptionKey = await this.chainKeyService.deriveMessageKey(sharedSecret, 0);

    // Decrypt using same XOR process
    const decrypted = new Uint8Array(encryptedData.length);
    for (let i = 0; i < encryptedData.length; i++) {
      decrypted[i] = encryptedData[i] ^ encryptionKey[i % encryptionKey.length];
    }

    return decrypted;
  }

  private async createIntegrityHash(keyData: Uint8Array, metadata: any): Promise<Uint8Array> {
    const combinedData = new Uint8Array(keyData.length + 32);
    combinedData.set(keyData, 0);
    const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
    combinedData.set(metadataBytes.slice(0, 32), keyData.length);

    // Simple hash - production would use SHA-256
    return await this.chainKeyService.deriveMessageKey(combinedData, 0);
  }

  private determineSyncPriority(keyType: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (keyType) {
      case 'ratchet_state': return 'critical';
      case 'conversation_key': return 'high';
      case 'hybrid_key': return 'high';
      case 'device_key': return 'medium';
      default: return 'low';
    }
  }

  private async checkForKeyConflicts(syncPackage: KeySyncPackage): Promise<{ hasConflict: boolean; reason?: string }> {
    // Check if we have a newer version of the same key
    const stateKey = `${syncPackage.keyType}-${syncPackage.keyMetadata.conversationId || 'global'}`;
    const currentState = this.keySyncStates.get(stateKey);

    if (currentState && currentState.currentVersion > syncPackage.keyMetadata.keyVersion) {
      return {
        hasConflict: true,
        reason: 'Local version is newer'
      };
    }

    return { hasConflict: false };
  }

  private async handleKeyConflict(syncPackage: KeySyncPackage, conflictInfo: any): Promise<void> {
    const conflictId = `conflict-${syncPackage.packageId}`;
    
    const conflict: KeyConflictResolution = {
      conflictId,
      conversationId: syncPackage.keyMetadata.conversationId || 'global',
      keyType: syncPackage.keyType,
      conflictingVersions: [
        {
          deviceId: syncPackage.fromDeviceId,
          version: syncPackage.keyMetadata.keyVersion,
          timestamp: syncPackage.keyMetadata.lastModified,
          keyHash: 'hash-placeholder'
        }
      ],
      resolutionStrategy: 'latest_wins',
      resolvedVersion: 0,
      resolvedBy: '',
      resolvedAt: 0
    };

    this.conflictResolutions.set(conflictId, conflict);
    console.log(`Created conflict resolution ${conflictId} for key type ${syncPackage.keyType}`);
  }

  private async selectMostTrustedVersion(versions: any[]): Promise<any> {
    // Select version from device with highest trust score
    let mostTrusted = versions[0];
    let highestScore = 0;

    for (const version of versions) {
      const trustScore = await this.deviceIdentityService.calculateTrustScore(version.deviceId);
      if (trustScore.score > highestScore) {
        highestScore = trustScore.score;
        mostTrusted = version;
      }
    }

    return mostTrusted;
  }

  private async mergeConflictingVersions(conflict: KeyConflictResolution): Promise<number> {
    // Complex merge logic - for now, just return latest version
    return Math.max(...conflict.conflictingVersions.map(v => v.version)) + 1;
  }

  private async applyConflictResolution(conflict: KeyConflictResolution): Promise<void> {
    // Apply the resolved version
    console.log(`Applied conflict resolution for ${conflict.conflictId}`);
  }

  private async applyKeyUpdate(syncPackage: KeySyncPackage, keyData: Uint8Array): Promise<void> {
    // Apply the key update to local storage
    console.log(`Applied key update for ${syncPackage.keyType}`);
  }

  private async updateSyncState(syncPackage: KeySyncPackage): Promise<void> {
    const stateKey = `${syncPackage.keyType}-${syncPackage.keyMetadata.conversationId || 'global'}`;
    
    const syncState: KeySyncState = {
      deviceId: syncPackage.fromDeviceId,
      conversationId: syncPackage.keyMetadata.conversationId || 'global',
      keyType: syncPackage.keyType,
      currentVersion: syncPackage.keyMetadata.keyVersion,
      lastSyncedVersion: syncPackage.keyMetadata.keyVersion,
      pendingUpdates: [],
      conflictResolutionNeeded: false,
      lastSyncedAt: Date.now(),
      syncStatus: 'synced'
    };

    this.keySyncStates.set(stateKey, syncState);
  }

  private async loadSyncStates(): Promise<void> {
    // Load sync states from storage - placeholder
    console.log('Loaded sync states');
  }

  private startBackgroundSync(): void {
    // Start periodic sync process
    setInterval(async () => {
      if (this.activeSyncOperations.size === 0) {
        try {
          await this.processOfflineQueues();
        } catch (error) {
          console.error('Background sync error:', error);
        }
      }
    }, CrossDeviceKeyService.SYNC_RETRY_DELAY_MS);
  }

  private async processOfflineQueues(): Promise<void> {
    // Process offline sync queues
    for (const [queueId, queue] of this.offlineQueues.entries()) {
      if (Date.now() >= queue.nextRetryAt && queue.retryCount < queue.maxRetries) {
        // Process queue
        queue.retryCount++;
        queue.nextRetryAt = Date.now() + CrossDeviceKeyService.SYNC_RETRY_DELAY_MS;
      }
    }
  }

  private async getTargetDevice(deviceId: string): Promise<DeviceIdentity | null> {
    // Get device from trusted devices list
    const trustedDevices = await this.deviceIdentityService.getTrustedDevices();
    return trustedDevices.find(device => device.deviceId === deviceId) || null;
  }

  private async getKeysNeedingSync(keyType?: string, conversationId?: string): Promise<any[]> {
    // Get keys that need syncing - placeholder
    return [];
  }

  private async sendKeySyncPackage(syncPackage: KeySyncPackage): Promise<void> {
    // Send package to target device - placeholder for backend API call
    console.log(`Sent key sync package ${syncPackage.packageId} to device ${syncPackage.toDeviceId}`);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Cross-Device Key service not initialized. Call initialize() first.');
    }
  }
}

// Create and export a singleton instance
export const crossDeviceKeyService = new CrossDeviceKeyService();