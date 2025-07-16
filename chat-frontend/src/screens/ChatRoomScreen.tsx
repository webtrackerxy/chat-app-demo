import React, { useEffect, useState } from 'react'
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
import { Message, FileAttachment } from '@chat-types'
import { Header, MessageItem, MessageInput, EmptyState } from '@components'
import { useTheme } from '@theme'
import { socketService } from '@services/socketService'
import { RootStackParamList } from '@types'

type ChatRoomScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChatRoom'>
type ChatRoomScreenRouteProp = RouteProp<RootStackParamList, 'ChatRoom'>

export const ChatRoomScreen: React.FC = () => {
  const navigation = useNavigation<ChatRoomScreenNavigationProp>()
  const route = useRoute<ChatRoomScreenRouteProp>()
  const { userName, conversationId } = route.params
  const { colors, spacing, borderRadius, typography } = useTheme()
  const styles = createStyles(colors, spacing, borderRadius, typography)
  const {
    currentConversation,
    isLoading,
    error,
    storageMode,
    sendMessage,
    deleteMessage,
    loadMessages,
  } = useChat()
  const [inputText, setInputText] = useState('')
  const [refreshing, setRefreshing] = useState(false)

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

  // Load initial messages when conversation changes
  useEffect(() => {
    if (conversationId && currentConversation?.id === conversationId) {
      loadMessages(conversationId)
    }
  }, [conversationId, currentConversation?.id, loadMessages])

  // Set initial messages for real-time hook when messages are loaded
  useEffect(() => {
    if (storageMode === 'backend' && currentConversation?.messages) {
      setInitialMessages(currentConversation.messages)
    }
  }, [currentConversation?.messages, storageMode, setInitialMessages])

  // Get messages based on storage mode
  const messages =
    storageMode === 'backend' ? realtimeMessages : currentConversation?.messages || []

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
      if (storageMode === 'backend' && isConnected) {
        // Use real-time messaging for backend mode
        sendRealtimeMessage(inputText.trim(), userId, userName)
      } else {
        // Fall back to traditional API call for local mode or when not connected
        await sendMessage(inputText.trim(), conversationId)
      }
      setInputText('')
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

  const onRefresh = async () => {
    setRefreshing(true)
    // Reload messages for the current conversation
    await loadMessages(conversationId)
    setRefreshing(false)
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderName === userName

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
            storageMode === 'backend' && isConnected ? (
              <TouchableOpacity
                style={styles.presenceToggle}
                onPress={isCurrentUserOnline ? setUserOffline : setUserOnline}
              >
                <Text style={styles.presenceToggleText}>
                  {isCurrentUserOnline ? '🟢 Online' : '🔴 Offline'}
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />

        <FlatList
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
  })
