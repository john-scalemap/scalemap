import { DynamoDBClient, GetItemCommand, PutItemCommand, QueryCommand, UpdateItemCommand, CreateTableCommand, DescribeTableCommand, ScalarAttributeType, KeyType, ProjectionType, BillingMode } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  Assessment,
  AssessmentStatus,
  DomainName,
  DomainTemplate,
  Question,
  AssessmentValidation,
  AssessmentValidationError,
  ValidationWarning,
  TriageResult,
  AgentAnalysisResult
} from '@scalemap/shared';

import { OpenAIService } from './openai-service';
import { SESService } from './ses-service';

export class AssessmentService {
  private dynamoDb: DynamoDBClient;
  private tableName: string;
  private openAIService: OpenAIService;
  private sesService: SESService;

  constructor() {
    this.dynamoDb = new DynamoDBClient({
      region: process.env.AWS_REGION || 'eu-west-1',
      ...(process.env.AWS_ACCESS_KEY_ID && {
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      }),
    });
    this.tableName = process.env.DYNAMODB_TABLE_NAME || 'scalemap-prod';
    this.openAIService = new OpenAIService();
    this.sesService = new SESService();
  }

  async ensureTableExists(): Promise<void> {
    try {
      await this.dynamoDb.send(new DescribeTableCommand({
        TableName: this.tableName
      }));
      console.log(`✅ Table ${this.tableName} exists`);
    } catch (error: any) {
      if (error.name === 'ResourceNotFoundException') {
        console.log(`🛠️ Creating DynamoDB table: ${this.tableName}`);
        await this.createTable();
        console.log(`✅ Table ${this.tableName} created successfully`);
      } else {
        console.error('❌ Error checking table existence:', error);
        throw error;
      }
    }
  }

