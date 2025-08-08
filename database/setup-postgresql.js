#!/usr/bin/env node

/**
 * PostgreSQL setup script
 * Sets up PostgreSQL database, user, and initial configuration
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * PostgreSQL configuration
 */
const config = {
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'postgres' // Connect to default database first
};

const targetDatabase = 'chat-app';

/**
 * Connect to PostgreSQL and execute query
 */
async function executeQuery(client, query, description) {
  try {
    console.log(`📝 ${description}...`);
    const result = await client.query(query);
    console.log(`✅ ${description} completed`);
    return result;
  } catch (error) {
    if (error.code === '42P04' && description.includes('Creating database')) {
      console.log(`ℹ️  Database '${targetDatabase}' already exists`);
      return;
    }
    if (error.code === '42710' && description.includes('Creating user')) {
      console.log(`ℹ️  User already exists`);
      return;
    }
    console.error(`❌ ${description} failed:`, error.message);
    throw error;
  }
}

/**
 * Setup PostgreSQL database and user
 */
async function setupDatabase() {
  console.log('🚀 Setting up PostgreSQL database...\n');
  
  const client = new Client(config);
  
  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL server');
    
    // Create database
    await executeQuery(
      client,
      `CREATE DATABASE "${targetDatabase}";`,
      `Creating database '${targetDatabase}'`
    );
    
    // Grant privileges to postgres user
    await executeQuery(
      client,
      `GRANT ALL PRIVILEGES ON DATABASE "${targetDatabase}" TO postgres;`,
      'Granting privileges to postgres user'
    );
    
    await client.end();
    console.log('✅ Disconnected from PostgreSQL server');
    
    // Test connection to new database
    const testClient = new Client({
      ...config,
      database: targetDatabase
    });
    
    await testClient.connect();
    console.log(`✅ Successfully connected to '${targetDatabase}' database`);
    
    // Test basic functionality
    await executeQuery(
      testClient,
      'SELECT version();',
      'Testing PostgreSQL version'
    );
    
    await testClient.end();
    
    console.log('\n🎉 PostgreSQL database setup completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    throw error;
  }
}

/**
 * Create indexes for optimal performance
 */
async function createOptimizedIndexes() {
  console.log('\n🔧 Creating optimized indexes...');
  
  const client = new Client({
    ...config,
    database: targetDatabase
  });
  
  try {
    await client.connect();
    
    const indexes = [
      // Message indexes for conversation queries
      {
        name: 'idx_messages_conversation_timestamp',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_timestamp ON "Message" ("conversationId", "timestamp");',
        description: 'Message conversation timestamp index'
      },
      {
        name: 'idx_messages_sender_timestamp',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_sender_timestamp ON "Message" ("senderId", "timestamp");',
        description: 'Message sender timestamp index'
      },
      {
        name: 'idx_messages_algorithm_pqc',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_algorithm_pqc ON "Message" ("algorithm", "pqcEncrypted");',
        description: 'Message algorithm and PQC index'
      },
      
      // Conversation participant indexes
      {
        name: 'idx_conversation_participants_user',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_participants_user ON "ConversationParticipant" ("userId", "leftAt");',
        description: 'Conversation participant user index'
      },
      {
        name: 'idx_conversation_participants_conversation',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_participants_conversation ON "ConversationParticipant" ("conversationId", "role");',
        description: 'Conversation participant conversation index'
      },
      
      // Encryption-related indexes
      {
        name: 'idx_conversation_ratchet_states_user_conversation',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversation_ratchet_states_user_conversation ON "ConversationRatchetState" ("userId", "conversationId");',
        description: 'Conversation ratchet state user-conversation index'
      },
      {
        name: 'idx_post_quantum_keys_ratchet_type_active',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_quantum_keys_ratchet_type_active ON "PostQuantumKey" ("ratchetStateId", "keyType", "isActive");',
        description: 'Post-quantum key ratchet-type-active index'
      },
      {
        name: 'idx_post_quantum_keys_expires',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_post_quantum_keys_expires ON "PostQuantumKey" ("expiresAt") WHERE "expiresAt" IS NOT NULL;',
        description: 'Post-quantum key expiration index'
      },
      
      // Device and sync indexes
      {
        name: 'idx_device_identities_user_verified',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_device_identities_user_verified ON "DeviceIdentity" ("userId", "isVerified", "lastSeen");',
        description: 'Device identity user-verified index'
      },
      {
        name: 'idx_key_sync_packages_device_status',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_key_sync_packages_device_status ON "KeySyncPackage" ("toDeviceId", "status", "expiresAt");',
        description: 'Key sync package device-status index'
      },
      {
        name: 'idx_offline_sync_items_queue_status',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_offline_sync_items_queue_status ON "OfflineSyncItem" ("queueId", "syncStatus", "priority");',
        description: 'Offline sync item queue-status index'
      },
      
      // File and reaction indexes
      {
        name: 'idx_message_files_message',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_files_message ON "MessageFile" ("messageId", "type");',
        description: 'Message file message index'
      },
      {
        name: 'idx_message_reactions_message_user',
        query: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_message_reactions_message_user ON "MessageReaction" ("messageId", "userId");',
        description: 'Message reaction message-user index'
      }
    ];
    
    for (const index of indexes) {
      try {
        await executeQuery(client, index.query, index.description);
      } catch (error) {
        // Continue with other indexes if one fails
        console.warn(`⚠️  Failed to create ${index.name}: ${error.message}`);
      }
    }
    
    await client.end();
    console.log('✅ Optimized indexes created');
    
  } catch (error) {
    console.error('❌ Index creation failed:', error.message);
    throw error;
  }
}

