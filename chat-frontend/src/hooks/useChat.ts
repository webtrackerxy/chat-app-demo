import { useChatStore } from '@store/chatStore'

export const useChat = () => {
  const {
    conversations,
    currentConversation,
    currentUser,
    isLoading,
    error,
    storageMode,
    loadConversations,
    loadMessages,
    sendMessage,
    deleteMessage,
    createConversation,
    deleteConversation,
    updateConversation,
    setCurrentConversation,
    setCurrentUser,
    setStorageMode,
    createUser,
    clearError,
  } = useChatStore()

  return {
    // State
    conversations,
    currentConversation,
    currentUser,
    isLoading,
    error,
    storageMode,

    // Actions
    loadConversations,
    loadMessages,
    sendMessage,
    deleteMessage,
    createConversation,
    deleteConversation,
    updateConversation,
    setCurrentConversation,
    setCurrentUser,
    setStorageMode,
    createUser,
    clearError,
  }
}
