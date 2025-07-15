import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { useAudioRecorder, useAudioPlayer, RecordingPresets } from 'expo-audio';
import * as FileSystem from 'expo-file-system';
import { FileUploadService } from '../services/fileUploadService';
import { FileAttachment } from '../../../chat-types/src';
import { getUploadUrl } from '../config/env';

interface VoiceRecorderProps {
  onVoiceRecorded: (fileData: FileAttachment) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

interface VoiceRecorderModalProps {
  visible: boolean;
  onClose: () => void;
  onVoiceRecorded: (fileData: FileAttachment) => void;
  onError?: (error: string) => void;
}

export const VoiceRecorderModal: React.FC<VoiceRecorderModalProps> = ({
  visible,
  onClose,
  onVoiceRecorded,
  onError
}) => {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [uploading, setUploading] = useState(false);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      console.log('Starting recording...');
      
      // Start recording with expo-audio
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      
      setRecordingDuration(0);
      console.log('Recording started');

      // Start duration timer
      durationInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
      console.error('Recording start error:', error);
      onError?.(errorMessage);
    }
  };

  const stopRecording = async () => {
    try {
      console.log('Stopping recording...');
      
      // Clear duration timer
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      // Stop the recording
      await audioRecorder.stop();
      
      // Get the URI from the recorder
      const uri = audioRecorder.uri;
      console.log('Recording stopped, URI:', uri);
      
      if (uri) {
        await uploadVoiceMessage(uri);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to stop recording';
      console.error('Recording stop error:', error);
      onError?.(errorMessage);
    }
  };

  const cancelRecording = async () => {
    try {
      console.log('Cancelling recording...');
      
      // Clear duration timer
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }

      // Stop the recording (there's no separate cancel method)
      await audioRecorder.stop();
      setRecordingDuration(0);
      
      console.log('Recording cancelled');
    } catch (error) {
      console.error('Recording cancel error:', error);
    }
  };

  const uploadVoiceMessage = async (uri: string) => {
    try {
      setUploading(true);

      // Get file info
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Recording file not found');
      }

      // Create file name
      const fileName = `voice-message-${Date.now()}.m4a`;

      // Log file info for debugging
      console.log('File info:', fileInfo);
      console.log('Recording URI:', uri);

      console.log('Uploading voice message:', fileName);

      // Use FileSystem.uploadAsync for proper file upload
      const uploadResponse = await FileSystem.uploadAsync(
        getUploadUrl(),
        uri,
        {
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          mimeType: 'audio/m4a',
          parameters: {
            originalname: fileName,
          },
        }
      );

      console.log('Upload response:', uploadResponse);

      if (uploadResponse.status !== 200) {
        throw new Error(`Upload failed: ${uploadResponse.status} - ${uploadResponse.body}`);
      }

      const uploadResult = JSON.parse(uploadResponse.body);
      console.log('Upload success:', uploadResult);

      if (uploadResult && uploadResult.success && uploadResult.data) {
        // Add duration to file metadata
        const fileDataWithDuration = {
          ...uploadResult.data,
          duration: recordingDuration
        };
        
        onVoiceRecorded(fileDataWithDuration);
        onClose();
      } else {
        Alert.alert('Upload Failed', uploadResult?.error || 'Failed to upload voice message');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      console.error('Voice upload error:', error);
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setUploading(false);
      setRecordingDuration(0);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClose = () => {
    if (audioRecorder.isRecording) {
      cancelRecording();
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Voice Message</Text>
          
          {uploading ? (
            <View style={styles.uploadingContainer}>
              <Text style={styles.uploadingText}>Uploading...</Text>
            </View>
          ) : (
            <View style={styles.recordingContainer}>
              {audioRecorder.isRecording ? (
                <>
                  <View style={styles.recordingIndicator}>
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingText}>Recording...</Text>
                  </View>
                  
                  <Text style={styles.durationText}>
                    {formatDuration(recordingDuration)}
                  </Text>
                  
                  <View style={styles.recordingControls}>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={cancelRecording}
                    >
                      <Text style={styles.cancelButtonText}>✕</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.stopButton}
                      onPress={stopRecording}
                    >
                      <Text style={styles.stopButtonText}>⏹</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.instructionText}>
                    Tap the microphone to start recording
                  </Text>
                  
                  <TouchableOpacity
                    style={styles.startButton}
                    onPress={startRecording}
                  >
                    <Text style={styles.startButtonText}>🎤</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          {!audioRecorder.isRecording && !uploading && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onVoiceRecorded,
  onError,
  disabled = false
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handlePress = () => {
    if (!disabled) {
      setModalVisible(true);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.voiceRecorderButton, disabled && styles.voiceRecorderButtonDisabled]}
        onPress={handlePress}
        disabled={disabled}
      >
        <Text style={[styles.voiceRecorderButtonText, disabled && styles.voiceRecorderButtonTextDisabled]}>
          🎤
        </Text>
      </TouchableOpacity>

      <VoiceRecorderModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onVoiceRecorded={onVoiceRecorded}
        onError={onError}
      />
    </>
  );
};

const styles = StyleSheet.create({
  voiceRecorderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  voiceRecorderButtonDisabled: {
    opacity: 0.5,
  },
  voiceRecorderButtonText: {
    fontSize: 20,
  },
  voiceRecorderButtonTextDisabled: {
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
    alignItems: 'center',
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
    color: '#007AFF',
  },
  recordingContainer: {
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  durationText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  recordingControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  cancelButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  stopButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButtonText: {
    color: 'white',
    fontSize: 20,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  startButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 40,
  },
  closeButton: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: '#333',
  },
});