/**
 * Configure PostgreSQL settings for optimal performance
 */
async function configurePerformanceSettings() {
  console.log('\n⚡ Configuring performance settings...');
  
  const client = new Client({
    ...config,
    database: targetDatabase
  });
  
  try {
    await client.connect();
    
    // Get current settings
    const currentSettings = await client.query(`
      SELECT name, setting, unit, context 
      FROM pg_settings 
      WHERE name IN (
        'shared_buffers', 
        'work_mem', 
        'maintenance_work_mem', 
        'effective_cache_size',
        'max_connections'
      );
    `);
    
    console.log('📊 Current PostgreSQL settings:');
    currentSettings.rows.forEach(row => {
      console.log(`  ${row.name}: ${row.setting}${row.unit || ''}`);
    });
    
    // Note: These settings typically require server restart and superuser privileges
    console.log('\n💡 Recommended performance settings for production:');
    console.log('  shared_buffers = 256MB (or 25% of RAM)');
    console.log('  work_mem = 4MB');
    console.log('  maintenance_work_mem = 64MB');
    console.log('  effective_cache_size = 1GB (or 75% of RAM)');
    console.log('  max_connections = 100');
    console.log('\n⚠️  These settings require PostgreSQL configuration file changes and server restart');
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Performance configuration check failed:', error.message);
    // Don't throw here as this is informational
  }
}

/**
 * Test database connection and performance
 */
async function testDatabasePerformance() {
  console.log('\n🧪 Testing database performance...');
  
  const client = new Client({
    ...config,
    database: targetDatabase
  });
  
  try {
    await client.connect();
    
    // Test basic query performance
    const start = Date.now();
    await client.query('SELECT 1 as test;');
    const basicQueryTime = Date.now() - start;
    
    console.log(`✅ Basic query response time: ${basicQueryTime}ms`);
    
    // Test transaction performance
    const txStart = Date.now();
    await client.query('BEGIN;');
    await client.query('SELECT 1;');
    await client.query('COMMIT;');
    const txTime = Date.now() - txStart;
    
    console.log(`✅ Transaction response time: ${txTime}ms`);
    
    // Get database statistics
    const stats = await client.query(`
      SELECT 
        schemaname,
        relname as tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes
      FROM pg_stat_user_tables 
      LIMIT 5;
    `);
    
    if (stats.rows.length > 0) {
      console.log('📊 Table statistics:');
      stats.rows.forEach(row => {
        console.log(`  ${row.tablename}: ${row.inserts} inserts, ${row.updates} updates, ${row.deletes} deletes`);
      });
    } else {
      console.log('ℹ️  No table statistics available (fresh database)');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Performance test failed:', error.message);
    throw error;
  }
}

/**
 * Generate setup summary report
 */
async function generateSetupReport() {
  const report = {
    setupDate: new Date().toISOString(),
    database: {
      name: targetDatabase,
      host: config.host,
      port: config.port,
      user: config.user
    },
    steps: {
      databaseCreation: false,
      indexCreation: false,
      performanceConfiguration: false,
      performanceTesting: false
    },
    recommendations: [
      'Update .env file with PostgreSQL connection string',
      'Update Prisma schema to use PostgreSQL provider',
      'Run prisma generate and prisma db push',
      'Test application connectivity before migration',
      'Monitor query performance after migration'
    ],
    nextSteps: [
      '1. Run: npm install pg @types/pg',
      '2. Update DATABASE_URL in .env',
      '3. Update schema.prisma provider to "postgresql"',
      '4. Run: npx prisma generate',
      '5. Run: npx prisma db push',
      '6. Execute data migration scripts'
    ]
  };
  
  // Save report
  const reportPath = path.join(__dirname, 'setup_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Setup report saved to: ${reportPath}`);
  
  return report;
}

/**
 * Main setup function
 */
async function setupPostgreSQL() {
  console.log('🚀 Starting PostgreSQL setup process...\n');
  
  try {
    await setupDatabase();
    // Skip index creation here - will be done after schema is pushed
    console.log('ℹ️  Skipping index creation until after schema is pushed');
    await configurePerformanceSettings();
    await testDatabasePerformance();
    
    const report = await generateSetupReport();
    
    console.log('\n🎉 PostgreSQL setup completed successfully!');
    console.log('\n📋 Next Steps:');
    report.nextSteps.forEach((step, index) => {
      console.log(`  ${step}`);
    });
    
    console.log('\n💡 Important Notes:');
    console.log('  - Update your .env file with the PostgreSQL connection string');
    console.log('  - Install pg and @types/pg packages');
    console.log('  - Update Prisma schema to use PostgreSQL provider');
    console.log('  - Test connection before running migration scripts');
    
    return true;
    
  } catch (error) {
    console.error('\n❌ PostgreSQL setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('  - Ensure PostgreSQL server is running');
    console.log('  - Check connection credentials');
    console.log('  - Verify user has necessary permissions');
    console.log('  - Check firewall and network settings');
    return false;
  }
}

// Run setup if called directly
if (require.main === module) {
  (async () => {
    try {
      const success = await setupPostgreSQL();
      process.exit(success ? 0 : 1);
    } catch (error) {
      console.error('Setup process failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = { setupPostgreSQL, createOptimizedIndexes, testDatabasePerformance };