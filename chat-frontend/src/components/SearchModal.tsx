import React, { useState } from 'react'
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  ActivityIndicator,
  Modal 
} from 'react-native'
import { useTheme } from '@theme'
import { useMessageSearch } from '@hooks/useMessageSearch'
import { MessageSearchResult, Conversation } from '@chat-types'

interface SearchModalProps {
  visible: boolean
  onClose: () => void
  currentUserId: string
  onMessageSelect?: (message: MessageSearchResult) => void
  onConversationSelect?: (conversation: Conversation) => void
}

export const SearchModal: React.FC<SearchModalProps> = (props) => {
  // Early return if props are completely invalid
  if (!props) {
    return null
  }

  const visible = props.visible ?? false
  const onClose = props.onClose
  const currentUserId = props.currentUserId ?? ''
  const onMessageSelect = props.onMessageSelect
  const onConversationSelect = props.onConversationSelect
  
  // Safe state management with error handling
  let query, setQuery, searchType, setSearchType
  try {
    [query, setQuery] = useState('')
    [searchType, setSearchType] = useState<'messages' | 'conversations'>('messages')
  } catch (error) {
    console.error('React hooks not available in SearchModal:', error)
    return null
  }
  
  // Safe theme access with fallback
  let themeResult
  try {
    themeResult = useTheme()
  } catch (error) {
    console.warn('Theme context not available in SearchModal:', error)
    themeResult = null
  }
  
  const { colors, spacing, typography } = themeResult || {
    colors: {
      semantic: {
        background: { primary: '#ffffff' },
        surface: { primary: '#f5f5f5' },
        text: { primary: '#000000', secondary: '#666666' },
        border: { secondary: '#e0e0e0' }
      },
      primary: { 500: '#007AFF' },
      gray: { 100: '#f5f5f5', 200: '#e0e0e0', 300: '#cccccc' },
      white: '#ffffff',
      red: { 500: '#ff0000' }
    },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
    typography: {
      heading: { 4: { fontSize: 18, fontWeight: 'bold' } },
      body: { 
        large: { fontSize: 16 },
        medium: { fontSize: 14 },
        small: { fontSize: 12 }
      }
    }
  }
  
  // Safe search hook access with fallback
  let searchResult
  try {
    searchResult = useMessageSearch()
  } catch (error) {
    console.warn('Search hook not available in SearchModal:', error)
    searchResult = null
  }
  
  const {
    messageResults,
    conversationResults,
    isLoading,
    error,
    searchMessages,
    searchConversations,
    clearResults,
    lastQuery,
    resultCount
  } = searchResult || {
    messageResults: [],
    conversationResults: [],
    isLoading: false,
    error: null,
    searchMessages: () => Promise.resolve(),
    searchConversations: () => Promise.resolve(),
    clearResults: () => {},
    lastQuery: null,
    resultCount: 0
  }

  const handleSearch = () => {
    if (!query.trim()) return
    
    if (searchType === 'messages') {
      searchMessages(query.trim())
    } else {
      searchConversations(query.trim(), currentUserId)
    }
  }

  const handleClose = () => {
    setQuery('')
    clearResults()
    if (onClose) {
      onClose()
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const renderMessageResult = ({ item }: { item: MessageSearchResult }) => (
    <TouchableOpacity
      style={{
        padding: spacing.md,
        backgroundColor: colors.semantic.surface.primary,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[200],
      }}
      onPress={() => {
        if (onMessageSelect) {
          onMessageSelect(item)
        }
        handleClose()
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
        <Text
          style={{
            ...typography.body.medium,
            color: colors.semantic.text.primary,
            fontWeight: '600',
          }}
        >
          {item.senderName}
        </Text>
        <Text
          style={{
            ...typography.body.small,
            color: colors.semantic.text.secondary,
          }}
        >
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>
      
      <Text
        style={{
          ...typography.body.medium,
          color: colors.semantic.text.primary,
          marginBottom: spacing.xs,
        }}
        numberOfLines={2}
      >
        {item.text}
      </Text>
      
      <Text
        style={{
          ...typography.body.small,
          color: colors.semantic.text.secondary,
          fontStyle: 'italic',
        }}
      >
        in {item.conversationName} ({item.conversationType})
      </Text>
    </TouchableOpacity>
  )

  const renderConversationResult = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={{
        padding: spacing.md,
        backgroundColor: colors.semantic.surface.primary,
        borderBottomWidth: 1,
        borderBottomColor: colors.gray[200],
      }}
      onPress={() => {
        if (onConversationSelect) {
          onConversationSelect(item)
        }
        handleClose()
      }}
    >
      <Text
        style={{
          ...typography.body.large,
          color: colors.semantic.text.primary,
          fontWeight: '600',
          marginBottom: spacing.xs,
        }}
      >
        {item.title}
      </Text>
      
      <Text
        style={{
          ...typography.body.small,
          color: colors.semantic.text.secondary,
          marginBottom: spacing.xs,
        }}
      >
        Participants: {item.participants.join(', ')}
      </Text>
      
      {item.lastMessage && (
        <Text
          style={{
            ...typography.body.small,
            color: colors.semantic.text.secondary,
            fontStyle: 'italic',
          }}
          numberOfLines={1}
        >
          Last: {item.lastMessage.text}
        </Text>
      )}
    </TouchableOpacity>
  )

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: colors.semantic.background.primary,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: spacing.md,
            borderBottomWidth: 1,
            borderBottomColor: colors.gray[200],
          }}
        >
          <Text
            style={{
              ...typography.heading[4],
              color: colors.semantic.text.primary,
              fontWeight: 'bold',
            }}
          >
            Search
          </Text>
          <TouchableOpacity onPress={handleClose}>
            <Text
              style={{
                ...typography.body.large,
                color: colors.primary[500],
                fontWeight: '600',
              }}
            >
              Done
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Type Toggle */}
        <View
          style={{
            flexDirection: 'row',
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              backgroundColor: searchType === 'messages' ? colors.primary[500] : colors.gray[200],
              borderRadius: spacing.xs,
              alignItems: 'center',
            }}
            onPress={() => setSearchType('messages')}
          >
            <Text
              style={{
                ...typography.body.medium,
                color: searchType === 'messages' ? colors.white : colors.semantic.text.primary,
                fontWeight: '600',
              }}
            >
              Messages
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              backgroundColor: searchType === 'conversations' ? colors.primary[500] : colors.gray[200],
              borderRadius: spacing.xs,
              alignItems: 'center',
            }}
            onPress={() => setSearchType('conversations')}
          >
            <Text
              style={{
                ...typography.body.medium,
                color: searchType === 'conversations' ? colors.white : colors.semantic.text.primary,
                fontWeight: '600',
              }}
            >
              Conversations
            </Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View
          style={{
            flexDirection: 'row',
            padding: spacing.md,
            gap: spacing.sm,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              backgroundColor: colors.semantic.surface.primary,
              borderRadius: spacing.xs,
              borderWidth: 1,
              borderColor: colors.gray[300],
              ...typography.body.medium,
              color: colors.semantic.text.primary,
            }}
            placeholder={`Search ${searchType}...`}
            placeholderTextColor={colors.semantic.text.secondary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          
          <TouchableOpacity
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              backgroundColor: colors.primary[500],
              borderRadius: spacing.xs,
              justifyContent: 'center',
            }}
            onPress={handleSearch}
            disabled={!query.trim() || isLoading}
          >
            <Text
              style={{
                ...typography.body.medium,
                color: colors.white,
                fontWeight: '600',
              }}
            >
              Search
            </Text>
          </TouchableOpacity>
        </View>

        {/* Results */}
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ActivityIndicator size="large" color={colors.primary[500]} />
              <Text
                style={{
                  ...typography.body.medium,
                  color: colors.semantic.text.secondary,
                  marginTop: spacing.md,
                }}
              >
                Searching...
              </Text>
            </View>
          ) : error ? (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: spacing.xl,
              }}
            >
              <Text
                style={{
                  ...typography.body.medium,
                  color: colors.red[500],
                  textAlign: 'center',
                }}
              >
                {error}
              </Text>
            </View>
          ) : lastQuery ? (
            <View style={{ flex: 1 }}>
              <View
                style={{
                  padding: spacing.md,
                  backgroundColor: colors.gray[100],
                  borderBottomWidth: 1,
                  borderBottomColor: colors.gray[200],
                }}
              >
                <Text
                  style={{
                    ...typography.body.small,
                    color: colors.semantic.text.secondary,
                  }}
                >
                  {resultCount} result{resultCount !== 1 ? 's' : ''} for "{lastQuery}"
                </Text>
              </View>
              
              <FlatList
                data={searchType === 'messages' ? messageResults : conversationResults}
                keyExtractor={(item) => item.id}
                renderItem={searchType === 'messages' ? renderMessageResult : renderConversationResult}
                showsVerticalScrollIndicator={true}
                ListEmptyComponent={
                  <View
                    style={{
                      padding: spacing.xl,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        ...typography.body.medium,
                        color: colors.semantic.text.secondary,
                        textAlign: 'center',
                      }}
                    >
                      No {searchType} found
                    </Text>
                  </View>
                }
              />
            </View>
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                padding: spacing.xl,
              }}
            >
              <Text
                style={{
                  ...typography.body.large,
                  color: colors.semantic.text.secondary,
                  textAlign: 'center',
                }}
              >
                Enter a search term to find {searchType}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}