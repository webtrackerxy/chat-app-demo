/**
 * Multi-Device Integration Test Suite
 * 
 * Comprehensive tests for all multi-device functionality including:
 * - Device identity and trust management
 * - Cross-device key synchronization
 * - Device authentication and verification
 * - Key conflict resolution
 * - Offline sync capabilities
 */

import { DeviceIdentityService, deviceIdentityService } from '../DeviceIdentityService';
import { CrossDeviceKeyService, crossDeviceKeyService } from '../CrossDeviceKeyService';
import { DeviceAuthenticationService, deviceAuthenticationService } from '../DeviceAuthenticationService';
import { KeyConflictResolutionService, keyConflictResolutionService } from '../KeyConflictResolutionService';
import { OfflineKeySyncService, offlineKeySyncService } from '../OfflineKeySyncService';

// Mock crypto for testing
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      generateKey: jest.fn().mockResolvedValue({
        publicKey: new Uint8Array(32).fill(1),
        privateKey: new Uint8Array(32).fill(2)
      }),
      exportKey: jest.fn().mockResolvedValue(new Uint8Array(32).fill(3)),
      sign: jest.fn().mockResolvedValue(new Uint8Array(64).fill(4)),
      verify: jest.fn().mockResolvedValue(true)
    }
  }
});

// Mock navigator for testing
Object.defineProperty(global, 'navigator', {
  value: {
    onLine: true,
    platform: 'Test Platform',
    userAgent: 'Test User Agent'
  }
});

