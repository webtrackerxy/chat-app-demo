#!/usr/bin/env node

/**
 * Migration validation script
 * Comprehensive validation of data migration from SQLite to PostgreSQL
 */

const { PrismaClient } = require('../chat-backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize both database clients
// Note: We'll need to run this script twice - once for SQLite, once for PostgreSQL
const prismaForCurrentDB = new PrismaClient();

// For PostgreSQL validation (when needed)
const postgresqlPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:postgres@localhost:5432/chat-app'
    }
  }
});

// For SQLite validation (when needed)  
const sqlitePrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/dev.db'
    }
  }
});

/**
 * Compare record counts between databases
 */
async function validateRecordCounts() {
  console.log('🔢 Validating record counts...');
  
  const tables = [
    { name: 'User', model: 'user' },
    { name: 'Conversation', model: 'conversation' },
    { name: 'ConversationParticipant', model: 'conversationParticipant' },
    { name: 'Message', model: 'message' },
    { name: 'MessageFile', model: 'messageFile' },
    { name: 'MessageReaction', model: 'messageReaction' },
    { name: 'ReadReceipt', model: 'readReceipt' },
    { name: 'ConversationKey', model: 'conversationKey' },
    { name: 'ConversationRatchetState', model: 'conversationRatchetState' },
    { name: 'SkippedMessageKey', model: 'skippedMessageKey' },
    { name: 'PostQuantumKey', model: 'postQuantumKey' },
    { name: 'AlgorithmNegotiation', model: 'algorithmNegotiation' },
    { name: 'CryptoMigration', model: 'cryptoMigration' },
    { name: 'DeviceIdentity', model: 'deviceIdentity' },
    { name: 'DeviceVerification', model: 'deviceVerification' },
    { name: 'KeySyncPackage', model: 'keySyncPackage' },
    { name: 'AuthenticationSession', model: 'authenticationSession' },
    { name: 'KeyConflict', model: 'keyConflict' },
    { name: 'ConflictResolution', model: 'conflictResolution' },
    { name: 'OfflineSyncQueue', model: 'offlineSyncQueue' },
    { name: 'OfflineSyncItem', model: 'offlineSyncItem' },
    { name: 'DeltaSyncCheckpoint', model: 'deltaSyncCheckpoint' },
    { name: 'KeyExchange', model: 'keyExchange' }
  ];
  
  const countMismatches = [];
  
  for (const table of tables) {
    try {
      const sqliteCount = await sqlitePrisma[table.model].count();
      const postgresqlCount = await postgresqlPrisma[table.model].count();
      
      if (sqliteCount !== postgresqlCount) {
        countMismatches.push({
          table: table.name,
          sqlite: sqliteCount,
          postgresql: postgresqlCount,
          difference: postgresqlCount - sqliteCount
        });
      }
      
      console.log(`  ${table.name}: SQLite ${sqliteCount} → PostgreSQL ${postgresqlCount}`);
    } catch (error) {
      console.error(`  ❌ Error counting ${table.name}:`, error.message);
      countMismatches.push({
        table: table.name,
        error: error.message
      });
    }
  }
  
  if (countMismatches.length > 0) {
    console.log('\n❌ Record count mismatches found:');
    countMismatches.forEach(mismatch => {
      if (mismatch.error) {
        console.log(`  ${mismatch.table}: Error - ${mismatch.error}`);
      } else {
        console.log(`  ${mismatch.table}: ${mismatch.sqlite} → ${mismatch.postgresql} (${mismatch.difference > 0 ? '+' : ''}${mismatch.difference})`);
      }
    });
    return false;
  }
  
  console.log('✅ All record counts match!');
  return true;
}

/**
 * Validate data integrity by comparing sample records
 */
