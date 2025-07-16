import React from 'react'
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { useTheme } from '@theme'

interface ButtonProps {
  title: string
  onPress: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'text'
  size?: 'small' | 'medium' | 'large'
  style?: ViewStyle
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  style,
}) => {
  const { colors, spacing, borderRadius, typography } = useTheme()

  const styles = createStyles(colors, spacing, borderRadius, typography)

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[`${variant}Button`],
        styles[size],
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.textStyle, styles[`${variant}Text`], disabled && styles.disabledText]}>
        {title}
      </Text>
    </TouchableOpacity>
  )
}

const createStyles = (colors: any, spacing: any, borderRadius: any, typography: any) =>
  StyleSheet.create({
    button: {
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Variants
    primaryButton: {
      backgroundColor: colors.semantic.interactive.primary,
    },
    secondaryButton: {
      backgroundColor: colors.semantic.interactive.secondary,
      borderWidth: 1,
      borderColor: colors.semantic.border.primary,
    },
    dangerButton: {
      backgroundColor: colors.semantic.status.error,
    },
    textButton: {
      backgroundColor: 'transparent',
    },
    // Sizes
    small: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      minHeight: 32,
      ...typography.body.s.bold,
    },
    medium: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 44,
      ...typography.body.m.bold,
    },
    large: {
      paddingHorizontal: spacing['2xl'],
      paddingVertical: spacing.lg,
      minHeight: 52,
      ...typography.body.l.bold,
    },
    // States
    disabled: {
      backgroundColor: colors.gray[300],
      borderColor: colors.gray[300],
    },
    // Text styles
    textStyle: {
      textAlign: 'center',
    },
    primaryText: {
      color: colors.semantic.text.inverse,
    },
    secondaryText: {
      color: colors.semantic.text.primary,
    },
    dangerText: {
      color: colors.semantic.text.inverse,
    },
    textText: {
      color: colors.semantic.interactive.primary,
    },
    disabledText: {
      color: colors.semantic.text.disabled,
    },
  })
