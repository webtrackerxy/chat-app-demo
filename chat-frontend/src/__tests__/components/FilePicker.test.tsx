import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { FilePicker } from '../../components/FilePicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

// Mock the modules
jest.mock('expo-image-picker');
jest.mock('expo-document-picker');
jest.mock('expo-file-system');

const mockImagePicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockDocumentPicker = DocumentPicker as jest.Mocked<typeof DocumentPicker>;
const mockFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

describe('FilePicker Component', () => {
  const mockOnFileSelected = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    Alert.alert = jest.fn();
  });

  it('renders file picker button correctly', () => {
    const { getByText } = render(
      <FilePicker onFileSelected={mockOnFileSelected} onError={mockOnError} />
    );

    expect(getByText('📎')).toBeTruthy();
  });

  it('opens modal when button is pressed', () => {
    const { getByText } = render(
      <FilePicker onFileSelected={mockOnFileSelected} onError={mockOnError} />
    );

    fireEvent.press(getByText('📎'));
    
    expect(getByText('Select File')).toBeTruthy();
    expect(getByText('Photo')).toBeTruthy();
    expect(getByText('Video')).toBeTruthy();
    expect(getByText('Document')).toBeTruthy();
  });

  it('handles image selection successfully', async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never'
    });

    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file://test-image.jpg',
        fileName: 'test-image.jpg',
        type: 'image/jpeg',
        width: 100,
        height: 100,
        fileSize: 1024
      }]
    });

    mockFileSystem.uploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({
        success: true,
        data: {
          id: 'test-id',
          originalName: 'test-image.jpg',
          filename: 'uploaded-image.jpg',
          mimeType: 'image/jpeg',
          size: 1024,
          uploadedAt: new Date().toISOString(),
          url: '/uploads/uploaded-image.jpg',
          type: 'image'
        }
      })
    });

    const { getByText } = render(
      <FilePicker onFileSelected={mockOnFileSelected} onError={mockOnError} />
    );

    fireEvent.press(getByText('📎'));
    fireEvent.press(getByText('Photo'));

    await waitFor(() => {
      expect(mockOnFileSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-id',
          type: 'image'
        })
      );
    });
  });

  it('handles video selection successfully', async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never'
    });

    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file://test-video.mp4',
        fileName: 'test-video.mp4',
        type: 'video/mp4',
        width: 1920,
        height: 1080,
        duration: 30000
      }]
    });

    mockFileSystem.uploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({
        success: true,
        data: {
          id: 'test-video-id',
          originalName: 'test-video.mp4',
          filename: 'uploaded-video.mp4',
          mimeType: 'video/mp4',
          size: 5120000,
          uploadedAt: new Date().toISOString(),
          url: '/uploads/uploaded-video.mp4',
          type: 'video'
        }
      })
    });

    const { getByText } = render(
      <FilePicker onFileSelected={mockOnFileSelected} onError={mockOnError} />
    );

    fireEvent.press(getByText('📎'));
    fireEvent.press(getByText('Video'));

    await waitFor(() => {
      expect(mockOnFileSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-video-id',
          type: 'video'
        })
      );
    });
  });

  it('handles document selection successfully', async () => {
    mockDocumentPicker.getDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file://test-document.pdf',
        name: 'test-document.pdf',
        mimeType: 'application/pdf',
        size: 2048
      }]
    });

    mockFileSystem.uploadAsync.mockResolvedValue({
      status: 200,
      body: JSON.stringify({
        success: true,
        data: {
          id: 'test-doc-id',
          originalName: 'test-document.pdf',
          filename: 'uploaded-document.pdf',
          mimeType: 'application/pdf',
          size: 2048,
          uploadedAt: new Date().toISOString(),
          url: '/uploads/uploaded-document.pdf',
          type: 'document'
        }
      })
    });

    const { getByText } = render(
      <FilePicker onFileSelected={mockOnFileSelected} onError={mockOnError} />
    );

    fireEvent.press(getByText('📎'));
    fireEvent.press(getByText('Document'));

    await waitFor(() => {
      expect(mockOnFileSelected).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-doc-id',
          type: 'document'
        })
      );
    });
  });

  it('handles permission denial gracefully', async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'denied',
      canAskAgain: false,
      granted: false,
      expires: 'never'
    });

    const { getByText } = render(
      <FilePicker onFileSelected={mockOnFileSelected} onError={mockOnError} />
    );

    fireEvent.press(getByText('📎'));
    fireEvent.press(getByText('Photo'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Permission denied',
        'Sorry, we need camera roll permissions to upload images.'
      );
    });
  });

  it('handles upload failure gracefully', async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never'
    });

    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [{
        uri: 'file://test-image.jpg',
        fileName: 'test-image.jpg',
        type: 'image/jpeg',
        width: 100,
        height: 100
      }]
    });

    mockFileSystem.uploadAsync.mockResolvedValue({
      status: 500,
      body: JSON.stringify({
        success: false,
        error: 'Upload failed'
      })
    });

    const { getByText } = render(
      <FilePicker onFileSelected={mockOnFileSelected} onError={mockOnError} />
    );

    fireEvent.press(getByText('📎'));
    fireEvent.press(getByText('Photo'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Upload Error',
        expect.stringContaining('Upload failed')
      );
    });
  });

  it('disables button when disabled prop is true', () => {
    const { getByText } = render(
      <FilePicker 
        onFileSelected={mockOnFileSelected} 
        onError={mockOnError} 
        disabled={true}
      />
    );

    const button = getByText('📎').parent;
    expect(button?.props.accessibilityState?.disabled).toBe(true);
  });

  it('handles user cancellation', async () => {
    mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      status: 'granted',
      canAskAgain: true,
      granted: true,
      expires: 'never'
    });

    mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: []
    });

    const { getByText } = render(
      <FilePicker onFileSelected={mockOnFileSelected} onError={mockOnError} />
    );

    fireEvent.press(getByText('📎'));
    fireEvent.press(getByText('Photo'));

    await waitFor(() => {
      expect(mockOnFileSelected).not.toHaveBeenCalled();
    });
  });
});