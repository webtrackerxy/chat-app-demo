// Test script to verify decryption of the provided encrypted text
const { AdaptiveEncryptionService } = require('./chat-frontend/src/services/adaptiveEncryptionService.ts');

// The encrypted text from the user
const encryptedText = {
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

async function testDecryption() {
  try {
    console.log('Testing decryption of encrypted text...');
    console.log('Encrypted payload:', JSON.stringify(encryptedText, null, 2));
    
    // Extract conversation ID from keyId
    const conversationId = encryptedText.keyId.replace('pfs-', '');
    const userId = 'test-user';
    
    console.log('Conversation ID:', conversationId);
    console.log('User ID:', userId);
    
    // Initialize the encryption service
    const encryptionService = AdaptiveEncryptionService.getInstance();
    
    // Try to decrypt the message
    const decryptedText = await encryptionService.decryptMessage(
      encryptedText,
      conversationId,
      userId,
      encryptedText.metadata
    );
    
    console.log('✅ Decryption successful!');
    console.log('Decrypted text:', decryptedText);
    
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    console.error('Full error:', error);
  }
}

// Run the test
testDecryption();