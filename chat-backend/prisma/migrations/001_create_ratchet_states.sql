-- Migration 001: Create Ratchet State Storage Tables
-- This migration creates the necessary tables for storing Double Ratchet state
-- for Perfect Forward Secrecy implementation

-- Table for storing per-user ratchet states for each conversation
CREATE TABLE conversation_ratchet_states (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    
    -- Encrypted ratchet keys (base64 encoded)
    root_key_encrypted TEXT NOT NULL,
    sending_chain_key_encrypted TEXT NOT NULL,
    receiving_chain_key_encrypted TEXT NOT NULL,
    
    -- Message counters
    sending_message_number INTEGER NOT NULL DEFAULT 0,
    receiving_message_number INTEGER NOT NULL DEFAULT 0,
    sending_chain_length INTEGER NOT NULL DEFAULT 0,
    receiving_chain_length INTEGER NOT NULL DEFAULT 0,
    
    -- Ephemeral keys (base64 encoded)
    sending_ephemeral_private_key TEXT,
    sending_ephemeral_public_key TEXT,
    receiving_ephemeral_public_key TEXT,
    
    -- Metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(conversation_id, user_id)
);

-- Table for storing skipped message keys (for out-of-order message handling)
CREATE TABLE skipped_message_keys (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    ratchet_state_id TEXT NOT NULL,
    message_key_id TEXT NOT NULL,
    encrypted_key TEXT NOT NULL,
    chain_length INTEGER NOT NULL,
    message_number INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL DEFAULT (datetime(CURRENT_TIMESTAMP, '+7 days')),
    
    -- Foreign key constraint
    FOREIGN KEY (ratchet_state_id) REFERENCES conversation_ratchet_states(id) ON DELETE CASCADE,
    
    -- Ensure unique message key per ratchet state
    UNIQUE(ratchet_state_id, message_key_id)
);

-- Create indexes for performance optimization
CREATE INDEX idx_ratchet_states_conversation ON conversation_ratchet_states(conversation_id);
CREATE INDEX idx_ratchet_states_user ON conversation_ratchet_states(user_id);
CREATE INDEX idx_ratchet_states_updated ON conversation_ratchet_states(updated_at);

CREATE INDEX idx_skipped_keys_ratchet_state ON skipped_message_keys(ratchet_state_id);
CREATE INDEX idx_skipped_keys_expires ON skipped_message_keys(expires_at);
CREATE INDEX idx_skipped_keys_message_id ON skipped_message_keys(ratchet_state_id, message_key_id);

-- Create trigger to automatically update updated_at timestamp
CREATE TRIGGER update_ratchet_state_timestamp 
    AFTER UPDATE ON conversation_ratchet_states
    FOR EACH ROW
BEGIN
    UPDATE conversation_ratchet_states 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;