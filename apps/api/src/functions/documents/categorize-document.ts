import { ApiResponse } from '@scalemap/shared';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { authorization } from '../../services/authorization';
import { db } from '../../services/database';
import { OpenAIService } from '../../services/openai-service';
import { logger } from '../../utils/logger';
import { Monitoring } from '../../utils/monitoring';

interface DocumentCategorizationRequest {
  documentId: string;
  manualCategory?: string;
  forceRecategorize?: boolean;
}

interface DocumentCategorizationResponse {
  documentId: string;
  category: string;
  confidence: number;
  suggestedCategories: Array<{
    domain: string;
    confidence: number;
    reasoning: string;
  }>;
  manualOverride: boolean;
}

interface DocumentData {
  companyId: string;
  processing: {
    status: string;
    extractedText?: string;
  };
  categorization?: {
    category?: string;
  };
  metadata: {
    originalFilename: string;
  };
}

interface DocumentRecord {
  Data: DocumentData;
}

// Operational domains as per ScaleMap architecture
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
] as const;

type OperationalDomain = typeof OPERATIONAL_DOMAINS[number];

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const requestId = event.requestContext?.requestId || 'unknown';
  const requestLogger = logger.child({ requestId, function: 'categorize-document' });

  try {
    requestLogger.info('Document categorization request initiated');
    Monitoring.incrementCounter('DocumentCategorizationRequests');

    // Extract assessment ID from path
    const assessmentId = event.pathParameters?.assessmentId;
    if (!assessmentId) {
      return createErrorResponse(400, 'MISSING_ASSESSMENT_ID', 'Assessment ID is required', requestId);
    }

    // Authenticate and authorize user
    const authResult = await authorization.authenticateAndAuthorize(
      event,
      'assessments:update',
      { assessmentId }
    );

    if (!authResult.success) {
      return createErrorResponse(401, 'UNAUTHORIZED', authResult.message || 'Unauthorized', requestId);
    }

    const { user } = authResult;
    if (!user) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User not found in auth result', requestId);
    }

    // Validate request body
    if (!event.body) {
      return createErrorResponse(400, 'INVALID_REQUEST', 'Request body is required', requestId);
    }

    const categorizationRequest: DocumentCategorizationRequest = JSON.parse(event.body);

    // Validate categorization request
    const validationError = validateCategorizationRequest(categorizationRequest);
    if (validationError) {
      return createErrorResponse(400, validationError.code, validationError.message, requestId);
    }

    // Get document record
    const documentRecord = await db.get(
      `ASSESSMENT#${assessmentId}`,
      `DOCUMENT#${categorizationRequest.documentId}`
    ) as DocumentRecord | null;

    if (!documentRecord) {
      return createErrorResponse(404, 'DOCUMENT_NOT_FOUND', 'Document not found', requestId);
    }

    // Verify document belongs to user's company
    if (documentRecord.Data.companyId !== user.companyId) {
      return createErrorResponse(403, 'ACCESS_DENIED', 'Access denied to document', requestId);
    }

    // Check if document has been processed
    if (documentRecord.Data.processing.status !== 'completed') {
      return createErrorResponse(400, 'DOCUMENT_NOT_PROCESSED', 'Document must be processed before categorization', requestId);
    }

    let category: string;
    let confidence: number;
    let suggestedCategories: Array<{ domain: string; confidence: number; reasoning: string }> = [];
    let manualOverride = false;

    if (categorizationRequest.manualCategory) {
      // Manual categorization
      if (!OPERATIONAL_DOMAINS.includes(categorizationRequest.manualCategory as OperationalDomain)) {
        return createErrorResponse(400, 'INVALID_DOMAIN', 'Invalid operational domain', requestId);
      }

      category = categorizationRequest.manualCategory;
      confidence = 1.0;
      manualOverride = true;

      requestLogger.info('Manual categorization applied', {
        documentId: categorizationRequest.documentId,
        category,
        userId: user.sub
      });

    } else {
      // AI-powered categorization
      const extractedText = documentRecord.Data.processing.extractedText;

      if (!extractedText || extractedText.trim().length === 0) {
        return createErrorResponse(400, 'NO_TEXT_CONTENT', 'Document has no extractable text for categorization', requestId);
      }

      // Check if already categorized and not forcing recategorization
      const currentCategory = documentRecord.Data.categorization?.category;
      if (currentCategory && !categorizationRequest.forceRecategorize) {
        return createErrorResponse(400, 'ALREADY_CATEGORIZED', 'Document already categorized. Use forceRecategorize=true to override', requestId);
      }

      try {
        const categorizationResult = await categorizeWithAI(extractedText, documentRecord.Data.metadata.originalFilename);

        category = categorizationResult.primaryCategory;
        confidence = categorizationResult.confidence;
        suggestedCategories = categorizationResult.suggestions;

        requestLogger.info('AI categorization completed', {
          documentId: categorizationRequest.documentId,
          category,
          confidence,
          suggestionsCount: suggestedCategories.length
        });

      } catch (aiError) {
        requestLogger.error('AI categorization failed', {
          documentId: categorizationRequest.documentId,
          error: (aiError as Error).message
        });

        // Fallback to filename-based categorization
        const fallbackResult = categorizeFallback(documentRecord.Data.metadata.originalFilename);
        category = fallbackResult.category;
        confidence = fallbackResult.confidence;
        suggestedCategories = fallbackResult.suggestions;

        requestLogger.info('Fallback categorization applied', {
          documentId: categorizationRequest.documentId,
          category,
          confidence
        });
      }
    }

    // Update document categorization in DynamoDB
    await db.update(
      `ASSESSMENT#${assessmentId}`,
      `DOCUMENT#${categorizationRequest.documentId}`,
      'SET #categorization.#category = :category, #categorization.#confidence = :confidence, #categorization.#manualOverride = :manualOverride, #categorization.#suggestedCategories = :suggestions, #categorization.#categorizedAt = :categorizedAt, #categorization.#categorizedBy = :categorizedBy',
      {
        ':category': category,
        ':confidence': confidence,
        ':manualOverride': manualOverride,
        ':suggestions': suggestedCategories,
        ':categorizedAt': new Date().toISOString(),
        ':categorizedBy': user.sub
      },
      {
        '#categorization': 'categorization',
        '#category': 'category',
        '#confidence': 'confidence',
        '#manualOverride': 'manualOverride',
        '#suggestedCategories': 'suggestedCategories',
        '#categorizedAt': 'categorizedAt',
        '#categorizedBy': 'categorizedBy'
      }
    );

    Monitoring.incrementCounter('DocumentCategorized', {
      domain: category,
      method: manualOverride ? 'manual' : 'ai',
      confidence: confidence.toString()
    });

    const response: DocumentCategorizationResponse = {
      documentId: categorizationRequest.documentId,
      category,
      confidence,
      suggestedCategories,
      manualOverride
    };

    const apiResponse: ApiResponse<DocumentCategorizationResponse> = {
      success: true,
      data: response,
      meta: {
        timestamp: new Date().toISOString(),
        requestId
      }
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block'
      },
      body: JSON.stringify(apiResponse)
    };

  } catch (error) {
    Monitoring.recordError('categorize-document', 'UnexpectedError', error as Error);
    requestLogger.error('Document categorization failed', { error: (error as Error).message });

    return createErrorResponse(500, 'INTERNAL_ERROR', 'Internal server error', requestId);
  }
};

