import React, { useState, useEffect } from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native'
import { useTheme } from '@theme'
import { EncryptionMode, ENCRYPTION_CONFIGS, setEncryptionMode, getStoredEncryptionMode } from '@config/encryptionConfig'
import { adaptiveEncryptionService } from '@services/adaptiveEncryptionService'

interface EncryptionModeSelectorProps {
  visible: boolean
  onClose: () => void
  onModeSelected: (mode: EncryptionMode) => void
}

export const EncryptionModeSelector: React.FC<EncryptionModeSelectorProps> = ({
  visible,
  onClose,
  onModeSelected,
}) => {
  const { colors, spacing, typography } = useTheme()
  const [currentMode, setCurrentMode] = useState<EncryptionMode>(EncryptionMode.PFS)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (visible) {
      loadCurrentMode()
    }
  }, [visible])

  const loadCurrentMode = async () => {
    try {
      const mode = await getStoredEncryptionMode()
      setCurrentMode(mode)
    } catch (error) {
      console.error('Failed to load current encryption mode:', error)
    }
  }

  const handleModeSelection = async (mode: EncryptionMode) => {
    if (mode === currentMode) {
      onClose()
      return
    }

    setIsLoading(true)
    try {
      // Switch the mode in the adaptive service
      await adaptiveEncryptionService.switchMode(mode)
      
      // Store the new mode
      await setEncryptionMode(mode)
      
      setCurrentMode(mode)
      onModeSelected(mode)
      onClose()
    } catch (error) {
      console.error('Failed to switch encryption mode:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const renderModeOption = (mode: EncryptionMode) => {
    const config = ENCRYPTION_CONFIGS[mode]
    const isSelected = mode === currentMode
    const isDisabled = isLoading

    return (
      <TouchableOpacity
        key={mode}
        onPress={() => handleModeSelection(mode)}
        disabled={isDisabled}
        style={{
          padding: spacing.md,
          backgroundColor: isSelected 
            ? colors.primary[100] 
            : colors.semantic.surface.secondary,
          borderRadius: 8,
          marginBottom: spacing.sm,
          borderWidth: 2,
          borderColor: isSelected 
            ? colors.primary[500] 
            : colors.semantic.border.primary,
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: isSelected 
                ? colors.primary[500] 
                : colors.semantic.border.primary,
              marginRight: spacing.sm,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isSelected && (
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.base.white,
                }}
              />
            )}
          </View>
          
          <Text
            style={[
              typography.body.m.regular as any,
              {
                color: isSelected 
                  ? colors.primary[700] 
                  : colors.semantic.text.primary,
                flex: 1,
                fontWeight: '600',
              },
            ]}
          >
            {config.displayName}
          </Text>

          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            {config.quantumResistant && (
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
                  QUANTUM SAFE
                </Text>
              </View>
            )}
            
            {config.forwardSecrecy && (
              <View
                style={{
                  backgroundColor: colors.info?.[500] || colors.primary[500],
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
                  FORWARD SECRECY
                </Text>
              </View>
            )}

            {config.multiDeviceSupport && (
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
                  MULTI-DEVICE
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text
          style={[
            typography.body.s.regular as any,
            {
              color: colors.semantic.text.secondary,
              marginBottom: spacing.xs,
            },
          ]}
        >
          {config.description}
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text
            style={[
              typography.body.xs.regular as any,
              {
                color: colors.semantic.text.tertiary,
              },
            ]}
          >
            Security Level: {config.securityLevel}/5
          </Text>
          
          <Text
            style={[
              typography.body.xs.regular as any,
              {
                color: colors.semantic.text.tertiary,
              },
            ]}
          >
            {config.algorithms.keyExchange} + {config.algorithms.encryption}
          </Text>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ 
        flex: 1, 
        backgroundColor: colors.semantic.surface.primary,
        paddingTop: spacing.lg 
      }}>
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.semantic.border.primary,
        }}>
          <Text
            style={[
              typography.body.l.medium as any,
              {
                color: colors.semantic.text.primary,
                fontSize: 20,
                fontWeight: '600',
              },
            ]}
          >
            🔐 Encryption Mode
          </Text>
          
          <TouchableOpacity
            onPress={onClose}
            style={{
              padding: spacing.xs,
              borderRadius: 6,
              backgroundColor: colors.semantic.surface.secondary,
            }}
          >
            <Text
              style={[
                typography.body.m.regular as any,
                {
                  color: colors.semantic.text.primary,
                  fontWeight: '600',
                },
              ]}
            >
              ✕
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            padding: spacing.md,
          }}
        >
          <Text
            style={[
              typography.body.m.regular as any,
              {
                color: colors.semantic.text.secondary,
                marginBottom: spacing.lg,
                textAlign: 'center',
              },
            ]}
          >
            Choose your encryption mode. Switching modes will clear existing keys for security.
          </Text>

          {Object.values(EncryptionMode).map(renderModeOption)}

          <View
            style={{
              marginTop: spacing.lg,
              padding: spacing.md,
              backgroundColor: colors.info?.[50] || colors.semantic.surface.secondary,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.info?.[200] || colors.semantic.border.primary,
            }}
          >
            <Text
              style={[
                typography.body.s.regular as any,
                {
                  color: colors.info?.[700] || colors.semantic.text.primary,
                  marginBottom: spacing.xs,
                  fontWeight: '600',
                },
              ]}
            >
              ℹ️ Important Notes:
            </Text>
            <Text
              style={[
                typography.body.s.regular as any,
                {
                  color: colors.info?.[600] || colors.semantic.text.secondary,
                  lineHeight: 20,
                },
              ]}
            >
              • PFS: Highest security with ephemeral keys per message{'\n'}
              • PQC: Future-proof against quantum computers{'\n'}
              • Multi-Device: Sync encryption keys across your devices{'\n'}
              • Switching modes will require re-establishing encrypted conversations
            </Text>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}