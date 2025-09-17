# Core Workflows

ScaleMap's core workflows orchestrate the complete journey from assessment submission to implementation kit delivery within 72 hours. These sequence diagrams illustrate the key system interactions and agent coordination patterns.

## Complete Assessment Pipeline (72-Hour Journey)

```mermaid
sequenceDiagram
    participant Client
    participant WebApp as Next.js Web App
    participant API as API Gateway
    participant Auth as Cognito Auth
    participant Assessment as Assessment Engine
    participant Payment as Payment Service
    participant Triage as Domain Triage
    participant Orchestrator as Agent Orchestrator
    participant Agents as Agent Pool (3-5)
    participant Prioritization as Perfect Prioritization
    participant Validation as Client Validation
    participant Delivery as Delivery Pipeline
    participant Email as Email Service

    Note over Client, Email: Phase 1: Assessment Submission & Payment
    
    Client->>WebApp: Complete 12-domain questionnaire
    WebApp->>API: POST /assessments
    API->>Auth: Validate JWT token
    Auth-->>API: Token valid
    API->>Assessment: Create assessment
    Assessment->>Payment: Request payment intent
    Payment->>Stripe: Create payment (£5-8K)
    Stripe-->>Payment: Payment intent created
    Payment-->>API: Payment URL
    API-->>WebApp: Assessment created, payment required
    WebApp-->>Client: Redirect to secure payment
    
    Client->>Stripe: Complete payment
    Stripe->>Payment: Webhook: payment_succeeded
    Payment->>Assessment: Activate assessment pipeline
    Assessment->>Email: Send confirmation email
    Email-->>Client: "Assessment starting, 24h executive summary coming"

    Note over Client, Email: Phase 2: Domain Triage & Agent Activation (Hours 0-2)

    Assessment->>Triage: Analyze assessment + documents
    Triage->>OpenAI: Intelligent domain analysis
    OpenAI-->>Triage: Critical domains identified (3-5 of 12)
    Triage->>Orchestrator: Activate specific agents
    Orchestrator->>Agents: Parallel agent deployment
    Orchestrator->>WebSocket: Notify client of agent activation
    WebSocket-->>Client: Real-time progress: "5 expert agents analyzing..."

    Note over Client, Email: Phase 3: Multi-Agent Analysis (Hours 2-24)

    loop For each activated agent
        Agents->>OpenAI: Domain-specific analysis
        OpenAI-->>Agents: Analysis results
        Agents->>DynamoDB: Store findings & recommendations
        Agents->>WebSocket: Progress update
        WebSocket-->>Client: "Financial expert 75% complete..."
    end

    Orchestrator->>Orchestrator: Check all agents complete
    Orchestrator->>Prioritization: Synthesize initial findings
    Prioritization->>OpenAI: Cross-domain analysis
    OpenAI-->>Prioritization: Priority recommendations
    Prioritization->>Delivery: Generate 24h executive summary
    Delivery->>S3: Store executive summary
    Delivery->>Email: Send 24h deliverable
    Email-->>Client: "Executive summary ready - key findings attached"

    Note over Client, Email: Phase 4: Detailed Analysis & Validation (Hours 24-48)

    Prioritization->>OpenAI: Detailed recommendation synthesis
    OpenAI-->>Prioritization: Comprehensive priority matrix
    Prioritization->>Delivery: Generate detailed report with heatmaps
    Delivery->>S3: Store detailed report
    Delivery->>Validation: Request client validation
    Validation->>Email: Send validation request
    Email-->>Client: "Detailed report ready - please validate priorities"

    Client->>WebApp: Review findings & provide feedback
    WebApp->>API: POST /validation/feedback
    API->>Validation: Process client feedback
    Validation->>Prioritization: Adjust priorities based on feedback

    Note over Client, Email: Phase 5: Implementation Kit Generation (Hours 48-72)

    Prioritization->>Delivery: Generate customized implementation kits
    Delivery->>OpenAI: Create playbooks based on validation
    OpenAI-->>Delivery: Implementation templates & guides
    Delivery->>S3: Store complete implementation kit
    Delivery->>Email: Send final deliverables
    Email-->>Client: "Complete implementation kit ready - everything you need to execute"

    Note over Client, Email: Assessment Complete - 72 Hours Total
```

