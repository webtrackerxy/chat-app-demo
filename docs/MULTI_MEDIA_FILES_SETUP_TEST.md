# Multi-Media Files Setup and Testing Guide

This guide documents the complete setup and testing process for multimedia file sharing functionality including images, videos, audio recordings, and document uploads.

## ✅ Implementation Complete

### Phase 1: Backend File Upload System

#### 1. File Upload Dependencies
```bash
cd chat-backend
npm install multer uuid dotenv
```

#### 2. Backend Features Implemented
- **Multer File Upload**: Handles multipart/form-data uploads
- **File Type Validation**: Supports images, videos, audio, and documents
- **File Storage**: Local file system with unique naming
- **File Serving**: Static file serving and download endpoints
- **Environment Configuration**: Configurable upload limits and directories
- **WebSocket Integration**: Real-time file message broadcasting

#### 3. Supported File Types
- **Images**: JPEG, JPG, PNG, GIF, WebP (max 10MB)
- **Videos**: MP4, QuickTime, MPEG, WebM, AVI, MOV (max 10MB)
- **Audio**: MP3, WAV, OGG, WebM, M4A (max 10MB)
- **Documents**: PDF, TXT, DOC, DOCX, XLS, XLSX (max 10MB)

### Phase 2: Frontend File Upload Components

#### 1. Frontend Dependencies
```bash
cd chat-frontend
npm install expo-image-picker expo-document-picker expo-audio expo-file-system
```

#### 2. Core Components Created
- **FilePicker**: Image, video, and document selection
- **VoiceRecorder**: Audio recording with expo-audio
- **VoiceMessagePlayer**: Audio playback with controls
- **VideoMessagePlayer**: Video playback with controls
- **FileMessage**: Universal file message display
- **FileUploadService**: Centralized upload handling

#### 3. Environment Configuration
- **Frontend (.env)**: API URLs and file size limits
- **Backend (.env)**: Server configuration and upload settings
- **Centralized Config**: Environment variable management

## 🚀 Testing Procedures

### 1. Environment Setup

#### Backend Server Setup
```bash
cd chat-backend

# Check environment variables
cat .env
# Should show:
# PORT=3000
# HOST=localhost
# BASE_URL=http://localhost:3000
# MAX_FILE_SIZE=10485760
# UPLOAD_DIR=uploads
# CORS_ORIGIN=*

# Start backend server
npm start
# Should display: "Chat backend server with WebSocket running on port 3000"
```

#### Frontend Application Setup
```bash
cd chat-frontend

# Check environment variables
cat .env
# Should show:
# REACT_APP_API_URL=http://localhost:3000
# REACT_APP_SOCKET_URL=http://localhost:3000
# REACT_APP_MAX_FILE_SIZE=10485760

# Start frontend application
npm start
```

### 2. File Upload Testing

#### Image Upload Test
1. **Open chat application**
2. **Click attachment button (📎)** in message input
3. **Select "Photo"** from file picker modal
4. **Choose image** from device gallery
5. **Verify upload progress** indicator appears
6. **Check image message** appears in chat with:
   - Image preview (120px height)
   - "View Full Size" button
   - File size display
   - Real-time appearance in other browser tabs

#### Video Upload Test
1. **Click attachment button (📎)**
2. **Select "Video"** from file picker modal
3. **Choose video** from device gallery
4. **Verify video message** displays with:
   - Video player (100px height)
   - Play/pause controls
   - Progress bar
   - Duration display
   - File size information

#### Document Upload Test
1. **Click attachment button (📎)**
2. **Select "Document"** from file picker modal
3. **Choose document** (PDF, DOC, etc.)
4. **Verify document message** shows:
   - File icon (📄)
   - File name (truncated if long)
   - File size
   - "Tap to download" text

### 3. Voice Recording Testing

#### Voice Recording Test
1. **Click microphone button (🎤)** in message input
2. **Voice recording modal** should open with:
   - "Voice Message" title
   - "Tap the microphone to start recording" instruction
   - Microphone button
3. **Press microphone button** to start recording
4. **Verify recording state** shows:
   - "Recording..." status
   - Timer counting up (0:01, 0:02, etc.)
   - Stop button (⏹) 
   - Cancel button (✕)
5. **Test controls**:
   - **Stop button**: Stops recording and uploads
   - **Cancel button**: Cancels without uploading

#### Voice Playback Test
1. **After successful recording**, voice message appears with:
   - Play button (▶️)
   - "Voice Message" label
   - Duration display (0:00 / total)
   - Progress bar
   - File size
