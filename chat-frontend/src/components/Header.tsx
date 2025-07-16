import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

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
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    minHeight: 56,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  rightAction: {
    marginLeft: 16,
  },
  rightActionText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
})
