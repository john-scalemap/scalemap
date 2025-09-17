# Database Schema

ScaleMap uses DynamoDB as the primary database for operational data, optimized for the AWS free tier and high-performance access patterns. The schema is designed for eventual PostgreSQL migration when complex analytics become necessary.

## DynamoDB Table Design (Single Table Pattern)

ScaleMap implements a **single table design** optimized for DynamoDB's strengths while maintaining clear entity boundaries for future SQL migration.

### Primary Table: `scalemap-prod`

| Attribute | Type | Description |
|-----------|------|-------------|
| **PK** | String | Partition Key - Entity type and ID |
| **SK** | String | Sort Key - Sub-entity type and ID |
| **GSI1PK** | String | Global Secondary Index 1 Partition Key |
| **GSI1SK** | String | Global Secondary Index 1 Sort Key |
| **GSI2PK** | String | Global Secondary Index 2 Partition Key |
| **GSI2SK** | String | Global Secondary Index 2 Sort Key |
| **TTL** | Number | Time-to-live for temporary records |
| **EntityType** | String | Entity discriminator |
| **Data** | Map | Entity-specific data |
| **CreatedAt** | String | ISO timestamp |
| **UpdatedAt** | String | ISO timestamp |

## Entity Access Patterns

### Companies
```
PK: COMPANY#{companyId}
SK: METADATA
GSI1PK: USER#{cognitoUserId}
GSI1SK: COMPANY#{companyId}

Data: {
  name: "TechCorp Ltd",
  industry: {
    sector: "technology",
    subSector: "saas",
    regulatoryClassification: "lightly-regulated",
    specificRegulations: ["GDPR"]
  },
  businessModel: "b2b-saas",
  size: {
    employees: 45,
    contractors: 8,
    locations: 2
  },
  // ... other company data
}
```

### Assessments
```
PK: ASSESSMENT#{assessmentId}
SK: METADATA
GSI1PK: COMPANY#{companyId}
GSI1SK: ASSESSMENT#{createdAt}
GSI2PK: STATUS#{status}
GSI2SK: CREATED#{createdAt}

Data: {
  status: "analyzing",
  assessmentContext: {
    primaryBusinessChallenges: ["scaling-issues", "operational-inefficiency"],
    strategicObjectives: ["improve-margins", "accelerate-growth"],
    resourceConstraints: {
      budget: "moderate",
      team: "stretched",
      timeAvailability: "minimal"
    }
  },
  domainResponses: {
    "financial-management": { /* questionnaire responses */ },
    "technology-data": { /* questionnaire responses */ }
  },
  activatedAgents: ["financial-expert", "tech-expert", "ops-expert"],
  
  // ENHANCED: Flexible Timeline Management
  deliverySchedule: {
    originalSchedule: {
      executive24h: "2024-01-15T10:00:00Z",
      detailed48h: "2024-01-16T10:00:00Z", 
      implementation72h: "2024-01-17T10:00:00Z"
    },
    currentSchedule: {
      executive24h: "2024-01-15T10:00:00Z",
      detailed48h: "2024-01-16T14:00:00Z", // Adjusted due to clarification
      implementation72h: "2024-01-17T14:00:00Z"
    },
    timelinePaused: false,
    pausedAt: null,
    pauseReason: null,
    totalPausedDuration: 0, // milliseconds
    clarificationWindows: [
      {
        requestedAt: "2024-01-15T12:00:00Z",
        reason: "Client requested clarification on financial data",
        pausedTimeline: true,
        resolvedAt: "2024-01-15T16:00:00Z",
        timelineAdjustment: 4 * 60 * 60 * 1000 // 4 hours added
      }
    ]
  },
  
  // ENHANCED: Business Rule Enforcement  
  clarificationPolicy: {
    allowClarificationUntil: "detailed48h", // No changes after detailed report
    maxClarificationRequests: 3,
    maxTimelineExtension: 24 * 60 * 60 * 1000, // 24 hours max extension
    currentClarificationCount: 1
  }
}
```