2. **Click play button** to test playback
3. **Verify audio controls**:
   - Play/pause toggle
   - Progress tracking
   - Duration updates
   - Stop button when playing

### 4. Real-Time Functionality Testing

#### Multi-User File Sharing
1. **Open chat in multiple browser tabs**
2. **Set different usernames** for each tab
3. **Join same conversation**
4. **Upload file in one tab**
5. **Verify file message** appears instantly in other tabs
6. **Test with different file types**:
   - Images appear with previews
   - Videos show with players
   - Documents display with icons
   - Voice messages appear with players

#### Real-Time Voice Recording
1. **Record voice message** in one tab
2. **Verify voice message** appears in real-time in other tabs
3. **Test playback** from different tabs
4. **Check upload progress** is visible during recording

### 5. Error Handling Testing

#### File Type Validation
1. **Try uploading unsupported file** (e.g., .exe, .js)
2. **Should show error**: "File type [type] is not supported"
3. **Upload should be rejected**

#### File Size Limits
1. **Try uploading file larger than 10MB**
2. **Should show error**: "File size must be less than 10MB"
3. **Upload should be rejected**

#### Permission Testing
1. **Deny camera/microphone permissions**
2. **Try to upload image**: Should show permission error
3. **Try to record voice**: Should show permission error
4. **Grant permissions and retry**: Should work normally

#### Network Error Testing
1. **Disconnect internet during upload**
2. **Should show upload error**
3. **Reconnect and retry**: Should work normally

### 6. Performance Testing

#### Upload Performance
1. **Test various file sizes**:
   - Small files (< 1MB): Should upload quickly
   - Medium files (1-5MB): Should show progress
   - Large files (5-10MB): Should handle gracefully
2. **Monitor upload progress accuracy**
3. **Test concurrent uploads** from multiple users

#### Playback Performance
1. **Test voice message playback**:
   - Immediate playback start
   - Smooth progress tracking
   - Accurate duration display
2. **Test video playback**:
   - Quick loading
   - Smooth playback controls
   - Progress bar accuracy

### 7. UI/UX Testing

#### Message Size Optimization
1. **Verify compact message boxes**:
   - Images: 120px height max
   - Videos: 100px height max
   - Voice messages: Compact player
   - Documents: Minimal file info
2. **Check mobile responsiveness**
3. **Verify proper spacing** between messages

#### File Download Testing
1. **Click "View Full Size"** on images
2. **Should open/download** original image
3. **Click document messages**
4. **Should download** the file
5. **Verify download URLs** work correctly

### 8. Integration Testing

#### WebSocket File Messages
1. **Upload file** and verify WebSocket event:
   ```javascript
   // Should emit: 'send_file_message'
   // Should receive: 'new_message' with file data
   ```
2. **Check message structure**:
   ```javascript
   {
     id: "uuid",
     text: "Image/Video/Voice message/filename",
     type: "image|video|audio|document",
     file: {
       id: "file-uuid",
       originalName: "filename.ext",
       filename: "server-filename.ext",
       mimeType: "type/subtype",
       size: 12345,
       url: "/uploads/filename"
     }
   }
   ```

#### API Endpoint Testing
```bash
# Test file upload endpoint
curl -X POST http://localhost:3000/api/upload \
  -F "file=@test-image.jpg" \
  -H "Content-Type: multipart/form-data"

# Should return:
# {
#   "success": true,
#   "data": {
#     "id": "uuid",
#     "originalName": "test-image.jpg",
#     "filename": "file-timestamp-random.jpg",
#     "mimeType": "image/jpeg",
#     "size": 12345,
#     "type": "image",
#     "url": "/uploads/file-timestamp-random.jpg"
#   }
# }

# Test file serving
curl http://localhost:3000/uploads/filename.jpg
# Should return the file content

# Test file download
curl http://localhost:3000/api/files/filename.jpg
# Should download the file
```

### 9. Test Scripts Execution

#### Frontend Component Tests
```bash
cd chat-frontend

# Test FilePicker component
npm test -- FilePicker.test.tsx

# Test VoiceRecorder component
npm test -- VoiceRecorder.test.tsx

# Test media upload integration
npm test -- mediaUpload.test.ts

# Run all media-related tests
npm test -- --testPathPattern="(FilePicker|VoiceRecorder|mediaUpload)"
```

#### Backend Upload Tests
```bash
cd chat-backend

# Test media upload endpoints
npm test -- mediaUpload.test.js

# Test file serving
npm test -- --testNamePattern="File Serving"

# Test file validation
npm test -- --testNamePattern="File Metadata"
```

### 10. Troubleshooting

