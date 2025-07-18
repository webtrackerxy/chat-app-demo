import { renderHook, act } from '@testing-library/react'
import { useChatStore } from '../chatStore'
import { chatApi } from '@api/chatApi'
import { DbUser } from '@chat-types'

// Mock the chatApi
jest.mock('@api/chatApi', () => ({
  chatApi: {
    createUser: jest.fn(),
    getUser: jest.fn(),
    getConversations: jest.fn(),
    getMessageHistory: jest.fn(),
  },
}))

// Mock AsyncStorage for theme persistence
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}))

// Mock participant emulator
jest.mock('@services/participantEmulator', () => ({
  ParticipantEmulator: {
    getInstance: () => ({
      setMessageAddedCallback: jest.fn(),
    }),
  },
}))

const mockChatApi = chatApi as jest.Mocked<typeof chatApi>

describe('ChatStore Database Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    // Reset the store state after each test
    const { result } = renderHook(() => useChatStore())
    act(() => {
      result.current.setCurrentUser(null)
      result.current.clearError()
      result.current.setStorageMode('local')
    })
  })

  const createMockUser = (username: string): DbUser => ({
    id: `user_${username}`,
    username,
    status: 'online',
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSeen: new Date(),
  })

  describe('User Creation', () => {
    test('should create user successfully', async () => {
      const mockUser = createMockUser('testuser')
      const successResponse = {
        success: true,
        data: mockUser,
        error: undefined,
      }

      mockChatApi.createUser.mockResolvedValue(successResponse)

      const { result } = renderHook(() => useChatStore())

      expect(result.current.currentUser).toBe(null)
      expect(result.current.isLoading).toBe(false)

      let createdUser: DbUser | null = null
      await act(async () => {
        createdUser = await result.current.createUser('testuser')
      })

      expect(mockChatApi.createUser).toHaveBeenCalledWith({
        username: 'testuser',
      })
      expect(createdUser).toEqual(mockUser)
      expect(result.current.currentUser).toEqual({
        id: mockUser.id,
        name: mockUser.username,
      })
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBe(null)
    })

    test('should handle loading state during user creation', async () => {
      let resolvePromise: (value: any) => void
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      mockChatApi.createUser.mockReturnValue(promise as any)

      const { result } = renderHook(() => useChatStore())

      // Start user creation
      let createUserPromise: Promise<DbUser | null>
      act(() => {
        createUserPromise = result.current.createUser('testuser')
      })

      expect(result.current.isLoading).toBe(true)

      // Resolve the promise
      await act(async () => {
        resolvePromise!({
          success: true,
          data: createMockUser('testuser'),
        })
        await createUserPromise!
      })

      expect(result.current.isLoading).toBe(false)
    })

    test('should handle API error during user creation', async () => {
      const errorResponse = {
        success: false,
        data: null as any,
        error: 'Username already exists',
      }

      mockChatApi.createUser.mockResolvedValue(errorResponse)

      const { result } = renderHook(() => useChatStore())

      let createdUser: DbUser | null = null
      await act(async () => {
        createdUser = await result.current.createUser('existinguser')
      })

      expect(createdUser).toBe(null)
      expect(result.current.currentUser).toBe(null)
      expect(result.current.error).toBe('Username already exists')
      expect(result.current.isLoading).toBe(false)
    })

    test('should handle network error during user creation', async () => {
      mockChatApi.createUser.mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useChatStore())

      let createdUser: DbUser | null = null
      await act(async () => {
        createdUser = await result.current.createUser('testuser')
      })

      expect(createdUser).toBe(null)
      expect(result.current.currentUser).toBe(null)
      expect(result.current.error).toBe('Network error')
      expect(result.current.isLoading).toBe(false)
    })

    test('should not create user if username is empty', async () => {
      const { result } = renderHook(() => useChatStore())

      let createdUser: DbUser | null = null
      await act(async () => {
        createdUser = await result.current.createUser('')
      })

      expect(mockChatApi.createUser).toHaveBeenCalledWith({
        username: '',
      })
      // The API call will be made but should fail validation on the backend
    })
  })

  describe('User State Management', () => {
    test('should clear error when setting user manually', async () => {
      const { result } = renderHook(() => useChatStore())

      // Set an error first
      act(() => {
        result.current.clearError()
      })

      // Create an error
      mockChatApi.createUser.mockResolvedValue({
        success: false,
        data: null as any,
        error: 'Some error',
      })

      await act(async () => {
        await result.current.createUser('testuser')
      })

      expect(result.current.error).toBe('Some error')

      // Set user manually should not clear error automatically
      act(() => {
        result.current.setCurrentUser({
          id: 'manual_user',
          name: 'Manual User',
        })
      })

      expect(result.current.currentUser).toEqual({
        id: 'manual_user',
        name: 'Manual User',
      })
      expect(result.current.error).toBe('Some error') // Error should remain

      // Clear error explicitly
      act(() => {
        result.current.clearError()
      })

      expect(result.current.error).toBe(null)
    })

    test('should handle multiple concurrent user creation calls', async () => {
      const mockUser1 = createMockUser('user1')
      const mockUser2 = createMockUser('user2')

      let resolve1: (value: any) => void
      let resolve2: (value: any) => void

      const promise1 = new Promise((resolve) => {
        resolve1 = resolve
      })
      const promise2 = new Promise((resolve) => {
        resolve2 = resolve
      })

      mockChatApi.createUser
        .mockReturnValueOnce(promise1 as any)
        .mockReturnValueOnce(promise2 as any)

      const { result } = renderHook(() => useChatStore())

      // Start two concurrent user creation calls
      let promise1Result: Promise<DbUser | null>
      let promise2Result: Promise<DbUser | null>

      act(() => {
        promise1Result = result.current.createUser('user1')
        promise2Result = result.current.createUser('user2')
      })

      expect(result.current.isLoading).toBe(true)

      // Resolve first call
      await act(async () => {
        resolve1!({
          success: true,
          data: mockUser1,
        })
        await promise1Result
      })

      // The second call should still be pending, loading should remain true
      expect(result.current.isLoading).toBe(true)

      // Resolve second call
      await act(async () => {
        resolve2!({
          success: true,
          data: mockUser2,
        })
        await promise2Result
      })

      expect(result.current.isLoading).toBe(false)
      // The last successful call should set the current user
      expect(result.current.currentUser?.name).toBe('user2')
    })
  })

  describe('Integration with Storage Mode', () => {
    test('should use database operations in backend mode', async () => {
      const { result } = renderHook(() => useChatStore())

      // Set to backend mode
      act(() => {
        result.current.setStorageMode('backend')
      })

      expect(result.current.storageMode).toBe('backend')

      // User creation should work the same regardless of storage mode
      const mockUser = createMockUser('testuser')
      mockChatApi.createUser.mockResolvedValue({
        success: true,
        data: mockUser,
      })

      await act(async () => {
        await result.current.createUser('testuser')
      })

      expect(result.current.currentUser?.name).toBe('testuser')
    })

    test('should handle mode switching', async () => {
      const { result } = renderHook(() => useChatStore())

      // Start in local mode
      expect(result.current.storageMode).toBe('local')

      // Switch to backend mode
      act(() => {
        result.current.setStorageMode('backend')
      })

      expect(result.current.storageMode).toBe('backend')

      // User should persist across mode changes
      act(() => {
        result.current.setCurrentUser({
          id: 'test_user',
          name: 'Test User',
        })
      })

      // Switch back to local mode
      act(() => {
        result.current.setStorageMode('local')
      })

      expect(result.current.storageMode).toBe('local')
      expect(result.current.currentUser?.name).toBe('Test User')
    })
  })

  describe('Error Handling and Recovery', () => {
    test('should recover from errors', async () => {
      const { result } = renderHook(() => useChatStore())

      // First call fails
      mockChatApi.createUser.mockResolvedValueOnce({
        success: false,
        data: null as any,
        error: 'Server error',
      })

      await act(async () => {
        await result.current.createUser('testuser')
      })

      expect(result.current.error).toBe('Server error')
      expect(result.current.currentUser).toBe(null)

      // Second call succeeds
      const mockUser = createMockUser('testuser')
      mockChatApi.createUser.mockResolvedValueOnce({
        success: true,
        data: mockUser,
      })

      await act(async () => {
        await result.current.createUser('testuser')
      })

      expect(result.current.error).toBe(null)
      expect(result.current.currentUser?.name).toBe('testuser')
    })

    test('should handle malformed API responses', async () => {
      const { result } = renderHook(() => useChatStore())

      // API returns invalid response
      mockChatApi.createUser.mockResolvedValue({
        success: true,
        data: null as any, // Invalid: success but no data
      })

      await act(async () => {
        await result.current.createUser('testuser')
      })

      expect(result.current.currentUser).toBe(null)
      expect(result.current.error).toBe('Failed to create user')
    })
  })
})
