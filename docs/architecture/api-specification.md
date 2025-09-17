# API Specification

ScaleMap uses a **REST API with WebSocket enhancements** for real-time agent progress updates. All APIs follow OpenAPI 3.0 specification with consistent error handling and authentication patterns.

## REST API Specification

```yaml
openapi: 3.0.0
info:
  title: ScaleMap API
  version: 1.0.0
  description: Growth Bottleneck Intelligence Platform API
servers:
  - url: https://api.scalemap.ai/v1
    description: Production API
  - url: https://staging-api.scalemap.ai/v1  
    description: Staging API

components:
  securitySchemes:
    CognitoAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: AWS Cognito JWT token

  schemas:
    Company:
      type: object
      properties:
        companyId:
          type: string
          format: uuid
        name:
          type: string
        industry:
          type: object
          properties:
            sector:
              type: string
              enum: [financial-services, healthcare, technology, manufacturing, retail-ecommerce, professional-services, media, energy, transportation, education, government, nonprofit]
            subSector:
              type: string
            regulatoryClassification:
              type: string
              enum: [heavily-regulated, moderately-regulated, lightly-regulated]
            specificRegulations:
              type: array
              items:
                type: string
        businessModel:
          type: string
          enum: [b2b-saas, b2c-marketplace, b2b-services, manufacturing, hybrid]
        size:
          type: object
          properties:
            employees:
              type: integer
            contractors:
              type: integer
            locations:
              type: integer
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
      required:
        - companyId
        - name
        - industry
        - businessModel
        - size

    Assessment:
      type: object
      properties:
        assessmentId:
          type: string
          format: uuid
        companyId:
          type: string
          format: uuid
        status:
          type: string
          enum: [submitted, document-processing, triaging, analyzing, validating, completed, failed]
        assessmentContext:
          type: object
          properties:
            primaryBusinessChallenges:
              type: array
              items:
                type: string
            strategicObjectives:
              type: array
              items:
                type: string
            resourceConstraints:
              type: object
              properties:
                budget:
                  type: string
                  enum: [limited, moderate, substantial]
                team:
                  type: string
                  enum: [stretched, adequate, abundant]
                timeAvailability:
                  type: string
                  enum: [minimal, moderate, flexible]
        domainResponses:
          type: object
          additionalProperties:
            type: object
        activatedAgents:
          type: array
          items:
            type: string
        deliverySchedule:
          type: object
          properties:
            executive24h:
              type: string
              format: date-time
            detailed48h:
              type: string
              format: date-time  
            implementation72h:
              type: string
              format: date-time
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time
      required:
        - assessmentId
        - companyId
        - status

    AgentAnalysisResult:
      type: object
      properties:
        analysisId:
          type: string
          format: uuid
        assessmentId:
          type: string
          format: uuid
        agentId:
          type: string
        domain:
          type: string
        analysisStatus:
          type: string
          enum: [pending, processing, completed, failed]
        findings:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              title:
                type: string
              description:
                type: string
              severity:
                type: string
                enum: [critical, high, medium, low]
              evidence:
                type: array
                items:
                  type: string
        recommendations:
          type: array
          items:
            type: object
            properties:
              id:
                type: string
              title:
                type: string
              description:
                type: string
              priority:
                type: integer
                minimum: 1
                maximum: 10
              implementationComplexity:
                type: string
                enum: [low, medium, high]
              estimatedImpact:
                type: string
                enum: [low, medium, high]
        confidence:
          type: number
          minimum: 0
          maximum: 1
        createdAt:
          type: string
          format: date-time
        completedAt:
          type: string
          format: date-time

    Error:
      type: object
      properties:
        error:
          type: object
          properties:
            code:
              type: string
            message:
              type: string
            details:
              type: object
            timestamp:
              type: string
              format: date-time
            requestId:
              type: string
      required:
        - error

paths:
  # Company Management
  /companies:
    post:
      summary: Create company profile
      security:
        - CognitoAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Company'
      responses:
        '201':
          description: Company created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Company'
        '400':
          description: Invalid input
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
        '401':
          description: Unauthorized
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

  /companies/{companyId}:
    get:
      summary: Get company profile
      security:
        - CognitoAuth: []
      parameters:
        - name: companyId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Company profile
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Company'
        '404':
          description: Company not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'

    put:
      summary: Update company profile
      security:
        - CognitoAuth: []
      parameters:
        - name: companyId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Company'
      responses:
        '200':
          description: Company updated successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Company'
        '400':
          description: Invalid input
        '404':
          description: Company not found

  # Assessment Management
  /assessments:
    post:
      summary: Create new assessment
      security:
        - CognitoAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                companyId:
                  type: string
                  format: uuid
                assessmentContext:
                  type: object
                domainResponses:
                  type: object
              required:
                - companyId
                - domainResponses
      responses:
        '201':
          description: Assessment created and processing started
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Assessment'
        '400':
          description: Invalid assessment data
        '402':
          description: Payment required
        '409':
          description: Active assessment already exists for company

  /assessments/{assessmentId}:
    get:
      summary: Get assessment details
      security:
        - CognitoAuth: []
      parameters:
        - name: assessmentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Assessment details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Assessment'
        '404':
          description: Assessment not found

  /assessments/{assessmentId}/documents:
    post:
      summary: Upload supporting documents
      security:
        - CognitoAuth: []
      parameters:
        - name: assessmentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                files:
                  type: array
                  items:
                    type: string
                    format: binary
                categories:
                  type: array
                  items:
                    type: string
                    enum: [org-chart, financial, process-doc, strategy, compliance, other]
      responses:
        '201':
          description: Documents uploaded successfully
          content:
            application/json:
              schema:
                type: object
                properties:
                  documentIds:
                    type: array
                    items:
                      type: string
        '400':
          description: Invalid file format or size
        '413':
          description: File too large

  /assessments/{assessmentId}/validation:
    post:
      summary: Submit client validation feedback
      security:
        - CognitoAuth: []
      parameters:
        - name: assessmentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                priorityConfirmation:
                  type: array
                  items:
                    type: object
                    properties:
                      recommendationId:
                        type: string
                      confirmed:
                        type: boolean
                      adjustedPriority:
                        type: integer
                      additionalContext:
                        type: string
                implementationCapacity:
                  type: object
                  properties:
                    budget:
                      type: string
                      enum: [limited, moderate, substantial]
                    timeline:
                      type: string
                      enum: [urgent, moderate, flexible]
                    resources:
                      type: string
                      enum: [constrained, adequate, abundant]
      responses:
        '200':
          description: Validation feedback recorded
        '400':
          description: Invalid validation data
        '409':
          description: Assessment not in validation stage

  # Agent Analysis Results
  /assessments/{assessmentId}/analysis:
    get:
      summary: Get agent analysis results
      security:
        - CognitoAuth: []
      parameters:
        - name: assessmentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: domain
          in: query
          required: false
          schema:
            type: string
        - name: status
          in: query
          required: false
          schema:
            type: string
            enum: [pending, processing, completed, failed]
      responses:
        '200':
          description: Analysis results
          content:
            application/json:
              schema:
                type: object
                properties:
                  analyses:
                    type: array
                    items:
                      $ref: '#/components/schemas/AgentAnalysisResult'
                  summary:
                    type: object
                    properties:
                      totalAgents:
                        type: integer
                      completedAnalyses:
                        type: integer
                      overallConfidence:
                        type: number
                      estimatedCompletion:
                        type: string
                        format: date-time
        '404':
          description: Assessment not found

  # Deliverables
  /assessments/{assessmentId}/deliverables:
    get:
      summary: Get assessment deliverables
      security:
        - CognitoAuth: []
      parameters:
        - name: assessmentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: stage
          in: query
          required: false
          schema:
            type: string
            enum: [executive-24h, detailed-48h, implementation-72h]
      responses:
        '200':
          description: Available deliverables
          content:
            application/json:
              schema:
                type: object
                properties:
                  deliverables:
                    type: array
                    items:
                      type: object
                      properties:
                        stage:
                          type: string
                        title:
                          type: string
                        status:
                          type: string
                          enum: [pending, generating, ready, delivered]
                        downloadUrl:
                          type: string
                        deliveredAt:
                          type: string
                          format: date-time
        '404':
          description: Assessment not found

  # Agent Personalities (Read-only for clients)
  /agents:
    get:
      summary: Get all agent profiles
      security:
        - CognitoAuth: []
      responses:
        '200':
          description: Agent profiles for UI display
          content:
            application/json:
              schema:
                type: object
                properties:
                  agents:
                    type: array
                    items:
                      type: object
                      properties:
                        agentId:
                          type: string
                        name:
                          type: string
                        title:
                          type: string
                        avatar:
                          type: string
                        expertise:
                          type: object
                          properties:
                            primaryDomains:
                              type: array
                              items:
                                type: string
                            industrySpecializations:
                              type: array
                              items:
                                type: string
                        personality:
                          type: object
                          properties:
                            communicationStyle:
                              type: string
                            backstory:
                              type: string

  # WebSocket Events (separate service)
  /ws/assessments/{assessmentId}:
    get:
      summary: WebSocket connection for real-time updates
      description: |
        WebSocket endpoint for receiving real-time assessment progress updates.
        
        Message Types:
        - agent_started: Agent begins domain analysis
        - agent_progress: Agent reports analysis progress
        - agent_completed: Agent completes domain analysis  
        - triage_completed: Domain triage results available
        - validation_requested: Client validation needed
        - deliverable_ready: New deliverable available for download
        - assessment_completed: Full assessment pipeline completed
        
        Message Format:
        {
          "type": "agent_progress",
          "timestamp": "2024-01-15T10:30:00Z",
          "assessmentId": "uuid",
          "agentId": "financial-expert",
          "domain": "financial-management",
          "progress": 75,
          "message": "Analyzing cash flow patterns...",
          "estimatedCompletion": "2024-01-15T11:00:00Z"
        }
      parameters:
        - name: assessmentId
          in: path
          required: true
          schema:
            type: string
            format: uuid
        - name: Authorization
          in: header
          required: true
          schema:
            type: string
            description: Bearer JWT token
```
