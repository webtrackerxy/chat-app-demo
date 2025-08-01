/**
 * Backend Encryption Coordinator Service
 * 
 * Handles server-side encryption coordination without access to plaintext.
 * Manages encrypted message storage, key exchange coordination, and
 * multi-device synchronization routing.
 * 
 * IMPORTANT: This service never handles plaintext messages or private keys.
 * All encryption/decryption happens on client devices.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

class EncryptionCoordinatorService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Store encrypted message with metadata
   * Server never sees plaintext - only encrypted data
   */
  async storeEncryptedMessage({
    conversationId,
    senderId,
    encryptedContent,
    encryptionMetadata,
    messageType = 'text'
  }) {
    try {
      // Validate encryption metadata
      this.validateEncryptionMetadata(encryptionMetadata);

      const message = await this.prisma.message.create({
        data: {
          conversationId,
          senderId,
          text: encryptedContent, // This is encrypted ciphertext
          encrypted: true,
          
          // Perfect Forward Secrecy fields
          ratchetEncrypted: encryptionMetadata.ratchetEncrypted || false,
          ephemeralPublicKey: encryptionMetadata.ephemeralPublicKey,
          messageNumber: encryptionMetadata.messageNumber,
          chainLength: encryptionMetadata.chainLength,
          previousChainLength: encryptionMetadata.previousChainLength,
          ratchetHeader: JSON.stringify(encryptionMetadata.ratchetHeader || {}),
          
          // Post-Quantum Cryptography fields
          cryptoVersion: encryptionMetadata.cryptoVersion || '1.0',
          algorithm: encryptionMetadata.algorithm || 'hybrid',
          securityLevel: encryptionMetadata.securityLevel || 3,
          pqcEncrypted: encryptionMetadata.pqcEncrypted || false,
          kyberCiphertext: encryptionMetadata.kyberCiphertext,
          dilithiumSignature: encryptionMetadata.dilithiumSignature,
          hybridMetadata: JSON.stringify(encryptionMetadata.hybridMetadata || {}),
          negotiationId: encryptionMetadata.negotiationId,
          
          timestamp: new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`Stored encrypted message ${message.id} for conversation ${conversationId}`);
      return message;
    } catch (error) {
      console.error('Failed to store encrypted message:', error);
      throw new Error(`Failed to store encrypted message: ${error.message}`);
    }
  }

  /**
   * Retrieve encrypted messages for a conversation
   * Returns encrypted data that clients will decrypt
   */
  async getEncryptedMessages(conversationId, userId, limit = 50, offset = 0) {
    try {
      // Verify user has access to conversation
      const hasAccess = await this.verifyConversationAccess(conversationId, userId);
      if (!hasAccess) {
        throw new Error('Access denied to conversation');
      }

      const messages = await this.prisma.message.findMany({
        where: {
          conversationId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset,
        include: {
          sender: {
            select: {
              id: true,
              username: true
            }
          }
        }
      });

      // Return encrypted messages with metadata
      return messages.map(message => ({
        id: message.id,
        senderId: message.senderId,
        senderUsername: message.sender.username,
        encryptedContent: message.text, // This is encrypted
        encryptionMetadata: {
          encrypted: message.encrypted,
          ratchetEncrypted: message.ratchetEncrypted,
          ephemeralPublicKey: message.ephemeralPublicKey,
          messageNumber: message.messageNumber,
          chainLength: message.chainLength,
          previousChainLength: message.previousChainLength,
          ratchetHeader: message.ratchetHeader ? JSON.parse(message.ratchetHeader) : {},
          cryptoVersion: message.cryptoVersion,
          algorithm: message.algorithm,
          securityLevel: message.securityLevel,
          pqcEncrypted: message.pqcEncrypted,
          kyberCiphertext: message.kyberCiphertext,
          dilithiumSignature: message.dilithiumSignature,
          hybridMetadata: message.hybridMetadata ? JSON.parse(message.hybridMetadata) : {},
          negotiationId: message.negotiationId
        },
        timestamp: message.timestamp,
        createdAt: message.createdAt
      }));
    } catch (error) {
      console.error('Failed to retrieve encrypted messages:', error);
      throw new Error(`Failed to retrieve messages: ${error.message}`);
    }
  }

  /**
   * Coordinate key exchange without accessing keys
   * Facilitates secure key exchange between clients
   */
  async coordinateKeyExchange({
    initiatorId,
    recipientId,
    conversationId,
    exchangeType,
    encryptedKeyData,
    publicKeyInfo
  }) {
    try {
      // Store key exchange request
      const keyExchange = await this.prisma.keyExchange.create({
        data: {
          initiatorId,
          recipientId,
          conversationId,
          exchangeType, // 'initial', 'ratchet_update', 'pqc_upgrade'
          encryptedKeyData, // Encrypted for recipient
          publicKeyInfo: JSON.stringify(publicKeyInfo),
          status: 'pending',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
        }
      });

      // Notify recipient (through WebSocket, push notification, etc.)
      await this.notifyKeyExchange(recipientId, keyExchange.id);

      console.log(`Key exchange ${keyExchange.id} initiated between ${initiatorId} and ${recipientId}`);
      return keyExchange;
    } catch (error) {
      console.error('Failed to coordinate key exchange:', error);
      throw new Error(`Failed to coordinate key exchange: ${error.message}`);
    }
  }

  /**
   * Handle multi-device key sync coordination
   * Routes encrypted key packages between user's devices
   */
  async coordinateMultiDeviceSync({
    userId,
    fromDeviceId,
    toDeviceId,
    encryptedKeyPackage,
    packageMetadata
  }) {
    try {
      // Verify devices belong to the same user
      const devicesValid = await this.verifyDeviceOwnership(userId, [fromDeviceId, toDeviceId]);
      if (!devicesValid) {
        throw new Error('Device ownership verification failed');
      }

      // Store sync package
      const syncPackage = await this.prisma.keySyncPackage.create({
        data: {
          packageId: this.generatePackageId(),
          fromDeviceId,
          toDeviceId,
          keyType: packageMetadata.keyType,
          conversationId: packageMetadata.conversationId,
          encryptedKeyData: encryptedKeyPackage.encryptedData,
          integrityHash: encryptedKeyPackage.integrityHash,
          signature: encryptedKeyPackage.signature,
          keyMetadata: JSON.stringify(packageMetadata),
          encryptionMethod: encryptedKeyPackage.encryptionMethod,
          syncPriority: packageMetadata.priority || 'medium',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: 'pending'
        }
      });

      // Notify target device
      await this.notifyDeviceSync(toDeviceId, syncPackage.id);

      console.log(`Multi-device sync package ${syncPackage.id} created for devices ${fromDeviceId} -> ${toDeviceId}`);
      return syncPackage;
    } catch (error) {
      console.error('Failed to coordinate multi-device sync:', error);
      throw new Error(`Failed to coordinate multi-device sync: ${error.message}`);
    }
  }

  /**
   * Store algorithm negotiation results
   * Tracks which encryption algorithms were negotiated between clients
   */
  async storeAlgorithmNegotiation({
    conversationId,
    initiatorId,
    responderId,
    negotiationResult
  }) {
    try {
      const negotiation = await this.prisma.algorithmNegotiation.create({
        data: {
          conversationId,
          initiatorId,
          responderId,
          negotiationId: this.generateNegotiationId(),
          selectedKeyExchange: negotiationResult.keyExchange,
          selectedSignature: negotiationResult.signature,
          selectedEncryption: negotiationResult.encryption,
          achievedSecurityLevel: negotiationResult.securityLevel,
          quantumResistant: negotiationResult.quantumResistant,
          hybridMode: negotiationResult.hybridMode,
          protocolVersion: negotiationResult.protocolVersion,
          supportsPFS: negotiationResult.supportsPFS,
          supportsDoubleRatchet: negotiationResult.supportsDoubleRatchet,
          localCapabilities: JSON.stringify(negotiationResult.localCapabilities),
          remoteCapabilities: JSON.stringify(negotiationResult.remoteCapabilities),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          isActive: true
        }
      });

      console.log(`Algorithm negotiation ${negotiation.negotiationId} stored for conversation ${conversationId}`);
      return negotiation;
    } catch (error) {
      console.error('Failed to store algorithm negotiation:', error);
      throw new Error(`Failed to store algorithm negotiation: ${error.message}`);
    }
  }

  /**
   * Manage device authentication sessions
   * Coordinates device verification without handling private keys
   */
  async manageDeviceAuthentication({
    initiatorDeviceId,
    responderDeviceId,
    method,
    challengeData,
    sessionId
  }) {
    try {
      const authSession = await this.prisma.authenticationSession.create({
        data: {
          sessionId,
          initiatorDeviceId,
          responderDeviceId,
          method,
          challenge: challengeData.challenge,
          verificationCode: challengeData.verificationCode,
          status: 'pending',
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
        }
      });

      // Notify responder device
      await this.notifyDeviceAuthentication(responderDeviceId, sessionId);

      console.log(`Device authentication session ${sessionId} created`);
      return authSession;
    } catch (error) {
      console.error('Failed to manage device authentication:', error);
      throw new Error(`Failed to manage device authentication: ${error.message}`);
    }
  }

  /**
   * Handle conflict resolution coordination
   * Manages key conflict resolution without accessing key content
   */
  async coordinateConflictResolution({
    conversationId,
    keyType,
    conflictingVersions,
    resolutionStrategy
  }) {
    try {
      const conflictId = this.generateConflictId();
      
      const conflict = await this.prisma.keyConflict.create({
        data: {
          conflictId,
          conversationId,
          keyType,
          severity: this.assessConflictSeverity(conflictingVersions),
          status: 'detected',
          conflictingVersions: JSON.stringify(conflictingVersions),
          resolutionMetadata: JSON.stringify({ strategy: resolutionStrategy }),
          detectedAt: new Date()
        }
      });

      // Notify relevant devices about conflict
      await this.notifyConflictDetection(conversationId, conflictId);

      console.log(`Key conflict ${conflictId} detected for ${keyType} in conversation ${conversationId}`);
      return conflict;
    } catch (error) {
      console.error('Failed to coordinate conflict resolution:', error);
      throw new Error(`Failed to coordinate conflict resolution: ${error.message}`);
    }
  }

  // Private helper methods

  validateEncryptionMetadata(metadata) {
    const required = ['algorithm', 'cryptoVersion'];
    for (const field of required) {
      if (!metadata[field]) {
        throw new Error(`Missing required encryption metadata: ${field}`);
      }
    }
  }

  async verifyConversationAccess(conversationId, userId) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId
        }
      }
    });
    return participant !== null;
  }

  async verifyDeviceOwnership(userId, deviceIds) {
    for (const deviceId of deviceIds) {
      const device = await this.prisma.deviceIdentity.findUnique({
        where: { deviceId }
      });
      if (!device || device.userId !== userId) {
        return false;
      }
    }
    return true;
  }

  generatePackageId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateNegotiationId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateConflictId() {
    return crypto.randomBytes(16).toString('hex');
  }

  assessConflictSeverity(versions) {
    const versionSpread = Math.max(...versions.map(v => v.version)) - 
                         Math.min(...versions.map(v => v.version));
    
    if (versionSpread > 10) return 'critical';
    if (versionSpread > 5) return 'high';
    if (versionSpread > 2) return 'medium';
    return 'low';
  }

  async notifyKeyExchange(recipientId, exchangeId) {
    // Implementation would use WebSocket, push notification, etc.
    console.log(`Notifying user ${recipientId} of key exchange ${exchangeId}`);
  }

  async notifyDeviceSync(deviceId, packageId) {
    // Implementation would notify specific device
    console.log(`Notifying device ${deviceId} of sync package ${packageId}`);
  }

  async notifyDeviceAuthentication(deviceId, sessionId) {
    // Implementation would notify device of auth request
    console.log(`Notifying device ${deviceId} of auth session ${sessionId}`);
  }

  async notifyConflictDetection(conversationId, conflictId) {
    // Implementation would notify all conversation participants
    console.log(`Notifying conversation ${conversationId} of conflict ${conflictId}`);
  }
}

module.exports = EncryptionCoordinatorService;