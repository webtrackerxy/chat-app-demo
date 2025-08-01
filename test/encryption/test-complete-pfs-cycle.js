#!/usr/bin/env node

/**
 * Complete PFS Encryption/Decryption Cycle Test
 * 
 * This script demonstrates the complete Perfect Forward Secrecy encryption and decryption
 * cycle to understand how the provided encrypted message was created and how it can be decrypted.
 */

const sodium = require('libsodium-wrappers');

class TestDoubleRatchetService {
  constructor() {
    this.states = new Map();
  }

  async initialize() {
    await sodium.ready;
  }

  // Simplified key derivation (for testing purposes)
  async deriveKeys(sharedSecret, context) {
    const hkdf = sodium.crypto_kdf_derive_from_key;
    const rootKey = sodium.crypto_kdf_derive_from_key(32, 1, context, sharedSecret);
    const chainKey = sodium.crypto_kdf_derive_from_key(32, 2, context, sharedSecret);
    return { rootKey, chainKey };
  }

  // Generate X25519 key pair
  generateKeyPair() {
    const keyPair = sodium.crypto_kx_keypair();
    return {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey
    };
  }

  // Derive message key from chain key
  deriveMessageKey(chainKey, messageNumber) {
    const context = `msg-${messageNumber}`;
    return sodium.crypto_kdf_derive_from_key(32, messageNumber + 1, context, chainKey);
  }

  // Advance chain key
  advanceChainKey(chainKey) {
    return sodium.crypto_generichash(32, chainKey, sodium.from_string('advance'));
  }

  // Create associated data
  createAssociatedData(metadata) {
    const encoder = new TextEncoder();
    const senderIdBytes = encoder.encode(metadata.senderId);
    
    const totalSize = 4 + senderIdBytes.length + 4 + 4 + 8 + 4 + (metadata.ephemeralPublicKey?.length || 0);
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;
    
    // Sender ID
    view.setUint32(offset, senderIdBytes.length, false);
    offset += 4;
    new Uint8Array(buffer, offset, senderIdBytes.length).set(senderIdBytes);
    offset += senderIdBytes.length;
    
    // Message number
    view.setUint32(offset, metadata.messageNumber, false);
    offset += 4;
    
    // Chain length
    view.setUint32(offset, metadata.chainLength, false);
    offset += 4;
    
    // Timestamp
    view.setBigUint64(offset, BigInt(Math.floor(metadata.timestamp)), false);
    offset += 8;
    
    // Ephemeral public key
    const ephemeralKeyLength = metadata.ephemeralPublicKey?.length || 0;
    view.setUint32(offset, ephemeralKeyLength, false);
    offset += 4;
    
    if (metadata.ephemeralPublicKey) {
      new Uint8Array(buffer, offset, ephemeralKeyLength).set(metadata.ephemeralPublicKey);
    }
    
    return new Uint8Array(buffer);
  }

  // Encrypt message using ChaCha20-Poly1305
  encryptMessage(plaintext, messageKey, associatedData) {
    const plaintextBytes = sodium.from_string(plaintext);
    const nonce = sodium.randombytes_buf(sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES);
    
    const encrypted = sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
      plaintextBytes,
      associatedData || null,
      null,
      nonce,
      messageKey
    );
    
    const ciphertext = encrypted.slice(0, -16);
    const tag = encrypted.slice(-16);
    
