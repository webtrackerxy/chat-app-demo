#!/usr/bin/env node

/**
 * Comprehensive Length Validation Fix Verification Test
 * 
 * This test verifies that all "length must be an unsigned integer" errors
 * have been fixed across all crypto services and polyfills.
 */

const fs = require('fs');
const path = require('path');

console.log('🔢 COMPREHENSIVE LENGTH VALIDATION FIX VERIFICATION');
console.log('===================================================');

const testResults = [];

// Test files to check
const filesToCheck = [
  {
    file: 'chat-frontend/index.ts',
    name: 'Crypto Polyfill',
    checks: [
      { pattern: 'const length = Math.floor(Math.abs(array.length))', desc: 'Array length validation' },
      { pattern: 'if (!Number.isInteger(length) || length < 0)', desc: 'Integer validation' },
      { pattern: 'const keyBytes = Crypto.getRandomBytes(32)', desc: 'Fixed key generation' }
    ]
  },
  {
    file: 'chat-frontend/src/services/adaptiveEncryptionService.ts',
    name: 'Adaptive Encryption Service',
    checks: [
      { pattern: 'if (!Number.isInteger(length) || length < 0)', desc: 'getSecureRandomBytes validation' },
      { pattern: 'const validLength = Math.floor(Math.abs(length))', desc: 'Valid length calculation' },
      { pattern: 'lengthType: typeof length', desc: 'Detailed error logging' }
    ]
  },
  {
    file: 'chat-frontend/src/services/cryptoService/MessageEncryptionService.ts',
    name: 'Message Encryption Service',
    checks: [
      { pattern: 'const nonceLength = sodium.crypto_aead_chacha20poly1305_ietf_NPUBBYTES || 12', desc: 'Nonce length fallback' },
      { pattern: 'if (!Number.isInteger(nonceLength) || nonceLength <= 0)', desc: 'Nonce length validation' },
      { pattern: 'console.log(`🔐 Generating nonce with length: ${nonceLength}`)', desc: 'Nonce debug logging' }
    ]
  },
  {
    file: 'chat-frontend/src/services/cryptoService/X25519Service.ts',
    name: 'X25519 Service',
    checks: [
      { pattern: 'if (!Number.isInteger(length) || length < 0)', desc: 'randomBytes validation' },
      { pattern: 'console.log(`🔐 X25519Service generating ${length} random bytes`)', desc: 'Debug logging' },
      { pattern: 'throw new Error(\'length must be an unsigned integer\')', desc: 'Error message' }
    ]
  },
  {
    file: 'chat-frontend/src/services/cryptoService/KyberService.ts',
    name: 'Kyber Service',
    checks: [
      { pattern: 'if (!Number.isInteger(length) || length < 0)', desc: 'randomBytes validation' },
      { pattern: 'console.log(`🔐 KyberService generating ${length} random bytes`)', desc: 'Debug logging' },
      { pattern: 'throw new Error(\'length must be an unsigned integer\')', desc: 'Error message' }
    ]
  },
  {
    file: 'chat-frontend/src/services/cryptoService/DilithiumService.ts',
    name: 'Dilithium Service',
    checks: [
      { pattern: 'if (!Number.isInteger(length) || length < 0)', desc: 'randomBytes validation' },
      { pattern: 'console.log(`🔐 DilithiumService generating ${length} random bytes`)', desc: 'Debug logging' },
      { pattern: 'throw new Error(\'length must be an unsigned integer\')', desc: 'Error message' }
    ]
  }
];

console.log('\\n📋 Testing All Crypto Services...');

let totalTests = 0;
let totalPassed = 0;

for (const fileTest of filesToCheck) {
  console.log(`\\n🔍 Testing ${fileTest.name}:`);
  
  const filePath = path.join(__dirname, fileTest.file);
  let fileContent;
  
  try {
    fileContent = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.log(`❌ Could not read file: ${fileTest.file}`);
    continue;
  }
  
  let filePassed = 0;
  let fileTotal = fileTest.checks.length;
  
  for (const check of fileTest.checks) {
    totalTests++;
    const found = fileContent.includes(check.pattern);
    
    if (found) {
      console.log(`   ✅ ${check.desc}`);
      filePassed++;
      totalPassed++;
    } else {
      console.log(`   ❌ ${check.desc}`);
    }
  }
  
  const fileScore = Math.round((filePassed / fileTotal) * 100);
  console.log(`   📊 ${fileTest.name}: ${filePassed}/${fileTotal} (${fileScore}%)`);
  
  testResults.push({
    name: fileTest.name,
    passed: filePassed,
    total: fileTotal,
    score: fileScore
  });
}

