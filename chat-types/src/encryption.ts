// Use the global crypto API (available in React Native and browsers)
const crypto = globalThis.crypto;

/**
 * Encryption configuration
 */
export const ENCRYPTION_CONFIG = {
  algorithm: 'AES-GCM',
  keyLength: 256,
  ivLength: 12, // 96 bits for GCM
  tagLength: 128, // 128 bits for GCM tag
} as const;

/**
 * Encrypted message payload structure
 */
export interface EncryptedPayload {
  encryptedText: string; // Base64 encoded encrypted text
  iv: string; // Base64 encoded initialization vector
  tag: string; // Base64 encoded authentication tag
  keyId: string; // Identifier for the key used
}

/**
 * Key pair for asymmetric encryption (user keys)
 */
export interface KeyPair {
  publicKey: string; // Base64 encoded public key
  privateKey: string; // Base64 encoded private key
}

/**
 * Conversation encryption key (symmetric key for group messages)
 */
export interface ConversationKey {
  keyId: string;
  key: string; // Base64 encoded AES key
  conversationId: string;
  createdAt: Date;
  createdBy: string;
}

/**
 * Generate a new AES-256-GCM key for conversation encryption
 */
export async function generateConversationKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    {
      name: ENCRYPTION_CONFIG.algorithm,
      length: ENCRYPTION_CONFIG.keyLength,
    },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to base64 string
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  return arrayBufferToBase64(exported);
}

/**
 * Import a base64 key string to CryptoKey
 */
export async function importKey(keyData: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(keyData);
  return await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    {
      name: ENCRYPTION_CONFIG.algorithm,
      length: ENCRYPTION_CONFIG.keyLength,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a cryptographically secure random IV
 */
export function generateIV(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(ENCRYPTION_CONFIG.ivLength));
}

/**
 * Generate a unique key ID
 */
export function generateKeyId(): string {
  return crypto.randomUUID();
}

/**
 * Encrypt text using AES-256-GCM
 */
export async function encryptText(text: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = generateIV();
  const encodedText = new TextEncoder().encode(text);
  
  const encrypted = await crypto.subtle.encrypt(
    {
      name: ENCRYPTION_CONFIG.algorithm,
      iv: iv,
    },
    key,
    encodedText
  );
  
  // Split the result into encrypted data and authentication tag
  const encryptedArray = new Uint8Array(encrypted);
  const tagLength = ENCRYPTION_CONFIG.tagLength / 8; // Convert bits to bytes
  const encryptedData = encryptedArray.slice(0, -tagLength);
  const tag = encryptedArray.slice(-tagLength);
  
  // Convert Uint8Array to ArrayBuffer properly
  const encryptedDataBuffer = encryptedData.buffer.slice(encryptedData.byteOffset, encryptedData.byteOffset + encryptedData.byteLength) as ArrayBuffer;
  const ivBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const tagBuffer = tag.buffer.slice(tag.byteOffset, tag.byteOffset + tag.byteLength) as ArrayBuffer;
  
  return {
    encryptedText: arrayBufferToBase64(encryptedDataBuffer),
    iv: arrayBufferToBase64(ivBuffer),
    tag: arrayBufferToBase64(tagBuffer),
    keyId: generateKeyId(), // This should be provided by the caller in a real implementation
  };
}

/**
 * Decrypt text using AES-256-GCM
 */
export async function decryptText(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const encryptedData = base64ToArrayBuffer(payload.encryptedText);
  const iv = base64ToArrayBuffer(payload.iv);
  const tag = base64ToArrayBuffer(payload.tag);
  
  // Combine encrypted data and tag for GCM
  const combined = new Uint8Array(encryptedData.byteLength + tag.byteLength);
  combined.set(new Uint8Array(encryptedData));
  combined.set(new Uint8Array(tag), encryptedData.byteLength);
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: ENCRYPTION_CONFIG.algorithm,
      iv: iv,
    },
    key,
    combined
  );
  
  return new TextDecoder().decode(decrypted);
}

/**
 * Generate RSA key pair for user encryption (for key exchange)
 */
export async function generateUserKeyPair(): Promise<CryptoKeyPair> {
  return await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export RSA key pair to base64 strings
 */
export async function exportKeyPair(keyPair: CryptoKeyPair): Promise<KeyPair> {
  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  
  return {
    publicKey: arrayBufferToBase64(publicKey),
    privateKey: arrayBufferToBase64(privateKey),
  };
}

/**
 * Import RSA public key from base64 string
 */
export async function importPublicKey(publicKeyData: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(publicKeyData);
  return await crypto.subtle.importKey(
    'spki',
    keyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt']
  );
}

/**
 * Import RSA private key from base64 string
 */
export async function importPrivateKey(privateKeyData: string): Promise<CryptoKey> {
  const keyBuffer = base64ToArrayBuffer(privateKeyData);
  return await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt']
  );
}

/**
 * Encrypt a conversation key with a user's public key
 */
export async function encryptConversationKey(
  conversationKey: CryptoKey,
  userPublicKey: CryptoKey
): Promise<string> {
  const keyData = await crypto.subtle.exportKey('raw', conversationKey);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP',
    },
    userPublicKey,
    keyData
  );
  
  return arrayBufferToBase64(encrypted);
}

/**
 * Decrypt a conversation key with a user's private key
 */
export async function decryptConversationKey(
  encryptedKey: string,
  userPrivateKey: CryptoKey
): Promise<CryptoKey> {
  const encryptedData = base64ToArrayBuffer(encryptedKey);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP',
    },
    userPrivateKey,
    encryptedData
  );
  
  return await crypto.subtle.importKey(
    'raw',
    decrypted,
    {
      name: ENCRYPTION_CONFIG.algorithm,
      length: ENCRYPTION_CONFIG.keyLength,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Utility function to convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Utility function to convert base64 to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Validate if a string is a valid base64 encoded key
 */
export function isValidBase64Key(key: string): boolean {
  try {
    return btoa(atob(key)) === key;
  } catch {
    return false;
  }
}

/**
 * Generate a secure random password for key derivation
 */
export function generateSecurePassword(length: number = 32): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  const randomValues = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(randomValues)
    .map(value => charset[value % charset.length])
    .join('');
}