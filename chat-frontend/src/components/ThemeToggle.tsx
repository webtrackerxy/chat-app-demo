import React from 'react'
import { TouchableOpacity, Text, StyleSheet } from 'react-native'
import { useTheme, useThemeMode } from '@theme'

interface ThemeToggleProps {
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
  style?: any
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 'medium',
  showLabel = false,
  style,
}) => {
  const { colors, spacing, borderRadius, typography } = useTheme()
  const { mode, toggleMode, isDark } = useThemeMode()

  const styles = createStyles(colors, spacing, borderRadius, typography, size)

  return (
    <TouchableOpacity style={[styles.container, style]} onPress={toggleMode} activeOpacity={0.7}>
      <Text style={styles.icon}>{isDark ? '☀️' : '🌙'}</Text>
      {showLabel && <Text style={styles.label}>{isDark ? 'Light' : 'Dark'}</Text>}
    </TouchableOpacity>
  )
}

const createStyles = (
  colors: any,
  spacing: any,
  borderRadius: any,
  typography: any,
  size: 'small' | 'medium' | 'large',
) => {
  const sizeConfig = {
    small: {
      iconSize: 16,
      padding: spacing.xs,
      minHeight: 32,
    },
    medium: {
      iconSize: 20,
      padding: spacing.sm,
      minHeight: 40,
    },
    large: {
      iconSize: 24,
      padding: spacing.md,
      minHeight: 48,
    },
  }

  const config = sizeConfig[size]

  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.semantic.surface.secondary,
      borderRadius: borderRadius.lg,
      paddingVertical: config.padding,
      paddingHorizontal: config.padding + spacing.xs,
      minHeight: config.minHeight,
      borderWidth: 1,
      borderColor: colors.semantic.border.secondary,
    },
    icon: {
      fontSize: config.iconSize,
      lineHeight: config.iconSize + 2,
    },
    label: {
      ...typography.body.s.bold,
      color: colors.semantic.text.secondary,
      marginLeft: spacing.xs,
    },
  })
}
