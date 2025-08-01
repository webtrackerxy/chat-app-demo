import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Switch } from 'react-native'
import { useTheme } from '@theme'
import { useEncryption } from '@hooks/useEncryption'
import { EncryptionModeSelector } from './EncryptionModeSelector'
import { EncryptionMode, ENCRYPTION_CONFIGS } from '@config/encryptionConfig'
import { adaptiveEncryptionService } from '@services/adaptiveEncryptionService'

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
  const { enableEncryption, hasKeys, keysLoaded, autoInitializeEncryption } = useEncryption()

  const [encryptionActive, setEncryptionActive] = useState(true) // Always active
  const [showModeSelector, setShowModeSelector] = useState(false)
  const [currentMode, setCurrentMode] = useState<EncryptionMode>(EncryptionMode.PFS)

  useEffect(() => {
    const checkEncryptionStatus = async () => {
      console.log('🔐 EncryptionToggle: Checking status:', {
        hasKeys,
        keysLoaded,
        userId,
        conversationId
      })
      
      // Auto-initialize encryption if no keys exist
      if (!hasKeys && userId) {
        console.log('🔐 Auto-initializing end-to-end encryption...')
        const success = await autoInitializeEncryption(userId)
        if (success) {
          console.log('✅ End-to-end encryption enabled by default')
        }
      }
      
      // For always-on encryption, enable if we have keys
      if (hasKeys && keysLoaded) {
        setEncryptionActive(true)
        onEncryptionChange(true)
        console.log('✅ Encryption enabled - keys are available')
        
        // Initialize conversation encryption if needed
        try {
          await enableEncryption(conversationId)
          console.log('✅ Conversation encryption initialized')
        } catch (error) {
          console.log('⚠️ Conversation encryption init failed:', error instanceof Error ? error.message : 'Unknown error')
        }
      } else {
        // No keys yet, disable for now
        setEncryptionActive(false)
        onEncryptionChange(false)
        console.log('⚠️ Encryption disabled - waiting for keys')
      }
      
      // Load current encryption mode
      const mode = adaptiveEncryptionService.getCurrentMode()
      setCurrentMode(mode)
    }

    checkEncryptionStatus()
  }, [conversationId, userId, hasKeys, keysLoaded, onEncryptionChange, autoInitializeEncryption, enableEncryption])

  const handleToggleEncryption = async () => {
    // Encryption is always enabled by default, this is just for mode settings
    handleModeSettingsPress()
  }



  const handleModeChange = (mode: EncryptionMode) => {
    setCurrentMode(mode)
    // For always-on encryption, keep it enabled when mode changes
    if (hasKeys && keysLoaded) {
      setEncryptionActive(true)
      onEncryptionChange(true)
      console.log('✅ Encryption remains enabled after mode change to:', mode)
    }
  }

  const handleModeSettingsPress = () => {
    setShowModeSelector(true)
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleToggleEncryption}
        activeOpacity={0.7}
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
                {currentMode} ACTIVE
              </Text>
            </View>
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
{`All messages are automatically protected with ${ENCRYPTION_CONFIGS[currentMode].displayName}. Tap ⚙️ to change mode.`}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={handleModeSettingsPress}
            style={{
              padding: spacing.xs,
              borderRadius: 6,
              backgroundColor: colors.semantic.surface.tertiary,
            }}
          >
            <Text
              style={[
                typography.body.s.regular as any,
                {
                  color: colors.semantic.text.secondary,
                  fontSize: 12,
                },
              ]}
            >
              ⚙️
            </Text>
          </TouchableOpacity>

          <Switch
            value={true} // Always enabled
            onValueChange={handleToggleEncryption}
            disabled={false} // Can tap to open settings
            trackColor={{
              false: colors.semantic.border.primary,
              true: colors.success?.[500] || colors.primary[500],
            }}
            thumbColor={colors.base.white}
          />
        </View>
      </TouchableOpacity>


      <EncryptionModeSelector
        visible={showModeSelector}
        onClose={() => setShowModeSelector(false)}
        onModeSelected={handleModeChange}
      />
    </>
  )
}
