import React, { useRef } from 'react'
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Button } from './Button'
import { FilePicker } from './FilePicker'
import { VoiceRecorder } from './VoiceRecorder'
import { FileAttachment } from '@chat-types'
import { useTheme } from '@theme'

interface MessageInputProps {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  // Typing indicator props
  onTypingStart?: (userId: string, userName: string) => void
  onTypingStop?: (userId: string) => void
  userId?: string
  userName?: string
  // File sharing props
  onFileSelected?: (fileData: FileAttachment) => void
  showFilePicker?: boolean
  // Voice recording props
  onVoiceRecorded?: (fileData: FileAttachment) => void
  showVoiceRecorder?: boolean
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChangeText,
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  onTypingStart,
  onTypingStop,
  userId,
  userName,
  onFileSelected,
  showFilePicker = false,
  onVoiceRecorded,
  showVoiceRecorder = false,
}) => {
  const { colors, spacing, borderRadius, typography } = useTheme()
  const styles = createStyles(colors, spacing, borderRadius, typography)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const canSend = value.trim().length > 0 && !disabled

  const handleTextChange = (text: string) => {
    onChangeText(text)

    // Handle typing indicators if props are provided
    if (onTypingStart && onTypingStop && userId && userName) {
      // Start typing if text is being entered
      if (text.length > 0) {
        onTypingStart(userId, userName)
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      // Set timeout to stop typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop(userId)
      }, 1000)
    }
  }

  const handleSend = () => {
    // Stop typing when sending
    if (onTypingStop && userId) {
      onTypingStop(userId)
    }

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = null
    }

    onSend()
  }

  return (
    <View style={styles.container}>
      <View style={styles.attachmentButtons}>
        {showFilePicker && onFileSelected && (
          <FilePicker
            onFileSelected={onFileSelected}
            disabled={disabled}
            onError={(error) => console.error('File picker error:', error)}
          />
        )}
        {showVoiceRecorder && onVoiceRecorded && (
          <VoiceRecorder
            onVoiceRecorded={onVoiceRecorded}
            disabled={disabled}
            onError={(error) => console.error('Voice recorder error:', error)}
          />
        )}
      </View>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        placeholderTextColor={colors.semantic.text.tertiary}
        multiline
        maxLength={500}
      />
      <Button
        title='Send'
        onPress={handleSend}
        disabled={!canSend}
        style={styles.sendButton}
        size='medium'
      />
    </View>
  )
}

const createStyles = (colors: any, spacing: any, borderRadius: any, typography: any) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      padding: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.semantic.border.secondary,
      alignItems: 'flex-end',
      backgroundColor: colors.semantic.surface.primary,
    },
    attachmentButtons: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.semantic.border.primary,
      backgroundColor: colors.semantic.background.primary,
      borderRadius: borderRadius.xl,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      marginRight: spacing.sm,
      maxHeight: 100,
      ...typography.body.m.regular,
      color: colors.semantic.text.primary,
    },
    sendButton: {
      borderRadius: borderRadius.xl,
      minWidth: 80,
    },
  })