## Agent Orchestration Workflow (Multi-Agent Coordination)

```mermaid
sequenceDiagram
    participant Triage as Domain Triage
    participant Orchestrator as Agent Orchestrator
    participant SQS as SQS Queues
    participant Agent1 as Financial Agent
    participant Agent2 as Tech Agent  
    participant Agent3 as Ops Agent
    participant OpenAI as OpenAI API
    participant DynamoDB as DynamoDB
    participant WebSocket as WebSocket API

    Note over Triage, WebSocket: Intelligent Agent Activation (3-5 of 12 agents)

    Triage->>Orchestrator: Activate agents: [financial, tech, ops]
    Orchestrator->>SQS: Queue agent tasks
    Orchestrator->>WebSocket: Broadcast agent activation
    WebSocket-->>Client: "3 expert agents assigned to your assessment"

    Note over Triage, WebSocket: Parallel Agent Processing

    par Financial Analysis
        SQS->>Agent1: Financial analysis task
        Agent1->>OpenAI: Analyze financial health
        OpenAI-->>Agent1: Financial findings
        Agent1->>DynamoDB: Store analysis results
        Agent1->>WebSocket: Progress update (33% complete)
    and Tech Analysis
        SQS->>Agent2: Technology assessment task
        Agent2->>OpenAI: Analyze tech stack & processes
        OpenAI-->>Agent2: Technology recommendations
        Agent2->>DynamoDB: Store analysis results  
        Agent2->>WebSocket: Progress update (66% complete)
    and Operations Analysis
        SQS->>Agent3: Operational excellence task
        Agent3->>OpenAI: Analyze operational efficiency
        OpenAI-->>Agent3: Process optimization insights
        Agent3->>DynamoDB: Store analysis results
        Agent3->>WebSocket: Progress update (100% complete)
    end

    Note over Triage, WebSocket: Analysis Synthesis

    Orchestrator->>DynamoDB: Retrieve all agent results
    Orchestrator->>Perfect Prioritization: Synthesize findings
    Perfect Prioritization->>OpenAI: Cross-domain prioritization
    OpenAI-->>Perfect Prioritization: Priority matrix with dependencies
    Perfect Prioritization->>WebSocket: Analysis complete
    WebSocket-->>Client: "Expert analysis complete - generating recommendations"
```

## Document Processing & Agent Integration Workflow

```mermaid
sequenceDiagram
    participant Client
    participant S3 as S3 Storage
    participant DocProcessor as Document Processor
    participant Textract as AWS Textract
    participant DynamoDB as DynamoDB
    participant Agent as Domain Agent
    participant OpenAI as OpenAI API

    Note over Client, OpenAI: Document Upload & Processing

    Client->>S3: Upload documents (org chart, financials, etc.)
    S3->>DocProcessor: S3 event trigger
    DocProcessor->>Textract: Extract text & structured data
    Textract-->>DocProcessor: Extracted content
    DocProcessor->>DocProcessor: Categorize by domain
    DocProcessor->>DynamoDB: Store processed document metadata

    Note over Client, OpenAI: Agent Document Integration

    Agent->>DynamoDB: Request relevant documents
    DynamoDB-->>Agent: Document content by category
    Agent->>OpenAI: Analyze assessment + document evidence
    OpenAI-->>Agent: Enhanced analysis with document insights
    Agent->>DynamoDB: Store analysis with document citations

    Note over Client, OpenAI: Client Receives Evidence-Based Analysis
```

## Payment & Assessment Activation Workflow

