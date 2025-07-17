import React, { useEffect, useState } from 'react'
import { View, FlatList, StyleSheet, RefreshControl, SafeAreaView, Text, TouchableOpacity } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { useChat } from '@hooks/useChat'
import { usePrivateMessaging } from '@hooks/usePrivateMessaging'
import { Conversation } from '@chat-types'
import { Header, EmptyState, Button, SearchModal } from '@components'
import { UserSelector } from '@components/UserSelector'
import { useTheme } from '@theme'
import { ConversationItem } from '@components/ConversationItem'
import { ActionModal } from '@components/ActionModal'
import { RootStackParamList } from '@types'

type ChatListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChatList'>
type ChatListScreenRouteProp = RouteProp<RootStackParamList, 'ChatList'>

export const ChatListScreen: React.FC = () => {
  console.log('ChatListScreen - component initializing')
  
  let navigation, route
  
  try {
    navigation = useNavigation<ChatListScreenNavigationProp>()
    route = useRoute<ChatListScreenRouteProp>()
  } catch (error) {
    console.error('ChatListScreen - Navigation context error:', error)
    return <View><Text>Navigation error</Text></View>
  }
  
  console.log('ChatListScreen - navigation:', navigation)
  console.log('ChatListScreen - route:', route)
  
  if (!route || !route.params) {
    console.error('ChatListScreen - Route params not available')
    return <View><Text>Route error</Text></View>
  }
  
  const { userName } = route.params
  const { colors, spacing } = useTheme()
  const styles = createStyles(colors, spacing)
  const {
    conversations,
    isLoading,
    error,
    storageMode,
    loadConversations,
    createConversation,
    deleteConversation,
    updateConversation,
    setCurrentConversation,
  } = useChat()

  const {
    createDirectConversation,
  } = usePrivateMessaging()

  const [refreshing, setRefreshing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showUserSelector, setShowUserSelector] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [newConversationTitle, setNewConversationTitle] = useState('')
  const [editTitle, setEditTitle] = useState('')

  // Generate user ID for private messaging
  const userId = userName ? `user_${userName.toLowerCase().replace(/\s+/g, '_')}` : undefined

  const handleMessageSelect = (message: any) => {
    setShowSearchModal(false)
    // Navigate to the conversation containing this message
    if (message.conversationId) {
      navigation.navigate('ChatRoom', {
        userName,
        conversationId: message.conversationId,
      })
    }
  }

  const handleConversationSelect = (conversation: any) => {
    setShowSearchModal(false)
    navigation.navigate('ChatRoom', {
      userName,
      conversationId: conversation.id,
    })
  }
  
  // Debug logging
  console.log('ChatListScreen - userName:', userName, 'userId:', userId, 'showUserSelector:', showUserSelector)

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  const onRefresh = async () => {
    setRefreshing(true)
    await loadConversations()
    setRefreshing(false)
  }

  const handleCreateConversation = async () => {
    if (newConversationTitle.trim()) {
      await createConversation({
        title: newConversationTitle.trim(),
        participants: [userName], // Add current user as participant
      })
      setNewConversationTitle('')
      setShowCreateModal(false)
      loadConversations() // Refresh the list
    }
  }

  const handleUpdateConversation = async () => {
    if (selectedConversation && editTitle.trim()) {
      await updateConversation(selectedConversation.id, editTitle.trim())
      setEditTitle('')
      setShowEditModal(false)
      setSelectedConversation(null)
      loadConversations() // Refresh the list
    }
  }

  const handleDeleteConversation = async (conversationId: string) => {
    await deleteConversation(conversationId)
    loadConversations() // Refresh the list
  }

  const handleConversationPress = (conversation: Conversation) => {
    setCurrentConversation(conversation)
    navigation.navigate('ChatRoom', {
      userName,
      conversationId: conversation.id,
    })
  }

  const handleEditPress = (conversation: Conversation) => {
    setSelectedConversation(conversation)
    setEditTitle(conversation.title)
    setShowEditModal(true)
  }

  const handleStartPrivateChat = () => {
    setShowUserSelector(true)
  }

  const handleUserSelect = async (selectedUser: any) => {
    if (!userId) {
      console.error('User ID is not available')
      return
    }
    
    try {
      const conversation = await createDirectConversation(userId, selectedUser.id)
      setShowUserSelector(false)
      
      // Navigate to the new conversation
      if (conversation) {
        navigation.navigate('ChatRoom', {
          userName,
          conversationId: conversation.id,
        })
      }
    } catch (error) {
      console.error('Failed to create direct conversation:', error)
    }
  }

  const renderConversation = ({ item }: { item: Conversation }) => (
    <ConversationItem
      conversation={item}
      onPress={() => handleConversationPress(item)}
      onEdit={storageMode === 'local' ? () => handleEditPress(item) : undefined}
      onDelete={storageMode === 'local' ? () => handleDeleteConversation(item.id) : undefined}
    />
  )

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Header title='Error' onBack={() => navigation.goBack()} />
          <EmptyState icon='⚠️' title='Something went wrong' subtitle={error} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header
          title='Conversations'
          subtitle={`Hello, ${userName}!`}
          onBack={() => navigation.goBack()}
          rightComponent={
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => setShowSearchModal(true)}
              >
                <Text style={styles.searchButtonText}>🔍</Text>
              </TouchableOpacity>
              {storageMode === 'local' ? (
                <Button
                  title='+ Add'
                  onPress={() => setShowCreateModal(true)}
                  variant='text'
                  size='small'
                />
              ) : storageMode === 'backend' && userId ? (
                <Button
                  title='💬 Private Chat'
                  onPress={handleStartPrivateChat}
                  variant='text'
                  size='small'
                />
              ) : null}
            </View>
          }
        />

        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          style={styles.conversationsList}
          contentContainerStyle={styles.conversationsContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor='#007AFF'
              colors={['#007AFF']}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon='💬'
              title='No conversations yet'
              subtitle={
                storageMode === 'local'
                  ? 'Create your first conversation to get started!'
                  : 'Conversations will appear here when available.'
              }
            />
          }
        />
      </View>

      <ActionModal
        visible={showCreateModal}
        title='Create New Conversation'
        placeholder='Enter conversation title'
        value={newConversationTitle}
        onChangeText={setNewConversationTitle}
        onConfirm={handleCreateConversation}
        onCancel={() => {
          setShowCreateModal(false)
          setNewConversationTitle('')
        }}
        confirmText='Create'
      />

      <ActionModal
        visible={showEditModal}
        title='Edit Conversation'
        placeholder='Enter new title'
        value={editTitle}
        onChangeText={setEditTitle}
        onConfirm={handleUpdateConversation}
        onCancel={() => {
          setShowEditModal(false)
          setEditTitle('')
          setSelectedConversation(null)
        }}
        confirmText='Update'
      />

      {userId && showUserSelector && (
        <UserSelector
          visible={showUserSelector}
          currentUserId={userId}
          onUserSelect={handleUserSelect}
          onClose={() => setShowUserSelector(false)}
        />
      )}

      {userId && showSearchModal && (
        <SearchModal
          visible={true}
          onClose={() => setShowSearchModal(false)}
          currentUserId={userId}
          onMessageSelect={handleMessageSelect}
          onConversationSelect={handleConversationSelect}
        />
      )}
    </SafeAreaView>
  )
}

const createStyles = (colors: any, spacing: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.semantic.background.primary,
    },
    container: {
      flex: 1,
      backgroundColor: colors.semantic.background.primary,
    },
    conversationsList: {
      flex: 1,
    },
    conversationsContainer: {
      padding: spacing.lg,
    },
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    searchButton: {
      padding: spacing.xs,
      borderRadius: spacing.sm,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    searchButtonText: {
      fontSize: 18,
    },
  })
