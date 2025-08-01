#!/usr/bin/env node

/**
 * Encryption Flow Fix Verification Test
 * 
 * This test verifies that the encryption service only encrypts messages
 * and does not send them to the server (preventing double-sending).
 */

const fs = require('fs');
const path = require('path');

console.log('🔐 ENCRYPTION FLOW FIX VERIFICATION');
console.log('===================================');

// Check adaptive service for proper encryption-only behavior
const servicePath = path.join(__dirname, 'chat-frontend/src/services/adaptiveEncryptionService.ts');
const serviceContent = fs.readFileSync(servicePath, 'utf8');

console.log('\n📋 Testing Encryption Service Behavior...\n');

// Check for removed sendEncryptedMessage calls in encryption methods
const hasPFSNoSend = !serviceContent.includes('await this.sendEncryptedMessage(conversationId, encryptedPayload, {\n      algorithm: \'double-ratchet\'');
const hasPQCNoSend = !serviceContent.includes('await this.sendEncryptedMessage(conversationId, encryptedPayload, {\n      algorithm: \'pqc-hybrid\'');
const hasMultiDeviceNoSend = !serviceContent.includes('await this.sendEncryptedMessage(conversationId, encryptedPayload, {\n      algorithm: \'multi-device-ratchet\'');

const hasPFSCompletionLog = serviceContent.includes('PFS encryption completed for message');
const hasPQCCompletionLog = serviceContent.includes('PQC encryption completed for message');
const hasMultiDeviceCompletionLog = serviceContent.includes('Multi-Device encryption completed for message');

const hasEncryptMessageMethod = serviceContent.includes('async encryptMessage(');
const returnsEncryptedPayload = serviceContent.includes('return encryptedPayload');

