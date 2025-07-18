/**
 * @jest-environment jsdom
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { useEncryption } from '../useEncryption'
import { encryptionService } from '@services/encryptionService'

// Mock the encryption service
jest.mock('@services/encryptionService', () => ({
  encryptionService: {
    hasUserKeys: jest.fn(),
    getEncryptionStatus: jest.fn(),
    generateUserKeys: jest.fn(),
    loadUserKeys: jest.fn(),
    encryptMessage: jest.fn(),
    decryptMessage: jest.fn(),
    enableEncryption: jest.fn(),
    isEncryptionEnabled: jest.fn(),
    clearKeys: jest.fn(),
    removeKeys: jest.fn(),
  },
}))

const mockEncryptionService = encryptionService as jest.Mocked<typeof encryptionService>

describe('useEncryption', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Default mock implementations
    mockEncryptionService.hasUserKeys.mockResolvedValue(false)
    mockEncryptionService.getEncryptionStatus.mockReturnValue({
      hasKeys: false,
      keysLoaded: false,
    })
  })

  describe('Initial State', () => {
    test('should initialize with default state', async () => {
      const { result } = renderHook(() => useEncryption())

      // Wait for initialization
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(result.current.hasKeys).toBe(false)
      expect(result.current.keysLoaded).toBe(false)
      expect(result.current.isGeneratingKeys).toBe(false)
      expect(result.current.isLoadingKeys).toBe(false)
      expect(result.current.error).toBeNull()
    })

    test('should initialize with existing keys', async () => {
      mockEncryptionService.hasUserKeys.mockResolvedValue(true)
      mockEncryptionService.getEncryptionStatus.mockReturnValue({
        hasKeys: true,
        keysLoaded: true,
      })

      const { result } = renderHook(() => useEncryption())

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0))
      })

      expect(result.current.hasKeys).toBe(true)
      expect(result.current.keysLoaded).toBe(true)
    })
  })

  describe('Key Generation', () => {
    test('should generate keys successfully', async () => {
      mockEncryptionService.generateUserKeys.mockResolvedValue(undefined)
      mockEncryptionService.getEncryptionStatus.mockReturnValue({
        hasKeys: true,
        keysLoaded: true,
      })

      const { result } = renderHook(() => useEncryption())

      let generateResult: boolean | undefined

      await act(async () => {
        generateResult = await result.current.generateKeys('user123', 'password123')
      })

      expect(generateResult).toBe(true)
      expect(mockEncryptionService.generateUserKeys).toHaveBeenCalledWith('user123', 'password123')
      expect(result.current.hasKeys).toBe(true)
      expect(result.current.keysLoaded).toBe(true)
      expect(result.current.isGeneratingKeys).toBe(false)
      expect(result.current.error).toBeNull()
    })

    test('should handle key generation failure', async () => {
      const errorMessage = 'Key generation failed'
      mockEncryptionService.generateUserKeys.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useEncryption())

      let generateResult: boolean | undefined

      await act(async () => {
        generateResult = await result.current.generateKeys('user123', 'password123')
      })

      expect(generateResult).toBe(false)
      expect(result.current.error).toBe(errorMessage)
      expect(result.current.isGeneratingKeys).toBe(false)
    })

    test('should set loading state during key generation', async () => {
      let resolveGeneration: () => void
      const generationPromise = new Promise<void>((resolve) => {
        resolveGeneration = resolve
      })

      mockEncryptionService.generateUserKeys.mockReturnValue(generationPromise)

      const { result } = renderHook(() => useEncryption())

      // Start generation
      act(() => {
        result.current.generateKeys('user123', 'password123')
      })

      // Should be loading
      expect(result.current.isGeneratingKeys).toBe(true)

      // Complete generation
      await act(async () => {
        resolveGeneration!()
        await generationPromise
      })

      expect(result.current.isGeneratingKeys).toBe(false)
    })
  })

  describe('Key Loading', () => {
    test('should load keys successfully', async () => {
      mockEncryptionService.loadUserKeys.mockResolvedValue(true)
      mockEncryptionService.getEncryptionStatus.mockReturnValue({
        hasKeys: true,
        keysLoaded: true,
      })

      const { result } = renderHook(() => useEncryption())

      let loadResult: boolean | undefined

      await act(async () => {
        loadResult = await result.current.loadKeys('password123')
      })

      expect(loadResult).toBe(true)
      expect(mockEncryptionService.loadUserKeys).toHaveBeenCalledWith('password123')
      expect(result.current.hasKeys).toBe(true)
      expect(result.current.keysLoaded).toBe(true)
      expect(result.current.error).toBeNull()
    })

    test('should handle key loading failure', async () => {
      mockEncryptionService.loadUserKeys.mockResolvedValue(false)

      const { result } = renderHook(() => useEncryption())

      let loadResult: boolean | undefined

      await act(async () => {
        loadResult = await result.current.loadKeys('wrong-password')
      })

      expect(loadResult).toBe(false)
      expect(result.current.error).toBe('Failed to load keys')
    })

    test('should handle key loading error', async () => {
      const errorMessage = 'Network error'
      mockEncryptionService.loadUserKeys.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useEncryption())

      let loadResult: boolean | undefined

      await act(async () => {
        loadResult = await result.current.loadKeys('password123')
      })

      expect(loadResult).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })

    test('should set loading state during key loading', async () => {
      let resolveLoading: (value: boolean) => void
      const loadingPromise = new Promise<boolean>((resolve) => {
        resolveLoading = resolve
      })

      mockEncryptionService.loadUserKeys.mockReturnValue(loadingPromise)

      const { result } = renderHook(() => useEncryption())

      // Start loading
      act(() => {
        result.current.loadKeys('password123')
      })

      // Should be loading
      expect(result.current.isLoadingKeys).toBe(true)

      // Complete loading
      await act(async () => {
        resolveLoading!(true)
        await loadingPromise
      })

      expect(result.current.isLoadingKeys).toBe(false)
    })
  })

  describe('Message Encryption/Decryption', () => {
    test('should encrypt message successfully', async () => {
      const encryptedPayload = JSON.stringify({
        encryptedText: 'encrypted-data',
        iv: 'iv-data',
        tag: 'tag-data',
        keyId: 'key-123',
      })

      mockEncryptionService.encryptMessage.mockResolvedValue(encryptedPayload)

      const { result } = renderHook(() => useEncryption())

      let encryptResult: string | undefined

      await act(async () => {
        encryptResult = await result.current.encryptMessage(
          'Hello, secret message!',
          'conv123',
          'user123',
        )
      })

      expect(encryptResult).toBe(encryptedPayload)
      expect(mockEncryptionService.encryptMessage).toHaveBeenCalledWith(
        'Hello, secret message!',
        'conv123',
        'user123',
      )
    })

    test('should handle encryption error', async () => {
      const errorMessage = 'Encryption failed'
      mockEncryptionService.encryptMessage.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useEncryption())

      await act(async () => {
        try {
          await result.current.encryptMessage('text', 'conv123', 'user123')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })

    test('should decrypt message successfully', async () => {
      const originalText = 'Hello, secret message!'
      const encryptedPayload = JSON.stringify({
        encryptedText: 'encrypted-data',
        iv: 'iv-data',
        tag: 'tag-data',
        keyId: 'key-123',
      })

      mockEncryptionService.decryptMessage.mockResolvedValue(originalText)

      const { result } = renderHook(() => useEncryption())

      let decryptResult: string | undefined

      await act(async () => {
        decryptResult = await result.current.decryptMessage(encryptedPayload, 'conv123', 'user123')
      })

      expect(decryptResult).toBe(originalText)
      expect(mockEncryptionService.decryptMessage).toHaveBeenCalledWith(
        JSON.parse(encryptedPayload),
        'conv123',
        'user123',
      )
    })

    test('should handle decryption error', async () => {
      const errorMessage = 'Decryption failed'
      mockEncryptionService.decryptMessage.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useEncryption())

      await act(async () => {
        try {
          await result.current.decryptMessage(
            JSON.stringify({ encryptedText: 'data' }),
            'conv123',
            'user123',
          )
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('Encryption Management', () => {
    test('should enable encryption for conversation', async () => {
      mockEncryptionService.enableEncryption.mockResolvedValue(undefined)

      const { result } = renderHook(() => useEncryption())

      await act(async () => {
        await result.current.enableEncryption('conv123')
      })

      expect(mockEncryptionService.enableEncryption).toHaveBeenCalledWith('conv123')
    })

    test('should handle enable encryption error', async () => {
      const errorMessage = 'Failed to enable encryption'
      mockEncryptionService.enableEncryption.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useEncryption())

      await act(async () => {
        try {
          await result.current.enableEncryption('conv123')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })

    test('should check if encryption is enabled', async () => {
      mockEncryptionService.isEncryptionEnabled.mockResolvedValue(true)

      const { result } = renderHook(() => useEncryption())

      let isEnabled: boolean | undefined

      await act(async () => {
        isEnabled = await result.current.isEncryptionEnabled('conv123', 'user123')
      })

      expect(isEnabled).toBe(true)
      expect(mockEncryptionService.isEncryptionEnabled).toHaveBeenCalledWith('conv123', 'user123')
    })

    test('should handle check encryption status error', async () => {
      const errorMessage = 'Failed to check encryption status'
      mockEncryptionService.isEncryptionEnabled.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useEncryption())

      let isEnabled: boolean | undefined

      await act(async () => {
        isEnabled = await result.current.isEncryptionEnabled('conv123', 'user123')
      })

      expect(isEnabled).toBe(false)
      expect(result.current.error).toBe(errorMessage)
    })
  })

  describe('Key Management Operations', () => {
    test('should clear keys from memory', () => {
      const { result } = renderHook(() => useEncryption())

      act(() => {
        result.current.clearKeys()
      })

      expect(mockEncryptionService.clearKeys).toHaveBeenCalled()
      expect(result.current.hasKeys).toBe(false)
      expect(result.current.keysLoaded).toBe(false)
      expect(result.current.error).toBeNull()
    })

    test('should remove keys from storage', async () => {
      mockEncryptionService.removeKeys.mockResolvedValue(undefined)

      const { result } = renderHook(() => useEncryption())

      await act(async () => {
        await result.current.removeKeys()
      })

      expect(mockEncryptionService.removeKeys).toHaveBeenCalled()
      expect(result.current.hasKeys).toBe(false)
      expect(result.current.keysLoaded).toBe(false)
    })

    test('should handle remove keys error', async () => {
      const errorMessage = 'Failed to remove keys'
      mockEncryptionService.removeKeys.mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => useEncryption())

      await act(async () => {
        try {
          await result.current.removeKeys()
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
        }
      })

      expect(result.current.error).toBe(errorMessage)
    })

    test('should clear error', () => {
      const { result } = renderHook(() => useEncryption())

      // Set an error first
      act(() => {
        ;(result.current as any).setState({ error: 'Test error' })
      })

      // Clear the error
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('State Management', () => {
    test('should maintain state consistency', async () => {
      mockEncryptionService.generateUserKeys.mockResolvedValue(undefined)
      mockEncryptionService.getEncryptionStatus
        .mockReturnValueOnce({ hasKeys: false, keysLoaded: false })
        .mockReturnValueOnce({ hasKeys: true, keysLoaded: true })

      const { result } = renderHook(() => useEncryption())

      // Initial state
      expect(result.current.hasKeys).toBe(false)
      expect(result.current.keysLoaded).toBe(false)

      // Generate keys
      await act(async () => {
        await result.current.generateKeys('user123', 'password123')
      })

      // Updated state
      expect(result.current.hasKeys).toBe(true)
      expect(result.current.keysLoaded).toBe(true)
    })

    test('should handle multiple concurrent operations', async () => {
      mockEncryptionService.encryptMessage
        .mockResolvedValueOnce('encrypted-1')
        .mockResolvedValueOnce('encrypted-2')
        .mockResolvedValueOnce('encrypted-3')

      const { result } = renderHook(() => useEncryption())

      let results: string[] = []

      await act(async () => {
        const promises = [
          result.current.encryptMessage('message1', 'conv1', 'user1'),
          result.current.encryptMessage('message2', 'conv2', 'user2'),
          result.current.encryptMessage('message3', 'conv3', 'user3'),
        ]

        results = await Promise.all(promises)
      })

      expect(results).toEqual(['encrypted-1', 'encrypted-2', 'encrypted-3'])
      expect(mockEncryptionService.encryptMessage).toHaveBeenCalledTimes(3)
    })
  })

  describe('Error Recovery', () => {
    test('should recover from transient errors', async () => {
      // First call fails
      mockEncryptionService.generateUserKeys
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)

      mockEncryptionService.getEncryptionStatus.mockReturnValue({
        hasKeys: true,
        keysLoaded: true,
      })

      const { result } = renderHook(() => useEncryption())

      // First attempt fails
      let firstResult: boolean | undefined
      await act(async () => {
        firstResult = await result.current.generateKeys('user123', 'password123')
      })

      expect(firstResult).toBe(false)
      expect(result.current.error).toBe('Network error')

      // Clear error and retry
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()

      // Second attempt succeeds
      let secondResult: boolean | undefined
      await act(async () => {
        secondResult = await result.current.generateKeys('user123', 'password123')
      })

      expect(secondResult).toBe(true)
      expect(result.current.error).toBeNull()
    })
  })
})