    return {
      ciphertext,
      nonce,
      tag,
      associatedData
    };
  }

  // Decrypt message using ChaCha20-Poly1305
  decryptMessage(encryptedPayload, messageKey) {
    const combined = new Uint8Array(encryptedPayload.ciphertext.length + encryptedPayload.tag.length);
    combined.set(encryptedPayload.ciphertext);
    combined.set(encryptedPayload.tag, encryptedPayload.ciphertext.length);
    
    const decrypted = sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
      null,
      combined,
      encryptedPayload.associatedData || null,
      encryptedPayload.nonce,
      messageKey
    );
    
    return sodium.to_string(decrypted);
  }

  // Initialize a simplified ratchet state
  async initializeRatchet(conversationId, userId, sharedSecret) {
    const { rootKey, chainKey } = await this.deriveKeys(sharedSecret, `${conversationId}-${userId}-init`);
    const ephemeralKeyPair = this.generateKeyPair();
    
    const state = {
      rootKey,
      sendingChainKey: chainKey,
      sendingMessageNumber: 0,
      sendingChainLength: 0,
      sendingEphemeralKey: ephemeralKeyPair,
      conversationId,
      userId
    };
    
    this.states.set(`${conversationId}-${userId}`, state);
    return state;
  }

  // Encrypt a message using the ratchet
  async encryptRatchetMessage(conversationId, userId, plaintext) {
    const state = this.states.get(`${conversationId}-${userId}`);
    if (!state) {
      throw new Error('Ratchet state not found');
    }

    // Derive message key
    const messageKey = this.deriveMessageKey(state.sendingChainKey, state.sendingMessageNumber);
    
    // Create associated data
    const timestamp = Date.now();
    const associatedData = this.createAssociatedData({
      senderId: userId,
      messageNumber: state.sendingMessageNumber,
      chainLength: state.sendingChainLength,
      timestamp: timestamp,
      ephemeralPublicKey: state.sendingEphemeralKey.publicKey
    });

    // Encrypt message
    const encryptedData = this.encryptMessage(plaintext, messageKey, associatedData);

    // Create ratchet message
    const ratchetMessage = {
      encryptedData,
      ephemeralPublicKey: state.sendingEphemeralKey.publicKey,
      messageNumber: state.sendingMessageNumber,
      chainLength: state.sendingChainLength,
      previousChainLength: 0,
      timestamp: timestamp
    };

    // Advance state
    state.sendingChainKey = this.advanceChainKey(state.sendingChainKey);
    state.sendingMessageNumber++;

    return ratchetMessage;
  }

  // Decrypt a ratchet message
  async decryptRatchetMessage(conversationId, userId, ratchetMessage) {
    const state = this.states.get(`${conversationId}-${userId}`);
    if (!state) {
      throw new Error('Ratchet state not found');
    }

    // For this test, we'll use the same chain key derivation
    const messageKey = this.deriveMessageKey(state.sendingChainKey, ratchetMessage.messageNumber);
    
    return this.decryptMessage(ratchetMessage.encryptedData, messageKey);
  }
}

