'use client';

import { useState, useRef } from 'react';
import { FileValidator, FileValidationResult, UploadUrlRequest } from '../../lib/validation/file-validation';

interface DocumentUploadProps {
  assessmentId: string;
  onUploadComplete: (documentId: string, filename: string) => void;
  onUploadError: (error: string) => void;
  domain?: string;
  disabled?: boolean;
}

interface UploadProgress {
  filename: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
  documentId?: string;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  assessmentId,
  onUploadComplete,
  onUploadError,
  domain,
  disabled = false
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});
  const [validation, setValidation] = useState<FileValidationResult | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: File[]) => {
    if (disabled) return;

    const validationResult = FileValidator.validateFiles(files);
    setValidation(validationResult);

    if (validationResult.isValid) {
      setSelectedFiles(files);
      // Initialize upload progress tracking
      const newUploads: Record<string, UploadProgress> = {};
      files.forEach(file => {
        newUploads[file.name] = {
          filename: file.name,
          progress: 0,
          status: 'pending'
        };
      });
      setUploads(newUploads);
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    handleFileSelect(files);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = Array.from(event.dataTransfer.files);
    handleFileSelect(files);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const uploadFile = async (file: File): Promise<void> => {
    const filename = file.name;

    try {
      // Update status to uploading
      setUploads(prev => ({
        ...prev,
        [filename]: { ...prev[filename], status: 'uploading', progress: 0 }
      }));

      // Step 1: Request upload URL from backend
      const uploadRequest: UploadUrlRequest = {
        filename: file.name,
        contentType: file.type,
        size: file.size,
        domain
      };

      // Validate request before sending
      const requestValidation = FileValidator.validateUploadRequest(uploadRequest);
      if (!requestValidation.isValid) {
        throw new Error(requestValidation.errors.join(', '));
      }

      const token = localStorage.getItem('accessToken');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const urlResponse = await fetch('/api/documents/upload-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...uploadRequest,
          assessmentId
        })
      });

      if (!urlResponse.ok) {
        const errorData = await urlResponse.json();
        throw new Error(errorData.error?.message || 'Failed to get upload URL');
      }

      const urlData = await urlResponse.json();
      const { uploadUrl, documentId } = urlData.data;

      // Step 2: Upload file directly to S3 using pre-signed URL
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type
        },
        body: file
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload file: ${uploadResponse.statusText}`);
      }

      // Update progress to completed
      setUploads(prev => ({
        ...prev,
        [filename]: {
          ...prev[filename],
          status: 'completed',
          progress: 100,
          documentId
        }
      }));

      onUploadComplete(documentId, filename);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      setUploads(prev => ({
        ...prev,
        [filename]: {
          ...prev[filename],
          status: 'error',
          error: errorMessage
        }
      }));

      onUploadError(`Failed to upload "${filename}": ${errorMessage}`);
    }
  };

  const handleUploadAll = async () => {
    if (!validation?.isValid || selectedFiles.length === 0) return;

    for (const file of selectedFiles) {
      await uploadFile(file);
    }
  };

  const removeFile = (filename: string) => {
    setSelectedFiles(prev => prev.filter(f => f.name !== filename));
    setUploads(prev => {
      const newUploads = { ...prev };
      delete newUploads[filename];
      return newUploads;
    });

    // Revalidate remaining files
    const remainingFiles = selectedFiles.filter(f => f.name !== filename);
    if (remainingFiles.length > 0) {
      const validationResult = FileValidator.validateFiles(remainingFiles);
      setValidation(validationResult);
    } else {
      setValidation(null);
    }
  };

  const retryUpload = (filename: string) => {
    const file = selectedFiles.find(f => f.name === filename);
    if (file) {
      uploadFile(file);
    }
  };

  const clearAll = () => {
    setSelectedFiles([]);
    setUploads({});
    setValidation(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'uploading':
        return '🔄';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      default:
        return '📄';
    }
  };

  const getFileIcon = (mimeType: string) => {
    const iconClass = FileValidator.getFileIcon(mimeType);
    const icons: Record<string, string> = {
      'pdf': '📄',
      'word': '📝',
      'excel': '📊',
      'image': '🖼️',
      'document': '📋'
    };
    return icons[iconClass] || '📋';
  };

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : disabled
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled}
        />

        <div className="space-y-4">
          <div className="text-4xl">📁</div>
          <div>
            <p className="text-lg font-medium text-gray-900">
              {disabled ? 'Document upload disabled' : 'Drop files here or click to browse'}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Supports PDF, Word, Excel, and image files up to 50MB each
            </p>
          </div>
        </div>
      </div>

      {/* Validation Messages */}
      {validation && (
        <div className="space-y-3">
          {validation.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 className="font-medium text-red-800 mb-2">Upload Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <h4 className="font-medium text-yellow-800 mb-2">Warnings:</h4>
              <ul className="text-sm text-yellow-700 space-y-1">
                {validation.warnings.map((warning, index) => (
                  <li key={index}>• {warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">
              Selected Files ({selectedFiles.length})
            </h3>
            <div className="space-x-2">
              <button
                onClick={clearAll}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Clear All
              </button>
              {validation?.isValid && (
                <button
                  onClick={handleUploadAll}
                  disabled={Object.values(uploads).some(u => u.status === 'uploading')}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Upload All
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {selectedFiles.map((file) => {
              const upload = uploads[file.name];
              return (
                <div key={file.name} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getFileIcon(file.type)}</span>
                      <div>
                        <p className="font-medium text-gray-900">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {FileValidator.getFileTypeDescription(file.type)} • {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      {upload && (
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getStatusIcon(upload.status)}</span>
                          <span className="text-sm text-gray-600 capitalize">{upload.status}</span>
                        </div>
                      )}

                      {upload?.status === 'error' && (
                        <button
                          onClick={() => retryUpload(file.name)}
                          className="px-2 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                        >
                          Retry
                        </button>
                      )}

                      {upload?.status !== 'uploading' && (
                        <button
                          onClick={() => removeFile(file.name)}
                          className="px-2 py-1 text-sm text-gray-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {upload?.status === 'uploading' && (
                    <div className="mt-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {upload?.error && (
                    <div className="mt-2 text-sm text-red-600">
                      {upload.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upload Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="font-medium text-blue-800 mb-2">Upload Guidelines:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Maximum file size: 50MB per file</li>
          <li>• Maximum total size: 500MB per assessment</li>
          <li>• Supported formats: PDF, Word (.doc/.docx), Excel (.xls/.xlsx), Images (.png/.jpg/.jpeg)</li>
          <li>• Up to 20 files per assessment</li>
          <li>• Files will be securely processed and analyzed as part of your assessment</li>
        </ul>
      </div>
    </div>
  );
};