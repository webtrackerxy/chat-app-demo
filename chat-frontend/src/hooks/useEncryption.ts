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

  // Initialize encryption status
  useEffect(() => {
    const initializeEncryption = async () => {
      const hasKeys = await encryptionService.hasUserKeys()
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

  const encryptMessage = useCallback(
    async (text: string, conversationId: string, userId: string): Promise<string> => {
      try {
        const encryptedPayload = await encryptionService.encryptMessage(
          text,
          conversationId,
          userId,
        )
        return JSON.stringify(encryptedPayload)
      } catch (error) {
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
        return await encryptionService.decryptMessage(encryptedPayload, conversationId, userId)
      } catch (error) {
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
    encryptMessage,
    decryptMessage,
    enableEncryption,
    isEncryptionEnabled,
    clearKeys,
    removeKeys,
    clearError,
  }
}
