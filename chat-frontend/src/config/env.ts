// Environment configuration
export const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  API_HOST: process.env.REACT_APP_API_HOST || 'localhost',
  API_PORT: process.env.REACT_APP_API_PORT || '3000',
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000',
  MAX_FILE_SIZE: parseInt(process.env.REACT_APP_MAX_FILE_SIZE || '10485760'), // 10MB
} as const

// Helper functions
export const getApiUrl = () => config.API_URL
export const getSocketUrl = () => config.SOCKET_URL
export const getUploadUrl = () => `${config.API_URL}/api/upload`
export const getFileUrl = (filename: string) => `${config.API_URL}/uploads/${filename}`
export const getMaxFileSize = () => config.MAX_FILE_SIZE
