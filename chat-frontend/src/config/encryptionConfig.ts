/**
 * Encryption Configuration
 * 
 * Allows selection between different encryption modes:
 * - PFS: Perfect Forward Secrecy (Double Ratchet)
 * - PQC: Post-Quantum Cryptography (Kyber + Dilithium)
 * - MULTI_DEVICE: Multi-Device Key Synchronization
 */

export enum EncryptionMode {
  PFS = 'PFS',                    // Perfect Forward Secrecy
  PQC = 'PQC',                    // Post-Quantum Cryptography
  MULTI_DEVICE = 'MULTI_DEVICE'   // Multi-Device Key Sync
}

export interface EncryptionConfig {
  mode: EncryptionMode
  displayName: string
  description: string
  securityLevel: number
  quantumResistant: boolean
  forwardSecrecy: boolean
  multiDeviceSupport: boolean
  algorithms: {
    keyExchange: string
    encryption: string
    signature?: string
  }
}

export const ENCRYPTION_CONFIGS: Record<EncryptionMode, EncryptionConfig> = {
  [EncryptionMode.PFS]: {
    mode: EncryptionMode.PFS,
    displayName: 'Perfect Forward Secrecy',
    description: 'Double Ratchet Algorithm (Signal Protocol)',
    securityLevel: 3,
    quantumResistant: false,
    forwardSecrecy: true,
    multiDeviceSupport: false,
    algorithms: {
      keyExchange: 'x25519',
      encryption: 'chacha20-poly1305'
    }
  },
  [EncryptionMode.PQC]: {
    mode: EncryptionMode.PQC,
    displayName: 'Post-Quantum Cryptography',
    description: 'Quantum-resistant algorithms (Kyber + Dilithium)',
    securityLevel: 5,
    quantumResistant: true,
    forwardSecrecy: false,
    multiDeviceSupport: false,
    algorithms: {
      keyExchange: 'kyber768',
      encryption: 'aes256-gcm',
      signature: 'dilithium3'
    }
  },
  [EncryptionMode.MULTI_DEVICE]: {
    mode: EncryptionMode.MULTI_DEVICE,
    displayName: 'Multi-Device Sync',
    description: 'Secure key synchronization across devices',
    securityLevel: 4,
    quantumResistant: false,
    forwardSecrecy: true,
    multiDeviceSupport: true,
    algorithms: {
      keyExchange: 'x25519-hybrid',
      encryption: 'chacha20-poly1305'
    }
  }
}

/**
 * Get encryption mode from environment or default to PFS
 */
export function getEncryptionMode(): EncryptionMode {
  // In React Native, environment variables from .env are not directly accessible
  // We'll default to PFS and rely on AsyncStorage for runtime mode selection
  return EncryptionMode.PFS
}

/**
 * Get current encryption configuration
 */
export function getCurrentEncryptionConfig(): EncryptionConfig {
  const mode = getEncryptionMode()
  return ENCRYPTION_CONFIGS[mode]
}

/**
 * Set encryption mode (stores in AsyncStorage for React Native)
 */
export async function setEncryptionMode(mode: EncryptionMode): Promise<void> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default
    await AsyncStorage.setItem('ENCRYPTION_MODE', mode)
    console.log(`Encryption mode set to: ${mode}`)
  } catch (error) {
    console.error('Failed to set encryption mode:', error)
  }
}

/**
 * Get stored encryption mode from AsyncStorage
 */
export async function getStoredEncryptionMode(): Promise<EncryptionMode> {
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default
    const storedMode = await AsyncStorage.getItem('ENCRYPTION_MODE')
    
    if (storedMode && Object.values(EncryptionMode).includes(storedMode as EncryptionMode)) {
      return storedMode as EncryptionMode
    }
  } catch (error) {
    console.error('Failed to get stored encryption mode:', error)
  }
  
  return EncryptionMode.PFS // Default fallback
}