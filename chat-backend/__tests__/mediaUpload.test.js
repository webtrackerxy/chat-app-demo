const request = require('supertest')
const express = require('express')
const multer = require('multer')
const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')

// Create a test app with the same upload configuration
const app = express()
const upload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '..', 'test-uploads')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }
      cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
      const uniqueName = `file-${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`
      cb(null, uniqueName)
    },
  }),
  fileFilter: function (req, file, cb) {
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/m4a',
      'audio/mp4',
      'video/mp4',
      'video/quicktime',
      'video/mpeg',
      'video/webm',
      'video/avi',
      'video/mov',
      'video/x-msvideo',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
    ]

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false)
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
})

// Upload endpoint
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
      })
    }

    const fileMetadata = {
      id: uuidv4(),
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
      url: `/uploads/${req.file.filename}`,
    }

    // Determine file type category
    if (req.file.mimetype.startsWith('image/')) {
      fileMetadata.type = 'image'
    } else if (req.file.mimetype.startsWith('audio/')) {
      fileMetadata.type = 'audio'
    } else if (req.file.mimetype.startsWith('video/')) {
      fileMetadata.type = 'video'
    } else {
      fileMetadata.type = 'document'
    }

    res.json({
      success: true,
      data: fileMetadata,
    })
  } catch (error) {
    console.error('Upload error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
    })
  }
})

// Error handler for the test app
app.use((error, req, res) => {
  // Handle multer errors specifically
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File size too large',
      })
    }

    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: 'Unexpected file field',
      })
    }
  }

  // Handle file filter errors
  if (
    error.message &&
    error.message.includes('File type') &&
    error.message.includes('not allowed')
  ) {
    return res.status(400).json({
      success: false,
      error: error.message,
    })
  }

  res.status(500).json({
    success: false,
    error: error.message || 'Internal server error',
  })
})

// File download endpoint
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename
  const filePath = path.join(__dirname, '..', 'test-uploads', filename)

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath)
  } else {
    res.status(404).json({ error: 'File not found' })
  }
})

