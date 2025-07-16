import { renderHook, act } from '@testing-library/react'
import { useMessageHistory } from '../useMessageHistory'
import { chatApi } from '@api/chatApi'
import { Message, PaginatedResponse } from '@chat-types'

// Mock the chatApi
jest.mock('@api/chatApi', () => ({
  chatApi: {
    getMessageHistory: jest.fn()
  }
}))

const mockChatApi = chatApi as jest.Mocked<typeof chatApi>

describe('useMessageHistory', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  const createMockResponse = (
    messages: Message[],
    page: number = 1,
    hasMore: boolean = false
  ): { success: true; data: PaginatedResponse<Message> } => ({
    success: true,
    data: {
      data: messages,
      pagination: {
        page,
        limit: 50,
        hasMore
      }
    }
  })

  const createMockMessage = (id: string, text: string): Message => ({
    id,
    text,
    senderId: 'user1',
    senderName: 'User1',
    timestamp: new Date(),
    type: 'text'
  })

  test('should initialize with empty state', () => {
    const { result } = renderHook(() => useMessageHistory())

    expect(result.current.messages).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.currentPage).toBe(1)
  })

  test('should load initial messages successfully', async () => {
    const mockMessages = [
      createMockMessage('msg1', 'Hello'),
      createMockMessage('msg2', 'World')
    ]
    
    mockChatApi.getMessageHistory.mockResolvedValue(
      createMockResponse(mockMessages, 1, true)
    )

    const { result } = renderHook(() => useMessageHistory())

    await act(async () => {
      await result.current.loadInitialMessages('conv1')
    })

    expect(result.current.messages).toEqual(mockMessages)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(null)
    expect(result.current.hasMore).toBe(true)
    expect(result.current.currentPage).toBe(1)
    
    expect(mockChatApi.getMessageHistory).toHaveBeenCalledWith({
      conversationId: 'conv1',
      page: 1,
      limit: 50
    })
  })

  test('should handle loading state correctly', async () => {
    let resolvePromise: (value: any) => void
    const promise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    
    mockChatApi.getMessageHistory.mockReturnValue(promise as any)

    const { result } = renderHook(() => useMessageHistory())

    // Start loading
    act(() => {
      result.current.loadInitialMessages('conv1')
    })

    expect(result.current.isLoading).toBe(true)

    // Resolve the promise
    await act(async () => {
      resolvePromise!(createMockResponse([]))
    })

    expect(result.current.isLoading).toBe(false)
  })

  test('should handle API errors', async () => {
    const errorResponse = {
      success: false,
      error: 'Failed to load messages',
      data: null as any
    }
    
    mockChatApi.getMessageHistory.mockResolvedValue(errorResponse)

    const { result } = renderHook(() => useMessageHistory())

    await act(async () => {
      await result.current.loadInitialMessages('conv1')
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBe('Failed to load messages')
    expect(result.current.isLoading).toBe(false)
  })

  test('should handle network errors', async () => {
    mockChatApi.getMessageHistory.mockRejectedValue(new Error('Network error'))

    const { result } = renderHook(() => useMessageHistory())

    await act(async () => {
      await result.current.loadInitialMessages('conv1')
    })

    expect(result.current.error).toBe('Network error')
    expect(result.current.isLoading).toBe(false)
  })

  test('should load more messages and append to existing list', async () => {
    const initialMessages = [createMockMessage('msg1', 'Hello')]
    const newMessages = [createMockMessage('msg2', 'World')]
    
    // First call for initial messages
    mockChatApi.getMessageHistory
      .mockResolvedValueOnce(createMockResponse(initialMessages, 1, true))
      .mockResolvedValueOnce(createMockResponse(newMessages, 2, false))

    const { result } = renderHook(() => useMessageHistory())

    // Load initial messages
    await act(async () => {
      await result.current.loadInitialMessages('conv1')
    })

    expect(result.current.messages).toEqual(initialMessages)
    expect(result.current.hasMore).toBe(true)

    // Load more messages
    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.messages).toEqual([...initialMessages, ...newMessages])
    expect(result.current.hasMore).toBe(false)
    expect(result.current.currentPage).toBe(2)

    expect(mockChatApi.getMessageHistory).toHaveBeenCalledTimes(2)
    expect(mockChatApi.getMessageHistory).toHaveBeenNthCalledWith(2, {
      conversationId: 'conv1',
      page: 2,
      limit: 50
    })
  })

  test('should not load more when hasMore is false', async () => {
    const mockMessages = [createMockMessage('msg1', 'Hello')]
    
    mockChatApi.getMessageHistory.mockResolvedValue(
      createMockResponse(mockMessages, 1, false)
    )

    const { result } = renderHook(() => useMessageHistory())

    await act(async () => {
      await result.current.loadInitialMessages('conv1')
    })

    expect(result.current.hasMore).toBe(false)

    // Try to load more
    await act(async () => {
      await result.current.loadMore()
    })

    // Should only have been called once (for initial load)
    expect(mockChatApi.getMessageHistory).toHaveBeenCalledTimes(1)
  })

  test('should not load more when already loading', async () => {
    const mockMessages = [createMockMessage('msg1', 'Hello')]
    
    let resolvePromise: (value: any) => void
    const promise = new Promise((resolve) => {
      resolvePromise = resolve
    })
    
    mockChatApi.getMessageHistory
      .mockResolvedValueOnce(createMockResponse(mockMessages, 1, true))
      .mockReturnValueOnce(promise as any)

    const { result } = renderHook(() => useMessageHistory())

    // Load initial messages
    await act(async () => {
      await result.current.loadInitialMessages('conv1')
    })

    // Start loading more (don't await)
    act(() => {
      result.current.loadMore()
    })

    expect(result.current.isLoading).toBe(true)

    // Try to load more again while already loading
    await act(async () => {
      await result.current.loadMore()
    })

    // Should not make another API call
    expect(mockChatApi.getMessageHistory).toHaveBeenCalledTimes(2)

    // Resolve the pending promise
    await act(async () => {
      resolvePromise!(createMockResponse([createMockMessage('msg2', 'World')], 2, false))
    })
  })

  test('should not load more when no conversation is set', async () => {
    const { result } = renderHook(() => useMessageHistory())

    await act(async () => {
      await result.current.loadMore()
    })

    expect(mockChatApi.getMessageHistory).not.toHaveBeenCalled()
  })

  test('should refresh messages correctly', async () => {
    const initialMessages = [createMockMessage('msg1', 'Hello')]
    const refreshedMessages = [
      createMockMessage('msg1', 'Hello'),
      createMockMessage('msg2', 'New message')
    ]
    
    mockChatApi.getMessageHistory
      .mockResolvedValueOnce(createMockResponse(initialMessages, 1, true))
      .mockResolvedValueOnce(createMockResponse(refreshedMessages, 1, false))

    const { result } = renderHook(() => useMessageHistory())

    // Load initial messages
    await act(async () => {
      await result.current.loadInitialMessages('conv1')
    })

    expect(result.current.messages).toEqual(initialMessages)
    expect(result.current.currentPage).toBe(1)

    // Refresh messages
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.messages).toEqual(refreshedMessages)
    expect(result.current.currentPage).toBe(1)
    expect(result.current.hasMore).toBe(false)

    expect(mockChatApi.getMessageHistory).toHaveBeenCalledTimes(2)
    expect(mockChatApi.getMessageHistory).toHaveBeenNthCalledWith(2, {
      conversationId: 'conv1',
      page: 1,
      limit: 50
    })
  })

  test('should not refresh when no conversation is set', async () => {
    const { result } = renderHook(() => useMessageHistory())

    await act(async () => {
      await result.current.refresh()
    })

    expect(mockChatApi.getMessageHistory).not.toHaveBeenCalled()
  })

  test('should reset state when loading initial messages for different conversation', async () => {
    const conv1Messages = [createMockMessage('msg1', 'Conv1 message')]
    const conv2Messages = [createMockMessage('msg2', 'Conv2 message')]
    
    mockChatApi.getMessageHistory
      .mockResolvedValueOnce(createMockResponse(conv1Messages, 1, false))
      .mockResolvedValueOnce(createMockResponse(conv2Messages, 1, false))

    const { result } = renderHook(() => useMessageHistory())

    // Load messages for first conversation
    await act(async () => {
      await result.current.loadInitialMessages('conv1')
    })

    expect(result.current.messages).toEqual(conv1Messages)

    // Load messages for second conversation
    await act(async () => {
      await result.current.loadInitialMessages('conv2')
    })

    expect(result.current.messages).toEqual(conv2Messages)
    expect(result.current.currentPage).toBe(1)
    expect(result.current.hasMore).toBe(false)

    expect(mockChatApi.getMessageHistory).toHaveBeenCalledTimes(2)
    expect(mockChatApi.getMessageHistory).toHaveBeenNthCalledWith(1, {
      conversationId: 'conv1',
      page: 1,
      limit: 50
    })
    expect(mockChatApi.getMessageHistory).toHaveBeenNthCalledWith(2, {
      conversationId: 'conv2',
      page: 1,
      limit: 50
    })
  })

  test('should handle missing data in API response', async () => {
    const responseWithoutData = {
      success: true,
      data: {
        pagination: {
          page: 1,
          limit: 50,
          hasMore: false
        }
      } as any // Missing data property
    }
    
    mockChatApi.getMessageHistory.mockResolvedValue(responseWithoutData)

    const { result } = renderHook(() => useMessageHistory())

    await act(async () => {
      await result.current.loadInitialMessages('conv1')
    })

    expect(result.current.messages).toEqual([])
    expect(result.current.hasMore).toBe(false)
    expect(result.current.error).toBe(null)
  })
})