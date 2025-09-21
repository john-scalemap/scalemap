'use client';

import {
  CloudArrowUpIcon,
  DocumentIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import React, { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

import { assessmentService } from '@/lib/api';

import { Button } from '../ui/Button';

interface DocumentUploadProps {
  assessmentId: string;
  onUploadStart?: (file: File) => void;
  onUploadProgress?: (progress: number, file: File) => void;
  onUploadComplete?: (documentId: string, file: File) => void;
  onUploadError?: (error: string, file: File) => void;
  className?: string;
  disabled?: boolean;
  maxFiles?: number;
  domain?: string;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  documentId?: string;
  error?: string;
  xhr?: XMLHttpRequest;
  retryCount?: number;
}

interface UploadUrlResponse {
  success: boolean;
  data?: {
    documentId: string;
    uploadUrl: string;
    s3Key: string;
    expiresIn: number;
    metadata: any;
  };
  error?: {
    code: string;
    message: string;
  };
}

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg'
];

const ALLOWED_FILE_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_RETRY_ATTEMPTS = 3;

export function DocumentUpload({
  assessmentId,
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  className = '',
  disabled = false,
  maxFiles = 10,
  domain
}: DocumentUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File "${file.name}" is too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`;
    }

    // Check file type by MIME type and extension
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_FILE_TYPES.includes(file.type) && !ALLOWED_FILE_EXTENSIONS.includes(fileExtension || '')) {
      return `File type not supported. Allowed types: ${ALLOWED_FILE_EXTENSIONS.join(', ')}`;
    }

    return null;
  };

  const getPresignedUrl = async (file: File): Promise<UploadUrlResponse> => {
    const response = await assessmentService.getDocumentUploadUrl(assessmentId, {
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    if (!response.success) {
      return {
        success: false,
        error: response.error || { code: 'UPLOAD_ERROR', message: 'Failed to get upload URL' }
      };
    }

    return {
      success: true,
      data: {
        documentId: response.data!.documentId,
        uploadUrl: response.data!.uploadUrl,
        s3Key: '', // Not needed for direct S3 upload
        expiresIn: 300, // 5 minutes
        metadata: {}
      }
    };
  };

  const uploadToS3 = (file: File, uploadUrl: string, uploadingFile: UploadingFile): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      // Store xhr reference for potential cancellation
      setUploadingFiles(prev =>
        prev.map(uf => uf.file === file ? { ...uf, xhr } : uf)
      );

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);

          setUploadingFiles(prev =>
            prev.map(uf =>
              uf.file === file ? { ...uf, progress } : uf
            )
          );

          onUploadProgress?.(progress, file);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          // S3 upload successful, mark as completed
          // Processing will happen asynchronously in the backend
          setUploadingFiles(prev =>
            prev.map(uf =>
              uf.file === file ? { ...uf, status: 'completed', progress: 100 } : uf
            )
          );
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'));
      });

      xhr.addEventListener('timeout', () => {
        reject(new Error('Upload timeout'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.timeout = 300000; // 5 minutes
      xhr.send(file);
    });
  };


  const uploadFile = async (file: File, retryCount = 0): Promise<void> => {
    try {
      onUploadStart?.(file);

      // Get presigned URL
      const urlResponse = await getPresignedUrl(file);

      if (!urlResponse.success || !urlResponse.data) {
        throw new Error(urlResponse.error?.message || 'Failed to get upload URL');
      }

      const { documentId, uploadUrl } = urlResponse.data;

      // Update file with document ID
      setUploadingFiles(prev =>
        prev.map(uf =>
          uf.file === file ? { ...uf, documentId, status: 'uploading' } : uf
        )
      );

      // Find the uploading file reference
      const uploadingFile = uploadingFiles.find(uf => uf.file === file);
      if (!uploadingFile) return;

      // Upload to S3
      await uploadToS3(file, uploadUrl, uploadingFile);

      // File is uploaded successfully, processing will happen asynchronously
      onUploadComplete?.(documentId, file);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      if (retryCount < MAX_RETRY_ATTEMPTS) {
        // Retry after a delay
        setTimeout(() => {
          setUploadingFiles(prev =>
            prev.map(uf =>
              uf.file === file
                ? { ...uf, status: 'pending', retryCount: retryCount + 1, error: undefined }
                : uf
            )
          );
          uploadFile(file, retryCount + 1);
        }, Math.pow(2, retryCount) * 1000); // Exponential backoff
      } else {
        setUploadingFiles(prev =>
          prev.map(uf =>
            uf.file === file
              ? { ...uf, status: 'error', error: errorMessage }
              : uf
          )
        );
        onUploadError?.(errorMessage, file);
      }
    }
  };

  const handleFileSelect = async (files: File[]) => {
    if (disabled) return;

    const currentUploadCount = uploadingFiles.filter(f =>
      f.status === 'pending' || f.status === 'uploading' || f.status === 'processing'
    ).length;

    if (currentUploadCount + files.length > maxFiles) {
      alert(`Maximum ${maxFiles} files can be uploaded at once`);
      return;
    }

    // Validate files
    for (const file of files) {
      const error = validateFile(file);
      if (error) {
        alert(error);
        return;
      }
    }

    // Add files to uploading list
    const newUploadingFiles: UploadingFile[] = files.map(file => ({
      file,
      progress: 0,
      status: 'pending',
      retryCount: 0,
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    // Start uploading each file
    for (const file of files) {
      uploadFile(file);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    handleFileSelect(acceptedFiles);
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxSize: MAX_FILE_SIZE,
    disabled,
    multiple: true,
    maxFiles,
  });

  const removeFile = (fileToRemove: UploadingFile) => {
    // Cancel ongoing upload if exists
    if (fileToRemove.xhr) {
      fileToRemove.xhr.abort();
    }
    setUploadingFiles(prev => prev.filter(uf => uf !== fileToRemove));
  };

  const retryUpload = (fileToRetry: UploadingFile) => {
    setUploadingFiles(prev =>
      prev.map(uf =>
        uf === fileToRetry
          ? { ...uf, status: 'pending', error: undefined, progress: 0 }
          : uf
      )
    );
    uploadFile(fileToRetry.file);
  };

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'pending':
        return <CloudArrowUpIcon className="h-5 w-5 text-gray-400" />;
      case 'uploading':
        return <ArrowPathIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'processing':
        return <ArrowPathIcon className="h-5 w-5 text-yellow-500 animate-spin" />;
      case 'completed':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'error':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      default:
        return <DocumentIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = (uploadingFile: UploadingFile) => {
    switch (uploadingFile.status) {
      case 'pending':
        return 'Preparing upload...';
      case 'uploading':
        return `Uploading... ${uploadingFile.progress}%`;
      case 'processing':
        return 'Processing document...';
      case 'completed':
        return 'Upload completed';
      case 'error':
        return uploadingFile.error || 'Upload failed';
      default:
        return 'Unknown status';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragActive && !isDragReject
            ? 'border-blue-500 bg-blue-50'
            : isDragReject
            ? 'border-red-500 bg-red-50'
            : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <input {...getInputProps()} />
        <div className="space-y-3">
          <div className="flex justify-center">
            {isDragActive ? (
              isDragReject ? (
                <ExclamationTriangleIcon className="h-12 w-12 text-red-400" />
              ) : (
                <CloudArrowUpIcon className="h-12 w-12 text-blue-500" />
              )
            ) : (
              <CloudArrowUpIcon className="h-12 w-12 text-gray-400" />
            )}
          </div>
          <div className="text-lg font-medium text-gray-900">
            {isDragActive
              ? isDragReject
                ? 'Some files are not supported'
                : 'Drop files here'
              : 'Drop files here or click to upload'
            }
          </div>
          <div className="text-sm text-gray-600">
            Supports: PDF, Word, Excel, Images (max {MAX_FILE_SIZE / 1024 / 1024}MB each)
          </div>
          <div className="text-sm text-gray-500">
            Maximum {maxFiles} files
          </div>
        </div>
      </div>

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900">Upload Progress</h4>
          {uploadingFiles.map((uploadingFile, index) => (
            <div
              key={`${uploadingFile.file.name}-${index}`}
              className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex-shrink-0">
                {getStatusIcon(uploadingFile.status)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {uploadingFile.file.name}
                </div>
                <div className="text-xs text-gray-500">
                  {(uploadingFile.file.size / 1024 / 1024).toFixed(1)} MB
                  {domain && ` • ${domain}`}
                  {uploadingFile.retryCount && uploadingFile.retryCount > 0 &&
                    ` • Retry ${uploadingFile.retryCount}/${MAX_RETRY_ATTEMPTS}`
                  }
                </div>

                {(uploadingFile.status === 'uploading' || uploadingFile.status === 'processing') && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          uploadingFile.status === 'uploading' ? 'bg-blue-600' : 'bg-yellow-500'
                        }`}
                        style={{
                          width: uploadingFile.status === 'uploading'
                            ? `${uploadingFile.progress}%`
                            : '100%'
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {getStatusText(uploadingFile)}
                    </div>
                  </div>
                )}

                {uploadingFile.status === 'completed' && (
                  <div className="text-xs text-green-600 mt-1">
                    {getStatusText(uploadingFile)}
                  </div>
                )}

                {uploadingFile.status === 'error' && (
                  <div className="text-xs text-red-600 mt-1">
                    {getStatusText(uploadingFile)}
                  </div>
                )}

                {uploadingFile.status === 'pending' && (
                  <div className="text-xs text-gray-600 mt-1">
                    {getStatusText(uploadingFile)}
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                {uploadingFile.status === 'error' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => retryUpload(uploadingFile)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeFile(uploadingFile)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Instructions */}
      <div className="text-xs text-gray-500 space-y-1">
        <p>• Drag and drop files or click the upload area</p>
        <p>• Supported formats: PDF, DOC/DOCX, XLS/XLSX, PNG, JPG/JPEG</p>
        <p>• Maximum file size: {MAX_FILE_SIZE / 1024 / 1024}MB per file</p>
        <p>• Files will be processed automatically after upload</p>
        <p>• Failed uploads will be retried automatically up to {MAX_RETRY_ATTEMPTS} times</p>
      </div>
    </div>
  );
}