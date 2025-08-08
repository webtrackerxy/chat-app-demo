#!/usr/bin/env node

/**
 * Export SQLite data migration script
 * Exports all data from SQLite database to JSON files for PostgreSQL import
 */

const { PrismaClient } = require('../chat-backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Prisma client with default configuration (should use SQLite from .env)
const prisma = new PrismaClient();

// Create exports directory
const exportsDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

/**
 * Export table data to JSON file
 */
async function exportTable(tableName, model, filename = null) {
  try {
    console.log(`Exporting ${tableName}...`);
    const data = await model.findMany();
    
    const exportFile = path.join(exportsDir, filename || `${tableName}.json`);
    fs.writeFileSync(exportFile, JSON.stringify(data, null, 2));
    
    console.log(`✅ Exported ${data.length} records from ${tableName} to ${filename || `${tableName}.json`}`);
    return data.length;
  } catch (error) {
    console.error(`❌ Error exporting ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Export all database tables
 */
async function exportAllData() {
  console.log('🚀 Starting SQLite data export...\n');
  
  const startTime = Date.now();
  const stats = {};
  
  try {
    // Export core entities
    stats.users = await exportTable('User', prisma.user, 'users.json');
    stats.conversations = await exportTable('Conversation', prisma.conversation, 'conversations.json');
    stats.conversationParticipants = await exportTable('ConversationParticipant', prisma.conversationParticipant, 'conversation_participants.json');
    stats.messages = await exportTable('Message', prisma.message, 'messages.json');
    
    // Export message-related entities
    stats.messageFiles = await exportTable('MessageFile', prisma.messageFile, 'message_files.json');
    stats.messageReactions = await exportTable('MessageReaction', prisma.messageReaction, 'message_reactions.json');
    stats.readReceipts = await exportTable('ReadReceipt', prisma.readReceipt, 'read_receipts.json');
    
    // Export encryption-related entities
    stats.conversationKeys = await exportTable('ConversationKey', prisma.conversationKey, 'conversation_keys.json');
    stats.conversationRatchetStates = await exportTable('ConversationRatchetState', prisma.conversationRatchetState, 'conversation_ratchet_states.json');
    stats.skippedMessageKeys = await exportTable('SkippedMessageKey', prisma.skippedMessageKey, 'skipped_message_keys.json');
    stats.postQuantumKeys = await exportTable('PostQuantumKey', prisma.postQuantumKey, 'post_quantum_keys.json');
    stats.algorithmNegotiations = await exportTable('AlgorithmNegotiation', prisma.algorithmNegotiation, 'algorithm_negotiations.json');
    stats.cryptoMigrations = await exportTable('CryptoMigration', prisma.cryptoMigration, 'crypto_migrations.json');
    
    // Export multi-device entities
    stats.deviceIdentities = await exportTable('DeviceIdentity', prisma.deviceIdentity, 'device_identities.json');
    stats.deviceVerifications = await exportTable('DeviceVerification', prisma.deviceVerification, 'device_verifications.json');
    stats.keySyncPackages = await exportTable('KeySyncPackage', prisma.keySyncPackage, 'key_sync_packages.json');
    stats.authenticationSessions = await exportTable('AuthenticationSession', prisma.authenticationSession, 'authentication_sessions.json');
    
    // Export sync and conflict resolution entities
    stats.keyConflicts = await exportTable('KeyConflict', prisma.keyConflict, 'key_conflicts.json');
    stats.conflictResolutions = await exportTable('ConflictResolution', prisma.conflictResolution, 'conflict_resolutions.json');
    stats.offlineSyncQueues = await exportTable('OfflineSyncQueue', prisma.offlineSyncQueue, 'offline_sync_queues.json');
    stats.offlineSyncItems = await exportTable('OfflineSyncItem', prisma.offlineSyncItem, 'offline_sync_items.json');
    stats.deltaSyncCheckpoints = await exportTable('DeltaSyncCheckpoint', prisma.deltaSyncCheckpoint, 'delta_sync_checkpoints.json');
    stats.keyExchanges = await exportTable('KeyExchange', prisma.keyExchange, 'key_exchanges.json');
    
    // Generate export summary
    const totalRecords = Object.values(stats).reduce((sum, count) => sum + count, 0);
    const exportSummary = {
      exportDate: new Date().toISOString(),
      totalRecords,
      tableStats: stats,
      exportDuration: Date.now() - startTime
    };
    
    fs.writeFileSync(
      path.join(exportsDir, 'export_summary.json'), 
      JSON.stringify(exportSummary, null, 2)
    );
    
    console.log('\n📊 Export Summary:');
    console.log(`Total records exported: ${totalRecords}`);
    console.log(`Export duration: ${exportSummary.exportDuration}ms`);
    console.log(`\nTable breakdown:`);
    
    Object.entries(stats).forEach(([table, count]) => {
      console.log(`  ${table}: ${count} records`);
    });
    
    console.log('\n✅ SQLite data export completed successfully!');
    console.log(`📁 Exported data saved to: ${exportsDir}`);
    
  } catch (error) {
    console.error('\n❌ Export failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Validate exported data integrity
 */
async function validateExport() {
  console.log('\n🔍 Validating exported data...');
  
  const summaryFile = path.join(exportsDir, 'export_summary.json');
  if (!fs.existsSync(summaryFile)) {
    throw new Error('Export summary not found');
  }
  
  const summary = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
  let validationErrors = [];
  
  // Check if all expected files exist
  Object.keys(summary.tableStats).forEach(table => {
    const filename = `${table === 'users' ? 'users' : 
                      table === 'conversations' ? 'conversations' : 
                      table === 'conversationParticipants' ? 'conversation_participants' : 
                      table === 'messages' ? 'messages' : 
                      table === 'messageFiles' ? 'message_files' : 
                      table === 'messageReactions' ? 'message_reactions' : 
                      table === 'readReceipts' ? 'read_receipts' : 
                      table === 'conversationKeys' ? 'conversation_keys' : 
                      table === 'conversationRatchetStates' ? 'conversation_ratchet_states' : 
                      table === 'skippedMessageKeys' ? 'skipped_message_keys' : 
                      table === 'postQuantumKeys' ? 'post_quantum_keys' : 
                      table === 'algorithmNegotiations' ? 'algorithm_negotiations' : 
                      table === 'cryptoMigrations' ? 'crypto_migrations' : 
                      table === 'deviceIdentities' ? 'device_identities' : 
                      table === 'deviceVerifications' ? 'device_verifications' : 
                      table === 'keySyncPackages' ? 'key_sync_packages' : 
                      table === 'authenticationSessions' ? 'authentication_sessions' : 
                      table === 'keyConflicts' ? 'key_conflicts' : 
                      table === 'conflictResolutions' ? 'conflict_resolutions' : 
                      table === 'offlineSyncQueues' ? 'offline_sync_queues' : 
                      table === 'offlineSyncItems' ? 'offline_sync_items' : 
                      table === 'deltaSyncCheckpoints' ? 'delta_sync_checkpoints' : 
                      table === 'keyExchanges' ? 'key_exchanges' : table}.json`;
    
    const filePath = path.join(exportsDir, filename);
    if (!fs.existsSync(filePath)) {
      validationErrors.push(`Missing export file: ${filename}`);
      return;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data.length !== summary.tableStats[table]) {
        validationErrors.push(`Record count mismatch in ${filename}: expected ${summary.tableStats[table]}, got ${data.length}`);
      }
    } catch (error) {
      validationErrors.push(`Invalid JSON in ${filename}: ${error.message}`);
    }
  });
  
  if (validationErrors.length > 0) {
    console.log('\n❌ Validation errors found:');
    validationErrors.forEach(error => console.log(`  - ${error}`));
    throw new Error('Export validation failed');
  }
  
  console.log('✅ Export validation passed!');
}

// Run export if called directly
if (require.main === module) {
  (async () => {
    try {
      await exportAllData();
      await validateExport();
      process.exit(0);
    } catch (error) {
      console.error('Export process failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { exportAllData, validateExport };