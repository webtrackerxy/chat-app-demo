/**
 * Encryption API Routes
 * 
 * Backend API endpoints for encryption coordination.
 * Handles encrypted message routing, key exchange coordination,
 * and multi-device synchronization without accessing plaintext.
 */

const express = require('express');
const EncryptionCoordinatorService = require('../src/services/EncryptionCoordinatorService');
const KeyExchangeCoordinatorService = require('../src/services/KeyExchangeCoordinatorService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');

const router = express.Router();
const encryptionCoordinator = new EncryptionCoordinatorService();
const keyExchangeCoordinator = new KeyExchangeCoordinatorService();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Store encrypted message
 * POST /api/encryption/messages
 */
router.post('/messages', validateRequest({
  conversationId: 'required|string',
  encryptedContent: 'required|string',
  encryptionMetadata: 'required|object'
}), async (req, res) => {
  try {
    const { conversationId, encryptedContent, encryptionMetadata } = req.body;
    const senderId = req.user.id;

    const message = await encryptionCoordinator.storeEncryptedMessage({
      conversationId,
      senderId,
      encryptedContent,
      encryptionMetadata
    });

    res.json({
      success: true,
      messageId: message.id,
      timestamp: message.createdAt
    });
  } catch (error) {
    console.error('Store encrypted message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store encrypted message'
    });
  }
});

/**
 * Get encrypted messages for conversation
 * GET /api/encryption/messages/:conversationId
 */
router.get('/messages/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const messages = await encryptionCoordinator.getEncryptedMessages(
      conversationId,
      userId,
      limit,
      offset
    );

    res.json({
      success: true,
      messages,
      count: messages.length
    });
  } catch (error) {
    console.error('Get encrypted messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve encrypted messages'
    });
  }
});

/**
 * Initiate key exchange
 * POST /api/encryption/key-exchange/initiate
 */
router.post('/key-exchange/initiate', validateRequest({
  recipientId: 'required|string',
  conversationId: 'required|string',
  exchangeType: 'required|string',
  publicKeyBundle: 'required|object',
  encryptedKeyData: 'required|string'
}), async (req, res) => {
  try {
    const {
      recipientId,
      conversationId,
      exchangeType,
      publicKeyBundle,
      encryptedKeyData
    } = req.body;
    const initiatorId = req.user.id;

    const result = await keyExchangeCoordinator.initiateKeyExchange({
      initiatorId,
      recipientId,
      conversationId,
      exchangeType,
      publicKeyBundle,
      encryptedKeyData
    });

    res.json({
      success: true,
      exchangeId: result.exchangeId,
      status: result.status,
      expiresAt: result.expiresAt
    });
  } catch (error) {
    console.error('Initiate key exchange error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate key exchange'
    });
  }
});

/**
 * Respond to key exchange
 * POST /api/encryption/key-exchange/respond
 */
router.post('/key-exchange/respond', validateRequest({
  exchangeId: 'required|string',
  responseData: 'required|string',
  publicKeyBundle: 'required|object'
}), async (req, res) => {
  try {
    const { exchangeId, responseData, publicKeyBundle } = req.body;
    const recipientId = req.user.id;

    const result = await keyExchangeCoordinator.respondToKeyExchange({
      exchangeId,
      recipientId,
      responseData,
      publicKeyBundle
    });

    res.json({
      success: true,
      exchangeId: result.exchangeId,
      status: result.status
    });
  } catch (error) {
    console.error('Respond to key exchange error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to respond to key exchange'
    });
  }
});

/**
 * Complete key exchange
 * POST /api/encryption/key-exchange/complete
 */
router.post('/key-exchange/complete', validateRequest({
  exchangeId: 'required|string',
  confirmationSignature: 'required|string'
}), async (req, res) => {
  try {
    const { exchangeId, confirmationSignature } = req.body;
    const userId = req.user.id;

    const result = await keyExchangeCoordinator.completeKeyExchange({
      exchangeId,
      userId,
      confirmationSignature
    });

    res.json({
      success: true,
      exchangeId: result.exchangeId,
      status: result.status
    });
  } catch (error) {
    console.error('Complete key exchange error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete key exchange'
    });
  }
});

/**
 * Get pending key exchanges
 * GET /api/encryption/key-exchange/pending
 */
router.get('/key-exchange/pending', async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;

    const exchanges = await keyExchangeCoordinator.getPendingExchanges(userId, limit);

    res.json({
      success: true,
      exchanges,
      count: exchanges.length
    });
  } catch (error) {
    console.error('Get pending exchanges error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pending exchanges'
    });
  }
});

/**
 * Get key exchange data
 * GET /api/encryption/key-exchange/:exchangeId
 */
router.get('/key-exchange/:exchangeId', async (req, res) => {
  try {
    const { exchangeId } = req.params;
    const userId = req.user.id;

    const exchangeData = await keyExchangeCoordinator.getExchangeData(exchangeId, userId);

    res.json({
      success: true,
      exchange: exchangeData
    });
  } catch (error) {
    console.error('Get exchange data error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve exchange data'
    });
  }
});

/**
 * Coordinate multi-device key sync
 * POST /api/encryption/multi-device/sync
 */
router.post('/multi-device/sync', validateRequest({
  fromDeviceId: 'required|string',
  toDeviceId: 'required|string',
  encryptedKeyPackage: 'required|object',
  packageMetadata: 'required|object'
}), async (req, res) => {
  try {
    const {
      fromDeviceId,
      toDeviceId,
      encryptedKeyPackage,
      packageMetadata
    } = req.body;
    const userId = req.user.id;

    const syncPackage = await encryptionCoordinator.coordinateMultiDeviceSync({
      userId,
      fromDeviceId,
      toDeviceId,
      encryptedKeyPackage,
      packageMetadata
    });

    res.json({
      success: true,
      packageId: syncPackage.packageId,
      status: syncPackage.status
    });
  } catch (error) {
    console.error('Multi-device sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to coordinate multi-device sync'
    });
  }
});

