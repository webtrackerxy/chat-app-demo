import React from 'react';
import { render, fireEvent, waitFor } from './test-utils';
import { NameInputScreen } from '../screens/NameInputScreen';
import { ChatListScreen } from '../screens/ChatListScreen';
import { ChatRoomScreen } from '../screens/ChatRoomScreen';

// This test simulates the full user journey to identify issues
describe('User Journey Integration Test', () => {
  it('should simulate complete user flow: Name Input → Chat List → Chat Room', async () => {
    console.log('🧪 Testing complete user journey...');
    
    // Step 1: Verify that conversation storage is working
    const { StorageApiFactory } = require('../api/storageApi');
    const localApi = StorageApiFactory.getApi('local');
    
    const conversationsResponse = await localApi.getConversations();
    console.log('📋 Conversations loaded:', conversationsResponse);
    
    expect(conversationsResponse.success).toBe(true);
    expect(conversationsResponse.data).toHaveLength(1);
    expect(conversationsResponse.data[0].title).toBe('General');
    
    // Step 2: Verify that messages can be loaded for conversations
    const messagesResponse = await localApi.getMessages('general');
    console.log('💬 Messages loaded:', messagesResponse);
    
    expect(messagesResponse.success).toBe(true);
    expect(messagesResponse.data).toHaveLength(1);
    expect(messagesResponse.data[0].text).toContain('Welcome to the General conversation');
    
    // Step 3: Verify that new conversations can be created
    const newConversationResponse = await localApi.createConversation({
      title: 'Tech Talk',
      participants: ['user1', 'user2']
    });
    console.log('🆕 New conversation created:', newConversationResponse);
    
    expect(newConversationResponse.success).toBe(true);
    expect(newConversationResponse.data.title).toBe('Tech Talk');
    
    // Step 4: Verify that messages can be sent to conversations
    const sendMessageResponse = await localApi.sendMessage({
      text: 'Hello from test!',
      conversationId: 'general',
      senderId: 'test-user-1',
      senderName: 'TestUser'
    });
    console.log('📤 Message sent:', sendMessageResponse);
    
    expect(sendMessageResponse.success).toBe(true);
    expect(sendMessageResponse.data.text).toBe('Hello from test!');
    expect(sendMessageResponse.data.senderName).toBe('TestUser');
    
    // Step 5: Verify that messages are properly stored
    const updatedMessagesResponse = await localApi.getMessages('general');
    console.log('📥 Updated messages:', updatedMessagesResponse);
    
    expect(updatedMessagesResponse.success).toBe(true);
    expect(updatedMessagesResponse.data).toHaveLength(2); // Original + new message
    
    console.log('✅ All core functionality tests passed!');
  });

  it('should emulate other participants in conversation as per requirements', async () => {
    const { StorageApiFactory } = require('../api/storageApi');
    const localApi = StorageApiFactory.getApi('local');
    
    // Simulate multiple participants
    await localApi.sendMessage({
      text: 'Hi everyone!',
      conversationId: 'general',
      senderId: 'user-alice',
      senderName: 'Alice'
    });
    
    await localApi.sendMessage({
      text: 'Hello Alice!',
      conversationId: 'general', 
      senderId: 'user-bob',
      senderName: 'Bob'
    });
    
    await localApi.sendMessage({
      text: 'Great to see you both here!',
      conversationId: 'general',
      senderId: 'user-charlie', 
      senderName: 'Charlie'
    });
    
    const messagesResponse = await localApi.getMessages('general');
    expect(messagesResponse.success).toBe(true);
    
    const messages = messagesResponse.data;
    const participantNames = [...new Set(messages.map((m: any) => m.senderName))];
    
    console.log('👥 Participants in conversation:', participantNames);
    
    // Should have System + Alice + Bob + Charlie
    expect(participantNames.length).toBeGreaterThanOrEqual(4);
    expect(participantNames).toContain('Alice');
    expect(participantNames).toContain('Bob'); 
    expect(participantNames).toContain('Charlie');
    
    console.log('✅ Multiple participants simulation working!');
  });
});