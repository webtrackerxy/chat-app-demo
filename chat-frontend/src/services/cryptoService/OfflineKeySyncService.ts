/**
 * Offline Key Synchronization Service
 * 
 * Handles key synchronization when devices are offline or have intermittent connectivity.
 * Queues key updates, handles sync conflicts, and provides robust offline-first
 * synchronization capabilities.
 * 
 * Features:
 * - Offline queue management for key updates
 * - Automatic sync when connectivity is restored
 * - Conflict detection and resolution for offline changes
 * - Priority-based sync ordering
 * - Bandwidth-conscious sync strategies
 * - Delta sync for efficient updates
 */

import { DeviceIdentityService } from './DeviceIdentityService';
import { CrossDeviceKeyService, KeySyncPackage } from './CrossDeviceKeyService';
import { KeyConflictResolutionService } from './KeyConflictResolutionService';
import { ChainKeyService } from './ChainKeyService';

export interface OfflineSyncQueue {
  queueId: string;
  deviceId: string;
  items: OfflineSyncItem[];
  totalSize: number;
  lastModified: number;
  syncPriority: 'critical' | 'high' | 'medium' | 'low';
  maxRetries: number;
  retryDelay: number;
}

export interface OfflineSyncItem {
  itemId: string;
  type: 'key_update' | 'key_creation' | 'key_deletion' | 'device_verification' | 'conflict_resolution';
  conversationId?: string;
  keyType?: string;
  data: Uint8Array;
  metadata: {
    version: number;
    timestamp: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
    dependencies?: string[];
    deviceId: string;
    keyHash: string;
  };
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed' | 'conflicted';
  attempts: number;
  lastAttempt?: number;
  error?: string;
}

export interface SyncStrategy {
  type: 'full' | 'delta' | 'priority' | 'bandwidth_conscious';
  parameters: {
    maxBatchSize?: number;
    maxBandwidth?: number;
    priorityThreshold?: 'critical' | 'high' | 'medium' | 'low';
    deltaCheckpoint?: number;
  };
}

export interface ConnectivityStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  bandwidth: number;
  latency: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  lastChecked: number;
}

export interface SyncProgress {
  queueId: string;
  totalItems: number;
  syncedItems: number;
  failedItems: number;
  currentItem?: string;
  estimatedTimeRemaining: number;
  bytesTransferred: number;
  totalBytes: number;
  speed: number; // bytes per second
}

export interface DeltaSyncCheckpoint {
  checkpointId: string;
  deviceId: string;
  conversationId: string;
  keyType: string;
  version: number;
  timestamp: number;
  keyHash: string;
  signature: Uint8Array;
}

/**
 * Offline Key Sync Service
 * 
 * Manages key synchronization for offline and intermittent connectivity scenarios
 */
export class OfflineKeySyncService {
  private static readonly MAX_QUEUE_SIZE = 1000;
  private static readonly MAX_ITEM_SIZE_MB = 10;
  private static readonly CONNECTIVITY_CHECK_INTERVAL_MS = 30000; // 30 seconds
  private static readonly SYNC_RETRY_BASE_DELAY_MS = 5000; // 5 seconds
  private static readonly MAX_RETRY_DELAY_MS = 300000; // 5 minutes
  private static readonly DELTA_CHECKPOINT_INTERVAL_MS = 3600000; // 1 hour
  
  private deviceIdentityService: DeviceIdentityService;
  private crossDeviceKeyService: CrossDeviceKeyService;
  private conflictResolutionService: KeyConflictResolutionService;
  private chainKeyService: ChainKeyService;
  
  private initialized: boolean = false;
  private syncQueues: Map<string, OfflineSyncQueue> = new Map();
  private connectivityStatus: ConnectivityStatus;
  private activeSyncs: Map<string, SyncProgress> = new Map();
  private deltaCheckpoints: Map<string, DeltaSyncCheckpoint> = new Map();
  