### Agent Analysis Results
```
PK: ASSESSMENT#{assessmentId}
SK: ANALYSIS#{agentId}#{domain}
GSI1PK: AGENT#{agentId}
GSI1SK: COMPLETED#{completedAt}

Data: {
  domain: "financial-management",
  analysisStatus: "completed",
  findings: [
    {
      id: "finding-001",
      title: "Cash Flow Forecasting Gap",
      description: "No systematic cash flow forecasting beyond 30 days",
      severity: "high",
      evidence: ["CFO mentioned manual tracking", "No forecasting tools identified"],
      category: "financial-planning"
    }
  ],
  recommendations: [
    {
      id: "rec-001",
      title: "Implement 13-week Rolling Cash Flow Forecast",
      description: "Deploy automated cash flow forecasting system",
      priority: 8,
      implementationComplexity: "medium",
      estimatedImpact: "high",
      timeframe: "30-days"
    }
  ],
  confidence: 0.87,
  processingTimeMs: 45000,
  tokenUsage: {
    promptTokens: 2500,
    completionTokens: 1200,
    totalCost: 0.042
  }
}
```

### Documents
```
PK: DOCUMENT#{documentId}
SK: METADATA
GSI1PK: ASSESSMENT#{assessmentId}
GSI1SK: DOCUMENT#{uploadedAt}

Data: {
  assessmentId: "assessment-123",
  metadata: {
    originalFilename: "Q3-Financial-Report.pdf",
    fileSize: 2547200,
    mimeType: "application/pdf"
  },
  processing: {
    status: "indexed",
    extractedText: "...",
    processingCompletedAt: "2024-01-15T08:30:00Z"
  },
  categorization: {
    category: "financial",
    subcategory: "quarterly-report",
    relevantDomains: ["financial-management", "operational-excellence"],
    confidentialityLevel: "confidential"
  },
  storage: {
    s3Bucket: "scalemap-documents-prod",
    s3Key: "assessments/assessment-123/documents/doc-456.pdf"
  }
}
```

### Triage Results
```
PK: ASSESSMENT#{assessmentId}
SK: TRIAGE
GSI2PK: TRIAGE#{triageVersion}
GSI2SK: COMPLETED#{completedAt}

Data: {
  triageVersion: "v2.1",
  confidence: 0.92,
  reasoning: "Financial metrics show cash flow stress, technology stack assessment reveals scalability bottlenecks, operational processes lack standardization",
  identifiedDomains: [
    {
      domain: "financial-management",
      severityScore: 85,
      evidencePoints: ["Negative cash flow trend", "Manual financial processes"],
      recommendedAgent: "financial-expert"
    },
    {
      domain: "technology-data",
      severityScore: 78,
      evidencePoints: ["Legacy monolith architecture", "No monitoring systems"],
      recommendedAgent: "tech-expert"
    }
  ],
  skipDomains: [
    {
      domain: "supply-chain",
      reason: "SaaS business model - not applicable"
    }
  ],
  processingTimeMs: 12000,
  tokenUsage: {
    promptTokens: 3500,
    completionTokens: 800,
    totalCost: 0.028
  }
}
```

### Perfect Prioritization Results
```
PK: ASSESSMENT#{assessmentId}
SK: PRIORITIZATION
GSI2PK: ALGORITHM#{algorithmVersion}
GSI2SK: COMPLETED#{completedAt}

Data: {
  inputAnalyses: ["analysis-001", "analysis-002", "analysis-003"],
  prioritizedRecommendations: [
    {
      recommendationId: "rec-001",
      sourceAgent: "financial-expert",
      sourceDomain: "financial-management",
      title: "Implement 13-week Rolling Cash Flow Forecast",
      priorityScore: 94,
      growthImpactWeight: 0.35,
      implementationFeasibility: 0.75,
      crossDomainMultiplier: 1.2,
      estimatedROI: "15-25% improvement in cash predictability",
      timeToValue: "30 days"
    }
  ],
  crossDomainDependencies: [
    {
      primary: "rec-001",
      enablers: ["rec-004"],
      amplifiers: ["rec-007"]
    }
  ],
  implementationRoadmap: [
    {
      phase: 1,
      timeframe: "0-30 days",
      recommendations: ["rec-001", "rec-002"],
      resources: ["CFO", "Finance team"],
      milestones: ["Cash flow system deployed", "First 13-week forecast generated"]
    }
  ],
  algorithmVersion: "v1.3",
  confidence: 0.89
}
```

