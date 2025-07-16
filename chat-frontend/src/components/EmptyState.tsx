import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '@theme'

interface EmptyStateProps {
  title: string
  subtitle?: string
  icon?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, subtitle, icon = '💬' }) => {
  const { colors, spacing, typography } = useTheme()
  const styles = createStyles(colors, spacing, typography)

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  )
}

const createStyles = (colors: any, spacing: any, typography: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing['2xl'],
      backgroundColor: colors.semantic.background.primary,
    },
    icon: {
      fontSize: 48,
      marginBottom: spacing.lg,
    },
    title: {
      ...typography.heading[5],
      color: colors.semantic.text.primary,
      textAlign: 'center',
      marginBottom: spacing.sm,
    },
    subtitle: {
      ...typography.body.m.regular,
      color: colors.semantic.text.secondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  })
