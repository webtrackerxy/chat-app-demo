import { isDebugEncryption } from '@config/env'
import { EncryptedPayload } from '@chat-types'

/**
 * Debug utility for tracing encryption operations
 */
export class EncryptionDebug {
  private static instance: EncryptionDebug
  private logs: Array<{
    timestamp: Date
    operation: string
    details: any
    userId?: string
    conversationId?: string
  }> = []

  static getInstance(): EncryptionDebug {
    if (!EncryptionDebug.instance) {
      EncryptionDebug.instance = new EncryptionDebug()
    }
    return EncryptionDebug.instance
  }

  private log(operation: string, details: any, userId?: string, conversationId?: string) {
    if (!isDebugEncryption()) return

    const logEntry = {
      timestamp: new Date(),
      operation,
      details,
      userId,
      conversationId,
    }

    this.logs.push(logEntry)

    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs.shift()
    }

    // Console log with formatting
    console.group(`🔐 ENCRYPTION DEBUG: ${operation}`)
    console.log('📅 Time:', logEntry.timestamp.toISOString())
    if (userId) console.log('👤 User:', userId)
    if (conversationId) console.log('💬 Conversation:', conversationId)
    console.log('📝 Details:', details)
    console.groupEnd()
  }

  /**
   * Trace key generation
   */
  traceKeyGeneration(userId: string, keyType: 'user' | 'conversation', keyId?: string) {
    this.log(
      'KEY_GENERATION',
      {
        keyType,
        keyId,
        status: 'success',
        method: 'mock',
      },
      userId,
    )
  }

  /**
   * Trace key loading
   */
  traceKeyLoading(userId: string, success: boolean, keyType: 'user' | 'conversation') {
    this.log(
      'KEY_LOADING',
      {
        keyType,
        success,
        method: 'AsyncStorage',
      },
      userId,
    )
  }

  /**
   * Trace message encryption
   */
  traceMessageEncryption(
    plaintext: string,
    encryptedPayload: EncryptedPayload,
    userId: string,
    conversationId: string,
  ) {
    this.log(
      'MESSAGE_ENCRYPTION',
      {
        plaintextLength: plaintext.length,
        plaintextPreview: plaintext.substring(0, 50) + (plaintext.length > 50 ? '...' : ''),
        encryptedPayload: {
          encryptedTextLength: encryptedPayload.encryptedText.length,
          encryptedTextPreview: encryptedPayload.encryptedText.substring(0, 50) + '...',
          iv: encryptedPayload.iv,
          tag: encryptedPayload.tag,
          keyId: encryptedPayload.keyId,
        },
        method: 'base64 (demo)',
        reversible: true,
      },
      userId,
      conversationId,
    )
  }

  /**
   * Trace message decryption
   */
  traceMessageDecryption(
    encryptedPayload: EncryptedPayload,
    decryptedText: string,
    userId: string,
    conversationId: string,
  ) {
    this.log(
      'MESSAGE_DECRYPTION',
      {
        encryptedPayload: {
          encryptedTextLength: encryptedPayload.encryptedText.length,
          encryptedTextPreview: encryptedPayload.encryptedText.substring(0, 50) + '...',
          iv: encryptedPayload.iv,
          tag: encryptedPayload.tag,
          keyId: encryptedPayload.keyId,
        },
        decryptedLength: decryptedText.length,
        decryptedPreview: decryptedText.substring(0, 50) + (decryptedText.length > 50 ? '...' : ''),
        method: 'base64 (demo)',
        success: true,
      },
      userId,
      conversationId,
    )
  }

  /**
   * Trace encryption enable/disable
   */
  traceEncryptionToggle(conversationId: string, enabled: boolean, userId: string) {
    this.log(
      'ENCRYPTION_TOGGLE',
      {
        enabled,
        method: 'local',
        persistent: false,
      },
      userId,
      conversationId,
    )
  }

  /**
   * Trace encryption errors
   */
  traceError(operation: string, error: Error, userId?: string, conversationId?: string) {
    this.log(
      'ENCRYPTION_ERROR',
      {
        operation,
        error: error.message,
        stack: error.stack,
      },
      userId,
      conversationId,
    )
  }

  /**
   * Get all debug logs
   */
  getLogs() {
    return this.logs
  }

  /**
   * Get logs for specific conversation
   */
  getConversationLogs(conversationId: string) {
    return this.logs.filter((log) => log.conversationId === conversationId)
  }

  /**
   * Get logs for specific user
   */
  getUserLogs(userId: string) {
    return this.logs.filter((log) => log.userId === userId)
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = []
    if (isDebugEncryption()) {
      console.log('🔐 ENCRYPTION DEBUG: Logs cleared')
    }
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2)
  }

  /**
   * Print summary of encryption operations
   */
  printSummary() {
    if (!isDebugEncryption()) {
      console.log('🔐 Encryption debugging is disabled')
      return
    }

    const summary = {
      totalOperations: this.logs.length,
      keyGenerations: this.logs.filter((l) => l.operation === 'KEY_GENERATION').length,
      keyLoadings: this.logs.filter((l) => l.operation === 'KEY_LOADING').length,
      messageEncryptions: this.logs.filter((l) => l.operation === 'MESSAGE_ENCRYPTION').length,
      messageDecryptions: this.logs.filter((l) => l.operation === 'MESSAGE_DECRYPTION').length,
      encryptionToggles: this.logs.filter((l) => l.operation === 'ENCRYPTION_TOGGLE').length,
      errors: this.logs.filter((l) => l.operation === 'ENCRYPTION_ERROR').length,
    }

    console.group('🔐 ENCRYPTION DEBUG SUMMARY')
    console.table(summary)
    console.groupEnd()
  }
}

// Export singleton instance
export const encryptionDebug = EncryptionDebug.getInstance()
