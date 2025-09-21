export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileUploadOptions {
  maxFileSize: number; // in bytes
  maxTotalSize: number; // in bytes for all files combined
  allowedMimeTypes: string[];
  maxFiles: number;
}

export interface UploadUrlRequest {
  filename: string;
  contentType: string;
  size: number;
  domain?: string;
}

export class FileValidator {
  // Default options based on backend contract
  private static readonly DEFAULT_OPTIONS: FileUploadOptions = {
    maxFileSize: 50 * 1024 * 1024, // 50MB per file
    maxTotalSize: 500 * 1024 * 1024, // 500MB total per assessment
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/png',
      'image/jpeg',
      'image/jpg'
    ],
    maxFiles: 20
  };

  // Dangerous file patterns to block
  private static readonly DANGEROUS_PATTERNS = [
    /\.exe$/i,
    /\.bat$/i,
    /\.cmd$/i,
    /\.com$/i,
    /\.scr$/i,
    /\.pif$/i,
    /\.vbs$/i,
    /\.js$/i,
    /\.jar$/i,
    /\.app$/i,
    /\.deb$/i,
    /\.rpm$/i,
    /\.dmg$/i,
    /\.iso$/i,
    /\.bin$/i,
    /\.run$/i,
    /\.msi$/i,
    /\.gadget$/i,
    /\.wsf$/i,
    /\.wsh$/i,
    // Scripts and code files
    /\.php$/i,
    /\.asp$/i,
    /\.jsp$/i,
    /\.py$/i,
    /\.rb$/i,
    /\.pl$/i,
    /\.sh$/i,
    /\.ps1$/i,
    // Hidden system files
    /^\./,
    /__MACOSX/,
    /desktop\.ini$/i,
    /thumbs\.db$/i
  ];

  /**
   * Validates a single file before upload
   */
  static validateFile(
    file: File,
    options: Partial<FileUploadOptions> = {}
  ): FileValidationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check filename for dangerous patterns
    if (this.isDangerousFilename(file.name)) {
      errors.push(`File "${file.name}" has a potentially dangerous filename`);
    }

    // Check filename length
    if (file.name.length > 255) {
      errors.push(`Filename "${file.name}" is too long (maximum 255 characters)`);
    }

    // Check file size
    if (file.size > opts.maxFileSize) {
      errors.push(
        `File "${file.name}" is too large (${this.formatFileSize(file.size)}). Maximum size is ${this.formatFileSize(opts.maxFileSize)}`
      );
    }

    // Check MIME type
    if (!opts.allowedMimeTypes.includes(file.type)) {
      errors.push(
        `File "${file.name}" has unsupported type "${file.type}". Allowed types: ${opts.allowedMimeTypes.join(', ')}`
      );
    }

    // Validate MIME type matches file extension
    const mimeValidationResult = this.validateMimeTypeConsistency(file);
    if (!mimeValidationResult.isValid) {
      warnings.push(
        `File "${file.name}" extension doesn't match its detected type. This may cause processing issues.`
      );
    }

    // Check for empty files
    if (file.size === 0) {
      errors.push(`File "${file.name}" is empty`);
    }

    // Warn about very large files (even if under limit)
    if (file.size > 20 * 1024 * 1024) { // 20MB
      warnings.push(
        `File "${file.name}" is quite large (${this.formatFileSize(file.size)}). Consider compressing if possible.`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validates multiple files for upload
   */
  static validateFiles(
    files: File[],
    options: Partial<FileUploadOptions> = {}
  ): FileValidationResult {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const allErrors: string[] = [];
    const allWarnings: string[] = [];

    // Check file count
    if (files.length > opts.maxFiles) {
      allErrors.push(`Too many files selected (${files.length}). Maximum is ${opts.maxFiles} files.`);
    }

    // Check total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > opts.maxTotalSize) {
      allErrors.push(
        `Total file size too large (${this.formatFileSize(totalSize)}). Maximum total size is ${this.formatFileSize(opts.maxTotalSize)}`
      );
    }

    // Check for duplicate filenames
    const filenames = files.map(f => f.name);
    const duplicates = filenames.filter((name, index) => filenames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      allErrors.push(`Duplicate filenames found: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Validate each file individually
    files.forEach(file => {
      const result = this.validateFile(file, options);
      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);
    });

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  /**
   * Validates upload URL request before sending to backend
   */
  static validateUploadRequest(request: UploadUrlRequest): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate filename
    if (!request.filename || request.filename.trim().length === 0) {
      errors.push('Filename is required');
    } else {
      if (this.isDangerousFilename(request.filename)) {
        errors.push(`Filename "${request.filename}" contains dangerous patterns`);
      }
      if (request.filename.length > 255) {
        errors.push('Filename is too long (maximum 255 characters)');
      }
    }

    // Validate content type
    if (!request.contentType || request.contentType.trim().length === 0) {
      errors.push('Content type is required');
    } else if (!this.DEFAULT_OPTIONS.allowedMimeTypes.includes(request.contentType)) {
      errors.push(`Content type "${request.contentType}" is not allowed`);
    }

    // Validate file size
    if (!request.size || request.size <= 0) {
      errors.push('File size must be greater than 0');
    } else if (request.size > this.DEFAULT_OPTIONS.maxFileSize) {
      errors.push(
        `File size ${this.formatFileSize(request.size)} exceeds maximum ${this.formatFileSize(this.DEFAULT_OPTIONS.maxFileSize)}`
      );
    }

    // Validate domain (optional)
    if (request.domain) {
      const validDomains = [
        'strategic-alignment',
        'financial-management',
        'revenue-engine',
        'operational-excellence',
        'people-organization',
        'technology-data',
        'customer-experience',
        'supply-chain',
        'risk-compliance',
        'partnerships',
        'customer-success',
        'change-management'
      ];

      if (!validDomains.includes(request.domain)) {
        warnings.push(`Domain "${request.domain}" is not a recognized assessment domain`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Checks if filename contains dangerous patterns
   */
  private static isDangerousFilename(filename: string): boolean {
    return this.DANGEROUS_PATTERNS.some(pattern => pattern.test(filename));
  }

  /**
   * Validates that MIME type matches file extension
   */
  private static validateMimeTypeConsistency(file: File): { isValid: boolean; message?: string } {
    const extension = file.name.toLowerCase().split('.').pop();
    const mimeType = file.type.toLowerCase();

    const mimeExtensionMap: Record<string, string[]> = {
      'application/pdf': ['pdf'],
      'application/msword': ['doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
      'application/vnd.ms-excel': ['xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
      'image/png': ['png'],
      'image/jpeg': ['jpg', 'jpeg'],
      'image/jpg': ['jpg', 'jpeg']
    };

    const expectedExtensions = mimeExtensionMap[mimeType];
    if (!expectedExtensions || !extension) {
      return { isValid: false, message: 'Unknown file type or extension' };
    }

    return {
      isValid: expectedExtensions.includes(extension),
      message: expectedExtensions.includes(extension)
        ? undefined
        : `Extension "${extension}" doesn't match MIME type "${mimeType}"`
    };
  }

  /**
   * Formats file size for human readable display
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Gets file extension from filename
   */
  static getFileExtension(filename: string): string {
    const parts = filename.split('.');
    if (parts.length === 1) return ''; // No extension
    return parts.pop()?.toLowerCase() || '';
  }

  /**
   * Gets human-readable file type description
   */
  static getFileTypeDescription(mimeType: string): string {
    const descriptions: Record<string, string> = {
      'application/pdf': 'PDF Document',
      'application/msword': 'Word Document (.doc)',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word Document (.docx)',
      'application/vnd.ms-excel': 'Excel Spreadsheet (.xls)',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel Spreadsheet (.xlsx)',
      'image/png': 'PNG Image',
      'image/jpeg': 'JPEG Image',
      'image/jpg': 'JPEG Image'
    };

    return descriptions[mimeType] || mimeType;
  }

  /**
   * Checks if file type is an image
   */
  static isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Checks if file type is a document
   */
  static isDocumentFile(mimeType: string): boolean {
    return mimeType.startsWith('application/');
  }

  /**
   * Gets the appropriate icon class for file type
   */
  static getFileIcon(mimeType: string): string {
    if (this.isImageFile(mimeType)) return 'image';
    if (mimeType.includes('pdf')) return 'pdf';
    if (mimeType.includes('word')) return 'word';
    if (mimeType.includes('excel') || mimeType.includes('sheet')) return 'excel';
    return 'document';
  }
}