import { registerRootComponent } from 'expo'
import * as Crypto from 'expo-crypto'

// Set up crypto polyfill for Expo Go compatibility
import 'react-native-get-random-values'

// Polyfill crypto for Expo Go
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    getRandomValues: (array: Uint8Array | Int8Array | Uint16Array | Int16Array | Uint32Array | Int32Array) => {
      // Validate array length parameter
      const length = Math.floor(Math.abs(array.length))
      if (!Number.isInteger(length) || length < 0) {
        throw new Error('getRandomValues: array length must be an unsigned integer')
      }
      
      if (length === 0) {
        return array
      }
      
      try {
        // Use expo-crypto for secure random generation
        const randomBytes = Crypto.getRandomBytes(length)
        const uint8Array = new Uint8Array(randomBytes)
        array.set(uint8Array)
        return array
      } catch (error) {
        console.error('Failed to generate random values with Expo Crypto:', error)
        // Fallback to Math.random for development
        console.warn('Using Math.random fallback - NOT SECURE for production!')
        for (let i = 0; i < length; i++) {
          (array as any)[i] = Math.floor(Math.random() * 256)
        }
        return array
      }
    },
    randomUUID: () => {
      return Crypto.randomUUID()
    },
    // Simplified WebCrypto subtle implementation for basic operations
    subtle: {
      generateKey: async (algorithm: any, extractable: boolean, keyUsages: string[]) => {
        console.log('🔐 Using simplified crypto.subtle.generateKey for Expo Go')
        // Return mock key for AES-GCM
        let mockKey: Uint8Array
        try {
          const keyBytes = Crypto.getRandomBytes(32)
          mockKey = new Uint8Array(keyBytes)
        } catch (error) {
          console.error('Failed to generate key with Expo Crypto:', error)
          // Fallback to Math.random
          mockKey = new Uint8Array(32)
          for (let i = 0; i < 32; i++) {
            mockKey[i] = Math.floor(Math.random() * 256)
          }
        }
        
        return {
          type: 'secret',
          extractable,
          algorithm: { name: algorithm.name || 'AES-GCM', length: algorithm.length || 256 },
          usages: keyUsages,
          _mockKey: mockKey // Store actual key data
        } as CryptoKey
      },
      importKey: async (format: string, keyData: ArrayBuffer | Uint8Array, algorithm: any, extractable: boolean, keyUsages: string[]) => {
        console.log('🔐 Using simplified crypto.subtle.importKey for Expo Go')
        return {
          type: 'secret',
          extractable,
          algorithm: { name: algorithm.name || algorithm, length: 256 },
          usages: keyUsages,
          _mockKey: keyData instanceof Uint8Array ? keyData : new Uint8Array(keyData)
        } as CryptoKey
      },
      encrypt: async (algorithm: any, key: any, data: ArrayBuffer | Uint8Array) => {
        console.log('🔐 Using simplified crypto.subtle.encrypt for Expo Go')
        // Simple XOR encryption for demo (not secure for production)
        const keyBytes = key._mockKey || new Uint8Array(32)
        const dataBytes = data instanceof Uint8Array ? data : new Uint8Array(data)
        const encrypted = new Uint8Array(dataBytes.length)
        for (let i = 0; i < dataBytes.length; i++) {
          encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length]
        }
        return encrypted.buffer
      },
      decrypt: async (algorithm: any, key: any, data: ArrayBuffer | Uint8Array) => {
        console.log('🔐 Using simplified crypto.subtle.decrypt for Expo Go')
        // Simple XOR decryption for demo (not secure for production)
        const keyBytes = key._mockKey || new Uint8Array(32)
        const dataBytes = data instanceof Uint8Array ? data : new Uint8Array(data)
        const decrypted = new Uint8Array(dataBytes.length)
        for (let i = 0; i < dataBytes.length; i++) {
          decrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length]
        }
        return decrypted.buffer
      }
    }
  } as any
}

import App from './App'

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App)
