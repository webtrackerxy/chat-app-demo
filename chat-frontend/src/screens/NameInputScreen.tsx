import React, { useState } from 'react'
import { View, Text, StyleSheet, SafeAreaView } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Button, Input, StorageModeSelector } from '@components'
import { useChat } from '@hooks/useChat'
import { RootStackParamList } from '@types'
import { StorageMode } from '@types'
import { useTheme } from '@theme'

type NameInputScreenNavigationProp = StackNavigationProp<RootStackParamList, 'NameInput'>

export const NameInputScreen: React.FC = () => {
  const navigation = useNavigation<NameInputScreenNavigationProp>()
  const { setStorageMode, setCurrentUser } = useChat()
  const [name, setName] = useState('')
  const [selectedMode, setSelectedMode] = useState<StorageMode | null>(null)

  const handleSubmit = () => {
    if (name.trim() && selectedMode) {
      setStorageMode(selectedMode)
      setCurrentUser({
        id: `user-${Date.now()}`,
        name: name.trim(),
      })
      navigation.navigate('ChatList', { userName: name.trim() })
    }
  }

  const { colors, spacing, typography } = useTheme()
  const styles = createStyles(colors, spacing, typography)

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to Chat App</Text>
        <Text style={styles.subtitle}>Please enter your name and choose storage mode</Text>

        <Input
          variant='rounded'
          size='large'
          value={name}
          onChangeText={setName}
          placeholder='Enter your name'
          autoCapitalize='words'
          autoCorrect={false}
          style={styles.nameInput}
        />

        <StorageModeSelector selectedMode={selectedMode} onModeSelect={setSelectedMode} />

        <Button
          title='Start Chatting'
          onPress={handleSubmit}
          disabled={!name.trim() || !selectedMode}
          size='large'
          style={styles.continueButton}
        />
      </View>
    </SafeAreaView>
  )
}

const createStyles = (colors: any, spacing: any, typography: any) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.semantic.background.primary,
    },
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['2xl'],
      backgroundColor: colors.semantic.background.primary,
    },
    title: {
      ...typography.heading[1],
      marginBottom: spacing.xs,
      color: colors.semantic.text.primary,
    },
    subtitle: {
      ...typography.body.l.regular,
      color: colors.semantic.text.secondary,
      marginBottom: spacing.xl,
      textAlign: 'center',
    },
    nameInput: {
      width: '100%',
      marginBottom: spacing.xl,
    },
    continueButton: {
      marginTop: spacing.lg,
      minWidth: 200,
    },
  })
