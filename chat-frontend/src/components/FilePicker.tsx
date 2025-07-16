import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { FileUploadService, FileUploadProgress } from '@services/fileUploadService'
import { FileAttachment } from '@chat-types'
import { getUploadUrl } from '@config/env'

interface FilePickerProps {
  onFileSelected: (fileData: FileAttachment) => void
  onError?: (error: string) => void
  disabled?: boolean
}

interface FilePickerModalProps {
  visible: boolean
  onClose: () => void
  onFileSelected: (fileData: FileAttachment) => void
  onError?: (error: string) => void
}

export const FilePickerModal: React.FC<FilePickerModalProps> = ({
  visible,
  onClose,
  onFileSelected,
  onError,
}) => {
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress | null>(null)

  const handleImagePicker = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to upload images.')
        return
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        await uploadFile(asset.uri, asset.fileName || 'image.jpg', asset.type || 'image/jpeg')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pick image'
      console.error('Image picker error:', error)
      onError?.(errorMessage)
    }
  }

  const handleVideoPicker = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Sorry, we need camera roll permissions to upload videos.')
        return
      }

      // Launch video picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: true,
        quality: 0.8,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        await uploadFile(asset.uri, asset.fileName || 'video.mp4', asset.type || 'video/mp4')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pick video'
      console.error('Video picker error:', error)
      onError?.(errorMessage)
    }
  }

  const handleDocumentPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      })

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        await uploadFile(asset.uri, asset.name, asset.mimeType || 'application/octet-stream')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to pick document'
      console.error('Document picker error:', error)
      onError?.(errorMessage)
    }
  }

  const uploadFile = async (uri: string, filename: string, mimeType: string) => {
    try {
      setUploading(true)
      setUploadProgress(null)

      console.log('FilePicker: Uploading file:', { uri, filename, mimeType })

      // Get file info first
      const fileInfo = await fetch(uri).catch(() => null)
      if (!fileInfo) {
        throw new Error('Could not access file')
      }

      console.log('FilePicker: File accessible, using FileSystem.uploadAsync')

      // Use FileSystem.uploadAsync directly like in VoiceRecorder
      const uploadResponse = await FileSystem.uploadAsync(getUploadUrl(), uri, {
        fieldName: 'file',
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        mimeType: mimeType,
        parameters: {
          originalname: filename,
        },
      })

      console.log('FilePicker: Upload response:', uploadResponse)

      if (uploadResponse.status !== 200) {
        throw new Error(`Upload failed: ${uploadResponse.status} - ${uploadResponse.body}`)
      }

      const uploadResult = JSON.parse(uploadResponse.body)
      console.log('FilePicker: Upload success:', uploadResult)

      if (uploadResult && uploadResult.success && uploadResult.data) {
        onFileSelected(uploadResult.data)
        onClose()
      } else {
        Alert.alert('Upload Failed', uploadResult?.error || 'Failed to upload file')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      console.error('FilePicker upload error:', error)
      Alert.alert('Upload Error', errorMessage)
    } finally {
      setUploading(false)
      setUploadProgress(null)
    }
  }

  return (
    <Modal visible={visible} transparent animationType='slide'>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select File</Text>

          {uploading && (
            <View style={styles.uploadingContainer}>
              <Text style={styles.uploadingText}>Uploading...</Text>
              {uploadProgress && (
                <Text style={styles.progressText}>
                  {uploadProgress.percentage}% (
                  {FileUploadService.formatFileSize(uploadProgress.loaded)} /{' '}
                  {FileUploadService.formatFileSize(uploadProgress.total)})
                </Text>
              )}
            </View>
          )}

          {!uploading && (
            <View style={styles.optionsContainer}>
              <TouchableOpacity style={styles.option} onPress={handleImagePicker}>
                <Text style={styles.optionIcon}>🖼️</Text>
                <Text style={styles.optionText}>Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.option} onPress={handleVideoPicker}>
                <Text style={styles.optionIcon}>🎥</Text>
                <Text style={styles.optionText}>Video</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.option} onPress={handleDocumentPicker}>
                <Text style={styles.optionIcon}>📄</Text>
                <Text style={styles.optionText}>Document</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={[styles.cancelButton, uploading && styles.cancelButtonDisabled]}
            onPress={onClose}
            disabled={uploading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

export const FilePicker: React.FC<FilePickerProps> = ({
  onFileSelected,
  onError,
  disabled = false,
}) => {
  const [modalVisible, setModalVisible] = useState(false)

  const handlePress = () => {
    if (!disabled) {
      setModalVisible(true)
    }
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.filePickerButton, disabled && styles.filePickerButtonDisabled]}
        onPress={handlePress}
        disabled={disabled}
      >
        <Text
          style={[styles.filePickerButtonText, disabled && styles.filePickerButtonTextDisabled]}
        >
          📎
        </Text>
      </TouchableOpacity>

      <FilePickerModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onFileSelected={onFileSelected}
        onError={onError}
      />
    </>
  )
}

const styles = StyleSheet.create({
  filePickerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  filePickerButtonDisabled: {
    opacity: 0.5,
  },
  filePickerButtonText: {
    fontSize: 20,
  },
  filePickerButtonTextDisabled: {
    color: '#ccc',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  uploadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  uploadingText: {
    fontSize: 16,
    marginBottom: 10,
    color: '#007AFF',
  },
  progressText: {
    fontSize: 12,
    color: '#666',
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  option: {
    alignItems: 'center',
    padding: 15,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    minWidth: 70,
    margin: 5,
  },
  optionIcon: {
    fontSize: 24,
    marginBottom: 5,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#333',
  },
})