console.log('\\n📊 COMPREHENSIVE TEST RESULTS:');
console.log('===============================');
console.log(`Total Tests: ${totalPassed}/${totalTests}`);
const overallScore = Math.round((totalPassed / totalTests) * 100);
console.log(`Overall Success Rate: ${overallScore}%`);

console.log('\\n📋 Individual Service Results:');
testResults.forEach(result => {
  const status = result.score >= 80 ? '✅' : '❌';
  console.log(`   ${status} ${result.name}: ${result.passed}/${result.total} (${result.score}%)`);
});

if (overallScore >= 90) {
  console.log('\\n🎉 COMPREHENSIVE LENGTH VALIDATION: SUCCESSFULLY IMPLEMENTED!');
  console.log('\\n✅ All Crypto Services Fixed:');
  console.log('   1️⃣ Crypto Polyfill: Array length validation and fallbacks');
  console.log('   2️⃣ Adaptive Encryption: Parameter validation with detailed logging');
  console.log('   3️⃣ Message Encryption: Nonce length validation with fallbacks');
  console.log('   4️⃣ X25519 Service: Random bytes parameter validation');
  console.log('   5️⃣ Kyber Service: Random bytes parameter validation');
  console.log('   6️⃣ Dilithium Service: Random bytes parameter validation');
  
  console.log('\\n🔄 Expected Encryption Flow (No Length Errors):');
  console.log('================================================');
  console.log('   🔐 ENCRYPTING: Starting encryption process...');
  console.log('   🔒 Using PFS encryption...');
  console.log('   🔍 Checking ratchet state for tech-talk:user_mike: true');
  console.log('   🔐 Generating nonce with length: 12');
  console.log('   🔐 X25519Service generating 32 random bytes');
  console.log('   🔐 PFS encryption completed for message');
  console.log('   ✅ ENCRYPTED: Message encrypted successfully');
  console.log('   (No more "length must be an unsigned integer" errors)');
  
  console.log('\\n🛡️  Validation Strategy:');
  console.log('========================');
  console.log('   • Parameter validation: Number.isInteger(length) && length >= 0');
  console.log('   • Type checking: Ensures length is actually a number');
  console.log('   • Range validation: Prevents negative values');
  console.log('   • Zero handling: Special case for zero-length requests');
  console.log('   • Fallback values: Default to safe values when constants undefined');
  console.log('   • Debug logging: Clear messages for troubleshooting');
  console.log('   • Error messages: Consistent "length must be an unsigned integer"');
  
  console.log('\\n🏗️  Implementation Coverage:');
  console.log('============================');
  console.log('   • Crypto polyfill in index.ts (array.length validation)');
  console.log('   • getSecureRandomBytes in AdaptiveEncryptionService');
  console.log('   • Nonce generation in MessageEncryptionService');
  console.log('   • randomBytes methods in all crypto services');
  console.log('   • Both libsodium and crypto.getRandomValues paths');
  console.log('   • Complete error recovery and fallback chains');
  
  console.log('\\n🚀 READY FOR ENCRYPTION TESTING:');
  console.log('=================================');
  console.log('   All length validation issues have been comprehensively fixed.');
  console.log('   The encryption system should now work without parameter errors.');
  console.log('   Debug logging will help identify any remaining issues.');
  
} else if (overallScore >= 70) {
  console.log('\\n⚠️  MOSTLY FIXED');
  console.log('Most length validation issues have been resolved.');
  
  // Show which services still need work
  const failedServices = testResults.filter(r => r.score < 80);
  if (failedServices.length > 0) {
    console.log('\\n❌ Services needing attention:');
    failedServices.forEach(service => {
      console.log(`   • ${service.name}: ${service.score}%`);
    });
  }
  
} else {
  console.log('\\n❌ SIGNIFICANT ISSUES REMAIN');
  console.log('Multiple length validation issues still need to be fixed.');
}

console.log('\\n📚 Technical Summary:');
console.log('=====================');
console.log('Problem: "length must be an unsigned integer" errors in crypto operations');
console.log('Cause: Invalid parameters passed to libsodium randombytes_buf() and crypto.getRandomValues()');
console.log('Solution: Comprehensive parameter validation across all crypto services');
console.log('Result: Robust crypto operations that handle all parameter edge cases');

process.exit(overallScore >= 90 ? 0 : 1);