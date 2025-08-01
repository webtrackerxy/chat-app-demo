#!/usr/bin/env node

/**
 * PFS Decryption Test - Attempt to decrypt the provided message
 * 
 * This script simulates the PFS decryption process to understand
 * how the encrypted message should be decrypted.
 */

const crypto = require('crypto');
const sodium = require('libsodium-wrappers');

async function main() {
  await sodium.ready;
  
  console.log('🔓 PFS DECRYPTION SIMULATION TEST');
  console.log('==================================');

  // The encrypted message to decrypt
  const encryptedPayload = {
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

  console.log('\n📋 Message Structure Analysis:');
  console.log('==============================');
  console.log(`🔑 Key ID: ${encryptedPayload.keyId}`);
  console.log(`🔐 Mode: ${encryptedPayload.metadata.mode}`);
  console.log(`📊 Message Number: ${encryptedPayload.metadata.messageNumber}`);
  console.log(`🔗 Chain Length: ${encryptedPayload.metadata.chainLength}`);
  console.log(`⏰ Timestamp: ${new Date(encryptedPayload.metadata.timestamp).toISOString()}`);

  // Convert base64 to binary
  const ciphertext = Buffer.from(encryptedPayload.encryptedText, 'base64');
  const nonce = Buffer.from(encryptedPayload.iv, 'base64');
  const tag = Buffer.from(encryptedPayload.tag, 'base64');
  const ephemeralPublicKey = Buffer.from(encryptedPayload.metadata.ephemeralPublicKey, 'base64');

  console.log('\n🔍 Binary Data Analysis:');
  console.log('========================');
  console.log(`📦 Ciphertext: ${ciphertext.length} bytes`);
  console.log(`🔢 Nonce: ${nonce.length} bytes`);
  console.log(`🏷️  Auth Tag: ${tag.length} bytes`);
  console.log(`🔑 Ephemeral Key: ${ephemeralPublicKey.length} bytes`);

  console.log('\n🧪 Attempting Decryption Simulation...');
  console.log('======================================');

  try {
    // Simulate the decryption process based on the codebase analysis
    
    console.log('Step 1: Parsing encrypted payload structure...');
    const ratchetMessage = {
      encryptedData: {
        ciphertext: new Uint8Array(ciphertext),
        nonce: new Uint8Array(nonce),
        tag: new Uint8Array(tag),
      },
      ephemeralPublicKey: new Uint8Array(ephemeralPublicKey),
      messageNumber: encryptedPayload.metadata.messageNumber,
      chainLength: encryptedPayload.metadata.chainLength,
      previousChainLength: encryptedPayload.metadata.previousChainLength,
      timestamp: encryptedPayload.metadata.timestamp,
    };

    console.log('✅ Step 1 complete: Ratchet message structure created');

    console.log('\nStep 2: Creating associated data for authentication...');
    
    // Simulate the associated data creation (based on MessageEncryptionService)
    const senderId = 'test-user'; // This would need to be known
    const encoder = new TextEncoder();
    const senderIdBytes = encoder.encode(senderId);
    
    // Calculate total size for associated data
    const totalSize = 4 + // senderId length
                     senderIdBytes.length +
                     4 + // messageNumber
                     4 + // chainLength
                     8 + // timestamp
                     4 + // ephemeralPublicKey length
                     ephemeralPublicKey.length;
    
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;
    
    // Sender ID
    view.setUint32(offset, senderIdBytes.length, false);
    offset += 4;
    new Uint8Array(buffer, offset, senderIdBytes.length).set(senderIdBytes);
    offset += senderIdBytes.length;
    
    // Message number
    view.setUint32(offset, encryptedPayload.metadata.messageNumber, false);
    offset += 4;
    
    // Chain length
    view.setUint32(offset, encryptedPayload.metadata.chainLength, false);
    offset += 4;
    
    // Timestamp
    view.setBigUint64(offset, BigInt(Math.floor(encryptedPayload.metadata.timestamp)), false);
    offset += 8;
    
    // Ephemeral public key
    view.setUint32(offset, ephemeralPublicKey.length, false);
    offset += 4;
    new Uint8Array(buffer, offset, ephemeralPublicKey.length).set(ephemeralPublicKey);
    
    const associatedData = new Uint8Array(buffer);
    console.log(`✅ Step 2 complete: Associated data created (${associatedData.length} bytes)`);

    console.log('\nStep 3: What we need for actual decryption...');
    console.log('=============================================');
    console.log('❌ Missing: Message key (derived from chain key)');
    console.log('❌ Missing: Ratchet state for this conversation');
    console.log('❌ Missing: Root key for key derivation');
    console.log('❌ Missing: Private key corresponding to ephemeral public key');

    console.log('\n💡 Decryption Algorithm (ChaCha20-Poly1305):');
    console.log('============================================');
    console.log('The message uses ChaCha20-Poly1305 AEAD encryption.');
    console.log('To decrypt, we would need to:');
    console.log('1. Derive the message key from the ratchet state');
    console.log('2. Combine ciphertext + tag for libsodium');
    console.log('3. Call crypto_aead_chacha20poly1305_ietf_decrypt()');
    console.log('4. Verify associated data integrity');

    // Show what a decryption attempt would look like (without the actual key)
    console.log('\n🔐 Theoretical Decryption Process:');
    console.log('==================================');
    
    // Combine ciphertext and tag (as required by libsodium)
    const combined = new Uint8Array(ciphertext.length + tag.length);
    combined.set(ciphertext);
    combined.set(tag, ciphertext.length);
    
    console.log(`📦 Combined ciphertext+tag: ${combined.length} bytes`);
    console.log(`🔢 Nonce for decryption: ${nonce.length} bytes`);
    console.log(`📊 Associated data: ${associatedData.length} bytes`);
    
    console.log('\n⚠️  Without the proper message key, decryption cannot proceed.');
    console.log('The message key is derived from the Double Ratchet state,');
    console.log('which requires the initial shared secret and conversation context.');

    console.log('\n🎯 How to actually decrypt this message:');
    console.log('========================================');
    console.log('1. Set up the encryption environment (React Native/Node.js)');
    console.log('2. Initialize DoubleRatchetService with proper conversation ID');
    console.log('3. Recreate or load the ratchet state for this conversation');
    console.log('4. Call doubleRatchetService.decryptMessage() with the full ratchet message');
    console.log('5. The service will derive the message key and decrypt using ChaCha20-Poly1305');

    console.log('\n📝 Message Content Speculation:');
    console.log('===============================');
    console.log('Based on the 5-byte ciphertext, possible plaintexts:');
    console.log('• "test" (4 chars + possible padding)');
    console.log('• "hi" (2 chars + padding)'); 
    console.log('• "ok" (2 chars + padding)');
    console.log('• Short emoji or special character');

  } catch (error) {
    console.error('❌ Error in decryption simulation:', error.message);
  }

  console.log('\n✅ Analysis Complete');
  console.log('===================');
  console.log('This is a properly formatted PFS message that requires');
  console.log('the full cryptographic context to decrypt.');
}

main().catch(console.error);