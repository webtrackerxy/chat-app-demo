# Database Migration & Management

This directory contains all tools and documentation for the chat application's database migration from SQLite to PostgreSQL, including comprehensive migration scripts and schema documentation.

## 📋 Quick Start

### For New Projects
```bash
# 1. Set up PostgreSQL
node database/setup-postgresql.js

# 2. Run migration (if migrating from SQLite)
node database/migrate.js

# 3. Validate migration
node database/validate-migration.js
```

### For Development
```bash
# Backend with PostgreSQL
cd chat-backend
npm start  # Uses PostgreSQL automatically

# Frontend
cd chat-frontend
npx expo start --localhost
```

## 📁 Directory Structure

```
database/
├── README.md                     # This file - comprehensive guide
├── schema-diagram.md              # Visual database schema documentation
├── schema.erDiagram              # Mermaid ERD for the database schema
├── DATABASE_MIGRATION_PLAN.md    # Original migration strategy
├── DATABASE_MIGRATION_SUMMARY.md # Completed migration report
│
├── Core Migration Scripts:
├── migrate.js                    # Main orchestrator (8-phase automated migration)
├── setup-postgresql.js           # PostgreSQL setup and optimization
├── export-sqlite-data.js         # SQLite data export to JSON
├── import-postgresql-data.js     # PostgreSQL data import with validation
├── validate-migration.js         # Comprehensive migration validation
├── rollback-migration.js         # Complete rollback to SQLite
│
├── Generated Files (during migration):
├── exports/                      # Exported SQLite data (JSON files)
│   ├── users.json
│   ├── conversations.json
│   ├── conversation_participants.json
│   └── [22 other table exports]
├── migration_state_*.json        # Migration progress tracking
├── migration_report_*.json       # Final migration reports
├── validation_report.json        # Data validation results
└── setup_report.json            # PostgreSQL setup results
```

## 🎯 Migration Status

### ✅ Completed Migration (August 7, 2025)
- **Status:** Successfully completed with hybrid message storage
- **Duration:** ~45 minutes
- **Data Migrated:** 12+ records (6 users, 2 conversations, 4 participants, messages)
- **Result:** Zero data loss, production-ready PostgreSQL backend with full message persistence

### Current Database Configuration
```env
# PostgreSQL Configuration
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chat-app"
Provider: PostgreSQL 16.9
Host: localhost:5432
Database: chat-app
Status: ✅ Fully Operational
```

## 🗄️ Database Schema Overview

The chat application uses a sophisticated multi-table schema designed for:
- **Real-time messaging** with WebSocket support and database persistence
- **End-to-end encryption** (PFS, Post-Quantum, Multi-Device)
- **Multi-user conversations** with role-based permissions
- **File sharing** with metadata tracking
- **Advanced features** (reactions, read receipts, threading)
- **Hybrid storage** (in-memory + database) for optimal performance

### Core Tables (23 total)
- **Users & Authentication:** `users`
- **Messaging:** `conversations`, `conversation_participants`, `messages`
- **Media:** `message_files`, `message_reactions`, `read_receipts`
- **Encryption:** `conversation_keys`, `conversation_ratchet_states`, `post_quantum_keys`
- **Multi-Device:** `device_identities`, `key_sync_packages`, `authentication_sessions`
- **Advanced Features:** `algorithm_negotiations`, `crypto_migrations`, `key_conflicts`

For detailed schema documentation, see [`schema-diagram.md`](./schema-diagram.md) and [`schema.erDiagram`](./schema.erDiagram).

## 🔧 Migration Scripts

### 1. Main Orchestrator (`migrate.js`)
Complete automated migration with 8 phases:
```bash
node database/migrate.js                    # Full migration
node database/migrate.js --skip-setup       # Skip PostgreSQL setup
node database/migrate.js --skip-testing     # Skip test execution
node database/migrate.js resume <id> <phase> # Resume from specific phase
```