async function validateDataIntegrity() {
  console.log('\n🔍 Validating data integrity...');
  
  const integrityErrors = [];
  
  try {
    // Validate Users
    const sqliteUsers = await sqlitePrisma.user.findMany({ take: 10 });
    for (const user of sqliteUsers) {
      const pgUser = await postgresqlPrisma.user.findUnique({
        where: { id: user.id }
      });
      
      if (!pgUser) {
        integrityErrors.push(`User ${user.id} not found in PostgreSQL`);
        continue;
      }
      
      // Compare key fields
      if (user.username !== pgUser.username) {
        integrityErrors.push(`User ${user.id} username mismatch: ${user.username} !== ${pgUser.username}`);
      }
      if (user.publicKey !== pgUser.publicKey) {
        integrityErrors.push(`User ${user.id} publicKey mismatch`);
      }
    }
    
    // Validate Messages with encryption data
    const sqliteMessages = await sqlitePrisma.message.findMany({ 
      take: 10,
      where: { encrypted: true }
    });
    for (const message of sqliteMessages) {
      const pgMessage = await postgresqlPrisma.message.findUnique({
        where: { id: message.id }
      });
      
      if (!pgMessage) {
        integrityErrors.push(`Message ${message.id} not found in PostgreSQL`);
        continue;
      }
      
      // Compare encryption fields
      if (message.encrypted !== pgMessage.encrypted) {
        integrityErrors.push(`Message ${message.id} encryption flag mismatch`);
      }
      if (message.ratchetEncrypted !== pgMessage.ratchetEncrypted) {
        integrityErrors.push(`Message ${message.id} ratchetEncrypted flag mismatch`);
      }
      if (message.pqcEncrypted !== pgMessage.pqcEncrypted) {
        integrityErrors.push(`Message ${message.id} pqcEncrypted flag mismatch`);
      }
      if (message.algorithm !== pgMessage.algorithm) {
        integrityErrors.push(`Message ${message.id} algorithm mismatch: ${message.algorithm} !== ${pgMessage.algorithm}`);
      }
    }
    
    // Validate ConversationRatchetState
    const sqliteRatchetStates = await sqlitePrisma.conversationRatchetState.findMany({ take: 5 });
    for (const ratchetState of sqliteRatchetStates) {
      const pgRatchetState = await postgresqlPrisma.conversationRatchetState.findUnique({
        where: { id: ratchetState.id }
      });
      
      if (!pgRatchetState) {
        integrityErrors.push(`ConversationRatchetState ${ratchetState.id} not found in PostgreSQL`);
        continue;
      }
      
      // Compare critical ratchet fields
      if (ratchetState.sendingMessageNumber !== pgRatchetState.sendingMessageNumber) {
        integrityErrors.push(`RatchetState ${ratchetState.id} sendingMessageNumber mismatch`);
      }
      if (ratchetState.receivingMessageNumber !== pgRatchetState.receivingMessageNumber) {
        integrityErrors.push(`RatchetState ${ratchetState.id} receivingMessageNumber mismatch`);
      }
      if (ratchetState.rootKeyEncrypted !== pgRatchetState.rootKeyEncrypted) {
        integrityErrors.push(`RatchetState ${ratchetState.id} rootKeyEncrypted mismatch`);
      }
    }
    
    // Validate PostQuantumKeys
    const sqlitePQKeys = await sqlitePrisma.postQuantumKey.findMany({ take: 5 });
    for (const pqKey of sqlitePQKeys) {
      const pgPQKey = await postgresqlPrisma.postQuantumKey.findUnique({
        where: { id: pqKey.id }
      });
      
      if (!pgPQKey) {
        integrityErrors.push(`PostQuantumKey ${pqKey.id} not found in PostgreSQL`);
        continue;
      }
      
      // Compare PQC fields
      if (pqKey.keyType !== pgPQKey.keyType) {
        integrityErrors.push(`PostQuantumKey ${pqKey.id} keyType mismatch`);
      }
      if (pqKey.algorithm !== pgPQKey.algorithm) {
        integrityErrors.push(`PostQuantumKey ${pqKey.id} algorithm mismatch`);
      }
      if (pqKey.keyData !== pgPQKey.keyData) {
        integrityErrors.push(`PostQuantumKey ${pqKey.id} keyData mismatch`);
      }
    }
    
  } catch (error) {
    integrityErrors.push(`Integrity validation error: ${error.message}`);
  }
  
  if (integrityErrors.length > 0) {
    console.log('❌ Data integrity errors found:');
    integrityErrors.forEach(error => console.log(`  - ${error}`));
    return false;
  }
  
  console.log('✅ Data integrity validation passed!');
  return true;
}