```mermaid
sequenceDiagram
    participant Client
    participant Stripe as Stripe API
    participant Payment as Payment Service
    participant Assessment as Assessment Engine
    participant Triage as Domain Triage
    participant Email as Email Service

    Note over Client, Email: Secure Payment Processing

    Client->>Stripe: Complete payment (£5-8K)
    Stripe->>Payment: Webhook: payment_intent.succeeded
    Payment->>Assessment: Activate assessment pipeline
    Assessment->>Assessment: Update status: 'processing'
    Assessment->>Triage: Trigger domain analysis
    Assessment->>Email: Send payment confirmation
    Email-->>Client: "Payment confirmed - analysis starting now"

    alt Payment Failed
        Stripe->>Payment: Webhook: payment_intent.payment_failed
        Payment->>Assessment: Suspend assessment
        Payment->>Email: Send payment failed notice
        Email-->>Client: "Payment issue - please update payment method"
    end

    Note over Client, Email: Assessment begins only after confirmed payment
```

## Client Validation & Feedback Integration Workflow

```mermaid
sequenceDiagram
    participant Client
    participant WebApp as Next.js Web App
    participant Validation as Validation Service
    participant Prioritization as Prioritization Engine
    participant Delivery as Delivery Pipeline
    participant Email as Email Service

    Note over Client, Email: 48-Hour Validation Process

    Validation->>Email: Send detailed report + validation request
    Email-->>Client: "Review findings - confirm priorities within 24h"
    
    alt Client Provides Feedback
        Client->>WebApp: Review report & adjust priorities
        WebApp->>Validation: Submit priority confirmations
        Validation->>Prioritization: Update recommendations
        Prioritization->>Delivery: Generate customized implementation kit
        Delivery->>Email: Send personalized deliverables
        Email-->>Client: "Implementation kit customized to your feedback"
    else No Client Response (24h timeout)
        Validation->>Validation: Auto-proceed with original priorities
        Validation->>Delivery: Generate standard implementation kit
        Delivery->>Email: Send standard deliverables  
        Email-->>Client: "Implementation kit ready - based on expert analysis"
    end

    Note over Client, Email: Process continues with or without client input
```

## Real-Time Progress Communication Workflow

```mermaid
sequenceDiagram
    participant Client
    participant WebApp as Next.js Frontend
    participant WebSocket as WebSocket API
    participant Orchestrator as Agent Orchestrator
    participant Agents as Domain Agents
    participant Delivery as Delivery Pipeline

    Note over Client, Delivery: Real-Time Assessment Progress

    WebApp->>WebSocket: Connect to assessment/{id}
    WebSocket-->>WebApp: Connection established

    loop During 72-hour process
        Orchestrator->>WebSocket: Agent activation event
        WebSocket-->>WebApp: "Financial expert Sarah analyzing cash flow..."
        WebApp-->>Client: Real-time UI update

        Agents->>WebSocket: Progress updates
        WebSocket-->>WebApp: "Analysis 45% complete - reviewing documents..."
        WebApp-->>Client: Progress bar + agent activity

        Delivery->>WebSocket: Deliverable ready events
        WebSocket-->>WebApp: "Executive summary generated - downloading..."
        WebApp-->>Client: Download notification
    end

    Note over Client, Delivery: Client sees live progress throughout 72 hours
```

## Error Handling & Recovery Workflow

```mermaid
sequenceDiagram
    participant Component as Any Service
    participant OpenAI as OpenAI API
    participant CircuitBreaker as Circuit Breaker
    participant Fallback as Fallback Handler
    participant Monitor as Monitoring
    participant Human as Human QA

    Note over Component, Human: Graceful Error Handling

    Component->>OpenAI: API request
    
    alt OpenAI Success
        OpenAI-->>Component: Analysis results
    else OpenAI Rate Limit
        OpenAI-->>CircuitBreaker: 429 Too Many Requests
        CircuitBreaker->>CircuitBreaker: Exponential backoff
        CircuitBreaker->>OpenAI: Retry request
        OpenAI-->>Component: Analysis results (delayed)
    else OpenAI Circuit Open
        CircuitBreaker->>Fallback: Use cached/simplified analysis
        Fallback-->>Component: Fallback analysis
        Monitor->>Human: Alert: OpenAI circuit open
    else Critical Failure
        Component->>Monitor: Error alert
        Monitor->>Human: Escalate for manual intervention
        Human->>Component: Manual override/completion
    end

    Note over Component, Human: System maintains 72-hour SLA through resilience patterns
```
