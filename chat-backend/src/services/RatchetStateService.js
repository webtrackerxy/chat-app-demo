const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

/**
 * Ratchet State Service for Perfect Forward Secrecy
 * 
 * Handles storage and retrieval of Double Ratchet states for the Signal Protocol implementation.
 * Provides secure storage with application-level encryption for sensitive key material.
 */
class RatchetStateService {
  constructor() {
    this.prisma = new PrismaClient();
    this.encryptionKey = this.getEncryptionKey();
  }

  /**
   * Store or update ratchet state for a user in a conversation
   * 
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {Object} ratchetState - Ratchet state to store
   * @returns {Promise<Object>} Stored ratchet state record
   */
  async storeRatchetState(conversationId, userId, ratchetState) {
    try {
      // Encrypt sensitive fields before storage
      const encryptedState = await this.encryptRatchetState(ratchetState);
      
      const data = {
        conversationId,
        userId,
        rootKeyEncrypted: encryptedState.rootKey,
        sendingChainKeyEncrypted: encryptedState.sendingChainKey,
        receivingChainKeyEncrypted: encryptedState.receivingChainKey,
        sendingMessageNumber: ratchetState.sendingMessageNumber || 0,
        receivingMessageNumber: ratchetState.receivingMessageNumber || 0,
        sendingChainLength: ratchetState.sendingChainLength || 0,
        receivingChainLength: ratchetState.receivingChainLength || 0,
        sendingEphemeralPrivateKey: encryptedState.sendingEphemeralPrivateKey,
        sendingEphemeralPublicKey: ratchetState.sendingEphemeralPublicKey,
        receivingEphemeralPublicKey: ratchetState.receivingEphemeralPublicKey,
      };

      const result = await this.prisma.conversationRatchetState.upsert({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        update: {
          ...data,
          updatedAt: new Date(),
        },
        create: data,
      });

      console.log(`Ratchet state stored for conversation ${conversationId}, user ${userId}`);
      return result;
    } catch (error) {
      console.error('Error storing ratchet state:', error);
      throw new Error('Failed to store ratchet state');
    }
  }

  /**
   * Retrieve ratchet state for a user in a conversation
   * 
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Decrypted ratchet state or null if not found
   */
  async getRatchetState(conversationId, userId) {
    try {
      const state = await this.prisma.conversationRatchetState.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        include: {
          skippedMessageKeys: {
            where: {
              expiresAt: {
                gt: new Date(), // Only include non-expired keys
              },
            },
          },
        },
      });

      if (!state) {
        return null;
      }

      // Decrypt sensitive fields
      const decryptedState = await this.decryptRatchetState(state);
      
