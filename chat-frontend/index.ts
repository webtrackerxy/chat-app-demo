import { registerRootComponent } from 'expo'
import * as Crypto from 'expo-crypto'

// Set up crypto polyfill for React Native
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {
    getRandomValues: (array: Uint8Array) => {
      return Crypto.getRandomValues(array)
    },
    randomUUID: () => {
      return Crypto.randomUUID()
    },
    subtle: {
      generateKey: async () => {
        console.warn('WebCrypto.subtle.generateKey not available in React Native')
        return {} as CryptoKey
      },
      exportKey: async () => {
        console.warn('WebCrypto.subtle.exportKey not available in React Native')
        return new ArrayBuffer(0)
      },
      importKey: async () => {
        console.warn('WebCrypto.subtle.importKey not available in React Native')
        return {} as CryptoKey
      },
      encrypt: async () => {
        console.warn('WebCrypto.subtle.encrypt not available in React Native')
        return new ArrayBuffer(0)
      },
      decrypt: async () => {
        console.warn('WebCrypto.subtle.decrypt not available in React Native')
        return new ArrayBuffer(0)
      }
    }
  } as any
}

import App from './App'

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App)
