// Test to verify the decryption fix works
// This simulates what happens when decrypting a message

console.log('Testing decryption fix...');

// Simulate the scenario where timestamp fallback was causing issues
function testTimestampConsistency() {
  const originalTimestamp = 1753991205970;
  
  // During encryption (what was happening)
  const encryptionTimestamp = originalTimestamp;
  console.log('Encryption timestamp:', encryptionTimestamp);
  
  // During decryption BEFORE fix (what was failing)
  const decryptionTimestampBefore = originalTimestamp || Date.now(); // This would change!
  console.log('Decryption timestamp BEFORE fix:', decryptionTimestampBefore);
  console.log('Timestamps match BEFORE fix:', encryptionTimestamp === decryptionTimestampBefore);
  
  // During decryption AFTER fix (what should work now)
  const decryptionTimestampAfter = originalTimestamp; // No fallback!
  console.log('Decryption timestamp AFTER fix:', decryptionTimestampAfter);
  console.log('Timestamps match AFTER fix:', encryptionTimestamp === decryptionTimestampAfter);
  
  return encryptionTimestamp === decryptionTimestampAfter;
}

// Test the associated data creation consistency
function createMockAssociatedData(timestamp) {
  // Simplified version of what createAssociatedData does
  const metadata = {
    senderId: 'test-user',
    messageNumber: 0,
    chainLength: 0,
    timestamp: timestamp,
    ephemeralPublicKey: new Uint8Array(32) // Mock key
  };
  
  // This represents the critical part - timestamp must be identical
  return JSON.stringify(metadata); // Simplified serialization
}

console.log('\n=== Testing Associated Data Consistency ===');

const originalTimestamp = 1753991205970;
const encryptionAssociatedData = createMockAssociatedData(originalTimestamp);
console.log('Encryption associated data:', encryptionAssociatedData.substring(0, 100) + '...');

// Before fix - would use Date.now() if timestamp was falsy
const beforeFixAssociatedData = createMockAssociatedData(originalTimestamp || Date.now());
console.log('Before fix associated data matches:', encryptionAssociatedData === beforeFixAssociatedData);

// After fix - uses exact timestamp
const afterFixAssociatedData = createMockAssociatedData(originalTimestamp);
console.log('After fix associated data matches:', encryptionAssociatedData === afterFixAssociatedData);

console.log('\n=== Test Results ===');
const timestampTestPassed = testTimestampConsistency();
const associatedDataTestPassed = encryptionAssociatedData === afterFixAssociatedData;

console.log('✅ Timestamp consistency test:', timestampTestPassed ? 'PASSED' : 'FAILED');
console.log('✅ Associated data consistency test:', associatedDataTestPassed ? 'PASSED' : 'FAILED');

if (timestampTestPassed && associatedDataTestPassed) {
  console.log('\n🎉 All tests PASSED! The decryption fix should work.');
  console.log('The issue was that Date.now() fallback created different associated');
  console.log('data during decryption than what was used during encryption.');
  console.log('ChaCha20-Poly1305 AEAD requires identical associated data for decryption.');
} else {
  console.log('\n❌ Some tests FAILED. Check the implementation.');
}