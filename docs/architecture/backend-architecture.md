# Backend Architecture

ScaleMap's backend is built on **AWS Lambda** with event-driven orchestration, optimized for the free tier while providing enterprise-grade scalability. The architecture handles complex multi-agent workflows through serverless functions with intelligent cost management.

## Lambda Function Architecture

ScaleMap implements a **function-per-service** pattern with shared utilities, enabling independent scaling and deployment while maintaining code reusability.

### Function Organization
```
apps/api/src/
├── functions/                    # Lambda function handlers
│   ├── auth/
│   │   ├── login.ts              # Cognito authentication
│   │   ├── refresh-token.ts      # JWT token refresh
│   │   └── validate-token.ts     # Token validation middleware
│   ├── company/
│   │   ├── create-company.ts     # Company profile creation
│   │   ├── get-company.ts        # Company profile retrieval
│   │   └── update-company.ts     # Company profile updates
│   ├── assessment/
│   │   ├── create-assessment.ts  # Assessment creation and payment
│   │   ├── get-assessment.ts     # Assessment data retrieval
│   │   ├── update-responses.ts   # Questionnaire response handling
│   │   └── request-clarification.ts # Clarification request processing
│   ├── documents/
│   │   ├── upload-handler.ts     # Document upload processing
│   │   ├── process-document.ts   # OCR and content extraction
│   │   └── categorize-document.ts # Document categorization
│   ├── triage/
│   │   ├── analyze-domains.ts    # Intelligent domain analysis
│   │   ├── select-agents.ts      # Agent activation logic
│   │   └── validate-triage.ts    # Triage result validation
│   ├── orchestration/
│   │   ├── start-analysis.ts     # Begin agent coordination
│   │   ├── agent-dispatcher.ts   # SQS message handling
│   │   ├── progress-tracker.ts   # Progress aggregation
│   │   └── timeline-manager.ts   # Timeline pause/resume logic
│   ├── agents/                   # 12 specialist agents
│   │   ├── financial-agent.ts    # Financial management analysis
│   │   ├── technology-agent.ts   # Technology & data analysis
│   │   ├── operations-agent.ts   # Operational excellence analysis
│   │   ├── strategic-agent.ts    # Strategic alignment analysis
│   │   ├── people-agent.ts       # People & organization analysis
│   │   ├── revenue-agent.ts      # Revenue engine analysis
│   │   ├── customer-agent.ts     # Customer experience analysis
│   │   ├── supply-chain-agent.ts # Supply chain analysis
│   │   ├── risk-agent.ts         # Risk & compliance analysis
│   │   ├── partnerships-agent.ts # Partnerships analysis
│   │   ├── success-agent.ts      # Customer success analysis
│   │   └── change-agent.ts       # Change management analysis
│   ├── prioritization/
│   │   ├── synthesize-findings.ts # Cross-domain analysis
│   │   ├── calculate-priorities.ts # Priority scoring algorithm
│   │   └── generate-roadmap.ts   # Implementation roadmap
│   ├── validation/
│   │   ├── request-validation.ts # Client validation requests
│   │   ├── process-feedback.ts   # Validation feedback processing
│   │   └── adjust-priorities.ts  # Priority adjustments
│   ├── delivery/
│   │   ├── generate-executive-summary.ts # 24h deliverable
│   │   ├── generate-detailed-report.ts   # 48h deliverable
│   │   ├── generate-implementation-kit.ts # 72h deliverable
│   │   └── schedule-deliveries.ts        # Timeline management
│   ├── payment/
│   │   ├── create-payment-intent.ts # Stripe payment creation
│   │   ├── confirm-payment.ts       # Payment confirmation
│   │   └── handle-webhook.ts        # Stripe webhook processing
│   ├── notifications/
│   │   ├── send-email.ts            # SES email delivery
│   │   ├── websocket-handler.ts     # Real-time updates
│   │   └── notification-router.ts   # Notification orchestration
│   └── analytics/
│       ├── track-events.ts          # Business analytics
│       ├── agent-performance.ts     # Agent metrics
│       └── cost-tracking.ts         # OpenAI cost monitoring
├── shared/                          # Shared utilities
│   ├── middleware/
│   │   ├── auth-middleware.ts       # Authentication validation
│   │   ├── error-handler.ts         # Centralized error handling
│   │   ├── cors-middleware.ts       # CORS configuration
│   │   └── logging-middleware.ts    # Request/response logging
│   ├── services/
│   │   ├── dynamodb-service.ts      # DynamoDB operations
│   │   ├── s3-service.ts            # File storage operations
│   │   ├── sqs-service.ts           # Message queue operations
│   │   ├── openai-service.ts        # OpenAI API client
│   │   ├── stripe-service.ts        # Payment processing
│   │   └── ses-service.ts           # Email service
│   ├── models/
│   │   ├── assessment.ts            # Assessment data models
│   │   ├── agent.ts                 # Agent models and types
│   │   ├── company.ts               # Company data models
│   │   └── validation.ts            # Validation schemas
│   ├── utils/
│   │   ├── validation.ts            # Input validation utilities
│   │   ├── encryption.ts            # Data encryption/decryption
│   │   ├── date-utils.ts            # Date/time utilities
│   │   └── error-types.ts           # Custom error definitions
│   └── constants/
│       ├── agent-prompts.ts         # Agent system prompts
│       ├── business-rules.ts        # Business rule constants
│       └── api-responses.ts         # Standard response formats
├── infrastructure/                  # AWS CDK infrastructure
│   ├── stacks/
│   │   ├── api-stack.ts             # API Gateway and Lambda
│   │   ├── database-stack.ts        # DynamoDB tables and indexes
│   │   ├── storage-stack.ts         # S3 buckets and policies
│   │   ├── messaging-stack.ts       # SQS queues and EventBridge
│   │   └── monitoring-stack.ts      # CloudWatch and X-Ray
│   ├── constructs/
│   │   ├── lambda-function.ts       # Lambda function construct
│   │   ├── api-endpoint.ts          # API Gateway endpoint
│   │   └── secure-bucket.ts         # S3 bucket with encryption
│   └── config/
│       ├── environments.ts          # Environment configurations
│       └── policies.ts              # IAM policies and roles
└── types/                           # TypeScript definitions
    ├── api/                         # API request/response types
    ├── events/                      # Event payload types
    ├── services/                    # Service interface types
    └── aws/                         # AWS service types
```

