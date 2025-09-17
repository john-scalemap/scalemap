# External APIs

ScaleMap integrates with several external services to provide AI-powered analysis, payment processing, and communication capabilities. Each integration is designed with proper error handling, rate limiting, and cost optimization.

## OpenAI API Integration

- **Purpose:** Core AI capabilities for domain triage and specialist agent analysis
- **Documentation:** https://platform.openai.com/docs/api-reference
- **Base URL(s):** https://api.openai.com/v1
- **Authentication:** Bearer token (API key)
- **API Version:** Latest (2024-12-17) - **CRITICAL: Always use latest version**
- **Primary Models:** 
  - GPT-4o (latest): Advanced reasoning for complex domain analysis
  - GPT-4o-mini: Cost-effective for triage and simpler tasks
  - o1-preview: Advanced reasoning when available for complex prioritization
- **Rate Limits:** 
  - GPT-4o: 10,000 requests/minute (Tier 1) 
  - GPT-4o-mini: 30,000 requests/minute (Tier 1)
  - Tokens: 2M tokens/minute (Tier 1)

**Key Endpoints Used:**
- `POST /chat/completions` - All agent analysis and triage operations
- `POST /embeddings` - Document content vectorization for knowledge retrieval
- `GET /models` - Available model validation and feature detection

**Integration Architecture:**
```typescript
interface OpenAIService {
  // Domain Triage Analysis
  performTriage(assessmentData: AssessmentData): Promise<TriageResult>;
  
  // Agent Analysis Execution  
  executeAgentAnalysis(
    agentPrompt: string,
    clientData: ClientData,
    documents: ProcessedDocument[]
  ): Promise<AgentAnalysisResult>;
  
  // Perfect Prioritization Synthesis
  synthesizePrioritization(
    analyses: AgentAnalysisResult[]
  ): Promise<PrioritizationResult>;
  
  // Cost and Usage Tracking
  trackTokenUsage(operation: string, usage: TokenUsage): void;
}
```

**Cost Optimization Strategies:**
- **Intelligent Caching:** Cache agent prompts and common analysis patterns in ElastiCache
- **Token Budget Management:** Pre-calculate token limits per assessment (targeting £1-2 OpenAI cost per £5-8K assessment with improved efficiency)
- **Smart Model Selection:** Use GPT-4o-mini for triage and initial analysis, GPT-4o for complex domain synthesis, o1-preview for critical prioritization decisions
- **Prompt Optimization:** Leverage latest structured outputs and function calling for maximum efficiency
- **Circuit Breaker Pattern:** Automatic fallback to simplified analysis if API limits exceeded
- **Version Management:** Automatic detection and adoption of newer models as they become available

**Error Handling & Resilience:**
```typescript
const openAIConfig = {
  maxRetries: 3,
  retryDelayMs: 1000,
  timeoutMs: 30000,
  circuitBreakerThreshold: 5, // failures before opening circuit
  fallbackStrategy: 'simplified-analysis' // when API unavailable
};
```

**Integration Notes:** 
- All OpenAI calls include request IDs for troubleshooting
- Token usage tracked per agent and assessment for cost analysis
- Implement exponential backoff for rate limit handling
- Store agent prompt versions for A/B testing and improvement
- **Version Monitoring:** Automated checks for new model releases and capabilities
- **Structured Outputs:** Utilize latest JSON schema validation for consistent agent responses
- **Function Calling:** Leverage enhanced function calling for tool use and data extraction
- **Model Fallback Strategy:** Graceful degradation from o1 → GPT-4o → GPT-4o-mini based on availability and cost constraints

## Stripe API Integration

- **Purpose:** Payment processing for £5-8K assessment packages
- **Documentation:** https://stripe.com/docs/api
- **Base URL(s):** https://api.stripe.com/v1
- **Authentication:** Bearer token (Secret key)
- **Rate Limits:** 100 requests/second per API key

**Key Endpoints Used:**
- `POST /payment_intents` - Create payment intent for assessment purchase
- `POST /payment_intents/{id}/confirm` - Confirm payment completion
- `GET /payment_intents/{id}` - Check payment status
- `POST /webhooks` - Handle payment status webhooks
- `POST /customers` - Create customer records for billing
- `GET /payment_methods` - Retrieve saved payment methods

