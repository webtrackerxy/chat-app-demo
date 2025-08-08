#!/usr/bin/env node

/**
 * Rollback migration script
 * Rolls back from PostgreSQL to SQLite in case of migration issues
 */

const { PrismaClient } = require('../chat-backend/node_modules/@prisma/client');
const fs = require('fs');
const path = require('path');

/**
 * Backup current PostgreSQL data before rollback
 */
async function backupPostgreSQLData() {
  console.log('💾 Backing up current PostgreSQL data...');
  
  const postgresqlPrisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/chat-app'
      }
    }
  });
  
  const backupDir = path.join(__dirname, 'rollback-backup');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  try {
    // Create backup of current PostgreSQL state
    const tables = [
      { name: 'users', model: 'user' },
      { name: 'conversations', model: 'conversation' },
      { name: 'messages', model: 'message' },
      { name: 'conversationRatchetStates', model: 'conversationRatchetState' },
      { name: 'postQuantumKeys', model: 'postQuantumKey' }
    ];
    
    const backupSummary = {
      backupDate: new Date().toISOString(),
      tables: {}
    };
    
    for (const table of tables) {
      try {
        const data = await postgresqlPrisma[table.model].findMany();
        const backupFile = path.join(backupDir, `${table.name}.json`);
        fs.writeFileSync(backupFile, JSON.stringify(data, null, 2));
        backupSummary.tables[table.name] = data.length;
        console.log(`  ✅ Backed up ${data.length} records from ${table.name}`);
      } catch (error) {
        console.warn(`  ⚠️  Failed to backup ${table.name}: ${error.message}`);
      }
    }
    
    // Save backup summary
    fs.writeFileSync(
      path.join(backupDir, 'backup_summary.json'),
      JSON.stringify(backupSummary, null, 2)
    );
    
    console.log(`✅ PostgreSQL backup completed: ${backupDir}`);
    
  } catch (error) {
    console.error('❌ PostgreSQL backup failed:', error.message);
    throw error;
  } finally {
    await postgresqlPrisma.$disconnect();
  }
}

/**
 * Restore SQLite database from backup
 */
async function restoreSQLiteDatabase() {
  console.log('🔄 Restoring SQLite database from backup...');
  
  const sqliteDbPath = path.join(__dirname, '../chat-backend/prisma/dev.db');
  const backupDbPath = path.join(__dirname, '../chat-backend/prisma/dev.db.backup');
  
  try {
    // Check if backup exists
    if (!fs.existsSync(backupDbPath)) {
      throw new Error('SQLite backup file not found. Cannot rollback.');
    }
    
    // Stop any running processes that might be using the database
    console.log('⚠️  Please ensure the application is stopped before proceeding...');
    
    // Create a backup of current state (just in case)
    if (fs.existsSync(sqliteDbPath)) {
      const rollbackBackupPath = path.join(__dirname, 'current-sqlite-backup.db');
      fs.copyFileSync(sqliteDbPath, rollbackBackupPath);
      console.log(`📦 Current SQLite state backed up to: ${rollbackBackupPath}`);
    }
    
    // Restore from backup
    fs.copyFileSync(backupDbPath, sqliteDbPath);
    console.log('✅ SQLite database restored from backup');
    
    // Verify restored database
    const sqlitePrisma = new PrismaClient({
      datasources: {
        db: {
          url: `file:${sqliteDbPath}`
        }
      }
    });
    
    try {
      const userCount = await sqlitePrisma.user.count();
      const messageCount = await sqlitePrisma.message.count();
      console.log(`✅ Restored database verified: ${userCount} users, ${messageCount} messages`);
    } catch (error) {
      console.error('❌ Restored database verification failed:', error.message);
      throw error;
    } finally {
      await sqlitePrisma.$disconnect();
    }
    
  } catch (error) {
    console.error('❌ SQLite restoration failed:', error.message);
    throw error;
  }
}

/**
 * Update configuration files for SQLite
 */
