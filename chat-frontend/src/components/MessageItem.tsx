import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Message } from '../../../chat-types/src';

interface MessageItemProps {
  message: Message;
  isMyMessage: boolean;
  onDelete?: () => void;
  showDeleteButton?: boolean;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isMyMessage,
  onDelete,
  showDeleteButton = false,
}) => {
  return (
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
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
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
});