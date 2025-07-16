import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { StorageMode } from '@types'

interface StorageModeOption {
  mode: StorageMode
  icon: string
  title: string
  description: string
}

interface StorageModeSelectorProps {
  selectedMode: StorageMode | null
  onModeSelect: (mode: StorageMode) => void
}

const STORAGE_OPTIONS: StorageModeOption[] = [
  {
    mode: 'local',
    icon: '📱',
    title: 'Pure Mobile App',
    description: 'All chats stored locally on your device. Add/update/delete chats offline.',
  },
  {
    mode: 'backend',
    icon: '🌐',
    title: 'Backend Connected',
    description: 'Connect to chat server. Sync chats across devices.',
  },
]

export const StorageModeSelector: React.FC<StorageModeSelectorProps> = ({
  selectedMode,
  onModeSelect,
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Storage Mode:</Text>

      {STORAGE_OPTIONS.map((option) => (
        <TouchableOpacity
          key={option.mode}
          style={[styles.modeButton, selectedMode === option.mode && styles.modeButtonSelected]}
          onPress={() => onModeSelect(option.mode)}
        >
          <Text
            style={[
              styles.modeButtonText,
              selectedMode === option.mode && styles.modeButtonTextSelected,
            ]}
          >
            {option.icon} {option.title}
          </Text>
          <Text style={styles.modeDescription}>{option.description}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  modeButton: {
    width: '100%',
    padding: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  modeButtonSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    color: '#333',
  },
  modeButtonTextSelected: {
    color: '#007AFF',
  },
  modeDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
})
