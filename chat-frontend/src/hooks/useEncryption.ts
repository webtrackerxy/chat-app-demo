import { useState, useEffect, useCallback } from 'react'
import { encryptionService } from '@services/encryptionService'
import { EncryptedPayload } from '@chat-types'

export interface EncryptionState {
  hasKeys: boolean
  keysLoaded: boolean
  isGeneratingKeys: boolean
  isLoadingKeys: boolean
  error: string | null
}

export interface EncryptionActions {
  generateKeys: (userId: string, password: string) => Promise<boolean>
  loadKeys: (password: string) => Promise<boolean>
  autoInitializeEncryption: (userId: string) => Promise<boolean>
  encryptMessage: (text: string, conversationId: string, userId: string) => Promise<string>
  decryptMessage: (encryptedText: string, conversationId: string, userId: string) => Promise<string>
  enableEncryption: (conversationId: string) => Promise<void>
  isEncryptionEnabled: (conversationId: string, userId: string) => Promise<boolean>
  clearKeys: () => void
  removeKeys: () => Promise<void>
  clearError: () => void
}

export function useEncryption(): EncryptionState & EncryptionActions {
  const [state, setState] = useState<EncryptionState>({
    hasKeys: false,
    keysLoaded: false,
    isGeneratingKeys: false,
    isLoadingKeys: false,
    error: null,
  })

  // Initialize encryption status and auto-generate keys if needed
  useEffect(() => {
    let keyValidationAttempts = 0
    const MAX_VALIDATION_ATTEMPTS = 3
    
    const initializeEncryption = async () => {
      let hasKeys = await encryptionService.hasUserKeys()
      
      if (hasKeys) {
        // Keys exist, check if they are valid and can be loaded
        keyValidationAttempts++
        if (keyValidationAttempts > MAX_VALIDATION_ATTEMPTS) {
          console.error('❌ Maximum key validation attempts reached, forcing key removal')
          await encryptionService.removeKeys()
          hasKeys = false
        } else {
          const keysValid = await encryptionService.areStoredKeysValid()
          
          if (keysValid) {
            console.log('✅ Encryption keys loaded automatically')
            const status = encryptionService.getEncryptionStatus()
            setState((prev) => ({
              ...prev,
              hasKeys: true,
              keysLoaded: status.keysLoaded,
            }))
            return // Successfully loaded, exit early
          } else {
            // Keys exist but are invalid/corrupted, clear them
            console.log(`🔄 Clearing invalid/corrupted keys and regenerating... (attempt ${keyValidationAttempts}/${MAX_VALIDATION_ATTEMPTS})`)
            await encryptionService.removeKeys()
            hasKeys = false // Update hasKeys to trigger regeneration
          }
        }
      }
      
      // If no keys or failed to load, the UI will trigger auto-initialization when needed
      const status = encryptionService.getEncryptionStatus()
      setState((prev) => ({
        ...prev,
        hasKeys,
        keysLoaded: status.keysLoaded,
      }))
    }

    initializeEncryption()
  }, [])

  const generateKeys = useCallback(async (userId: string, password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isGeneratingKeys: true, error: null }))

    try {
      await encryptionService.generateUserKeys(userId, password)
      const status = encryptionService.getEncryptionStatus()

      setState((prev) => ({
        ...prev,
        hasKeys: true,
        keysLoaded: status.keysLoaded,
        isGeneratingKeys: false,
      }))

      return true
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to generate keys',
        isGeneratingKeys: false,
      }))
      return false
    }
  }, [])

  const loadKeys = useCallback(async (password: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoadingKeys: true, error: null }))

    try {
      const success = await encryptionService.loadUserKeys(password)
      const status = encryptionService.getEncryptionStatus()

      setState((prev) => ({
        ...prev,
        hasKeys: success,
        keysLoaded: status.keysLoaded,
        isLoadingKeys: false,
        error: success ? null : 'Failed to load keys',
      }))

      return success
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load keys',
        isLoadingKeys: false,
      }))
      return false
    }
  }, [])

  const autoInitializeEncryption = useCallback(async (userId: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, isGeneratingKeys: true, error: null }))

    try {
      // Generate a secure random password automatically
      const randomPassword = encryptionService.generateSecurePassword()
      
      // Generate keys with the random password
      await encryptionService.generateUserKeys(userId, randomPassword)
      const status = encryptionService.getEncryptionStatus()

      setState((prev) => ({
        ...prev,
        hasKeys: true,
        keysLoaded: status.keysLoaded,
        isGeneratingKeys: false,
      }))

      console.log('✅ Encryption auto-initialized with PFS (Perfect Forward Secrecy)')
      return true
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to auto-initialize encryption',
        isGeneratingKeys: false,
      }))
      console.error('❌ Failed to auto-initialize encryption:', error)
      return false
    }
  }, [])

  const encryptMessage = useCallback(

    async (text: string, conversationId: string, userId: string): Promise<string> => {
      
      console.log('🔧 useEncryption.encryptMessage--:', {text, conversationId, userId})
        
      try {

        console.log('🔧 useEncryption.encryptMessage called with:', {
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
          conversationId,
          userId,
          textLength: text.length
        })
        
        console.log('🔧 Calling encryptionService.encryptMessage...')
        const encryptedPayload = await encryptionService.encryptMessage(
          text,
          conversationId,
          userId,
        )
        
        console.log('🔧 Encryption service returned payload:', {
          encryptedTextLength: encryptedPayload.encryptedText?.length || 0,
          hasIv: !!encryptedPayload.iv,
          hasTag: !!encryptedPayload.tag,
          keyId: encryptedPayload.keyId
        })
        
        const jsonString = JSON.stringify(encryptedPayload)
        console.log('🔧 Final JSON string length:', jsonString.length)
        console.log('🔧 Final JSON preview:', jsonString.substring(0, 100) + '...')
        
        console.log("🔧 useEncryption.encryptMessage completed successfully", jsonString)
        return jsonString
      } catch (error) {
        console.error('🔧 useEncryption.encryptMessage ERROR:', error)
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to encrypt message',
        }))
        throw error
      }
    },
    [],
  )

  const decryptMessage = useCallback(
    async (encryptedText: string, conversationId: string, userId: string): Promise<string> => {
      try {
        const encryptedPayload: EncryptedPayload = JSON.parse(encryptedText)
        
        console.log('🔓 useEncryption.decryptMessage: Attempting decryption with payload:', {
          keyId: encryptedPayload.keyId,
          hasEncryptedText: !!encryptedPayload.encryptedText,
          hasIv: !!encryptedPayload.iv,
          hasTag: !!encryptedPayload.tag,
          hasMetadata: !!encryptedPayload.metadata
        })
        
        // Use metadata from the payload if available, otherwise use defaults
        const metadata = {
          mode: 'PFS', // Default to PFS mode
          ephemeralPublicKey: '',
          messageNumber: 0,
          chainLength: 0,
          previousChainLength: 0,
          timestamp: Date.now(), // Add timestamp default
          ...encryptedPayload.metadata // Override with actual metadata if present
        }
        
        console.log('🔓 Using metadata for decryption:', {
          mode: metadata.mode,
          hasEphemeralKey: !!metadata.ephemeralPublicKey,
          messageNumber: metadata.messageNumber,
          chainLength: metadata.chainLength,
          timestamp: metadata.timestamp,
          timestampType: typeof metadata.timestamp
        })
        
        return await encryptionService.decryptMessage(encryptedPayload, conversationId, userId, metadata)
      } catch (error) {
        console.error('🔓 useEncryption.decryptMessage failed:', error)
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to decrypt message',
        }))
        throw error
      }
    },
    [],
  )

  const enableEncryption = useCallback(async (conversationId: string): Promise<void> => {
    try {
      await encryptionService.enableEncryption(conversationId)
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to enable encryption',
      }))
      throw error
    }
  }, [])

  const isEncryptionEnabled = useCallback(
    async (conversationId: string, userId: string): Promise<boolean> => {
      try {
        return await encryptionService.isEncryptionEnabled(conversationId, userId)
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to check encryption status',
        }))
        return false
      }
    },
    [],
  )

  const clearKeys = useCallback(() => {
    encryptionService.clearKeys()
    setState((prev) => ({
      ...prev,
      hasKeys: false,
      keysLoaded: false,
      error: null,
    }))
  }, [])

  const removeKeys = useCallback(async () => {
    try {
      await encryptionService.removeKeys()
      setState((prev) => ({
        ...prev,
        hasKeys: false,
        keysLoaded: false,
        error: null,
      }))
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to remove keys',
      }))
      throw error
    }
  }, [])

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }))
  }, [])

  return {
    ...state,
    generateKeys,
    loadKeys,
    autoInitializeEncryption,
    encryptMessage,
    decryptMessage,
    enableEncryption,
    isEncryptionEnabled,
    clearKeys,
    removeKeys,
    clearError,
  }
}
