-- Migration 002: Enhance Messages Table for Perfect Forward Secrecy
-- This migration adds fields to the messages table to support Double Ratchet encryption

-- Add columns for ratchet-encrypted messages
ALTER TABLE messages ADD COLUMN ratchet_encrypted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN ephemeral_public_key TEXT;
ALTER TABLE messages ADD COLUMN message_number INTEGER;
ALTER TABLE messages ADD COLUMN chain_length INTEGER;
ALTER TABLE messages ADD COLUMN previous_chain_length INTEGER;
ALTER TABLE messages ADD COLUMN ratchet_header TEXT; -- JSON metadata for ratchet protocol

-- Create index for ratchet-encrypted messages
CREATE INDEX idx_messages_ratchet ON messages(conversation_id, ratchet_encrypted, message_number);
CREATE INDEX idx_messages_chain ON messages(conversation_id, chain_length, message_number);

-- Add check constraint to ensure ratchet fields are consistent
-- If ratchet_encrypted is true, then ephemeral_public_key and message_number must be set
CREATE INDEX idx_messages_ratchet_validation ON messages(ratchet_encrypted, ephemeral_public_key, message_number)
    WHERE ratchet_encrypted = TRUE;