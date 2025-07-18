import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Alert, Modal } from 'react-native'
import { useTheme } from '@theme'
import { useEncryption } from '@hooks/useEncryption'

interface EncryptionSetupProps {
  userId: string
  visible: boolean
  onClose: () => void
  onComplete: () => void
}

export const EncryptionSetup: React.FC<EncryptionSetupProps> = ({
  userId,
  visible,
  onClose,
  onComplete,
}) => {
  const { colors, spacing, typography } = useTheme()
  const { generateKeys, loadKeys, isGeneratingKeys, isLoadingKeys, error, clearError } =
    useEncryption()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mode, setMode] = useState<'generate' | 'load'>('generate')

  const handleGenerateKeys = async () => {
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match')
      return
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long')
      return
    }

    const success = await generateKeys(userId, password)
    if (success) {
      Alert.alert('Success', 'Encryption keys generated successfully!', [
        { text: 'OK', onPress: onComplete },
      ])
    } else {
      Alert.alert('Error', error || 'Failed to generate encryption keys')
    }
  }

  const handleLoadKeys = async () => {
    if (!password) {
      Alert.alert('Error', 'Please enter your password')
      return
    }

    const success = await loadKeys(password)
    if (success) {
      Alert.alert('Success', 'Encryption keys loaded successfully!', [
        { text: 'OK', onPress: onComplete },
      ])
    } else {
      Alert.alert('Error', error || 'Failed to load encryption keys')
    }
  }

  const handleClose = () => {
    setPassword('')
    setConfirmPassword('')
    clearError()
    onClose()
  }

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={handleClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: spacing.lg,
        }}
      >
        <View
          style={{
            backgroundColor: colors.semantic.background.primary,
            borderRadius: 12,
            padding: spacing.xl,
            width: '100%',
            maxWidth: 400,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Text
            style={[
              typography.heading[3] as any,
              {
                color: colors.semantic.text.primary,
                textAlign: 'center',
                marginBottom: spacing.lg,
              },
            ]}
          >
            🔐 Message Encryption
          </Text>

          <Text
            style={[
              typography.body.m.regular as any,
              {
                color: colors.semantic.text.secondary,
                textAlign: 'center',
                marginBottom: spacing.lg,
              },
            ]}
          >
            Secure your messages with end-to-end encryption
          </Text>

          {/* Mode Toggle */}
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: colors.semantic.surface.secondary,
              borderRadius: 8,
              padding: 4,
              marginBottom: spacing.lg,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                backgroundColor: mode === 'generate' ? colors.primary[500] : 'transparent',
                borderRadius: 6,
                alignItems: 'center',
              }}
              onPress={() => setMode('generate')}
            >
              <Text
                style={[
                  typography.body.m.regular as any,
                  {
                    color: mode === 'generate' ? colors.base.white : colors.semantic.text.primary,
                  },
                ]}
              >
                Generate New Keys
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                backgroundColor: mode === 'load' ? colors.primary[500] : 'transparent',
                borderRadius: 6,
                alignItems: 'center',
              }}
              onPress={() => setMode('load')}
            >
              <Text
                style={[
                  typography.body.m.regular as any,
                  {
                    color: mode === 'load' ? colors.base.white : colors.semantic.text.primary,
                  },
                ]}
              >
                Load Existing Keys
              </Text>
            </TouchableOpacity>
          </View>

          {/* Password Input */}
          <Text
            style={[
              typography.body.m.regular as any,
              {
                color: colors.semantic.text.primary,
                marginBottom: spacing.xs,
              },
            ]}
          >
            {mode === 'generate' ? 'Create Password' : 'Enter Password'}
          </Text>

          <TextInput
            style={{
              borderWidth: 1,
              borderColor: colors.semantic.border.primary,
              borderRadius: 8,
              padding: spacing.md,
              marginBottom: spacing.md,
              fontSize: 16,
              color: colors.semantic.text.primary,
              backgroundColor: colors.semantic.surface.primary,
            }}
            value={password}
            onChangeText={setPassword}
            placeholder='Enter a strong password'
            placeholderTextColor={colors.semantic.text.tertiary}
            secureTextEntry
            autoCapitalize='none'
          />

          {/* Confirm Password (Generate mode only) */}
          {mode === 'generate' && (
            <>
              <Text
                style={[
                  typography.body.m.regular as any,
                  {
                    color: colors.semantic.text.primary,
                    marginBottom: spacing.xs,
                  },
                ]}
              >
                Confirm Password
              </Text>

              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: colors.semantic.border.primary,
                  borderRadius: 8,
                  padding: spacing.md,
                  marginBottom: spacing.lg,
                  fontSize: 16,
                  color: colors.semantic.text.primary,
                  backgroundColor: colors.semantic.surface.primary,
                }}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder='Confirm your password'
                placeholderTextColor={colors.semantic.text.tertiary}
                secureTextEntry
                autoCapitalize='none'
              />
            </>
          )}

          {/* Warning Text */}
          <View
            style={{
              backgroundColor: colors.warning?.[50] || colors.semantic.surface.secondary,
              borderRadius: 8,
              padding: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            <Text
              style={[
                typography.body.s.regular as any,
                {
                  color: colors.warning?.[700] || colors.semantic.text.secondary,
                  textAlign: 'center',
                },
              ]}
            >
              ⚠️ Important: Remember your password!
              {'\n'}Lost passwords cannot be recovered.
            </Text>
          </View>

          {/* Action Buttons */}
          <View
            style={{
              flexDirection: 'row',
              gap: spacing.md,
            }}
          >
            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.semantic.border.primary,
                alignItems: 'center',
              }}
              onPress={handleClose}
            >
              <Text
                style={[
                  typography.body.m.regular as any,
                  {
                    color: colors.semantic.text.secondary,
                  },
                ]}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                backgroundColor: colors.primary[500],
                borderRadius: 8,
                alignItems: 'center',
                opacity: isGeneratingKeys || isLoadingKeys ? 0.7 : 1,
              }}
              onPress={mode === 'generate' ? handleGenerateKeys : handleLoadKeys}
              disabled={isGeneratingKeys || isLoadingKeys}
            >
              <Text
                style={[
                  typography.body.m.regular as any,
                  {
                    color: colors.base.white,
                  },
                ]}
              >
                {isGeneratingKeys || isLoadingKeys
                  ? 'Processing...'
                  : mode === 'generate'
                    ? 'Generate Keys'
                    : 'Load Keys'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
