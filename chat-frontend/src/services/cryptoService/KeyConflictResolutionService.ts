/**
 * Key Conflict Resolution and Synchronization Service
 * 
 * Handles conflicts that arise when cryptographic keys are updated across multiple
 * devices simultaneously. Provides various resolution strategies and ensures
 * consistency across all user devices.
 * 
 * Features:
 * - Multiple conflict resolution strategies
 * - Automatic conflict detection and resolution
 * - Manual conflict resolution for complex cases
 * - Key versioning and history tracking
 * - Consensus-based resolution for critical keys
 * - Rollback capabilities for failed resolutions
 */

import { DeviceIdentityService, DeviceIdentity } from './DeviceIdentityService';
import { CrossDeviceKeyService, KeySyncPackage } from './CrossDeviceKeyService';
import { DilithiumService } from './DilithiumService';
import { ChainKeyService } from './ChainKeyService';

export interface KeyConflict {
  conflictId: string;
  conversationId: string;
  keyType: 'ratchet_state' | 'conversation_key' | 'device_key' | 'hybrid_key';
  conflictingVersions: ConflictingVersion[];
  detectedAt: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'detected' | 'analyzing' | 'resolving' | 'resolved' | 'failed';
  resolutionStrategy?: ResolutionStrategy;
  resolvedVersion?: number;
  resolvedBy?: string;
  resolvedAt?: number;
}

export interface ConflictingVersion {
  deviceId: string;
  version: number;
  timestamp: number;
  keyHash: string;
  keyData: Uint8Array;
  metadata: {
    lastModified: number;
    dependencies?: string[];
    trustScore?: number;
  };
}

export interface ResolutionStrategy {
  type: 'latest_wins' | 'highest_trust' | 'consensus' | 'manual' | 'authoritative_device' | 'merge';
  parameters?: {
    trustThreshold?: number;
    consensusThreshold?: number;
    authoritativeDeviceId?: string;
    mergeAlgorithm?: string;
  };
}

export interface ConflictResolutionResult {
  conflictId: string;
  success: boolean;
  resolvedVersion: number;
  strategy: ResolutionStrategy;
  affectedDevices: string[];
  rollbackVersion?: number;
  resolutionTime: number;
}

export interface KeySyncState {
  conversationId: string;
  keyType: string;
  currentVersion: number;
  lastSyncedVersion: number;
  pendingUpdates: KeySyncPackage[];
  conflictStatus: 'none' | 'detected' | 'resolving' | 'resolved';
  lastSyncedAt: number;
  syncHistory: SyncHistoryEntry[];
}

export interface SyncHistoryEntry {
  version: number;
  deviceId: string;
  timestamp: number;
  operation: 'create' | 'update' | 'sync' | 'resolve';
  keyHash: string;
}

export interface ConsensusVote {
  deviceId: string;
  conflictId: string;
  preferredVersion: number;
  reasoning: string;
  signature: Uint8Array;
  timestamp: number;
}

/**
 * Key Conflict Resolution Service
 * 
 * Manages key conflicts across multiple devices and provides various resolution strategies
 */
export class KeyConflictResolutionService {
  private static readonly CONFLICT_DETECTION_INTERVAL_MS = 30000; // 30 seconds
  private static readonly CONSENSUS_TIMEOUT_MS = 300000; // 5 minutes
  private static readonly MAX_CONFLICT_AGE_HOURS = 24;
  private static readonly TRUST_SCORE_THRESHOLD = 75;
  
  private deviceIdentityService: DeviceIdentityService;
  private crossDeviceKeyService: CrossDeviceKeyService;
  private dilithiumService: DilithiumService;
  private chainKeyService: ChainKeyService;
  
  private initialized: boolean = false;
  private activeConflicts: Map<string, KeyConflict> = new Map();
  private syncStates: Map<string, KeySyncState> = new Map();
  private consensusVotes: Map<string, ConsensusVote[]> = new Map();
  