### Clarification Requests
```
PK: ASSESSMENT#{assessmentId}
SK: CLARIFICATION#{requestId}
GSI2PK: CLARIFICATION#{status}
GSI2SK: REQUESTED#{requestedAt}

Data: {
  requestId: "clarification-001",
  status: "resolved", // pending, reviewing, resolved, rejected
  priority: "high", // low, medium, high, critical
  
  request: {
    requestedAt: "2024-01-15T12:00:00Z",
    requestedBy: "client", // client, founder, agent
    reason: "Need clarification on financial data accuracy",
    specificQuestions: [
      "Are the revenue figures from last quarter or this quarter?",
      "Should we include contractor costs in the team size calculation?"
    ],
    affectedDomains: ["financial-management", "people-organization"],
    suggestedAgents: ["financial-expert"]
  },
  
  timelineImpact: {
    pausedTimeline: true,
    pausedAt: "2024-01-15T12:00:00Z",
    estimatedResolutionTime: 4 * 60 * 60 * 1000, // 4 hours
    maxAllowableDelay: 12 * 60 * 60 * 1000, // 12 hours before auto-reject
    actualResolutionTime: 4 * 60 * 60 * 1000
  },
  
  resolution: {
    resolvedAt: "2024-01-15T16:00:00Z",
    resolvedBy: "founder", // founder, agent, auto-system
    response: "Revenue figures are Q3 actuals, contractor costs should be included in team size",
    additionalData: {
      "revenue_clarification": "Q3 actuals: £247K",
      "team_size_updated": 53 // 45 employees + 8 contractors
    },
    requiresReanalysis: ["financial-expert"], // Which agents need to re-run
    timelineAdjustment: 4 * 60 * 60 * 1000 // Time added to delivery schedule
  },
  
  businessRuleCheck: {
    withinClarificationWindow: true,
    clarificationCountCheck: true, // Under max requests
    timelineExtensionCheck: true, // Under max extension
    approvalRequired: false // Auto-approved based on rules
  }
}
```

### Agent Personas (Configuration Data)
```
PK: AGENT#{agentId}
SK: METADATA
GSI1PK: DOMAIN#{primaryDomain}
GSI1SK: AGENT#{agentId}

Data: {
  name: "Sarah Mitchell",
  title: "Senior Financial Operations Expert",
  expertise: {
    primaryDomains: ["financial-management"],
    industrySpecializations: ["saas", "fintech", "technology"],
    regulatoryExpertise: ["GDPR", "SOX"],
    yearsExperience: 12
  },
  personality: {
    communicationStyle: "analytical",
    approach: "data-driven",
    backstory: "Former CFO at three scale-up companies, specializing in cash flow optimization and financial process automation"
  },
  systemPrompt: {
    coreInstructions: "...",
    outputFormat: { /* JSON schema */ },
    qualityGuidelines: ["Always cite specific evidence", "Quantify impact where possible"],
    guardrails: {
      forbidden: ["Legal advice", "Investment recommendations"],
      required: ["Financial disclaimers", "Evidence citations"]
    }
  },
  performance: {
    assessmentsCompleted: 47,
    avgConfidenceScore: 0.86,
    avgProcessingTimeMs: 42000
  }
}
```

## Global Secondary Indexes (GSI)

### GSI1: User and Company Lookups
- **GSI1PK:** User ID, Company ID, Agent ID patterns
- **GSI1SK:** Related entity patterns
- **Use Cases:** Find company by user, find assessments by company, track agent performance