async function categorizeWithAI(extractedText: string, filename: string): Promise<{
  primaryCategory: string;
  confidence: number;
  suggestions: Array<{ domain: string; confidence: number; reasoning: string }>;
}> {
  const openAIService = new OpenAIService();

  // Truncate text if too long (keep first and last portions)
  const maxLength = 4000;
  let textToAnalyze = extractedText;

  if (extractedText.length > maxLength) {
    const halfLength = maxLength / 2;
    textToAnalyze = extractedText.substring(0, halfLength) +
                  '\n\n[... content truncated ...]\n\n' +
                  extractedText.substring(extractedText.length - halfLength);
  }

  const prompt = `Analyze the following document content and categorize it into one of these operational domains:

${OPERATIONAL_DOMAINS.map((domain, index) => `${index + 1}. ${domain}`).join('\n')}

Document filename: ${filename}

Document content:
${textToAnalyze}

Provide categorization analysis in this exact JSON format:
{
  "primaryCategory": "exact domain name from list",
  "confidence": 0.85,
  "reasoning": "brief explanation for primary categorization",
  "suggestions": [
    {
      "domain": "domain name",
      "confidence": 0.75,
      "reasoning": "why this domain is relevant"
    }
  ]
}

Consider:
- Document content themes and keywords
- Filename context
- Business process indicators
- Organizational function references

Return only valid JSON with no additional text.`;

  try {
    const response = await openAIService.generateCompletion(prompt, {
      model: 'gpt-4o-mini', // Cost-optimized model for categorization
      maxTokens: 500,
      temperature: 0.1
    });

    const result = JSON.parse(response);

    // Validate result structure
    if (!result.primaryCategory || !OPERATIONAL_DOMAINS.includes(result.primaryCategory)) {
      throw new Error('Invalid primary category in AI response');
    }

    return {
      primaryCategory: result.primaryCategory,
      confidence: Math.min(Math.max(result.confidence || 0.5, 0), 1),
      suggestions: (result.suggestions || []).slice(0, 3) // Limit to top 3 suggestions
    };

  } catch (error) {
    throw new Error(`AI categorization failed: ${(error as Error).message}`);
  }
}

