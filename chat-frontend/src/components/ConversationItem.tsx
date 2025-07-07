import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Conversation } from '../../../chat-types/src';

interface ConversationItemProps {
  conversation: Conversation;
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  onPress,
  onEdit,
  onDelete,
}) => {
  const handleDelete = () => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete "${conversation.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: onDelete
        }
      ]
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{conversation.title}</Text>
          <Text style={styles.date}>
            {formatDate(conversation.updatedAt)}
          </Text>
        </View>
        
        {conversation.lastMessage && (
          <Text style={styles.lastMessage} numberOfLines={2}>
            {conversation.lastMessage.senderName}: {conversation.lastMessage.text}
          </Text>
        )}
        
        <View style={styles.footer}>
          <Text style={styles.participants}>
            {conversation.participants.length} participant{conversation.participants.length !== 1 ? 's' : ''}
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
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
    elevation: 3,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  date: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  participants: {
    fontSize: 12,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    marginLeft: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  actionButtonText: {
    fontSize: 16,
  },
});