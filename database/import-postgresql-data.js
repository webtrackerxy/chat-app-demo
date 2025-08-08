#!/usr/bin/env node

/**
 * Import PostgreSQL data migration script
 * Imports data from exported JSON files to PostgreSQL database
 */

const { PrismaClient } = require('../chat-backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Prisma client with PostgreSQL database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chat-app'
    }
  }
});

const exportsDir = path.join(__dirname, 'exports');

/**
 * Import data from JSON file to database table
 */
async function importTable(tableName, model, filename, transform = null) {
  try {
    console.log(`Importing ${tableName}...`);
    
    const filePath = path.join(exportsDir, filename);
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  No data file found for ${tableName}, skipping...`);
      return 0;
    }
    
    const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    if (rawData.length === 0) {
      console.log(`ℹ️  No data to import for ${tableName}`);
      return 0;
    }
    
    // Transform data if needed (e.g., date conversions, type changes)
    const data = transform ? rawData.map(transform) : rawData;
    
    // Use createMany for bulk insert
    const result = await model.createMany({
      data: data,
      skipDuplicates: true
    });
    
    console.log(`✅ Imported ${result.count} records to ${tableName}`);
    return result.count;
    
  } catch (error) {
    console.error(`❌ Error importing ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Transform date strings back to Date objects
 */
function transformDates(record, dateFields) {
  const transformed = { ...record };
  dateFields.forEach(field => {
    if (transformed[field]) {
      transformed[field] = new Date(transformed[field]);
    }
  });
  return transformed;
}

/**
 * Import all database tables in proper order (respecting foreign key constraints)
 */
async function importAllData() {
  console.log('🚀 Starting PostgreSQL data import...\n');
  
  const startTime = Date.now();
  const stats = {};
  
  try {
    // Clear existing data (in reverse order)
    console.log('🧹 Clearing existing data...');
    await prisma.keyExchange.deleteMany();
    await prisma.deltaSyncCheckpoint.deleteMany();
    await prisma.offlineSyncItem.deleteMany();
    await prisma.offlineSyncQueue.deleteMany();
    await prisma.conflictResolution.deleteMany();
    await prisma.keyConflict.deleteMany();
    await prisma.authenticationSession.deleteMany();
    await prisma.keySyncPackage.deleteMany();
    await prisma.deviceVerification.deleteMany();
    await prisma.deviceIdentity.deleteMany();
    await prisma.cryptoMigration.deleteMany();
    await prisma.algorithmNegotiation.deleteMany();
    await prisma.postQuantumKey.deleteMany();
    await prisma.skippedMessageKey.deleteMany();
    await prisma.conversationRatchetState.deleteMany();
    await prisma.conversationKey.deleteMany();
    await prisma.readReceipt.deleteMany();
    await prisma.messageReaction.deleteMany();
    await prisma.messageFile.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversationParticipant.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.user.deleteMany();
    console.log('✅ Existing data cleared\n');
    
    // Import in order (respecting foreign key constraints)
    
    // 1. Core entities (no dependencies)
    stats.users = await importTable('User', prisma.user, 'users.json', (record) =>
      transformDates(record, ['lastSeen', 'createdAt', 'updatedAt'])
    );
    
    stats.conversations = await importTable('Conversation', prisma.conversation, 'conversations.json', (record) =>
      transformDates(record, ['createdAt', 'updatedAt'])
    );
    
    // 2. Dependent entities
    stats.conversationParticipants = await importTable('ConversationParticipant', prisma.conversationParticipant, 'conversation_participants.json', (record) =>
      transformDates(record, ['joinedAt', 'leftAt'])
    );
    
    stats.messages = await importTable('Message', prisma.message, 'messages.json', (record) =>
      transformDates(record, ['timestamp', 'createdAt', 'updatedAt'])
    );
    
    // 3. Message-related entities
    stats.messageFiles = await importTable('MessageFile', prisma.messageFile, 'message_files.json', (record) =>
      transformDates(record, ['createdAt'])
    );
    
    stats.messageReactions = await importTable('MessageReaction', prisma.messageReaction, 'message_reactions.json', (record) =>
      transformDates(record, ['createdAt'])
    );
    
    stats.readReceipts = await importTable('ReadReceipt', prisma.readReceipt, 'read_receipts.json', (record) =>
      transformDates(record, ['readAt'])
    );
    
    // 4. Encryption-related entities
    stats.conversationKeys = await importTable('ConversationKey', prisma.conversationKey, 'conversation_keys.json', (record) =>
      transformDates(record, ['createdAt', 'updatedAt'])
    );
    
    stats.conversationRatchetStates = await importTable('ConversationRatchetState', prisma.conversationRatchetState, 'conversation_ratchet_states.json', (record) =>
      transformDates(record, ['createdAt', 'updatedAt'])
    );
    
    stats.skippedMessageKeys = await importTable('SkippedMessageKey', prisma.skippedMessageKey, 'skipped_message_keys.json', (record) =>
      transformDates(record, ['createdAt', 'expiresAt'])
    );
    
    stats.postQuantumKeys = await importTable('PostQuantumKey', prisma.postQuantumKey, 'post_quantum_keys.json', (record) =>
      transformDates(record, ['generatedAt', 'activatedAt', 'expiresAt', 'revokedAt', 'createdAt', 'updatedAt'])
    );
    
    stats.algorithmNegotiations = await importTable('AlgorithmNegotiation', prisma.algorithmNegotiation, 'algorithm_negotiations.json', (record) =>
      transformDates(record, ['negotiatedAt', 'expiresAt'])
    );
    
    stats.cryptoMigrations = await importTable('CryptoMigration', prisma.cryptoMigration, 'crypto_migrations.json', (record) =>
      transformDates(record, ['startedAt', 'completedAt', 'failedAt', 'createdAt', 'updatedAt'])
    );
    
    // 5. Multi-device entities
    stats.deviceIdentities = await importTable('DeviceIdentity', prisma.deviceIdentity, 'device_identities.json', (record) =>
      transformDates(record, ['registeredAt', 'lastSeen', 'revokedAt', 'createdAt', 'updatedAt'])
    );
    
    stats.deviceVerifications = await importTable('DeviceVerification', prisma.deviceVerification, 'device_verifications.json', (record) =>
      transformDates(record, ['timestamp', 'expiresAt'])
    );
    
    stats.keySyncPackages = await importTable('KeySyncPackage', prisma.keySyncPackage, 'key_sync_packages.json', (record) =>
      transformDates(record, ['expiresAt', 'processedAt', 'createdAt', 'updatedAt'])
    );
    
    stats.authenticationSessions = await importTable('AuthenticationSession', prisma.authenticationSession, 'authentication_sessions.json', (record) =>
      transformDates(record, ['createdAt', 'expiresAt', 'verifiedAt'])
    );
    
    // 6. Sync and conflict resolution entities
    stats.keyConflicts = await importTable('KeyConflict', prisma.keyConflict, 'key_conflicts.json', (record) =>
      transformDates(record, ['detectedAt', 'resolvedAt'])
    );
    
    stats.conflictResolutions = await importTable('ConflictResolution', prisma.conflictResolution, 'conflict_resolutions.json', (record) =>
      transformDates(record, ['timestamp'])
    );
    
    stats.offlineSyncQueues = await importTable('OfflineSyncQueue', prisma.offlineSyncQueue, 'offline_sync_queues.json', (record) =>
      transformDates(record, ['lastModified', 'lastSynced'])
    );
    
    stats.offlineSyncItems = await importTable('OfflineSyncItem', prisma.offlineSyncItem, 'offline_sync_items.json', (record) =>
      transformDates(record, ['lastAttempt', 'createdAt', 'updatedAt'])
    );
    
    stats.deltaSyncCheckpoints = await importTable('DeltaSyncCheckpoint', prisma.deltaSyncCheckpoint, 'delta_sync_checkpoints.json', (record) =>
      transformDates(record, ['timestamp'])
    );
    
    stats.keyExchanges = await importTable('KeyExchange', prisma.keyExchange, 'key_exchanges.json', (record) =>
      transformDates(record, ['createdAt', 'respondedAt', 'completedAt', 'expiresAt'])
    );
    
    // Generate import summary
    const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
    const importSummary = {
      importDate: new Date().toISOString(),
      totalRecords,
      tableStats: stats,
      importDuration: Date.now() - startTime
    };
    
    fs.writeFileSync(
      path.join(__dirname, 'import_summary.json'), 
      JSON.stringify(importSummary, null, 2)
    );
    
    console.log('\n📊 Import Summary:');
    console.log(`Total records imported: ${totalRecords}`);
    console.log(`Import duration: ${importSummary.importDuration}ms`);
    console.log(`\nTable breakdown:`);
    
    Object.entries(stats).forEach(([table, count]) => {
      console.log(`  ${table}: ${count} records`);
    });
    
    console.log('\n✅ PostgreSQL data import completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Validate imported data integrity
 */
async function validateImport() {
  console.log('\n🔍 Validating imported data...');
  
  try {
    // Read original export summary
    const exportSummaryFile = path.join(exportsDir, 'export_summary.json');
    if (!fs.existsSync(exportSummaryFile)) {
      throw new Error('Original export summary not found');
    }
    
    const exportSummary = JSON.parse(fs.readFileSync(exportSummaryFile, 'utf8'));
    
    // Read import summary
    const importSummaryFile = path.join(__dirname, 'import_summary.json');
    if (!fs.existsSync(importSummaryFile)) {
      throw new Error('Import summary not found');
    }
    
    const importSummary = JSON.parse(fs.readFileSync(importSummaryFile, 'utf8'));
    
    let validationErrors = [];
    
    // Compare record counts
    Object.entries(exportSummary.tableStats).forEach(([table, exportCount]) => {
      const importCount = importSummary.tableStats[table] || 0;
      if (importCount !== exportCount) {
        validationErrors.push(`Record count mismatch for ${table}: exported ${exportCount}, imported ${importCount}`);
      }
    });
    
    // Verify database record counts
    const dbCounts = {
      users: await prisma.user.count(),
      conversations: await prisma.conversation.count(),
      conversationParticipants: await prisma.conversationParticipant.count(),
      messages: await prisma.message.count(),
      messageFiles: await prisma.messageFile.count(),
      messageReactions: await prisma.messageReaction.count(),
      readReceipts: await prisma.readReceipt.count(),
      conversationKeys: await prisma.conversationKey.count(),
      conversationRatchetStates: await prisma.conversationRatchetState.count(),
      skippedMessageKeys: await prisma.skippedMessageKey.count(),
      postQuantumKeys: await prisma.postQuantumKey.count(),
      algorithmNegotiations: await prisma.algorithmNegotiation.count(),
      cryptoMigrations: await prisma.cryptoMigration.count(),
      deviceIdentities: await prisma.deviceIdentity.count(),
      deviceVerifications: await prisma.deviceVerification.count(),
      keySyncPackages: await prisma.keySyncPackage.count(),
      authenticationSessions: await prisma.authenticationSession.count(),
      keyConflicts: await prisma.keyConflict.count(),
      conflictResolutions: await prisma.conflictResolution.count(),
      offlineSyncQueues: await prisma.offlineSyncQueue.count(),
      offlineSyncItems: await prisma.offlineSyncItem.count(),
      deltaSyncCheckpoints: await prisma.deltaSyncCheckpoint.count(),
      keyExchanges: await prisma.keyExchange.count()
    };
    
    Object.entries(dbCounts).forEach(([table, dbCount]) => {
      const importCount = importSummary.tableStats[table] || 0;
      if (dbCount !== importCount) {
        validationErrors.push(`Database count mismatch for ${table}: imported ${importCount}, database has ${dbCount}`);
      }
    });
    
    if (validationErrors.length > 0) {
      console.log('\n❌ Validation errors found:');
      validationErrors.forEach(error => console.log(`  - ${error}`));
      throw new Error('Import validation failed');
    }
    
    console.log('✅ Import validation passed!');
    console.log(`📊 Total records in PostgreSQL: ${Object.values(dbCounts).reduce((sum, count) => sum + count, 0)}`);
    
  } catch (error) {
    console.error('❌ Validation failed:', error.message);
    throw error;
  }
}

// Run import if called directly
if (require.main === module) {
  (async () => {
    try {
      await importAllData();
      await validateImport();
      process.exit(0);
    } catch (error) {
      console.error('Import process failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { importAllData, validateImport };