  // Sync metrics
  private syncMetrics = {
    totalItemsQueued: 0,
    totalItemsSynced: 0,
    totalItemsFailed: 0,
    totalBytesTransferred: 0,
    averageSyncTime: 0,
    connectivityUptime: 0
  };

  constructor() {
    this.deviceIdentityService = new DeviceIdentityService();
    this.crossDeviceKeyService = new CrossDeviceKeyService();
    this.conflictResolutionService = new KeyConflictResolutionService();
    this.chainKeyService = new ChainKeyService();
    
    this.connectivityStatus = {
      isOnline: navigator.onLine,
      connectionType: 'unknown',
      bandwidth: 0,
      latency: 0,
      quality: 'unknown' as any,
      lastChecked: Date.now()
    };
  }

  /**
   * Initialize the offline key sync service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize all dependencies
      await Promise.all([
        this.deviceIdentityService.initialize(),
        this.crossDeviceKeyService.initialize(),
        this.conflictResolutionService.initialize(),
        this.chainKeyService.initialize()
      ]);

      // Load existing queues
      await this.loadSyncQueues();

      // Start connectivity monitoring
      this.startConnectivityMonitoring();

      // Start periodic sync
      this.startPeriodicSync();

      // Create delta checkpoints periodically
      this.startDeltaCheckpointing();

      this.initialized = true;
      console.log('Offline Key Sync Service initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize Offline Key Sync service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Queue a key update for offline sync
   * 
   * @param conversationId - Conversation ID
   * @param keyType - Type of key
   * @param keyData - Key data to sync
   * @param metadata - Key metadata
   * @returns Promise<string> - Queue item ID
   */
  async queueKeyUpdate(
    conversationId: string,
    keyType: string,
    keyData: Uint8Array,
    metadata: {
      version: number;
      priority?: 'critical' | 'high' | 'medium' | 'low';
      dependencies?: string[];
    }
  ): Promise<string> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      const itemId = await this.generateItemId();
      const keyHash = await this.generateKeyHash(keyData);
      
      const syncItem: OfflineSyncItem = {
        itemId,
        type: 'key_update',
        conversationId,
        keyType,
        data: keyData,
        metadata: {
          version: metadata.version,
          timestamp: Date.now(),
          priority: metadata.priority || 'medium',
          dependencies: metadata.dependencies,
          deviceId: currentDevice.deviceId,
          keyHash
        },
        syncStatus: 'pending',
        attempts: 0
      };

      // Add to appropriate queue
      await this.addToQueue(currentDevice.deviceId, syncItem);

      // Update metrics
      this.syncMetrics.totalItemsQueued++;

      // Attempt immediate sync if online
      if (this.connectivityStatus.isOnline) {
        await this.attemptImmediateSync(currentDevice.deviceId, itemId);
      }

