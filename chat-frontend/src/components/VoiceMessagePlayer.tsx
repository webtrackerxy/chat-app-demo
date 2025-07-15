import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { FileAttachment } from '../../../chat-types/src';
import { FileUploadService } from '../services/fileUploadService';

interface VoiceMessagePlayerProps {
  file: FileAttachment;
  isMyMessage: boolean;
}

export const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({ 
  file, 
  isMyMessage 
}) => {
  const audioUri = FileUploadService.getFileUrl(file.filename);
  const player = useAudioPlayer(audioUri);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playPause = async () => {
    try {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (error) {
      console.error('Play/pause error:', error);
      setError('Playback failed');
    }
  };

  const stop = async () => {
    try {
      player.pause();
      player.seekTo(0);
    } catch (error) {
      console.error('Stop error:', error);
    }
  };

  const seek = async (percentage: number) => {
    try {
      if (player.duration > 0) {
        const seekPosition = player.duration * percentage;
        player.seekTo(seekPosition);
      }
    } catch (error) {
      console.error('Seek error:', error);
    }
  };

  const handleProgressBarPress = (event: any) => {
    const { width } = event.nativeEvent.target.measure?.() || { width: 200 };
    const { locationX } = event.nativeEvent;
    const percentage = locationX / width;
    seek(Math.max(0, Math.min(1, percentage)));
  };

  const duration = player.duration || file.duration || 0;
  const position = player.currentTime || 0;
  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  if (error) {
    return (
      <View style={[
        styles.container,
        isMyMessage ? styles.myMessage : styles.otherMessage
      ]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>Audio playback failed</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      isMyMessage ? styles.myMessage : styles.otherMessage
    ]}>
      <View style={styles.playerContainer}>
        {/* Play/Pause Button */}
        <TouchableOpacity
          style={[
            styles.playButton,
            isLoading && styles.playButtonDisabled
          ]}
          onPress={playPause}
          disabled={isLoading}
        >
          <Text style={styles.playButtonText}>
            {isLoading ? '⏳' : player.playing ? '⏸️' : '▶️'}
          </Text>
        </TouchableOpacity>

        {/* Audio Info and Progress */}
        <View style={styles.audioInfo}>
          <View style={styles.audioHeader}>
            <Text style={[
              styles.audioTitle,
              isMyMessage ? styles.myMessageText : styles.otherMessageText
            ]}>
              Voice Message
            </Text>
            <Text style={[
              styles.audioTime,
              isMyMessage ? styles.myMessageTextSecondary : styles.otherMessageTextSecondary
            ]}>
              {formatTime(position)} / {formatTime(duration)}
            </Text>
          </View>

          {/* Progress Bar */}
          <TouchableOpacity 
            style={styles.progressBar}
            onPress={handleProgressBarPress}
            activeOpacity={0.7}
          >
            <View style={[
              styles.progressTrack,
              isMyMessage ? styles.myMessageProgressTrack : styles.otherMessageProgressTrack
            ]}>
              <View 
                style={[
                  styles.progressFill,
                  isMyMessage ? styles.myMessageProgressFill : styles.otherMessageProgressFill,
                  { width: `${progressPercentage}%` }
                ]} 
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stop Button */}
        {player.playing && (
          <TouchableOpacity
            style={styles.stopButton}
            onPress={stop}
          >
            <Text style={styles.stopButtonText}>⏹️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* File Size */}
      <Text style={[
        styles.fileSize,
        isMyMessage ? styles.myMessageTextSecondary : styles.otherMessageTextSecondary
      ]}>
        {FileUploadService.formatFileSize(file.size)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minWidth: 160,
    maxWidth: 220,
    borderRadius: 12,
    padding: 10,
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
  
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  playButtonDisabled: {
    opacity: 0.5,
  },
  playButtonText: {
    fontSize: 14,
  },
  
  stopButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  stopButtonText: {
    fontSize: 12,
  },
  
  audioInfo: {
    flex: 1,
  },
  audioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  audioTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  audioTime: {
    fontSize: 10,
  },
  
  progressBar: {
    width: '100%',
    height: 16,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    width: '100%',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  
  fileSize: {
    fontSize: 10,
    textAlign: 'right',
    marginTop: 4,
  },
  
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  errorIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#FF3B30',
  },
  
  // Text colors for different message types
  myMessageText: {
    color: 'white',
  },
  myMessageTextSecondary: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherMessageText: {
    color: '#333',
  },
  otherMessageTextSecondary: {
    color: '#666',
  },
  
  // Progress bar colors for different message types
  myMessageProgressTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  myMessageProgressFill: {
    backgroundColor: 'white',
  },
  otherMessageProgressTrack: {
    backgroundColor: '#ddd',
  },
  otherMessageProgressFill: {
    backgroundColor: '#007AFF',
  },
});