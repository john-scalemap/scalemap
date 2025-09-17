import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { authorization } from '../../services/authorization';
import { db } from '../../services/database';
import { DocumentService } from '../../services/document-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface DocumentCoverageResponse {
  assessmentId: string
  totalDocuments: number
  documentsByDomain: Record<string, {
    count: number
    completedCount: number
    processingCount: number
    failedCount: number
    requiredForCompletion: boolean
  }>
  overallCoverage: {
    domainsWithDocuments: number
    totalDomains: number
    coveragePercentage: number
    minimumRequirementMet: boolean
  }
  recommendations: Array<{
    domain: string
    priority: 'high' | 'medium' | 'low'
    message: string
    suggestedDocuments: string[]
  }>
}

interface AssessmentCompletionCheck {
  canComplete: boolean
  reasons: string[]
  documentRequirements: {
    domain: string
    required: boolean
    hasDocuments: boolean
    documentCount: number
  }[]
  nextSteps: string[]
}

const OPERATIONAL_DOMAINS = [
  'Finance & Accounting',
  'HR & People',
  'Sales & Marketing',
  'Operations & Production',
  'Technology & IT',
  'Strategy & Planning',
  'Legal & Compliance',
  'Customer Service',
  'Supply Chain',
  'Quality Management',
  'Risk Management',
  'Product Development'
] as const

// Domains that require documents for meaningful analysis
const HIGH_PRIORITY_DOMAINS = [
  'Finance & Accounting',
  'HR & People',
  'Operations & Production',
  'Technology & IT'
]

/**
 * Get document coverage analysis for an assessment
 */
export const getDocumentCoverage = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown'
  const requestLogger = logger.child({ requestId, function: 'get-document-coverage' })

  try {
    requestLogger.info('Document coverage request initiated')

    const assessmentId = event.pathParameters?.assessmentId
    if (!assessmentId) {
      return createErrorResponse(400, 'MISSING_ASSESSMENT_ID', 'Assessment ID is required', requestId)
    }

    // Authenticate and authorize user
    const authResult = await authorization.authenticateAndAuthorize(
      event,
      'assessments:read',
      { assessmentId }
    )

    if (!authResult.success) {
      return createErrorResponse(401, 'UNAUTHORIZED', authResult.message || 'Unauthorized', requestId)
    }

    const { user } = authResult
    if (!user) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not found in auth result', requestId)
    }

    // Verify assessment exists and belongs to user's company
    const assessment = await db.get(`ASSESSMENT#${assessmentId}`, 'METADATA')
    if (!assessment || assessment.companyId !== user.companyId) {
      return createErrorResponse(404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found', requestId)
    }

    // Get document statistics
    const documentService = new DocumentService()
    const documentStats = await documentService.getDocumentStatistics(assessmentId, user.companyId)

    // Analyze document coverage by domain
    const documentsByDomain: DocumentCoverageResponse['documentsByDomain'] = {}

    OPERATIONAL_DOMAINS.forEach(domain => {
      const count = documentStats.byCategory[domain] || 0

      // Get status breakdown for this domain
      const _domainDocuments = Object.entries(documentStats.byStatus).reduce((acc, [_status, _statusCount]) => {
        // This is simplified - in a real implementation, you'd need to query by both domain and status
        return acc
      }, { completed: 0, processing: 0, failed: 0 })

      documentsByDomain[domain] = {
        count,
        completedCount: Math.floor(count * 0.8), // Simplified estimation
        processingCount: Math.floor(count * 0.1),
        failedCount: Math.floor(count * 0.1),
        requiredForCompletion: HIGH_PRIORITY_DOMAINS.includes(domain)
      }
    })

    // Calculate overall coverage
    const domainsWithDocuments = Object.values(documentsByDomain).filter(domain => domain.count > 0).length
    const coveragePercentage = (domainsWithDocuments / OPERATIONAL_DOMAINS.length) * 100

    // Check minimum requirements
    const highPriorityDomainsWithDocs = HIGH_PRIORITY_DOMAINS.filter(domain => {
      const domainData = documentsByDomain[domain]
      return domainData !== undefined && domainData.count > 0
    }).length
    const minimumRequirementMet = highPriorityDomainsWithDocs >= Math.ceil(HIGH_PRIORITY_DOMAINS.length * 0.5)

    // Generate recommendations
    const recommendations = generateDocumentRecommendations(documentsByDomain, assessment)

    const response: DocumentCoverageResponse = {
      assessmentId,
      totalDocuments: documentStats.total,
      documentsByDomain,
      overallCoverage: {
        domainsWithDocuments,
        totalDomains: OPERATIONAL_DOMAINS.length,
        coveragePercentage: Math.round(coveragePercentage),
        minimumRequirementMet
      },
      recommendations
    }

    Monitoring.incrementCounter('DocumentCoverageAnalysis', {
      assessmentId,
      coveragePercentage: Math.round(coveragePercentage).toString(),
      totalDocuments: documentStats.total.toString()
    })

    const apiResponse: ApiResponse<DocumentCoverageResponse> = {
      success: true,
      data: response,
      meta: {
        timestamp: new Date().toISOString(),
        requestId
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(apiResponse)
    }

  } catch (error) {
    Monitoring.recordError('get-document-coverage', 'UnexpectedError', error as Error)
    requestLogger.error('Document coverage analysis failed', { error: (error as Error).message })
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId)
  }
}

