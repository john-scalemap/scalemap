import { FileValidator } from '../../lib/validation/file-validation';

// Mock File constructor for testing
class MockFile {
  constructor(
    public name: string,
    public type: string,
    public size: number,
    public content: string = ''
  ) {}
}

// Create a proper File-like object
const createMockFile = (name: string, type: string, size: number, content: string = ''): File => {
  const file = new MockFile(name, type, size, content) as any;
  file.constructor = File;
  return file;
};

describe('FileValidator', () => {
  describe('validateFile', () => {
    it('should validate a valid PDF file', () => {
      const file = createMockFile('document.pdf', 'application/pdf', 1024 * 1024); // 1MB

      const result = FileValidator.validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate a valid Word document', () => {
      const file = createMockFile(
        'document.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        2 * 1024 * 1024 // 2MB
      );

      const result = FileValidator.validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', () => {
      const file = createMockFile('large.pdf', 'application/pdf', 60 * 1024 * 1024); // 60MB

      const result = FileValidator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('too large')
        ])
      );
    });

    it('should reject unsupported file types', () => {
      const file = createMockFile('script.js', 'application/javascript', 1024);

      const result = FileValidator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('unsupported type')
        ])
      );
    });

    it('should reject dangerous filenames', () => {
      const file = createMockFile('malware.exe', 'application/pdf', 1024);

      const result = FileValidator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('dangerous filename')
        ])
      );
    });

    it('should reject empty files', () => {
      const file = createMockFile('empty.pdf', 'application/pdf', 0);

      const result = FileValidator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('empty')
        ])
      );
    });

    it('should warn about very large files', () => {
      const file = createMockFile('large.pdf', 'application/pdf', 25 * 1024 * 1024); // 25MB

      const result = FileValidator.validateFile(file);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('quite large')
        ])
      );
    });

    it('should reject filenames that are too long', () => {
      const longName = 'a'.repeat(260) + '.pdf';
      const file = createMockFile(longName, 'application/pdf', 1024);

      const result = FileValidator.validateFile(file);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('too long')
        ])
      );
    });
  });

  describe('validateFiles', () => {
    it('should validate multiple valid files', () => {
      const files = [
        createMockFile('doc1.pdf', 'application/pdf', 1024 * 1024),
        createMockFile('doc2.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 2 * 1024 * 1024),
        createMockFile('sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1024 * 1024)
      ];

      const result = FileValidator.validateFiles(files);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject too many files', () => {
      const files = Array.from({ length: 25 }, (_, i) =>
        createMockFile(`doc${i}.pdf`, 'application/pdf', 1024 * 1024)
      );

      const result = FileValidator.validateFiles(files);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Too many files')
        ])
      );
    });

    it('should reject when total size is too large', () => {
      const files = Array.from({ length: 15 }, (_, i) =>
        createMockFile(`doc${i}.pdf`, 'application/pdf', 40 * 1024 * 1024) // 40MB each
      );

      const result = FileValidator.validateFiles(files);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Total file size too large')
        ])
      );
    });

    it('should detect duplicate filenames', () => {
      const files = [
        createMockFile('document.pdf', 'application/pdf', 1024 * 1024),
        createMockFile('document.pdf', 'application/pdf', 2 * 1024 * 1024)
      ];

      const result = FileValidator.validateFiles(files);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Duplicate filenames')
        ])
      );
    });
  });

  describe('validateUploadRequest', () => {
    it('should validate a valid upload request', () => {
      const request = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024 * 1024,
        domain: 'strategic-alignment'
      };

      const result = FileValidator.validateUploadRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing filename', () => {
      const request = {
        filename: '',
        contentType: 'application/pdf',
        size: 1024 * 1024
      };

      const result = FileValidator.validateUploadRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Filename is required')
        ])
      );
    });

    it('should reject invalid content type', () => {
      const request = {
        filename: 'script.js',
        contentType: 'application/javascript',
        size: 1024
      };

      const result = FileValidator.validateUploadRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('not allowed')
        ])
      );
    });

    it('should reject invalid file size', () => {
      const request = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 0
      };

      const result = FileValidator.validateUploadRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('must be greater than 0')
        ])
      );
    });

    it('should warn about unrecognized domain', () => {
      const request = {
        filename: 'document.pdf',
        contentType: 'application/pdf',
        size: 1024 * 1024,
        domain: 'unknown-domain'
      };

      const result = FileValidator.validateUploadRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining('not a recognized assessment domain')
        ])
      );
    });
  });

  describe('utility methods', () => {
    it('should get correct file extension', () => {
      expect(FileValidator.getFileExtension('document.pdf')).toBe('pdf');
      expect(FileValidator.getFileExtension('file.name.with.dots.docx')).toBe('docx');
      expect(FileValidator.getFileExtension('noextension')).toBe('');
    });

    it('should identify image files correctly', () => {
      expect(FileValidator.isImageFile('image/png')).toBe(true);
      expect(FileValidator.isImageFile('image/jpeg')).toBe(true);
      expect(FileValidator.isImageFile('application/pdf')).toBe(false);
    });

    it('should identify document files correctly', () => {
      expect(FileValidator.isDocumentFile('application/pdf')).toBe(true);
      expect(FileValidator.isDocumentFile('application/msword')).toBe(true);
      expect(FileValidator.isDocumentFile('image/png')).toBe(false);
    });

    it('should get appropriate file type descriptions', () => {
      expect(FileValidator.getFileTypeDescription('application/pdf')).toBe('PDF Document');
      expect(FileValidator.getFileTypeDescription('image/png')).toBe('PNG Image');
      expect(FileValidator.getFileTypeDescription('unknown/type')).toBe('unknown/type');
    });
  });
});