## Lambda Function Templates

### Standard Lambda Function Template
```typescript
// Example: Assessment creation function
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authMiddleware } from '../../shared/middleware/auth-middleware';
import { errorHandler } from '../../shared/middleware/error-handler';
import { validateRequest } from '../../shared/utils/validation';
import { dynamoDbService } from '../../shared/services/dynamodb-service';
import { stripeService } from '../../shared/services/stripe-service';
import { CreateAssessmentRequest, Assessment } from '../../shared/models/assessment';
import { BusinessError, ValidationError } from '../../shared/utils/error-types';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    // 1. Authentication
    const user = await authMiddleware(event);
    
    // 2. Input validation
    const requestBody = JSON.parse(event.body || '{}');
    const validatedRequest = validateRequest<CreateAssessmentRequest>(
      requestBody, 
      'createAssessmentSchema'
    );

    // 3. Business logic validation
    const company = await dynamoDbService.getCompany(user.companyId);
    if (!company) {
      throw new BusinessError('Company not found', 404);
    }

    // Check for active assessments
    const activeAssessments = await dynamoDbService.getActiveAssessments(user.companyId);
    if (activeAssessments.length > 0) {
      throw new BusinessError('Active assessment already exists', 409);
    }

    // 4. Create assessment record
    const assessmentId = generateAssessmentId();
    const assessment: Assessment = {
      assessmentId,
      companyId: user.companyId,
      status: 'payment-pending',
      domainResponses: validatedRequest.domainResponses,
      assessmentContext: validatedRequest.assessmentContext,
      activatedAgents: [], // Will be populated after triage
      deliverySchedule: calculateDeliverySchedule(new Date()),
      clarificationPolicy: getDefaultClarificationPolicy(company.tier),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 5. Create payment intent
    const paymentIntent = await stripeService.createPaymentIntent({
      amount: getAssessmentPrice(company.tier), // £5-8K based on tier
      currency: 'gbp',
      customerId: company.stripeCustomerId,
      metadata: {
        assessmentId,
        companyId: user.companyId,
      },
    });

    // 6. Store assessment
    await dynamoDbService.createAssessment(assessment);

    // 7. Analytics tracking
    await trackEvent('assessment_created', {
      assessmentId,
      companyId: user.companyId,
      domainCount: Object.keys(validatedRequest.domainResponses).length,
    });

    // 8. Response
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        assessment,
        paymentIntent: {
          clientSecret: paymentIntent.client_secret,
          amount: paymentIntent.amount,
        },
      }),
    };

  } catch (error) {
    return errorHandler(error);
  }
};

// Helper functions
function generateAssessmentId(): string {
  return `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateDeliverySchedule(startTime: Date): DeliverySchedule {
  return {
    originalSchedule: {
      executive24h: new Date(startTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      detailed48h: new Date(startTime.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      implementation72h: new Date(startTime.getTime() + 72 * 60 * 60 * 1000).toISOString(),
    },
    currentSchedule: {
      executive24h: new Date(startTime.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      detailed48h: new Date(startTime.getTime() + 48 * 60 * 60 * 1000).toISOString(),
      implementation72h: new Date(startTime.getTime() + 72 * 60 * 60 * 1000).toISOString(),
    },
    timelinePaused: false,
    pausedAt: null,
    pauseReason: null,
    totalPausedDuration: 0,
    clarificationWindows: [],
  };
}
```

### Agent Function Template
```typescript
// Example: Financial management agent
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { openaiService } from '../../shared/services/openai-service';
import { dynamoDbService } from '../../shared/services/dynamodb-service';
import { sqsService } from '../../shared/services/sqs-service';
import { AgentAnalysisRequest, AgentAnalysisResult } from '../../shared/models/agent';
import { FINANCIAL_AGENT_PROMPT } from '../../shared/constants/agent-prompts';

export const handler = async (event: SQSEvent): Promise<void> => {
  // Process each SQS message (agent task)
  for (const record of event.Records) {
    try {
      await processAgentTask(record);
    } catch (error) {
      console.error('Agent task failed:', error);
      await handleAgentError(record, error);
    }
  }
};

async function processAgentTask(record: SQSRecord): Promise<void> {
  const request: AgentAnalysisRequest = JSON.parse(record.body);
  const startTime = Date.now();

  // 1. Retrieve assessment data
  const assessment = await dynamoDbService.getAssessment(request.assessmentId);
  if (!assessment) {
    throw new Error(`Assessment not found: ${request.assessmentId}`);
  }

  // 2. Get company context
  const company = await dynamoDbService.getCompany(assessment.companyId);
  
  // 3. Retrieve relevant documents
  const documents = await dynamoDbService.getAssessmentDocuments(
    request.assessmentId, 
    ['financial', 'compliance'] // Categories relevant to financial agent
  );

  // 4. Build agent context
  const agentContext = {
    company: {
      name: company.name,
      industry: company.industry,
      size: company.size,
      businessModel: company.businessModel,
    },
    domainResponses: assessment.domainResponses['financial-management'] || {},
    supportingDocuments: documents.map(doc => ({
      filename: doc.metadata.originalFilename,
      content: doc.processing.extractedText,
      category: doc.categorization.category,
    })),
    assessmentContext: assessment.assessmentContext,
  };

  // 5. Generate industry-specific prompt
  const systemPrompt = buildFinancialAgentPrompt(company.industry.sector, company.size);
  
  // 6. Call OpenAI for analysis
  const analysisStart = Date.now();
  const openAIResponse = await openaiService.analyzeWithAgent({
    systemPrompt,
    context: agentContext,
    agentId: 'financial-expert',
    domain: 'financial-management',
  });

  // 7. Validate and structure response
  const analysisResult: AgentAnalysisResult = {
    analysisId: generateAnalysisId(),
    assessmentId: request.assessmentId,
    agentId: 'financial-expert',
    domain: 'financial-management',
    analysisStatus: 'completed',
    findings: validateFindings(openAIResponse.findings),
    recommendations: validateRecommendations(openAIResponse.recommendations),
    confidence: openAIResponse.confidence,
    processingTimeMs: Date.now() - startTime,
    tokenUsage: openAIResponse.tokenUsage,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  // 8. Store results
  await dynamoDbService.storeAgentAnalysis(analysisResult);

  // 9. Notify orchestrator
  await sqsService.sendMessage('agent-completion-queue', {
    type: 'agent_completed',
    assessmentId: request.assessmentId,
    agentId: 'financial-expert',
    analysisId: analysisResult.analysisId,
    processingTime: Date.now() - startTime,
  });

  // 10. Send WebSocket update
  await sendWebSocketUpdate(request.assessmentId, {
    type: 'agent_progress',
    agentId: 'financial-expert',
    progress: 100,
    status: 'completed',
    message: 'Financial analysis complete',
  });

  // 11. Analytics tracking
  await trackAgentPerformance('financial-expert', {
    processingTimeMs: Date.now() - startTime,
    confidence: analysisResult.confidence,
    tokenUsage: openAIResponse.tokenUsage,
    findingsCount: analysisResult.findings.length,
    recommendationsCount: analysisResult.recommendations.length,
  });
}

function buildFinancialAgentPrompt(industry: string, companySize: any): string {
  return `${FINANCIAL_AGENT_PROMPT.base}

INDUSTRY SPECIALIZATION: ${industry}
- ${FINANCIAL_AGENT_PROMPT.industrySpecific[industry] || FINANCIAL_AGENT_PROMPT.industrySpecific.default}

COMPANY SIZE CONTEXT:
- Employees: ${companySize.employees}
- Likely financial complexity: ${getFinancialComplexity(companySize)}
- Recommended focus areas: ${getFinancialFocusAreas(industry, companySize)}

${FINANCIAL_AGENT_PROMPT.outputFormat}`;
}
```

## Event-Driven Orchestration

ScaleMap uses **SQS and EventBridge** for reliable agent coordination and timeline management.

### Orchestration Patterns
```typescript
// Agent Orchestration Service
export class AgentOrchestrator {
  async startAnalysisPipeline(assessmentId: string): Promise<void> {
    try {
      // 1. Get triage results
      const triageResults = await dynamoDbService.getTriageResults(assessmentId);
      
      // 2. Update assessment status
      await dynamoDbService.updateAssessmentStatus(assessmentId, 'analyzing');
      
      // 3. Dispatch agent tasks to SQS
      const agentTasks = triageResults.identifiedDomains.map(domain => ({
        assessmentId,
        agentId: domain.recommendedAgent,
        domain: domain.domain,
        priority: domain.severityScore,
        timeout: 30 * 60 * 1000, // 30 minutes max per agent
      }));

      // Send tasks to appropriate agent queues
      await Promise.all(
        agentTasks.map(task => 
          sqsService.sendMessage(`agent-${task.agentId}-queue`, task)
        )
      );

      // 4. Set up progress tracking
      await this.initializeProgressTracking(assessmentId, agentTasks);

      // 5. Schedule timeline checkpoints
      await this.scheduleTimelineCheckpoints(assessmentId);

      // 6. Notify client of agent activation
      await this.notifyAgentActivation(assessmentId, agentTasks);

    } catch (error) {
      await this.handleOrchestrationError(assessmentId, error);
    }
  }

  async handleAgentCompletion(message: AgentCompletionMessage): Promise<void> {
    // 1. Update progress tracking
    await this.updateAgentProgress(message.assessmentId, message.agentId, 'completed');

    // 2. Check if all agents complete
    const allComplete = await this.checkAllAgentsComplete(message.assessmentId);

    if (allComplete) {
      // 3. Trigger prioritization
      await sqsService.sendMessage('prioritization-queue', {
        type: 'synthesize_findings',
        assessmentId: message.assessmentId,
      });

      // 4. Update assessment status
      await dynamoDbService.updateAssessmentStatus(message.assessmentId, 'synthesizing');
    }
  }

  async pauseTimeline(assessmentId: string, reason: string): Promise<void> {
    // 1. Pause all active agents
    await this.pauseActiveAgents(assessmentId);

    // 2. Update timeline
    await dynamoDbService.pauseAssessmentTimeline(assessmentId, reason);

    // 3. Cancel scheduled events
    await this.cancelScheduledEvents(assessmentId);

    // 4. Notify stakeholders
    await this.notifyTimelinePaused(assessmentId, reason);
  }

  async resumeTimeline(assessmentId: string, adjustment: number): Promise<void> {
    // 1. Resume active agents
    await this.resumeActiveAgents(assessmentId);

    // 2. Update timeline with adjustment
    await dynamoDbService.resumeAssessmentTimeline(assessmentId, adjustment);

    // 3. Reschedule events
    await this.rescheduleEvents(assessmentId, adjustment);

    // 4. Notify stakeholders
    await this.notifyTimelineResumed(assessmentId);
  }
}
```

## Service Layer Architecture

ScaleMap implements **shared services** for consistent data access and external API integration.

### DynamoDB Service
```typescript
export class DynamoDBService {
  private client: DynamoDBClient;
  private tableName: string;

  constructor() {
    this.client = new DynamoDBClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.tableName = process.env.DYNAMODB_TABLE_NAME || 'scalemap-prod';
  }

  // Assessment operations
  async createAssessment(assessment: Assessment): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        PK: `ASSESSMENT#${assessment.assessmentId}`,
        SK: 'METADATA',
        GSI1PK: `COMPANY#${assessment.companyId}`,
        GSI1SK: `ASSESSMENT#${assessment.createdAt}`,
        GSI2PK: `STATUS#${assessment.status}`,
        GSI2SK: `CREATED#${assessment.createdAt}`,
        EntityType: 'Assessment',
        Data: assessment,
        CreatedAt: assessment.createdAt,
        UpdatedAt: assessment.updatedAt,
      }),
      ConditionExpression: 'attribute_not_exists(PK)',
    });

    try {
      await this.client.send(command);
    } catch (error) {
      if (error.name === 'ConditionalCheckFailedException') {
        throw new BusinessError('Assessment already exists', 409);
      }
      throw error;
    }
  }

  async getAssessment(assessmentId: string): Promise<Assessment | null> {
    const command = new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA',
      }),
    });

    const result = await this.client.send(command);
    if (!result.Item) return null;

    const item = unmarshall(result.Item);
    return item.Data as Assessment;
  }

  async updateAssessmentStatus(assessmentId: string, status: AssessmentStatus): Promise<void> {
    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA',
      }),
      UpdateExpression: 'SET #data.#status = :status, #data.updatedAt = :updatedAt, GSI2PK = :gsi2pk',
      ExpressionAttributeNames: {
        '#data': 'Data',
        '#status': 'status',
      },
      ExpressionAttributeValues: marshall({
        ':status': status,
        ':updatedAt': new Date().toISOString(),
        ':gsi2pk': `STATUS#${status}`,
      }),
    });

    await this.client.send(command);
  }

  // Agent analysis operations
  async storeAgentAnalysis(analysis: AgentAnalysisResult): Promise<void> {
    const command = new PutItemCommand({
      TableName: this.tableName,
      Item: marshall({
        PK: `ASSESSMENT#${analysis.assessmentId}`,
        SK: `ANALYSIS#${analysis.agentId}#${analysis.domain}`,
        GSI1PK: `AGENT#${analysis.agentId}`,
        GSI1SK: `COMPLETED#${analysis.completedAt}`,
        EntityType: 'AgentAnalysis',
        Data: analysis,
        CreatedAt: analysis.createdAt,
        UpdatedAt: analysis.completedAt,
      }),
    });

    await this.client.send(command);
  }

  async getAgentAnalyses(assessmentId: string): Promise<AgentAnalysisResult[]> {
    const command = new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: marshall({
        ':pk': `ASSESSMENT#${assessmentId}`,
        ':skPrefix': 'ANALYSIS#',
      }),
    });

    const result = await this.client.send(command);
    return (result.Items || []).map(item => unmarshall(item).Data as AgentAnalysisResult);
  }

  // Timeline management
  async pauseAssessmentTimeline(assessmentId: string, reason: string): Promise<void> {
    const now = new Date().toISOString();
    
    const command = new UpdateItemCommand({
      TableName: this.tableName,
      Key: marshall({
        PK: `ASSESSMENT#${assessmentId}`,
        SK: 'METADATA',
      }),
      UpdateExpression: `
        SET #data.deliverySchedule.timelinePaused = :paused,
            #data.deliverySchedule.pausedAt = :pausedAt,
            #data.deliverySchedule.pauseReason = :reason,
            #data.updatedAt = :updatedAt
      `,
      ExpressionAttributeNames: {
        '#data': 'Data',
      },
      ExpressionAttributeValues: marshall({
        ':paused': true,
        ':pausedAt': now,
        ':reason': reason,
        ':updatedAt': now,
      }),
    });

    await this.client.send(command);
  }
}