describe('Multi-Device Integration Tests', () => {
  let device1: DeviceIdentityService;
  let device2: DeviceIdentityService;
  let device3: DeviceIdentityService;
  
  beforeEach(async () => {
    // Create multiple device instances for testing
    device1 = new DeviceIdentityService();
    device2 = new DeviceIdentityService();
    device3 = new DeviceIdentityService();
    
    await Promise.all([
      device1.initialize(),
      device2.initialize(),
      device3.initialize()
    ]);
  });

  afterEach(() => {
    // Clear localStorage between tests
    localStorage.clear();
  });

  describe('Device Identity Management', () => {
    test('should create and manage device identities', async () => {
      // Create device identities
      const identity1 = await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      const identity2 = await device2.createDeviceIdentity('user1', 'Device 2', 'mobile');
      const identity3 = await device3.createDeviceIdentity('user1', 'Device 3', 'web');

      expect(identity1.deviceId).toBeDefined();
      expect(identity1.userId).toBe('user1');
      expect(identity1.deviceName).toBe('Device 1');
      expect(identity1.deviceType).toBe('desktop');
      expect(identity1.trustLevel).toBe('unverified');

      expect(identity2.deviceId).toBeDefined();
      expect(identity2.deviceId).not.toBe(identity1.deviceId);
      
      expect(identity3.deviceId).toBeDefined();
      expect(identity3.deviceId).not.toBe(identity1.deviceId);
      expect(identity3.deviceId).not.toBe(identity2.deviceId);
    });

    test('should calculate trust scores correctly', async () => {
      const identity = await device1.createDeviceIdentity('user1', 'Test Device', 'desktop');
      
      // Initial trust score should be low
      const initialScore = await device1.calculateTrustScore(identity.deviceId);
      expect(initialScore.score).toBeLessThan(50);
      
      // Mock device verification to increase trust
      identity.trustLevel = 'cross-verified';
      identity.verifiedBy = ['device-2', 'device-3'];
      
      const improvedScore = await device1.calculateTrustScore(identity.deviceId);
      expect(improvedScore.score).toBeGreaterThan(initialScore.score);
    });

    test('should handle device revocation', async () => {
      const identity = await device1.createDeviceIdentity('user1', 'Test Device', 'mobile');
      expect(identity.trustLevel).toBe('unverified');
      
      // Revoke device
      await device1.revokeDevice(identity.deviceId, 'Security breach');
      
      // Check that device trust level is updated
      const updatedIdentity = device1.getCurrentDevice();
      expect(updatedIdentity?.trustLevel).toBe('revoked');
    });

    test('should export and import device identity', async () => {
      const originalIdentity = await device1.createDeviceIdentity('user1', 'Original Device', 'desktop');
      const passphrase = 'test-passphrase-123';
      
      // Export device identity
      const exportedData = await device1.exportDeviceIdentity(passphrase);
      expect(exportedData).toBeDefined();
      expect(typeof exportedData).toBe('string');
      
      // Import on another device instance
      const importedIdentity = await device2.importDeviceIdentity(exportedData, passphrase);
      
      expect(importedIdentity.deviceId).toBe(originalIdentity.deviceId);
      expect(importedIdentity.deviceName).toBe(originalIdentity.deviceName);
      expect(importedIdentity.userId).toBe(originalIdentity.userId);
    });
  });

  describe('Device Authentication', () => {
    test('should perform QR code authentication', async () => {
      const auth1 = new DeviceAuthenticationService();
      const auth2 = new DeviceAuthenticationService();
      
      await Promise.all([auth1.initialize(), auth2.initialize()]);
      
      // Device 1 creates device identity
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      // Device 1 generates QR code
      const qrCodeData = await auth1.generateQRCode('device2-id');
      expect(qrCodeData).toBeDefined();
      expect(typeof qrCodeData).toBe('string');
      
      // Device 2 processes QR code
      const authSession = await auth2.processQRCode(qrCodeData);
      expect(authSession.method).toBe('qr_code');
      expect(authSession.status).toBe('pending');
    });

    test('should handle numeric code verification', async () => {
      const auth = new DeviceAuthenticationService();
      await auth.initialize();
      
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      // Initiate numeric code authentication
      const session = await auth.initiateAuthentication('device2-id', 'numeric_code');
      
      expect(session.method).toBe('numeric_code');
      expect(session.verificationCode).toBeDefined();
      expect(session.verificationCode?.length).toBeGreaterThan(0);
      expect(session.status).toBe('pending');
    });

    test('should track authentication metrics', async () => {
      const auth = new DeviceAuthenticationService();
      await auth.initialize();
      
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      const initialMetrics = auth.getAuthenticationMetrics();
      expect(initialMetrics.sessionsCreated).toBe(0);
      
      // Create some authentication sessions
      await auth.initiateAuthentication('device2-id', 'qr_code');
      await auth.initiateAuthentication('device3-id', 'numeric_code');
      
      const updatedMetrics = auth.getAuthenticationMetrics();
      expect(updatedMetrics.sessionsCreated).toBe(2);
      expect(updatedMetrics.activeSessions).toBe(2);
    });
  });

  describe('Cross-Device Key Synchronization', () => {
    test('should create and process key sync packages', async () => {
      const keyService1 = new CrossDeviceKeyService();
      const keyService2 = new CrossDeviceKeyService();
      
      await Promise.all([keyService1.initialize(), keyService2.initialize()]);
      
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      await device2.createDeviceIdentity('user1', 'Device 2', 'mobile');
      
      const keyData = new Uint8Array([1, 2, 3, 4, 5]);
      
      // Create sync package
      const syncPackage = await keyService1.createKeySyncPackage(
        keyData,
        'conversation_key',
        'device2-id',
        {
          conversationId: 'conv-123',
          keyVersion: 1
        }
      );
      
      expect(syncPackage.packageId).toBeDefined();
      expect(syncPackage.keyType).toBe('conversation_key');
      expect(syncPackage.toDeviceId).toBe('device2-id');
      expect(syncPackage.encryptedKeyData).toBeDefined();
      expect(syncPackage.signature).toBeDefined();
      
      // Process sync package on second device
      const processed = await keyService2.processKeySyncPackage(syncPackage);
      expect(processed).toBe(true);
    });

    test('should sync keys with trusted devices', async () => {
      const keyService = new CrossDeviceKeyService();
      await keyService.initialize();
      
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      // Mock trusted devices
      const mockTrustedDevices = [
        { deviceId: 'device2-id', userId: 'user1', trustLevel: 'cross-verified' },
        { deviceId: 'device3-id', userId: 'user1', trustLevel: 'cross-verified' }
      ];
      
      jest.spyOn(device1, 'getTrustedDevices').mockResolvedValue(mockTrustedDevices as any);
      
      const packageCount = await keyService.syncKeysWithTrustedDevices('conversation_key', 'conv-123');
      expect(packageCount).toBeGreaterThanOrEqual(0);
    });

    test('should get sync metrics', async () => {
      const keyService = new CrossDeviceKeyService();
      await keyService.initialize();
      
      const metrics = keyService.getSyncMetrics();
      expect(metrics).toHaveProperty('packagesCreated');
      expect(metrics).toHaveProperty('packagesProcessed');
      expect(metrics).toHaveProperty('conflictsResolved');
      expect(metrics).toHaveProperty('syncErrors');
      expect(metrics).toHaveProperty('activeSyncOperations');
    });
  });

  describe('Key Conflict Resolution', () => {
    test('should detect key conflicts', async () => {
      const conflictService = new KeyConflictResolutionService();
      await conflictService.initialize();
      
      // Create conflicting versions
      const versions = [
        {
          deviceId: 'device1-id',
          version: 1,
          timestamp: Date.now() - 1000,
          keyHash: 'hash1',
          keyData: new Uint8Array([1, 2, 3]),
          metadata: { lastModified: Date.now() - 1000 }
        },
        {
          deviceId: 'device2-id', 
          version: 2,
          timestamp: Date.now(),
          keyHash: 'hash2',
          keyData: new Uint8Array([4, 5, 6]),
          metadata: { lastModified: Date.now() }
        }
      ];
      
      const conflict = await conflictService.detectKeyConflict(
        'conv-123',
        'conversation_key',
        versions
      );
      
      expect(conflict).toBeDefined();
      expect(conflict?.conflictId).toBeDefined();
      expect(conflict?.conversationId).toBe('conv-123');
      expect(conflict?.keyType).toBe('conversation_key');
      expect(conflict?.conflictingVersions).toHaveLength(2);
      expect(conflict?.status).toBe('detected');
    });

    test('should resolve conflicts using latest wins strategy', async () => {
      const conflictService = new KeyConflictResolutionService();
      await conflictService.initialize();
      
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      // Create a mock conflict
      const versions = [
        {
          deviceId: 'device1-id',
          version: 1,
          timestamp: Date.now() - 5000,
          keyHash: 'hash1',
          keyData: new Uint8Array([1, 2, 3]),
          metadata: { lastModified: Date.now() - 5000 }
        },
        {
          deviceId: 'device2-id',
          version: 2,
          timestamp: Date.now(),
          keyHash: 'hash2',
          keyData: new Uint8Array([4, 5, 6]),
          metadata: { lastModified: Date.now() }
        }
      ];
      
      const conflict = await conflictService.detectKeyConflict(
        'conv-123',
        'conversation_key',
        versions
      );
      
      expect(conflict).toBeDefined();
      
      // Resolve using latest wins
      const resolution = await conflictService.resolveConflict(
        conflict!.conflictId,
        { type: 'latest_wins' }
      );
      
      expect(resolution.success).toBe(true);
      expect(resolution.strategy.type).toBe('latest_wins');
      expect(resolution.resolvedVersion).toBe(2); // Latest version should win
    });

    test('should track resolution metrics', async () => {
      const conflictService = new KeyConflictResolutionService();
      await conflictService.initialize();
      
      const metrics = conflictService.getResolutionMetrics();
      expect(metrics).toHaveProperty('conflictsDetected');
      expect(metrics).toHaveProperty('conflictsResolved');
      expect(metrics).toHaveProperty('conflictsFailed');
      expect(metrics).toHaveProperty('averageResolutionTime');
      expect(metrics).toHaveProperty('strategyUsage');
      expect(metrics).toHaveProperty('activeConflicts');
    });
  });

  describe('Offline Key Synchronization', () => {
    test('should queue key updates for offline sync', async () => {
      const offlineService = new OfflineKeySyncService();
      await offlineService.initialize();
      
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      const keyData = new Uint8Array([1, 2, 3, 4, 5]);
      
      const itemId = await offlineService.queueKeyUpdate(
        'conv-123',
        'conversation_key',
        keyData,
        {
          version: 1,
          priority: 'high'
        }
      );
      
      expect(itemId).toBeDefined();
      expect(typeof itemId).toBe('string');
      
      // Check queue status
      const queue = offlineService.getSyncQueue('device1-id');
      expect(queue).toBeDefined();
      expect(queue?.items.length).toBe(1);
      expect(queue?.items[0].itemId).toBe(itemId);
    });

    test('should handle connectivity changes', async () => {
      const offlineService = new OfflineKeySyncService();
      await offlineService.initialize();
      
      // Check initial connectivity
      const initialStatus = offlineService.getConnectivityStatus();
      expect(initialStatus.isOnline).toBe(true);
      
      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      window.dispatchEvent(new Event('offline'));
      
      // Check updated status
      const offlineStatus = offlineService.getConnectivityStatus();
      expect(offlineStatus.isOnline).toBe(false);
      
      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));
      
      const onlineStatus = offlineService.getConnectivityStatus();
      expect(onlineStatus.isOnline).toBe(true);
    });

    test('should create and use delta sync checkpoints', async () => {
      const offlineService = new OfflineKeySyncService();
      await offlineService.initialize();
      
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      // Mock sync state
      const mockSyncState = {
        conversationId: 'conv-123',
        keyType: 'conversation_key',
        currentVersion: 5,
        lastSyncedVersion: 5,
        pendingUpdates: [],
        conflictStatus: 'none' as const,
        lastSyncedAt: Date.now(),
        syncHistory: []
      };
      
      jest.spyOn(keyConflictResolutionService, 'getSyncState').mockReturnValue(mockSyncState);
      
      const checkpoint = await offlineService.createDeltaCheckpoint('conv-123', 'conversation_key');
      
      expect(checkpoint.checkpointId).toBeDefined();
      expect(checkpoint.conversationId).toBe('conv-123');
      expect(checkpoint.keyType).toBe('conversation_key');
      expect(checkpoint.version).toBe(5);
      expect(checkpoint.signature).toBeDefined();
    });

    test('should get sync metrics', async () => {
      const offlineService = new OfflineKeySyncService();
      await offlineService.initialize();
      
      const metrics = offlineService.getSyncMetrics();
      expect(metrics).toHaveProperty('totalItemsQueued');
      expect(metrics).toHaveProperty('totalItemsSynced');
      expect(metrics).toHaveProperty('totalItemsFailed');
      expect(metrics).toHaveProperty('totalBytesTransferred');
      expect(metrics).toHaveProperty('averageSyncTime');
      expect(metrics).toHaveProperty('activeQueues');
      expect(metrics).toHaveProperty('activeSyncs');
    });
  });

  describe('End-to-End Multi-Device Scenarios', () => {
    test('should handle complete device onboarding flow', async () => {
      // Device 1 (existing) creates identity
      await device1.createDeviceIdentity('user1', 'Primary Device', 'desktop');
      
      // Device 2 (new) wants to join
      const auth1 = new DeviceAuthenticationService();
      const auth2 = new DeviceAuthenticationService();
      await Promise.all([auth1.initialize(), auth2.initialize()]);
      
      // Device 1 generates QR code for Device 2
      const qrCodeData = await auth1.generateQRCode('device2-id');
      
      // Device 2 scans QR code and processes it
      const authSession = await auth2.processQRCode(qrCodeData);
      expect(authSession.status).toBe('pending');
      
      // Simulate successful authentication
      const mockResponse = new TextEncoder().encode('test-response');
      const response = await auth2.respondToChallenge(authSession.sessionId, mockResponse);
      expect(response).toBeDefined();
      
      // Verify authentication
      const isVerified = await auth1.verifyAuthenticationResponse(authSession.sessionId, response);
      expect(isVerified).toBe(true);
    });

    test('should handle key sync after authentication', async () => {
      // Setup devices
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      await device2.createDeviceIdentity('user1', 'Device 2', 'mobile');
      
      const keyService1 = new CrossDeviceKeyService();
      const keyService2 = new CrossDeviceKeyService();
      await Promise.all([keyService1.initialize(), keyService2.initialize()]);
      
      // Create key on Device 1
      const conversationKey = new Uint8Array(32);
      crypto.getRandomValues(conversationKey);
      
      // Sync key to Device 2
      const syncPackage = await keyService1.createKeySyncPackage(
        conversationKey,
        'conversation_key',
        'device2-id',
        {
          conversationId: 'conv-123',
          keyVersion: 1
        }
      );
      
      // Device 2 processes the sync package
      const processed = await keyService2.processKeySyncPackage(syncPackage);
      expect(processed).toBe(true);
      
      // Verify sync metrics
      const metrics1 = keyService1.getSyncMetrics();
      const metrics2 = keyService2.getSyncMetrics();
      
      expect(metrics1.packagesCreated).toBe(1);
      expect(metrics2.packagesProcessed).toBe(1);
    });

    test('should handle offline-to-online sync scenario', async () => {
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      const offlineService = new OfflineKeySyncService();
      await offlineService.initialize();
      
      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      // Queue multiple updates while offline
      const keyData1 = new Uint8Array([1, 2, 3]);
      const keyData2 = new Uint8Array([4, 5, 6]);
      const keyData3 = new Uint8Array([7, 8, 9]);
      
      const item1 = await offlineService.queueKeyUpdate('conv-123', 'conversation_key', keyData1, { version: 1 });
      const item2 = await offlineService.queueKeyUpdate('conv-123', 'conversation_key', keyData2, { version: 2 });
      const item3 = await offlineService.queueKeyUpdate('conv-456', 'device_key', keyData3, { version: 1, priority: 'critical' });
      
      // Check queue status
      const queue = offlineService.getSyncQueue('device1-id');
      expect(queue?.items.length).toBe(3);
      
      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', { value: true });
      window.dispatchEvent(new Event('online'));
      
      // Check connectivity status
      const status = offlineService.getConnectivityStatus();
      expect(status.isOnline).toBe(true);
      
      // Verify metrics
      const metrics = offlineService.getSyncMetrics();
      expect(metrics.totalItemsQueued).toBe(3);
    });

    test('should handle conflict resolution in multi-device scenario', async () => {
      // Setup multiple devices
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      await device2.createDeviceIdentity('user1', 'Device 2', 'mobile');
      await device3.createDeviceIdentity('user1', 'Device 3', 'web');
      
      const conflictService = new KeyConflictResolutionService();
      await conflictService.initialize();
      
      // Create conflicting versions from different devices
      const versions = [
        {
          deviceId: 'device1-id',
          version: 3,
          timestamp: Date.now() - 2000,
          keyHash: 'hash-device1',
          keyData: new Uint8Array([1, 1, 1]),
          metadata: { lastModified: Date.now() - 2000, trustScore: 80 }
        },
        {
          deviceId: 'device2-id',
          version: 3,
          timestamp: Date.now() - 1000,
          keyHash: 'hash-device2',
          keyData: new Uint8Array([2, 2, 2]),
          metadata: { lastModified: Date.now() - 1000, trustScore: 90 }
        },
        {
          deviceId: 'device3-id',
          version: 3,
          timestamp: Date.now(),
          keyHash: 'hash-device3',
          keyData: new Uint8Array([3, 3, 3]),
          metadata: { lastModified: Date.now(), trustScore: 70 }
        }
      ];
      
      // Detect conflict
      const conflict = await conflictService.detectKeyConflict(
        'conv-123',
        'conversation_key',
        versions
      );
      
      expect(conflict).toBeDefined();
      expect(conflict?.conflictingVersions).toHaveLength(3);
      expect(conflict?.severity).toBeDefined();
      
      // Try different resolution strategies
      const latestWinsResult = await conflictService.resolveConflict(
        conflict!.conflictId,
        { type: 'latest_wins' }
      );
      
      expect(latestWinsResult.success).toBe(true);
      expect(latestWinsResult.strategy.type).toBe('latest_wins');
      
      // Verify resolution metrics
      const metrics = conflictService.getResolutionMetrics();
      expect(metrics.conflictsDetected).toBe(1);
      expect(metrics.conflictsResolved).toBe(1);
      expect(metrics.strategyUsage.latest_wins).toBe(1);
    });
  });

  describe('Performance and Stress Tests', () => {
    test('should handle large number of devices', async () => {
      const devices: DeviceIdentityService[] = [];
      const deviceCount = 10;
      
      // Create multiple devices
      for (let i = 0; i < deviceCount; i++) {
        const device = new DeviceIdentityService();
        await device.initialize();
        await device.createDeviceIdentity('user1', `Device ${i + 1}`, 'mobile');
        devices.push(device);
      }
      
      expect(devices).toHaveLength(deviceCount);
      
      // Verify each device has unique identity
      const deviceIds = new Set();
      for (const device of devices) {
        const identity = device.getCurrentDevice();
        expect(identity).toBeDefined();
        expect(deviceIds.has(identity!.deviceId)).toBe(false);
        deviceIds.add(identity!.deviceId);
      }
      
      expect(deviceIds.size).toBe(deviceCount);
    });

    test('should handle concurrent key sync operations', async () => {
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      const keyService = new CrossDeviceKeyService();
      await keyService.initialize();
      
      // Create multiple sync packages concurrently
      const concurrentOperations = 5;
      const syncPromises = [];
      
      for (let i = 0; i < concurrentOperations; i++) {
        const keyData = new Uint8Array([i, i, i, i, i]);
        const promise = keyService.createKeySyncPackage(
          keyData,
          'conversation_key',
          `device${i + 2}-id`,
          {
            conversationId: `conv-${i}`,
            keyVersion: 1
          }
        );
        syncPromises.push(promise);
      }
      
      const results = await Promise.all(syncPromises);
      
      expect(results).toHaveLength(concurrentOperations);
      results.forEach((result, index) => {
        expect(result.packageId).toBeDefined();
        expect(result.toDeviceId).toBe(`device${index + 2}-id`);
      });
      
      // Verify metrics
      const metrics = keyService.getSyncMetrics();
      expect(metrics.packagesCreated).toBe(concurrentOperations);
    });

    test('should handle large sync queues efficiently', async () => {
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      const offlineService = new OfflineKeySyncService();
      await offlineService.initialize();
      
      // Queue many items
      const itemCount = 50;
      const queuePromises = [];
      
      for (let i = 0; i < itemCount; i++) {
        const keyData = new Uint8Array([i % 256]);
        const promise = offlineService.queueKeyUpdate(
          `conv-${i % 5}`, // Distribute across 5 conversations
          'conversation_key',
          keyData,
          {
            version: i,
            priority: i % 4 === 0 ? 'critical' : 'medium'
          }
        );
        queuePromises.push(promise);
      }
      
      const itemIds = await Promise.all(queuePromises);
      
      expect(itemIds).toHaveLength(itemCount);
      itemIds.forEach(id => expect(typeof id).toBe('string'));
      
      // Check queue metrics
      const metrics = offlineService.getSyncMetrics();
      expect(metrics.totalItemsQueued).toBe(itemCount);
      
      const queue = offlineService.getSyncQueue('device1-id');
      expect(queue?.items.length).toBe(itemCount);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid QR code data', async () => {
      const auth = new DeviceAuthenticationService();
      await auth.initialize();
      
      // Test with invalid JSON
      await expect(auth.processQRCode('invalid-json')).rejects.toThrow();
      
      // Test with missing fields
      await expect(auth.processQRCode('{}')).rejects.toThrow();
      
      // Test with expired QR code
      const expiredQR = JSON.stringify({
        deviceId: 'test-device',
        publicKey: Array.from(new Uint8Array(32)),
        verificationCode: '123456',
        timestamp: Date.now() - 10000,
        expiresAt: Date.now() - 5000, // Expired
        signature: Array.from(new Uint8Array(64))
      });
      
      await expect(auth.processQRCode(expiredQR)).rejects.toThrow('QR code expired');
    });

    test('should handle sync package validation errors', async () => {
      const keyService = new CrossDeviceKeyService();
      await keyService.initialize();
      
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      // Create valid sync package
      const validPackage = await keyService.createKeySyncPackage(
        new Uint8Array([1, 2, 3]),
        'conversation_key',
        'device2-id',
        {
          conversationId: 'conv-123',
          keyVersion: 1
        }
      );
      
      // Test with tampered package
      const tamperedPackage = { ...validPackage };
      tamperedPackage.encryptedKeyData = new Uint8Array([9, 9, 9]);
      
      const processed = await keyService.processKeySyncPackage(tamperedPackage);
      expect(processed).toBe(false);
    });

    test('should handle device identity export/import errors', async () => {
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      const correctPassphrase = 'correct-passphrase';
      const wrongPassphrase = 'wrong-passphrase';
      
      // Export with correct passphrase
      const exportedData = await device1.exportDeviceIdentity(correctPassphrase);
      
      // Try to import with wrong passphrase
      await expect(device2.importDeviceIdentity(exportedData, wrongPassphrase))
        .rejects.toThrow();
      
      // Import with correct passphrase should work
      const importedIdentity = await device2.importDeviceIdentity(exportedData, correctPassphrase);
      expect(importedIdentity).toBeDefined();
    });

    test('should handle network connectivity issues', async () => {
      const offlineService = new OfflineKeySyncService();
      await offlineService.initialize();
      
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      // Queue item while online
      const keyData = new Uint8Array([1, 2, 3]);
      const itemId = await offlineService.queueKeyUpdate(
        'conv-123',
        'conversation_key',
        keyData,
        { version: 1 }
      );
      
      // Simulate network failure
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      // Try to sync (should handle gracefully)
      const queue = offlineService.getSyncQueue('device1-id');
      expect(queue?.items[0].syncStatus).toBe('pending');
      
      // Restore connectivity
      Object.defineProperty(navigator, 'onLine', { value: true });
      
      const status = offlineService.getConnectivityStatus();
      expect(status.isOnline).toBe(true);
    });

    test('should handle conflicting device trust levels', async () => {
      await device1.createDeviceIdentity('user1', 'Device 1', 'desktop');
      
      const identity = device1.getCurrentDevice()!;
      
      // Simulate conflicting trust levels
      identity.trustLevel = 'cross-verified';
      identity.verifiedBy = ['device2', 'device3'];
      
      // Calculate trust score
      const trustScore = await device1.calculateTrustScore(identity.deviceId);
      expect(trustScore.score).toBeGreaterThan(0);
      expect(trustScore.factors).toBeDefined();
      
      // Revoke device
      await device1.revokeDevice(identity.deviceId, 'Test revocation');
      
      // Trust score should be affected
      const revokedScore = await device1.calculateTrustScore(identity.deviceId);
      expect(revokedScore.factors.behaviorScore).toBe(0);
    });
  });
});

// Performance benchmark helper
function measurePerformance<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    resolve({ result, duration });
  });
}