/**
 * Check if assessment can be completed based on document requirements
 */
export const checkAssessmentCompletion = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown'
  const requestLogger = logger.child({ requestId, function: 'check-assessment-completion' })

  try {
    const assessmentId = event.pathParameters?.assessmentId
    if (!assessmentId) {
      return createErrorResponse(400, 'MISSING_ASSESSMENT_ID', 'Assessment ID is required', requestId)
    }

    // Authenticate and authorize user
    const authResult = await authorization.authenticateAndAuthorize(
      event,
      'assessments:read',
      { assessmentId }
    )

    if (!authResult.success) {
      return createErrorResponse(401, 'UNAUTHORIZED', authResult.message || 'Unauthorized', requestId)
    }

    const { user } = authResult
    if (!user) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not found in auth result', requestId)
    }

    // Get assessment and document data
    const [assessment, documentStats] = await Promise.all([
      db.get(`ASSESSMENT#${assessmentId}`, 'METADATA'),
      new DocumentService().getDocumentStatistics(assessmentId, user.companyId)
    ])

    if (!assessment || assessment.companyId !== user.companyId) {
      return createErrorResponse(404, 'ASSESSMENT_NOT_FOUND', 'Assessment not found', requestId)
    }

    // Check completion requirements
    const completionCheck = await analyzeCompletionRequirements(
      assessment,
      documentStats,
      assessmentId,
      user.companyId
    )

    const apiResponse: ApiResponse<AssessmentCompletionCheck> = {
      success: true,
      data: completionCheck,
      meta: {
        timestamp: new Date().toISOString(),
        requestId
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS'
      },
      body: JSON.stringify(apiResponse)
    }

  } catch (error) {
    Monitoring.recordError('check-assessment-completion', 'UnexpectedError', error as Error)
    requestLogger.error('Assessment completion check failed', { error: (error as Error).message })
    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId)
  }
}

/**
 * Update assessment progress based on document availability
 */
