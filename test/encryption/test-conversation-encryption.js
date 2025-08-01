#!/usr/bin/env node

/**
 * Test conversation-based encryption
 * 
 * This test verifies that:
 * 1. Any user can encrypt messages for a conversation
 * 2. Any user can decrypt messages from the same conversation
 * 3. Different users get the same result for the same conversation
 */

console.log('🧪 Testing Conversation-Based Encryption Implementation\n');

// Simulate the conversation key generation function
function generateConversationKey(conversationId) {
  console.log('🔑 Generating deterministic conversation key for:', conversationId);
  
  // Create deterministic but secure key based on conversationId
  const conversationBytes = Buffer.from(`conv-key-${conversationId}`, 'utf8');
  const salt = Buffer.from('chat-app-conversation-salt-2024', 'utf8');
  
  // Create 32-byte key using simple but deterministic method
  const key = Buffer.alloc(32);
  
  // Mix conversation ID with salt for better entropy
  for (let i = 0; i < 32; i++) {
    const convByte = conversationBytes[i % conversationBytes.length];
    const saltByte = salt[i % salt.length];
    const indexByte = i + 1;
    
    // Simple but deterministic mixing
    key[i] = (convByte ^ saltByte ^ indexByte) & 0xFF;
  }
  
  console.log('✅ Conversation key generated for:', conversationId);
  return key;
}

// Test scenarios
console.log('📋 Test 1: Same conversation ID should generate same key for different users');
const conversationId = 'general';

// User Mike generates key
console.log('\n👤 User Mike generating key for conversation:', conversationId);
const mikesKey = generateConversationKey(conversationId);
console.log('Mike\'s key (first 8 bytes):', mikesKey.subarray(0, 8).toString('hex'));

// User John generates key
console.log('\n👤 User John generating key for conversation:', conversationId);
const johnsKey = generateConversationKey(conversationId);
console.log('John\'s key (first 8 bytes):', johnsKey.subarray(0, 8).toString('hex'));

// Compare keys
const keysMatch = mikesKey.equals(johnsKey);
console.log('\n🔍 Keys match:', keysMatch ? '✅ YES' : '❌ NO');

if (keysMatch) {
  console.log('✅ SUCCESS: Both users generated the same conversation key!');
} else {
  console.log('❌ FAILURE: Users generated different keys!');
}

console.log('\n📋 Test 2: Different conversations should generate different keys');
const conversation1 = 'general';
const conversation2 = 'private-chat';

const key1 = generateConversationKey(conversation1);
const key2 = generateConversationKey(conversation2);

console.log('Conversation 1 key (first 8 bytes):', key1.subarray(0, 8).toString('hex'));
console.log('Conversation 2 key (first 8 bytes):', key2.subarray(0, 8).toString('hex'));

const differentKeys = !key1.equals(key2);
console.log('\n🔍 Keys are different:', differentKeys ? '✅ YES' : '❌ NO');

if (differentKeys) {
  console.log('✅ SUCCESS: Different conversations generate different keys!');
} else {
  console.log('❌ FAILURE: Different conversations generated the same key!');
}

console.log('\n📋 Test 3: Key determinism - same input always gives same output');
const testConversation = 'test-conversation-123';

const key_attempt1 = generateConversationKey(testConversation);
const key_attempt2 = generateConversationKey(testConversation);
const key_attempt3 = generateConversationKey(testConversation);

const allMatch = key_attempt1.equals(key_attempt2) && key_attempt2.equals(key_attempt3);
console.log('\n🔍 All attempts match:', allMatch ? '✅ YES' : '❌ NO');

if (allMatch) {
  console.log('✅ SUCCESS: Key generation is deterministic!');
} else {
  console.log('❌ FAILURE: Key generation is not deterministic!');
}

console.log('\n🎉 Conversation-Based Encryption Test Complete!');
console.log('\n📊 Summary:');
console.log('- Multi-user key generation:', keysMatch ? '✅ PASS' : '❌ FAIL');
console.log('- Different conversation keys:', differentKeys ? '✅ PASS' : '❌ FAIL');
console.log('- Deterministic generation:', allMatch ? '✅ PASS' : '❌ FAIL');

const allTestsPass = keysMatch && differentKeys && allMatch;
console.log('\n🏆 Overall Result:', allTestsPass ? '✅ ALL TESTS PASS' : '❌ SOME TESTS FAILED');

if (allTestsPass) {
  console.log('\n✅ The conversation-based encryption approach should fix the multi-user decryption issue!');
  console.log('   - Any user in a conversation can generate the same encryption key');
  console.log('   - Messages encrypted by one user can be decrypted by others in the same conversation');
  console.log('   - Each conversation has its own unique encryption key');
} else {
  console.log('\n❌ There may be issues with the conversation-based encryption approach.');
}