  private async createTable(): Promise<void> {
    const params = {
      TableName: this.tableName,
      KeySchema: [
        { AttributeName: 'PK', KeyType: KeyType.HASH },
        { AttributeName: 'SK', KeyType: KeyType.RANGE }
      ],
      AttributeDefinitions: [
        { AttributeName: 'PK', AttributeType: ScalarAttributeType.S },
        { AttributeName: 'SK', AttributeType: ScalarAttributeType.S },
        { AttributeName: 'GSI1PK', AttributeType: ScalarAttributeType.S },
        { AttributeName: 'GSI1SK', AttributeType: ScalarAttributeType.S },
        { AttributeName: 'GSI2PK', AttributeType: ScalarAttributeType.S },
        { AttributeName: 'GSI2SK', AttributeType: ScalarAttributeType.S }
      ],
      GlobalSecondaryIndexes: [
        {
          IndexName: 'GSI1',
          KeySchema: [
            { AttributeName: 'GSI1PK', KeyType: KeyType.HASH },
            { AttributeName: 'GSI1SK', KeyType: KeyType.RANGE }
          ],
          Projection: { ProjectionType: ProjectionType.ALL },
          BillingMode: BillingMode.PAY_PER_REQUEST
        },
        {
          IndexName: 'GSI2',
          KeySchema: [
            { AttributeName: 'GSI2PK', KeyType: KeyType.HASH },
            { AttributeName: 'GSI2SK', KeyType: KeyType.RANGE }
          ],
          Projection: { ProjectionType: ProjectionType.ALL },
          BillingMode: BillingMode.PAY_PER_REQUEST
        }
      ],
      BillingMode: BillingMode.PAY_PER_REQUEST
    };

    await this.dynamoDb.send(new CreateTableCommand(params));

    // Wait for table to be active
    let tableActive = false;
    while (!tableActive) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      try {
        const response = await this.dynamoDb.send(new DescribeTableCommand({
          TableName: this.tableName
        }));
        tableActive = response.Table?.TableStatus === 'ACTIVE';
      } catch (error) {
        // Continue waiting
      }
    }
  }

  async getAssessment(assessmentId: string): Promise<Assessment | null> {
    try {
      await this.ensureTableExists();

      const params = {
        TableName: this.tableName,
        Key: marshall({
          PK: `ASSESSMENT#${assessmentId}`,
          SK: 'METADATA'
        })
      };

      console.log('🔍 Getting assessment with params:', JSON.stringify(params, null, 2));
      const result = await this.dynamoDb.send(new GetItemCommand(params));
      console.log('📋 DynamoDB result:', result ? 'has result' : 'no result', result?.Item ? 'has Item' : 'no Item');

      if (!result || !result.Item) {
        return null;
      }

      const assessment = unmarshall(result.Item) as Assessment;

      // Remove DynamoDB internal fields
      delete (assessment as any).PK;
      delete (assessment as any).SK;
      delete (assessment as any).GSI1PK;
      delete (assessment as any).GSI1SK;
      delete (assessment as any).GSI2PK;
      delete (assessment as any).GSI2SK;
      delete (assessment as any).TTL;

      return assessment;
    } catch (error) {
      console.error('Error getting assessment:', error);
      throw error;
    }
  }

  async createAssessment(assessment: Assessment): Promise<Assessment> {
    try {
      await this.ensureTableExists();

      const itemToStore = {
        PK: `ASSESSMENT#${assessment.id}`,
        SK: 'METADATA',
        GSI1PK: `COMPANY#${assessment.companyId}`,
        GSI1SK: `ASSESSMENT#${assessment.createdAt}`,
        GSI2PK: `STATUS#${assessment.status}`,
        GSI2SK: `CREATED#${assessment.createdAt}`,
        ...assessment,
        TTL: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60) // 90 days TTL
      };

      console.log('💾 Storing assessment with keys:', {
        PK: itemToStore.PK,
        SK: itemToStore.SK,
        assessmentId: assessment.id
      });

      const params = {
        TableName: this.tableName,
        Item: marshall(itemToStore, { removeUndefinedValues: true })
      };

      try {
        await this.dynamoDb.send(new PutItemCommand(params));
        console.log('✅ Put operation completed successfully');
      } catch (putError) {
        console.error('❌ Put operation failed:', putError);
        throw putError;
      }
      return assessment;
    } catch (error) {
      console.error('Error creating assessment:', error);
      throw error;
    }
  }

  async updateAssessment(assessmentId: string, updates: Partial<Assessment>): Promise<Assessment> {
    try {
      // Build update expression
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'createdAt') { // Don't update immutable fields
          updateExpressions.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = value;
        }
      });

      // Always update the timestamp
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const params = {
        TableName: this.tableName,
        Key: marshall({
          PK: `ASSESSMENT#${assessmentId}`,
          SK: 'METADATA'
        }),
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues),
        ReturnValues: 'ALL_NEW' as const
      };

      const result = await this.dynamoDb.send(new UpdateItemCommand(params));

      if (!result.Attributes) {
        throw new Error('Failed to update assessment');
      }

      const updatedAssessment = unmarshall(result.Attributes) as Assessment;

      // Remove DynamoDB internal fields
      delete (updatedAssessment as any).PK;
      delete (updatedAssessment as any).SK;
      delete (updatedAssessment as any).GSI1PK;
      delete (updatedAssessment as any).GSI1SK;
      delete (updatedAssessment as any).GSI2PK;
      delete (updatedAssessment as any).GSI2SK;
      delete (updatedAssessment as any).TTL;

      return updatedAssessment;
    } catch (error) {
      console.error('Error updating assessment:', error);
      throw error;
    }
  }

  async getAssessmentsByCompany(companyId: string, limit = 20): Promise<Assessment[]> {
    try {
      const params = {
        TableName: this.tableName,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :companyKey',
        ExpressionAttributeValues: marshall({
          ':companyKey': `COMPANY#${companyId}`
        }),
        Limit: limit,
        ScanIndexForward: false // Latest first
      };

      const result = await this.dynamoDb.send(new QueryCommand(params));

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => {
        const assessment = unmarshall(item) as Assessment;

        // Remove DynamoDB internal fields
        delete (assessment as any).PK;
        delete (assessment as any).SK;
        delete (assessment as any).GSI1PK;
        delete (assessment as any).GSI1SK;
        delete (assessment as any).GSI2PK;
        delete (assessment as any).GSI2SK;
        delete (assessment as any).TTL;

        return assessment;
      });
    } catch (error) {
      console.error('Error getting assessments by company:', error);
      throw error;
    }
  }

  async updateAssessmentStatus(assessmentId: string, status: AssessmentStatus): Promise<Assessment> {
    try {
      const params = {
        TableName: this.tableName,
        Key: marshall({
          PK: `ASSESSMENT#${assessmentId}`,
          SK: 'METADATA'
        }),
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt, GSI2PK = :statusKey',
        ExpressionAttributeNames: {
          '#status': 'status',
          '#updatedAt': 'updatedAt'
        },
        ExpressionAttributeValues: marshall({
          ':status': status,
          ':updatedAt': new Date().toISOString(),
          ':statusKey': `STATUS#${status}`
        }),
        ReturnValues: 'ALL_NEW' as const
      };

      const result = await this.dynamoDb.send(new UpdateItemCommand(params));

      if (!result.Attributes) {
        throw new Error('Failed to update assessment status');
      }

      const updatedAssessment = unmarshall(result.Attributes) as Assessment;

      // Remove DynamoDB internal fields
      delete (updatedAssessment as any).PK;
      delete (updatedAssessment as any).SK;
      delete (updatedAssessment as any).GSI1PK;
      delete (updatedAssessment as any).GSI1SK;
      delete (updatedAssessment as any).GSI2PK;
      delete (updatedAssessment as any).GSI2SK;
      delete (updatedAssessment as any).TTL;

      return updatedAssessment;
    } catch (error) {
      console.error('Error updating assessment status:', error);
      throw error;
    }
  }

  async submitAssessment(assessmentId: string): Promise<Assessment> {
    try {
      // First, get the current assessment to validate it's ready for submission
      const assessment = await this.getAssessment(assessmentId);

      if (!assessment) {
        throw new Error('Assessment not found');
      }

      // Validate that assessment meets minimum requirements
      const validation = await this.validateAssessmentCompleteness(assessment);

      if (!validation.isValid) {
        throw new Error(`Assessment validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      if (validation.completeness < 70) {
        throw new Error('Assessment must be at least 70% complete to submit');
      }

      // Update status to triaging and set completion timestamp
      const updates: Partial<Assessment> = {
        status: 'triaging',
        completedAt: new Date().toISOString()
      };

      const updatedAssessment = await this.updateAssessment(assessmentId, updates);

      // Send confirmation email
      try {
        await this.sesService.sendAssessmentConfirmation(updatedAssessment);
      } catch (emailError) {
        console.warn('Failed to send confirmation email:', emailError);
        // Don't fail the submission if email fails
      }

      // Start triage analysis asynchronously
      this.startTriageAnalysis(updatedAssessment).catch(error => {
        console.error('Failed to start triage analysis:', error);
      });

      return updatedAssessment;
    } catch (error) {
      console.error('Error submitting assessment:', error);
      throw error;
    }
  }

  /**
   * Start domain triage analysis using OpenAI
   */
  async startTriageAnalysis(assessment: Assessment): Promise<void> {
    try {
      console.log(`Starting triage analysis for assessment ${assessment.id}`);

      // Update status to triaging
      await this.updateAssessmentStatus(assessment.id, 'triaging');

      // Reset OpenAI metrics for this assessment
      this.openAIService.resetMetrics();

      // Perform triage analysis
      const triageResult = await this.openAIService.performTriage(assessment);

      // Store triage results in assessment
      const updates: Partial<Assessment> = {
        triageResult,
        status: 'analyzing',
        triageCompletedAt: new Date().toISOString()
      };

      await this.updateAssessment(assessment.id, updates);

      console.log(`Triage completed for assessment ${assessment.id}:`, {
        criticalDomains: triageResult.criticalDomains,
        confidence: triageResult.confidence
      });

      // Start agent analysis for critical domains
      this.startAgentAnalysis(assessment.id, triageResult).catch(error => {
        console.error('Failed to start agent analysis:', error);
      });

    } catch (error) {
      console.error('Triage analysis failed:', error);
      await this.updateAssessmentStatus(assessment.id, 'failed');
      throw error;
    }
  }

  /**
   * Start domain agent analysis
   */
  async startAgentAnalysis(assessmentId: string, triageResult: TriageResult): Promise<void> {
    try {
      const assessment = await this.getAssessment(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }

      console.log(`Starting agent analysis for ${triageResult.criticalDomains.length} domains`);

      const agentResults: AgentAnalysisResult[] = [];

      // Process each critical domain with its specialist agent
      for (const domain of triageResult.criticalDomains) {
        try {
          const domainName = domain as DomainName;
          const agentPrompt = this.getAgentPrompt(domainName);

          const clientData = {
            companyName: assessment.companyName,
            industryClassification: assessment.industryClassification,
            companyStage: assessment.companyStage,
            domainResponses: assessment.domainResponses
          };

          // For now, process documents as empty array - will be populated from S3 in Story 2.2
          const documents: any[] = [];

          const agentResult = await this.openAIService.executeAgentAnalysis(
            agentPrompt,
            clientData,
            documents,
            domainName
          );

          agentResults.push(agentResult);

          console.log(`Agent analysis completed for domain: ${domain}`);

        } catch (domainError) {
          console.error(`Failed to analyze domain ${domain}:`, domainError);
          // Continue with other domains
        }
      }

      // Store agent results
      const updates: Partial<Assessment> = {
        agentAnalysisResults: agentResults,
        analysisCompletedAt: new Date().toISOString()
      };

      if (agentResults.length > 0) {
        // Start prioritization synthesis
        await this.startPrioritizationSynthesis(assessmentId, agentResults);
      } else {
        updates.status = 'failed';
        await this.updateAssessment(assessmentId, updates);
      }

    } catch (error) {
      console.error('Agent analysis failed:', error);
      await this.updateAssessmentStatus(assessmentId, 'failed');
      throw error;
    }
  }

  /**
   * Synthesize final prioritization from agent analyses
   */
  async startPrioritizationSynthesis(assessmentId: string, agentResults: AgentAnalysisResult[]): Promise<void> {
    try {
      console.log(`Starting prioritization synthesis for assessment ${assessmentId}`);

      const prioritizationResult = await this.openAIService.synthesizePrioritization(agentResults);

      // Update assessment with final results
      const updates: Partial<Assessment> = {
        prioritizationResult,
        status: 'completed',
        synthesisCompletedAt: new Date().toISOString()
      };

      const updatedAssessment = await this.updateAssessment(assessmentId, updates);

      console.log(`Assessment ${assessmentId} completed successfully`);

      // Send completion notification email
      try {
        // This would typically include the report URL - for now just log
        const reportUrl = `https://scalemap.uk/assessments/${assessmentId}/results`;
        await this.sesService.send72HourImplementationKit(updatedAssessment, reportUrl);
      } catch (emailError) {
        console.warn('Failed to send completion email:', emailError);
      }

      // Log OpenAI usage metrics
      const metrics = this.openAIService.getMetrics();
      console.log('Assessment completion metrics:', metrics);

    } catch (error) {
      console.error('Prioritization synthesis failed:', error);
      await this.updateAssessmentStatus(assessmentId, 'failed');
      throw error;
    }
  }

  /**
   * Get agent prompt for specific domain
   */
  private getAgentPrompt(domain: DomainName): string {
    const agentPrompts: Record<DomainName, string> = {
      'strategic-alignment': `You are Sarah, the Strategic Alignment specialist. You analyze how well organizations align strategy across all levels and adapt to market changes. Focus on vision clarity, strategic coherence, and market positioning.`,

      'financial-management': `You are Marcus, the Financial Management expert. You evaluate financial planning, cash flow management, and capital efficiency practices. Focus on financial health, budgeting processes, and capital allocation.`,

      'revenue-engine': `You are Elena, the Revenue Engine specialist. You analyze sales processes, customer acquisition, and revenue growth systems. Focus on sales effectiveness, marketing ROI, and growth scalability.`,

      'operational-excellence': `You are David, the Operations Excellence expert. You review process management, efficiency, and scalability of operations. Focus on process optimization, quality management, and operational efficiency.`,

      'people-organization': `You are Lisa, the People & Organization specialist. You examine talent management, culture, and organizational development capabilities. Focus on team structure, culture alignment, and talent retention.`,

      'technology-data': `You are Alex, the Technology & Data expert. You assess technology infrastructure, data management, and digital capabilities. Focus on tech stack efficiency, data utilization, and digital transformation.`,

      'customer-experience': `You are Maya, the Customer Experience specialist. You evaluate customer satisfaction, product development, and experience optimization. Focus on customer journey, satisfaction metrics, and product-market fit.`,

      'supply-chain': `You are Carlos, the Supply Chain expert. You review supply chain efficiency, vendor relationships, and operational resilience. Focus on procurement processes, vendor management, and supply chain optimization.`,

      'risk-compliance': `You are Jennifer, the Risk & Compliance specialist. You analyze risk management practices and regulatory compliance capabilities. Focus on risk assessment, compliance frameworks, and governance structures.`,

      'partnerships': `You are Robert, the Partnerships & Ecosystem expert. You assess strategic partnerships, ecosystem integration, and external relationships. Focus on partnership value, ecosystem strategy, and alliance management.`,

      'customer-success': `You are Nicole, the Customer Success specialist. You evaluate customer lifecycle management, retention, and expansion strategies. Focus on customer health, retention rates, and expansion opportunities.`,

      'change-management': `You are Kevin, the Change Management expert. You review organizational change capabilities and implementation effectiveness. Focus on change readiness, communication effectiveness, and implementation capacity.`
    };

    return agentPrompts[domain] || `You are a business consultant analyzing the ${domain} domain.`;
  }

  async validateAssessmentCompleteness(assessment: Assessment): Promise<AssessmentValidation> {
    const errors: AssessmentValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const requiredFieldsMissing: string[] = [];

    // Define minimum required questions per domain
    const DOMAIN_REQUIREMENTS: Record<DomainName, string[]> = {
      'strategic-alignment': ['1.1', '1.2', '1.3', '1.4', '1.5', '1.6'],
      'financial-management': ['2.1', '2.2', '2.3', '2.4', '2.5', '2.6', '2.7'],
      'revenue-engine': ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7'],
      'operational-excellence': ['4.1', '4.2', '4.3', '4.4', '4.5', '4.6', '4.7'],
      'people-organization': ['5.1', '5.2', '5.3', '5.4', '5.5', '5.6', '5.7'],
      'technology-data': ['6.1', '6.2', '6.3', '6.4', '6.5', '6.6', '6.7'],
      'customer-experience': ['7.1', '7.2', '7.3', '7.4', '7.5', '7.6', '7.7'],
      'supply-chain': ['8.1', '8.2', '8.3', '8.4', '8.5'],
      'risk-compliance': ['9.1', '9.2', '9.3', '9.4', '9.5', '9.6'],
      'partnerships': ['10.1', '10.2', '10.3', '10.4', '10.5', '10.6'],
      'customer-success': ['11.1', '11.2', '11.3', '11.4', '11.5', '11.6'],
      'change-management': ['12.1', '12.2', '12.3', '12.4', '12.5', '12.6', '12.7']
    };

    let totalRequiredQuestions = 0;
    let answeredRequiredQuestions = 0;

    // Check each domain
    Object.entries(DOMAIN_REQUIREMENTS).forEach(([domain, requiredQuestions]) => {
      const domainName = domain as DomainName;
      const domainResponse = assessment.domainResponses[domainName];

      totalRequiredQuestions += requiredQuestions.length;

      if (!domainResponse) {
        // Entire domain missing
        requiredQuestions.forEach(qId => {
          requiredFieldsMissing.push(`${domain}.${qId}`);
          errors.push({
            field: `${domain}.${qId}`,
            message: `Required question ${qId} in ${domain} domain not answered`,
            type: 'required'
          });
        });
        return;
      }

      // Check individual required questions
      requiredQuestions.forEach(questionId => {
        const response = domainResponse.questions[questionId];
        if (!response || response.value === null || response.value === undefined || response.value === '') {
          requiredFieldsMissing.push(`${domain}.${questionId}`);
          errors.push({
            field: `${domain}.${questionId}`,
            message: `Required question ${questionId} in ${domain} domain not answered`,
            type: 'required'
          });
        } else {
          answeredRequiredQuestions++;
        }
      });

      // Check domain completeness
      const domainCompleteness = domainResponse.completeness || 0;
      if (domainCompleteness < 60) {
        warnings.push({
          field: domain,
          message: `${domain} domain only ${domainCompleteness}% complete. Consider completing more questions for better analysis.`,
          type: 'completeness'
        });
      }
    });

    // Calculate overall completeness
    const overallCompleteness = totalRequiredQuestions > 0 ?
      Math.round((answeredRequiredQuestions / totalRequiredQuestions) * 100) : 0;

    // Add overall completeness warnings
    if (overallCompleteness < 70) {
      warnings.push({
        field: 'overall',
        message: `Overall completeness (${overallCompleteness}%) below minimum threshold for submission (70%)`,
        type: 'quality'
      });
    } else if (overallCompleteness < 85) {
      warnings.push({
        field: 'overall',
        message: `Overall completeness (${overallCompleteness}%) below recommended threshold (85%) for comprehensive analysis`,
        type: 'quality'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness: overallCompleteness,
      requiredFieldsMissing,
      crossDomainInconsistencies: []
    };
  }

  async getDomainTemplates(): Promise<Record<DomainName, DomainTemplate>> {
    // This would typically load from a database or external service
    // For now, return basic templates
    const domains: DomainName[] = [
      'strategic-alignment', 'financial-management', 'revenue-engine',
      'operational-excellence', 'people-organization', 'technology-data',
      'customer-experience', 'supply-chain', 'risk-compliance',
      'partnerships', 'customer-success', 'change-management'
    ];

    const templates: Record<DomainName, DomainTemplate> = {} as Record<DomainName, DomainTemplate>;

    // This is a simplified version - in production, you'd load full templates from storage
    domains.forEach(domain => {
      templates[domain] = {
        domain,
        title: this.getDomainTitle(domain),
        description: this.getDomainDescription(domain),
        questions: this.getBasicQuestions(domain),
        industrySpecific: {
          regulated: {
            additionalQuestions: [],
            requiredFields: []
          },
          nonRegulated: {
            skipQuestions: []
          }
        },
        companyStageVariations: {
          startup: { focusAreas: [] },
          growth: { focusAreas: [] },
          mature: { focusAreas: [] }
        },
        scoringRules: {
          triggerThreshold: 4.0,
          criticalThreshold: 4.5,
          weightingFactors: {}
        }
      };
    });

    return templates;
  }

  private getDomainTitle(domain: DomainName): string {
    const titles: Record<DomainName, string> = {
      'strategic-alignment': 'Strategic Alignment & Vision',
      'financial-management': 'Financial Management & Capital Efficiency',
      'revenue-engine': 'Revenue Engine & Growth Systems',
      'operational-excellence': 'Operational Excellence & Process Management',
      'people-organization': 'People & Organizational Development',
      'technology-data': 'Technology & Data Infrastructure',
      'customer-experience': 'Customer Experience & Product Development',
      'supply-chain': 'Supply Chain & Operations',
      'risk-compliance': 'Risk Management & Compliance',
      'partnerships': 'External Partnerships & Ecosystem',
      'customer-success': 'Customer Success & Growth',
      'change-management': 'Change Management & Implementation'
    };
    return titles[domain];
  }

  private getDomainDescription(domain: DomainName): string {
    const descriptions: Record<DomainName, string> = {
      'strategic-alignment': 'Assess how well your organization aligns strategy across all levels and adapts to market changes.',
      'financial-management': 'Evaluate financial planning, cash flow management, and capital efficiency practices.',
      'revenue-engine': 'Analyze sales processes, customer acquisition, and revenue growth systems.',
      'operational-excellence': 'Review process management, efficiency, and scalability of operations.',
      'people-organization': 'Examine talent management, culture, and organizational development capabilities.',
      'technology-data': 'Assess technology infrastructure, data management, and digital capabilities.',
      'customer-experience': 'Evaluate customer satisfaction, product development, and experience optimization.',
      'supply-chain': 'Review supply chain efficiency, vendor relationships, and operational resilience.',
      'risk-compliance': 'Analyze risk management practices and regulatory compliance capabilities.',
      'partnerships': 'Assess strategic partnerships, ecosystem integration, and external relationships.',
      'customer-success': 'Evaluate customer lifecycle management, retention, and expansion strategies.',
      'change-management': 'Review organizational change capabilities and implementation effectiveness.'
    };
    return descriptions[domain];
  }

  private getBasicQuestions(domain: DomainName): Question[] {
    // This would load from the comprehensive question database
    // For now, return a basic template question
    return [
      {
        id: `${domain}-1`,
        type: 'scale',
        question: `How would you rate your organization's current performance in ${domain.replace('-', ' ')}?`,
        scale: {
          min: 1,
          max: 5,
          labels: ['Poor', 'Excellent']
        },
        required: true
      }
    ];
  }
}