import React, { useEffect, useState, useMemo, useRef } from 'react'
import {
  View,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
  SafeAreaView,
  Text,
  TouchableOpacity,
} from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { useChat } from '@hooks/useChat'
import { useRealtimeMessages } from '@hooks/useRealtimeMessages'
import { useTypingIndicator } from '@hooks/useTypingIndicator'
import { useReadReceipts } from '@hooks/useReadReceipts'
import { useUserPresence } from '@hooks/useUserPresence'
import { useMessageReactions } from '@hooks/useMessageReactions'
import { useMessageThreading } from '@hooks/useMessageThreading'
import { Message, FileAttachment } from '@chat-types'
import {
  Header,
  MessageItem,
  MessageInput,
  EmptyState,
  EncryptionToggle,
  EncryptionDebugPanel,
} from '@components'
import { useTheme } from '@theme'
import { socketService } from '@services/socketService'
import { RootStackParamList } from '@types'
import { isDebugEncryption } from '@config/env'

type ChatRoomScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChatRoom'>
type ChatRoomScreenRouteProp = RouteProp<RootStackParamList, 'ChatRoom'>

export const ChatRoomScreen: React.FC = () => {
  console.log('ChatRoomScreen')
  const navigation = useNavigation<ChatRoomScreenNavigationProp>()
  const route = useRoute<ChatRoomScreenRouteProp>()
  const { userName, conversationId } = route.params
  const { colors, spacing, borderRadius, typography } = useTheme()
  const styles = createStyles(colors, spacing, borderRadius, typography)
  const {
    currentConversation,
    conversations,
    isLoading,
    error,
    storageMode,
    sendMessage,
    deleteMessage,
    loadMessages,
    setCurrentConversation,
    loadConversations,
  } = useChat()
  const [inputText, setInputText] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [isEncryptionEnabled, setIsEncryptionEnabled] = useState(false)
  const [showDebugPanel, setShowDebugPanel] = useState(false)
  const flatListRef = useRef<FlatList>(null)

  // Generate a simple userId from userName for demo purposes
  const userId = `user_${userName.toLowerCase().replace(/\s+/g, '_')}`

  // Set up real-time messaging
  const {
    messages: realtimeMessages,
    isConnected,
    error: realtimeError,
    sendMessage: sendRealtimeMessage,
    deleteMessage: deleteRealtimeMessage,
    setInitialMessages,
  } = useRealtimeMessages({
    conversationId,
    isEnabled: storageMode === 'backend' && !!conversationId,
  })

  // Set up typing indicators
  const { startTyping, stopTyping, getTypingText, isAnyoneTyping } = useTypingIndicator({
    conversationId,
    currentUserId: userId,
    isEnabled: storageMode === 'backend' && !!conversationId,
  })

  // Set up read receipts
  const { markAsRead, getReadStatusText, hasCurrentUserRead, getMessageReadReceipts } =
    useReadReceipts({
      conversationId,
      userId,
      userName,
      isEnabled: storageMode === 'backend' && !!conversationId,
    })

  // Set up user presence
  const {
    onlineUsers,
    isCurrentUserOnline,
    getOnlineUsersText,
    getPresenceText,
    setUserOnline,
    setUserOffline,
  } = useUserPresence({
    conversationId,
    userId,
    userName,
    isEnabled: storageMode === 'backend' && !!conversationId,
  })

  // Set up message reactions
  const {
    toggleReaction,
    getReactionSummary,
    initializeReactions,
    getMessageReactions,
    hasUserReactedWithAny,
    getUserReactionEmoji,
  } = useMessageReactions({
    conversationId,
    userId,
    userName,
    isEnabled: storageMode === 'backend' && !!conversationId,
  })

  // Set up message threading
  const {
    createThreadReply,
    loadThread,
    getThreadMessages,
    error: threadingError,
  } = useMessageThreading()

  // Load conversations on mount
  useEffect(() => {
    if (conversations.length === 0) {
      console.log('Loading conversations...')
      loadConversations()
    }
  }, [conversations.length, loadConversations])

  // Set current conversation based on route parameter
  useEffect(() => {
    if (conversationId && (!currentConversation || currentConversation.id !== conversationId)) {
      // Find the conversation in the store
      const conversation = conversations.find((conv) => conv.id === conversationId)
      if (conversation) {
        console.log('Setting current conversation from store:', conversation.id)
        setCurrentConversation(conversation)
      } else if (conversations.length > 0) {
        // If conversation not found in store but we have conversations, load it directly
        console.log('Loading messages for conversation:', conversationId)
        loadMessages(conversationId)
      }
    }
  }, [conversationId, currentConversation, conversations, setCurrentConversation, loadMessages])

  // Set initial messages for real-time hook when messages are loaded
  useEffect(() => {
    if (
      storageMode === 'backend' &&
      currentConversation?.messages &&
      currentConversation.messages.length > 0
    ) {
      // Only set initial messages when we have actual messages
      // This prevents clearing real-time messages with empty arrays
      setInitialMessages(currentConversation.messages)

      // Auto-scroll to bottom when conversation first loads
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false })
      }, 100)
    }
  }, [currentConversation?.messages, storageMode, setInitialMessages])

  // Get messages based on storage mode
  const messages = useMemo(() => {
    let messagesList: Message[] = []

    if (storageMode === 'backend') {
      // Always prefer real-time messages when connected, even if empty initially
      if (isConnected) {
        console.log('Using real-time messages:', realtimeMessages.length, 'messages')
        messagesList = realtimeMessages
      } else {
        // Fall back to conversation messages from API when not connected
        console.log('Using API messages:', currentConversation?.messages?.length || 0, 'messages')
        messagesList = currentConversation?.messages || []
      }
    } else {
      messagesList = currentConversation?.messages || []
    }

    // Debug log for encrypted messages
    if (isDebugEncryption() && messagesList.length > 0) {
      const encryptedMessages = messagesList.filter((msg) => (msg as any).encrypted)
      if (encryptedMessages.length > 0) {
        console.log('🔐 DEBUG: Found encrypted messages:', {
          totalMessages: messagesList.length,
          encryptedCount: encryptedMessages.length,
          encryptedMessageIds: encryptedMessages.map((msg) => msg.id),
        })
      }
    }

    return messagesList
  }, [storageMode, isConnected, realtimeMessages, currentConversation?.messages])

  // Auto-scroll to latest message when messages change
  useEffect(() => {
    if (messages.length > 0) {
      // Small delay to ensure the message is rendered before scrolling
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [messages.length])

  // Initialize reactions for existing messages
  useEffect(() => {
    if (messages.length > 0) {
      messages.forEach((message) => {
        if (message.reactions) {
          initializeReactions(message.id, message.reactions)
        }
      })
    }
  }, [messages, initializeReactions])

  const handleSendMessage = async () => {
    if (inputText.trim()) {
      if (isDebugEncryption()) {
        console.log('🔐 DEBUG: Sending message:', {
          text: inputText.trim(),
          userId,
          conversationId,
          isEncrypted: isEncryptionEnabled,
          storageMode,
        })
      }

      if (storageMode === 'backend' && isConnected) {
        // Use real-time messaging for backend mode
        sendRealtimeMessage(inputText.trim(), userId, userName)
      } else {
        // Fall back to traditional API call for local mode or when not connected
        await sendMessage(inputText.trim(), conversationId)
      }
      setInputText('')

      // Auto-scroll to latest message after sending
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }

  const handleFileSelected = (fileData: FileAttachment) => {
    if (storageMode === 'backend' && isConnected) {
      // Send file message via WebSocket
      socketService.sendFileMessage({
        senderId: userId,
        senderName: userName,
        conversationId,
        fileData,
      })
    } else {
      // For local mode, we could implement a fallback API call
      Alert.alert('File Sharing', 'File sharing requires backend mode')
    }
  }

  const handleDeleteMessage = (message: Message) => {
    console.log('handleDeleteMessage called for message:', message.id)
    console.log('Storage mode:', storageMode)
    console.log('deleteRealtimeMessage available:', !!deleteRealtimeMessage)
    console.log('isConnected:', isConnected)

    Alert.alert(
      'Delete Message',
      `Delete "${message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            console.log('Delete confirmed for message:', message.id)
            try {
              if (storageMode === 'backend' && deleteRealtimeMessage) {
                console.log('Using real-time WebSocket deletion')
                deleteRealtimeMessage(message.id, userId)
              } else {
                console.log('Using API deletion')
                await deleteMessage(message.id)
              }
              console.log('Delete operation completed')
            } catch (error) {
              console.error('Delete operation failed:', error)
            }
          },
        },
      ],
    )
  }

  const handleReplyToMessage = async (message: Message) => {
    // For now, just show an alert to get reply text
    // In a real app, you'd show a proper reply input UI
    Alert.prompt(
      'Reply to Message',
      `Reply to: "${message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text}"`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Reply',
          onPress: async (replyText) => {
            if (replyText?.trim()) {
              try {
                await createThreadReply(message.id, replyText.trim(), userId, conversationId)
                // Real-time update will handle showing the new reply via WebSocket

                // Auto-scroll to latest message after sending thread reply
                setTimeout(() => {
                  flatListRef.current?.scrollToEnd({ animated: true })
                }, 100)
              } catch (error) {
                console.error('Failed to send reply:', error)
                Alert.alert('Error', 'Failed to send reply')
              }
            }
          },
        },
      ],
      'plain-text',
    )
  }

  const handleScrollToParentMessage = (parentMessageId: string) => {
    // Find the index of the parent message in the messages array
    const parentIndex = messages.findIndex((msg) => msg.id === parentMessageId)

    if (parentIndex !== -1) {
      try {
        // Scroll to the parent message
        flatListRef.current?.scrollToIndex({
          index: parentIndex,
          animated: true,
          viewPosition: 0.5, // Position the message in the middle of the screen
        })
      } catch (error) {
        // Fallback: scroll to the general area if scrollToIndex fails
        console.warn('Failed to scroll to specific message, using fallback')
        flatListRef.current?.scrollToOffset({
          offset: parentIndex * 100, // Rough estimate of message height
          animated: true,
        })
      }
    }
  }

  const onRefresh = async () => {
    setRefreshing(true)
    // Reload messages for the current conversation
    await loadMessages(conversationId)
    setRefreshing(false)
  }

  const handleEncryptionChange = (enabled: boolean) => {
    setIsEncryptionEnabled(enabled)

    if (isDebugEncryption()) {
      console.log('🔐 DEBUG: Encryption status changed:', {
        enabled,
        conversationId,
        userId,
        timestamp: new Date().toISOString(),
      })
    }

    console.log(`Encryption ${enabled ? 'enabled' : 'disabled'} for conversation:`, conversationId)
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderName === userName

    // Debug log for encrypted messages
    if (isDebugEncryption() && (item as any).encrypted) {
      console.log('🔐 DEBUG: Rendering encrypted message:', {
        messageId: item.id,
        isMyMessage,
        hasEncryptedPayload: !!(item as any).encryptedPayload,
        text: item.text,
        timestamp: item.timestamp,
        senderName: item.senderName,
      })
    }

    // Get current reactions from hook instead of message object
    const currentReactions = getMessageReactions(item.id)

    // Create updated message with current reactions
    const updatedMessage = {
      ...item,
      reactions: currentReactions,
    }

    return (
      <MessageItem
        message={updatedMessage}
        isMyMessage={isMyMessage}
        onDelete={() => handleDeleteMessage(item)}
        showDeleteButton={isMyMessage}
        onReaction={(emoji) => toggleReaction(item.id, emoji)}
        onMarkAsRead={() => markAsRead(item.id)}
        currentUserId={userId}
        showReadReceipts={storageMode === 'backend'}
        showReactions={storageMode === 'backend'}
        onReply={handleReplyToMessage}
        showReplyButton={storageMode === 'backend'}
        onReplyIndicatorPress={handleScrollToParentMessage}
      />
    )
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Header title='Error' onBack={() => navigation.goBack()} />
          <EmptyState icon='⚠️' title='Something went wrong' subtitle={error} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <Header
          title={currentConversation?.title || 'Chat Room'}
          subtitle={
            storageMode === 'backend'
              ? `${userName} - ${isConnected ? '🟢 Connected' : '🔴 Disconnected'} - ${getOnlineUsersText()}`
              : `${userName} - Long press your messages to delete`
          }
          onBack={() => navigation.goBack()}
          rightComponent={
            <View style={styles.headerActions}>
              {storageMode === 'backend' && isConnected && (
                <TouchableOpacity
                  style={styles.presenceToggle}
                  onPress={isCurrentUserOnline ? setUserOffline : setUserOnline}
                >
                  <Text style={styles.presenceToggleText}>
                    {isCurrentUserOnline ? '🟢 Online' : '🔴 Offline'}
                  </Text>
                </TouchableOpacity>
              )}
              {isDebugEncryption() && (
                <TouchableOpacity
                  style={styles.debugToggle}
                  onPress={() => setShowDebugPanel(!showDebugPanel)}
                >
                  <Text style={styles.debugToggleText}>{showDebugPanel ? '🔐❌' : '🔐📊'}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />

        {/* Encryption Toggle - show in both modes */}
        <EncryptionToggle
          conversationId={conversationId}
          userId={userId}
          onEncryptionChange={handleEncryptionChange}
        />

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor='#007AFF'
              colors={['#007AFF']}
            />
          }
          showsVerticalScrollIndicator={true}
          scrollEnabled={true}
          keyboardShouldPersistTaps='handled'
          keyboardDismissMode='on-drag'
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onScrollToIndexFailed={(info) => {
            console.warn('ScrollToIndex failed:', info)
            // Fallback to scrollToOffset
            flatListRef.current?.scrollToOffset({
              offset: info.index * 100,
              animated: true,
            })
          }}
        />

        {/* Typing indicator */}
        {isAnyoneTyping && (
          <View style={styles.typingIndicator}>
            <Text style={styles.typingText}>{getTypingText()}</Text>
          </View>
        )}

        <MessageInput
          value={inputText}
          onChangeText={setInputText}
          onSend={handleSendMessage}
          disabled={isLoading}
          onTypingStart={startTyping}
          onTypingStop={stopTyping}
          userId={userId}
          userName={userName}
          onFileSelected={handleFileSelected}
          showFilePicker={storageMode === 'backend' && isConnected}
          onVoiceRecorded={handleFileSelected}
          showVoiceRecorder={storageMode === 'backend' && isConnected}
        />

        {/* Debug Panel */}
        {isDebugEncryption() && (
          <EncryptionDebugPanel visible={showDebugPanel} onClose={() => setShowDebugPanel(false)} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const createStyles = (colors: any, spacing: any, borderRadius: any, typography: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.semantic.background.primary,
    },
    container: {
      flex: 1,
      backgroundColor: colors.semantic.background.primary,
    },
    messagesList: {
      flex: 1,
    },
    messagesContainer: {
      padding: spacing.lg,
      flexGrow: 1,
    },
    typingIndicator: {
      padding: spacing.sm,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.semantic.surface.secondary,
      borderTopWidth: 1,
      borderTopColor: colors.semantic.border.secondary,
    },
    typingText: {
      ...typography.body.xs.regular,
      color: colors.semantic.text.tertiary,
      fontStyle: 'italic',
    },
    presenceToggle: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.semantic.surface.tertiary,
      borderWidth: 1,
      borderColor: colors.semantic.border.secondary,
    },
    presenceToggleText: {
      ...typography.body.xs.bold,
      color: colors.semantic.text.primary,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    debugToggle: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.md,
      backgroundColor: colors.semantic.surface.tertiary,
      borderWidth: 1,
      borderColor: colors.semantic.border.secondary,
    },
    debugToggleText: {
      ...typography.body.xs.bold,
      color: colors.semantic.text.primary,
    },
  })