**Phases:**
1. **Preparation** - Backup and dependency installation
2. **Setup** - PostgreSQL database and index creation
3. **Export** - SQLite data export to JSON
4. **Schema Update** - Prisma configuration for PostgreSQL
5. **Import** - Data import with foreign key handling
6. **Validation** - Multi-layer data integrity verification
7. **Testing** - Application test suite execution
8. **Completion** - Final report generation

### 2. Database Setup (`setup-postgresql.js`)
```bash
node database/setup-postgresql.js
```
- Creates `chat-app` database
- Configures user permissions
- Creates optimized indexes
- Performance monitoring setup

### 3. Data Migration Scripts
```bash
# Export SQLite data to JSON
node database/export-sqlite-data.js

# Import JSON data to PostgreSQL  
node database/import-postgresql-data.js

# Validate migration integrity
node database/validate-migration.js
```

### 4. Rollback Capability
```bash
# Complete rollback to SQLite
node database/rollback-migration.js "Reason for rollback"
```
- Backs up current PostgreSQL data
- Restores SQLite database from backup
- Updates configuration files
- Regenerates Prisma client
- Verifies rollback success

## 🧪 Testing & Validation

### Validation Layers
1. **Record Count Verification** - Ensures all data migrated
2. **Data Integrity Checks** - Spot-checks critical data
3. **Relationship Validation** - Foreign key constraints
4. **Encryption Data Verification** - Cryptographic material integrity

### Test Commands
```bash
# Backend tests
cd chat-backend
npm test                    # All tests (with message persistence)
npm run test:encryption     # Encryption-specific tests (23 tests)
npm run test:encryption-api # API integration tests

# Frontend tests
cd chat-frontend
npm test                    # All tests
npm run test:encryption     # Encryption-specific tests
```

### Message Persistence Testing
```bash
# Test message creation and retrieval
curl -X POST http://localhost:3000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"text":"Test message","senderId":"user123","conversationId":"conv456"}'

# Verify message persistence
curl -X GET http://localhost:3000/api/conversations/conv456/messages
```

### Performance Benchmarks
- **Query Response Time:** 0-1ms
- **Data Import Speed:** 425ms for 12 records
- **Connection Establishment:** <100ms
- **Index Creation:** <2 seconds

## 📡 Message Storage Architecture

### Hybrid Storage System
The chat application uses a **hybrid message storage approach** that combines the benefits of in-memory performance with database persistence:

#### Storage Layers
1. **In-Memory Buffer** - For ultra-fast real-time delivery
   - WebSocket message broadcasting
   - Active conversation state
   - Recent message caching
   - Backward compatibility with hardcoded demo data

2. **PostgreSQL Database** - For reliable persistence
   - All new messages saved immediately
   - Full conversation history
   - Message metadata (reactions, read receipts)
   - File attachments and encryption data

#### Message Flow
```
1. Message Received → 2. Save to Database → 3. Update Memory → 4. Broadcast via WebSocket
                   ↘                    ↘
                    Database Persistence  In-Memory Cache
                   ↗                    ↗
5. Message Query ← 6. Try Database First ← 7. Fallback to Memory
```

#### Benefits
- **Performance**: Fast WebSocket delivery from memory
- **Reliability**: All messages persisted to database
- **Scalability**: Database handles large message volumes
- **Compatibility**: Supports existing hardcoded conversations

#### Implementation Details
- Messages created via API or WebSocket are automatically saved to PostgreSQL
- Message retrieval checks database first, falls back to in-memory storage
- Real-time features (reactions, read receipts) update both storage layers
- Error handling ensures messages aren't lost if one storage layer fails

## 🔐 Security & Encryption

### Encryption Architecture
The database supports multiple encryption modes:
- **PFS (Perfect Forward Secrecy)** - Signal Protocol implementation
- **PQC (Post-Quantum Cryptography)** - NIST-standardized algorithms
- **Multi-Device** - Cross-device key synchronization

### Key Storage Tables
- `conversation_ratchet_states` - Double Ratchet protocol state
- `post_quantum_keys` - Kyber768 & Dilithium3 keys
- `device_identities` - Multi-device cryptographic identities
- `key_sync_packages` - Cross-device key distribution

