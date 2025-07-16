// Mock for expo-image-picker module

const requestMediaLibraryPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
  canAskAgain: true,
  granted: true,
  expires: 'never',
})

const requestCameraPermissionsAsync = jest.fn().mockResolvedValue({
  status: 'granted',
  canAskAgain: true,
  granted: true,
  expires: 'never',
})

const launchImageLibraryAsync = jest.fn().mockResolvedValue({
  canceled: false,
  assets: [
    {
      uri: 'file://test-image.jpg',
      type: 'image',
      width: 1024,
      height: 768,
      fileSize: 102400,
      fileName: 'test-image.jpg',
      mimeType: 'image/jpeg',
    },
  ],
})

const launchCameraAsync = jest.fn().mockResolvedValue({
  canceled: false,
  assets: [
    {
      uri: 'file://camera-image.jpg',
      type: 'image',
      width: 1024,
      height: 768,
      fileSize: 204800,
      fileName: 'camera-image.jpg',
      mimeType: 'image/jpeg',
    },
  ],
})

// Media type options
const MediaTypeOptions = {
  All: 'All',
  Videos: 'Videos',
  Images: 'Images',
}

// Image quality options
const ImagePickerQuality = {
  Low: 0,
  Medium: 0.5,
  High: 1,
}

// Capture options
const CameraCaptureOptions = {
  Photo: 'photo',
  Video: 'video',
}

// Permission status
const PermissionStatus = {
  UNDETERMINED: 'undetermined',
  DENIED: 'denied',
  GRANTED: 'granted',
}

module.exports = {
  requestMediaLibraryPermissionsAsync,
  requestCameraPermissionsAsync,
  launchImageLibraryAsync,
  launchCameraAsync,
  MediaTypeOptions,
  ImagePickerQuality,
  CameraCaptureOptions,
  PermissionStatus,
}