### GSI2: Status and Time-based Queries
- **GSI2PK:** Status, algorithm version, operational patterns
- **GSI2SK:** Timestamp-based sorting
- **Use Cases:** Active assessments, completed analyses, algorithm performance tracking

## Query Patterns Examples

```typescript
// Get company by Cognito user ID
{
  IndexName: 'GSI1',
  KeyConditionExpression: 'GSI1PK = :userId',
  ExpressionAttributeValues: {
    ':userId': 'USER#cognito-user-123'
  }
}

// Get all assessments for a company (sorted by creation date)
{
  IndexName: 'GSI1', 
  KeyConditionExpression: 'GSI1PK = :companyId',
  ScanIndexForward: false, // Latest first
  ExpressionAttributeValues: {
    ':companyId': 'COMPANY#company-456'
  }
}

// Get all active assessments across the system
{
  IndexName: 'GSI2',
  KeyConditionExpression: 'GSI2PK = :status',
  ExpressionAttributeValues: {
    ':status': 'STATUS#analyzing'
  }
}

// Get agent analysis for specific assessment
{
  KeyConditionExpression: 'PK = :assessmentId AND begins_with(SK, :analysisPrefix)',
  ExpressionAttributeValues: {
    ':assessmentId': 'ASSESSMENT#assessment-789',
    ':analysisPrefix': 'ANALYSIS#'
  }
}

// Get clarification requests for assessment
{
  KeyConditionExpression: 'PK = :assessmentId AND begins_with(SK, :clarificationPrefix)',
  ExpressionAttributeValues: {
    ':assessmentId': 'ASSESSMENT#assessment-123',
    ':clarificationPrefix': 'CLARIFICATION#'
  }
}

// Get all pending clarifications across system (for founder review)
{
  IndexName: 'GSI2',
  KeyConditionExpression: 'GSI2PK = :status',
  ExpressionAttributeValues: {
    ':status': 'CLARIFICATION#pending'
  }
}

// Check if timeline can be paused (business rule validation)
{
  KeyConditionExpression: 'PK = :assessmentId AND SK = :metadata',
  ProjectionExpression: 'clarificationPolicy, deliverySchedule.currentSchedule.detailed48h',
  ExpressionAttributeValues: {
    ':assessmentId': 'ASSESSMENT#assessment-123',
    ':metadata': 'METADATA'
  }
}
```

## PostgreSQL Migration Schema (Future)

When migrating to PostgreSQL for complex analytics, the DynamoDB structure maps cleanly to normalized tables:

```sql
-- Companies table
CREATE TABLE companies (
    company_id UUID PRIMARY KEY,
    cognito_user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    industry JSONB NOT NULL,
    business_model VARCHAR(50) NOT NULL,
    size JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Assessments table  
CREATE TABLE assessments (
    assessment_id UUID PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES companies(company_id),
    status VARCHAR(50) NOT NULL,
    assessment_context JSONB,
    domain_responses JSONB,
    activated_agents TEXT[],
    delivery_schedule JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Agent analyses table
CREATE TABLE agent_analyses (
    analysis_id UUID PRIMARY KEY,
    assessment_id UUID NOT NULL REFERENCES assessments(assessment_id),
    agent_id VARCHAR(100) NOT NULL,
    domain VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    findings JSONB,
    recommendations JSONB,
    confidence DECIMAL(3,2),
    processing_time_ms INTEGER,
    token_usage JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_companies_user_id ON companies(cognito_user_id);
CREATE INDEX idx_assessments_company_id ON assessments(company_id);
CREATE INDEX idx_assessments_status_created ON assessments(status, created_at);
CREATE INDEX idx_analyses_assessment_id ON agent_analyses(assessment_id);
CREATE INDEX idx_analyses_agent_performance ON agent_analyses(agent_id, completed_at);
```

## Data Lifecycle Management