      console.log(`Ratchet state retrieved for conversation ${conversationId}, user ${userId}`);
      return decryptedState;
    } catch (error) {
      console.error('Error retrieving ratchet state:', error);
      throw new Error('Failed to retrieve ratchet state');
    }
  }

  /**
   * Store skipped message key for out-of-order message handling
   * 
   * @param {string} ratchetStateId - Ratchet state ID
   * @param {string} messageKeyId - Message key identifier
   * @param {string} encryptedKey - Encrypted message key
   * @param {number} chainLength - Chain length
   * @param {number} messageNumber - Message number
   * @returns {Promise<Object>} Stored skipped key record
   */
  async storeSkippedMessageKey(ratchetStateId, messageKeyId, encryptedKey, chainLength, messageNumber) {
    try {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Encrypt the message key before storage
      const encryptedMessageKey = this.encrypt(encryptedKey);

      const result = await this.prisma.skippedMessageKey.create({
        data: {
          ratchetStateId,
          messageKeyId,
          encryptedKey: encryptedMessageKey,
          chainLength,
          messageNumber,
          expiresAt,
        },
      });

      console.log(`Skipped message key stored: ${messageKeyId}`);
      return result;
    } catch (error) {
      console.error('Error storing skipped message key:', error);
      throw new Error('Failed to store skipped message key');
    }
  }

  /**
   * Retrieve skipped message key
   * 
   * @param {string} ratchetStateId - Ratchet state ID
   * @param {string} messageKeyId - Message key identifier
   * @returns {Promise<Object|null>} Decrypted skipped key or null if not found
   */
  async getSkippedMessageKey(ratchetStateId, messageKeyId) {
    try {
      const skippedKey = await this.prisma.skippedMessageKey.findFirst({
        where: {
          ratchetStateId,
          messageKeyId,
          expiresAt: {
            gt: new Date(), // Only return non-expired keys
          },
        },
      });

      if (!skippedKey) {
        return null;
      }

      // Decrypt the message key
      const decryptedKey = this.decrypt(skippedKey.encryptedKey);

      return {
        ...skippedKey,
        encryptedKey: decryptedKey,
      };
    } catch (error) {
      console.error('Error retrieving skipped message key:', error);
      throw new Error('Failed to retrieve skipped message key');
    }
  }

  /**
   * Delete skipped message key after use
   * 
   * @param {string} ratchetStateId - Ratchet state ID
   * @param {string} messageKeyId - Message key identifier
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteSkippedMessageKey(ratchetStateId, messageKeyId) {
    try {
      const result = await this.prisma.skippedMessageKey.deleteMany({
        where: {
          ratchetStateId,
          messageKeyId,
        },
      });

      return result.count > 0;
    } catch (error) {
      console.error('Error deleting skipped message key:', error);
      return false;
    }
  }

  /**
   * Clean up expired message keys
   * 
   * @returns {Promise<number>} Number of keys cleaned up
   */
  async cleanupExpiredMessageKeys() {
    try {
      const result = await this.prisma.skippedMessageKey.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        console.log(`Cleaned up ${result.count} expired message keys`);
      }

      return result.count;
    } catch (error) {
      console.error('Error cleaning up expired message keys:', error);
      return 0;
    }
  }

  /**
   * Delete ratchet state (for conversation cleanup)
   * 
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  async deleteRatchetState(conversationId, userId) {
    try {
      const result = await this.prisma.conversationRatchetState.deleteMany({
        where: {
          conversationId,
          userId,
        },
      });

      if (result.count > 0) {
        console.log(`Ratchet state deleted for conversation ${conversationId}, user ${userId}`);
      }

      return result.count > 0;
    } catch (error) {
      console.error('Error deleting ratchet state:', error);
      return false;
    }
  }

  /**
   * Get ratchet statistics for monitoring
   * 
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Ratchet statistics or null if not found
   */
  async getRatchetStatistics(conversationId, userId) {
    try {
      const state = await this.prisma.conversationRatchetState.findUnique({
        where: {
          conversationId_userId: {
            conversationId,
            userId,
          },
        },
        include: {
          _count: {
            select: {
              skippedMessageKeys: {
                where: {
                  expiresAt: {
                    gt: new Date(),
                  },
                },
              },
            },
          },
        },
      });

      if (!state) {
        return null;
      }

      return {
        sendingMessageNumber: state.sendingMessageNumber,
        receivingMessageNumber: state.receivingMessageNumber,
        sendingChainLength: state.sendingChainLength,
        receivingChainLength: state.receivingChainLength,
        skippedKeysCount: state._count.skippedMessageKeys,
        lastUpdated: state.updatedAt.getTime(),
        createdAt: state.createdAt.getTime(),
      };
    } catch (error) {
      console.error('Error getting ratchet statistics:', error);
      return null;
    }
  }

  /**
   * List all ratchet states for a conversation (for debugging)
   * 
   * @param {string} conversationId - Conversation ID
   * @returns {Promise<Array>} List of ratchet state summaries
   */
  async listConversationRatchetStates(conversationId) {
    try {
      const states = await this.prisma.conversationRatchetState.findMany({
        where: {
          conversationId,
        },
        select: {
          id: true,
          userId: true,
          sendingMessageNumber: true,
          receivingMessageNumber: true,
          sendingChainLength: true,
          receivingChainLength: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              skippedMessageKeys: true,
            },
          },
        },
      });

      return states.map(state => ({
        ...state,
        skippedKeysCount: state._count.skippedMessageKeys,
        _count: undefined,
      }));
    } catch (error) {
      console.error('Error listing ratchet states:', error);
      return [];
    }
  }

  /**
   * Encrypt ratchet state for storage
   * 
   * @param {Object} state - Ratchet state to encrypt
   * @returns {Promise<Object>} Encrypted state fields
   */
  async encryptRatchetState(state) {
    return {
      rootKey: this.encrypt(state.rootKey || ''),
      sendingChainKey: this.encrypt(state.sendingChainKey || ''),
      receivingChainKey: this.encrypt(state.receivingChainKey || ''),
      sendingEphemeralPrivateKey: state.sendingEphemeralPrivateKey ? 
        this.encrypt(state.sendingEphemeralPrivateKey) : null,
    };
  }

  /**
   * Decrypt ratchet state from storage
   * 
   * @param {Object} encryptedState - Encrypted state from database
   * @returns {Promise<Object>} Decrypted ratchet state
   */
  async decryptRatchetState(encryptedState) {
    const skippedMessageKeys = {};
    
    // Decrypt skipped message keys
    if (encryptedState.skippedMessageKeys) {
      for (const skippedKey of encryptedState.skippedMessageKeys) {
        try {
          skippedMessageKeys[skippedKey.messageKeyId] = this.decrypt(skippedKey.encryptedKey);
        } catch (error) {
          console.error(`Failed to decrypt skipped key ${skippedKey.messageKeyId}:`, error);
        }
      }
    }

    return {
      id: encryptedState.id,
      conversationId: encryptedState.conversationId,
      userId: encryptedState.userId,
      rootKey: this.decrypt(encryptedState.rootKeyEncrypted),
      sendingChainKey: this.decrypt(encryptedState.sendingChainKeyEncrypted),
      receivingChainKey: this.decrypt(encryptedState.receivingChainKeyEncrypted),
      sendingMessageNumber: encryptedState.sendingMessageNumber,
      receivingMessageNumber: encryptedState.receivingMessageNumber,
      sendingChainLength: encryptedState.sendingChainLength,
      receivingChainLength: encryptedState.receivingChainLength,
      sendingEphemeralPrivateKey: encryptedState.sendingEphemeralPrivateKey ? 
        this.decrypt(encryptedState.sendingEphemeralPrivateKey) : null,
      sendingEphemeralPublicKey: encryptedState.sendingEphemeralPublicKey,
      receivingEphemeralPublicKey: encryptedState.receivingEphemeralPublicKey,
      skippedMessageKeys,
      createdAt: encryptedState.createdAt.getTime(),
      lastUpdated: encryptedState.updatedAt.getTime(),
    };
  }

  /**
   * Encrypt data using AES-256-GCM
   * 
   * @param {string} data - Data to encrypt
   * @returns {string} Encrypted data as JSON string
   */
  encrypt(data) {
    if (!data || data === '') {
      return JSON.stringify({
        encrypted: '',
        iv: '',
        tag: '',
      });
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setIV(iv);
    
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const tag = cipher.getAuthTag();
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    });
  }

  /**
   * Decrypt data using AES-256-GCM
   * 
   * @param {string} encryptedData - Encrypted data as JSON string
   * @returns {string} Decrypted data
   */
  decrypt(encryptedData) {
    if (!encryptedData) {
      return '';
    }

    try {
      const { encrypted, iv, tag } = JSON.parse(encryptedData);
      
      if (!encrypted || encrypted === '') {
        return '';
      }
      
      const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
      decipher.setIV(Buffer.from(iv, 'base64'));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      
      let decrypted = decipher.update(encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Get encryption key for application-level encryption
   * In production, this should use HSM or secure key management
   * 
   * @returns {string} Encryption key
   */
  getEncryptionKey() {
    const key = process.env.RATCHET_STATE_ENCRYPTION_KEY;
    
    if (!key) {
      console.warn('RATCHET_STATE_ENCRYPTION_KEY not set, using default key. This is insecure for production!');
      return 'default-key-change-in-production-this-is-not-secure';
    }
    
    return key;
  }

  /**
   * Initialize cleanup job for expired keys
   * Should be called on service startup
   */
  startCleanupJob() {
    // Run cleanup every hour
    const CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
    
    setInterval(async () => {
      try {
        await this.cleanupExpiredMessageKeys();
      } catch (error) {
        console.error('Error in cleanup job:', error);
      }
    }, CLEANUP_INTERVAL);
    
    console.log('Ratchet state cleanup job started (runs every hour)');
  }

  /**
   * Close database connections
   */
  async close() {
    await this.prisma.$disconnect();
  }

  /**
   * Health check for the service
   * 
   * @returns {Promise<Object>} Health status
   */
  async healthCheck() {
    try {
      // Test database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Get some basic statistics
      const totalStates = await this.prisma.conversationRatchetState.count();
      const totalSkippedKeys = await this.prisma.skippedMessageKey.count();
      const expiredKeys = await this.prisma.skippedMessageKey.count({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        statistics: {
          totalRatchetStates: totalStates,
          totalSkippedKeys: totalSkippedKeys,
          expiredKeys: expiredKeys,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}

module.exports = RatchetStateService;