async function updateConfigurationForSQLite() {
  console.log('⚙️  Updating configuration for SQLite...');
  
  try {
    // Update .env file
    const envPath = path.join(__dirname, '../chat-backend/.env');
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Replace PostgreSQL URL with SQLite URL
      envContent = envContent.replace(
        /DATABASE_URL=["']?postgresql:\/\/.*["']?/g,
        'DATABASE_URL="file:./dev.db"'
      );
      
      fs.writeFileSync(envPath, envContent);
      console.log('✅ Updated .env file for SQLite');
    } else {
      console.warn('⚠️  .env file not found, please update DATABASE_URL manually');
    }
    
    // Update Prisma schema
    const schemaPath = path.join(__dirname, '../chat-backend/prisma/schema.prisma');
    if (fs.existsSync(schemaPath)) {
      let schemaContent = fs.readFileSync(schemaPath, 'utf8');
      
      // Replace PostgreSQL provider with SQLite
      schemaContent = schemaContent.replace(
        /provider = ["']?postgresql["']?/g,
        'provider = "sqlite"'
      );
      
      fs.writeFileSync(schemaPath, schemaContent);
      console.log('✅ Updated Prisma schema for SQLite');
    } else {
      console.warn('⚠️  Prisma schema not found, please update provider manually');
    }
    
  } catch (error) {
    console.error('❌ Configuration update failed:', error.message);
    throw error;
  }
}

/**
 * Regenerate Prisma client for SQLite
 */
async function regeneratePrismaClient() {
  console.log('🔧 Regenerating Prisma client for SQLite...');
  
  const { spawn } = require('child_process');
  
  return new Promise((resolve, reject) => {
    const generateProcess = spawn('npx', ['prisma', 'generate'], {
      cwd: path.join(__dirname, '../chat-backend'),
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    generateProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    generateProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    generateProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Prisma client regenerated for SQLite');
        console.log(output);
        resolve();
      } else {
        console.error('❌ Prisma client generation failed');
        console.error(errorOutput);
        reject(new Error(`Prisma generate failed with code ${code}`));
      }
    });
    
    generateProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Verify rollback success
 */
async function verifyRollback() {
  console.log('🔍 Verifying rollback success...');
  
  const sqlitePrisma = new PrismaClient();
  
  try {
    // Test basic database operations
    const userCount = await sqlitePrisma.user.count();
    const conversationCount = await sqlitePrisma.conversation.count();
    const messageCount = await sqlitePrisma.message.count();
    
    console.log(`📊 Database counts after rollback:`);
    console.log(`  Users: ${userCount}`);
    console.log(`  Conversations: ${conversationCount}`);
    console.log(`  Messages: ${messageCount}`);
    
    // Test encryption data integrity
    const encryptedMessages = await sqlitePrisma.message.count({
      where: { encrypted: true }
    });
    
    const ratchetStates = await sqlitePrisma.conversationRatchetState.count();
    
    console.log(`🔐 Encryption data:`);
    console.log(`  Encrypted messages: ${encryptedMessages}`);
    console.log(`  Ratchet states: ${ratchetStates}`);
    
    // Test a sample query with relations
    const sampleUser = await sqlitePrisma.user.findFirst({
      include: {
        sentMessages: { take: 1 },
        conversations: { take: 1 }
      }
    });
    
    if (sampleUser) {
      console.log(`✅ Relations working: User ${sampleUser.username} has ${sampleUser.sentMessages.length} messages, ${sampleUser.conversations.length} conversations`);
    }
    
    console.log('✅ Rollback verification successful!');
    
  } catch (error) {
    console.error('❌ Rollback verification failed:', error.message);
    throw error;
  } finally {
    await sqlitePrisma.$disconnect();
  }
}

/**
 * Generate rollback report
 */
async function generateRollbackReport(rollbackReason) {
  const report = {
    rollbackDate: new Date().toISOString(),
    rollbackReason: rollbackReason || 'Manual rollback requested',
    rollbackSteps: {
      postgresqlBackup: false,
      sqliteRestore: false,
      configurationUpdate: false,
      prismaRegeneration: false,
      verification: false
    },
    rollbackDuration: 0,
    dataIntegrity: {
      backupCreated: false,
      dataRestored: false,
      verificationspassed: false
    },
    recommendations: [
      'Review rollback reason and address issues before attempting migration again',
      'Ensure all application processes are restarted after rollback',
      'Run comprehensive tests to verify application functionality',
      'Consider incremental migration approach if full migration failed',
      'Update documentation with lessons learned'
    ],
    nextSteps: [
      '1. Restart application services',
      '2. Run backend tests: npm test',
      '3. Run frontend tests: npm test',
      '4. Verify real-time functionality',
      '5. Check encryption services',
      '6. Monitor application performance'
    ]
  };
  
  const reportPath = path.join(__dirname, 'rollback_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Rollback report saved to: ${reportPath}`);
  
  return report;
}

/**
 * Main rollback function
 */
async function performRollback(reason) {
  console.log('🔄 Starting migration rollback process...\n');
  
  const startTime = Date.now();
  let rollbackSteps = {};
  
  try {
    // Step 1: Backup current PostgreSQL data
    await backupPostgreSQLData();
    rollbackSteps.postgresqlBackup = true;
    
    // Step 2: Restore SQLite database
    await restoreSQLiteDatabase();
    rollbackSteps.sqliteRestore = true;
    
    // Step 3: Update configuration files
    await updateConfigurationForSQLite();
    rollbackSteps.configurationUpdate = true;
    
    // Step 4: Regenerate Prisma client
    await regeneratePrismaClient();
    rollbackSteps.prismaRegeneration = true;
    
    // Step 5: Verify rollback
    await verifyRollback();
    rollbackSteps.verification = true;
    
    // Generate rollback report
    const report = await generateRollbackReport(reason);
    report.rollbackSteps = rollbackSteps;
    report.rollbackDuration = Date.now() - startTime;
    report.dataIntegrity.backupCreated = true;
    report.dataIntegrity.dataRestored = true;
    report.dataIntegrity.verificationsPressed = true;
    
    // Update report
    fs.writeFileSync(
      path.join(__dirname, 'rollback_report.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('\n🎉 Migration rollback completed successfully!');
    console.log(`⏱️  Rollback duration: ${report.rollbackDuration}ms`);
    
    console.log('\n📋 Next Steps:');
    report.nextSteps.forEach(step => console.log(`  ${step}`));
    
    console.log('\n⚠️  Important:');
    console.log('  - Restart all application services');
    console.log('  - Run comprehensive tests');
    console.log('  - Review rollback reason before retry');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ Rollback process failed:', error.message);
    
    console.log('\n🚨 Manual Recovery Required:');
    console.log('  1. Stop all application processes');
    console.log('  2. Manually restore SQLite backup:');
    console.log('     cp chat-backend/prisma/dev.db.backup chat-backend/prisma/dev.db');
    console.log('  3. Update DATABASE_URL to SQLite in .env');
    console.log('  4. Update Prisma schema provider to "sqlite"');
    console.log('  5. Run: npx prisma generate');
    console.log('  6. Test application functionality');
    
    return false;
  }
}

// Run rollback if called directly
if (require.main === module) {
  const rollbackReason = process.argv[2] || 'Manual rollback requested';
  
  (async () => {
    try {
      const success = await performRollback(rollbackReason);
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('Rollback process failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { 
  performRollback, 
  backupPostgreSQLData, 
  restoreSQLiteDatabase, 
  verifyRollback 
};