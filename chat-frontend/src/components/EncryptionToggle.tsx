import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Switch } from 'react-native'
import { useTheme } from '@theme'
import { useEncryption } from '@hooks/useEncryption'
import { EncryptionSetup } from './EncryptionSetup'

interface EncryptionToggleProps {
  conversationId: string
  userId: string
  onEncryptionChange: (enabled: boolean) => void
}

export const EncryptionToggle: React.FC<EncryptionToggleProps> = ({
  conversationId,
  userId,
  onEncryptionChange,
}) => {
  console.log('EncryptionToggle')

  const { colors, spacing, typography } = useTheme()
  const { isEncryptionEnabled, enableEncryption, hasKeys, keysLoaded } = useEncryption()

  const [encryptionActive, setEncryptionActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showSetupModal, setShowSetupModal] = useState(false)

  useEffect(() => {
    const checkEncryptionStatus = async () => {
      if (hasKeys && keysLoaded) {
        const enabled = await isEncryptionEnabled(conversationId, userId)
        setEncryptionActive(enabled)
        onEncryptionChange(enabled)
      }
    }

    checkEncryptionStatus()
  }, [conversationId, userId, hasKeys, keysLoaded, isEncryptionEnabled, onEncryptionChange])

  const handleToggleEncryption = async () => {
    if (showSetupPrompt) {
      // Open setup modal when keys are needed
      setShowSetupModal(true)
      return
    }

    if (!hasKeys || !keysLoaded) {
      return
    }

    setIsLoading(true)
    try {
      if (!encryptionActive) {
        await enableEncryption(conversationId)
        setEncryptionActive(true)
        onEncryptionChange(true)
      }
      // Note: Disabling encryption is not implemented for security reasons
    } catch (error) {
      console.error('Failed to toggle encryption:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Show the component even if no keys are available, but indicate setup is needed
  const showSetupPrompt = !hasKeys || !keysLoaded

  const handleSetupComplete = () => {
    setShowSetupModal(false)
    // Keys should be loaded now, so the component will re-render
  }

  const handleSetupCancel = () => {
    setShowSetupModal(false)
  }

  return (
    <>
      <TouchableOpacity
        onPress={showSetupPrompt ? handleToggleEncryption : undefined}
        activeOpacity={showSetupPrompt ? 0.7 : 1}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          backgroundColor: encryptionActive
            ? colors.success?.[50] || colors.semantic.surface.secondary
            : colors.semantic.surface.secondary,
          borderRadius: 8,
          marginHorizontal: spacing.md,
          marginBottom: spacing.sm,
          borderWidth: 1,
          borderColor: encryptionActive
            ? colors.success?.[200] || colors.semantic.border.primary
            : colors.semantic.border.primary,
        }}
      >
        <View style={{ flex: 1, marginRight: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text
              style={[
                typography.body.m.regular as any,
                {
                  color: colors.semantic.text.primary,
                  marginRight: spacing.xs,
                },
              ]}
            >
              🔐 End-to-End Encryption
            </Text>
            {encryptionActive && !showSetupPrompt && (
              <View
                style={{
                  backgroundColor: colors.success?.[500] || colors.primary[500],
                  paddingHorizontal: spacing.xs,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={[
                    typography.body.xs.regular as any,
                    {
                      color: colors.base.white,
                      fontSize: 10,
                    },
                  ]}
                >
                  ACTIVE
                </Text>
              </View>
            )}
            {showSetupPrompt && (
              <View
                style={{
                  backgroundColor: colors.warning?.[500] || colors.primary[500],
                  paddingHorizontal: spacing.xs,
                  paddingVertical: 2,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={[
                    typography.body.xs.regular as any,
                    {
                      color: colors.base.white,
                      fontSize: 10,
                    },
                  ]}
                >
                  SETUP NEEDED
                </Text>
              </View>
            )}
          </View>

          <Text
            style={[
              typography.body.s.regular as any,
              {
                color: colors.semantic.text.secondary,
                marginTop: 2,
              },
            ]}
          >
            {showSetupPrompt
              ? 'Encryption keys needed - tap to set up encryption'
              : encryptionActive
                ? 'Messages are protected with end-to-end encryption (Demo Mode)'
                : 'Enable to secure messages with encryption (Demo Mode)'}
          </Text>
        </View>

        <Switch
          value={encryptionActive && !showSetupPrompt}
          onValueChange={handleToggleEncryption}
          disabled={isLoading || encryptionActive || showSetupPrompt} // Disabled if setup needed
          trackColor={{
            false: colors.semantic.border.primary,
            true: colors.success?.[500] || colors.primary[500],
          }}
          thumbColor={colors.base.white}
        />
      </TouchableOpacity>

      <EncryptionSetup
        visible={showSetupModal}
        userId={userId}
        onComplete={handleSetupComplete}
        onClose={handleSetupCancel}
      />
    </>
  )
}
