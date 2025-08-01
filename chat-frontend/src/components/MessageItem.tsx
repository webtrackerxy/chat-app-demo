import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { Message } from '@chat-types'
import { FileMessage } from './FileMessage'
import { useTheme } from '@theme'
import { useEncryption } from '@hooks/useEncryption'

interface MessageItemProps {
  message: Message
  isMyMessage: boolean
  onDelete?: () => void
  showDeleteButton?: boolean
  // New props for enhanced features
  onReaction?: (emoji: string) => void
  onMarkAsRead?: () => void
  currentUserId?: string
  showReadReceipts?: boolean
  showReactions?: boolean
  // Threading support
  onReply?: (message: Message) => void
  showReplyButton?: boolean
  onReplyIndicatorPress?: (parentMessageId: string) => void
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isMyMessage,
  onDelete,
  showDeleteButton = false,
  onReaction,
  onMarkAsRead,
  currentUserId,
  showReadReceipts = true,
  showReactions = true,
  onReply,
  showReplyButton = false,
  onReplyIndicatorPress,
}) => {
  const { decryptMessage } = useEncryption()
  const [decryptedText, setDecryptedText] = useState<string>(message.text)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptionError, setDecryptionError] = useState<string | null>(null)

  // Check if message text looks like encrypted JSON
  const isEncryptedMessage = (text: string): boolean => {
    try {
      const parsed = JSON.parse(text)
      return parsed && typeof parsed === 'object' && 
             ('encryptedText' in parsed || 'ciphertext' in parsed) &&
             ('iv' in parsed || 'nonce' in parsed) &&
             ('tag' in parsed) &&
             ('keyId' in parsed)
    } catch {
      return false
    }
  }

  // Decrypt message if needed
  useEffect(() => {
    const decryptIfNeeded = async () => {
      if (!isEncryptedMessage(message.text)) {
        setDecryptedText(message.text)
        return
      }

      console.log('🔓 MessageItem: Decrypting message:', message.id)
      setIsDecrypting(true)
      setDecryptionError(null)

      try {
        const conversationId = 'general' // TODO: Get from props or context
        const userId = currentUserId || 'user_mike' // TODO: Get from props or context
        
        const plaintext = await decryptMessage(message.text, conversationId, userId)
        setDecryptedText(plaintext)
        console.log('✅ MessageItem: Message decrypted successfully')
      } catch (error) {
        console.error('❌ MessageItem: Decryption failed:', error)
        const errorMessage = error instanceof Error ? error.message : 'Decryption failed'
        setDecryptionError(errorMessage)
        
        // Provide user-friendly error messages and retry for initialization errors
        if (errorMessage.includes('Initialize ratchet first') || errorMessage.includes('Ratchet state not found')) {
          setDecryptedText('[Setting up encryption...]')
          // Retry after 2 seconds for initialization issues
          setTimeout(() => {
            setDecryptionError(null)
            setIsDecrypting(true)
          }, 2000)
        } else if (errorMessage.includes('Encryption keys not available')) {
          setDecryptedText('[Waiting for encryption keys...]')
          // Retry after 3 seconds for key issues
          setTimeout(() => {
            setDecryptionError(null)
            setIsDecrypting(true)
          }, 3000)
        } else if (errorMessage.includes('Key generation already in progress')) {
          setDecryptedText('[Initializing security...]')
          // Retry after 5 seconds for key generation
          setTimeout(() => {
            setDecryptionError(null)
            setIsDecrypting(true)
          }, 5000)
        } else {
          setDecryptedText('[Message encrypted]')
        }
      } finally {
        setIsDecrypting(false)
      }
    }

    decryptIfNeeded()
  }, [message.text, message.id, currentUserId, decryptMessage])
  // Helper function to get read receipts text
  const getReadReceiptsText = () => {
    if (!message.readBy || message.readBy.length === 0) return ''

    const readByOthers = message.readBy.filter((receipt) => receipt.userId !== currentUserId)

    if (readByOthers.length === 0) return ''

    if (readByOthers.length === 1) {
      return `Read by ${readByOthers[0].userName}`
    } else if (readByOthers.length === 2) {
      return `Read by ${readByOthers[0].userName} and ${readByOthers[1].userName}`
    } else {
      return `Read by ${readByOthers[0].userName} and ${readByOthers.length - 1} others`
    }
  }

  // Helper function to group reactions by emoji
  const getGroupedReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return new Map()

    const grouped = new Map()
    message.reactions.forEach((reaction) => {
      const existing = grouped.get(reaction.emoji) || []
      grouped.set(reaction.emoji, [...existing, reaction])
    })

    return grouped
  }

  // Get the current user's reaction emoji (if any)
  const getCurrentUserReactionEmoji = () => {
    if (!message.reactions || !currentUserId) return null
    const userReaction = message.reactions.find((r) => r.userId === currentUserId)
    return userReaction?.emoji || null
  }

  // Common emoji reactions
  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡']

  // Auto-mark as read when message is displayed
  React.useEffect(() => {
    if (onMarkAsRead && !isMyMessage) {
      // Mark as read after a short delay
      const timer = setTimeout(() => {
        onMarkAsRead()
      }, 1000)

      return () => clearTimeout(timer)
    }
  }, [message.id, onMarkAsRead, isMyMessage])
  const groupedReactions = getGroupedReactions()
  const readReceiptsText = getReadReceiptsText()
  const currentUserReactionEmoji = getCurrentUserReactionEmoji()

  const { colors, spacing, borderRadius, typography } = useTheme()
  const styles = createStyles(colors, spacing, borderRadius, typography)

  return (
    <View style={styles.messageContainer}>
      <TouchableOpacity
        style={[styles.container, isMyMessage ? styles.ownMessage : styles.otherMessage]}
        onLongPress={showDeleteButton && onDelete ? onDelete : undefined}
        delayLongPress={500}
        activeOpacity={showDeleteButton ? 0.7 : 1}
      >
        <View style={styles.content}>
          {/* Reply indicator */}
          {message.replyToId && (
            <TouchableOpacity
              style={styles.replyIndicator}
              onPress={() => onReplyIndicatorPress?.(message.replyToId!)}
              activeOpacity={0.7}
            >
              <Text style={styles.replyText}>↩️ Replying to a message</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.senderName}>{message.senderName}</Text>
          {/* Render file content or text message */}
          {message.file ? (
            <FileMessage file={message.file} isMyMessage={isMyMessage} />
          ) : (
            <Text
              style={[
                styles.messageText,
                isMyMessage ? styles.ownMessageText : styles.otherMessageText,
                isDecrypting && { opacity: 0.6 },
                decryptionError && { color: '#ff6b6b' }
              ]}
            >
              {isDecrypting ? 'Decrypting...' : decryptedText}
            </Text>
          )}
          <Text style={styles.messageTime}>{new Date(message.timestamp).toLocaleTimeString()}</Text>
        </View>

        {showReplyButton && onReply && !isMyMessage && (
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => onReply(message)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.replyButtonText}>↩️</Text>
          </TouchableOpacity>
        )}

        {showDeleteButton && onDelete && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Message Reactions */}
      {showReactions && (
        <View
          style={[
            styles.reactionsContainer,
            isMyMessage ? styles.reactionsRight : styles.reactionsLeft,
          ]}
        >
          {/* Existing reactions */}
          {groupedReactions.size > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.existingReactions}
            >
              {Array.from(groupedReactions.entries()).map(([emoji, reactions]) => {
                const hasCurrentUser = reactions.some((r: any) => r.userId === currentUserId)
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.reactionBubble, hasCurrentUser && styles.reactionBubbleActive]}
                    onPress={() => onReaction?.(emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    <Text style={styles.reactionCount}>{reactions.length}</Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}

          {/* Quick reaction buttons */}
          {onReaction && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.quickReactions}
            >
              {commonEmojis.map((emoji) => {
                const isSelected = currentUserReactionEmoji === emoji
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.quickReactionButton,
                      isSelected && styles.quickReactionButtonSelected,
                    ]}
                    onPress={() => onReaction(emoji)}
                  >
                    <Text
                      style={[
                        styles.quickReactionEmoji,
                        isSelected && styles.quickReactionEmojiSelected,
                      ]}
                    >
                      {emoji}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Read Receipts */}
      {showReadReceipts && readReceiptsText && isMyMessage && (
        <Text style={styles.readReceipts}>{readReceiptsText}</Text>
      )}
    </View>
  )
}

const createStyles = (colors: any, spacing: any, borderRadius: any, typography: any) =>
  StyleSheet.create({
    messageContainer: {
      marginBottom: spacing.lg,
    },
    container: {
      padding: spacing.md,
      borderRadius: borderRadius.md,
      maxWidth: '80%',
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    content: {
      flex: 1,
    },
    ownMessage: {
      alignSelf: 'flex-end',
      backgroundColor: colors.primary[500],
      marginLeft: '20%',
    },
    otherMessage: {
      alignSelf: 'flex-start',
      backgroundColor: colors.success[500],
      marginRight: '20%',
    },
    senderName: {
      ...typography.body.xs.bold,
      marginBottom: spacing.xs,
      color: colors.accent.yellow,
    },
    messageText: {
      ...typography.body.m.regular,
      marginBottom: spacing.xs,
    },
    ownMessageText: {
      color: colors.base.white,
    },
    otherMessageText: {
      color: colors.base.white,
    },
    messageTime: {
      ...typography.body.xs.regular,
      color: colors.base.white,
      textAlign: 'right',
      opacity: 0.8,
    },
    deleteButton: {
      marginLeft: spacing.sm,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    deleteButtonText: {
      ...typography.body.s.regular,
    },
    // Reaction styles with design tokens
    reactionsContainer: {
      marginTop: spacing.xs,
      maxWidth: '80%',
      maxHeight: 80,
      overflow: 'hidden',
    },
    reactionsRight: {
      alignSelf: 'flex-end',
      marginLeft: '20%',
    },
    reactionsLeft: {
      alignSelf: 'flex-start',
      marginRight: '20%',
    },
    existingReactions: {
      marginBottom: spacing.xs,
      maxHeight: 32,
    },
    reactionBubble: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.semantic.surface.secondary,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
      marginRight: spacing.xs,
      borderWidth: 1,
      borderColor: colors.semantic.border.secondary,
      minHeight: 24,
    },
    reactionBubbleActive: {
      backgroundColor: colors.semantic.interactive.primary,
      borderColor: colors.semantic.interactive.primaryHover,
    },
    reactionEmoji: {
      fontSize: 14,
      lineHeight: 16,
      marginRight: spacing.xs,
    },
    reactionCount: {
      ...typography.body.xs.bold,
      color: colors.semantic.text.primary,
    },
    quickReactions: {
      opacity: 0.7,
      height: 32,
      maxHeight: 32,
      flex: 0,
    },
    quickReactionButton: {
      width: 32,
      height: 32,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.xs,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.semantic.surface.tertiary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    quickReactionButtonSelected: {
      backgroundColor: colors.semantic.interactive.primary,
      borderColor: colors.semantic.interactive.primaryHover,
    },
    quickReactionEmoji: {
      fontSize: 18,
      lineHeight: 20,
    },
    quickReactionEmojiSelected: {
      // Emoji remains the same, just the background changes
    },
    // Read receipts with design tokens
    readReceipts: {
      ...typography.body.xs.regular,
      color: colors.semantic.text.tertiary,
      textAlign: 'right',
      marginTop: spacing.xs,
      marginRight: spacing.md,
      fontStyle: 'italic',
    },
    // Reply button styles
    replyButton: {
      marginLeft: spacing.sm,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.3)',
    },
    replyButtonText: {
      ...typography.body.s.regular,
    },
    // Reply indicator styles
    replyIndicator: {
      marginBottom: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs / 2,
      backgroundColor: 'rgba(255,255,255,0.1)',
      borderRadius: borderRadius.sm,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent.blue,
    },
    replyText: {
      ...typography.body.xs.regular,
      color: colors.base.white,
      opacity: 0.8,
      fontStyle: 'italic',
    },
  })