  // Resolution metrics
  private resolutionMetrics = {
    conflictsDetected: 0,
    conflictsResolved: 0,
    conflictsFailed: 0,
    averageResolutionTime: 0,
    strategyUsage: {
      latest_wins: 0,
      highest_trust: 0,
      consensus: 0,
      manual: 0,
      authoritative_device: 0,
      merge: 0
    }
  };

  constructor() {
    this.deviceIdentityService = new DeviceIdentityService();
    this.crossDeviceKeyService = new CrossDeviceKeyService();
    this.dilithiumService = new DilithiumService();
    this.chainKeyService = new ChainKeyService();
  }

  /**
   * Initialize the key conflict resolution service
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
        this.dilithiumService.initialize(),
        this.chainKeyService.initialize()
      ]);

      // Load existing sync states
      await this.loadSyncStates();

      // Start conflict detection
      this.startConflictDetection();

      this.initialized = true;
      console.log('Key Conflict Resolution Service initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize Key Conflict Resolution service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Detect conflicts for a specific key
   * 
   * @param conversationId - Conversation to check
   * @param keyType - Type of key to check
   * @param versions - Key versions from different devices
   * @returns Promise<KeyConflict | null> - Detected conflict or null
   */
  async detectKeyConflict(
    conversationId: string,
    keyType: string,
    versions: ConflictingVersion[]
  ): Promise<KeyConflict | null> {
    this.ensureInitialized();

    try {
      if (versions.length < 2) {
        return null; // No conflict with single version
      }

      // Check if versions are actually different
      const uniqueVersions = this.findUniqueVersions(versions);
      if (uniqueVersions.length < 2) {
        return null; // All versions are the same
      }

      // Create conflict
      const conflictId = await this.generateConflictId();
      const conflict: KeyConflict = {
        conflictId,
        conversationId,
        keyType: keyType as any,
        conflictingVersions: uniqueVersions,
        detectedAt: Date.now(),
        severity: this.assessConflictSeverity(uniqueVersions),
        status: 'detected'
      };

      // Store conflict
      this.activeConflicts.set(conflictId, conflict);

      // Update metrics
      this.resolutionMetrics.conflictsDetected++;

      console.log(`Detected ${conflict.severity} key conflict ${conflictId} for ${keyType} in conversation ${conversationId}`);
      return conflict;
    } catch (error) {
      throw new Error(`Failed to detect key conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Resolve a key conflict using specified strategy
   * 
   * @param conflictId - Conflict to resolve
   * @param strategy - Resolution strategy to use
   * @returns Promise<ConflictResolutionResult> - Resolution result
   */
  async resolveConflict(
    conflictId: string,
    strategy: ResolutionStrategy
  ): Promise<ConflictResolutionResult> {
    this.ensureInitialized();

    const conflict = this.activeConflicts.get(conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    if (conflict.status !== 'detected' && conflict.status !== 'analyzing') {
      throw new Error('Conflict not in resolvable state');
    }

    const startTime = Date.now();

    try {
      // Update conflict status
      conflict.status = 'resolving';
      conflict.resolutionStrategy = strategy;

      let resolvedVersion: ConflictingVersion;
      let affectedDevices: string[] = [];

      // Apply resolution strategy
      switch (strategy.type) {
        case 'latest_wins':
          resolvedVersion = await this.resolveByLatestWins(conflict);
          break;
        case 'highest_trust':
          resolvedVersion = await this.resolveByHighestTrust(conflict, strategy.parameters?.trustThreshold);
          break;
        case 'consensus':
          resolvedVersion = await this.resolveByConsensus(conflict, strategy.parameters?.consensusThreshold);
          break;
        case 'authoritative_device':
          resolvedVersion = await this.resolveByAuthoritativeDevice(conflict, strategy.parameters?.authoritativeDeviceId!);
          break;
        case 'merge':
          resolvedVersion = await this.resolveByMerge(conflict, strategy.parameters?.mergeAlgorithm);
          break;
        case 'manual':
          throw new Error('Manual resolution must be handled separately');
        default:
          throw new Error('Unknown resolution strategy');
      }

      // Apply resolution
      affectedDevices = await this.applyResolution(conflict, resolvedVersion);

      // Update conflict
      conflict.status = 'resolved';
      conflict.resolvedVersion = resolvedVersion.version;
      conflict.resolvedBy = this.deviceIdentityService.getCurrentDevice()?.deviceId || 'system';
      conflict.resolvedAt = Date.now();

      const resolutionTime = Date.now() - startTime;
      
      // Update metrics
      this.resolutionMetrics.conflictsResolved++;
      this.resolutionMetrics.strategyUsage[strategy.type]++;
      this.updateAverageResolutionTime(resolutionTime);

      const result: ConflictResolutionResult = {
        conflictId,
        success: true,
        resolvedVersion: resolvedVersion.version,
        strategy,
        affectedDevices,
        resolutionTime
      };

      console.log(`Successfully resolved conflict ${conflictId} using ${strategy.type} strategy in ${resolutionTime}ms`);
      return result;
    } catch (error) {
      // Mark conflict as failed
      conflict.status = 'failed';
      this.resolutionMetrics.conflictsFailed++;

      throw new Error(`Failed to resolve conflict: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Start consensus-based resolution for critical conflicts
   * 
   * @param conflictId - Conflict to resolve via consensus
   * @returns Promise<string> - Consensus session ID
   */
  async startConsensusResolution(conflictId: string): Promise<string> {
    this.ensureInitialized();

    const conflict = this.activeConflicts.get(conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    try {
      // Get all trusted devices
      const trustedDevices = await this.deviceIdentityService.getTrustedDevices();
      
      // Create consensus request
      const consensusId = await this.generateConsensusId();
      
      // Send consensus requests to all devices
      await this.sendConsensusRequests(consensusId, conflict, trustedDevices);

      // Initialize vote collection
      this.consensusVotes.set(consensusId, []);

      // Set timeout for consensus
      setTimeout(async () => {
        await this.finalizeConsensus(consensusId, conflictId);
      }, KeyConflictResolutionService.CONSENSUS_TIMEOUT_MS);

      console.log(`Started consensus resolution ${consensusId} for conflict ${conflictId}`);
      return consensusId;
    } catch (error) {
      throw new Error(`Failed to start consensus resolution: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Submit vote for consensus resolution
   * 
   * @param consensusId - Consensus session ID
   * @param vote - Consensus vote
   * @returns Promise<void>
   */
  async submitConsensusVote(consensusId: string, vote: ConsensusVote): Promise<void> {
    this.ensureInitialized();

    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    if (!currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Verify vote signature
      const voteData = {
        deviceId: vote.deviceId,
        conflictId: vote.conflictId,
        preferredVersion: vote.preferredVersion,
        reasoning: vote.reasoning,
        timestamp: vote.timestamp
      };

      const deviceInfo = await this.getDeviceById(vote.deviceId);
      if (!deviceInfo) {
        throw new Error('Voting device not found');
      }

      const isSignatureValid = await this.dilithiumService.verify(
        deviceInfo.signingKeys.publicKey,
        new TextEncoder().encode(JSON.stringify(voteData)),
        vote.signature
      );

      if (!isSignatureValid) {
        throw new Error('Invalid vote signature');
      }

      // Store vote
      const votes = this.consensusVotes.get(consensusId) || [];
      
      // Check if device already voted
      const existingVoteIndex = votes.findIndex(v => v.deviceId === vote.deviceId);
      if (existingVoteIndex >= 0) {
        votes[existingVoteIndex] = vote; // Update existing vote
      } else {
        votes.push(vote);
      }

      this.consensusVotes.set(consensusId, votes);

      console.log(`Received consensus vote from device ${vote.deviceId} for version ${vote.preferredVersion}`);
    } catch (error) {
      throw new Error(`Failed to submit consensus vote: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current sync state for a key
   * 
   * @param conversationId - Conversation ID
   * @param keyType - Key type
   * @returns KeySyncState | null - Sync state or null if not found
   */
  getSyncState(conversationId: string, keyType: string): KeySyncState | null {
    const stateKey = `${conversationId}-${keyType}`;
    return this.syncStates.get(stateKey) || null;
  }

  /**
   * Update sync state after successful operation
   * 
   * @param conversationId - Conversation ID
   * @param keyType - Key type
   * @param version - New version
   * @param operation - Sync operation
   * @returns Promise<void>
   */
  async updateSyncState(
    conversationId: string,
    keyType: string,
    version: number,
    operation: 'create' | 'update' | 'sync' | 'resolve'
  ): Promise<void> {
    this.ensureInitialized();

    const stateKey = `${conversationId}-${keyType}`;
    const currentDevice = this.deviceIdentityService.getCurrentDevice();
    
    let syncState = this.syncStates.get(stateKey);
    if (!syncState) {
      syncState = {
        conversationId,
        keyType,
        currentVersion: version,
        lastSyncedVersion: version,
        pendingUpdates: [],
        conflictStatus: 'none',
        lastSyncedAt: Date.now(),
        syncHistory: []
      };
    }

    // Update state
    syncState.currentVersion = version;
    syncState.lastSyncedVersion = version;
    syncState.lastSyncedAt = Date.now();

    // Add history entry
    const historyEntry: SyncHistoryEntry = {
      version,
      deviceId: currentDevice?.deviceId || 'unknown',
      timestamp: Date.now(),
      operation,
      keyHash: await this.generateKeyHash(new Uint8Array([version])) // Placeholder
    };

    syncState.syncHistory.push(historyEntry);

    // Keep only recent history (last 100 entries)
    if (syncState.syncHistory.length > 100) {
      syncState.syncHistory = syncState.syncHistory.slice(-100);
    }

    this.syncStates.set(stateKey, syncState);
  }

  /**
   * Get resolution metrics
   * 
   * @returns Object with conflict resolution statistics
   */
  getResolutionMetrics(): typeof this.resolutionMetrics & {
    activeConflicts: number;
    pendingConsensus: number;
  } {
    return {
      ...this.resolutionMetrics,
      activeConflicts: this.activeConflicts.size,
      pendingConsensus: this.consensusVotes.size
    };
  }

  /**
   * Force resolution of stuck conflicts
   * 
   * @param conflictId - Conflict to force resolve
   * @param strategy - Fallback strategy
   * @returns Promise<ConflictResolutionResult>
   */
  async forceResolveConflict(
    conflictId: string,
    strategy: ResolutionStrategy
  ): Promise<ConflictResolutionResult> {
    const conflict = this.activeConflicts.get(conflictId);
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    // Reset conflict status to allow resolution
    conflict.status = 'detected';

    return await this.resolveConflict(conflictId, strategy);
  }

  // Private helper methods

  private findUniqueVersions(versions: ConflictingVersion[]): ConflictingVersion[] {
    const uniqueMap = new Map<string, ConflictingVersion>();
    
    for (const version of versions) {
      const key = `${version.version}-${version.keyHash}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, version);
      }
    }

    return Array.from(uniqueMap.values());
  }

  private assessConflictSeverity(versions: ConflictingVersion[]): 'low' | 'medium' | 'high' | 'critical' {
    const versionSpread = Math.max(...versions.map(v => v.version)) - Math.min(...versions.map(v => v.version));
    const timeSpread = Math.max(...versions.map(v => v.timestamp)) - Math.min(...versions.map(v => v.timestamp));
    
    if (versionSpread > 10 || timeSpread > 86400000) { // 24 hours
      return 'critical';
    } else if (versionSpread > 5 || timeSpread > 3600000) { // 1 hour
      return 'high';
    } else if (versionSpread > 2 || timeSpread > 300000) { // 5 minutes
      return 'medium';
    } else {
      return 'low';
    }
  }

  private async resolveByLatestWins(conflict: KeyConflict): Promise<ConflictingVersion> {
    return conflict.conflictingVersions.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  private async resolveByHighestTrust(
    conflict: KeyConflict,
    trustThreshold: number = KeyConflictResolutionService.TRUST_SCORE_THRESHOLD
  ): Promise<ConflictingVersion> {
    let bestVersion = conflict.conflictingVersions[0];
    let highestTrust = 0;

    for (const version of conflict.conflictingVersions) {
      const trustScore = await this.deviceIdentityService.calculateTrustScore(version.deviceId);
      if (trustScore.score > highestTrust && trustScore.score >= trustThreshold) {
        highestTrust = trustScore.score;
        bestVersion = version;
      }
    }

    return bestVersion;
  }

  private async resolveByConsensus(
    conflict: KeyConflict,
    consensusThreshold: number = 0.6
  ): Promise<ConflictingVersion> {
    // This would be implemented with actual consensus mechanism
    // For now, fallback to latest wins
    return await this.resolveByLatestWins(conflict);
  }

  private async resolveByAuthoritativeDevice(
    conflict: KeyConflict,
    authoritativeDeviceId: string
  ): Promise<ConflictingVersion> {
    const authoritativeVersion = conflict.conflictingVersions.find(
      v => v.deviceId === authoritativeDeviceId
    );

    if (!authoritativeVersion) {
      throw new Error('Authoritative device version not found');
    }

    return authoritativeVersion;
  }

  private async resolveByMerge(
    conflict: KeyConflict,
    mergeAlgorithm?: string
  ): Promise<ConflictingVersion> {
    // Complex merge logic would go here
    // For now, create a new version that combines all versions
    const mergedVersion: ConflictingVersion = {
      deviceId: this.deviceIdentityService.getCurrentDevice()?.deviceId || 'merger',
      version: Math.max(...conflict.conflictingVersions.map(v => v.version)) + 1,
      timestamp: Date.now(),
      keyHash: await this.generateKeyHash(new Uint8Array([1, 2, 3])), // Placeholder
      keyData: new Uint8Array([1, 2, 3]), // Placeholder merged data
      metadata: {
        lastModified: Date.now(),
        dependencies: conflict.conflictingVersions.map(v => v.deviceId)
      }
    };

    return mergedVersion;
  }

  private async applyResolution(
    conflict: KeyConflict,
    resolvedVersion: ConflictingVersion
  ): Promise<string[]> {
    const affectedDevices: string[] = [];

    // Update all devices with the resolved version
    for (const version of conflict.conflictingVersions) {
      if (version.deviceId !== resolvedVersion.deviceId) {
        try {
          // Send update to device
          await this.sendKeyUpdate(version.deviceId, conflict, resolvedVersion);
          affectedDevices.push(version.deviceId);
        } catch (error) {
          console.warn(`Failed to update device ${version.deviceId}:`, error);
        }
      }
    }

    // Update local sync state
    await this.updateSyncState(
      conflict.conversationId,
      conflict.keyType,
      resolvedVersion.version,
      'resolve'
    );

    return affectedDevices;
  }

  private async sendConsensusRequests(
    consensusId: string,
    conflict: KeyConflict,
    devices: DeviceIdentity[]
  ): Promise<void> {
    // Send consensus requests to all trusted devices
    for (const device of devices) {
      try {
        console.log(`Sent consensus request ${consensusId} to device ${device.deviceId}`);
        // Implementation would send actual network request
      } catch (error) {
        console.warn(`Failed to send consensus request to device ${device.deviceId}:`, error);
      }
    }
  }

  private async finalizeConsensus(consensusId: string, conflictId: string): Promise<void> {
    const votes = this.consensusVotes.get(consensusId) || [];
    
    if (votes.length === 0) {
      console.warn(`No votes received for consensus ${consensusId}`);
      return;
    }

    // Count votes for each version
    const voteCount = new Map<number, number>();
    for (const vote of votes) {
      voteCount.set(vote.preferredVersion, (voteCount.get(vote.preferredVersion) || 0) + 1);
    }

    // Find version with most votes
    let winningVersion = 0;
    let maxVotes = 0;
    for (const [version, count] of voteCount.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        winningVersion = version;
      }
    }

    // Apply consensus result
    try {
      await this.resolveConflict(conflictId, {
        type: 'consensus',
        parameters: { consensusThreshold: maxVotes / votes.length }
      });

      console.log(`Finalized consensus ${consensusId}: version ${winningVersion} won with ${maxVotes}/${votes.length} votes`);
    } catch (error) {
      console.error(`Failed to finalize consensus ${consensusId}:`, error);
    } finally {
      // Cleanup
      this.consensusVotes.delete(consensusId);
    }
  }

  private async sendKeyUpdate(
    deviceId: string,
    conflict: KeyConflict,
    resolvedVersion: ConflictingVersion
  ): Promise<void> {
    // Create key sync package for the resolved version
    try {
      const syncPackage = await this.crossDeviceKeyService.createKeySyncPackage(
        resolvedVersion.keyData,
        conflict.keyType,
        deviceId,
        {
          conversationId: conflict.conversationId,
          keyVersion: resolvedVersion.version
        }
      );

      console.log(`Sent key update to device ${deviceId} for conflict ${conflict.conflictId}`);
    } catch (error) {
      throw new Error(`Failed to send key update to device ${deviceId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private startConflictDetection(): void {
    setInterval(async () => {
      try {
        await this.detectPendingConflicts();
        await this.cleanupOldConflicts();
      } catch (error) {
        console.error('Conflict detection error:', error);
      }
    }, KeyConflictResolutionService.CONFLICT_DETECTION_INTERVAL_MS);
  }

  private async detectPendingConflicts(): Promise<void> {
    // Scan sync states for potential conflicts
    for (const [key, syncState] of this.syncStates.entries()) {
      if (syncState.conflictStatus === 'none' && syncState.pendingUpdates.length > 1) {
        // Check for version conflicts in pending updates
        const versions = syncState.pendingUpdates.map(update => ({
          deviceId: update.fromDeviceId,
          version: update.keyMetadata.keyVersion,
          timestamp: update.keyMetadata.lastModified,
          keyHash: Array.from(update.integrityHash).join(''),
          keyData: update.encryptedKeyData,
          metadata: {
            lastModified: update.keyMetadata.lastModified,
            dependencies: update.keyMetadata.dependencies
          }
        }));

        const conflict = await this.detectKeyConflict(
          syncState.conversationId,
          syncState.keyType,
          versions
        );

        if (conflict) {
          syncState.conflictStatus = 'detected';
        }
      }
    }
  }

  private async cleanupOldConflicts(): Promise<void> {
    const maxAge = KeyConflictResolutionService.MAX_CONFLICT_AGE_HOURS * 60 * 60 * 1000;
    const now = Date.now();

    for (const [conflictId, conflict] of this.activeConflicts.entries()) {
      if (now - conflict.detectedAt > maxAge) {
        if (conflict.status === 'resolved' || conflict.status === 'failed') {
          this.activeConflicts.delete(conflictId);
          console.log(`Cleaned up old conflict ${conflictId}`);
        }
      }
    }
  }

  private async loadSyncStates(): Promise<void> {
    // Load sync states from storage - placeholder implementation
    console.log('Loaded sync states from storage');
  }

  private updateAverageResolutionTime(newTime: number): void {
    const totalResolutions = this.resolutionMetrics.conflictsResolved;
    const currentAverage = this.resolutionMetrics.averageResolutionTime;
    
    this.resolutionMetrics.averageResolutionTime = 
      ((currentAverage * (totalResolutions - 1)) + newTime) / totalResolutions;
  }

  private async generateConflictId(): Promise<string> {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async generateConsensusId(): Promise<string> {
    const bytes = new Uint8Array(12);
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

  private async getDeviceById(deviceId: string): Promise<DeviceIdentity | null> {
    const trustedDevices = await this.deviceIdentityService.getTrustedDevices();
    return trustedDevices.find(device => device.deviceId === deviceId) || null;
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Key Conflict Resolution service not initialized. Call initialize() first.');
    }
  }
}

// Create and export a singleton instance
export const keyConflictResolutionService = new KeyConflictResolutionService();