export const dynamoDbService = new DynamoDBService();
```

## Error Handling and Monitoring

ScaleMap implements **comprehensive error handling** with CloudWatch integration and business-specific error types.

```typescript
// Centralized error handler
export function errorHandler(error: any): APIGatewayProxyResult {
  console.error('Lambda function error:', error);

  // Track error metrics
  trackErrorMetric(error);

  if (error instanceof ValidationError) {
    return {
      statusCode: 400,
      headers: defaultHeaders,
      body: JSON.stringify({
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          details: error.details,
          timestamp: new Date().toISOString(),
          requestId: getRequestId(),
        },
      }),
    };
  }

  if (error instanceof BusinessError) {
    return {
      statusCode: error.statusCode,
      headers: defaultHeaders,
      body: JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          timestamp: new Date().toISOString(),
          requestId: getRequestId(),
        },
      }),
    };
  }

  if (error instanceof OpenAIError) {
    // Handle OpenAI-specific errors
    return {
      statusCode: 503,
      headers: defaultHeaders,
      body: JSON.stringify({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'AI analysis service temporarily unavailable',
          timestamp: new Date().toISOString(),
          requestId: getRequestId(),
        },
      }),
    };
  }

  // Generic server error
  return {
    statusCode: 500,
    headers: defaultHeaders,
    body: JSON.stringify({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        requestId: getRequestId(),
      },
    }),
  };
}

// Business-specific error types
export class BusinessError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string = 'BUSINESS_ERROR'
  ) {
    super(message);
    this.name = 'BusinessError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public details: Record<string, string>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class OpenAIError extends Error {
  constructor(
    message: string,
    public originalError: any
  ) {
    super(message);
    this.name = 'OpenAIError';
  }
}
```

This backend architecture provides **enterprise-grade reliability and performance** while maximizing AWS free tier usage and maintaining clear paths for scaling as ScaleMap grows.
