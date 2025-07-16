// Mock for expo-av module
const React = require('react')

// Mock Video component
const Video = React.forwardRef((props, ref) => {
  const mockVideoRef = {
    playAsync: jest.fn().mockResolvedValue({}),
    pauseAsync: jest.fn().mockResolvedValue({}),
    stopAsync: jest.fn().mockResolvedValue({}),
    setPositionAsync: jest.fn().mockResolvedValue({}),
    loadAsync: jest.fn().mockResolvedValue({}),
    unloadAsync: jest.fn().mockResolvedValue({}),
    getStatusAsync: jest.fn().mockResolvedValue({
      isLoaded: true,
      isPlaying: false,
      positionMillis: 0,
      durationMillis: 10000,
    }),
  }

  // Expose ref methods
  React.useImperativeHandle(ref, () => mockVideoRef)

  // Simulate video element
  return React.createElement('div', {
    ...props,
    'data-testid': 'mock-video',
    style: {
      width: '100%',
      height: '100%',
      backgroundColor: '#000',
      ...props.style,
    },
  })
})

// Resize modes
const ResizeMode = {
  CONTAIN: 'contain',
  COVER: 'cover',
  STRETCH: 'stretch',
}

// Audio modes
const Audio = {
  setAudioModeAsync: jest.fn().mockResolvedValue({}),
  getAudioModeAsync: jest.fn().mockResolvedValue({
    allowsRecordingIOS: false,
    interruptionModeIOS: 'DoNotMix',
    playsInSilentModeIOS: false,
    interruptionModeAndroid: 'DoNotMix',
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  }),
  RECORDING_OPTIONS_PRESET_HIGH_QUALITY: {
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
    },
  },
}

// Recording class mock
class Recording {
  constructor() {
    this.prepareToRecordAsync = jest.fn().mockResolvedValue({})
    this.startAsync = jest.fn().mockResolvedValue({})
    this.pauseAsync = jest.fn().mockResolvedValue({})
    this.stopAndUnloadAsync = jest.fn().mockResolvedValue({
      uri: 'file://recording.m4a',
      duration: 5000,
    })
    this.getStatusAsync = jest.fn().mockResolvedValue({
      canRecord: true,
      isRecording: false,
      isDoneRecording: false,
      durationMillis: 0,
    })
  }
}

// Playback status
const AVPlaybackStatus = {
  isLoaded: true,
  isPlaying: false,
  positionMillis: 0,
  durationMillis: 10000,
}

module.exports = {
  Video,
  ResizeMode,
  Audio,
  Recording,
  AVPlaybackStatus,
}
