/**
 * Device Identity and Trust Management Service
 * 
 * Manages device identities, authentication, and trust relationships for
 * multi-device key synchronization. Each device gets a unique cryptographic
 * identity that can be verified and trusted by other user devices.
 * 
 * Features:
 * - Unique device identity generation and management
 * - Device authentication and verification
 * - Trust relationship establishment
 * - Device revocation and blacklisting
 * - Cross-device verification protocols
 */

import { DilithiumService } from './DilithiumService';
import { X25519Service } from './X25519Service';
import { ChainKeyService } from './ChainKeyService';

export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
  deviceType: 'mobile' | 'desktop' | 'web' | 'tablet';
  userId: string;
  
  // Cryptographic identity keys
  signingKeys: {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };
  encryptionKeys: {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
  };
  
  // Device metadata
  createdAt: number;
  lastSeen: number;
  platform: string;
  version: string;
  
  // Trust information
  isVerified: boolean;
  trustLevel: 'unverified' | 'self-verified' | 'cross-verified' | 'revoked';
  verifiedBy: string[]; // Device IDs that have verified this device
}

export interface DeviceVerification {
  verifyingDeviceId: string;
  targetDeviceId: string;
  verificationCode: string;
  verificationMethod: 'manual' | 'qr_code' | 'numeric_code' | 'biometric';
  signature: Uint8Array;
  timestamp: number;
  expiresAt: number;
}

export interface DeviceTrustScore {
  deviceId: string;
  score: number; // 0-100
  factors: {
    timeKnown: number;
    verificationCount: number;
    activityConsistency: number;
    behaviorScore: number;
  };
  lastUpdated: number;
}

export interface CrossDeviceChallenge {
  challengeId: string;
  fromDeviceId: string;
  toDeviceId: string;
  challenge: Uint8Array;
  challengeType: 'identity_proof' | 'key_verification' | 'trust_establishment';
  createdAt: number;
  expiresAt: number;
}

/**
 * Device Identity Service
 * 
 * Manages cryptographic device identities and trust relationships
 * for secure multi-device key synchronization.
 */
export class DeviceIdentityService {
  private static readonly DEVICE_ID_LENGTH = 32;
  private static readonly VERIFICATION_CODE_LENGTH = 6;
  private static readonly VERIFICATION_EXPIRY_HOURS = 24;
  private static readonly CHALLENGE_EXPIRY_MINUTES = 15;
  private static readonly MAX_DEVICES_PER_USER = 10;
  
  private dilithiumService: DilithiumService;
  private x25519Service: X25519Service;
  private chainKeyService: ChainKeyService;
  
  private initialized: boolean = false;
  private currentDevice: DeviceIdentity | null = null;
  private trustedDevices: Map<string, DeviceIdentity> = new Map();
  private deviceTrustScores: Map<string, DeviceTrustScore> = new Map();

  constructor() {
    this.dilithiumService = new DilithiumService();
    this.x25519Service = new X25519Service();
    this.chainKeyService = new ChainKeyService();
  }

  /**
   * Initialize the device identity service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize cryptographic services
      await Promise.all([
        this.dilithiumService.initialize(),
        this.x25519Service.initialize(),
        this.chainKeyService.initialize()
      ]);

      // Load or create device identity
      await this.loadOrCreateDeviceIdentity();

      this.initialized = true;
      console.log('Device Identity Service initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize Device Identity service: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current device identity
   * 
   * @returns DeviceIdentity | null - Current device identity
   */
  getCurrentDevice(): DeviceIdentity | null {
    return this.currentDevice;
  }

