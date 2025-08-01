/**
 * Secure Storage Service
 * 
 * Provides secure storage for sensitive data like encryption passwords
 * using device Keychain (iOS) and Keystore (Android) through expo-secure-store.
 */

import AsyncStorage from '@react-native-async-storage/async-storage'

// For now, we'll use a fallback until expo-secure-store is added
// This is a temporary implementation that will be replaced with actual secure storage
let SecureStore: any = null

try {
  // Try to import expo-secure-store (will be available after installation)
  SecureStore = require('expo-secure-store')
} catch (error) {
  console.log('expo-secure-store not available, using AsyncStorage fallback')
  SecureStore = null
}

export interface SecureStorageOptions {
  requireAuthentication?: boolean // Require biometric/passcode authentication
  authenticationPrompt?: string   // Custom prompt for authentication
  keychainService?: string       // Custom keychain service name (iOS)
}

class SecureStorageService {
  private static instance: SecureStorageService
  private isSecureStoreAvailable: boolean = false

  private constructor() {
    this.isSecureStoreAvailable = SecureStore !== null
    
    if (this.isSecureStoreAvailable) {
      console.log('✅ Using hardware-backed secure storage (Keychain/Keystore)')
    } else {
      console.log('⚠️ Using AsyncStorage fallback - not secure for production')
    }
  }

  static getInstance(): SecureStorageService {
    if (!SecureStorageService.instance) {
      SecureStorageService.instance = new SecureStorageService()
    }
    return SecureStorageService.instance
  }

  /**
   * Store sensitive data securely in device Keychain/Keystore
   */
  async setItem(key: string, value: string, options?: SecureStorageOptions): Promise<void> {
    try {
      if (this.isSecureStoreAvailable) {
        // Use secure hardware-backed storage
        const secureOptions: any = {}
        
        if (options?.requireAuthentication) {
          secureOptions.requireAuthentication = true
          secureOptions.authenticationPrompt = options.authenticationPrompt || 
            'Authenticate to access your encryption keys'
        }
        
        if (options?.keychainService) {
          secureOptions.keychainService = options.keychainService
        }

        await SecureStore.setItemAsync(key, value, secureOptions)
        console.log(`🔐 Stored '${key}' securely in device Keychain/Keystore`)
      } else {
        // Fallback to AsyncStorage with warning
        await AsyncStorage.setItem(`secure_${key}`, value)
        console.log(`⚠️ Stored '${key}' in AsyncStorage (fallback - not secure)`)
      }
    } catch (error) {
      console.error(`Failed to store secure item '${key}':`, error)
      throw new Error(`Secure storage failed: ${error.message}`)
    }
  }

  /**
   * Retrieve sensitive data from device Keychain/Keystore
   */
  async getItem(key: string, options?: SecureStorageOptions): Promise<string | null> {
    try {
      if (this.isSecureStoreAvailable) {
        // Use secure hardware-backed storage
        const secureOptions: any = {}
        
        if (options?.requireAuthentication) {
          secureOptions.requireAuthentication = true
          secureOptions.authenticationPrompt = options.authenticationPrompt || 
            'Authenticate to access your encryption keys'
        }

        const value = await SecureStore.getItemAsync(key, secureOptions)
        if (value) {
          console.log(`🔐 Retrieved '${key}' securely from device Keychain/Keystore`)
        }
        return value
      } else {
        // Fallback to AsyncStorage
        const value = await AsyncStorage.getItem(`secure_${key}`)
        if (value) {
          console.log(`⚠️ Retrieved '${key}' from AsyncStorage (fallback - not secure)`)
        }
        return value
      }
    } catch (error) {
      console.error(`Failed to retrieve secure item '${key}':`, error)
      return null
    }
  }

  /**
   * Remove sensitive data from device Keychain/Keystore
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (this.isSecureStoreAvailable) {
        await SecureStore.deleteItemAsync(key)
        console.log(`🔐 Removed '${key}' from device Keychain/Keystore`)
      } else {
        await AsyncStorage.removeItem(`secure_${key}`)
        console.log(`⚠️ Removed '${key}' from AsyncStorage (fallback)`)
      }
    } catch (error) {
      console.error(`Failed to remove secure item '${key}':`, error)
      throw new Error(`Secure storage removal failed: ${error.message}`)
    }
  }

  /**
   * Check if a secure item exists
   */
  async hasItem(key: string): Promise<boolean> {
    try {
      const value = await this.getItem(key)
      return value !== null
    } catch (error) {
      return false
    }
  }

  /**
   * Migrate data from AsyncStorage to secure storage
   */
  async migrateFromAsyncStorage(key: string, options?: SecureStorageOptions): Promise<boolean> {
    try {
      // Check if data exists in AsyncStorage
      const asyncValue = await AsyncStorage.getItem(key)
      if (!asyncValue) {
        return false // Nothing to migrate
      }

      // Check if already migrated to secure storage
      const secureValue = await this.getItem(key, options)
      if (secureValue) {
        // Already migrated, clean up AsyncStorage
        await AsyncStorage.removeItem(key)
        console.log(`🔄 Cleaned up migrated data from AsyncStorage: ${key}`)
        return true
      }

      // Migrate to secure storage
      await this.setItem(key, asyncValue, options)
      
      // Remove from AsyncStorage after successful migration
      await AsyncStorage.removeItem(key)
      
      console.log(`✅ Migrated '${key}' from AsyncStorage to secure storage`)
      return true
    } catch (error) {
      console.error(`Failed to migrate '${key}' to secure storage:`, error)
      return false
    }
  }

  /**
   * Get storage info for debugging
   */
  getStorageInfo(): {
    isSecure: boolean
    storageType: string
    recommendation: string
  } {
    return {
      isSecure: this.isSecureStoreAvailable,
      storageType: this.isSecureStoreAvailable ? 'Hardware Keychain/Keystore' : 'AsyncStorage (Fallback)',
      recommendation: this.isSecureStoreAvailable 
        ? 'Using secure hardware-backed storage'
        : 'Install expo-secure-store for production security'
    }
  }

  /**
   * Check if biometric authentication is available
   */
  async isBiometricAvailable(): Promise<boolean> {
    if (!this.isSecureStoreAvailable) {
      return false
    }

    try {
      // This would check if biometric authentication is available on the device
      return true // Placeholder - would use actual biometric detection
    } catch (error) {
      return false
    }
  }
}

// Export singleton instance
export const secureStorage = SecureStorageService.getInstance()

// Export types
export type { SecureStorageOptions }