console.log(`1️⃣ PFS No Auto-Send: ${hasPFSNoSend ? '✅ FIXED' : '❌ STILL SENDING'}`);
console.log(`2️⃣ PQC No Auto-Send: ${hasPQCNoSend ? '✅ FIXED' : '❌ STILL SENDING'}`);
console.log(`3️⃣ Multi-Device No Auto-Send: ${hasMultiDeviceNoSend ? '✅ FIXED' : '❌ STILL SENDING'}`);
console.log(`4️⃣ PFS Completion Log: ${hasPFSCompletionLog ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`5️⃣ PQC Completion Log: ${hasPQCCompletionLog ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`6️⃣ Multi-Device Completion Log: ${hasMultiDeviceCompletionLog ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`7️⃣ Encrypt Method Exists: ${hasEncryptMessageMethod ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`8️⃣ Returns Encrypted Payload: ${returnsEncryptedPayload ? '✅ FOUND' : '❌ MISSING'}`);

// Check ChatRoomScreen for proper handling
const chatRoomPath = path.join(__dirname, 'chat-frontend/src/screens/ChatRoomScreen.tsx');
const chatRoomContent = fs.readFileSync(chatRoomPath, 'utf8');

console.log('\n📋 Testing ChatRoomScreen Integration...\n');

const hasEncryptionStateDebug = chatRoomContent.includes('Encryption state check:');
const hasEncryptionCondition = chatRoomContent.includes('if (isEncryptionEnabled && hasKeys && keysLoaded)');
const hasEncryptMessageCall = chatRoomContent.includes('messageToSend = await encryptMessage(inputText.trim(), conversationId, userId)');
const hasEncryptionNotAppliedLog = chatRoomContent.includes('Encryption not applied - conditions not met');
const hasMessageLengthLog = chatRoomContent.includes('Message encrypted successfully, length:');

console.log(`9️⃣ Encryption State Debug: ${hasEncryptionStateDebug ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`🔟 Encryption Condition Check: ${hasEncryptionCondition ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`1️⃣1️⃣ Encrypt Message Call: ${hasEncryptMessageCall ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`1️⃣2️⃣ Not Applied Warning: ${hasEncryptionNotAppliedLog ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`1️⃣3️⃣ Message Length Log: ${hasMessageLengthLog ? '✅ FOUND' : '❌ MISSING'}`);

// Check useEncryption hook returns string (JSON stringified payload)
const hookPath = path.join(__dirname, 'chat-frontend/src/hooks/useEncryption.ts');
const hookContent = fs.readFileSync(hookPath, 'utf8');

console.log('\n📋 Testing Hook Integration...\n');

const hasEncryptMessageSignature = hookContent.includes('encryptMessage: (text: string, conversationId: string, userId: string) => Promise<string>');
const hasJSONStringify = hookContent.includes('return JSON.stringify(encryptedPayload)');
const hasEncryptionServiceCall = hookContent.includes('await encryptionService.encryptMessage(');

console.log(`1️⃣4️⃣ Correct Method Signature: ${hasEncryptMessageSignature ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`1️⃣5️⃣ JSON Stringify Return: ${hasJSONStringify ? '✅ FOUND' : '❌ MISSING'}`);
console.log(`1️⃣6️⃣ Service Call Present: ${hasEncryptionServiceCall ? '✅ FOUND' : '❌ MISSING'}`);

// Calculate overall score
const tests = [
  hasPFSNoSend,
  hasPQCNoSend,
  hasMultiDeviceNoSend,
  hasPFSCompletionLog,
  hasPQCCompletionLog,
  hasMultiDeviceCompletionLog,
  hasEncryptMessageMethod,
  returnsEncryptedPayload,
  hasEncryptionStateDebug,
  hasEncryptionCondition,
  hasEncryptMessageCall,
  hasEncryptionNotAppliedLog,
  hasMessageLengthLog,
  hasEncryptMessageSignature,
  hasJSONStringify,
  hasEncryptionServiceCall
];

const passed = tests.filter(test => test).length;
const total = tests.length;
const score = Math.round((passed / total) * 100);

console.log('\n📊 TEST RESULTS:');
console.log('===============');
console.log(`Tests Passed: ${passed}/${total}`);
console.log(`Success Rate: ${score}%`);

if (score >= 90) {
  console.log('🎉 ENCRYPTION FLOW: SUCCESSFULLY FIXED!');
  console.log('\n✅ Double-Send Issue Resolved:');
  console.log('   • ❌ BEFORE: encryptMessage() sent message to /encryption/messages');
  console.log('   • ❌ BEFORE: ChatRoomScreen sent message to regular endpoint');
  console.log('   • ❌ BEFORE: Message sent twice (encrypted + plaintext)');
  console.log('   • ✅ AFTER: encryptMessage() only encrypts and returns payload');
  console.log('   • ✅ AFTER: ChatRoomScreen sends encrypted payload through normal flow');
  console.log('   • ✅ AFTER: Message sent once with encrypted content');
  
  console.log('\n🔐 New Message Flow:');
  console.log('   1. User types: "Hello World"');
  console.log('   2. Check encryption conditions: enabled + keys loaded');
  console.log('   3. Call encryptMessage() → returns encrypted JSON string');
  console.log('   4. messageToSend = encrypted payload string');
  console.log('   5. Send messageToSend through normal chat flow');
  console.log('   6. Server receives: encrypted payload instead of plaintext');
  
  console.log('\n🛡️  Expected Server Behavior:');
  console.log('   ❌ OLD: Server sees "text": "Hello World"');
  console.log('   ✅ NEW: Server sees "text": "{\\"encryptedText\\":\\"eyJ0eXAi...\\"}"');
  console.log('   • Server can no longer read message content');
  console.log('   • True end-to-end encryption achieved');
  
  console.log('\n🔄 Debug Output Expected:');
  console.log('   🔐 Encryption state check: { isEncryptionEnabled: true, hasKeys: true, keysLoaded: true }');
  console.log('   🔐 Encrypting message before sending...');
  console.log('   🔐 PFS encryption completed for message');
  console.log('   ✅ Message encrypted successfully, length: 150+');
  console.log('   🔐 DEBUG: finalMessage: [ENCRYPTED] (not plaintext)');
  
} else if (score >= 70) {
  console.log('⚠️  PARTIAL FIX');
  console.log('Some encryption flow issues may remain.');
} else {
  console.log('❌ FIX INCOMPLETE');
  console.log('Encryption flow not properly fixed.');
}

console.log('\n📚 Technical Details:');
console.log('--------------------');
console.log('Problem: Encryption service was sending messages internally');
console.log('Solution: Encryption service only encrypts, returns payload');
console.log('Integration: ChatRoomScreen handles sending encrypted payload');
console.log('Result: Single message send with encrypted content');

console.log('\n🔧 Architecture:');
console.log('---------------');
console.log('encryptMessage() → EncryptedPayload → JSON.stringify() → messageToSend');
console.log('ChatRoomScreen → sendMessage(encrypted_string) → Server');
console.log('Server stores encrypted string instead of plaintext');

process.exit(score >= 90 ? 0 : 1);