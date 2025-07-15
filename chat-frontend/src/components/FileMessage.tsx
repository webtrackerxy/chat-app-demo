import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking, Alert } from 'react-native';
import { FileAttachment } from '../../../chat-types/src';
import { FileUploadService } from '../services/fileUploadService';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { VideoMessagePlayer } from './VideoMessagePlayer';

interface FileMessageProps {
  file: FileAttachment;
  isMyMessage: boolean;
}

export const FileMessage: React.FC<FileMessageProps> = ({ file, isMyMessage }) => {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const handleDownload = async () => {
    try {
      const downloadUrl = FileUploadService.getDownloadUrl(file.filename);
      const supported = await Linking.canOpenURL(downloadUrl);
      
      if (supported) {
        await Linking.openURL(downloadUrl);
      } else {
        Alert.alert('Error', 'Cannot open this file');
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Error', 'Failed to download file');
    }
  };

  const renderImagePreview = () => {
    if (imageError) {
      return (
        <View style={styles.imageError}>
          <Text style={styles.imageErrorText}>🖼️</Text>
          <Text style={styles.imageErrorText}>Failed to load image</Text>
        </View>
      );
    }

    return (
      <Image
        source={{ uri: FileUploadService.getFileUrl(file.filename) }}
        style={styles.imagePreview}
        onLoad={() => setImageLoading(false)}
        onError={() => {
          setImageLoading(false);
          setImageError(true);
        }}
        resizeMode="cover"
      />
    );
  };

  const renderFileInfo = () => (
    <View style={styles.fileInfo}>
      <Text style={styles.fileIcon}>
        {FileUploadService.getFileIcon(file.mimeType)}
      </Text>
      <View style={styles.fileDetails}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.originalName}
        </Text>
        <Text style={styles.fileSize}>
          {FileUploadService.formatFileSize(file.size)}
        </Text>
      </View>
    </View>
  );

  const renderContent = () => {
    switch (file.type) {
      case 'image':
        return (
          <View style={styles.imageContainer}>
            {renderImagePreview()}
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={handleDownload}
            >
              <Text style={styles.downloadButtonText}>View Full Size</Text>
            </TouchableOpacity>
          </View>
        );

      case 'audio':
        return (
          <VoiceMessagePlayer file={file} isMyMessage={isMyMessage} />
        );

      case 'video':
        return (
          <VideoMessagePlayer file={file} isMyMessage={isMyMessage} />
        );

      case 'document':
      default:
        return (
          <TouchableOpacity
            style={styles.documentContainer}
            onPress={handleDownload}
          >
            {renderFileInfo()}
            <Text style={styles.downloadText}>Tap to download</Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <View style={[
      styles.container,
      isMyMessage ? styles.myMessage : styles.otherMessage
    ]}>
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    maxWidth: '70%',
    borderRadius: 8,
    padding: 6,
    marginVertical: 2,
  },
  myMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#f0f0f0',
    alignSelf: 'flex-start',
  },
  
  // Image styles
  imageContainer: {
    minWidth: 120,
    maxWidth: 160,
  },
  imagePreview: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  imageError: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageErrorText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  downloadButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    alignItems: 'center',
  },
  downloadButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  
  // Audio styles
  audioContainer: {
    minWidth: 140,
    maxWidth: 180,
  },
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  audioIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  audioDuration: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  playButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 6,
    alignItems: 'center',
  },
  playButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Document styles
  documentContainer: {
    minWidth: 140,
    maxWidth: 180,
    paddingVertical: 4,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  fileIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  fileSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  downloadText: {
    fontSize: 12,
    color: '#007AFF',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});