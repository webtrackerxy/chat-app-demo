# Database Schema Documentation

This document provides comprehensive documentation of the chat application's PostgreSQL database schema, including table structures, relationships, and design rationale.

## 📊 Schema Overview

The chat application database consists of **23 interconnected tables** organized into logical domains with **hybrid message storage** combining in-memory and database persistence:

### 🏗️ Architecture Design Principles
- **Scalability**: Designed for multi-user concurrent access
- **Security**: End-to-end encryption with multiple cryptographic modes
- **Extensibility**: Modular design for future feature additions
- **Performance**: Optimized indexes and query patterns with hybrid storage
- **Data Integrity**: Comprehensive foreign key constraints
- **Hybrid Storage**: In-memory caching + database persistence for optimal performance

## 📋 Table Categories

### 1. 👥 Core User & Authentication
| Table | Purpose | Key Features |
|-------|---------|-------------|
| `users` | User accounts and profiles | Username, status, encryption keys |

### 2. 💬 Messaging Core
| Table | Purpose | Key Features |
|-------|---------|-------------|
| `conversations` | Chat rooms and direct messages | Group/direct type, timestamps |
| `conversation_participants` | User membership in conversations | Roles, join/leave tracking |
| `messages` | Individual chat messages | Encryption metadata, threading |

### 3. 📎 Media & Interactions
| Table | Purpose | Key Features |
|-------|---------|-------------|
| `message_files` | File attachments | Type, size, path storage |
| `message_reactions` | Emoji reactions | User-message association |
| `read_receipts` | Message read status | Read timestamps per user |

### 4. 🔐 Encryption Infrastructure
| Table | Purpose | Key Features |
|-------|---------|-------------|
| `conversation_keys` | Conversation encryption keys | Per-user encrypted keys |
| `conversation_ratchet_states` | Perfect Forward Secrecy state | Double Ratchet protocol |
| `post_quantum_keys` | Post-quantum cryptographic keys | Kyber768, Dilithium3 |
| `skipped_message_keys` | Out-of-order message handling | Key storage for PFS |
| `algorithm_negotiations` | Cryptographic capability exchange | Security level negotiation |
| `crypto_migrations` | Encryption upgrade tracking | Version management |

### 5. 📱 Multi-Device Support
| Table | Purpose | Key Features |
|-------|---------|-------------|
| `device_identities` | Device cryptographic identities | Trust levels, verification |
| `device_verifications` | Cross-device authentication | Verification methods |
| `key_sync_packages` | Cross-device key synchronization | Encrypted key distribution |
| `authentication_sessions` | Device-to-device auth sessions | Challenge-response |

### 6. 🔄 Synchronization & Conflict Resolution
| Table | Purpose | Key Features |
|-------|---------|-------------|
| `key_conflicts` | Encryption key conflicts | Multi-device consistency |
| `conflict_resolutions` | Conflict resolution decisions | Consensus mechanisms |
| `offline_sync_queues` | Offline synchronization queues | Priority-based sync |
| `offline_sync_items` | Individual sync queue items | Status tracking |
| `delta_sync_checkpoints` | Incremental sync checkpoints | Version control |

### 7. 🤝 Key Exchange & Coordination
| Table | Purpose | Key Features |
|-------|---------|-------------|
| `key_exchanges` | Backend-managed key exchanges | Automated key distribution |

## 🔗 Relationship Mapping

### Primary Relationships
```
users (1) ←→ (M) conversation_participants ←→ (1) conversations
users (1) ←→ (M) messages ←→ (1) conversations
users (1) ←→ (M) device_identities
conversations (1) ←→ (M) conversation_ratchet_states ←→ (M) post_quantum_keys
```

### Encryption Relationships
```
conversation_ratchet_states (1) ←→ (M) skipped_message_keys
conversation_ratchet_states (1) ←→ (M) post_quantum_keys
device_identities (1) ←→ (M) key_sync_packages
```

### Advanced Feature Relationships
```
messages (1) ←→ (M) message_files
messages (1) ←→ (M) message_reactions
messages (1) ←→ (M) read_receipts
messages (1) ←→ (M) messages (threading via replyToId)
```

## 📋 Detailed Table Specifications

