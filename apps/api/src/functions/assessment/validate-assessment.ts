import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  Assessment,
  AssessmentValidation,
  AssessmentValidationError,
  ValidationWarning,
  DomainName,
  IndustryClassification
} from '@scalemap/shared';
import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';

const dynamoDb = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'scalemap-table';

interface ValidateAssessmentRequest {
  domainResponses: Record<string, any>;
  industryClassification?: IndustryClassification;
}

// Validation rules from the assessment schema
const VALIDATION_RULES = {
  completenessThresholds: {
    minimum: 70,
    recommended: 85,
    comprehensive: 95
  },
  domainValidation: {
    'strategic-alignment': {
      requiredQuestions: ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6'],
      scoringWeights: { '1.1': 0.25, '1.2': 0.20, '1.3': 0.15, '1.4': 0.15, '1.5': 0.10, '1.6': 0.15 }
    },
    'financial-management': {
      requiredQuestions: ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7'],
      scoringWeights: { '2.1': 0.20, '2.2': 0.15, '2.3': 0.20, '2.4': 0.15, '2.5': 0.10, '2.6': 0.10, '2.7': 0.10 }
    }
    // Add other domains as needed
  }
};

const validateDomainResponses = (
  domainName: DomainName,
  responses: Record<string, any>,
  _industryClassification?: IndustryClassification
): { errors: AssessmentValidationError[]; warnings: ValidationWarning[] } => {
  const errors: AssessmentValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  const domainRules = VALIDATION_RULES.domainValidation[domainName as keyof typeof VALIDATION_RULES.domainValidation];
  if (!domainRules) {
    return { errors, warnings };
  }

  // Check required questions
  domainRules.requiredQuestions.forEach(questionId => {
    const response = responses[questionId];
    if (!response || response.value === null || response.value === undefined || response.value === '') {
      errors.push({
        field: `${domainName}.${questionId}`,
        message: `Required question ${questionId} is not answered`,
        type: 'required'
      });
    }
  });

  // Validate response formats
  Object.entries(responses).forEach(([questionId, response]) => {
    if (!response || typeof response !== 'object') {
      errors.push({
        field: `${domainName}.${questionId}`,
        message: 'Invalid response format',
        type: 'format'
      });
      return;
    }

    const { value } = response;

    // Basic value validation
    if (value === null || value === undefined) {
      return; // Skip validation for empty values (will be caught by required check if needed)
    }

    // Scale validation (assuming scale questions use numeric values 1-5)
    if (questionId.match(/^\d+\.\d+$/) && typeof value === 'number') {
      if (value < 1 || value > 5) {
        errors.push({
          field: `${domainName}.${questionId}`,
          message: 'Scale value must be between 1 and 5',
          type: 'range'
        });
      }
    }

    // Timestamp validation
    if (response.timestamp && isNaN(Date.parse(response.timestamp))) {
      errors.push({
        field: `${domainName}.${questionId}`,
        message: 'Invalid timestamp format',
        type: 'format'
      });
    }
  });

  return { errors, warnings };
};

const validateCrossDomainConsistency = (
  domainResponses: Record<string, any>
): AssessmentValidationError[] => {
  const errors: AssessmentValidationError[] = [];

  // Strategic alignment affects all domains
  const strategicResponses = domainResponses['strategic-alignment']?.questions || {};
  const strategicScore = calculateDomainScore('strategic-alignment', strategicResponses);

  if (strategicScore <= 2) {
    errors.push({
      field: 'cross-domain',
      message: 'Poor strategic alignment (score ≤ 2) will negatively impact all other operational domains',
      type: 'consistency'
    });
  }

  // Revenue vs cash flow predictability consistency
  const revenueResponses = domainResponses['revenue-engine']?.questions || {};
  const financialResponses = domainResponses['financial-management']?.questions || {};

  const revenuePredictability = revenueResponses['3.1']?.value;
  const cashFlowPredictability = financialResponses['2.1']?.value;

  if (revenuePredictability && cashFlowPredictability) {
    const revScore = Number(revenuePredictability);
    const cashScore = Number(cashFlowPredictability);

    if (Math.abs(revScore - cashScore) > 2) {
      errors.push({
        field: 'cross-domain',
        message: 'Significant mismatch between revenue predictability and cash flow predictability indicates potential systemic issues',
        type: 'consistency'
      });
    }
  }

  return errors;
};