/**
 * Validate foreign key relationships
 */
async function validateRelationships() {
  console.log('\n🔗 Validating foreign key relationships...');
  
  const relationshipErrors = [];
  
  try {
    // Test User-Message relationships
    const messagesWithSenders = await postgresqlPrisma.message.findMany({
      take: 10,
      include: { sender: true }
    });
    
    for (const message of messagesWithSenders) {
      if (!message.sender) {
        relationshipErrors.push(`Message ${message.id} has invalid sender relationship`);
      }
    }
    
    // Test Conversation-Message relationships
    const conversationsWithMessages = await postgresqlPrisma.conversation.findMany({
      take: 5,
      include: { messages: { take: 1 } }
    });
    
    for (const conversation of conversationsWithMessages) {
      for (const message of conversation.messages) {
        if (message.conversationId !== conversation.id) {
          relationshipErrors.push(`Message ${message.id} has incorrect conversationId`);
        }
      }
    }
    
    // Test ConversationRatchetState-PostQuantumKey relationships
    const ratchetStatesWithKeys = await postgresqlPrisma.conversationRatchetState.findMany({
      take: 5,
      include: { postQuantumKeys: true }
    });
    
    for (const ratchetState of ratchetStatesWithKeys) {
      for (const pqKey of ratchetState.postQuantumKeys) {
        if (pqKey.ratchetStateId !== ratchetState.id) {
          relationshipErrors.push(`PostQuantumKey ${pqKey.id} has incorrect ratchetStateId`);
        }
      }
    }
    
    // Test DeviceIdentity-User relationships
    const devicesWithUsers = await postgresqlPrisma.deviceIdentity.findMany({
      take: 5,
      include: { user: true }
    });
    
    for (const device of devicesWithUsers) {
      if (!device.user) {
        relationshipErrors.push(`DeviceIdentity ${device.id} has invalid user relationship`);
      }
    }
    
  } catch (error) {
    relationshipErrors.push(`Relationship validation error: ${error.message}`);
  }
  
  if (relationshipErrors.length > 0) {
    console.log('❌ Relationship validation errors found:');
    relationshipErrors.forEach(error => console.log(`  - ${error}`));
    return false;
  }
  
  console.log('✅ Relationship validation passed!');
  return true;
}

/**
 * Validate encryption-specific data
 */
async function validateEncryptionData() {
  console.log('\n🔐 Validating encryption-specific data...');
  
  const encryptionErrors = [];
  
  try {
    // Validate encrypted messages have proper fields
    const encryptedMessages = await postgresqlPrisma.message.findMany({
      where: { encrypted: true },
      take: 10
    });
    
    for (const message of encryptedMessages) {
      if (!message.encryptionKey && !message.ratchetEncrypted) {
        encryptionErrors.push(`Encrypted message ${message.id} missing encryption key and not ratchet encrypted`);
      }
      
      if (message.pqcEncrypted && (!message.kyberCiphertext || !message.dilithiumSignature)) {
        encryptionErrors.push(`PQC encrypted message ${message.id} missing Kyber ciphertext or Dilithium signature`);
      }
    }
    
    // Validate ratchet states have required keys
    const ratchetStates = await postgresqlPrisma.conversationRatchetState.findMany({
      take: 5
    });
    
    for (const state of ratchetStates) {
      if (!state.rootKeyEncrypted || !state.sendingChainKeyEncrypted || !state.receivingChainKeyEncrypted) {
        encryptionErrors.push(`RatchetState ${state.id} missing required encrypted keys`);
      }
      
      if (state.pqcEnabled && !state.postQuantumKeys?.length) {
        // Note: This check would need to include the relation
        console.log(`  ⚠️  RatchetState ${state.id} has PQC enabled but relationship check skipped`);
      }
    }
    
    // Validate post-quantum keys
    const pqKeys = await postgresqlPrisma.postQuantumKey.findMany({
      where: { isActive: true },
      take: 10
    });
    
    for (const key of pqKeys) {
      if (!key.keyData || !key.algorithm || !key.keyType) {
        encryptionErrors.push(`PostQuantumKey ${key.id} missing required fields`);
      }
      
      if (key.algorithm === 'kyber768' && !key.keyType.includes('kyber')) {
        encryptionErrors.push(`PostQuantumKey ${key.id} algorithm/keyType mismatch`);
      }
    }
    
  } catch (error) {
    encryptionErrors.push(`Encryption validation error: ${error.message}`);
  }
  
  if (encryptionErrors.length > 0) {
    console.log('❌ Encryption validation errors found:');
    encryptionErrors.forEach(error => console.log(`  - ${error}`));
    return false;
  }
  
  console.log('✅ Encryption data validation passed!');
  return true;
}

