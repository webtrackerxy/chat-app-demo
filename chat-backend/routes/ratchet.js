const express = require('express');
const RatchetStateService = require('../src/services/RatchetStateService');
const router = express.Router();

// Initialize the ratchet state service
const ratchetService = new RatchetStateService();

// Start cleanup job on service initialization
ratchetService.startCleanupJob();

/**
 * Store or update ratchet state
 * POST /api/ratchet/state
 */
router.post('/state', async (req, res) => {
  try {
    const { conversationId, userId, ratchetState } = req.body;

    // Validate required fields
    if (!conversationId || !userId || !ratchetState) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: conversationId, userId, ratchetState',
      });
    }

    // Validate ratchet state structure
    if (!ratchetState.rootKey || !ratchetState.sendingChainKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid ratchet state: missing required keys',
      });
    }

    const result = await ratchetService.storeRatchetState(conversationId, userId, ratchetState);
    
    res.json({
      success: true,
      message: 'Ratchet state stored successfully',
      ratchetStateId: result.id,
    });
  } catch (error) {
    console.error('Store ratchet state error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store ratchet state',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Get ratchet state
 * GET /api/ratchet/state/:conversationId/:userId
 */
router.get('/state/:conversationId/:userId', async (req, res) => {
  try {
    const { conversationId, userId } = req.params;

    if (!conversationId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: conversationId, userId',
      });
    }

    const ratchetState = await ratchetService.getRatchetState(conversationId, userId);
    
    if (!ratchetState) {
      return res.status(404).json({
        success: false,
        error: 'Ratchet state not found',
      });
    }

    res.json({
      success: true,
      ratchetState,
    });
  } catch (error) {
    console.error('Get ratchet state error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve ratchet state',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Delete ratchet state
 * DELETE /api/ratchet/state/:conversationId/:userId
 */
router.delete('/state/:conversationId/:userId', async (req, res) => {
  try {
    const { conversationId, userId } = req.params;

    if (!conversationId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: conversationId, userId',
      });
    }

    const deleted = await ratchetService.deleteRatchetState(conversationId, userId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Ratchet state not found',
      });
    }

    res.json({
      success: true,
      message: 'Ratchet state deleted successfully',
    });
  } catch (error) {
    console.error('Delete ratchet state error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete ratchet state',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Store skipped message key
 * POST /api/ratchet/skipped-keys
 */
router.post('/skipped-keys', async (req, res) => {
  try {
    const { conversationId, userId, messageKeyId, encryptedKey, chainLength, messageNumber } = req.body;

    // Validate required fields
    if (!conversationId || !userId || !messageKeyId || !encryptedKey || 
        chainLength === undefined || messageNumber === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: conversationId, userId, messageKeyId, encryptedKey, chainLength, messageNumber',
      });
    }

    // First get the ratchet state to get the ID
    const ratchetState = await ratchetService.getRatchetState(conversationId, userId);
    if (!ratchetState) {
      return res.status(404).json({
        success: false,
        error: 'Ratchet state not found',
      });
    }

    const result = await ratchetService.storeSkippedMessageKey(
      ratchetState.id,
      messageKeyId,
      encryptedKey,
      chainLength,
      messageNumber
    );
    
    res.json({
      success: true,
      message: 'Skipped message key stored successfully',
      skippedKeyId: result.id,
    });
  } catch (error) {
    console.error('Store skipped key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to store skipped message key',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Get skipped message key
 * GET /api/ratchet/skipped-keys/:conversationId/:userId/:messageKeyId
 */
router.get('/skipped-keys/:conversationId/:userId/:messageKeyId', async (req, res) => {
  try {
    const { conversationId, userId, messageKeyId } = req.params;

    if (!conversationId || !userId || !messageKeyId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: conversationId, userId, messageKeyId',
      });
    }

    // First get the ratchet state to get the ID
    const ratchetState = await ratchetService.getRatchetState(conversationId, userId);
    if (!ratchetState) {
      return res.status(404).json({
        success: false,
        error: 'Ratchet state not found',
      });
    }

    const skippedKey = await ratchetService.getSkippedMessageKey(ratchetState.id, messageKeyId);
    
    if (!skippedKey) {
      return res.status(404).json({
        success: false,
        error: 'Skipped message key not found',
      });
    }

    res.json({
      success: true,
      skippedKey,
    });
  } catch (error) {
    console.error('Get skipped key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve skipped message key',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Delete skipped message key (after use)
 * DELETE /api/ratchet/skipped-keys/:conversationId/:userId/:messageKeyId
 */
router.delete('/skipped-keys/:conversationId/:userId/:messageKeyId', async (req, res) => {
  try {
    const { conversationId, userId, messageKeyId } = req.params;

    if (!conversationId || !userId || !messageKeyId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: conversationId, userId, messageKeyId',
      });
    }

    // First get the ratchet state to get the ID
    const ratchetState = await ratchetService.getRatchetState(conversationId, userId);
    if (!ratchetState) {
      return res.status(404).json({
        success: false,
        error: 'Ratchet state not found',
      });
    }

    const deleted = await ratchetService.deleteSkippedMessageKey(ratchetState.id, messageKeyId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Skipped message key not found',
      });
    }

    res.json({
      success: true,
      message: 'Skipped message key deleted successfully',
    });
  } catch (error) {
    console.error('Delete skipped key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete skipped message key',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Get ratchet statistics
 * GET /api/ratchet/stats/:conversationId/:userId
 */
router.get('/stats/:conversationId/:userId', async (req, res) => {
  try {
    const { conversationId, userId } = req.params;

    if (!conversationId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: conversationId, userId',
      });
    }

    const statistics = await ratchetService.getRatchetStatistics(conversationId, userId);
    
    if (!statistics) {
      return res.status(404).json({
        success: false,
        error: 'Ratchet state not found',
      });
    }

    res.json({
      success: true,
      statistics,
    });
  } catch (error) {
    console.error('Get ratchet statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve ratchet statistics',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * List all ratchet states for a conversation (for debugging/admin)
 * GET /api/ratchet/conversation/:conversationId
 */
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: conversationId',
      });
    }

    const ratchetStates = await ratchetService.listConversationRatchetStates(conversationId);
    
    res.json({
      success: true,
      ratchetStates,
      count: ratchetStates.length,
    });
  } catch (error) {
    console.error('List ratchet states error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list ratchet states',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Manual cleanup of expired keys (for admin/maintenance)
 * POST /api/ratchet/cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    const cleanedCount = await ratchetService.cleanupExpiredMessageKeys();
    
    res.json({
      success: true,
      message: 'Cleanup completed successfully',
      cleanedKeysCount: cleanedCount,
    });
  } catch (error) {
    console.error('Manual cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform cleanup',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Initialize ratchet for new conversation
 * POST /api/ratchet/initialize
 */
router.post('/initialize', async (req, res) => {
  try {
    const { conversationId, userId, initialState } = req.body;

    if (!conversationId || !userId || !initialState) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: conversationId, userId, initialState',
      });
    }

    // Validate initial state structure
    if (!initialState.rootKey || !initialState.sendingChainKey) {
      return res.status(400).json({
        success: false,
        error: 'Invalid initial state: missing required keys',
      });
    }

    const result = await ratchetService.storeRatchetState(conversationId, userId, initialState);
    
    res.json({
      success: true,
      message: 'Ratchet initialized successfully',
      ratchetStateId: result.id,
    });
  } catch (error) {
    console.error('Ratchet initialization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initialize ratchet',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

/**
 * Health check endpoint
 * GET /api/ratchet/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await ratchetService.healthCheck();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

/**
 * Error handling middleware for ratchet routes
 */
router.use((error, req, res, next) => {
  console.error('Ratchet API error:', error);
  
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString(),
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
  });
});

module.exports = router;