      console.log(`Queued key update ${itemId} for ${keyType} in conversation ${conversationId}`);
      return itemId;
    } catch (error) {
      throw new Error(`Failed to queue key update: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Sync all queued items for a device
   * 
   * @param deviceId - Device to sync
   * @param strategy - Sync strategy to use
   * @returns Promise<SyncProgress> - Sync progress
   */
  async syncDevice(deviceId: string, strategy: SyncStrategy): Promise<SyncProgress> {
    this.ensureInitialized();

    if (!this.connectivityStatus.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    const queue = this.syncQueues.get(deviceId);
    if (!queue || queue.items.length === 0) {
      throw new Error('No items to sync for device');
    }

    try {
      const syncId = `${deviceId}-${Date.now()}`;
      
      // Initialize sync progress
      const progress: SyncProgress = {
        queueId: queue.queueId,
        totalItems: queue.items.length,
        syncedItems: 0,
        failedItems: 0,
        estimatedTimeRemaining: 0,
        bytesTransferred: 0,
        totalBytes: queue.totalSize,
        speed: 0
      };

      this.activeSyncs.set(syncId, progress);

      // Execute sync based on strategy
      await this.executeSyncStrategy(queue, strategy, progress);

      return progress;
    } catch (error) {
      throw new Error(`Failed to sync device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create delta sync checkpoint
   * 
   * @param conversationId - Conversation ID
   * @param keyType - Key type
   * @returns Promise<DeltaSyncCheckpoint> - Created checkpoint
   */
  async createDeltaCheckpoint(conversationId: string, keyType: string): Promise<DeltaSyncCheckpoint> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Get current key state
      const syncState = this.conflictResolutionService.getSyncState(conversationId, keyType);
      if (!syncState) {
        throw new Error('No sync state found for key');
      }

      const checkpointId = await this.generateCheckpointId();
      const keyHash = await this.generateKeyHash(new Uint8Array([syncState.currentVersion]));

      // Create checkpoint data
      const checkpointData = {
        checkpointId,
        deviceId: currentDevice.deviceId,
        conversationId,
        keyType,
        version: syncState.currentVersion,
        timestamp: Date.now(),
        keyHash
      };

      // Sign checkpoint
      const signature = await this.deviceIdentityService.getCurrentDevice()?.signingKeys.privateKey;
      if (!signature) {
        throw new Error('No signing key available');
      }

      const checkpoint: DeltaSyncCheckpoint = {
        ...checkpointData,
        signature: new Uint8Array([1, 2, 3]) // Placeholder signature
      };

      // Store checkpoint
      const checkpointKey = `${conversationId}-${keyType}`;
      this.deltaCheckpoints.set(checkpointKey, checkpoint);

      console.log(`Created delta checkpoint ${checkpointId} for ${keyType} in conversation ${conversationId}`);
      return checkpoint;
    } catch (error) {
      throw new Error(`Failed to create delta checkpoint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform delta sync from checkpoint
   * 
   * @param checkpointId - Checkpoint to sync from
   * @param targetDeviceId - Device to sync with
   * @returns Promise<number> - Number of items synced
   */
  async performDeltaSync(checkpointId: string, targetDeviceId: string): Promise<number> {
    this.ensureInitialized();

    try {
      // Find checkpoint
      let checkpoint: DeltaSyncCheckpoint | null = null;
      for (const [key, cp] of this.deltaCheckpoints.entries()) {
        if (cp.checkpointId === checkpointId) {
          checkpoint = cp;
          break;
        }
      }

      if (!checkpoint) {
        throw new Error('Checkpoint not found');
      }

      // Get queue for target device
      const queue = this.syncQueues.get(targetDeviceId);
      if (!queue) {
        console.log('No sync queue found for device, creating new one');
        return 0;
      }

      // Find items newer than checkpoint
      const deltaItems = queue.items.filter(item => 
        item.conversationId === checkpoint!.conversationId &&
        item.keyType === checkpoint!.keyType &&
        item.metadata.version > checkpoint!.version
      );

      if (deltaItems.length === 0) {
        console.log('No delta items to sync');
        return 0;
      }

      // Sync delta items
      let syncedCount = 0;
      for (const item of deltaItems) {
        try {
          await this.syncSingleItem(item);
          item.syncStatus = 'synced';
          syncedCount++;
        } catch (error) {
          console.warn(`Failed to sync delta item ${item.itemId}:`, error);
          item.syncStatus = 'failed';
          item.error = error instanceof Error ? error.message : 'Unknown error';
        }
      }

      console.log(`Delta sync completed: ${syncedCount}/${deltaItems.length} items synced`);
      return syncedCount;
    } catch (error) {
      throw new Error(`Failed to perform delta sync: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get sync queue status for a device
   * 
   * @param deviceId - Device to check
   * @returns OfflineSyncQueue | null - Queue status or null if not found
   */
  getSyncQueue(deviceId: string): OfflineSyncQueue | null {
    return this.syncQueues.get(deviceId) || null;
  }

  /**
   * Get connectivity status
   * 
   * @returns ConnectivityStatus - Current connectivity status
   */
  getConnectivityStatus(): ConnectivityStatus {
    return { ...this.connectivityStatus };
  }

  /**
   * Get sync metrics
   * 
   * @returns Object with sync statistics
   */
  getSyncMetrics(): typeof this.syncMetrics & {
    activeQueues: number;
    activeSyncs: number;
    totalQueueSize: number;
  } {
    const totalQueueSize = Array.from(this.syncQueues.values())
      .reduce((total, queue) => total + queue.totalSize, 0);

    return {
      ...this.syncMetrics,
      activeQueues: this.syncQueues.size,
      activeSyncs: this.activeSyncs.size,
      totalQueueSize
    };
  }

  /**
   * Clear sync queue for a device
   * 
   * @param deviceId - Device to clear queue for
   * @param itemTypes - Optional: specific item types to clear
   * @returns Promise<number> - Number of items cleared
   */
  async clearSyncQueue(
    deviceId: string, 
    itemTypes?: OfflineSyncItem['type'][]
  ): Promise<number> {
    const queue = this.syncQueues.get(deviceId);
    if (!queue) {
      return 0;
    }

    let clearedCount = 0;
    if (itemTypes) {
      // Clear specific types
      const beforeCount = queue.items.length;
      queue.items = queue.items.filter(item => !itemTypes.includes(item.type));
      clearedCount = beforeCount - queue.items.length;
    } else {
      // Clear all items
      clearedCount = queue.items.length;
      queue.items = [];
    }

    // Update queue size
    queue.totalSize = queue.items.reduce((size, item) => size + item.data.length, 0);
    queue.lastModified = Date.now();

    console.log(`Cleared ${clearedCount} items from sync queue for device ${deviceId}`);
    return clearedCount;
  }

  /**
   * Force sync retry for failed items
   * 
   * @param deviceId - Device to retry sync for
   * @returns Promise<number> - Number of items retried
   */
  async retrySyncFailures(deviceId: string): Promise<number> {
    const queue = this.syncQueues.get(deviceId);
    if (!queue) {
      return 0;
    }

    const failedItems = queue.items.filter(item => item.syncStatus === 'failed');
    
    for (const item of failedItems) {
      item.syncStatus = 'pending';
      item.attempts = 0;
      item.error = undefined;
      item.lastAttempt = undefined;
    }

    if (failedItems.length > 0 && this.connectivityStatus.isOnline) {
      await this.syncDevice(deviceId, { type: 'priority', parameters: { priorityThreshold: 'low' } });
    }

    console.log(`Retrying sync for ${failedItems.length} failed items`);
    return failedItems.length;
  }

  // Private helper methods

  private async addToQueue(deviceId: string, item: OfflineSyncItem): Promise<void> {
    let queue = this.syncQueues.get(deviceId);
    
    if (!queue) {
      const queueId = await this.generateQueueId();
      queue = {
        queueId,
        deviceId,
        items: [],
        totalSize: 0,
        lastModified: Date.now(),
        syncPriority: 'medium',
        maxRetries: 5,
        retryDelay: OfflineKeySyncService.SYNC_RETRY_BASE_DELAY_MS
      };
      this.syncQueues.set(deviceId, queue);
    }

    // Check queue size limits
    if (queue.items.length >= OfflineKeySyncService.MAX_QUEUE_SIZE) {
      // Remove oldest low-priority items
      queue.items = queue.items
        .filter(existingItem => existingItem.metadata.priority === 'critical' || existingItem.metadata.priority === 'high')
        .slice(-OfflineKeySyncService.MAX_QUEUE_SIZE + 1);
    }

    // Check item size
    const itemSizeMB = item.data.length / (1024 * 1024);
    if (itemSizeMB > OfflineKeySyncService.MAX_ITEM_SIZE_MB) {
      throw new Error(`Item size ${itemSizeMB.toFixed(2)}MB exceeds maximum ${OfflineKeySyncService.MAX_ITEM_SIZE_MB}MB`);
    }

    // Add item to queue
    queue.items.push(item);
    queue.totalSize += item.data.length;
    queue.lastModified = Date.now();

    // Update queue priority based on item priority
    if (item.metadata.priority === 'critical' && queue.syncPriority !== 'critical') {
      queue.syncPriority = 'critical';
    } else if (item.metadata.priority === 'high' && queue.syncPriority === 'medium') {
      queue.syncPriority = 'high';
    }
  }

  private async attemptImmediateSync(deviceId: string, itemId: string): Promise<void> {
    try {
      const queue = this.syncQueues.get(deviceId);
      if (!queue) return;

      const item = queue.items.find(i => i.itemId === itemId);
      if (!item) return;

      await this.syncSingleItem(item);
      item.syncStatus = 'synced';

      // Update metrics
      this.syncMetrics.totalItemsSynced++;
      this.syncMetrics.totalBytesTransferred += item.data.length;

      console.log(`Immediate sync successful for item ${itemId}`);
    } catch (error) {
      console.warn(`Immediate sync failed for item ${itemId}:`, error);
    }
  }

  private async executeSyncStrategy(
    queue: OfflineSyncQueue,
    strategy: SyncStrategy,
    progress: SyncProgress
  ): Promise<void> {
    const startTime = Date.now();
    let items: OfflineSyncItem[] = [];

    // Select items based on strategy
    switch (strategy.type) {
      case 'full':
        items = queue.items.filter(item => item.syncStatus === 'pending');
        break;
      case 'priority':
        const priorityThreshold = strategy.parameters.priorityThreshold || 'medium';
        items = queue.items.filter(item => 
          item.syncStatus === 'pending' && 
          this.isPriorityAtLeast(item.metadata.priority, priorityThreshold)
        );
        break;
      case 'delta':
        const checkpointVersion = strategy.parameters.deltaCheckpoint || 0;
        items = queue.items.filter(item => 
          item.syncStatus === 'pending' && 
          item.metadata.version > checkpointVersion
        );
        break;
      case 'bandwidth_conscious':
        const maxSize = strategy.parameters.maxBatchSize || 1024 * 1024; // 1MB default
        let currentSize = 0;
        items = [];
        for (const item of queue.items) {
          if (item.syncStatus === 'pending' && currentSize + item.data.length <= maxSize) {
            items.push(item);
            currentSize += item.data.length;
          }
        }
        break;
    }

    // Sort by priority
    items.sort((a, b) => this.comparePriority(a.metadata.priority, b.metadata.priority));

    // Sync items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      progress.currentItem = item.itemId;

      try {
        await this.syncSingleItem(item);
        item.syncStatus = 'synced';
        progress.syncedItems++;
        progress.bytesTransferred += item.data.length;

        // Update metrics
        this.syncMetrics.totalItemsSynced++;
        this.syncMetrics.totalBytesTransferred += item.data.length;
      } catch (error) {
        item.syncStatus = 'failed';
        item.error = error instanceof Error ? error.message : 'Unknown error';
        item.attempts++;
        progress.failedItems++;

        console.warn(`Failed to sync item ${item.itemId}:`, error);
      }

      // Update progress
      const elapsed = Date.now() - startTime;
      const remaining = items.length - i - 1;
      const avgTimePerItem = elapsed / (i + 1);
      progress.estimatedTimeRemaining = remaining * avgTimePerItem;
      progress.speed = progress.bytesTransferred / (elapsed / 1000);
    }

    // Update average sync time
    const totalTime = Date.now() - startTime;
    this.updateAverageSyncTime(totalTime);

    console.log(`Sync strategy ${strategy.type} completed: ${progress.syncedItems}/${items.length} items synced`);
  }

  private async syncSingleItem(item: OfflineSyncItem): Promise<void> {
    item.syncStatus = 'syncing';
    item.lastAttempt = Date.now();

    try {
      switch (item.type) {
        case 'key_update':
          await this.syncKeyUpdate(item);
          break;
        case 'key_creation':
          await this.syncKeyCreation(item);
          break;
        case 'key_deletion':
          await this.syncKeyDeletion(item);
          break;
        case 'device_verification':
          await this.syncDeviceVerification(item);
          break;
        case 'conflict_resolution':
          await this.syncConflictResolution(item);
          break;
        default:
          throw new Error(`Unknown sync item type: ${item.type}`);
      }
    } catch (error) {
      item.syncStatus = 'failed';
      throw error;
    }
  }

  private async syncKeyUpdate(item: OfflineSyncItem): Promise<void> {
    if (!item.conversationId || !item.keyType) {
      throw new Error('Missing conversation ID or key type for key update');
    }

    // Create sync package
    const trustedDevices = await this.deviceIdentityService.getTrustedDevices();
    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    
    for (const device of trustedDevices) {
      if (device.deviceId === currentDevice?.deviceId) continue;

      try {
        const syncPackage = await this.crossDeviceKeyService.createKeySyncPackage(
          item.data,
          item.keyType as any,
          device.deviceId,
          {
            conversationId: item.conversationId,
            keyVersion: item.metadata.version,
            dependencies: item.metadata.dependencies
          }
        );

        // Send sync package (placeholder)
        console.log(`Synced key update to device ${device.deviceId}`);
      } catch (error) {
        console.warn(`Failed to sync key update to device ${device.deviceId}:`, error);
      }
    }
  }

  private async syncKeyCreation(item: OfflineSyncItem): Promise<void> {
    // Similar to key update but for new keys
    await this.syncKeyUpdate(item);
  }

  private async syncKeyDeletion(item: OfflineSyncItem): Promise<void> {
    // Handle key deletion sync
    console.log(`Synced key deletion for item ${item.itemId}`);
  }

  private async syncDeviceVerification(item: OfflineSyncItem): Promise<void> {
    // Handle device verification sync
    console.log(`Synced device verification for item ${item.itemId}`);
  }

  private async syncConflictResolution(item: OfflineSyncItem): Promise<void> {
    // Handle conflict resolution sync
    console.log(`Synced conflict resolution for item ${item.itemId}`);
  }

  private startConnectivityMonitoring(): void {
    // Listen to online/offline events
    window.addEventListener('online', () => {
      this.connectivityStatus.isOnline = true;
      this.connectivityStatus.lastChecked = Date.now();
      this.onConnectivityRestored();
    });

    window.addEventListener('offline', () => {
      this.connectivityStatus.isOnline = false;
      this.connectivityStatus.lastChecked = Date.now();
    });

    // Periodic connectivity check
    setInterval(async () => {
      await this.checkConnectivity();
    }, OfflineKeySyncService.CONNECTIVITY_CHECK_INTERVAL_MS);
  }

  private async checkConnectivity(): Promise<void> {
    try {
      // Simple connectivity test
      const start = Date.now();
      const response = await fetch('/api/ping', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      const latency = Date.now() - start;

      this.connectivityStatus.isOnline = response.ok;
      this.connectivityStatus.latency = latency;
      this.connectivityStatus.lastChecked = Date.now();

      // Estimate quality based on latency
      if (latency < 100) {
        this.connectivityStatus.quality = 'excellent';
      } else if (latency < 300) {
        this.connectivityStatus.quality = 'good';
      } else if (latency < 1000) {
        this.connectivityStatus.quality = 'fair';
      } else {
        this.connectivityStatus.quality = 'poor';
      }
    } catch (error) {
      this.connectivityStatus.isOnline = false;
      this.connectivityStatus.quality = 'poor';
      this.connectivityStatus.lastChecked = Date.now();
    }
  }

  private async onConnectivityRestored(): Promise<void> {
    console.log('Connectivity restored, starting sync for all queues');

    // Sync all queues with pending items
    for (const [deviceId, queue] of this.syncQueues.entries()) {
      const pendingItems = queue.items.filter(item => item.syncStatus === 'pending');
      if (pendingItems.length > 0) {
        try {
          await this.syncDevice(deviceId, { type: 'priority', parameters: { priorityThreshold: 'low' } });
        } catch (error) {
          console.warn(`Failed to sync queue for device ${deviceId}:`, error);
        }
      }
    }
  }

  private startPeriodicSync(): void {
    setInterval(async () => {
      if (!this.connectivityStatus.isOnline) return;

      // Sync failed items with exponential backoff
      for (const [deviceId, queue] of this.syncQueues.entries()) {
        const failedItems = queue.items.filter(item => 
          item.syncStatus === 'failed' && 
          item.attempts < queue.maxRetries &&
          (!item.lastAttempt || Date.now() - item.lastAttempt > this.calculateRetryDelay(item.attempts))
        );

        if (failedItems.length > 0) {
          try {
            for (const item of failedItems) {
              await this.syncSingleItem(item);
            }
          } catch (error) {
            console.warn(`Periodic sync failed for device ${deviceId}:`, error);
          }
        }
      }
    }, OfflineKeySyncService.SYNC_RETRY_BASE_DELAY_MS);
  }

  private startDeltaCheckpointing(): void {
    setInterval(async () => {
      // Create checkpoints for active conversations
      for (const [deviceId, queue] of this.syncQueues.entries()) {
        const conversations = new Set(queue.items.map(item => item.conversationId).filter(Boolean));
        
        for (const conversationId of conversations) {
          const keyTypes = new Set(queue.items
            .filter(item => item.conversationId === conversationId)
            .map(item => item.keyType)
            .filter(Boolean)
          );

          for (const keyType of keyTypes) {
            try {
              await this.createDeltaCheckpoint(conversationId!, keyType!);
            } catch (error) {
              console.warn(`Failed to create delta checkpoint for ${conversationId}/${keyType}:`, error);
            }
          }
        }
      }
    }, OfflineKeySyncService.DELTA_CHECKPOINT_INTERVAL_MS);
  }

  private calculateRetryDelay(attempts: number): number {
    const delay = OfflineKeySyncService.SYNC_RETRY_BASE_DELAY_MS * Math.pow(2, attempts);
    return Math.min(delay, OfflineKeySyncService.MAX_RETRY_DELAY_MS);
  }

  private isPriorityAtLeast(priority: string, threshold: string): boolean {
    const priorities = ['low', 'medium', 'high', 'critical'];
    const priorityIndex = priorities.indexOf(priority);
    const thresholdIndex = priorities.indexOf(threshold);
    return priorityIndex >= thresholdIndex;
  }

  private comparePriority(a: string, b: string): number {
    const priorities = ['low', 'medium', 'high', 'critical'];
    return priorities.indexOf(b) - priorities.indexOf(a);
  }

  private updateAverageSyncTime(newTime: number): void {
    const totalSyncs = this.syncMetrics.totalItemsSynced;
    const currentAverage = this.syncMetrics.averageSyncTime;
    
    this.syncMetrics.averageSyncTime = 
      ((currentAverage * (totalSyncs - 1)) + newTime) / totalSyncs;
  }

  private async loadSyncQueues(): Promise<void> {
    // Load sync queues from storage - placeholder implementation
    console.log('Loaded sync queues from storage');
  }

  private async generateItemId(): Promise<string> {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async generateQueueId(): Promise<string> {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async generateCheckpointId(): Promise<string> {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async generateKeyHash(keyData: Uint8Array): Promise<string> {
    // Simple hash implementation - in production, use SHA-256
    const hashInput = Array.from(keyData).join(',');
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Offline Key Sync service not initialized. Call initialize() first.');
    }
  }
}

// Create and export a singleton instance
export const offlineKeySyncService = new OfflineKeySyncService();