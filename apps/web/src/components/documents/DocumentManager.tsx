'use client';

import React, { useState, useEffect } from 'react';

import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

import { DocumentUpload } from './DocumentUpload';

// Simple icon components
const DocumentIcon = () => <span>📄</span>;
const TrashIcon = () => <span>🗑️</span>;
const EyeIcon = () => <span>👁️</span>;
const ArrowDownTrayIcon = () => <span>⬇️</span>;
const FunnelIcon = () => <span>🔽</span>;
const MagnifyingGlassIcon = () => <span>🔍</span>;

interface Document {
  documentId: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
  status: 'pending_upload' | 'pending' | 'processing' | 'completed' | 'failed';
  category?: string;
  confidence?: number;
  manualOverride?: boolean;
  hasPreview: boolean;
  downloadUrl?: string;
}

interface DocumentManagerProps {
  assessmentId: string;
  className?: string;
  allowUpload?: boolean;
  allowDelete?: boolean;
  domain?: string;
}

interface FilterState {
  search: string;
  category: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

const OPERATIONAL_DOMAINS = [
  'Strategic Alignment',
  'Financial Management',
  'Revenue Engine',
  'Operational Excellence',
  'People & Organization',
  'Technology & Data',
  'Customer Experience',
  'Supply Chain',
  'Risk & Compliance',
  'Partnerships',
  'Customer Success',
  'Change Management'
];

const STATUS_LABELS: Record<Document['status'], string> = {
  pending_upload: 'Pending Upload',
  pending: 'Pending Processing',
  processing: 'Processing',
  completed: 'Completed',
  failed: 'Failed'
};

const STATUS_COLORS: Record<Document['status'], string> = {
  pending_upload: 'text-gray-600 bg-gray-100',
  pending: 'text-yellow-600 bg-yellow-100',
  processing: 'text-blue-600 bg-blue-100',
  completed: 'text-green-600 bg-green-100',
  failed: 'text-red-600 bg-red-100'
};

export function DocumentManager({
  assessmentId,
  className = '',
  allowUpload = true,
  allowDelete = true,
  domain
}: DocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    category: '',
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  // Simulate loading documents
  useEffect(() => {
    loadDocuments();
  }, [assessmentId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Mock documents data
      const mockDocuments: Document[] = [
        {
          documentId: 'doc1',
          originalFilename: 'Financial_Report_Q3.pdf',
          fileSize: 2048000,
          mimeType: 'application/pdf',
          uploadedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          uploadedBy: 'Current User',
          status: 'completed',
          category: 'Financial Management',
          confidence: 0.95,
          hasPreview: true,
          downloadUrl: '#'
        },
        {
          documentId: 'doc2',
          originalFilename: 'Organization_Chart.png',
          fileSize: 512000,
          mimeType: 'image/png',
          uploadedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          uploadedBy: 'Current User',
          status: 'completed',
          category: 'People & Organization',
          confidence: 0.88,
          hasPreview: true,
          downloadUrl: '#'
        }
      ];

      setDocuments(mockDocuments);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (documentId: string, file: File) => {
    const newDocument: Document = {
      documentId,
      originalFilename: file.name,
      fileSize: file.size,
      mimeType: file.type,
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Current User',
      status: 'processing',
      hasPreview: false
    };

    setDocuments(prev => [...prev, newDocument]);

    // Simulate processing completion
    setTimeout(() => {
      setDocuments(prev =>
        prev.map(doc =>
          doc.documentId === documentId
            ? {
                ...doc,
                status: 'completed',
                category: domain || 'Strategic Alignment',
                confidence: 0.9,
                hasPreview: true
              }
            : doc
        )
      );
    }, 2000);
  };

  const deleteDocument = async (documentId: string) => {
    if (!allowDelete) return;

    if (confirm('Are you sure you want to delete this document?')) {
      setDocuments(prev => prev.filter(doc => doc.documentId !== documentId));
    }
  };

  const filteredDocuments = documents.filter(doc => {
    if (filters.search && !doc.originalFilename.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }
    if (filters.category && doc.category !== filters.category) {
      return false;
    }
    if (filters.status && doc.status !== filters.status) {
      return false;
    }
    return true;
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Document Library
          </h3>
          <p className="text-sm text-gray-600">
            {documents.length} documents uploaded
          </p>
        </div>

        {allowUpload && (
          <Button
            onClick={() => setShowUpload(!showUpload)}
            className="flex items-center space-x-2"
          >
            <span>☁️⬆️</span>
            <span>{showUpload ? 'Hide Upload' : 'Upload Documents'}</span>
          </Button>
        )}
      </div>

      {/* Upload Component */}
      {showUpload && allowUpload && (
        <div className="border border-gray-200 rounded-lg p-4">
          <DocumentUpload
            assessmentId={assessmentId}
            onUploadComplete={handleUploadComplete}
            domain={domain}
            maxFiles={5}
          />
        </div>
      )}

      {/* Filters */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="flex items-center space-x-2">
          <MagnifyingGlassIcon />
          <span className="text-sm font-medium">Filters</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search files..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div>
            <select
              value={filters.category}
              onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Categories</option>
              {OPERATIONAL_DOMAINS.map(domain => (
                <option key={domain} value={domain}>{domain}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="">All Statuses</option>
              {Object.entries(STATUS_LABELS).map(([status, label]) => (
                <option key={status} value={status}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({ search: '', category: '', status: '', dateFrom: '', dateTo: '' })}
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-gray-600">Loading documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DocumentIcon />
            <p className="mt-2">No documents found</p>
            {allowUpload && !showUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpload(true)}
                className="mt-2"
              >
                Upload your first document
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredDocuments.map((doc) => (
              <div key={doc.documentId} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <DocumentIcon />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {doc.originalFilename}
                        </h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${STATUS_COLORS[doc.status]}`}>
                          {STATUS_LABELS[doc.status]}
                        </span>
                      </div>

                      <div className="text-xs text-gray-500 space-y-1">
                        <div>
                          {formatFileSize(doc.fileSize)} • Uploaded {formatDate(doc.uploadedAt)}
                        </div>
                        {doc.category && (
                          <div>Category: {doc.category}
                            {doc.confidence && (
                              <span className="ml-1">({Math.round(doc.confidence * 100)}% confidence)</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {doc.hasPreview && (
                      <Button variant="outline" size="sm">
                        <EyeIcon />
                      </Button>
                    )}

                    {doc.downloadUrl && (
                      <Button variant="outline" size="sm">
                        <ArrowDownTrayIcon />
                      </Button>
                    )}

                    {allowDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteDocument(doc.documentId)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      {documents.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{documents.length}</div>
              <div className="text-sm text-gray-600">Total Documents</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {documents.filter(d => d.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Processed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {documents.filter(d => d.status === 'processing').length}
              </div>
              <div className="text-sm text-gray-600">Processing</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.round(documents.reduce((sum, d) => sum + d.fileSize, 0) / 1024 / 1024)}MB
              </div>
              <div className="text-sm text-gray-600">Total Size</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}