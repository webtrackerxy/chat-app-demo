import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Modal, StyleSheet } from 'react-native'
import { useTheme } from '@theme'
import { encryptionDebug } from '@utils/encryptionDebug'
import { isDebugEncryption } from '@config/env'

interface EncryptionDebugPanelProps {
  visible: boolean
  onClose: () => void
}

export const EncryptionDebugPanel: React.FC<EncryptionDebugPanelProps> = ({ visible, onClose }) => {
  const { colors, spacing, typography } = useTheme()
  const [logs, setLogs] = useState(encryptionDebug.getLogs())
  const [selectedLog, setSelectedLog] = useState<any>(null)

  useEffect(() => {
    if (visible) {
      const interval = setInterval(() => {
        setLogs(encryptionDebug.getLogs())
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [visible])

  if (!isDebugEncryption()) {
    return null
  }

  const operationEmojis = {
    KEY_GENERATION: '🔑',
    KEY_LOADING: '📥',
    MESSAGE_ENCRYPTION: '🔒',
    MESSAGE_DECRYPTION: '🔓',
    ENCRYPTION_TOGGLE: '🔄',
    ENCRYPTION_ERROR: '❌',
  }

  const operationColors = {
    KEY_GENERATION: colors.success?.[500] || colors.primary[500],
    KEY_LOADING: colors.primary[500],
    MESSAGE_ENCRYPTION: colors.warning?.[500] || colors.primary[500],
    MESSAGE_DECRYPTION: colors.success?.[500] || colors.primary[500],
    ENCRYPTION_TOGGLE: colors.primary[500],
    ENCRYPTION_ERROR: colors.error?.[500] || colors.primary[500],
  }

  const handleClearLogs = () => {
    encryptionDebug.clearLogs()
    setLogs([])
    setSelectedLog(null)
  }

  const handlePrintSummary = () => {
    encryptionDebug.printSummary()
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  }

  const renderLogItem = (log: any, index: number) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.logItem,
        {
          backgroundColor: colors.semantic.surface.secondary,
          borderColor: colors.semantic.border.primary,
          borderLeftColor: operationColors[log.operation as keyof typeof operationColors],
        },
      ]}
      onPress={() => setSelectedLog(log)}
    >
      <View style={styles.logHeader}>
        <Text style={styles.logEmoji}>
          {operationEmojis[log.operation as keyof typeof operationEmojis]}
        </Text>
        <Text style={[styles.logOperation, { color: colors.semantic.text.primary }]}>
          {log.operation}
        </Text>
        <Text style={[styles.logTimestamp, { color: colors.semantic.text.tertiary }]}>
          {formatTimestamp(log.timestamp)}
        </Text>
      </View>
      <View style={styles.logContent}>
        {log.userId && (
          <Text style={[styles.logMeta, { color: colors.semantic.text.secondary }]}>
            👤 {log.userId}
          </Text>
        )}
        {log.conversationId && (
          <Text style={[styles.logMeta, { color: colors.semantic.text.secondary }]}>
            💬 {log.conversationId}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  )

  const renderSelectedLog = () => {
    if (!selectedLog) return null

    return (
      <Modal
        visible={!!selectedLog}
        transparent
        animationType='slide'
        onRequestClose={() => setSelectedLog(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalContent, { backgroundColor: colors.semantic.background.primary }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.semantic.text.primary }]}>
                {operationEmojis[selectedLog.operation as keyof typeof operationEmojis]}{' '}
                {selectedLog.operation}
              </Text>
              <TouchableOpacity
                onPress={() => setSelectedLog(null)}
                style={[styles.closeButton, { backgroundColor: colors.semantic.surface.secondary }]}
              >
                <Text style={[styles.closeButtonText, { color: colors.semantic.text.primary }]}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={[styles.detailsText, { color: colors.semantic.text.secondary }]}>
                {JSON.stringify(selectedLog, null, 2)}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    )
  }

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.panel, { backgroundColor: colors.semantic.background.primary }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.semantic.text.primary }]}>
              🔐 Encryption Debug Panel
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={[styles.closeButtonText, { color: colors.semantic.text.primary }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity
              style={[styles.controlButton, { backgroundColor: colors.primary[500] }]}
              onPress={handlePrintSummary}
            >
              <Text style={[styles.controlButtonText, { color: colors.base.white }]}>
                📊 Print Summary
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: colors.error?.[500] || colors.primary[500] },
              ]}
              onPress={handleClearLogs}
            >
              <Text style={[styles.controlButtonText, { color: colors.base.white }]}>
                🗑️ Clear Logs
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.stats}>
            <Text style={[styles.statsText, { color: colors.semantic.text.secondary }]}>
              Total Operations: {logs.length}
            </Text>
            <Text style={[styles.statsText, { color: colors.semantic.text.secondary }]}>
              Errors: {logs.filter((l) => l.operation === 'ENCRYPTION_ERROR').length}
            </Text>
          </View>

          <ScrollView style={styles.logsList}>
            {logs.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.semantic.text.tertiary }]}>
                No encryption operations yet...
              </Text>
            ) : (
              logs.slice(-20).reverse().map(renderLogItem)
            )}
          </ScrollView>

          {renderSelectedLog()}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    width: '90%',
    maxWidth: 600,
    height: '80%',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
    borderRadius: 6,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  controlButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  statsText: {
    fontSize: 12,
  },
  logsList: {
    flex: 1,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    fontStyle: 'italic',
  },
  logItem: {
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderLeftWidth: 4,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logEmoji: {
    fontSize: 16,
  },
  logOperation: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  logTimestamp: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  logContent: {
    marginTop: 4,
    gap: 2,
  },
  logMeta: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '70%',
    borderRadius: 12,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBody: {
    flex: 1,
  },
  detailsText: {
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
})
