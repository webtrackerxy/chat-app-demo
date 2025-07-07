import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Alert, RefreshControl, SafeAreaView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RouteProp } from '@react-navigation/native';
import { useChat } from '../hooks/useChat';
import { useMessagePolling } from '../hooks/useMessagePolling';
import { Message } from '../../../chat-types/src';
import { Header, MessageItem, MessageInput, EmptyState } from '../components';
import { RootStackParamList } from '../../App';

type ChatRoomScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChatRoom'>;
type ChatRoomScreenRouteProp = RouteProp<RootStackParamList, 'ChatRoom'>;

export const ChatRoomScreen: React.FC = () => {
  const navigation = useNavigation<ChatRoomScreenNavigationProp>();
  const route = useRoute<ChatRoomScreenRouteProp>();
  const { userName, conversationId } = route.params;
  const { currentConversation, isLoading, error, storageMode, sendMessage, deleteMessage, loadMessages } = useChat();
  const [inputText, setInputText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Set up message polling for real-time updates
  useMessagePolling({
    storageMode,
    loadMessages,
    conversationId,
    isEnabled: !!conversationId
  });

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId && currentConversation?.id === conversationId) {
      loadMessages(conversationId);
    }
  }, [conversationId, currentConversation?.id, loadMessages]);

  // Get messages from current conversation
  const messages = currentConversation?.messages || [];

  const handleSendMessage = async () => {
    if (inputText.trim()) {
      await sendMessage(inputText.trim(), conversationId);
      setInputText('');
    }
  };

  const handleDeleteMessage = (message: Message) => {
    Alert.alert(
      'Delete Message',
      `Delete "${message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteMessage(message.id);
            // Message deletion is handled automatically by the store
          }
        }
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    // Reload messages for the current conversation
    await loadMessages(conversationId);
    setRefreshing(false);
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.senderName === userName;
    
    return (
      <MessageItem
        message={item}
        isMyMessage={isMyMessage}
        onDelete={() => handleDeleteMessage(item)}
        showDeleteButton={isMyMessage}
      />
    );
  };

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Header title="Error" onBack={() => navigation.goBack()} />
          <EmptyState
            icon="⚠️"
            title="Something went wrong"
            subtitle={error}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <Header
        title={currentConversation?.title || "Chat Room"}
        subtitle={`${userName} - Long press your messages to delete`}
        onBack={() => navigation.goBack()}
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
            tintColor="#007AFF"
            colors={['#007AFF']}
          />
        }
      />
      
      <MessageInput
        value={inputText}
        onChangeText={setInputText}
        onSend={handleSendMessage}
        disabled={isLoading}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
});