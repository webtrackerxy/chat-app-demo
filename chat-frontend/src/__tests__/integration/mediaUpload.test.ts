import { FileUploadService } from '../../services/fileUploadService';

// Mock fetch for testing
global.fetch = jest.fn();

describe('Media Upload Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('File Upload Service', () => {
    it('validates supported image types', () => {
      const supportedTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
      ];

      supportedTypes.forEach(type => {
        const file = new File(['test'], 'test.jpg', { type });
        const validation = FileUploadService.validateFile(file);
        expect(validation.valid).toBe(true);
      });
    });

    it('validates supported video types', () => {
      const supportedTypes = [
        'video/mp4',
        'video/quicktime',
        'video/mpeg',
        'video/webm',
        'video/avi',
        'video/mov',
        'video/x-msvideo'
      ];

      supportedTypes.forEach(type => {
        const file = new File(['test'], 'test.mp4', { type });
        const validation = FileUploadService.validateFile(file);
        expect(validation.valid).toBe(true);
      });
    });

    it('validates supported audio types', () => {
      const supportedTypes = [
        'audio/mpeg',
        'audio/wav',
        'audio/ogg',
        'audio/webm',
        'audio/m4a'
      ];

      supportedTypes.forEach(type => {
        const file = new File(['test'], 'test.mp3', { type });
        const validation = FileUploadService.validateFile(file);
        expect(validation.valid).toBe(true);
      });
    });

    it('rejects unsupported file types', () => {
      const unsupportedTypes = [
        'application/x-executable',
        'text/javascript',
        'application/zip'
      ];

      unsupportedTypes.forEach(type => {
        const file = new File(['test'], 'test.exe', { type });
        const validation = FileUploadService.validateFile(file);
        expect(validation.valid).toBe(false);
        expect(validation.error).toContain('not supported');
      });
    });

    it('rejects files larger than 10MB', () => {
      const largeFile = new File(['a'.repeat(11 * 1024 * 1024)], 'large.jpg', { 
        type: 'image/jpeg' 
      });
      
      const validation = FileUploadService.validateFile(largeFile);
      expect(validation.valid).toBe(false);
      expect(validation.error).toContain('10MB');
    });

    it('returns correct file icons for different types', () => {
      expect(FileUploadService.getFileIcon('image/jpeg')).toBe('🖼️');
      expect(FileUploadService.getFileIcon('video/mp4')).toBe('🎥');
      expect(FileUploadService.getFileIcon('audio/mp3')).toBe('🎵');
      expect(FileUploadService.getFileIcon('application/pdf')).toBe('📄');
      expect(FileUploadService.getFileIcon('unknown/type')).toBe('📎');
    });

    it('formats file sizes correctly', () => {
      expect(FileUploadService.formatFileSize(1024)).toBe('1.0 KB');
      expect(FileUploadService.formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(FileUploadService.formatFileSize(500)).toBe('500 B');
      expect(FileUploadService.formatFileSize(1536)).toBe('1.5 KB');
    });

    it('generates correct file URLs', () => {
      const filename = 'test-file-123.jpg';
      const url = FileUploadService.getFileUrl(filename);
      expect(url).toBe('http://localhost:3000/uploads/test-file-123.jpg');
    });

    it('handles upload progress callbacks', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const progressCallback = jest.fn();

      // Mock XMLHttpRequest
      const mockXHR = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        upload: {
          addEventListener: jest.fn()
        },
        addEventListener: jest.fn(),
        readyState: 4,
        status: 200,
        responseText: JSON.stringify({
          success: true,
          data: { id: 'test', filename: 'test.jpg' }
        })
      };

      global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

      const uploadPromise = FileUploadService.uploadFile(mockFile, 'test.jpg', progressCallback);

      // Simulate progress event
      const progressHandler = mockXHR.upload.addEventListener.mock.calls.find(
        call => call[0] === 'progress'
      )?.[1];

      if (progressHandler) {
        progressHandler({
          lengthComputable: true,
          loaded: 512,
          total: 1024
        });
      }

      expect(progressCallback).toHaveBeenCalledWith({
        loaded: 512,
        total: 1024,
        percentage: 50
      });

      // Simulate completion
      const loadHandler = mockXHR.addEventListener.mock.calls.find(
        call => call[0] === 'load'
      )?.[1];

      if (loadHandler) {
        loadHandler();
      }

      const result = await uploadPromise;
      expect(result.success).toBe(true);
    });
  });

  describe('File Type Detection', () => {
    it('detects image files correctly', () => {
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      
      imageExtensions.forEach(ext => {
        const file = new File(['test'], `test.${ext}`, { 
          type: `image/${ext === 'jpg' ? 'jpeg' : ext}` 
        });
        const validation = FileUploadService.validateFile(file);
        expect(validation.valid).toBe(true);
      });
    });

    it('detects video files correctly', () => {
      const videoExtensions = ['mp4', 'mov', 'avi', 'webm'];
      
      videoExtensions.forEach(ext => {
        const file = new File(['test'], `test.${ext}`, { 
          type: `video/${ext}` 
        });
        const validation = FileUploadService.validateFile(file);
        expect(validation.valid).toBe(true);
      });
    });

    it('detects audio files correctly', () => {
      const audioExtensions = ['mp3', 'wav', 'ogg', 'm4a'];
      
      audioExtensions.forEach(ext => {
        const file = new File(['test'], `test.${ext}`, { 
          type: `audio/${ext === 'mp3' ? 'mpeg' : ext}` 
        });
        const validation = FileUploadService.validateFile(file);
        expect(validation.valid).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    it('handles network errors gracefully', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockXHR = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        upload: { addEventListener: jest.fn() },
        addEventListener: jest.fn()
      };

      global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

      const uploadPromise = FileUploadService.uploadFile(mockFile, 'test.jpg');

      // Simulate error
      const errorHandler = mockXHR.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      if (errorHandler) {
        errorHandler();
      }

      const result = await uploadPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to upload file');
    });

    it('handles server errors gracefully', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockXHR = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        upload: { addEventListener: jest.fn() },
        addEventListener: jest.fn(),
        readyState: 4,
        status: 500,
        responseText: JSON.stringify({
          success: false,
          error: 'Server error'
        })
      };

      global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

      const uploadPromise = FileUploadService.uploadFile(mockFile, 'test.jpg');

      // Simulate completion with error
      const loadHandler = mockXHR.addEventListener.mock.calls.find(
        call => call[0] === 'load'
      )?.[1];

      if (loadHandler) {
        loadHandler();
      }

      const result = await uploadPromise;
      expect(result.success).toBe(false);
      expect(result.error).toBe('Server error');
    });

    it('handles malformed responses gracefully', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

      const mockXHR = {
        open: jest.fn(),
        setRequestHeader: jest.fn(),
        send: jest.fn(),
        upload: { addEventListener: jest.fn() },
        addEventListener: jest.fn(),
        readyState: 4,
        status: 200,
        responseText: 'invalid json'
      };

      global.XMLHttpRequest = jest.fn(() => mockXHR) as any;

      const uploadPromise = FileUploadService.uploadFile(mockFile, 'test.jpg');

      // Simulate completion with malformed response
      const loadHandler = mockXHR.addEventListener.mock.calls.find(
        call => call[0] === 'load'
      )?.[1];

      if (loadHandler) {
        loadHandler();
      }

      const result = await uploadPromise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse response');
    });
  });
});