/**
 * Get pending sync packages for device
 * GET /api/encryption/multi-device/pending/:deviceId
 */
router.get('/multi-device/pending/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;

    // Verify device ownership
    const device = await req.prisma.deviceIdentity.findUnique({
      where: { deviceId }
    });

    if (!device || device.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to device'
      });
    }

    const packages = await req.prisma.keySyncPackage.findMany({
      where: {
        toDeviceId: deviceId,
        status: 'pending',
        expiresAt: {
          gt: new Date()
        }
      },
      orderBy: {
        syncPriority: 'desc'
      }
    });

    res.json({
      success: true,
      packages: packages.map(pkg => ({
        packageId: pkg.packageId,
        fromDeviceId: pkg.fromDeviceId,
        keyType: pkg.keyType,
        conversationId: pkg.conversationId,
        encryptedKeyData: pkg.encryptedKeyData,
        integrityHash: pkg.integrityHash,
        signature: pkg.signature,
        keyMetadata: JSON.parse(pkg.keyMetadata),
        syncPriority: pkg.syncPriority,
        createdAt: pkg.createdAt,
        expiresAt: pkg.expiresAt
      })),
      count: packages.length
    });
  } catch (error) {
    console.error('Get pending sync packages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve pending sync packages'
    });
  }
});

/**
 * Mark sync package as processed
 * POST /api/encryption/multi-device/processed/:packageId
 */
router.post('/multi-device/processed/:packageId', async (req, res) => {
  try {
    const { packageId } = req.params;
    const { success, error } = req.body;
    const userId = req.user.id;

    // Verify package belongs to user's device
    const syncPackage = await req.prisma.keySyncPackage.findUnique({
      where: { packageId },
      include: {
        receiverDevice: true
      }
    });

    if (!syncPackage || syncPackage.receiverDevice.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to sync package'
      });
    }

    await req.prisma.keySyncPackage.update({
      where: { packageId },
      data: {
        status: success ? 'processed' : 'failed',
        processedAt: new Date(),
        errorMessage: error || null
      }
    });

    res.json({
      success: true,
      packageId,
      status: success ? 'processed' : 'failed'
    });
  } catch (error) {
    console.error('Mark sync package processed error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update sync package status'
    });
  }
});

/**
 * Store algorithm negotiation result
 * POST /api/encryption/algorithm-negotiation
 */
router.post('/algorithm-negotiation', validateRequest({
  conversationId: 'required|string',
  responderId: 'required|string',
  negotiationResult: 'required|object'
}), async (req, res) => {
  try {
    const { conversationId, responderId, negotiationResult } = req.body;
    const initiatorId = req.user.id;

    const negotiation = await encryptionCoordinator.storeAlgorithmNegotiation({
      conversationId,
      initiatorId,
      responderId,
      negotiationResult
    });

    res.json({
      success: true,
      negotiationId: negotiation.negotiationId,
      selectedAlgorithms: {
        keyExchange: negotiation.selectedKeyExchange,
        signature: negotiation.selectedSignature,
        encryption: negotiation.selectedEncryption
      },
      securityLevel: negotiation.achievedSecurityLevel,
      quantumResistant: negotiation.quantumResistant
    });
  } catch (error) {
    console.error('Store algorithm negotiation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store algorithm negotiation'
    });
  }
});

/**
 * Coordinate conflict resolution
 * POST /api/encryption/conflict-resolution
 */
router.post('/conflict-resolution', validateRequest({
  conversationId: 'required|string',
  keyType: 'required|string',
  conflictingVersions: 'required|array',
  resolutionStrategy: 'required|object'
}), async (req, res) => {
  try {
    const {
      conversationId,
      keyType,
      conflictingVersions,
      resolutionStrategy
    } = req.body;

    const conflict = await encryptionCoordinator.coordinateConflictResolution({
      conversationId,
      keyType,
      conflictingVersions,
      resolutionStrategy
    });

    res.json({
      success: true,
      conflictId: conflict.conflictId,
      severity: conflict.severity,
      status: conflict.status
    });
  } catch (error) {
    console.error('Coordinate conflict resolution error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to coordinate conflict resolution'
    });
  }
});

/**
 * Get encryption statistics
 * GET /api/encryption/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const timeframe = req.query.timeframe || '24h';
    
    const [exchangeStats, messageStats] = await Promise.all([
      keyExchangeCoordinator.getExchangeStats(timeframe),
      getMessageStats(timeframe)
    ]);

    res.json({
      success: true,
      stats: {
        keyExchanges: exchangeStats,
        messages: messageStats,
        timeframe
      }
    });
  } catch (error) {
    console.error('Get encryption stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve encryption statistics'
    });
  }
});

// Helper function for message statistics
async function getMessageStats(timeframe) {
  const timeMap = {
    '1h': 1,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30
  };

  const hours = timeMap[timeframe] || 24;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  const stats = await prisma.message.groupBy({
    by: ['algorithm', 'encrypted'],
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
    total: 0,
    encrypted: 0,
    byAlgorithm: {},
    encryptionRate: 0
  };

  for (const stat of stats) {
    const count = stat._count.id;
    summary.total += count;
    
    if (stat.encrypted) {
      summary.encrypted += count;
    }
    
    summary.byAlgorithm[stat.algorithm] = (summary.byAlgorithm[stat.algorithm] || 0) + count;
  }

  summary.encryptionRate = summary.total > 0 ? 
    (summary.encrypted / summary.total * 100).toFixed(2) : 0;

  return summary;
}

module.exports = router;