const calculateDomainScore = (domain: DomainName, responses: Record<string, any>): number => {
  const domainRules = VALIDATION_RULES.domainValidation[domain as keyof typeof VALIDATION_RULES.domainValidation];
  if (!domainRules || !domainRules.scoringWeights) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  Object.entries(domainRules.scoringWeights).forEach(([questionId, weight]) => {
    const response = responses[questionId];
    if (response && typeof response.value === 'number') {
      weightedSum += response.value * weight;
      totalWeight += weight;
    }
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
};

const calculateOverallCompleteness = (
  domainResponses: Record<string, any>,
  _industryClassification?: IndustryClassification
): number => {
  let totalRequired = 0;
  let completedRequired = 0;

  Object.entries(VALIDATION_RULES.domainValidation).forEach(([domain, rules]) => {
    totalRequired += rules.requiredQuestions.length;

    const responses = domainResponses[domain]?.questions || {};
    const answeredRequired = rules.requiredQuestions.filter(qId => {
      const response = responses[qId];
      return response && response.value !== null && response.value !== undefined && response.value !== '';
    }).length;

    completedRequired += answeredRequired;
  });

  return totalRequired > 0 ? Math.round((completedRequired / totalRequired) * 100) : 0;
};

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST'
  };

  try {
    // Extract assessment ID from path
    const assessmentId = event.pathParameters?.id;
    if (!assessmentId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Assessment ID is required'
        })
      };
    }

    // Parse request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Request body is required'
        })
      };
    }

    const requestData: ValidateAssessmentRequest = JSON.parse(event.body);

    // Validate authentication
    const authHeader = event.headers.Authorization || event.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Authentication token required'
        })
      };
    }

    // Verify assessment exists and user has access
    const getParams = {
      TableName: TABLE_NAME,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA'
      })
    };

    const getResult = await dynamoDb.send(new GetItemCommand(getParams));

    if (!getResult.Item) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Assessment not found'
        })
      };
    }

    const assessment = unmarshall(getResult.Item) as Assessment;

    // Basic authorization check
    const userCompanyId = 'temp-company-id'; // This would come from the decoded JWT
    if (assessment.companyId !== userCompanyId) {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Access denied - insufficient permissions'
        })
      };
    }

    // Perform validation
    const errors: AssessmentValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const requiredFieldsMissing: string[] = [];

    // Validate each domain
    Object.entries(requestData.domainResponses).forEach(([domainName, domainData]) => {
      const { errors: domainErrors, warnings: domainWarnings } = validateDomainResponses(
        domainName as DomainName,
        domainData.questions || {},
        requestData.industryClassification
      );

      errors.push(...domainErrors);
      warnings.push(...domainWarnings);

      // Collect missing required fields
      domainErrors.forEach(error => {
        if (error.type === 'required') {
          requiredFieldsMissing.push(error.field);
        }
      });
    });

    // Cross-domain validation
    const crossDomainErrors = validateCrossDomainConsistency(requestData.domainResponses);
    errors.push(...crossDomainErrors);

    // Calculate completeness
    const completeness = calculateOverallCompleteness(
      requestData.domainResponses,
      requestData.industryClassification
    );

    // Add completeness warnings
    if (completeness < VALIDATION_RULES.completenessThresholds.minimum) {
      warnings.push({
        field: 'overall',
        message: `Assessment completeness (${completeness}%) below minimum threshold (${VALIDATION_RULES.completenessThresholds.minimum}%)`,
        type: 'quality'
      });
    } else if (completeness < VALIDATION_RULES.completenessThresholds.recommended) {
      warnings.push({
        field: 'overall',
        message: `Assessment completeness (${completeness}%) below recommended threshold (${VALIDATION_RULES.completenessThresholds.recommended}%) for comprehensive analysis`,
        type: 'completeness'
      });
    }

    // Prepare validation result
    const validationResult: AssessmentValidation = {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness,
      requiredFieldsMissing,
      crossDomainInconsistencies: crossDomainErrors.map(error => error.message)
    };

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validationResult)
    };

  } catch (error) {
    console.error('Error validating assessment:', error);

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    };
  }
};