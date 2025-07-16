// Mock for expo-file-system module

const uploadAsync = jest.fn().mockResolvedValue({
  status: 200,
  body: JSON.stringify({
    success: true,
    data: { id: 'test-id', filename: 'test.txt' },
  }),
  headers: {},
  mimeType: 'application/json',
})

const getInfoAsync = jest.fn().mockResolvedValue({
  exists: true,
  isDirectory: false,
  uri: 'file://test.txt',
  size: 1024,
  modificationTime: Date.now(),
})

const deleteAsync = jest.fn().mockResolvedValue(true)

const readAsStringAsync = jest.fn().mockResolvedValue('test content')

const writeAsStringAsync = jest.fn().mockResolvedValue(true)

const copyAsync = jest.fn().mockResolvedValue(true)

const moveAsync = jest.fn().mockResolvedValue(true)

const makeDirectoryAsync = jest.fn().mockResolvedValue(true)

const readDirectoryAsync = jest.fn().mockResolvedValue(['file1.txt', 'file2.txt'])

// File system directories
const documentDirectory = 'file://document/'
const bundleDirectory = 'file://bundle/'
const cacheDirectory = 'file://cache/'

// Upload types
const FileSystemUploadType = {
  BINARY_CONTENT: 0,
  MULTIPART: 1,
}

// Download types
const FileSystemDownloadResumableState = {
  DOWNLOADING: 'DOWNLOADING',
  PAUSED: 'PAUSED',
  STOPPED: 'STOPPED',
  FINISHED: 'FINISHED',
}

module.exports = {
  uploadAsync,
  getInfoAsync,
  deleteAsync,
  readAsStringAsync,
  writeAsStringAsync,
  copyAsync,
  moveAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
  documentDirectory,
  bundleDirectory,
  cacheDirectory,
  FileSystemUploadType,
  FileSystemDownloadResumableState,
}
