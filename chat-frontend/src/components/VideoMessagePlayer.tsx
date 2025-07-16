import React, { useState, useRef } from 'react'
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native'
import { Video, ResizeMode } from 'expo-av'
import { FileAttachment } from '@chat-types'
import { FileUploadService } from '@services/fileUploadService'

interface VideoMessagePlayerProps {
  file: FileAttachment
  isMyMessage: boolean
}

export const VideoMessagePlayer: React.FC<VideoMessagePlayerProps> = ({ file, isMyMessage }) => {
  const [status, setStatus] = useState<any>({})
  const [isLoading, setIsLoading] = useState(false)
  const videoRef = useRef<Video>(null)
  const videoUrl = FileUploadService.getFileUrl(file.filename)

  const handlePlayPause = async () => {
    if (!videoRef.current) return

    try {
      if (status.isPlaying) {
        await videoRef.current.pauseAsync()
      } else {
        await videoRef.current.playAsync()
      }
    } catch (error) {
      console.error('Error controlling video playback:', error)
      Alert.alert('Playback Error', 'Failed to control video playback')
    }
  }

  const handleVideoError = (error: any) => {
    console.error('Video error:', error)
    Alert.alert('Video Error', 'Failed to load video')
  }

  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const getProgressPercentage = () => {
    if (!status.durationMillis || !status.positionMillis) return 0
    return (status.positionMillis / status.durationMillis) * 100
  }

  return (
    <View
      style={[
        styles.container,
        isMyMessage ? styles.myMessageContainer : styles.otherMessageContainer,
      ]}
    >
      <View style={styles.videoContainer}>
        <Video
          ref={videoRef}
          style={styles.video}
          source={{ uri: videoUrl }}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={setStatus}
          onError={handleVideoError}
          onLoadStart={() => setIsLoading(true)}
          onLoad={() => setIsLoading(false)}
        />

        {/* Play/Pause Overlay */}
        <TouchableOpacity
          style={styles.playPauseOverlay}
          onPress={handlePlayPause}
          disabled={isLoading}
        >
          {isLoading ? (
            <Text style={styles.loadingText}>Loading...</Text>
          ) : (
            <Text style={styles.playPauseIcon}>{status.isPlaying ? '⏸️' : '▶️'}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Video Info */}
      <View style={styles.videoInfo}>
        <Text style={styles.fileName} numberOfLines={1}>
          {file.originalName}
        </Text>
        <Text style={styles.fileSize}>{FileUploadService.formatFileSize(file.size)}</Text>
      </View>

      {/* Progress Bar */}
      {status.durationMillis && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]} />
          </View>
          <Text style={styles.durationText}>
            {status.positionMillis ? formatDuration(status.positionMillis) : '0:00'} /{' '}
            {formatDuration(status.durationMillis)}
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 6,
    maxWidth: 180,
    minWidth: 140,
  },
  myMessageContainer: {
    backgroundColor: '#007AFF',
  },
  otherMessageContainer: {
    backgroundColor: '#e9ecef',
  },
  videoContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
    backgroundColor: '#000',
    borderRadius: 6,
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  playPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playPauseIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  loadingText: {
    fontSize: 14,
    color: '#ffffff',
  },
  videoInfo: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 6,
  },
  fileSize: {
    fontSize: 9,
    color: '#666',
  },
  progressContainer: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#ddd',
    borderRadius: 1,
    marginRight: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 1,
  },
  durationText: {
    fontSize: 9,
    color: '#666',
    minWidth: 50,
  },
})