async function main() {
  console.log('🔄 COMPLETE PFS ENCRYPTION/DECRYPTION CYCLE TEST');
  console.log('================================================');

  const testService = new TestDoubleRatchetService();
  await testService.initialize();

  // Test parameters
  const conversationId = 'e9b32fca-a5cf-4e40-832d-ae2899f51cf8';
  const userId = 'test-user';
  const sharedSecret = sodium.randombytes_buf(32);

  console.log('\n📋 Test Setup:');
  console.log('==============');
  console.log(`Conversation ID: ${conversationId}`);
  console.log(`User ID: ${userId}`);
  console.log(`Shared Secret: ${sodium.to_hex(sharedSecret)}`);

  try {
    // Initialize ratchet
    console.log('\n🔧 Step 1: Initialize Double Ratchet...');
    const state = await testService.initializeRatchet(conversationId, userId, sharedSecret);
    console.log('✅ Ratchet state initialized');

    // Test with very short message (to match the original encrypted message size)
    const testMessages = ['hi', 'ok', 'test', 'hello'];
    
    console.log('\n🔐 Step 2: Encrypt Test Messages...');
    for (const message of testMessages) {
      console.log(`\n--- Testing message: "${message}" ---`);
      
      // Reset state for each test
      await testService.initializeRatchet(conversationId, userId, sharedSecret);
      
      const encrypted = await testService.encryptRatchetMessage(conversationId, userId, message);
      
      console.log('🔒 Encrypted Message Structure:');
      console.log(`   Ciphertext: ${encrypted.encryptedData.ciphertext.length} bytes`);
      console.log(`   Nonce: ${encrypted.encryptedData.nonce.length} bytes`);
      console.log(`   Tag: ${encrypted.encryptedData.tag.length} bytes`);
      console.log(`   Ephemeral Key: ${encrypted.ephemeralPublicKey.length} bytes`);
      console.log(`   Message Number: ${encrypted.messageNumber}`);
      console.log(`   Chain Length: ${encrypted.chainLength}`);
      
      // Convert to base64 format (like the original message)
      const base64Payload = {
        encryptedText: sodium.to_base64(encrypted.encryptedData.ciphertext),
        iv: sodium.to_base64(encrypted.encryptedData.nonce),
        tag: sodium.to_base64(encrypted.encryptedData.tag),
        keyId: `pfs-${conversationId}`,
        metadata: {
          mode: 'PFS',
          ephemeralPublicKey: sodium.to_base64(encrypted.ephemeralPublicKey),
          messageNumber: encrypted.messageNumber,
          chainLength: encrypted.chainLength,
          previousChainLength: encrypted.previousChainLength,
          timestamp: encrypted.timestamp
        }
      };
      
      console.log('📦 Base64 Payload:');
      console.log(JSON.stringify(base64Payload, null, 2));
      
      // Test decryption
      try {
        const decrypted = await testService.decryptRatchetMessage(conversationId, userId, encrypted);
        console.log(`✅ Decryption successful: "${decrypted}"`);
        
        if (decrypted === message) {
          console.log('🎉 Perfect match! Encryption/decryption cycle complete.');
        } else {
          console.log('❌ Decryption mismatch!');
        }
      } catch (error) {
        console.log(`❌ Decryption failed: ${error.message}`);
      }
    }

    console.log('\n🧪 Step 3: Analyze Original Encrypted Message...');
    console.log('================================================');

    // The original encrypted message
    const originalMessage = {
      "encryptedText": "DNvCPTU=",
      "iv": "63TYy2Rt5EOsW/UP",
      "tag": "jX/b4fCDHdaY/CsBo8dbCA==",
      "keyId": "pfs-e9b32fca-a5cf-4e40-832d-ae2899f51cf8",
      "metadata": {
        "mode": "PFS",
        "ephemeralPublicKey": "t4F9DX5GnZ/I+dkwnoC1sOjsVLXBsfZ/40qL9FGgK1I=",
        "messageNumber": 0,
        "chainLength": 0,
        "previousChainLength": 0,
        "timestamp": 1753991205970
      }
    };

    // Decode the original message components
    const originalCiphertext = sodium.from_base64(originalMessage.encryptedText);
    const originalNonce = sodium.from_base64(originalMessage.iv);
    const originalTag = sodium.from_base64(originalMessage.tag);
    const originalEphemeralKey = sodium.from_base64(originalMessage.metadata.ephemeralPublicKey);

    console.log('🔍 Original Message Analysis:');
    console.log(`   Ciphertext length: ${originalCiphertext.length} bytes`);  
    console.log(`   Nonce length: ${originalNonce.length} bytes`);
    console.log(`   Tag length: ${originalTag.length} bytes`);
    console.log(`   Ephemeral key length: ${originalEphemeralKey.length} bytes`);
    console.log(`   Timestamp: ${new Date(originalMessage.metadata.timestamp).toISOString()}`);
    
    // Compare with our test messages
    console.log('\n📊 Size Comparison:');
    console.log('==================');
    console.log(`Original ciphertext: ${originalCiphertext.length} bytes`);
    console.log('Possible plaintexts:');
    
    for (const testMsg of testMessages) {
      const testBytes = sodium.from_string(testMsg);
      console.log(`   "${testMsg}": ${testBytes.length} bytes plaintext`);
      
      if (testBytes.length + 1 === originalCiphertext.length || testBytes.length === originalCiphertext.length) {
        console.log(`   ⭐ "${testMsg}" is a possible match!`);
      }
    }

    console.log('\n🔑 Decryption Requirements:');
    console.log('===========================');
    console.log('To decrypt the original message, you need:');
    console.log('1. The exact same shared secret used during initialization');
    console.log('2. The correct conversation and user context');
    console.log('3. The proper ratchet state at message number 0');
    console.log('4. The same key derivation parameters');
    console.log('5. Access to the DoubleRatchetService implementation');

    console.log('\n💡 Key Insights:');
    console.log('================');
    console.log('• The message uses proper ChaCha20-Poly1305 AEAD encryption');
    console.log('• X25519 ephemeral keys provide forward secrecy');
    console.log('• Associated data ensures message authenticity and prevents tampering');
    console.log('• The 5-byte ciphertext suggests a very short plaintext (likely 2-4 characters)');
    console.log('• This is message #0 in chain #0, so it\'s the first message in the conversation');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  }

  console.log('\n✅ Test Complete');
  console.log('================');
  console.log('This demonstrates the complete PFS encryption/decryption cycle.');
  console.log('The original message requires the specific cryptographic context to decrypt.');
}

main().catch(console.error);