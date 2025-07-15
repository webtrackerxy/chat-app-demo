import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Message } from '../../../chat-types/src';

interface MessageItemProps {
  message: Message;
  isMyMessage: boolean;
  onDelete?: () => void;
  showDeleteButton?: boolean;
  // New props for enhanced features
  onReaction?: (emoji: string) => void;
  onMarkAsRead?: () => void;
  currentUserId?: string;
  showReadReceipts?: boolean;
  showReactions?: boolean;
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
}) => {
  // Helper function to get read receipts text
  const getReadReceiptsText = () => {
    if (!message.readBy || message.readBy.length === 0) return '';
    
    const readByOthers = message.readBy.filter(receipt => receipt.userId !== currentUserId);
    
    if (readByOthers.length === 0) return '';
    
    if (readByOthers.length === 1) {
      return `Read by ${readByOthers[0].userName}`;
    } else if (readByOthers.length === 2) {
      return `Read by ${readByOthers[0].userName} and ${readByOthers[1].userName}`;
    } else {
      return `Read by ${readByOthers[0].userName} and ${readByOthers.length - 1} others`;
    }
  };
  
  // Helper function to group reactions by emoji
  const getGroupedReactions = () => {
    if (!message.reactions || message.reactions.length === 0) return new Map();
    
    const grouped = new Map();
    message.reactions.forEach(reaction => {
      const existing = grouped.get(reaction.emoji) || [];
      grouped.set(reaction.emoji, [...existing, reaction]);
    });
    
    return grouped;
  };
  
  // Get the current user's reaction emoji (if any)
  const getCurrentUserReactionEmoji = () => {
    if (!message.reactions || !currentUserId) return null;
    const userReaction = message.reactions.find(r => r.userId === currentUserId);
    return userReaction?.emoji || null;
  };
  
  // Common emoji reactions
  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡'];
  
  // Auto-mark as read when message is displayed
  React.useEffect(() => {
    if (onMarkAsRead && !isMyMessage) {
      // Mark as read after a short delay
      const timer = setTimeout(() => {
        onMarkAsRead();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [message.id, onMarkAsRead, isMyMessage]);
  const groupedReactions = getGroupedReactions();
  const readReceiptsText = getReadReceiptsText();
  const currentUserReactionEmoji = getCurrentUserReactionEmoji();
  
  return (
    <View style={styles.messageContainer}>
      <TouchableOpacity
        style={[
          styles.container,
          isMyMessage ? styles.ownMessage : styles.otherMessage,
        ]}
        onLongPress={showDeleteButton && onDelete ? onDelete : undefined}
        delayLongPress={500}
        activeOpacity={showDeleteButton ? 0.7 : 1}
      >
        <View style={styles.content}>
          <Text style={styles.senderName}>{message.senderName}</Text>
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {message.text}
          </Text>
          <Text style={styles.messageTime}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </Text>
        </View>
        
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
        <View style={[styles.reactionsContainer, isMyMessage ? styles.reactionsRight : styles.reactionsLeft]}>
          {/* Existing reactions */}
          {groupedReactions.size > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.existingReactions}>
              {Array.from(groupedReactions.entries()).map(([emoji, reactions]) => {
                const hasCurrentUser = reactions.some((r: any) => r.userId === currentUserId);
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.reactionBubble,
                      hasCurrentUser && styles.reactionBubbleActive
                    ]}
                    onPress={() => onReaction?.(emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    <Text style={styles.reactionCount}>{reactions.length}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          
          {/* Quick reaction buttons */}
          {onReaction && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickReactions}>
              {commonEmojis.map(emoji => {
                const isSelected = currentUserReactionEmoji === emoji;
                return (
                  <TouchableOpacity
                    key={emoji}
                    style={[
                      styles.quickReactionButton,
                      isSelected && styles.quickReactionButtonSelected
                    ]}
                    onPress={() => onReaction(emoji)}
                  >
                    <Text style={[
                      styles.quickReactionEmoji,
                      isSelected && styles.quickReactionEmojiSelected
                    ]}>
                      {emoji}
                    </Text>
                  </TouchableOpacity>
                );
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
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 16,
  },
  container: {
    padding: 12,
    borderRadius: 8,
    maxWidth: '80%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  content: {
    flex: 1,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    marginLeft: '20%',
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#4CAF50',
    marginRight: '20%',
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    color: '#FFD700',
  },
  messageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 10,
    color: '#fff',
    textAlign: 'right',
  },
  deleteButton: {
    marginLeft: 8,
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
    fontSize: 14,
  },
  // New styles for reactions
  reactionsContainer: {
    marginTop: 4,
    maxWidth: '80%',
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
    marginBottom: 4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  reactionBubbleActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  reactionEmoji: {
    fontSize: 14,
    marginRight: 4,
  },
  reactionCount: {
    fontSize: 12,
    color: '#333',
    fontWeight: '600',
  },
  quickReactions: {
    opacity: 0.7,
  },
  quickReactionButton: {
    padding: 6,
    marginRight: 4,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  quickReactionButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#0051CC',
  },
  quickReactionEmoji: {
    fontSize: 16,
  },
  quickReactionEmojiSelected: {
    // Emoji remains the same, just the background changes
  },
  // New styles for read receipts
  readReceipts: {
    fontSize: 10,
    color: '#666',
    textAlign: 'right',
    marginTop: 4,
    marginRight: 12,
    fontStyle: 'italic',
  },
});