#### Common Issues

**File Upload Fails**
- Check backend server is running
- Verify upload directory exists and is writable
- Check file size under 10MB limit
- Verify supported file type

**Voice Recording Issues**
- Check microphone permissions
- Verify expo-audio installation
- Check device audio capabilities
- Test with different audio formats

**Real-Time Not Working**
- Verify WebSocket connection (🟢 should show connected)
- Check backend WebSocket server running
- Verify conversation room joining
- Check browser console for errors

**File Preview Issues**
- Check file URLs are accessible
- Verify static file serving is enabled
- Test direct file URL access
- Check CORS settings

#### Debug Commands

**Check File Upload**
```bash
# List uploaded files
ls -la chat-backend/uploads/

# Check upload directory permissions
ls -ld chat-backend/uploads/

# Monitor upload requests
tail -f chat-backend/server.log | grep upload
```

**Check WebSocket Events**
```javascript
// Browser console
socketService.socket.on('new_message', console.log);
socketService.socket.on('send_file_message', console.log);
```

## 📊 Success Criteria

- ✅ **File Upload**: Images, videos, audio, documents upload successfully
- ✅ **Real-Time Sharing**: Files appear instantly across all clients
- ✅ **Voice Recording**: Audio recording and playback works flawlessly
- ✅ **Compact UI**: Message boxes are appropriately sized for mobile
- ✅ **Error Handling**: Graceful handling of failures and edge cases
- ✅ **Performance**: Smooth upload/download experience
- ✅ **File Validation**: Proper type and size restrictions
- ✅ **WebSocket Integration**: Real-time file message broadcasting
- ✅ **Cross-Platform**: Works on web, iOS, and Android (React Native)
- ✅ **Environment Config**: Fully configurable via environment variables

## 🔧 Configuration Files

### Backend Environment Variables
```bash
# chat-backend/.env
PORT=3000
HOST=localhost
BASE_URL=http://localhost:3000
MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads
CORS_ORIGIN=*
```

### Frontend Environment Variables
```bash
# chat-frontend/.env
REACT_APP_API_URL=http://localhost:3000
REACT_APP_SOCKET_URL=http://localhost:3000
REACT_APP_MAX_FILE_SIZE=10485760
```

### Component Structure
```
chat-frontend/src/
├── components/
│   ├── FilePicker.tsx          # File selection modal
│   ├── VoiceRecorder.tsx       # Voice recording modal
│   ├── VoiceMessagePlayer.tsx  # Audio playback controls
│   ├── VideoMessagePlayer.tsx  # Video playback controls
│   └── FileMessage.tsx         # Universal file display
├── services/
│   └── fileUploadService.ts    # Upload utilities
├── config/
│   └── env.ts                  # Environment configuration
└── __tests__/
    ├── components/
    │   ├── FilePicker.test.tsx
    │   └── VoiceRecorder.test.tsx
    └── integration/
        └── mediaUpload.test.ts
```

## 📁 File Structure

### Files Created/Modified
```
chat-backend/
├── .env                        # 🆕 Environment configuration
├── index.js                    # ✏️ Added file upload endpoints
├── uploads/                    # 🆕 File storage directory
└── __tests__/
    └── mediaUpload.test.js     # 🆕 Backend upload tests

chat-frontend/
├── .env                        # 🆕 Environment configuration
├── src/
│   ├── components/
│   │   ├── FilePicker.tsx      # 🆕 File upload modal
│   │   ├── VoiceRecorder.tsx   # 🆕 Voice recording
│   │   ├── VoiceMessagePlayer.tsx # 🆕 Audio playback
│   │   ├── VideoMessagePlayer.tsx # 🆕 Video playback
│   │   ├── FileMessage.tsx     # 🆕 File message display
│   │   ├── MessageItem.tsx     # ✏️ Reduced message sizes
│   │   └── MessageInput.tsx    # ✏️ Added file/voice buttons
│   ├── services/
│   │   ├── fileUploadService.ts # 🆕 Upload utilities
│   │   └── socketService.ts    # ✏️ Added file message events
│   ├── config/
│   │   └── env.ts             # 🆕 Environment config
│   └── __tests__/
│       ├── components/
│       │   ├── FilePicker.test.tsx      # 🆕 Component tests
│       │   └── VoiceRecorder.test.tsx   # 🆕 Component tests
│       └── integration/
│           └── mediaUpload.test.ts      # 🆕 Integration tests
└── package.json               # ✏️ Added multimedia dependencies
```

This comprehensive testing guide ensures all multimedia file features work correctly across different scenarios, devices, and network conditions.