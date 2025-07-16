// Mock for expo-audio module
const mockAudioRecorder = {
  record: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  isRecording: false,
  uri: null,
  duration: 0,
}

const mockAudioPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
  seekTo: jest.fn(),
  playing: false,
  currentTime: 0,
  duration: 0,
  volume: 1.0,
}

const useAudioRecorder = jest.fn(() => mockAudioRecorder)
const useAudioPlayer = jest.fn(() => mockAudioPlayer)

const RecordingPresets = {
  HIGH_QUALITY: {
    android: {
      extension: '.m4a',
      outputFormat: 'mpeg_4',
      audioEncoder: 'aac',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: 'mpeg4AAC',
      audioQuality: 'MAX',
      sampleRate: 44100,
      numberOfChannels: 2,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      extension: '.m4a',
      mimeType: 'audio/mp4',
      bitsPerSecond: 128000,
    },
  },
}

// Export the mock objects for tests to access
module.exports = {
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
  __mockAudioRecorder: mockAudioRecorder,
  __mockAudioPlayer: mockAudioPlayer,
}
