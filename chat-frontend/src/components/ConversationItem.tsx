import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { Conversation } from '@chat-types'
import { useTheme } from '@theme'

interface ConversationItemProps {
  conversation: Conversation
  onPress: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onPress,
  onEdit,
  onDelete,
}) => {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme()
  const styles = createStyles(colors, spacing, borderRadius, typography, shadows)
  const handleDelete = () => {
    Alert.alert('Delete Conversation', `Are you sure you want to delete "${conversation.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: onDelete,
      },
    ])
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{conversation.title}</Text>
          <Text style={styles.date}>{formatDate(conversation.updatedAt)}</Text>
        </View>

        {conversation.lastMessage && (
          <Text style={styles.lastMessage} numberOfLines={2}>
            {conversation.lastMessage.senderName}: {conversation.lastMessage.text}
          </Text>
        )}

        <View style={styles.footer}>
          <Text style={styles.participants}>
            {conversation.participants.length} participant
            {conversation.participants.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {(onEdit || onDelete) && (
        <View style={styles.actions}>
          {onEdit && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={onEdit}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.actionButtonText}>✏️</Text>
            </TouchableOpacity>
          )}
          {onDelete && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleDelete}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.actionButtonText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

const createStyles = (colors: any, spacing: any, borderRadius: any, typography: any, shadows: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.semantic.surface.primary,
      borderRadius: borderRadius.md,
      padding: spacing.lg,
      marginBottom: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      ...shadows.sm,
      borderWidth: 1,
      borderColor: colors.semantic.border.secondary,
    },
    content: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    title: {
      ...typography.heading[5],
      color: colors.semantic.text.primary,
      flex: 1,
    },
    date: {
      ...typography.body.xs.regular,
      color: colors.semantic.text.secondary,
      marginLeft: spacing.sm,
    },
    lastMessage: {
      ...typography.body.m.regular,
      color: colors.semantic.text.secondary,
      marginBottom: spacing.sm,
      lineHeight: 20,
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    participants: {
      ...typography.body.xs.regular,
      color: colors.semantic.text.tertiary,
    },
    actions: {
      flexDirection: 'row',
      marginLeft: spacing.md,
    },
    actionButton: {
      width: 32,
      height: 32,
      borderRadius: borderRadius.lg,
      backgroundColor: colors.semantic.surface.tertiary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: spacing.sm,
      borderWidth: 1,
      borderColor: colors.semantic.border.secondary,
    },
    actionButtonText: {
      fontSize: 16,
    },
  })
