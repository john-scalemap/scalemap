'use client'

import React, { useState, useEffect } from 'react'
// Simple icon components
const XMarkIcon = ({ className }: { className?: string }) => <span className={className}>❌</span>;
const ArrowDownTrayIcon = ({ className }: { className?: string }) => <span className={className}>⬇️</span>;
const DocumentTextIcon = ({ className }: { className?: string }) => <span className={className}>📄</span>;
const TagIcon = ({ className }: { className?: string }) => <span className={className}>🏷️</span>;

import { cn } from '../../lib/utils'
import { Button } from '../ui/Button'

interface Document {
  documentId: string
  originalFilename: string
  fileSize: number
  mimeType: string
  uploadedAt: string
  uploadedBy: string
  status: 'pending_upload' | 'pending' | 'processing' | 'completed' | 'failed'
  category?: string
  confidence?: number
  manualOverride?: boolean
  hasPreview: boolean
  downloadUrl?: string
}

interface DocumentDetails extends Document {
  extractedText?: string
  processingErrors?: string[]
  textractJobId?: string
  processingTime?: number
  suggestedCategories?: Array<{
    domain: string
    confidence: number
    reasoning: string
  }>
  s3Key: string
  encryptionStatus: string
}

interface DocumentPreviewProps {
  document: Document
  onClose: () => void
  className?: string
}