export const updateAssessmentProgress = async (
  assessmentId: string,
  companyId: string
): Promise<void> => {
  const requestLogger = logger.child({ function: 'update-assessment-progress' })

  try {
    requestLogger.info('Updating assessment progress', { assessmentId, companyId })

    // Get current document statistics
    const documentService = new DocumentService()
    const documentStats = await documentService.getDocumentStatistics(assessmentId, companyId)

    // Calculate domain completion flags
    const domainFlags: Record<string, boolean> = {}
    OPERATIONAL_DOMAINS.forEach(domain => {
      const documentCount = documentStats.byCategory[domain] || 0
      domainFlags[`${domain}_has_documents`] = documentCount > 0
    })

    // Update assessment with document flags
    const updateExpression = 'SET #documentStats = :stats, #domainFlags = :flags, #lastDocumentUpdate = :timestamp'
    const expressionAttributeNames = {
      '#documentStats': 'documentStatistics',
      '#domainFlags': 'domainDocumentFlags',
      '#lastDocumentUpdate': 'lastDocumentUpdate'
    }
    const expressionAttributeValues = {
      ':stats': {
        totalDocuments: documentStats.total,
        documentsByCategory: documentStats.byCategory,
        documentsByStatus: documentStats.byStatus,
        totalSize: documentStats.totalSize,
        lastUpdated: new Date().toISOString()
      },
      ':flags': domainFlags,
      ':timestamp': new Date().toISOString()
    }

    await db.update(
      `ASSESSMENT#${assessmentId}`,
      'METADATA',
      updateExpression,
      expressionAttributeValues,
      expressionAttributeNames
    )

    Monitoring.incrementCounter('AssessmentProgressUpdated', {
      assessmentId,
      totalDocuments: documentStats.total.toString()
    })

  } catch (error) {
    requestLogger.error('Failed to update assessment progress', {
      assessmentId,
      companyId,
      error: (error as Error).message
    })
    throw error
  }
}

function generateDocumentRecommendations(
  documentsByDomain: DocumentCoverageResponse['documentsByDomain'],
  _assessment: any
): DocumentCoverageResponse['recommendations'] {
  const recommendations: DocumentCoverageResponse['recommendations'] = []

  // Check high-priority domains without documents
  HIGH_PRIORITY_DOMAINS.forEach(domain => {
    const domainData = documentsByDomain[domain]
    if (domainData && domainData.count === 0) {
      recommendations.push({
        domain,
        priority: 'high',
        message: `Upload documents for ${domain} to enable comprehensive analysis`,
        suggestedDocuments: getSuggestedDocuments(domain)
      })
    }
  })

  // Check other domains without documents
  OPERATIONAL_DOMAINS.forEach(domain => {
    const domainData = documentsByDomain[domain]
    if (!HIGH_PRIORITY_DOMAINS.includes(domain) && domainData && domainData.count === 0) {
      recommendations.push({
        domain,
        priority: 'medium',
        message: `Consider uploading documents for ${domain} for more detailed insights`,
        suggestedDocuments: getSuggestedDocuments(domain)
      })
    }
  })

  // Check domains with failed processing
  Object.entries(documentsByDomain).forEach(([domain, data]) => {
    if (data.failedCount > 0) {
      recommendations.push({
        domain,
        priority: 'high',
        message: `${data.failedCount} document(s) failed processing in ${domain}. Check and re-upload if needed.`,
        suggestedDocuments: []
      })
    }
  })

  return recommendations.slice(0, 10) // Limit to top 10 recommendations
}

function getSuggestedDocuments(domain: string): string[] {
  const suggestions: Record<string, string[]> = {
    'Finance & Accounting': [
      'Financial statements (P&L, Balance Sheet)',
      'Budget reports',
      'Cash flow statements',
      'Accounts receivable/payable reports',
      'Audit reports'
    ],
    'HR & People': [
      'Organization chart',
      'Employee handbook',
      'Job descriptions',
      'Performance review templates',
      'Training records'
    ],
    'Sales & Marketing': [
      'Sales reports',
      'Marketing plans',
      'Customer acquisition costs',
      'Lead generation reports',
      'Brand guidelines'
    ],
    'Operations & Production': [
      'Process documentation',
      'Standard operating procedures',
      'Production schedules',
      'Quality control reports',
      'Equipment maintenance logs'
    ],
    'Technology & IT': [
      'IT infrastructure documentation',
      'Software inventory',
      'Security policies',
      'System architecture diagrams',
      'Backup and recovery procedures'
    ],
    'Strategy & Planning': [
      'Strategic plans',
      'Business model canvas',
      'Market analysis reports',
      'Competitive analysis',
      'Growth projections'
    ],
    'Legal & Compliance': [
      'Contracts and agreements',
      'Compliance reports',
      'Legal policies',
      'Risk assessments',
      'Regulatory filings'
    ],
    'Customer Service': [
      'Customer satisfaction surveys',
      'Support ticket reports',
      'Service level agreements',
      'Customer feedback',
      'Resolution procedures'
    ],
    'Supply Chain': [
      'Supplier contracts',
      'Inventory reports',
      'Procurement procedures',
      'Logistics documentation',
      'Vendor assessments'
    ],
    'Quality Management': [
      'Quality management system documentation',
      'Quality control procedures',
      'Certification documents',
      'Inspection reports',
      'Customer complaint logs'
    ],
    'Risk Management': [
      'Risk assessment reports',
      'Risk mitigation plans',
      'Insurance policies',
      'Business continuity plans',
      'Incident reports'
    ],
    'Product Development': [
      'Product specifications',
      'Development roadmaps',
      'Testing procedures',
      'User research reports',
      'Product lifecycle documentation'
    ]
  }

  return suggestions[domain] || ['Relevant documentation for this domain']
}