function categorizeFallback(filename: string): {
  category: string;
  confidence: number;
  suggestions: Array<{ domain: string; confidence: number; reasoning: string }>;
} {
  const lowerFilename = filename.toLowerCase();

  // Keyword mappings for fallback categorization
  const keywordMappings: Record<string, { domain: OperationalDomain; confidence: number }> = {
    'finance': { domain: 'Finance & Accounting', confidence: 0.7 },
    'financial': { domain: 'Finance & Accounting', confidence: 0.7 },
    'budget': { domain: 'Finance & Accounting', confidence: 0.7 },
    'accounting': { domain: 'Finance & Accounting', confidence: 0.8 },
    'invoice': { domain: 'Finance & Accounting', confidence: 0.7 },
    'hr': { domain: 'HR & People', confidence: 0.8 },
    'human_resources': { domain: 'HR & People', confidence: 0.8 },
    'employee': { domain: 'HR & People', confidence: 0.6 },
    'staff': { domain: 'HR & People', confidence: 0.5 },
    'sales': { domain: 'Sales & Marketing', confidence: 0.8 },
    'marketing': { domain: 'Sales & Marketing', confidence: 0.8 },
    'customer': { domain: 'Customer Service', confidence: 0.6 },
    'support': { domain: 'Customer Service', confidence: 0.6 },
    'tech': { domain: 'Technology & IT', confidence: 0.7 },
    'technology': { domain: 'Technology & IT', confidence: 0.8 },
    'it': { domain: 'Technology & IT', confidence: 0.7 },
    'software': { domain: 'Technology & IT', confidence: 0.7 },
    'operations': { domain: 'Operations & Production', confidence: 0.8 },
    'production': { domain: 'Operations & Production', confidence: 0.8 },
    'strategy': { domain: 'Strategy & Planning', confidence: 0.8 },
    'strategic': { domain: 'Strategy & Planning', confidence: 0.7 },
    'legal': { domain: 'Legal & Compliance', confidence: 0.8 },
    'compliance': { domain: 'Legal & Compliance', confidence: 0.8 },
    'contract': { domain: 'Legal & Compliance', confidence: 0.7 },
    'quality': { domain: 'Quality Management', confidence: 0.8 },
    'risk': { domain: 'Risk Management', confidence: 0.8 },
    'product': { domain: 'Product Development', confidence: 0.7 },
    'development': { domain: 'Product Development', confidence: 0.6 },
    'supply': { domain: 'Supply Chain', confidence: 0.7 },
    'chain': { domain: 'Supply Chain', confidence: 0.5 },
    'procurement': { domain: 'Supply Chain', confidence: 0.7 }
  };

  // Find best matching keywords
  const matches = Object.entries(keywordMappings)
    .filter(([keyword]) => lowerFilename.includes(keyword))
    .sort((a, b) => b[1].confidence - a[1].confidence);

  if (matches.length > 0 && matches[0]) {
    const bestMatch = matches[0][1];
    return {
      category: bestMatch.domain,
      confidence: bestMatch.confidence * 0.8, // Reduce confidence for fallback method
      suggestions: matches.slice(0, 3).map(([keyword, data]) => ({
        domain: data.domain,
        confidence: data.confidence * 0.7,
        reasoning: `Filename contains keyword: ${keyword}`
      }))
    };
  }

  // Default to Operations if no keywords match
  return {
    category: 'Operations & Production',
    confidence: 0.3,
    suggestions: [{
      domain: 'Operations & Production',
      confidence: 0.3,
      reasoning: 'Default categorization - no clear domain indicators found'
    }]
  };
}

function validateCategorizationRequest(request: DocumentCategorizationRequest): { code: string; message: string } | null {
  if (!request.documentId || typeof request.documentId !== 'string') {
    return { code: 'INVALID_DOCUMENT_ID', message: 'Valid document ID is required' };
  }

  if (request.manualCategory && !OPERATIONAL_DOMAINS.includes(request.manualCategory as OperationalDomain)) {
    return { code: 'INVALID_DOMAIN', message: `Invalid domain. Must be one of: ${OPERATIONAL_DOMAINS.join(', ')}` };
  }

  return null;
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
  };

  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    },
    body: JSON.stringify(response),
  };
}