export function DocumentPreview({
  document,
  onClose,
  className
}: DocumentPreviewProps) {
  const [documentDetails, setDocumentDetails] = useState<DocumentDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'preview' | 'text' | 'metadata'>('preview')

  useEffect(() => {
    loadDocumentDetails()
  }, [document.documentId])

  const loadDocumentDetails = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(
        `/api/assessments/${extractAssessmentId()}/documents/${document.documentId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      )

      if (!response.ok) {
        throw new Error('Failed to load document details')
      }

      const data = await response.json()
      setDocumentDetails(data.data)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document details')
    } finally {
      setLoading(false)
    }
  }

  const extractAssessmentId = () => {
    // Extract assessment ID from current URL path
    const pathParts = window.location.pathname.split('/')
    const assessmentIndex = pathParts.findIndex(part => part === 'assessments')
    return assessmentIndex !== -1 ? pathParts[assessmentIndex + 1] : ''
  }

  const handleDownload = async () => {
    if (!document.downloadUrl) {
      alert('Download URL not available')
      return
    }

    try {
      const response = await fetch(document.downloadUrl)
      const blob = await response.blob()

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = document.originalFilename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

    } catch (err) {
      alert('Failed to download document')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatProcessingTime = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  const renderPreview = () => {
    if (!document.hasPreview) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500">
          <DocumentTextIcon className="h-16 w-16 mb-4" />
          <p>Preview not available for this file type</p>
          <p className="text-sm">Use the download button to view the file</p>
        </div>
      )
    }

    if (document.mimeType.startsWith('image/')) {
      return (
        <div className="flex justify-center">
          <img
            src={document.downloadUrl}
            alt={document.originalFilename}
            className="max-w-full max-h-96 object-contain"
          />
        </div>
      )
    }

    if (document.mimeType === 'application/pdf') {
      return (
        <div className="h-96">
          <iframe
            src={`${document.downloadUrl}#view=FitH`}
            className="w-full h-full border border-gray-200 rounded"
            title={document.originalFilename}
          />
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <DocumentTextIcon className="h-16 w-16 mb-4" />
        <p>Preview not available</p>
      </div>
    )
  }

  const renderExtractedText = () => {
    if (!documentDetails?.extractedText) {
      return (
        <div className="flex flex-col items-center justify-center h-96 text-gray-500">
          <DocumentTextIcon className="h-16 w-16 mb-4" />
          <p>No extracted text available</p>
          {document.status === 'processing' && (
            <p className="text-sm">Document is still being processed</p>
          )}
          {document.status === 'failed' && (
            <p className="text-sm text-red-600">Text extraction failed</p>
          )}
        </div>
      )
    }

    return (
      <div className="h-96 overflow-auto">
        <div className="p-4 bg-gray-50 border border-gray-200 rounded">
          <pre className="whitespace-pre-wrap text-sm text-gray-900 font-mono">
            {documentDetails.extractedText}
          </pre>
        </div>
      </div>
    )
  }

  const renderMetadata = () => {
    if (!documentDetails) {
      return <div>Loading metadata...</div>
    }

    return (
      <div className="space-y-6">
        {/* Basic Information */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Basic Information</h4>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500">File Name</dt>
              <dd className="text-sm text-gray-900">{documentDetails.originalFilename}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">File Size</dt>
              <dd className="text-sm text-gray-900">{formatFileSize(documentDetails.fileSize)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">File Type</dt>
              <dd className="text-sm text-gray-900">{documentDetails.mimeType}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Uploaded At</dt>
              <dd className="text-sm text-gray-900">{formatDate(documentDetails.uploadedAt)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="text-sm text-gray-900 capitalize">{documentDetails.status.replace('_', ' ')}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Encryption</dt>
              <dd className="text-sm text-gray-900 capitalize">{documentDetails.encryptionStatus}</dd>
            </div>
          </dl>
        </div>

        {/* Processing Information */}
        {documentDetails.status !== 'pending_upload' && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Processing Information</h4>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Processing Time</dt>
                <dd className="text-sm text-gray-900">{formatProcessingTime(documentDetails.processingTime)}</dd>
              </div>
              {documentDetails.textractJobId && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">Textract Job ID</dt>
                  <dd className="text-sm text-gray-900 font-mono">{documentDetails.textractJobId}</dd>
                </div>
              )}
              {documentDetails.processingErrors && documentDetails.processingErrors.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">Processing Errors</dt>
                  <dd className="text-sm text-red-600">
                    <ul className="list-disc list-inside">
                      {documentDetails.processingErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Categorization Information */}
        {documentDetails.category && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3">Categorization</h4>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Category</dt>
                <dd className="text-sm text-gray-900">{documentDetails.category}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Confidence</dt>
                <dd className="text-sm text-gray-900">
                  {documentDetails.confidence ? `${(documentDetails.confidence * 100).toFixed(1)}%` : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Method</dt>
                <dd className="text-sm text-gray-900">
                  {documentDetails.manualOverride ? 'Manual' : 'Automatic'}
                </dd>
              </div>
            </dl>

            {/* Suggested Categories */}
            {documentDetails.suggestedCategories && documentDetails.suggestedCategories.length > 0 && (
              <div className="mt-4">
                <dt className="text-sm font-medium text-gray-500 mb-2">Suggested Categories</dt>
                <div className="space-y-2">
                  {documentDetails.suggestedCategories.map((suggestion, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{suggestion.domain}</span>
                        <p className="text-xs text-gray-500">{suggestion.reasoning}</p>
                      </div>
                      <span className="text-xs text-gray-500">
                        {(suggestion.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className={cn(
          'inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full',
          className
        )}>
          {/* Header */}
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <DocumentTextIcon className="h-6 w-6 text-gray-400 mr-3" />
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {document.originalFilename}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(document.fileSize)} • {document.mimeType}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {document.downloadUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                  >
                    <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                >
                  <XMarkIcon className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Category Badge */}
            {document.category && (
              <div className="mt-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  <TagIcon className="h-4 w-4 mr-1" />
                  {document.category}
                </span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('preview')}
                className={cn(
                  'py-2 px-1 border-b-2 font-medium text-sm',
                  activeTab === 'preview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                Preview
              </button>
              <button
                onClick={() => setActiveTab('text')}
                className={cn(
                  'py-2 px-1 border-b-2 font-medium text-sm',
                  activeTab === 'text'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                Extracted Text
              </button>
              <button
                onClick={() => setActiveTab('metadata')}
                className={cn(
                  'py-2 px-1 border-b-2 font-medium text-sm',
                  activeTab === 'metadata'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                )}
              >
                Metadata
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-96 text-red-600">
                <p>{error}</p>
              </div>
            ) : (
              <>
                {activeTab === 'preview' && renderPreview()}
                {activeTab === 'text' && renderExtractedText()}
                {activeTab === 'metadata' && renderMetadata()}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}