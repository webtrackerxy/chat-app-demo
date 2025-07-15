# Environment Configuration

This document describes the environment variables used in the chat application.

## Backend Environment Variables (.env)

The backend uses a `.env` file in the `chat-backend` directory:

```bash
# Backend Server Configuration
PORT=3000                           # Server port (default: 3000)
HOST=localhost                      # Server host (default: localhost)

# Base URL for API
BASE_URL=http://localhost:3000      # Full base URL for API endpoints

# File Upload Configuration
MAX_FILE_SIZE=10485760              # Maximum file size in bytes (default: 10MB)
UPLOAD_DIR=uploads                  # Directory for uploaded files (default: uploads)

# CORS Configuration
CORS_ORIGIN=*                       # CORS origin setting (default: *)
```

## Frontend Environment Variables (.env)

The frontend uses a `.env` file in the `chat-frontend` directory:

```bash
# Frontend Configuration
REACT_APP_API_URL=http://localhost:3000        # Backend API URL
REACT_APP_API_HOST=localhost                   # Backend host
REACT_APP_API_PORT=3000                        # Backend port

# WebSocket Configuration
REACT_APP_SOCKET_URL=http://localhost:3000     # WebSocket server URL

# File Upload Configuration
REACT_APP_MAX_FILE_SIZE=10485760               # Maximum file size in bytes (10MB)
```

## Configuration Files

### Backend Config Usage

The backend loads environment variables using `dotenv` and applies them to:

- **Server Port**: `process.env.PORT`
- **CORS Origin**: `process.env.CORS_ORIGIN`
- **File Upload Limits**: `process.env.MAX_FILE_SIZE`
- **Upload Directory**: `process.env.UPLOAD_DIR`

### Frontend Config Usage

The frontend uses a centralized config file at `src/config/env.ts`:

```typescript
export const config = {
  API_URL: process.env.REACT_APP_API_URL || 'http://localhost:3000',
  API_HOST: process.env.REACT_APP_API_HOST || 'localhost',
  API_PORT: process.env.REACT_APP_API_PORT || '3000',
  SOCKET_URL: process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000',
  MAX_FILE_SIZE: parseInt(process.env.REACT_APP_MAX_FILE_SIZE || '10485760'),
} as const;

// Helper functions
export const getApiUrl = () => config.API_URL;
export const getSocketUrl = () => config.SOCKET_URL;
export const getUploadUrl = () => `${config.API_URL}/api/upload`;
export const getFileUrl = (filename: string) => `${config.API_URL}/uploads/${filename}`;
export const getMaxFileSize = () => config.MAX_FILE_SIZE;
```

## Usage Examples

### Changing Server Port

To run the backend on a different port:

1. Update `chat-backend/.env`:
   ```bash
   PORT=3001
   BASE_URL=http://localhost:3001
   ```

2. Update `chat-frontend/.env`:
   ```bash
   REACT_APP_API_URL=http://localhost:3001
   REACT_APP_SOCKET_URL=http://localhost:3001
   ```

### Production Configuration

For production deployment:

1. **Backend (.env)**:
   ```bash
   PORT=80
   HOST=0.0.0.0
   BASE_URL=https://your-api-domain.com
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

2. **Frontend (.env)**:
   ```bash
   REACT_APP_API_URL=https://your-api-domain.com
   REACT_APP_SOCKET_URL=https://your-api-domain.com
   ```

### File Upload Limits

To change file upload limits:

1. **Backend (.env)**:
   ```bash
   MAX_FILE_SIZE=20971520  # 20MB
   ```

2. **Frontend (.env)**:
   ```bash
   REACT_APP_MAX_FILE_SIZE=20971520  # 20MB
   ```

## Files Updated

The following files were updated to use environment variables:

### Backend Files
- `index.js` - Server configuration, CORS, file upload limits
- `package.json` - Added dotenv dependency

### Frontend Files
- `src/config/env.ts` - New centralized config file
- `src/components/VoiceRecorder.tsx` - Upload URL
- `src/components/FilePicker.tsx` - Upload URL
- `src/services/fileUploadService.ts` - API URLs and file size limits
- `src/services/socketService.ts` - Socket server URL
- `src/api/chatApi.ts` - API base URL
- `src/context/SocketContext.tsx` - Default socket URL

## Important Notes

1. **Frontend Variables**: All React environment variables must be prefixed with `REACT_APP_`
2. **Default Values**: All environment variables have fallback defaults for development
3. **Security**: Never commit sensitive environment variables to version control
4. **Build Time**: Frontend environment variables are embedded at build time, not runtime
5. **dotenv**: Backend automatically loads `.env` file using the dotenv package

## Testing Configuration

To test the environment configuration:

1. **Backend**: Check server startup logs for environment variable loading
2. **Frontend**: Verify API calls use correct URLs from environment variables
3. **File Uploads**: Test file upload limits match environment settings