**Integration Architecture:**
```typescript
interface StripeService {
  // Payment Intent Management
  createPaymentIntent(
    amount: number,
    currency: string,
    customerId: string,
    metadata: AssessmentMetadata
  ): Promise<PaymentIntent>;
  
  // Payment Confirmation
  confirmPayment(paymentIntentId: string): Promise<PaymentResult>;
  
  // Customer Management  
  createCustomer(company: Company): Promise<Customer>;
  updateCustomer(customerId: string, updates: CustomerUpdate): Promise<Customer>;
  
  // Webhook Processing
  handleWebhook(event: StripeEvent): Promise<WebhookResponse>;
  
  // Billing and Invoices
  createInvoice(customerId: string, items: InvoiceItem[]): Promise<Invoice>;
}
```

**Payment Flow Integration:**
1. **Assessment Submission:** Client completes questionnaire
2. **Payment Intent Creation:** Generate Stripe payment intent for £5-8K
3. **Client Payment:** Secure card processing via Stripe Elements
4. **Webhook Confirmation:** Stripe confirms successful payment
5. **Assessment Activation:** Trigger domain triage and agent analysis pipeline
6. **Invoice Generation:** Automated invoice creation and email delivery

**Security & Compliance:**
```typescript
const stripeConfig = {
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  publicKey: process.env.STRIPE_PUBLIC_KEY, // Frontend only
  secretKey: process.env.STRIPE_SECRET_KEY, // Backend only
  apiVersion: '2023-10-16',
  paymentMethods: ['card', 'bank_transfer'], // Support multiple payment types
  currency: 'gbp',
  statementDescriptor: 'SCALEMAP ASSESSMENT'
};
```

**Integration Notes:**
- Implement idempotency keys for payment operations
- Support both immediate card payments and invoice-based billing for enterprise clients
- Webhook signature verification for security
- Comprehensive error handling for failed payments and disputes

## AWS SES (Email Service) Integration