### 👤 Users Table
```sql
CREATE TABLE "users" (
    id         VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    username   VARCHAR UNIQUE NOT NULL,
    publicKey  TEXT,                    -- RSA public key (base64)
    privateKey TEXT,                    -- Encrypted private key
    lastSeen   TIMESTAMP DEFAULT NOW(),
    status     VARCHAR DEFAULT 'offline',
    createdAt  TIMESTAMP DEFAULT NOW(),
    updatedAt  TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Core user accounts with basic cryptographic identity
**Key Features:**
- Username-based authentication
- RSA key pair for initial key exchange
- Online status tracking
- Account lifecycle timestamps

### 💬 Conversations Table
```sql
CREATE TABLE "conversations" (
    id        VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    type      VARCHAR DEFAULT 'group',   -- 'group' or 'direct'
    name      VARCHAR,                   -- Group name (null for direct)
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW(),
    createdBy VARCHAR REFERENCES users(id)
);
```

**Purpose:** Chat rooms and direct message containers
**Key Features:**
- Support for both group chats and direct messages
- Optional naming for group conversations
- Creator tracking for permission management

### 👥 Conversation Participants Table
```sql
CREATE TABLE "conversation_participants" (
    id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    conversationId VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    userId         VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joinedAt       TIMESTAMP DEFAULT NOW(),
    role           VARCHAR DEFAULT 'member',  -- 'admin', 'member'
    leftAt         TIMESTAMP,                 -- Soft delete for leave
    
    UNIQUE(conversationId, userId)
);
```

**Purpose:** User membership and permissions in conversations
**Key Features:**
- Role-based access control (admin/member)
- Join/leave tracking without data loss
- Unique constraint prevents duplicate memberships

### 💌 Messages Table
```sql
CREATE TABLE "messages" (
    id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    conversationId VARCHAR NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    senderId       VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text           TEXT,
    threadId       VARCHAR,              -- Threading support
    replyToId      VARCHAR REFERENCES messages(id),
    
    -- Basic Encryption
    encrypted      BOOLEAN DEFAULT FALSE,
    encryptionKey  TEXT,
    
    -- Perfect Forward Secrecy
    ratchetEncrypted     BOOLEAN DEFAULT FALSE,
    ephemeralPublicKey   TEXT,
    messageNumber        INTEGER,
    chainLength          INTEGER,
    previousChainLength  INTEGER,
    ratchetHeader        TEXT,           -- JSON metadata
    
    -- Post-Quantum Cryptography
    cryptoVersion        VARCHAR DEFAULT '1.0',
    algorithm            VARCHAR DEFAULT 'classical',
    securityLevel        INTEGER DEFAULT 1,
    pqcEncrypted         BOOLEAN DEFAULT FALSE,
    kyberCiphertext      TEXT,           -- Kyber KEM (base64)
    dilithiumSignature   TEXT,           -- Dilithium signature (base64)
    hybridMetadata       TEXT,           -- JSON for hybrid mode
    negotiationId        VARCHAR,        -- Algorithm negotiation ref
    
    timestamp      TIMESTAMP DEFAULT NOW(),
    createdAt      TIMESTAMP DEFAULT NOW(),
    updatedAt      TIMESTAMP DEFAULT NOW()
);
```

**Purpose:** Core message storage with comprehensive encryption support
**Key Features:**
- Multi-mode encryption (Classical, PFS, Post-Quantum)
- Threading and reply functionality
- Detailed cryptographic metadata
- Algorithm version tracking for migrations

### 🔐 Conversation Ratchet States Table
```sql
CREATE TABLE "conversation_ratchet_states" (
    id             VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    conversationId VARCHAR NOT NULL,
    userId         VARCHAR NOT NULL,
    
    -- Encrypted ratchet keys (base64)
    rootKeyEncrypted           TEXT NOT NULL,
    sendingChainKeyEncrypted   TEXT NOT NULL,
    receivingChainKeyEncrypted TEXT NOT NULL,
    
    -- Message counters
    sendingMessageNumber     INTEGER DEFAULT 0,
    receivingMessageNumber   INTEGER DEFAULT 0,
    sendingChainLength       INTEGER DEFAULT 0,
    receivingChainLength     INTEGER DEFAULT 0,
    
    -- Ephemeral keys (base64)
    sendingEphemeralPrivateKey  TEXT,
    sendingEphemeralPublicKey   TEXT,
    receivingEphemeralPublicKey TEXT,
    
    -- Post-Quantum support
    cryptoVersion    VARCHAR DEFAULT '1.0',
    algorithm        VARCHAR DEFAULT 'classical',
    securityLevel    INTEGER DEFAULT 1,
    pqcEnabled       BOOLEAN DEFAULT FALSE,
    hybridMode       BOOLEAN DEFAULT FALSE,
    
    createdAt TIMESTAMP DEFAULT NOW(),
    updatedAt TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(conversationId, userId)
);
```

**Purpose:** Perfect Forward Secrecy state management (Signal Protocol)
**Key Features:**
- Double Ratchet algorithm implementation
- Per-user, per-conversation state isolation
- Message counter synchronization
- Post-quantum cryptography integration

### 🌐 Device Identities Table
```sql
CREATE TABLE "device_identities" (
    id        VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    deviceId  VARCHAR UNIQUE NOT NULL,
    userId    VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Device information
    deviceName VARCHAR NOT NULL,
    deviceType VARCHAR NOT NULL,      -- 'mobile', 'desktop', 'web', 'tablet'
    platform   VARCHAR NOT NULL,
    version    VARCHAR NOT NULL,
    
    -- Cryptographic identity (base64)
    signingPublicKey     TEXT NOT NULL,
    signingPrivateKey    TEXT NOT NULL,    -- Encrypted with master key
    encryptionPublicKey  TEXT NOT NULL,
    encryptionPrivateKey TEXT NOT NULL,    -- Encrypted with master key
    
    -- Trust management
    isVerified   BOOLEAN DEFAULT FALSE,
    trustLevel   VARCHAR DEFAULT 'unverified',
    verifiedBy   TEXT,                     -- JSON array of verifying devices
    trustScore   INTEGER DEFAULT 0,        -- 0-100 trust score
    
    -- Lifecycle
    registeredAt DateTime DEFAULT NOW(),
    lastSeen     DateTime DEFAULT NOW(),
    revokedAt    DateTime,
    revokedBy    VARCHAR,
    revocationReason TEXT,
    
    createdAt DateTime DEFAULT NOW(),
    updatedAt DateTime DEFAULT NOW()
);
```

**Purpose:** Multi-device cryptographic identity management
**Key Features:**
- Cross-device trust establishment
- Hardware/software platform tracking
- Comprehensive trust scoring system
- Device lifecycle management

## 🎯 Design Rationale

### Scalability Considerations
- **UUID Primary Keys**: Distributed system compatibility
- **Soft Deletes**: Data preservation for audit trails
- **Partitioning Ready**: Message tables can be partitioned by date
- **Index Optimization**: Covering indexes for common query patterns

### Security Design
- **Defense in Depth**: Multiple encryption layers
- **Key Isolation**: Per-user, per-conversation key separation
- **Forward Secrecy**: Automatic key rotation
- **Post-Quantum Ready**: Future-proof cryptographic algorithms

### Performance Optimizations
```sql
-- Core messaging queries
CREATE INDEX idx_messages_conversation_timestamp 
ON "messages" (conversation_id, timestamp DESC);

