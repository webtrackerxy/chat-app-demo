import React from 'react'
import { TextInput, StyleSheet, ViewStyle, TextInputProps } from 'react-native'
import { useTheme } from '@theme'

interface InputProps extends TextInputProps {
  variant?: 'default' | 'rounded' | 'centered'
  size?: 'small' | 'medium' | 'large'
  style?: ViewStyle
}

export const Input: React.FC<InputProps> = ({
  variant = 'default',
  size = 'medium',
  style,
  ...props
}) => {
  const { colors, spacing, borderRadius, typography } = useTheme()
  const styles = createStyles(colors, spacing, borderRadius, typography)

  return <TextInput style={[styles.input, styles[variant], styles[size], style]} {...props} />
}

const createStyles = (colors: any, spacing: any, borderRadius: any, typography: any) =>
  StyleSheet.create({
    input: {
      borderWidth: 1,
      borderColor: colors.semantic.border.primary,
      backgroundColor: colors.semantic.surface.primary,
      color: colors.semantic.text.primary,
      ...typography.body.m.regular,
    },
    // Variants
    default: {
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
    },
    rounded: {
      borderRadius: borderRadius['2xl'],
      paddingHorizontal: spacing.xl,
      textAlign: 'center',
      borderWidth: 2,
      borderColor: colors.semantic.border.focus,
    },
    centered: {
      textAlign: 'center',
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.lg,
    },
    // Sizes
    small: {
      height: 36,
      ...typography.body.s.regular,
    },
    medium: {
      height: 44,
      ...typography.body.m.regular,
    },
    large: {
      height: 52,
      ...typography.body.l.regular,
    },
  })
