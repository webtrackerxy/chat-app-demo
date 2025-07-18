import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native'
import { useTheme } from '@theme'
import { usePrivateMessaging } from '@hooks/usePrivateMessaging'
import { UserListResponse } from '@chat-types'

interface UserSelectorProps {
  currentUserId: string
  onUserSelect: (user: UserListResponse) => void
  onClose: () => void
  visible: boolean
}

export const UserSelector: React.FC<UserSelectorProps> = (props) => {
  console.log('UserSelector - component called with props:', props)

  // Early return if props are invalid
  if (!props) {
    console.error('UserSelector - props are undefined')
    return null
  }

  // Safe destructuring with defaults
  const { currentUserId = '', onUserSelect = () => {}, onClose = () => {}, visible = false } = props

  const { colors, spacing, typography } = useTheme()
  const { users, isLoading, error, loadUsers, clearError } = usePrivateMessaging()
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  useEffect(() => {
    if (visible && currentUserId) {
      loadUsers(currentUserId)
    }
  }, [visible, currentUserId, loadUsers])

  const handleUserPress = (user: UserListResponse) => {
    onUserSelect(user)
    onClose()
  }

  const renderUserItem = ({ item }: { item: UserListResponse }) => {
    const isOnline = item.status === 'online'

    return (
      <TouchableOpacity
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: spacing.md,
          backgroundColor: colors.semantic.surface.primary,
          borderBottomWidth: 1,
          borderBottomColor: colors.gray[200],
        }}
        onPress={() => handleUserPress(item)}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.primary[500],
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.md,
          }}
        >
          <Text
            style={{
              color: colors.base.white,
              fontWeight: 'bold',
            }}
          >
            {item.username.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={[
              typography.body.l.regular as any,
              {
                color: colors.semantic.text.primary,
                fontWeight: '600',
              },
            ]}
          >
            {item.username}
          </Text>
          <Text
            style={[
              typography.body.s.regular as any,
              {
                color: isOnline ? colors.success?.[600] || colors.primary[600] : colors.gray[500],
              },
            ]}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: isOnline
              ? colors.success?.[500] || colors.primary[500]
              : colors.gray[400],
          }}
        />
      </TouchableOpacity>
    )
  }

  if (!visible) {
    return null
  }

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
      }}
    >
      <View
        style={{
          width: '90%',
          maxHeight: '80%',
          backgroundColor: colors.semantic.background.primary,
          borderRadius: spacing.md,
          overflow: 'hidden',
        }}
      >
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
            style={[
              typography.heading[3] as any,
              {
                color: colors.semantic.text.primary,
              },
            ]}
          >
            Select User
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text
              style={[
                typography.body.l.regular as any,
                {
                  color: colors.primary[500],
                  fontWeight: '600',
                },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View
            style={{
              padding: spacing.xl,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator size='large' color={colors.primary[500]} />
            <Text
              style={[
                typography.body.m.regular as any,
                {
                  color: colors.semantic.text.secondary,
                  marginTop: spacing.md,
                },
              ]}
            >
              Loading users...
            </Text>
          </View>
        ) : error ? (
          <View
            style={{
              padding: spacing.xl,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={[
                typography.body.m.regular as any,
                {
                  color: colors.error[500],
                  textAlign: 'center',
                },
              ]}
            >
              Error loading users: {error}
            </Text>
            <TouchableOpacity
              onPress={() => loadUsers(currentUserId)}
              style={{
                marginTop: spacing.md,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                backgroundColor: colors.primary[500],
                borderRadius: spacing.sm,
              }}
            >
              <Text
                style={[
                  {
                    color: colors.base.white,
                    fontWeight: '600',
                  },
                ]}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        ) : users.length === 0 ? (
          <View
            style={{
              padding: spacing.xl,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={[
                typography.body.m.regular as any,
                {
                  color: colors.semantic.text.secondary,
                  textAlign: 'center',
                },
              ]}
            >
              No users available for messaging
            </Text>
          </View>
        ) : (
          <FlatList
            data={users}
            renderItem={renderUserItem}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 400 }}
          />
        )}
      </View>
    </View>
  )
}