-- User activity queries
CREATE INDEX idx_users_status_lastseen 
ON "users" (status, last_seen DESC);

-- Encryption key lookups
CREATE INDEX idx_ratchet_states_conversation_user 
ON "conversation_ratchet_states" (conversation_id, user_id);

-- Multi-device queries
CREATE INDEX idx_devices_user_verified 
ON "device_identities" (user_id, is_verified, last_seen DESC);
```

## 📊 Data Flow Patterns

### Message Flow
1. **Message Creation**: User → `messages` table
2. **Encryption**: Algorithm selection → encryption metadata
3. **Distribution**: Participants query → real-time delivery
4. **Read Tracking**: `read_receipts` updates
5. **Reactions**: `message_reactions` additions

### Key Management Flow
1. **User Registration**: `users` + initial key generation
2. **Device Addition**: `device_identities` + verification
3. **Conversation Join**: `conversation_participants` + key distribution
4. **Message Encryption**: `conversation_ratchet_states` + key evolution
5. **Cross-Device Sync**: `key_sync_packages` + conflict resolution

### Conflict Resolution Flow
1. **Conflict Detection**: Multi-device key mismatch
2. **Conflict Recording**: `key_conflicts` entry
3. **Resolution Process**: `conflict_resolutions` voting
4. **Consensus Achievement**: Winner selection
5. **Key Synchronization**: All devices updated

## 🔍 Query Examples

### Find User's Active Conversations
```sql
SELECT c.*, COUNT(m.id) as message_count, MAX(m.timestamp) as last_message
FROM conversations c
JOIN conversation_participants cp ON c.id = cp.conversation_id
LEFT JOIN messages m ON c.id = m.conversation_id
WHERE cp.user_id = $1 AND cp.left_at IS NULL
GROUP BY c.id
ORDER BY last_message DESC NULLS LAST;
```

### Get Encryption Status for Conversation
```sql
SELECT 
    crs.algorithm,
    crs.security_level,
    crs.pqc_enabled,
    COUNT(pqk.id) as pqc_key_count
FROM conversation_ratchet_states crs
LEFT JOIN post_quantum_keys pqk ON crs.id = pqk.ratchet_state_id
WHERE crs.conversation_id = $1 AND crs.user_id = $2
GROUP BY crs.id;
```

### Device Trust Analysis
```sql
SELECT 
    di.device_name,
    di.trust_level,
    di.trust_score,
    COUNT(dv.id) as verification_count
FROM device_identities di
LEFT JOIN device_verifications dv ON di.device_id = dv.target_device_id
WHERE di.user_id = $1 AND di.revoked_at IS NULL
GROUP BY di.id
ORDER BY di.trust_score DESC;
```

---

**Schema Version:** 1.1  
**Last Updated:** August 7, 2025  
**Database Engine:** PostgreSQL 16.9  
**Total Tables:** 23  
**Message Storage:** Hybrid (In-Memory + Database)  
**Migration Status:** ✅ Production Ready with Full Message Persistence