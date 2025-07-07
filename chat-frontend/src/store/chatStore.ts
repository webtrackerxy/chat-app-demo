import { create } from 'zustand';
import { Message, Conversation } from '../../../chat-types/src';
import { StorageApiFactory, StorageApiInterface } from '../api/storageApi';
import { StorageMode } from '../screens/NameInputScreen';
import { ParticipantEmulator } from '../services/participantEmulator';

interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  currentUser: { id: string; name: string } | null;
  isLoading: boolean;
  error: string | null;
  storageMode: StorageMode;
  storageApi: StorageApiInterface;
  
  // Actions
  setStorageMode: (mode: StorageMode) => void;
  setCurrentUser: (user: { id: string; name: string }) => void;
  setCurrentConversation: (conversation: Conversation | null) => void;
  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  sendMessage: (text: string, conversationId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  createConversation: (data: { title: string; participants: string[] }) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  updateConversation: (conversationId: string, title: string) => Promise<void>;
  clearError: () => void;
}

export const useChatStore = create<ChatState>((set, get) => {
  // Setup participant emulator callback
  const emulator = ParticipantEmulator.getInstance();
  emulator.setMessageAddedCallback((conversationId: string) => {
    // Reload messages when participant emulator adds a message
    get().loadMessages(conversationId);
  });

  return {
    conversations: [],
    currentConversation: null,
    currentUser: null,
    isLoading: false,
    error: null,
    storageMode: 'local',
    storageApi: StorageApiFactory.getApi('local'),

  setStorageMode: (mode: StorageMode) => {
    const api = StorageApiFactory.getApi(mode);
    set({ storageMode: mode, storageApi: api });
  },

  setCurrentUser: (user) => set({ currentUser: user }),

  setCurrentConversation: (conversation) => {
    set({ currentConversation: conversation });
    // Load messages for the selected conversation
    if (conversation) {
      get().loadMessages(conversation.id);
    }
  },

  loadConversations: async () => {
    const { storageApi } = get();
    set({ isLoading: true, error: null });
    try {
      const response = await storageApi.getConversations();
      if (response.success) {
        set({ conversations: response.data });
      } else {
        set({ error: response.error || 'Failed to load conversations' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadMessages: async (conversationId: string) => {
    const { storageApi } = get();
    set({ isLoading: true, error: null });
    try {
      const response = await storageApi.getMessages(conversationId);
      if (response.success) {
        // Deduplicate messages by ID to prevent duplicate key warnings
        const deduplicatedMessages = response.data.reduce((acc: Message[], message: Message) => {
          if (!acc.find(m => m.id === message.id)) {
            acc.push(message);
          }
          return acc;
        }, []);

        // Update the specific conversation with the loaded messages
        set(state => ({
          conversations: state.conversations.map(conv => 
            conv.id === conversationId 
              ? { ...conv, messages: deduplicatedMessages }
              : conv
          ),
          currentConversation: state.currentConversation?.id === conversationId
            ? { ...state.currentConversation, messages: deduplicatedMessages }
            : state.currentConversation
        }));
      } else {
        set({ error: response.error || 'Failed to load messages' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },


  sendMessage: async (text: string, conversationId: string) => {
    const { storageApi, currentUser } = get();
    if (!currentUser) return;
    
    set({ isLoading: true, error: null });
    try {
      const response = await storageApi.sendMessage({
        text,
        conversationId,
        senderId: currentUser.id,
        senderName: currentUser.name
      });
      
      if (response.success) {
        // Update the conversation with the new message (with deduplication)
        set(state => ({
          conversations: state.conversations.map(conv => 
            conv.id === conversationId 
              ? { 
                  ...conv, 
                  messages: conv.messages.find(m => m.id === response.data.id) 
                    ? conv.messages 
                    : [...conv.messages, response.data]
                }
              : conv
          ),
          currentConversation: state.currentConversation?.id === conversationId
            ? { 
                ...state.currentConversation, 
                messages: state.currentConversation.messages.find(m => m.id === response.data.id)
                  ? state.currentConversation.messages
                  : [...state.currentConversation.messages, response.data]
              }
            : state.currentConversation
        }));
        
        // Trigger participant emulation for local storage mode
        if (get().storageMode === 'local') {
          const emulator = ParticipantEmulator.getInstance();
          emulator.emulateResponse(conversationId, text, currentUser.name);
        }
      } else {
        set({ error: response.error || 'Failed to send message' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteMessage: async (messageId: string) => {
    const { storageApi } = get();
    if (!storageApi.deleteMessage) {
      set({ error: 'Delete message not supported by current storage mode' });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const response = await storageApi.deleteMessage(messageId);
      if (response.success) {
        // Remove message from all conversations
        set(state => ({
          conversations: state.conversations.map(conv => ({
            ...conv,
            messages: conv.messages.filter(msg => msg.id !== messageId)
          })),
          currentConversation: state.currentConversation 
            ? { ...state.currentConversation, messages: state.currentConversation.messages.filter(msg => msg.id !== messageId) }
            : null
        }));
      } else {
        set({ error: response.error || 'Failed to delete message' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  createConversation: async (data: { title: string; participants: string[] }) => {
    const { storageApi } = get();
    set({ isLoading: true, error: null });
    try {
      const response = await storageApi.createConversation(data);
      if (response.success) {
        set(state => ({
          conversations: [...state.conversations, response.data]
        }));
        
        // Populate new conversation with emulated participants
        if (get().storageMode === 'local') {
          const emulator = ParticipantEmulator.getInstance();
          emulator.populateConversation(response.data.id);
          emulator.startPeriodicActivity(response.data.id);
        }
      } else {
        set({ error: response.error || 'Failed to create conversation' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  deleteConversation: async (conversationId: string) => {
    const { storageApi } = get();
    console.log('🗑️ Attempting to delete conversation:', conversationId);
    console.log('🗑️ Storage API has deleteConversation method:', typeof storageApi.deleteConversation);
    
    if (!storageApi.deleteConversation) {
      console.log('🗑️ Delete conversation not supported');
      set({ error: 'Delete conversation not supported by current storage mode' });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const response = await storageApi.deleteConversation(conversationId);
      if (response.success) {
        set(state => ({
          conversations: state.conversations.filter(conv => conv.id !== conversationId),
          currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation
        }));
      } else {
        set({ error: response.error || 'Failed to delete conversation' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  updateConversation: async (conversationId: string, title: string) => {
    const { storageApi } = get();
    console.log('✏️ Attempting to update conversation:', conversationId, 'to:', title);
    console.log('✏️ Storage API has updateConversation method:', typeof storageApi.updateConversation);
    
    if (!storageApi.updateConversation) {
      console.log('✏️ Update conversation not supported');
      set({ error: 'Update conversation not supported by current storage mode' });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      const response = await storageApi.updateConversation(conversationId, title);
      if (response.success) {
        set(state => ({
          conversations: state.conversations.map(conv => 
            conv.id === conversationId ? { ...conv, title } : conv
          ),
          currentConversation: state.currentConversation?.id === conversationId 
            ? { ...state.currentConversation, title }
            : state.currentConversation
        }));
      } else {
        set({ error: response.error || 'Failed to update conversation' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      set({ isLoading: false });
    }
  },

  clearError: () => {
    set({ error: null });
  }
  };
});