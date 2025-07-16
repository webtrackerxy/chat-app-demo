import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '@theme'
import { ThemeToggle } from './ThemeToggle'

interface HeaderProps {
  title: string
  onBack?: () => void
  rightAction?: {
    title: string
    onPress: () => void
  }
  rightComponent?: React.ReactNode
  subtitle?: string
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  rightAction,
  rightComponent,
  subtitle,
}) => {
  const { colors, spacing, typography } = useTheme()
  const styles = createStyles(colors, spacing, typography)

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}

        <View style={styles.titleContainer}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {rightAction && (
          <TouchableOpacity style={styles.rightAction} onPress={rightAction.onPress}>
            <Text style={styles.rightActionText}>{rightAction.title}</Text>
          </TouchableOpacity>
        )}

        {rightComponent && <View style={styles.rightAction}>{rightComponent}</View>}

        {/* Always show theme toggle if no other right action */}
        {!rightAction && !rightComponent && (
          <View style={styles.rightAction}>
            <ThemeToggle size='small' />
          </View>
        )}
      </View>
    </View>
  )
}

const createStyles = (colors: any, spacing: any, typography: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.semantic.background.primary,
      borderBottomWidth: 1,
      borderBottomColor: colors.semantic.border.secondary,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      minHeight: 56,
    },
    backButton: {
      marginRight: spacing.lg,
    },
    backButtonText: {
      ...typography.body.m.regular,
      color: colors.semantic.interactive.primary,
    },
    titleContainer: {
      flex: 1,
    },
    title: {
      ...typography.heading[4],
      color: colors.semantic.text.primary,
    },
    subtitle: {
      ...typography.body.s.regular,
      color: colors.semantic.text.secondary,
      marginTop: spacing.xs / 2,
    },
    rightAction: {
      marginLeft: spacing.lg,
    },
    rightActionText: {
      ...typography.body.m.bold,
      color: colors.semantic.interactive.primary,
    },
  })
