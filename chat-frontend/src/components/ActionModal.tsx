import React from 'react'
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native'
import { Input } from './Input'
import { Button } from './Button'
import { useTheme } from '@theme'

interface ActionModalProps {
  visible: boolean
  title: string
  placeholder: string
  value: string
  onChangeText: (text: string) => void
  onConfirm: () => void
  onCancel: () => void
  confirmText?: string
  cancelText?: string
}

export const ActionModal: React.FC<ActionModalProps> = ({
  visible,
  title,
  placeholder,
  value,
  onChangeText,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
}) => {
  const { colors, spacing, borderRadius, typography, shadows } = useTheme()
  const styles = createStyles(colors, spacing, borderRadius, typography, shadows)

  return (
    <Modal visible={visible} transparent={true} animationType='fade' onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              <Text style={styles.title}>{title}</Text>

              <Input
                placeholder={placeholder}
                value={value}
                onChangeText={onChangeText}
                autoFocus={true}
                style={styles.input}
              />

              <View style={styles.buttonContainer}>
                <Button
                  title={cancelText}
                  onPress={onCancel}
                  variant='secondary'
                  style={styles.button}
                />
                <Button
                  title={confirmText}
                  onPress={onConfirm}
                  variant='primary'
                  style={styles.button}
                  disabled={!value.trim()}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
}

const createStyles = (
  colors: any,
  spacing: any,
  borderRadius: any,
  typography: any,
  shadows: any,
) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      backgroundColor: colors.semantic.surface.elevated,
      borderRadius: borderRadius.md,
      padding: spacing.xl,
      margin: spacing.lg,
      minWidth: 300,
      ...shadows.lg,
    },
    title: {
      ...typography.heading[5],
      color: colors.semantic.text.primary,
      marginBottom: spacing.lg,
      textAlign: 'center',
    },
    input: {
      marginBottom: spacing.lg,
    },
    buttonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    button: {
      flex: 1,
      marginHorizontal: spacing.sm,
    },
  })
