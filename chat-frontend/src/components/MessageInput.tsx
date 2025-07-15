import React, { useRef } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Button } from './Button';
import { FilePicker } from './FilePicker';
import { VoiceRecorder } from './VoiceRecorder';
import { FileAttachment } from '../../../chat-types/src';

interface MessageInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  // Typing indicator props
  onTypingStart?: (userId: string, userName: string) => void;
  onTypingStop?: (userId: string) => void;
  userId?: string;
  userName?: string;
  // File sharing props
  onFileSelected?: (fileData: FileAttachment) => void;
  showFilePicker?: boolean;
  // Voice recording props
  onVoiceRecorded?: (fileData: FileAttachment) => void;
  showVoiceRecorder?: boolean;
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
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canSend = value.trim().length > 0 && !disabled;

  const handleTextChange = (text: string) => {
    onChangeText(text);
    
    // Handle typing indicators if props are provided
    if (onTypingStart && onTypingStop && userId && userName) {
      // Start typing if text is being entered
      if (text.length > 0) {
        onTypingStart(userId, userName);
      }
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set timeout to stop typing after 1 second of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onTypingStop(userId);
      }, 1000);
    }
  };

  const handleSend = () => {
    // Stop typing when sending
    if (onTypingStop && userId) {
      onTypingStop(userId);
    }
    
    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    onSend();
  };

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
        multiline
        maxLength={500}
      />
      <Button
        title="Send"
        onPress={handleSend}
        disabled={!canSend}
        style={styles.sendButton}
        size="medium"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
  },
  attachmentButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    borderRadius: 20,
    minWidth: 80,
  },
});