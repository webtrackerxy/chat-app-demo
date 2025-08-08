# Database Migration Plan: SQLite to PostgreSQL

## Overview

This document outlines the comprehensive plan to migrate the chat application database from SQLite to PostgreSQL while maintaining data integrity and system functionality.

## Prerequisites

### Database Setup
1. **Install PostgreSQL** locally or use existing instance
2. **Create database and user**:
   ```sql
   CREATE DATABASE "chat-app";
   CREATE USER postgres WITH PASSWORD 'postgres';
   GRANT ALL PRIVILEGES ON DATABASE "chat-app" TO postgres;
   ```

### Required Dependencies
```bash
cd chat-backend
npm install pg @types/pg
```

## Migration Phases

### Phase 1: Database Setup & Schema Migration

#### Key Schema Changes Required
- Change `@id` fields from `Int @id @default(autoincrement())` to `@id @default(autoincrement())`  
- Update `DateTime` field defaults to use `now()` instead of SQLite functions
- Convert `Bytes` fields to `BYTEA` type for PostgreSQL compatibility
- Handle JSON columns properly for PostgreSQL
- Update unique constraints and indexes for PostgreSQL syntax

#### Critical Schema Updates
```prisma
model User {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  // ... rest of model
}

model Message {
  id               Int      @id @default(autoincrement())
  encryptedContent Bytes?   // Maps to BYTEA in PostgreSQL
  timestamp        DateTime @default(now())
  // ... rest of model
}
```

### Phase 2: Environment & Configuration Updates

#### Backend Environment Variables
Update `chat-backend/.env`:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chat-app"
PORT=3000
MAX_FILE_SIZE=10485760
```

#### Prisma Configuration
Ensure `chat-backend/prisma/schema.prisma` uses PostgreSQL provider:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Phase 3: Data Migration Strategy

#### Export Existing SQLite Data
Create migration script to:
- Export all tables as structured data
- Handle encryption keys and binary data carefully
- Maintain referential integrity during transfer
- Preserve conversation ratchet states and post-quantum keys

#### Migration Script Structure
```bash
# 1. Export current SQLite data
node scripts/export-sqlite-data.js

# 2. Update Prisma schema
npx prisma db push

# 3. Import data to PostgreSQL
node scripts/import-postgresql-data.js

# 4. Validate migration
node scripts/validate-migration.js
```

#### Critical Data to Migrate
- **Users**: Including public keys and device identities
- **Conversations**: With all participants and metadata
- **Messages**: Encrypted content and encryption metadata
- **ConversationRatchetState**: Perfect Forward Secrecy states
- **PostQuantumKey**: Post-quantum cryptographic keys
- **DeviceIdentity**: Multi-device support data

### Phase 4: Code Updates

#### Database Service Layer Updates
Review and update `chat-backend/src/database/` services for PostgreSQL:
- Connection handling improvements
- Query optimization for PostgreSQL
- Error handling for PostgreSQL-specific errors
- Transaction management updates

#### Potential Query Updates
- Replace SQLite-specific functions with PostgreSQL equivalents
- Update any raw SQL queries in the codebase
- Optimize queries for PostgreSQL performance characteristics

### Phase 5: Testing & Validation

#### Comprehensive Testing Checklist
- [ ] **All encryption services** (PFS, PQC, Multi-Device)
- [ ] **Real-time messaging** via Socket.IO
- [ ] **File upload/download** functionality
- [ ] **Conversation management** (create, join, leave)
- [ ] **User authentication** and registration
- [ ] **Database service layer** operations
- [ ] **Message history** and pagination
- [ ] **Encryption key rotation** and management

#### Test Commands
```bash
# Backend tests
cd chat-backend
npm test                    # All tests
npm run test:encryption     # Encryption-specific tests
npm run test:encryption-api # Encryption API tests

# Frontend tests
cd chat-frontend
npm test                    # All tests
npm run test:encryption     # Encryption-specific tests
```

### Phase 6: Performance & Production Considerations

#### Database Optimization
- **Indexes**: Add appropriate indexes for frequently queried columns
  ```sql
  CREATE INDEX idx_messages_conversation_timestamp ON "Message" ("conversationId", "timestamp");
  CREATE INDEX idx_conversation_participants ON "ConversationParticipant" ("conversationId", "userId");
  ```
- **Connection Pooling**: Configure appropriate pool sizes
- **Query Performance**: Analyze and optimize slow queries

#### Backup Strategy
- Implement automated daily backups
- Test restore procedures regularly
- Consider point-in-time recovery setup
- Document backup and restore processes

#### Monitoring
- Set up database performance monitoring
- Configure alerting for connection issues
- Monitor query performance and slow queries
- Track database size and growth

## Migration Execution Steps

### Step 1: Preparation
```bash
# 1. Backup current SQLite database
cp chat-backend/prisma/dev.db chat-backend/prisma/dev.db.backup

# 2. Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE \"chat-app\";"
```

### Step 2: Schema Migration
```bash
cd chat-backend

# 1. Update DATABASE_URL in .env
# 2. Update Prisma schema for PostgreSQL
# 3. Generate new Prisma client
npx prisma generate

# 4. Push schema to PostgreSQL
npx prisma db push
```

### Step 3: Data Migration
```bash
# 1. Run data export script
node scripts/export-sqlite-data.js

# 2. Run data import script
node scripts/import-postgresql-data.js

# 3. Validate migration
node scripts/validate-migration.js
```

### Step 4: Testing
```bash
# 1. Run all backend tests
npm test

# 2. Run encryption tests
npm run test:encryption

# 3. Start development server and test manually
npm run dev
```

### Step 5: Frontend Testing
```bash
cd chat-frontend

# 1. Run all frontend tests
npm test

# 2. Test real-time functionality
npx expo start --localhost
```

## Rollback Plan

In case of migration issues:

1. **Stop the application**
2. **Restore SQLite database**: `cp chat-backend/prisma/dev.db.backup chat-backend/prisma/dev.db`
3. **Revert environment**: Update `DATABASE_URL` back to SQLite
4. **Regenerate Prisma client**: `npx prisma generate`
5. **Restart application**

## Post-Migration Checklist

- [ ] All tests passing
- [ ] Real-time messaging working
- [ ] File uploads/downloads functional
- [ ] Encryption services operational
- [ ] Performance benchmarks acceptable
- [ ] Backup system configured
- [ ] Monitoring in place
- [ ] Documentation updated

## Notes

- **Encryption Keys**: Special attention required for binary key data migration
- **Timestamps**: Ensure timezone handling is consistent
- **Performance**: Monitor initial performance and optimize as needed
- **Concurrent Users**: Test with multiple simultaneous connections
- **File Storage**: Verify file path handling works correctly