- **Purpose:** Transactional emails for assessment delivery and communication
- **Documentation:** https://docs.aws.amazon.com/ses/
- **Base URL(s):** Regional endpoints (e.g., https://email.eu-west-1.amazonaws.com)
- **Authentication:** AWS SDK with IAM roles
- **Rate Limits:** 200 emails/day (free tier) → 50,000 emails/day (paid)

**Key Operations Used:**
- `SendEmail` - Individual email delivery for assessment results
- `SendBulkTemplatedEmail` - Batch email delivery for notifications
- `GetSendStatistics` - Email delivery and bounce rate monitoring
- `PutConfigurationSet` - Email tracking and analytics configuration

**Email Templates and Automation:**
```typescript
interface EmailService {
  // Assessment Lifecycle Emails
  sendAssessmentConfirmation(assessment: Assessment): Promise<EmailResult>;
  send24HourExecutiveSummary(assessment: Assessment, reportUrl: string): Promise<EmailResult>;
  send48HourDetailedReport(assessment: Assessment, reportUrl: string): Promise<EmailResult>;
  sendValidationRequest(assessment: Assessment, validationUrl: string): Promise<EmailResult>;
  send72HourImplementationKit(assessment: Assessment, kitUrl: string): Promise<EmailResult>;
  
  // Progress and Status Updates
  sendAnalysisProgressUpdate(assessment: Assessment, progress: ProgressUpdate): Promise<EmailResult>;
  sendAgentActivationNotification(assessment: Assessment, agents: Agent[]): Promise<EmailResult>;
  
  // Business Operations
  sendPaymentConfirmation(payment: Payment): Promise<EmailResult>;
  sendImplementationFollowup(tracking: ImplementationTracking): Promise<EmailResult>;
}
```

**Email Template Structure:**
- **Assessment Confirmation:** Welcome email with timeline and next steps
- **24-Hour Executive Summary:** High-level findings with agent attribution
- **48-Hour Detailed Report:** Comprehensive analysis with validation request
- **Validation Request:** Client feedback form with priority confirmation
- **72-Hour Implementation Kit:** Complete deliverable package with playbooks
- **Progress Updates:** Real-time status updates during analysis

**Integration Notes:**
- Use SES templates for consistent branding and personalization
- Implement bounce and complaint handling for email reputation
- Track open rates and click-through rates for optimization
- GDPR compliance for email preferences and unsubscribe handling

## AWS Textract Integration

- **Purpose:** Document content extraction and OCR for uploaded client documents
- **Documentation:** https://docs.aws.amazon.com/textract/
- **Base URL(s):** Regional endpoints via AWS SDK
- **Authentication:** AWS SDK with IAM roles
- **Rate Limits:** 15 requests/second for synchronous operations

**Key Operations Used:**
- `AnalyzeDocument` - Extract text and structure from PDFs and images
- `AnalyzeExpense` - Extract structured data from financial documents
- `StartDocumentAnalysis` - Asynchronous processing for large documents
- `GetDocumentAnalysis` - Retrieve results from asynchronous operations

**Document Processing Pipeline:**
```typescript
interface DocumentProcessingService {
  // Text Extraction
  extractTextFromDocument(s3Location: S3Location): Promise<ExtractedContent>;
  
  // Structured Data Extraction
  extractFinancialData(document: FinancialDocument): Promise<FinancialMetrics>;
  extractOrganizationalData(document: OrgChart): Promise<OrgStructure>;
  
  // Content Categorization
  categorizeDocumentContent(content: ExtractedContent): Promise<DocumentCategory>;
  
  // Agent-Ready Processing
  prepareDocumentForAgent(
    document: ProcessedDocument, 
    agentDomain: OperationalDomain
  ): Promise<AgentDocument>;
}
```

**Document Processing Workflow:**
1. **Upload Trigger:** S3 event triggers Lambda function
2. **Format Detection:** Identify document type and processing approach
3. **Content Extraction:** Use Textract for text and data extraction
4. **Content Analysis:** Categorize content by operational domain
5. **Agent Preparation:** Format content for specific agent consumption
6. **Storage Update:** Update DynamoDB with processed content and metadata

**Integration Notes:**
- Asynchronous processing for large documents to avoid Lambda timeouts
- Cost optimization through intelligent document preprocessing
- Confidence scoring for extracted content quality assessment
- Privacy controls for sensitive document handling

## Additional External Integrations

## GitHub API (Optional - Future Enhancement)

- **Purpose:** Access client repositories for technology stack analysis
- **Documentation:** https://docs.github.com/en/rest
- **Base URL(s):** https://api.github.com
- **Authentication:** OAuth2 or Personal Access Tokens
- **Rate Limits:** 5,000 requests/hour (authenticated)

**Potential Use Cases:**
- Technology stack analysis from repository dependencies
- Code quality assessment for Technology & Data Agent
- Development process analysis from commit patterns
- Security vulnerability scanning integration

## Industry Data APIs (Future Integration)

**Financial Data APIs:**
- **Alpha Vantage:** Market data and financial metrics
- **Quandl:** Economic and financial data
- **Purpose:** Industry benchmarking and financial analysis context

**Business Intelligence APIs:**
- **LinkedIn Sales Navigator:** Company insights and organizational data
- **Crunchbase:** Funding and business intelligence
- **Purpose:** Enhanced company context and competitive analysis

## External API Error Handling Strategy

```typescript
interface ExternalAPIConfig {
  service: string;
  maxRetries: number;
  retryDelayMs: number;
  timeoutMs: number;
  circuitBreakerThreshold: number;
  fallbackStrategy: 'cache' | 'simplified' | 'manual-intervention';
  monitoring: {
    successRateAlert: number; // Alert if success rate below threshold
    latencyAlert: number; // Alert if average latency above threshold
    costAlert: number; // Alert if daily costs exceed threshold
  };
}

const externalAPIConfigs = {
  openai: {
    maxRetries: 3,
    retryDelayMs: 1000,
    timeoutMs: 30000,
    circuitBreakerThreshold: 5,
    fallbackStrategy: 'simplified',
    monitoring: { successRateAlert: 0.95, latencyAlert: 10000, costAlert: 50 }
  },
  stripe: {
    maxRetries: 2,
    retryDelayMs: 500,
    timeoutMs: 10000,
    circuitBreakerThreshold: 3,
    fallbackStrategy: 'manual-intervention',
    monitoring: { successRateAlert: 0.99, latencyAlert: 5000, costAlert: 100 }
  },
  textract: {
    maxRetries: 2,
    retryDelayMs: 2000,
    timeoutMs: 60000,
    circuitBreakerThreshold: 3,
    fallbackStrategy: 'manual-intervention',
    monitoring: { successRateAlert: 0.90, latencyAlert: 30000, costAlert: 25 }
  }
};
```

## Cost Monitoring and Optimization

**Monthly Cost Projections by Assessment Volume:**

| Service | 10 Assessments | 25 Assessments | 50 Assessments | Notes |
|---------|---------------|-----------------|-----------------|-------|
| **OpenAI API** | £10-20 | £25-50 | £50-100 | 3-5 agents per assessment, improved efficiency with latest models |
| **Stripe** | £3-5 | £8-12 | £15-25 | 2.9% + 30p per transaction |
| **AWS SES** | £0 | £0 | £2-5 | Free tier covers most usage |
| **AWS Textract** | £5-10 | £12-25 | £25-50 | Document processing costs |
| **Total External** | £18-35 | £45-87 | £92-180 | ~£2-4 per assessment with latest OpenAI efficiency |

**Cost optimization maintains healthy margins on £5-8K assessment pricing.**