  /**
   * Create a new device identity
   * 
   * @param userId - User ID this device belongs to
   * @param deviceName - Human-readable device name
   * @param deviceType - Type of device
   * @returns Promise<DeviceIdentity> - New device identity
   */
  async createDeviceIdentity(
    userId: string,
    deviceName: string,
    deviceType: 'mobile' | 'desktop' | 'web' | 'tablet'
  ): Promise<DeviceIdentity> {
    this.ensureInitialized();

    try {
      // Generate unique device ID
      const deviceId = await this.generateDeviceId();

      // Generate signing keys (Dilithium for quantum resistance)
      const signingKeys = await this.dilithiumService.generateKeyPair();

      // Generate encryption keys (X25519 for key exchange)
      const encryptionKeys = await this.x25519Service.generateKeyPair();

      // Get device information
      const deviceInfo = this.getDeviceInfo();

      const deviceIdentity: DeviceIdentity = {
        deviceId,
        deviceName,
        deviceType,
        userId,
        signingKeys,
        encryptionKeys,
        createdAt: Date.now(),
        lastSeen: Date.now(),
        platform: deviceInfo.platform,
        version: deviceInfo.version,
        isVerified: false,
        trustLevel: 'unverified',
        verifiedBy: []
      };

      // Set as current device
      this.currentDevice = deviceIdentity;

      // Store device identity
      await this.storeDeviceIdentity(deviceIdentity);

      console.log(`Created new device identity: ${deviceId}`);
      return deviceIdentity;
    } catch (error) {
      throw new Error(`Failed to create device identity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify another device using a verification code
   * 
   * @param targetDeviceId - Device to verify
   * @param verificationCode - Code provided by target device
   * @param method - Verification method used
   * @returns Promise<DeviceVerification> - Verification record
   */
  async verifyDevice(
    targetDeviceId: string,
    verificationCode: string,
    method: 'manual' | 'qr_code' | 'numeric_code' | 'biometric'
  ): Promise<DeviceVerification> {
    this.ensureInitialized();

    if (!this.currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Get target device info
      const targetDevice = await this.getDeviceById(targetDeviceId);
      if (!targetDevice) {
        throw new Error('Target device not found');
      }

      // Verify the verification code
      const isCodeValid = await this.validateVerificationCode(targetDeviceId, verificationCode);
      if (!isCodeValid) {
        throw new Error('Invalid verification code');
      }

      // Create verification data to sign
      const verificationData = this.createVerificationData(
        this.currentDevice.deviceId,
        targetDeviceId,
        verificationCode,
        method
      );

      // Sign the verification
      const signature = await this.dilithiumService.sign(
        this.currentDevice.signingKeys.privateKey,
        verificationData
      );

      const verification: DeviceVerification = {
        verifyingDeviceId: this.currentDevice.deviceId,
        targetDeviceId,
        verificationCode,
        verificationMethod: method,
        signature: signature.signature,
        timestamp: Date.now(),
        expiresAt: Date.now() + (DeviceIdentityService.VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000)
      };

      // Store verification
      await this.storeDeviceVerification(verification);

      // Update trust relationship
      await this.updateDeviceTrust(targetDeviceId, 'cross-verified');

      console.log(`Verified device ${targetDeviceId} using ${method}`);
      return verification;
    } catch (error) {
      throw new Error(`Device verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a verification code for this device
   * 
   * @param requestingDeviceId - Device requesting verification
   * @returns Promise<string> - Verification code
   */
  async generateVerificationCode(requestingDeviceId: string): Promise<string> {
    this.ensureInitialized();

    if (!this.currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Generate cryptographically secure code
      const codeBytes = this.generateSecureBytes(DeviceIdentityService.VERIFICATION_CODE_LENGTH);
      const code = Array.from(codeBytes)
        .map(byte => (byte % 10).toString())
        .join('');

      // Store code with expiration
      await this.storeVerificationCode(
        this.currentDevice.deviceId,
        requestingDeviceId,
        code,
        Date.now() + (DeviceIdentityService.VERIFICATION_EXPIRY_HOURS * 60 * 60 * 1000)
      );

      console.log(`Generated verification code for device ${requestingDeviceId}`);
      return code;
    } catch (error) {
      throw new Error(`Failed to generate verification code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a cross-device challenge for identity proof
   * 
   * @param targetDeviceId - Device to challenge
   * @param challengeType - Type of challenge
   * @returns Promise<CrossDeviceChallenge> - Challenge data
   */
  async createCrossDeviceChallenge(
    targetDeviceId: string,
    challengeType: 'identity_proof' | 'key_verification' | 'trust_establishment'
  ): Promise<CrossDeviceChallenge> {
    this.ensureInitialized();

    if (!this.currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      const challengeId = await this.generateChallengeId();
      const challenge = this.generateSecureBytes(32);

      const crossDeviceChallenge: CrossDeviceChallenge = {
        challengeId,
        fromDeviceId: this.currentDevice.deviceId,
        toDeviceId: targetDeviceId,
        challenge,
        challengeType,
        createdAt: Date.now(),
        expiresAt: Date.now() + (DeviceIdentityService.CHALLENGE_EXPIRY_MINUTES * 60 * 1000)
      };

      // Store challenge
      await this.storeCrossDeviceChallenge(crossDeviceChallenge);

      return crossDeviceChallenge;
    } catch (error) {
      throw new Error(`Failed to create cross-device challenge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Respond to a cross-device challenge
   * 
   * @param challengeId - Challenge ID
   * @param response - Challenge response
   * @returns Promise<boolean> - True if response is valid
   */
  async respondToCrossDeviceChallenge(challengeId: string, response: Uint8Array): Promise<boolean> {
    this.ensureInitialized();

    if (!this.currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Get challenge
      const challenge = await this.getCrossDeviceChallenge(challengeId);
      if (!challenge) {
        throw new Error('Challenge not found');
      }

      // Check expiration
      if (Date.now() > challenge.expiresAt) {
        throw new Error('Challenge expired');
      }

      // Verify response based on challenge type
      let isValid = false;
      switch (challenge.challengeType) {
        case 'identity_proof':
          isValid = await this.verifyIdentityProof(challenge, response);
          break;
        case 'key_verification':
          isValid = await this.verifyKeyProof(challenge, response);
          break;
        case 'trust_establishment':
          isValid = await this.verifyTrustProof(challenge, response);
          break;
      }

      if (isValid) {
        // Update trust scores
        await this.updateTrustScore(challenge.fromDeviceId, 10);
        await this.updateTrustScore(challenge.toDeviceId, 10);
      }

      // Clean up challenge
      await this.deleteCrossDeviceChallenge(challengeId);

      return isValid;
    } catch (error) {
      throw new Error(`Failed to respond to challenge: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get trusted devices for the current user
   * 
   * @returns Promise<DeviceIdentity[]> - List of trusted devices
   */
  async getTrustedDevices(): Promise<DeviceIdentity[]> {
    this.ensureInitialized();

    if (!this.currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      const devices = await this.getUserDevices(this.currentDevice.userId);
      return devices.filter(device => 
        device.trustLevel === 'self-verified' || 
        device.trustLevel === 'cross-verified'
      );
    } catch (error) {
      throw new Error(`Failed to get trusted devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Revoke a device (mark as untrusted)
   * 
   * @param deviceId - Device to revoke
   * @param reason - Reason for revocation
   * @returns Promise<void>
   */
  async revokeDevice(deviceId: string, reason: string): Promise<void> {
    this.ensureInitialized();

    if (!this.currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Update device trust level
      await this.updateDeviceTrust(deviceId, 'revoked');

      // Create revocation record
      const revocationData = {
        revokedDeviceId: deviceId,
        revokedBy: this.currentDevice.deviceId,
        reason,
        timestamp: Date.now()
      };

      // Sign revocation
      const signature = await this.dilithiumService.sign(
        this.currentDevice.signingKeys.privateKey,
        new TextEncoder().encode(JSON.stringify(revocationData))
      );

      // Store revocation
      await this.storeDeviceRevocation({
        ...revocationData,
        signature: signature.signature
      });

      // Remove from trusted devices
      this.trustedDevices.delete(deviceId);

      console.log(`Revoked device ${deviceId}: ${reason}`);
    } catch (error) {
      throw new Error(`Failed to revoke device: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Calculate device trust score
   * 
   * @param deviceId - Device to score
   * @returns Promise<DeviceTrustScore> - Trust score
   */
  async calculateTrustScore(deviceId: string): Promise<DeviceTrustScore> {
    this.ensureInitialized();

    try {
      const device = await this.getDeviceById(deviceId);
      if (!device) {
        throw new Error('Device not found');
      }

      const now = Date.now();
      const daysSinceCreation = (now - device.createdAt) / (24 * 60 * 60 * 1000);
      const daysSinceLastSeen = (now - device.lastSeen) / (24 * 60 * 60 * 1000);

      // Calculate trust factors
      const timeKnown = Math.min(daysSinceCreation / 30, 1) * 25; // Max 25 points for 30+ days
      const verificationCount = Math.min(device.verifiedBy.length * 10, 25); // Max 25 points
      const activityConsistency = Math.max(25 - daysSinceLastSeen, 0); // Lose points for inactivity
      const behaviorScore = device.trustLevel === 'cross-verified' ? 25 : 
                           device.trustLevel === 'self-verified' ? 15 : 
                           device.trustLevel === 'revoked' ? 0 : 10;

      const totalScore = Math.max(0, Math.min(100, 
        timeKnown + verificationCount + activityConsistency + behaviorScore
      ));

      const trustScore: DeviceTrustScore = {
        deviceId,
        score: Math.round(totalScore),
        factors: {
          timeKnown: Math.round(timeKnown),
          verificationCount: Math.round(verificationCount),
          activityConsistency: Math.round(activityConsistency),
          behaviorScore: Math.round(behaviorScore)
        },
        lastUpdated: now
      };

      // Cache the score
      this.deviceTrustScores.set(deviceId, trustScore);

      return trustScore;
    } catch (error) {
      throw new Error(`Failed to calculate trust score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export device identity for backup
   * 
   * @returns Promise<string> - Encrypted device identity data
   */
  async exportDeviceIdentity(passphrase: string): Promise<string> {
    this.ensureInitialized();

    if (!this.currentDevice) {
      throw new Error('No current device identity');
    }

    try {
      // Create export data
      const exportData = {
        deviceIdentity: {
          ...this.currentDevice,
          signingKeys: {
            publicKey: Array.from(this.currentDevice.signingKeys.publicKey),
            privateKey: Array.from(this.currentDevice.signingKeys.privateKey)
          },
          encryptionKeys: {
            publicKey: Array.from(this.currentDevice.encryptionKeys.publicKey),
            privateKey: Array.from(this.currentDevice.encryptionKeys.privateKey)
          }
        },
        exportedAt: Date.now(),
        version: '1.0'
      };

      // Encrypt with passphrase
      const encrypted = await this.encryptWithPassphrase(
        JSON.stringify(exportData),
        passphrase
      );

      return encrypted;
    } catch (error) {
      throw new Error(`Failed to export device identity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import device identity from backup
   * 
   * @param encryptedData - Encrypted device identity data
   * @param passphrase - Decryption passphrase
   * @returns Promise<DeviceIdentity> - Imported device identity
   */
  async importDeviceIdentity(encryptedData: string, passphrase: string): Promise<DeviceIdentity> {
    this.ensureInitialized();

    try {
      // Decrypt data
      const decryptedData = await this.decryptWithPassphrase(encryptedData, passphrase);
      const exportData = JSON.parse(decryptedData);

      // Validate export format
      if (!exportData.deviceIdentity || exportData.version !== '1.0') {
        throw new Error('Invalid export format');
      }

      // Reconstruct device identity
      const deviceIdentity: DeviceIdentity = {
        ...exportData.deviceIdentity,
        signingKeys: {
          publicKey: new Uint8Array(exportData.deviceIdentity.signingKeys.publicKey),
          privateKey: new Uint8Array(exportData.deviceIdentity.signingKeys.privateKey)
        },
        encryptionKeys: {
          publicKey: new Uint8Array(exportData.deviceIdentity.encryptionKeys.publicKey),
          privateKey: new Uint8Array(exportData.deviceIdentity.encryptionKeys.privateKey)
        }
      };

      // Set as current device
      this.currentDevice = deviceIdentity;

      // Store device identity
      await this.storeDeviceIdentity(deviceIdentity);

      console.log(`Imported device identity: ${deviceIdentity.deviceId}`);
      return deviceIdentity;
    } catch (error) {          throw new Error(`Failed to import device identity: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Private helper methods

  private async loadOrCreateDeviceIdentity(): Promise<void> {
    try {
      // Try to load existing device identity
      const stored = await this.loadStoredDeviceIdentity();
      if (stored) {
        this.currentDevice = stored;
        console.log(`Loaded existing device identity: ${stored.deviceId}`);
        return;
      }

      // No stored identity found - this is handled by the calling code
      console.log('No existing device identity found');
    } catch (error) {
      console.warn('Failed to load device identity:', error);
    }
  }

  private async generateDeviceId(): Promise<string> {
    const bytes = this.generateSecureBytes(DeviceIdentityService.DEVICE_ID_LENGTH);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private async generateChallengeId(): Promise<string> {
    const bytes = this.generateSecureBytes(16);
    return Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  private generateSecureBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  private getDeviceInfo(): { platform: string; version: string } {
    return {
      platform: navigator?.platform || 'unknown',
      version: navigator?.userAgent?.slice(0, 100) || 'unknown'
    };
  }

  private createVerificationData(
    verifyingDeviceId: string,
    targetDeviceId: string,
    verificationCode: string,
    method: string
  ): Uint8Array {
    const data = {
      verifyingDeviceId,
      targetDeviceId,
      verificationCode,
      method,
      timestamp: Date.now()
    };
    return new TextEncoder().encode(JSON.stringify(data));
  }

  private async verifyIdentityProof(challenge: CrossDeviceChallenge, response: Uint8Array): Promise<boolean> {
    // Implementation would verify that the response proves device identity
    // This is a simplified version - real implementation would be more complex
    return this.chainKeyService.constantTimeEquals(challenge.challenge, response);
  }

  private async verifyKeyProof(challenge: CrossDeviceChallenge, response: Uint8Array): Promise<boolean> {
    // Implementation would verify cryptographic key proof
    return this.chainKeyService.constantTimeEquals(challenge.challenge, response);
  }

  private async verifyTrustProof(challenge: CrossDeviceChallenge, response: Uint8Array): Promise<boolean> {
    // Implementation would verify trust establishment proof
    return this.chainKeyService.constantTimeEquals(challenge.challenge, response);
  }

  private async encryptWithPassphrase(data: string, passphrase: string): Promise<string> {
    // Simple passphrase-based encryption - in production, use proper PBKDF2/Argon2
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const passphraseBytes = encoder.encode(passphrase);
    
    // XOR with passphrase (NOT secure - placeholder implementation)
    const encrypted = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      encrypted[i] = dataBytes[i] ^ passphraseBytes[i % passphraseBytes.length];
    }
    
    return btoa(String.fromCharCode(...encrypted));
  }

  private async decryptWithPassphrase(encryptedData: string, passphrase: string): Promise<string> {
    // Simple passphrase-based decryption - in production, use proper cryptography
    const encrypted = new Uint8Array(atob(encryptedData).split('').map(c => c.charCodeAt(0)));
    const passphraseBytes = new TextEncoder().encode(passphrase);
    
    // XOR with passphrase (NOT secure - placeholder implementation)
    const decrypted = new Uint8Array(encrypted.length);
    for (let i = 0; i < encrypted.length; i++) {
      decrypted[i] = encrypted[i] ^ passphraseBytes[i % passphraseBytes.length];
    }
    
    return new TextDecoder().decode(decrypted);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Device Identity service not initialized. Call initialize() first.');
    }
  }

  // These methods would interact with the backend API or local storage
  private async storeDeviceIdentity(identity: DeviceIdentity): Promise<void> {
    // Store in local storage for now - in production, sync with backend
    localStorage.setItem('deviceIdentity', JSON.stringify({
      ...identity,
      signingKeys: {
        publicKey: Array.from(identity.signingKeys.publicKey),
        privateKey: Array.from(identity.signingKeys.privateKey)
      },
      encryptionKeys: {
        publicKey: Array.from(identity.encryptionKeys.publicKey),
        privateKey: Array.from(identity.encryptionKeys.privateKey)
      }
    }));
  }

  private async loadStoredDeviceIdentity(): Promise<DeviceIdentity | null> {
    const stored = localStorage.getItem('deviceIdentity');
    if (!stored) return null;

    try {
      const data = JSON.parse(stored);
      return {
        ...data,
        signingKeys: {
          publicKey: new Uint8Array(data.signingKeys.publicKey),
          privateKey: new Uint8Array(data.signingKeys.privateKey)
        },
        encryptionKeys: {
          publicKey: new Uint8Array(data.encryptionKeys.publicKey),
          privateKey: new Uint8Array(data.encryptionKeys.privateKey)
        }
      };
    } catch {
      return null;
    }
  }

  private async getDeviceById(deviceId: string): Promise<DeviceIdentity | null> {
    // Placeholder - would query backend API
    return this.trustedDevices.get(deviceId) || null;
  }

  private async getUserDevices(userId: string): Promise<DeviceIdentity[]> {
    // Placeholder - would query backend API
    return Array.from(this.trustedDevices.values()).filter(device => device.userId === userId);
  }

  private async validateVerificationCode(deviceId: string, code: string): Promise<boolean> {
    // Placeholder - would validate against stored codes
    return true;
  }

  private async updateDeviceTrust(deviceId: string, trustLevel: DeviceIdentity['trustLevel']): Promise<void> {
    // Placeholder - would update backend
    const device = this.trustedDevices.get(deviceId);
    if (device) {
      device.trustLevel = trustLevel;
      this.trustedDevices.set(deviceId, device);
    }
  }

  private async updateTrustScore(deviceId: string, delta: number): Promise<void> {
    // Placeholder - would update trust scores
    const score = this.deviceTrustScores.get(deviceId);
    if (score) {
      score.score = Math.max(0, Math.min(100, score.score + delta));
      score.lastUpdated = Date.now();
    }
  }

  private async storeVerificationCode(deviceId: string, requestingDeviceId: string, code: string, expiresAt: number): Promise<void> {
    // Placeholder - would store in backend
  }

  private async storeDeviceVerification(verification: DeviceVerification): Promise<void> {
    // Placeholder - would store in backend
  }

  private async storeCrossDeviceChallenge(challenge: CrossDeviceChallenge): Promise<void> {
    // Placeholder - would store in backend
  }

  private async getCrossDeviceChallenge(challengeId: string): Promise<CrossDeviceChallenge | null> {
    // Placeholder - would retrieve from backend
    return null;
  }

  private async deleteCrossDeviceChallenge(challengeId: string): Promise<void> {
    // Placeholder - would delete from backend
  }

  private async storeDeviceRevocation(revocation: any): Promise<void> {
    // Placeholder - would store in backend
  }
}

// Create and export a singleton instance
export const deviceIdentityService = new DeviceIdentityService();