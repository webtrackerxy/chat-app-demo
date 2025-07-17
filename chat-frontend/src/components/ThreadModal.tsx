import React, { useState, useEffect } from 'react'
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform 
} from 'react-native'
import { useTheme } from '@theme'
import { useMessageThreading } from '@hooks/useMessageThreading'
import { Message } from '@chat-types'

interface ThreadModalProps {
  visible: boolean
  onClose: () => void
  parentMessage: Message | null
  currentUserId: string
  currentUserName: string
  conversationId: string
}

export const ThreadModal: React.FC<ThreadModalProps> = ({
  visible,
  onClose,
  parentMessage,
  currentUserId,
  currentUserName,
  conversationId
}) => {
  const { colors, spacing, typography } = useTheme()
  const {
    threads,
    isLoading,
    error,
    loadThread,
    createThreadReply,
    getThreadMessages,
    clearError
  } = useMessageThreading()
  
  const [replyText, setReplyText] = useState('')
  const [isSending, setIsSending] = useState(false)

  const threadId = parentMessage?.threadId || parentMessage?.id
  const threadMessages = threadId ? getThreadMessages(threadId) : []

  useEffect(() => {
    if (visible && threadId) {
      loadThread(threadId)
    }
  }, [visible, threadId, loadThread])

  const handleSendReply = async () => {
    if (!replyText.trim() || !parentMessage || isSending) return
    
    setIsSending(true)
    
    try {
      const success = await createThreadReply(
        parentMessage.id,
        replyText.trim(),
        currentUserId,
        conversationId
      )
      
      if (success) {
        setReplyText('')
      }
    } catch (err) {
      console.error('Failed to send thread reply:', err)
    } finally {
      setIsSending(false)
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)

    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString()
    }
  }

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMyMessage = item.senderId === currentUserId
    const isParentMessage = index === 0
    
    return (
      <View
        style={{
          marginVertical: spacing.xs,
          marginHorizontal: spacing.md,
        }}
      >
        {isParentMessage && (
          <View
            style={{
              backgroundColor: colors.primary[50],
              borderLeftWidth: 4,
              borderLeftColor: colors.primary[500],
              marginBottom: spacing.md,
            }}
          >
            <View
              style={{
                padding: spacing.md,
              }}
            >
              <Text
                style={{
                  ...typography.body.small,
                  color: colors.primary[600],
                  fontWeight: '600',
                  marginBottom: spacing.xs,
                }}
              >
                Original Message
              </Text>
              <Text
                style={{
                  ...typography.body.medium,
                  color: colors.semantic.text.primary,
                }}
              >
                {item.text}
              </Text>
              <Text
                style={{
                  ...typography.body.small,
                  color: colors.semantic.text.secondary,
                  marginTop: spacing.xs,
                }}
              >
                {item.senderName} • {formatTimestamp(item.timestamp)}
              </Text>
            </View>
          </View>
        )}
        
        {!isParentMessage && (
          <View
            style={{
              flexDirection: 'row',
              justifyContent: isMyMessage ? 'flex-end' : 'flex-start',
              marginBottom: spacing.xs,
            }}
          >
            <View
              style={{
                maxWidth: '80%',
                backgroundColor: isMyMessage ? colors.primary[500] : colors.semantic.surface.primary,
                borderRadius: spacing.md,
                padding: spacing.md,
                borderWidth: isMyMessage ? 0 : 1,
                borderColor: colors.gray[200],
              }}
            >
              <Text
                style={{
                  ...typography.body.medium,
                  color: isMyMessage ? colors.white : colors.semantic.text.primary,
                  marginBottom: spacing.xs,
                }}
              >
                {item.text}
              </Text>
              
              <Text
                style={{
                  ...typography.body.small,
                  color: isMyMessage ? colors.primary[100] : colors.semantic.text.secondary,
                }}
              >
                {item.senderName} • {formatTimestamp(item.timestamp)}
              </Text>
            </View>
          </View>
        )}
      </View>
    )
  }

  if (!visible || !parentMessage) {
    return null
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: colors.semantic.background.primary,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: spacing.md,
              borderBottomWidth: 1,
              borderBottomColor: colors.gray[200],
            }}
          >
            <Text
              style={{
                ...typography.heading[4],
                color: colors.semantic.text.primary,
                fontWeight: 'bold',
              }}
            >
              Thread
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Text
                style={{
                  ...typography.body.large,
                  color: colors.primary[500],
                  fontWeight: '600',
                }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </View>

          {/* Thread Messages */}
          <View style={{ flex: 1 }}>
            {isLoading ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <ActivityIndicator size="large" color={colors.primary[500]} />
                <Text
                  style={{
                    ...typography.body.medium,
                    color: colors.semantic.text.secondary,
                    marginTop: spacing.md,
                  }}
                >
                  Loading thread...
                </Text>
              </View>
            ) : error ? (
              <View
                style={{
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  padding: spacing.xl,
                }}
              >
                <Text
                  style={{
                    ...typography.body.medium,
                    color: colors.red[500],
                    textAlign: 'center',
                    marginBottom: spacing.md,
                  }}
                >
                  {error}
                </Text>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    backgroundColor: colors.primary[500],
                    borderRadius: spacing.xs,
                  }}
                  onPress={() => {
                    clearError()
                    if (threadId) loadThread(threadId)
                  }}
                >
                  <Text
                    style={{
                      ...typography.body.medium,
                      color: colors.white,
                      fontWeight: '600',
                    }}
                  >
                    Retry
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={threadMessages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingVertical: spacing.md }}
              />
            )}
          </View>

          {/* Reply Input */}
          <View
            style={{
              flexDirection: 'row',
              padding: spacing.md,
              borderTopWidth: 1,
              borderTopColor: colors.gray[200],
              gap: spacing.sm,
            }}
          >
            <TextInput
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                backgroundColor: colors.semantic.surface.primary,
                borderRadius: spacing.md,
                borderWidth: 1,
                borderColor: colors.gray[300],
                ...typography.body.medium,
                color: colors.semantic.text.primary,
                maxHeight: 100,
              }}
              placeholder="Reply to thread..."
              placeholderTextColor={colors.semantic.text.secondary}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              textAlignVertical="center"
            />
            
            <TouchableOpacity
              style={{
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                backgroundColor: replyText.trim() ? colors.primary[500] : colors.gray[300],
                borderRadius: spacing.md,
                justifyContent: 'center',
                minWidth: 60,
              }}
              onPress={handleSendReply}
              disabled={!replyText.trim() || isSending}
            >
              {isSending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text
                  style={{
                    ...typography.body.medium,
                    color: colors.white,
                    fontWeight: '600',
                    textAlign: 'center',
                  }}
                >
                  Send
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}