describe('Media Upload Backend Tests', () => {
  beforeAll(() => {
    // Ensure test uploads directory exists
    const uploadDir = path.join(__dirname, '..', 'test-uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
  })

  afterAll(() => {
    // Clean up test uploads
    const uploadDir = path.join(__dirname, '..', 'test-uploads')
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true })
    }
  })

  describe('File Upload Endpoint', () => {
    it('should upload an image file successfully', async () => {
      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg')

      // Create a test image if it doesn't exist
      if (!fs.existsSync(path.dirname(testImagePath))) {
        fs.mkdirSync(path.dirname(testImagePath), { recursive: true })
      }
      if (!fs.existsSync(testImagePath)) {
        // Create a minimal JPEG file
        const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
        fs.writeFileSync(testImagePath, jpegHeader)
      }

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testImagePath)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data).toHaveProperty('filename')
      expect(response.body.data.type).toBe('image')
      expect(response.body.data.mimeType).toBe('image/jpeg')
      expect(response.body.data.originalName).toBe('test-image.jpg')
    })

    it('should upload an audio file successfully', async () => {
      const testAudioPath = path.join(__dirname, 'fixtures', 'test-audio.m4a')

      // Create a test audio file if it doesn't exist
      if (!fs.existsSync(path.dirname(testAudioPath))) {
        fs.mkdirSync(path.dirname(testAudioPath), { recursive: true })
      }
      if (!fs.existsSync(testAudioPath)) {
        // Create a minimal M4A file with proper ftyp box
        const m4aHeader = Buffer.from([
          0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x4d, 0x34, 0x41, 0x20, 0x00, 0x00, 0x00,
          0x00, 0x4d, 0x34, 0x41, 0x20, 0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x31, 0x6d, 0x70,
          0x34, 0x32,
        ])
        fs.writeFileSync(testAudioPath, m4aHeader)
      }

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testAudioPath)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.type).toBe('audio')
      expect(response.body.data.originalName).toBe('test-audio.m4a')
    })

    it('should upload a video file successfully', async () => {
      const testVideoPath = path.join(__dirname, 'fixtures', 'test-video.mp4')

      // Create a test video file if it doesn't exist
      if (!fs.existsSync(path.dirname(testVideoPath))) {
        fs.mkdirSync(path.dirname(testVideoPath), { recursive: true })
      }
      if (!fs.existsSync(testVideoPath)) {
        // Create a minimal MP4 file
        const mp4Header = Buffer.from([
          0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
        ])
        fs.writeFileSync(testVideoPath, mp4Header)
      }

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testVideoPath)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.type).toBe('video')
      expect(response.body.data.originalName).toBe('test-video.mp4')
    })

    it('should upload a document file successfully', async () => {
      const testDocPath = path.join(__dirname, 'fixtures', 'test-document.pdf')

      // Create a test PDF file if it doesn't exist
      if (!fs.existsSync(path.dirname(testDocPath))) {
        fs.mkdirSync(path.dirname(testDocPath), { recursive: true })
      }
      if (!fs.existsSync(testDocPath)) {
        // Create a minimal PDF file
        const pdfHeader = Buffer.from('%PDF-1.4\n%EOF\n')
        fs.writeFileSync(testDocPath, pdfHeader)
      }

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testDocPath)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.type).toBe('document')
      expect(response.body.data.originalName).toBe('test-document.pdf')
    })

    it('should reject unsupported file types', async () => {
      const testFilePath = path.join(__dirname, 'fixtures', 'test-script.exe')

      // Create a test executable file
      if (!fs.existsSync(path.dirname(testFilePath))) {
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true })
      }
      fs.writeFileSync(testFilePath, 'test executable content')

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testFilePath)
        .expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toContain('not allowed')
    })

    it('should reject files larger than 10MB', async () => {
      const testFilePath = path.join(__dirname, 'fixtures', 'large-file.txt')

      // Create a large test file (11MB)
      if (!fs.existsSync(path.dirname(testFilePath))) {
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true })
      }
      const largeContent = 'a'.repeat(11 * 1024 * 1024)
      fs.writeFileSync(testFilePath, largeContent)

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testFilePath)
        .expect(400)

      expect(response.body.success).toBe(false)

      // Clean up large file
      fs.unlinkSync(testFilePath)
    })

    it('should return 400 when no file is uploaded', async () => {
      const response = await request(app).post('/api/upload').expect(400)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('No file uploaded')
    })

    it('should generate unique filenames for uploaded files', async () => {
      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg')

      // Upload the same file twice
      const response1 = await request(app)
        .post('/api/upload')
        .attach('file', testImagePath)
        .expect(200)

      const response2 = await request(app)
        .post('/api/upload')
        .attach('file', testImagePath)
        .expect(200)

      expect(response1.body.data.filename).not.toBe(response2.body.data.filename)
      expect(response1.body.data.id).not.toBe(response2.body.data.id)
    })

    it('should handle file uploads with special characters in filename', async () => {
      const testFilePath = path.join(__dirname, 'fixtures', 'test file with spaces & symbols!.txt')

      if (!fs.existsSync(path.dirname(testFilePath))) {
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true })
      }
      fs.writeFileSync(testFilePath, 'test content')

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testFilePath)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.originalName).toBe('test file with spaces & symbols!.txt')
    })
  })

  describe('File Serving Endpoint', () => {
    it('should serve uploaded files correctly', async () => {
      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg')

      // First upload a file
      const uploadResponse = await request(app)
        .post('/api/upload')
        .attach('file', testImagePath)
        .expect(200)

      const filename = uploadResponse.body.data.filename

      // Then try to download it
      const downloadResponse = await request(app).get(`/uploads/${filename}`).expect(200)

      expect(downloadResponse.headers['content-type']).toBeDefined()
    })

    it('should return 404 for non-existent files', async () => {
      const response = await request(app).get('/uploads/non-existent-file.jpg').expect(404)

      expect(response.body.error).toBe('File not found')
    })
  })

  describe('File Metadata', () => {
    it('should return correct file size', async () => {
      const testContent = 'This is test content for size calculation'
      const testFilePath = path.join(__dirname, 'fixtures', 'size-test.txt')

      if (!fs.existsSync(path.dirname(testFilePath))) {
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true })
      }
      fs.writeFileSync(testFilePath, testContent)

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testFilePath)
        .expect(200)

      expect(response.body.data.size).toBe(testContent.length)
    })

    it('should return current timestamp for uploadedAt', async () => {
      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg')
      const beforeUpload = new Date()

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testImagePath)
        .expect(200)

      const afterUpload = new Date()
      const uploadedAt = new Date(response.body.data.uploadedAt)

      expect(uploadedAt.getTime()).toBeGreaterThanOrEqual(beforeUpload.getTime())
      expect(uploadedAt.getTime()).toBeLessThanOrEqual(afterUpload.getTime())
    })

    it('should generate valid UUID for file ID', async () => {
      const testImagePath = path.join(__dirname, 'fixtures', 'test-image.jpg')

      const response = await request(app)
        .post('/api/upload')
        .attach('file', testImagePath)
        .expect(200)

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      expect(response.body.data.id).toMatch(uuidRegex)
    })
  })
})
