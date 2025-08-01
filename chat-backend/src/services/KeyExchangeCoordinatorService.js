/**
 * Key Exchange Coordinator Service
 * 
 * Coordinates secure key exchanges between clients without ever handling
 * private keys or plaintext. Acts as a secure relay for encrypted key data.
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

class KeyExchangeCoordinatorService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Initiate key exchange between two users
   * Server only relays encrypted key material
   */
  async initiateKeyExchange({
    initiatorId,
    recipientId,
    conversationId,
    exchangeType,
    publicKeyBundle, // Contains public keys only
    encryptedKeyData // Key data encrypted for recipient
  }) {
    try {
      // Generate unique exchange ID
      const exchangeId = this.generateExchangeId();
      
      // Validate exchange type
      const validTypes = ['initial_setup', 'ratchet_update', 'pqc_upgrade', 'device_addition'];
      if (!validTypes.includes(exchangeType)) {
        throw new Error('Invalid exchange type');
      }

      // Store key exchange request
      const keyExchange = await this.prisma.keyExchange.create({
        data: {
          id: exchangeId,
          initiatorId,
          recipientId,
          conversationId,
          exchangeType,
          status: 'pending',
          
          // Public key information (safe to store)
          publicKeyBundle: JSON.stringify(publicKeyBundle),
          
          // Encrypted key data (encrypted for recipient)
          encryptedKeyData,
          
          // Metadata
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          
          // Security metadata
          securityLevel: publicKeyBundle.securityLevel || 1,
          algorithm: publicKeyBundle.algorithm || 'hybrid',
          quantumResistant: publicKeyBundle.quantumResistant || false
        }
      });

      // Log the exchange initiation
      console.log(`Key exchange ${exchangeId} initiated: ${initiatorId} -> ${recipientId}`);
      
      // Notify recipient through real-time channel
      await this.notifyRecipient(recipientId, {
        type: 'key_exchange_request',
        exchangeId,
        initiatorId,
        conversationId,
        exchangeType,
        publicKeyBundle
      });

      return {
        exchangeId,
        status: 'pending',
        expiresAt: keyExchange.expiresAt
      };
    } catch (error) {
      console.error('Failed to initiate key exchange:', error);
      throw new Error(`Key exchange initiation failed: ${error.message}`);
    }
  }

  /**
   * Respond to key exchange request
   * Stores encrypted response data
   */
  async respondToKeyExchange({
    exchangeId,
    recipientId,
    responseData, // Encrypted response from recipient
    publicKeyBundle // Recipient's public keys
  }) {
    try {
      // Get the exchange request
      const exchange = await this.prisma.keyExchange.findUnique({
        where: { id: exchangeId }
      });

      if (!exchange) {
        throw new Error('Key exchange not found');
      }

      if (exchange.recipientId !== recipientId) {
        throw new Error('Unauthorized to respond to this exchange');
      }

      if (exchange.status !== 'pending') {
        throw new Error('Exchange is not in pending state');
      }

      if (new Date() > exchange.expiresAt) {
        throw new Error('Key exchange has expired');
      }

      // Update exchange with response
      const updatedExchange = await this.prisma.keyExchange.update({
        where: { id: exchangeId },
        data: {
          status: 'responded',
          responseData,
          recipientPublicKeys: JSON.stringify(publicKeyBundle),
          respondedAt: new Date()
        }
      });

      // Notify initiator of response
      await this.notifyRecipient(exchange.initiatorId, {
        type: 'key_exchange_response',
        exchangeId,
        recipientId,
        publicKeyBundle
      });

      console.log(`Key exchange ${exchangeId} response stored`);
      return {
        exchangeId,
        status: 'responded'
      };
    } catch (error) {
      console.error('Failed to respond to key exchange:', error);
      throw new Error(`Key exchange response failed: ${error.message}`);
    }
  }

  /**
   * Complete key exchange
   * Marks exchange as completed after both parties confirm
   */
  async completeKeyExchange({
    exchangeId,
    userId,
    confirmationSignature
  }) {
    try {
      const exchange = await this.prisma.keyExchange.findUnique({
        where: { id: exchangeId }
      });

      if (!exchange) {
        throw new Error('Key exchange not found');
      }

      // Verify user is participant
      if (exchange.initiatorId !== userId && exchange.recipientId !== userId) {
        throw new Error('User not authorized for this exchange');
      }

      if (exchange.status !== 'responded') {
        throw new Error('Exchange not ready for completion');
      }

      // Update to completed status
      await this.prisma.keyExchange.update({
        where: { id: exchangeId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          confirmationSignature
        }
      });

      // Store algorithm negotiation result if applicable
      if (exchange.exchangeType === 'initial_setup') {
        await this.storeNegotiationResult(exchange);
      }

      console.log(`Key exchange ${exchangeId} completed successfully`);
      return {
        exchangeId,
        status: 'completed'
      };
    } catch (error) {
      console.error('Failed to complete key exchange:', error);
      throw new Error(`Key exchange completion failed: ${error.message}`);
    }
  }

  /**
   * Get pending key exchanges for a user
   */
  async getPendingExchanges(userId, limit = 10) {
    try {
      const exchanges = await this.prisma.keyExchange.findMany({
        where: {
          OR: [
            { initiatorId: userId },
            { recipientId: userId }
          ],
          status: {
            in: ['pending', 'responded']
          },
          expiresAt: {
            gt: new Date()
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit
      });

      return exchanges.map(exchange => ({
        exchangeId: exchange.id,
        conversationId: exchange.conversationId,
        exchangeType: exchange.exchangeType,
        status: exchange.status,
        isInitiator: exchange.initiatorId === userId,
        otherPartyId: exchange.initiatorId === userId ? exchange.recipientId : exchange.initiatorId,
        publicKeyBundle: JSON.parse(exchange.publicKeyBundle || '{}'),
        createdAt: exchange.createdAt,
        expiresAt: exchange.expiresAt
      }));
    } catch (error) {
      console.error('Failed to get pending exchanges:', error);
      throw new Error(`Failed to retrieve exchanges: ${error.message}`);
    }
  }

  /**
   * Get key exchange data for processing
   * Returns encrypted data that only the recipient can decrypt
   */
  async getExchangeData(exchangeId, userId) {
    try {
      const exchange = await this.prisma.keyExchange.findUnique({
        where: { id: exchangeId }
      });

      if (!exchange) {
        throw new Error('Key exchange not found');
      }

      // Verify user is participant
      if (exchange.initiatorId !== userId && exchange.recipientId !== userId) {
        throw new Error('Access denied to exchange data');
      }

      // Return appropriate data based on user role
      const isInitiator = exchange.initiatorId === userId;
      
      return {
        exchangeId: exchange.id,
        conversationId: exchange.conversationId,
        exchangeType: exchange.exchangeType,
        status: exchange.status,
        
        // Encrypted key data (only recipient can decrypt this)
        encryptedKeyData: isInitiator ? null : exchange.encryptedKeyData,
        responseData: isInitiator ? exchange.responseData : null,
        
        // Public key information (safe to share)
        publicKeyBundle: JSON.parse(exchange.publicKeyBundle || '{}'),
        recipientPublicKeys: exchange.recipientPublicKeys ? 
          JSON.parse(exchange.recipientPublicKeys) : null,
        
        // Metadata
        createdAt: exchange.createdAt,
        respondedAt: exchange.respondedAt,
        expiresAt: exchange.expiresAt
      };
    } catch (error) {
      console.error('Failed to get exchange data:', error);
      throw new Error(`Failed to retrieve exchange data: ${error.message}`);
    }
  }

  /**
   * Clean up expired key exchanges
   */
  async cleanupExpiredExchanges() {
    try {
      const result = await this.prisma.keyExchange.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          },
          status: {
            in: ['pending', 'responded']
          }
        }
      });

      console.log(`Cleaned up ${result.count} expired key exchanges`);
      return result.count;
    } catch (error) {
      console.error('Failed to cleanup expired exchanges:', error);
      throw new Error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Get key exchange statistics
   */
  async getExchangeStats(timeframe = '24h') {
    try {
      const timeMap = {
        '1h': 1,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30
      };

      const hours = timeMap[timeframe] || 24;
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const stats = await this.prisma.keyExchange.groupBy({
        by: ['status', 'exchangeType'],
        where: {
          createdAt: {
            gte: since
          }
        },
        _count: {
          id: true
        }
      });

      const summary = {
        timeframe,
        total: 0,
        byStatus: {},
        byType: {},
        successRate: 0
      };

      let completed = 0;
      let total = 0;

      for (const stat of stats) {
        const count = stat._count.id;
        total += count;
        
        summary.byStatus[stat.status] = (summary.byStatus[stat.status] || 0) + count;
        summary.byType[stat.exchangeType] = (summary.byType[stat.exchangeType] || 0) + count;
        
        if (stat.status === 'completed') {
          completed += count;
        }
      }

      summary.total = total;
      summary.successRate = total > 0 ? (completed / total * 100).toFixed(2) : 0;

      return summary;
    } catch (error) {
      console.error('Failed to get exchange stats:', error);
      throw new Error(`Failed to retrieve stats: ${error.message}`);
    }
  }

  // Private helper methods

  generateExchangeId() {
    return crypto.randomBytes(16).toString('hex');
  }

  async notifyRecipient(userId, notification) {
    // Implementation would use WebSocket, push notification, etc.
    console.log(`Notifying user ${userId}:`, notification.type);
    
    // Example WebSocket notification (pseudo-code)
    // this.websocketService.sendToUser(userId, notification);
    
    // Example push notification (pseudo-code)
    // this.pushService.sendNotification(userId, {
    //   title: 'Key Exchange Request',
    //   body: `New ${notification.exchangeType} request`,
    //   data: notification
    // });
  }

  async storeNegotiationResult(exchange) {
    try {
      const publicKeyBundle = JSON.parse(exchange.publicKeyBundle || '{}');
      
      await this.prisma.algorithmNegotiation.create({
        data: {
          conversationId: exchange.conversationId,
          initiatorId: exchange.initiatorId,
          responderId: exchange.recipientId,
          negotiationId: this.generateNegotiationId(),
          selectedKeyExchange: publicKeyBundle.keyExchange || 'hybrid',
          selectedSignature: publicKeyBundle.signature || 'dilithium3',
          selectedEncryption: publicKeyBundle.encryption || 'chacha20poly1305',
          achievedSecurityLevel: exchange.securityLevel,
          quantumResistant: exchange.quantumResistant,
          hybridMode: publicKeyBundle.hybridMode || false,
          protocolVersion: publicKeyBundle.protocolVersion || '1.0',
          supportsPFS: true,
          supportsDoubleRatchet: true,
          localCapabilities: JSON.stringify(publicKeyBundle.localCapabilities || {}),
          remoteCapabilities: JSON.stringify(publicKeyBundle.remoteCapabilities || {}),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          isActive: true
        }
      });
    } catch (error) {
      console.error('Failed to store negotiation result:', error);
    }
  }

  generateNegotiationId() {
    return crypto.randomBytes(12).toString('hex');
  }
}

module.exports = KeyExchangeCoordinatorService;