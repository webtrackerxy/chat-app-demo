import { FileAttachment } from '../../../chat-types/src';
import { getApiUrl, getFileUrl, getUploadUrl, getMaxFileSize } from '../config/env';

export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileUploadResult {
  success: boolean;
  data?: FileAttachment;
  error?: string;
}

export class FileUploadService {
  /**
   * Upload a file to the server
   * @param file - The file to upload (File object or blob)
   * @param onProgress - Optional progress callback
   * @returns Promise with upload result
   */
  static async uploadFile(
    file: File | Blob, 
    originalName: string,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<FileUploadResult> {
    try {
      const formData = new FormData();
      formData.append('file', file, originalName);

      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        // Set up progress tracking
        if (onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              const progress: FileUploadProgress = {
                loaded: event.loaded,
                total: event.total,
                percentage: Math.round((event.loaded / event.total) * 100)
              };
              onProgress(progress);
            }
          });
        }

        // Handle response
        xhr.onload = () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (error) {
              reject(new Error('Failed to parse server response'));
            }
          } else {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error during upload'));
        };

        xhr.ontimeout = () => {
          reject(new Error('Upload timeout'));
        };

        // Configure request
        xhr.open('POST', getUploadUrl());
        xhr.timeout = 30000; // 30 second timeout
        xhr.send(formData);
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get file URL for display/download
   * @param filename - The server filename
   * @returns Full URL to the file
   */
  static getFileUrl(filename: string): string {
    return getFileUrl(filename);
  }

  /**
   * Get download URL for a file
   * @param filename - The server filename
   * @returns Full URL to download the file
   */
  static getDownloadUrl(filename: string): string {
    return `${getApiUrl()}/api/files/${filename}`;
  }

  /**
   * Format file size for display
   * @param bytes - File size in bytes
   * @returns Formatted size string
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get file icon based on mime type
   * @param mimeType - The file's MIME type
   * @returns Emoji icon representing the file type
   */
  static getFileIcon(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return '🖼️';
    } else if (mimeType.startsWith('audio/')) {
      return '🎵';
    } else if (mimeType.startsWith('video/')) {
      return '🎥';
    } else if (mimeType.includes('pdf')) {
      return '📄';
    } else if (mimeType.includes('word') || mimeType.includes('document')) {
      return '📝';
    } else if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      return '📊';
    } else if (mimeType.includes('zip') || mimeType.includes('archive')) {
      return '📦';
    } else {
      return '📁';
    }
  }

  /**
   * Validate file before upload
   * @param file - The file to validate
   * @returns Validation result
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size (10MB limit)
    if (file.size > getMaxFileSize()) {
      return {
        valid: false,
        error: 'File size must be less than 10MB'
      };
    }

    // Check file type
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
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not supported`
      };
    }

    return { valid: true };
  }
}