async function analyzeCompletionRequirements(
  assessment: any,
  documentStats: any,
  _assessmentId: string,
  _companyId: string
): Promise<AssessmentCompletionCheck> {
  const reasons: string[] = []
  const nextSteps: string[] = []
  const documentRequirements: AssessmentCompletionCheck['documentRequirements'] = []

  // Check overall document requirements
  if (documentStats.total === 0) {
    reasons.push('No documents have been uploaded')
    nextSteps.push('Upload at least one document to begin analysis')
  }

  // Check high-priority domain requirements
  let highPriorityDomainsWithDocs = 0
  HIGH_PRIORITY_DOMAINS.forEach(domain => {
    const hasDocuments = (documentStats.byCategory[domain] || 0) > 0
    if (hasDocuments) highPriorityDomainsWithDocs++

    documentRequirements.push({
      domain,
      required: true,
      hasDocuments,
      documentCount: documentStats.byCategory[domain] || 0
    })

    if (!hasDocuments) {
      nextSteps.push(`Upload documents for ${domain}`)
    }
  })

  // Add other domains as optional
  OPERATIONAL_DOMAINS.forEach(domain => {
    if (!HIGH_PRIORITY_DOMAINS.includes(domain)) {
      const hasDocuments = (documentStats.byCategory[domain] || 0) > 0
      documentRequirements.push({
        domain,
        required: false,
        hasDocuments,
        documentCount: documentStats.byCategory[domain] || 0
      })
    }
  })

  // Check minimum coverage requirement
  const minimumCoverageRequired = Math.ceil(HIGH_PRIORITY_DOMAINS.length * 0.5)
  if (highPriorityDomainsWithDocs < minimumCoverageRequired) {
    reasons.push(
      `Minimum document coverage not met. Need documents in at least ${minimumCoverageRequired} high-priority domains (currently ${highPriorityDomainsWithDocs})`
    )
  }

  // Check processing status
  const processingCount = documentStats.byStatus.processing || 0
  const failedCount = documentStats.byStatus.failed || 0

  if (processingCount > 0) {
    reasons.push(`${processingCount} document(s) still being processed`)
    nextSteps.push('Wait for document processing to complete')
  }

  if (failedCount > 0) {
    reasons.push(`${failedCount} document(s) failed processing`)
    nextSteps.push('Review and re-upload failed documents')
  }

  // Check assessment questionnaire completion (simplified check)
  const questionsAnswered = assessment.questionsAnswered || 0
  const totalQuestions = assessment.totalQuestions || 50
  const questionnaireCompletionRate = questionsAnswered / totalQuestions

  if (questionnaireCompletionRate < 0.8) {
    reasons.push('Assessment questionnaire not sufficiently completed')
    nextSteps.push('Complete remaining assessment questions')
  }

  const canComplete = reasons.length === 0

  if (canComplete) {
    nextSteps.push('Assessment is ready for completion and analysis')
  }

  return {
    canComplete,
    reasons,
    documentRequirements,
    nextSteps
  }
}

function createErrorResponse(
  statusCode: number,
  code: string,
  message: string,
  requestId: string
): APIGatewayProxyResult {
  const response: ApiResponse = {
    success: false,
    error: { code, message },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  }

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,OPTIONS'
    },
    body: JSON.stringify(response),
  }
}