import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { VoiceRecorder } from '../../components/VoiceRecorder';
import { useAudioRecorder } from 'expo-audio';
import * as FileSystem from 'expo-file-system';

// Mock the modules
jest.mock('expo-audio');
jest.mock('expo-file-system');

const mockUseAudioRecorder = useAudioRecorder as jest.MockedFunction<typeof useAudioRecorder>;
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('VoiceRecorder Component', () => {
  const mockOnVoiceRecorded = jest.fn();
  const mockOnError = jest.fn();

  const mockAudioRecorder = {
    isRecording: false,
    uri: null,
    prepareToRecordAsync: jest.fn(),
    record: jest.fn(),
    stop: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Alert.alert = jest.fn();
    mockUseAudioRecorder.mockReturnValue(mockAudioRecorder as any);
  });

  it('renders voice recorder button correctly', () => {
    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    expect(getByText('🎤')).toBeTruthy();
  });

  it('opens modal when button is pressed', () => {
    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤'));
    
    expect(getByText('Voice Message')).toBeTruthy();
    expect(getByText('Tap the microphone to start recording')).toBeTruthy();
  });

  it('starts recording when microphone button is pressed', async () => {
    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤')); // Open modal
    
    const micButton = getByText('🎤'); // Recording button in modal
    fireEvent.press(micButton);

    await waitFor(() => {
      expect(mockAudioRecorder.prepareToRecordAsync).toHaveBeenCalled();
      expect(mockAudioRecorder.record).toHaveBeenCalled();
    });
  });

  it('shows recording state when recording', () => {
    mockAudioRecorder.isRecording = true;
    
    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤'));
    
    expect(getByText('Recording...')).toBeTruthy();
    expect(getByText('0:00')).toBeTruthy();
    expect(getByText('✕')).toBeTruthy(); // Cancel button
    expect(getByText('⏹')).toBeTruthy(); // Stop button
  });

  it('stops recording and uploads when stop button is pressed', async () => {
    const mockUri = 'file://recording-123.m4a';
    mockAudioRecorder.uri = mockUri;
    mockAudioRecorder.isRecording = true;

    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 50000,
      modificationTime: Date.now(),
      uri: mockUri
    });

    mockFileSystem.uploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({
        success: true,
        data: {
          id: 'voice-id',
          originalName: 'voice-message.m4a',
          filename: 'uploaded-voice.m4a',
          mimeType: 'audio/m4a',
          size: 50000,
          uploadedAt: new Date().toISOString(),
          url: '/uploads/uploaded-voice.m4a',
          type: 'audio'
        }
      })
    });

    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤')); // Open modal
    fireEvent.press(getByText('⏹')); // Stop recording

    await waitFor(() => {
      expect(mockAudioRecorder.stop).toHaveBeenCalled();
      expect(mockFileSystem.uploadAsync).toHaveBeenCalledWith(
        'http://localhost:3000/api/upload',
        mockUri,
        expect.objectContaining({
          fieldName: 'file',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART
        })
      );
    });

    await waitFor(() => {
      expect(mockOnVoiceRecorded).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'voice-id',
          type: 'audio',
          duration: expect.any(Number)
        })
      );
    });
  });

  it('cancels recording when cancel button is pressed', async () => {
    mockAudioRecorder.isRecording = true;

    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤')); // Open modal
    fireEvent.press(getByText('✕')); // Cancel recording

    await waitFor(() => {
      expect(mockAudioRecorder.stop).toHaveBeenCalled();
      expect(mockOnVoiceRecorded).not.toHaveBeenCalled();
    });
  });

  it('handles recording duration timer', async () => {
    jest.useFakeTimers();
    
    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤')); // Open modal
    fireEvent.press(getByText('🎤')); // Start recording

    // Fast-forward time
    jest.advanceTimersByTime(3000);

    await waitFor(() => {
      expect(getByText('0:03')).toBeTruthy();
    });

    jest.useRealTimers();
  });

  it('handles upload failure gracefully', async () => {
    const mockUri = 'file://recording-123.m4a';
    mockAudioRecorder.uri = mockUri;
    mockAudioRecorder.isRecording = true;

    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 50000,
      modificationTime: Date.now(),
      uri: mockUri
    });

    mockFileSystem.uploadAsync.mockResolvedValue({
      status: 500,
      body: JSON.stringify({
        success: false,
        error: 'Upload failed'
      })
    });

    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤')); // Open modal
    fireEvent.press(getByText('⏹')); // Stop recording

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Upload Error',
        expect.stringContaining('Upload failed')
      );
    });
  });

  it('handles recording permission errors', async () => {
    mockAudioRecorder.prepareToRecordAsync.mockRejectedValue(
      new Error('Permission denied')
    );

    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤')); // Open modal
    fireEvent.press(getByText('🎤')); // Start recording

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith('Permission denied');
    });
  });

  it('disables button when disabled prop is true', () => {
    const { getByText } = render(
      <VoiceRecorder 
        onVoiceRecorded={mockOnVoiceRecorded} 
        onError={mockOnError} 
        disabled={true}
      />
    );

    const button = getByText('🎤').parent;
    expect(button?.props.accessibilityState?.disabled).toBe(true);
  });

  it('shows uploading state during upload', async () => {
    const mockUri = 'file://recording-123.m4a';
    mockAudioRecorder.uri = mockUri;
    mockAudioRecorder.isRecording = true;

    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: true,
      isDirectory: false,
      size: 50000,
      modificationTime: Date.now(),
      uri: mockUri
    });

    // Mock a delayed response
    mockFileSystem.uploadAsync.mockImplementation(() => 
      new Promise(resolve => 
        setTimeout(() => resolve({
          status: 200,
          body: JSON.stringify({
            success: true,
            data: { id: 'test', type: 'audio' }
          })
        }), 1000)
      )
    );

    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤')); // Open modal
    fireEvent.press(getByText('⏹')); // Stop recording

    await waitFor(() => {
      expect(getByText('Uploading...')).toBeTruthy();
    });
  });

  it('handles missing recording file gracefully', async () => {
    const mockUri = 'file://recording-123.m4a';
    mockAudioRecorder.uri = mockUri;
    mockAudioRecorder.isRecording = true;

    mockFileSystem.getInfoAsync.mockResolvedValue({
      exists: false,
      isDirectory: false,
      size: 0,
      modificationTime: Date.now(),
      uri: mockUri
    });

    const { getByText } = render(
      <VoiceRecorder onVoiceRecorded={mockOnVoiceRecorded} onError={mockOnError} />
    );

    fireEvent.press(getByText('🎤')); // Open modal
    fireEvent.press(getByText('⏹')); // Stop recording

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Upload Error',
        expect.stringContaining('Recording file not found')
      );
    });
  });
});