### Security Features
- **Always-on Encryption** - Automatic initialization
- **Hardware-backed Security** - Keychain/Keystore integration
- **Key Rotation** - Automated key lifecycle management
- **Conflict Resolution** - Multi-device consistency

## 📈 Performance Optimization

### Database Indexes
Optimized indexes created for high-performance queries:
```sql
-- Message retrieval optimization
CREATE INDEX idx_messages_conversation_timestamp 
ON "Message" ("conversationId", "timestamp");

-- User conversation queries
CREATE INDEX idx_conversation_participants_user 
ON "ConversationParticipant" ("userId", "leftAt");

-- Encryption key lookups
CREATE INDEX idx_post_quantum_keys_ratchet_type_active 
ON "PostQuantumKey" ("ratchetStateId", "keyType", "isActive");
```

### Connection Optimization
- **Connection Pooling** - Efficient resource utilization
- **Query Caching** - Reduced database load
- **Prepared Statements** - SQL injection protection

### Production Recommendations
```sql
-- PostgreSQL configuration recommendations
shared_buffers = 256MB          # 25% of RAM
work_mem = 4MB                  # Per-operation memory
maintenance_work_mem = 64MB     # Maintenance operations
effective_cache_size = 1GB      # 75% of RAM
max_connections = 100           # Concurrent connection limit
```

## 🚀 Production Deployment

### Pre-Deployment Checklist
- [ ] PostgreSQL server configured and secured
- [ ] SSL/TLS certificates installed
- [ ] Database backups scheduled
- [ ] Monitoring systems configured
- [ ] Performance baselines established
- [ ] Security audit completed

### Environment Configuration
```env
# Production Environment (.env)
DATABASE_URL="postgresql://username:password@host:5432/database?sslmode=require"
RATCHET_STATE_ENCRYPTION_KEY="your-production-key-here"
ENCRYPTION_MODE=PFS
```

### Monitoring Setup
```sql
-- Enable query logging
log_statement = 'all'
log_duration = on
log_min_duration_statement = 1000

-- Monitor key metrics
SELECT * FROM pg_stat_activity;
SELECT * FROM pg_stat_user_tables;
```

## 🛠️ Troubleshooting

### Common Issues

#### Migration Failures
```bash
# Check migration state
cat database/migration_state_*.json

# Resume from failed phase
node database/migrate.js resume <migrationId> <phase>

# Complete rollback if needed
node database/rollback-migration.js
```

#### Connection Issues
```bash
# Test PostgreSQL connection
psql -U postgres -d chat-app -c "SELECT version();"

# Verify environment variables
node -e "console.log(process.env.DATABASE_URL)"

# Test Prisma connection
cd chat-backend && npx prisma db pull
```

#### Performance Issues
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC LIMIT 10;

-- Analyze table statistics
ANALYZE;
VACUUM ANALYZE;
```

### Recovery Procedures
1. **Database Corruption:** Use `pg_dump` backups for restore
2. **Migration Rollback:** Use `rollback-migration.js`
3. **Schema Issues:** Use `npx prisma db push --force-reset`
4. **Performance Degradation:** Rebuild indexes with `REINDEX`

## 📚 Additional Resources

### Documentation Files
- [`DATABASE_MIGRATION_PLAN.md`](./DATABASE_MIGRATION_PLAN.md) - Original migration strategy
- [`DATABASE_MIGRATION_SUMMARY.md`](./DATABASE_MIGRATION_SUMMARY.md) - Completed migration report
- [`schema-diagram.md`](./schema-diagram.md) - Visual schema documentation
- [`schema.erDiagram`](./schema.erDiagram) - Mermaid ERD file

### External Resources
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma Documentation](https://www.prisma.io/docs/)
- [Chat App Architecture Guide](../README.md)

### Support
For migration issues or questions:
1. Check the troubleshooting section above
2. Review migration logs in `database/migration_*.json`
3. Consult the validation reports for data integrity issues
4. Use rollback procedures if migration fails

---

**Last Updated:** August 7, 2025  
**Migration Status:** ✅ Successfully Completed  
**Database Version:** PostgreSQL 16.9  
**Next Review:** After production deployment