import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { assessmentService } from '@/lib/api';

import { DocumentUpload } from '../DocumentUpload';


// Mock the assessment service
jest.mock('@/lib/api', () => ({
  assessmentService: {
    getDocumentUploadUrl: jest.fn(),
  },
}));

const mockAssessmentService = assessmentService as jest.Mocked<typeof assessmentService>;

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  public status = 200;
  public upload = { addEventListener: jest.fn() };
  public addEventListener = jest.fn();
  public open = jest.fn();
  public setRequestHeader = jest.fn();
  public send = jest.fn();
  public timeout = 0;

  constructor() {
    // Simulate successful upload after a short delay
    setTimeout(() => {
      this.addEventListener.mock.calls.forEach(([event, callback]) => {
        if (event === 'load') {
          callback();
        }
      });
    }, 100);
  }
}

global.XMLHttpRequest = MockXMLHttpRequest as any;

describe('DocumentUpload', () => {
  const mockProps = {
    assessmentId: 'test-assessment-id',
    onUploadStart: jest.fn(),
    onUploadProgress: jest.fn(),
    onUploadComplete: jest.fn(),
    onUploadError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders upload interface', () => {
    render(<DocumentUpload {...mockProps} />);

    expect(screen.getByText(/drag & drop files here/i)).toBeInTheDocument();
    expect(screen.getByText(/or click to browse/i)).toBeInTheDocument();
    expect(screen.getByText(/PDF, Word, Excel, Images/i)).toBeInTheDocument();
  });

  it('handles file upload successfully', async () => {
    const mockUploadResponse = {
      success: true,
      data: {
        documentId: 'doc-123',
        uploadUrl: 'https://s3.amazonaws.com/bucket/upload-url',
        expiresAt: '2024-01-01T12:00:00Z',
      },
    };

    mockAssessmentService.getDocumentUploadUrl.mockResolvedValue(mockUploadResponse);

    render(<DocumentUpload {...mockProps} />);

    // Create a test file
    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    // Find the file input and upload the file
    const fileInput = screen.getByRole('button', { name: /choose files/i });
    fireEvent.click(fileInput);

    // Simulate file selection
    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
    });
    fireEvent.change(hiddenInput);

    // Wait for upload to start
    await waitFor(() => {
      expect(mockProps.onUploadStart).toHaveBeenCalledWith(file);
    });

    // Wait for upload to complete
    await waitFor(() => {
      expect(mockProps.onUploadComplete).toHaveBeenCalledWith('doc-123', file);
    });

    expect(mockAssessmentService.getDocumentUploadUrl).toHaveBeenCalledWith('test-assessment-id', {
      fileName: 'test.pdf',
      fileType: 'application/pdf',
      fileSize: 12, // 'test content'.length
    });
  });

  it('handles upload errors', async () => {
    const mockErrorResponse = {
      success: false,
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds maximum allowed',
      },
    };

    mockAssessmentService.getDocumentUploadUrl.mockResolvedValue(mockErrorResponse);

    render(<DocumentUpload {...mockProps} />);

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });

    const fileInput = screen.getByRole('button', { name: /choose files/i });
    fireEvent.click(fileInput);

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
    });
    fireEvent.change(hiddenInput);

    await waitFor(() => {
      expect(mockProps.onUploadError).toHaveBeenCalledWith(
        'File size exceeds maximum allowed',
        file
      );
    });
  });

  it('validates file types', () => {
    render(<DocumentUpload {...mockProps} />);

    // Create an invalid file type
    const file = new File(['test content'], 'test.exe', { type: 'application/x-executable' });

    const fileInput = screen.getByRole('button', { name: /choose files/i });
    fireEvent.click(fileInput);

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
    });

    // Mock window.alert to capture validation error
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    fireEvent.change(hiddenInput);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('File type not supported')
    );

    alertSpy.mockRestore();
  });

  it('validates file size', () => {
    render(<DocumentUpload {...mockProps} />);

    // Create a file that's too large (over 50MB)
    const largeContent = 'x'.repeat(51 * 1024 * 1024); // 51MB
    const file = new File([largeContent], 'large.pdf', { type: 'application/pdf' });

    const fileInput = screen.getByRole('button', { name: /choose files/i });
    fireEvent.click(fileInput);

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      value: [file],
    });

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    fireEvent.change(hiddenInput);

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('is too large')
    );

    alertSpy.mockRestore();
  });

  it('respects disabled state', () => {
    render(<DocumentUpload {...mockProps} disabled={true} />);

    const fileInput = screen.getByRole('button', { name: /choose files/i });
    expect(fileInput).toBeDisabled();
  });

  it('respects maximum file limit', () => {
    render(<DocumentUpload {...mockProps} maxFiles={2} />);

    // Try to upload 3 files when max is 2
    const files = [
      new File(['content1'], 'file1.pdf', { type: 'application/pdf' }),
      new File(['content2'], 'file2.pdf', { type: 'application/pdf' }),
      new File(['content3'], 'file3.pdf', { type: 'application/pdf' }),
    ];

    const fileInput = screen.getByRole('button', { name: /choose files/i });
    fireEvent.click(fileInput);

    const hiddenInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(hiddenInput, 'files', {
      value: files,
    });

    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    fireEvent.change(hiddenInput);

    expect(alertSpy).toHaveBeenCalledWith('Maximum 2 files can be uploaded at once');

    alertSpy.mockRestore();
  });
});