### TTL (Time-To-Live) Strategy
```typescript
const ttlSettings = {
  // Temporary data with automatic cleanup
  agentState: 72 * 60 * 60, // 72 hours (assessment duration)
  sessionCache: 24 * 60 * 60, // 24 hours
  triageCache: 7 * 24 * 60 * 60, // 7 days
  
  // Long-term retention
  assessments: null, // No TTL - permanent business records
  analyses: null, // No TTL - permanent for algorithm improvement
  documents: 365 * 24 * 60 * 60 // 1 year retention
};
```

### GDPR Compliance
```typescript
// Data deletion workflow for GDPR compliance
const deleteUserData = async (cognitoUserId: string) => {
  // 1. Find all related entities
  // 2. Anonymize analysis data (keep for ML, remove PII)
  // 3. Delete personal information
  // 4. Update deletion audit log
};
```

### Timeline Management & Business Rules
```typescript
interface TimelineManager {
  // Check if clarification request is allowed
  canRequestClarification(assessmentId: string): Promise<{
    allowed: boolean;
    reason?: string;
    remainingRequests?: number;
    remainingExtensionTime?: number;
  }>;
  
  // Pause timeline for clarification
  pauseTimeline(
    assessmentId: string, 
    clarificationRequest: ClarificationRequest
  ): Promise<TimelinePauseResult>;
  
  // Resume timeline after clarification resolved
  resumeTimeline(
    assessmentId: string, 
    clarificationId: string,
    adjustment: number
  ): Promise<TimelineResumeResult>;
  
  // Business rule enforcement
  validateTimelineChange(
    assessment: Assessment, 
    requestedChange: TimelineChange
  ): ValidationResult;
}

// Business Rules Implementation
const timelineBusinessRules = {
  // No clarifications after detailed report delivered
  clarificationCutoff: "detailed48h",
  
  // Maximum 3 clarification requests per assessment
  maxClarificationRequests: 3,
  
  // Maximum 24 hours total extension
  maxTimelineExtension: 24 * 60 * 60 * 1000,
  
  // Auto-reject clarifications after 12 hours without response
  clarificationTimeout: 12 * 60 * 60 * 1000,
  
  // Different rules by client tier
  clientTierRules: {
    standard: {
      maxRequests: 3,
      maxExtension: 24 * 60 * 60 * 1000
    },
    premium: {
      maxRequests: 5,
      maxExtension: 48 * 60 * 60 * 1000
    }
  }
};

// Timeline Pause/Resume Workflow
const handleClarificationRequest = async (
  assessmentId: string,
  clarificationRequest: ClarificationRequest
) => {
  // 1. Validate business rules
  const validation = await timelineManager.canRequestClarification(assessmentId);
  if (!validation.allowed) {
    throw new Error(`Clarification not allowed: ${validation.reason}`);
  }
  
  // 2. Pause timeline
  const pauseResult = await timelineManager.pauseTimeline(assessmentId, clarificationRequest);
  
  // 3. Notify stakeholders
  await notificationService.notifyClarificationRequested(assessmentId, clarificationRequest);
  
  // 4. Set auto-timeout
  await scheduleService.scheduleTimeout(
    clarificationRequest.requestId,
    timelineBusinessRules.clarificationTimeout
  );
  
  return pauseResult;
};

// Auto-timeout handling
const handleClarificationTimeout = async (clarificationId: string) => {
  const clarification = await getClarificationRequest(clarificationId);
  
  if (clarification.status === 'pending') {
    // Auto-reject and resume timeline
    await updateClarificationStatus(clarificationId, 'auto-rejected');
    await timelineManager.resumeTimeline(
      clarification.assessmentId, 
      clarificationId,
      0 // No timeline adjustment for auto-rejection
    );
    
    // Notify client of auto-rejection
    await notificationService.notifyClarificationTimeout(clarification);
  }
};
```

This database schema provides the foundation for ScaleMap's operational efficiency while maintaining flexibility for future growth and regulatory compliance requirements.
