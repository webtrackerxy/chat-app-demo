import React, { useEffect, useState } from 'react'
import { View, FlatList, StyleSheet, RefreshControl, SafeAreaView } from 'react-native'
import { useNavigation, useRoute } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { RouteProp } from '@react-navigation/native'
import { useChat } from '@hooks/useChat'
import { Conversation } from '@chat-types'
import { Header, EmptyState, Button } from '@components'
import { ConversationItem } from '@components/ConversationItem'
import { ActionModal } from '@components/ActionModal'
import { RootStackParamList } from '@types'

type ChatListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ChatList'>
type ChatListScreenRouteProp = RouteProp<RootStackParamList, 'ChatList'>

export const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<ChatListScreenNavigationProp>()
  const route = useRoute<ChatListScreenRouteProp>()
  const { userName } = route.params
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

  const [refreshing, setRefreshing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [newConversationTitle, setNewConversationTitle] = useState('')
  const [editTitle, setEditTitle] = useState('')

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
            storageMode === 'local' ? (
              <Button
                title='+ Add'
                onPress={() => setShowCreateModal(true)}
                variant='text'
                size='small'
              />
            ) : undefined
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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
  },
  conversationsList: {
    flex: 1,
  },
  conversationsContainer: {
    padding: 16,
  },
})