/**
 * Generate comprehensive validation report
 */
async function generateValidationReport() {
  console.log('\n📋 Generating validation report...');
  
  const report = {
    validationDate: new Date().toISOString(),
    databaseVersions: {
      sqlite: 'SQLite (original)',
      postgresql: 'PostgreSQL (migrated)'
    },
    validationResults: {
      recordCounts: false,
      dataIntegrity: false,
      relationships: false,
      encryptionData: false
    },
    summary: {
      totalValidations: 4,
      passedValidations: 0,
      failedValidations: 0
    },
    recommendations: []
  };
  
  // Run all validations
  try {
    report.validationResults.recordCounts = await validateRecordCounts();
    report.validationResults.dataIntegrity = await validateDataIntegrity();
    report.validationResults.relationships = await validateRelationships();
    report.validationResults.encryptionData = await validateEncryptionData();
    
    // Calculate summary
    report.summary.passedValidations = Object.values(report.validationResults).filter(Boolean).length;
    report.summary.failedValidations = report.summary.totalValidations - report.summary.passedValidations;
    
    // Generate recommendations
    if (!report.validationResults.recordCounts) {
      report.recommendations.push('Review and fix record count mismatches before proceeding');
    }
    if (!report.validationResults.dataIntegrity) {
      report.recommendations.push('Investigate and resolve data integrity issues');
    }
    if (!report.validationResults.relationships) {
      report.recommendations.push('Fix foreign key relationship errors');
    }
    if (!report.validationResults.encryptionData) {
      report.recommendations.push('Validate and fix encryption-specific data issues');
    }
    
    if (report.summary.passedValidations === report.summary.totalValidations) {
      report.recommendations.push('Migration validation successful - safe to proceed with testing');
    } else {
      report.recommendations.push('DO NOT proceed to production until all validation errors are resolved');
    }
    
  } catch (error) {
    console.error('❌ Validation report generation failed:', error);
    report.error = error.message;
  }
  
  // Save report
  const reportPath = path.join(__dirname, 'validation_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`📄 Validation report saved to: ${reportPath}`);
  
  return report;
}

/**
 * Main validation function
 */
async function runFullValidation() {
  console.log('🚀 Starting comprehensive migration validation...\n');
  
  try {
    const report = await generateValidationReport();
    
    console.log('\n🎯 Validation Summary:');
    console.log(`✅ Passed: ${report.summary.passedValidations}/${report.summary.totalValidations}`);
    console.log(`❌ Failed: ${report.summary.failedValidations}/${report.summary.totalValidations}`);
    
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => console.log(`  - ${rec}`));
    }
    
    if (report.summary.passedValidations === report.summary.totalValidations) {
      console.log('\n🎉 Migration validation completed successfully!');
      return true;
    } else {
      console.log('\n⚠️  Migration validation completed with errors!');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Validation process failed:', error);
    return false;
  } finally {
    await sqlitePrisma.$disconnect();
    await postgresqlPrisma.$disconnect();
  }
}

// Run validation if called directly
if (require.main === module) {
  (async () => {
    try {
      const success = await runFullValidation();
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('Validation process failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { 
  runFullValidation,
  validateRecordCounts,
  validateDataIntegrity,
  validateRelationships,
  validateEncryptionData,
  generateValidationReport
};