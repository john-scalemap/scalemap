import { DynamoDBClient, PutItemCommand, QueryCommand, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import {
  Assessment,
  DomainName,
  DomainResponse,
  QuestionResponse
} from '@scalemap/shared';
import {
  GapAnalysis,
  GapAnalysisRequest,
  GapAnalysisResponse,
  AssessmentGap,
  DomainCompletenessAnalysis,
  ConflictingResponse,
  GapCategory,
  GapScoringConfig,
  IndustrySpecificGap,
  GapRecommendation,
  GapResolutionRequest,
  GapResolutionResponse,
  BulkGapResolutionRequest,
  BulkGapResolutionResponse,
  GapTrackingEntity
} from '@scalemap/shared';
import { v4 as uuidv4 } from 'uuid';

import { FounderNotificationService } from './founder-notification-service';
import { OpenAIService } from './openai-service';
import { TimelineManager } from './timeline-manager';

export class GapAnalysisService {
  private dynamoDb: DynamoDBClient;
  private tableName: string;
  private openAIService: OpenAIService;
  private timelineManager: TimelineManager;
  private founderNotificationService: FounderNotificationService;

  // Default scoring configuration
  private readonly defaultScoringConfig: GapScoringConfig = {
    domainWeights: {
      'strategic-alignment': 1.2,
      'financial-management': 1.3,
      'revenue-engine': 1.3,
      'operational-excellence': 1.1,
      'people-organization': 1.1,
      'technology-data': 1.0,
      'customer-experience': 1.2,
      'supply-chain': 0.9,
      'risk-compliance': 1.4,
      'partnerships': 0.8,
      'customer-success': 1.1,
      'change-management': 1.0
    },
    questionTypeWeights: {
      'multiple-choice': 0.8,
      'scale': 1.0,
      'text': 1.3,
      'number': 1.1,
      'boolean': 0.7,
      'multiple-select': 1.0
    },
    responseQualityFactors: {
      lengthMinimum: 10,
      depthIndicators: ['because', 'specifically', 'for example', 'such as', 'including'],
      qualityKeywords: ['implement', 'process', 'system', 'strategy', 'approach', 'methodology']
    },
    conflictDetectionRules: {
      crossDomainValidation: true,
      temporalConsistency: true,
      logicalConsistency: true
    }
  };

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
    this.timelineManager = new TimelineManager();
    this.founderNotificationService = new FounderNotificationService();
  }

  /**
   * Analyze assessment for gaps and completeness issues
   */
  async analyzeGaps(request: GapAnalysisRequest): Promise<GapAnalysisResponse> {
    const startTime = Date.now();
    console.log(`Starting gap analysis for assessment ${request.assessmentId}`);

    try {
      // Get assessment data
      const assessment = await this.getAssessment(request.assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }

      // Check if we need to reanalyze or can use cached results
      if (!request.forceReanalysis && assessment.gapAnalysis) {
        const existingAnalysis = assessment.gapAnalysis;
        const lastAnalyzed = new Date(existingAnalysis.lastAnalyzedAt);
        const hoursSinceAnalysis = (Date.now() - lastAnalyzed.getTime()) / (1000 * 60 * 60);

        if (hoursSinceAnalysis < 2) { // Use cached results if less than 2 hours old
          return {
            assessmentId: request.assessmentId,
            gapAnalysis: existingAnalysis,
            processingTime: Date.now() - startTime,
            modelUsed: 'cached',
            costEstimate: 0,
            recommendations: await this.generateRecommendations(existingAnalysis)
          };
        }
      }

      // Perform fresh gap analysis
      const gapAnalysis = await this.performGapAnalysis(assessment, request);

      // Store results in assessment
      await this.updateAssessmentWithGapAnalysis(request.assessmentId, gapAnalysis);

      // Store detailed gap tracking entities
      await this.storeGapTrackingEntities(request.assessmentId, gapAnalysis.detectedGaps);

      const processingTime = Date.now() - startTime;
      const recommendations = await this.generateRecommendations(gapAnalysis);

      console.log(`Gap analysis completed for assessment ${request.assessmentId}: ${gapAnalysis.totalGapsCount} gaps detected (${gapAnalysis.criticalGapsCount} critical)`);

      // Check if timeline pause is needed for critical gaps
      const criticalGaps = gapAnalysis.detectedGaps.filter(gap => gap.category === 'critical');
      if (criticalGaps.length > 0) {
        console.log(`Pausing timeline for assessment ${request.assessmentId} due to ${criticalGaps.length} critical gaps`);
        try {
          await this.timelineManager.pauseForCriticalGaps(request.assessmentId, criticalGaps, 'system');

          // Send founder notification for critical gaps
          await this.founderNotificationService.evaluateCriticalGapsNotification(assessment, criticalGaps);
        } catch (error) {
          console.error(`Failed to pause timeline for assessment ${request.assessmentId}:`, error);
          // Continue processing even if timeline pause fails
        }
      }

      return {
        assessmentId: request.assessmentId,
        gapAnalysis,
        processingTime,
        modelUsed: 'gpt-4o-mini', // Cost-optimized for gap analysis
        costEstimate: this.estimateCost(gapAnalysis.totalGapsCount),
        recommendations
      };

    } catch (error) {
      console.error('Gap analysis failed:', error);
      throw error;
    }
  }

  /**
   * Core gap analysis logic
   */
  private async performGapAnalysis(assessment: Assessment, request: GapAnalysisRequest): Promise<GapAnalysis> {
    const analysisVersion = `v${Date.now()}`;
    const allGaps: AssessmentGap[] = [];
    const domainCompleteness: Record<DomainName, DomainCompletenessAnalysis> = {} as Record<DomainName, DomainCompletenessAnalysis>;

    // Define domains to analyze
    const domainsToAnalyze = request.focusDomains || this.getAllDomains();

    // Analyze each domain
    for (const domain of domainsToAnalyze) {
      const domainAnalysis = await this.analyzeDomainCompleteness(
        domain,
        assessment.domainResponses[domain],
        assessment,
        request.analysisDepth
      );

      domainCompleteness[domain] = domainAnalysis;
      allGaps.push(...domainAnalysis.identifiedGaps);
    }

    // Detect cross-domain conflicts
    const crossDomainConflicts = await this.detectCrossDomainConflicts(assessment);

    // Convert conflicts to gaps
    const conflictGaps = await this.convertConflictsToGaps(assessment.id, crossDomainConflicts);
    allGaps.push(...conflictGaps);

    // Analyze industry-specific gaps
    const industryGaps = await this.analyzeIndustrySpecificGaps(assessment);

    // Calculate overall completeness score
    const overallScore = this.calculateOverallCompletenessScore(domainCompleteness);

    // Sort and prioritize gaps
    const prioritizedGaps = this.prioritizeGaps(allGaps);

    const gapAnalysis: GapAnalysis = {
      overallCompletenessScore: overallScore,
      domainCompleteness,
      industrySpecificGaps: industryGaps,
      lastAnalyzedAt: new Date().toISOString(),
      analysisVersion,
      detectedGaps: prioritizedGaps,
      criticalGapsCount: prioritizedGaps.filter(gap => gap.category === 'critical').length,
      totalGapsCount: prioritizedGaps.length
    };

    return gapAnalysis;
  }

  /**
   * Analyze completeness for a specific domain
   */
  private async analyzeDomainCompleteness(
    domain: DomainName,
    domainResponse: DomainResponse | undefined,
    assessment: Assessment,
    analysisDepth: 'quick' | 'standard' | 'comprehensive'
  ): Promise<DomainCompletenessAnalysis> {
    const gaps: AssessmentGap[] = [];
    const conflictingResponses: ConflictingResponse[] = [];

    if (!domainResponse) {
      // Entire domain missing
      gaps.push({
        gapId: uuidv4(),
        assessmentId: assessment.id,
        domain,
        category: 'critical',
        description: `Complete ${domain} domain assessment is missing`,
        detectedAt: new Date().toISOString(),
        suggestedQuestions: [`Please complete all questions in the ${domain.replace('-', ' ')} domain`],
        followUpPrompts: [
          `Why haven't you completed the ${domain.replace('-', ' ')} assessment?`,
          'Are there specific challenges preventing you from answering these questions?'
        ],
        resolved: false,
        impactOnTimeline: true,
        priority: 10,
        estimatedResolutionTime: 30
      });

      return {
        score: 0,
        identifiedGaps: gaps,
        dataQualityScore: 0,
        responseDepthScore: 0,
        consistencyScore: 0,
        missingCriticalQuestions: this.getCriticalQuestionsForDomain(domain),
        conflictingResponses
      };
    }

    // Analyze question completeness
    const criticalQuestions = this.getCriticalQuestionsForDomain(domain);
    const missingCritical: string[] = [];

    criticalQuestions.forEach(questionId => {
      const response = domainResponse.questions[questionId];
      if (!response || this.isResponseEmpty(response)) {
        missingCritical.push(questionId);
        gaps.push({
          gapId: uuidv4(),
          assessmentId: assessment.id,
          domain,
          category: 'critical',
          description: `Missing response to critical question ${questionId}`,
          detectedAt: new Date().toISOString(),
          suggestedQuestions: [`Could you provide more detail about question ${questionId}?`],
          followUpPrompts: [
            `Please provide more details about ${this.getQuestionContext(domain, questionId)}`,
            'This information is critical for accurate analysis'
          ],
          resolved: false,
          impactOnTimeline: true,
          priority: 9,
          estimatedResolutionTime: 10
        });
      }
    });

    // Analyze response quality
    const qualityGaps = await this.analyzeResponseQuality(assessment.id, domain, domainResponse, analysisDepth);
    gaps.push(...qualityGaps);

    // Detect intra-domain conflicts
    const intraDomainConflicts = await this.detectIntraDomainConflicts(domain, domainResponse);
    conflictingResponses.push(...intraDomainConflicts);

    // Calculate scores
    const domainScore = this.calculateDomainCompletenessScore(domain, domainResponse, gaps.length);
    const qualityScore = this.calculateDataQualityScore(domainResponse);
    const depthScore = this.calculateResponseDepthScore(domainResponse);
    const consistencyScore = this.calculateConsistencyScore(intraDomainConflicts);

    return {
      score: domainScore,
      identifiedGaps: gaps,
      dataQualityScore: qualityScore,
      responseDepthScore: depthScore,
      consistencyScore,
      missingCriticalQuestions: missingCritical,
      conflictingResponses: intraDomainConflicts
    };
  }

  /**
   * Analyze response quality using AI when needed
   */
  private async analyzeResponseQuality(
    assessmentId: string,
    domain: DomainName,
    domainResponse: DomainResponse,
    analysisDepth: 'quick' | 'standard' | 'comprehensive'
  ): Promise<AssessmentGap[]> {
    const gaps: AssessmentGap[] = [];

    if (analysisDepth === 'quick') {
      return gaps; // Skip quality analysis for quick mode
    }

    // First, check for basic quality issues
    for (const [questionId, response] of Object.entries(domainResponse.questions)) {
      if (response.value && typeof response.value === 'string') {
        const text = response.value as string;

        // Check for very short responses to open-ended questions
        if (text.length < this.defaultScoringConfig.responseQualityFactors.lengthMinimum) {
          const intelligentQuestions = await this.generateIntelligentFollowUpQuestions(
            domain,
            questionId,
            text,
            'brief_response'
          );

          gaps.push({
            gapId: uuidv4(),
            assessmentId,
            domain,
            category: 'important',
            description: `Response to question ${questionId} appears too brief for thorough analysis`,
            detectedAt: new Date().toISOString(),
            suggestedQuestions: intelligentQuestions.questions,
            followUpPrompts: intelligentQuestions.prompts,
            resolved: false,
            impactOnTimeline: false,
            priority: 6,
            estimatedResolutionTime: 15
          });
        }

        // Check for lack of depth indicators
        const hasDepthIndicators = this.defaultScoringConfig.responseQualityFactors.depthIndicators
          .some(indicator => text.toLowerCase().includes(indicator));

        if (!hasDepthIndicators && text.length > 20) {
          const intelligentQuestions = await this.generateIntelligentFollowUpQuestions(
            domain,
            questionId,
            text,
            'lacks_depth'
          );

          gaps.push({
            gapId: uuidv4(),
            assessmentId,
            domain,
            category: 'nice-to-have',
            description: `Response to question ${questionId} could benefit from more specific examples`,
            detectedAt: new Date().toISOString(),
            suggestedQuestions: intelligentQuestions.questions,
            followUpPrompts: intelligentQuestions.prompts,
            resolved: false,
            impactOnTimeline: false,
            priority: 4,
            estimatedResolutionTime: 10
          });
        }

        // Use AI for comprehensive analysis to detect more nuanced gaps
        if (analysisDepth === 'comprehensive') {
          const aiGeneratedGaps = await this.performAIGapAnalysis(
            assessmentId,
            domain,
            questionId,
            text
          );
          gaps.push(...aiGeneratedGaps);
        }
      }
    }

    return gaps;
  }

  /**
   * Generate intelligent follow-up questions using OpenAI
   */
  private async generateIntelligentFollowUpQuestions(
    domain: DomainName,
    questionId: string,
    originalResponse: string,
    gapType: 'brief_response' | 'lacks_depth' | 'conflicting' | 'missing_context'
  ): Promise<{ questions: string[], prompts: string[] }> {
    try {
      const prompt = this.buildFollowUpQuestionPrompt(domain, questionId, originalResponse, gapType);

      const response = await this.openAIService.generateCompletion(prompt, {
        model: 'gpt-4o-mini', // Cost-optimized for question generation
        maxTokens: 300,
        temperature: 0.8 // Higher creativity for question generation
      });

      return this.parseFollowUpQuestionResponse(response, gapType);

    } catch (error) {
      console.warn('Failed to generate intelligent follow-up questions, using fallbacks:', error);
      return this.getFallbackQuestions(gapType);
    }
  }

  /**
   * Perform AI-powered gap analysis for comprehensive mode
   */
  private async performAIGapAnalysis(
    assessmentId: string,
    domain: DomainName,
    questionId: string,
    response: string
  ): Promise<AssessmentGap[]> {
    try {
      const prompt = this.buildAIGapAnalysisPrompt(domain, questionId, response);

      const aiResponse = await this.openAIService.generateCompletion(prompt, {
        model: 'gpt-4o-mini',
        maxTokens: 500,
        temperature: 0.7
      });

      const aiAnalysis = this.parseAIGapAnalysisResponse(aiResponse);

      const gaps: AssessmentGap[] = [];

      if (aiAnalysis.hasGaps) {
        for (const gap of aiAnalysis.identifiedGaps) {
          gaps.push({
            gapId: uuidv4(),
            assessmentId,
            domain,
            category: gap.severity as GapCategory,
            description: gap.description,
            detectedAt: new Date().toISOString(),
            suggestedQuestions: gap.suggestedQuestions,
            followUpPrompts: gap.followUpPrompts,
            resolved: false,
            impactOnTimeline: gap.severity === 'critical',
            priority: gap.severity === 'critical' ? 8 : gap.severity === 'important' ? 5 : 3,
            estimatedResolutionTime: gap.estimatedTime || 15
          });
        }
      }

      return gaps;

    } catch (error) {
      console.warn('AI gap analysis failed, skipping:', error);
      return [];
    }
  }

  /**
   * Build prompt for follow-up question generation
   */
  private buildFollowUpQuestionPrompt(
    domain: DomainName,
    questionId: string,
    originalResponse: string,
    gapType: string
  ): string {
    const domainContext = this.getDomainContext(domain);
    const gapContext = this.getGapTypeContext(gapType);

    return `You are an expert business consultant analyzing a client's response to an assessment question.

DOMAIN: ${domain.replace('-', ' ')} - ${domainContext}
QUESTION ID: ${questionId}
ORIGINAL RESPONSE: "${originalResponse}"
GAP TYPE: ${gapContext}

Your task is to generate 2-3 intelligent follow-up questions that will help gather the missing information needed for thorough analysis.

Requirements:
1. Questions should be specific and actionable
2. Questions should relate directly to the domain expertise
3. Questions should help uncover deeper insights
4. Include supportive prompts that encourage detailed responses

Format your response as JSON:
{
  "questions": ["Question 1", "Question 2", "Question 3"],
  "prompts": ["Encouraging prompt 1", "Encouraging prompt 2"]
}

Focus on practical, business-relevant questions that will help us provide better recommendations.`;
  }

  /**
   * Build prompt for AI gap analysis
   */
  private buildAIGapAnalysisPrompt(domain: DomainName, questionId: string, response: string): string {
    const domainContext = this.getDomainContext(domain);

    return `You are an expert business consultant analyzing client responses for information gaps.

DOMAIN: ${domain.replace('-', ' ')} - ${domainContext}
QUESTION ID: ${questionId}
CLIENT RESPONSE: "${response}"

Analyze this response for potential information gaps that could impact business analysis quality.

Consider:
1. Missing critical business context
2. Lack of specific metrics or examples
3. Contradictions or inconsistencies
4. Insufficient detail for actionable recommendations

Format your response as JSON:
{
  "hasGaps": boolean,
  "identifiedGaps": [
    {
      "description": "Brief description of the gap",
      "severity": "critical|important|nice-to-have",
      "suggestedQuestions": ["Question 1", "Question 2"],
      "followUpPrompts": ["Prompt 1", "Prompt 2"],
      "estimatedTime": 15
    }
  ]
}

Only identify genuine gaps that would improve analysis quality. Be conservative.`;
  }

  /**
   * Parse follow-up question response from OpenAI
   */
  private parseFollowUpQuestionResponse(response: string, gapType: string = 'general'): { questions: string[], prompts: string[] } {
    try {
      const parsed = JSON.parse(response);
      return {
        questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [],
        prompts: Array.isArray(parsed.prompts) ? parsed.prompts.slice(0, 2) : []
      };
    } catch (error) {
      console.warn('Failed to parse follow-up question response:', error);
      return this.getFallbackQuestions(gapType);
    }
  }

  /**
   * Parse AI gap analysis response
   */
  private parseAIGapAnalysisResponse(response: string): any {
    try {
      return JSON.parse(response);
    } catch (error) {
      console.warn('Failed to parse AI gap analysis response:', error);
      return { hasGaps: false, identifiedGaps: [] };
    }
  }

  /**
   * Get domain context for prompts
   */
  private getDomainContext(domain: DomainName): string {
    const contexts: Record<DomainName, string> = {
      'strategic-alignment': 'Strategic vision, market positioning, and organizational alignment',
      'financial-management': 'Financial planning, cash flow, budgeting, and capital allocation',
      'revenue-engine': 'Sales processes, customer acquisition, and revenue growth systems',
      'operational-excellence': 'Process efficiency, quality management, and operational scalability',
      'people-organization': 'Talent management, organizational culture, and team development',
      'technology-data': 'Technology infrastructure, data management, and digital capabilities',
      'customer-experience': 'Customer satisfaction, product development, and experience optimization',
      'supply-chain': 'Supply chain efficiency, vendor relationships, and procurement',
      'risk-compliance': 'Risk management, regulatory compliance, and governance',
      'partnerships': 'Strategic partnerships, ecosystem development, and external relationships',
      'customer-success': 'Customer lifecycle management, retention, and expansion',
      'change-management': 'Organizational change capabilities and implementation effectiveness'
    };
    return contexts[domain] || 'Business operations and management';
  }

  /**
   * Get gap type context for prompts
   */
  private getGapTypeContext(gapType: string): string {
    const contexts: Record<string, string> = {
      'brief_response': 'The response is too brief and lacks sufficient detail for analysis',
      'lacks_depth': 'The response lacks specific examples and depth indicators',
      'conflicting': 'The response conflicts with other provided information',
      'missing_context': 'Important business context is missing from the response',
      'general': 'General information gap requiring clarification'
    };
    return (contexts as any)[gapType] || contexts['general'];
  }

  /**
   * Get fallback questions when AI generation fails
   */
  private getFallbackQuestions(gapType: string): { questions: string[], prompts: string[] } {
    const fallbacks: Record<string, { questions: string[], prompts: string[] }> = {
      'brief_response': {
        questions: [
          'Could you provide more specific details about your current approach?',
          'What specific challenges have you encountered in this area?',
          'Can you share any examples or metrics that illustrate this?'
        ],
        prompts: [
          'Please elaborate with specific examples and details',
          'Additional context will help us provide better recommendations'
        ]
      },
      'lacks_depth': {
        questions: [
          'What specific processes or systems do you have in place?',
          'How do you measure success in this area?',
          'What are the main challenges you face?'
        ],
        prompts: [
          'Specific examples would be very helpful',
          'Please share how this works in practice at your organization'
        ]
      },
      'general': {
        questions: [
          'Could you provide more detail about this area?',
          'What additional context would be helpful to share?'
        ],
        prompts: [
          'Any additional information would be valuable',
          'Please share whatever details you think would be relevant'
        ]
      }
    };

    return (fallbacks as any)[gapType] || fallbacks['general'];
  }

  /**
   * Detect conflicts within a single domain
   */
  private async detectIntraDomainConflicts(domain: DomainName, domainResponse: DomainResponse): Promise<ConflictingResponse[]> {
    const conflicts: ConflictingResponse[] = [];

    // Domain-specific conflict detection rules
    const conflictRules = this.getDomainConflictRules(domain);

    for (const rule of conflictRules) {
      const conflict = this.checkConflictRule(rule, domainResponse);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Detect conflicts across multiple domains
   */
  private async detectCrossDomainConflicts(assessment: Assessment): Promise<ConflictingResponse[]> {
    const conflicts: ConflictingResponse[] = [];

    // Example: Financial management vs Revenue engine conflicts
    const financialResponse = assessment.domainResponses['financial-management'];
    const revenueResponse = assessment.domainResponses['revenue-engine'];

    if (financialResponse && revenueResponse) {
      // Check for revenue growth vs financial constraints conflicts
      const revenueGrowthAnswer = revenueResponse.questions['3.1']?.value;
      const budgetConstraintsAnswer = financialResponse.questions['2.3']?.value;

      if (revenueGrowthAnswer === 'aggressive' && budgetConstraintsAnswer === 'severely-limited') {
        conflicts.push({
          questionIds: ['financial-management.2.3', 'revenue-engine.3.1'],
          conflictDescription: 'Aggressive revenue growth plans conflict with severe budget limitations',
          severity: 'major',
          suggestedResolution: 'Please clarify how aggressive growth will be funded with limited budget'
        });
      }
    }

    return conflicts;
  }

  /**
   * Analyze industry-specific compliance gaps
   */
  private async analyzeIndustrySpecificGaps(assessment: Assessment): Promise<IndustrySpecificGap[]> {
    const industryGaps: IndustrySpecificGap[] = [];

    if (!assessment.industryClassification) {
      return industryGaps;
    }

    const { sector, regulatoryClassification } = assessment.industryClassification;

    // Financial services specific requirements
    if (sector === 'financial-services' && regulatoryClassification === 'heavily-regulated') {
      industryGaps.push({
        regulation: 'FCA Compliance',
        requirements: [
          'Risk management framework documentation',
          'Customer due diligence procedures',
          'Anti-money laundering controls',
          'Data protection and GDPR compliance'
        ],
        complianceLevel: this.assessFinancialCompliance(assessment),
        mandatoryFields: ['risk-compliance.9.1', 'risk-compliance.9.2', 'risk-compliance.9.3'],
        recommendedFields: ['risk-compliance.9.4', 'risk-compliance.9.5'],
        riskLevel: 'high'
      });
    }

    // Healthcare specific requirements
    if (sector === 'healthcare') {
      industryGaps.push({
        regulation: 'HIPAA/GDPR Healthcare',
        requirements: [
          'Patient data protection measures',
          'Healthcare data encryption',
          'Access control systems',
          'Audit trail capabilities'
        ],
        complianceLevel: this.assessHealthcareCompliance(assessment),
        mandatoryFields: ['technology-data.6.4', 'risk-compliance.9.2'],
        recommendedFields: ['technology-data.6.5', 'risk-compliance.9.6'],
        riskLevel: 'high'
      });
    }

    return industryGaps;
  }

  /**
   * Convert detected conflicts into actionable gaps
   */
  private async convertConflictsToGaps(assessmentId: string, conflicts: ConflictingResponse[]): Promise<AssessmentGap[]> {
    const gaps: AssessmentGap[] = [];

    for (const conflict of conflicts) {
      const category: GapCategory = conflict.severity === 'major' ? 'critical' :
                                   conflict.severity === 'moderate' ? 'important' : 'nice-to-have';

      // Generate intelligent questions for conflict resolution
      const firstQuestionId = conflict.questionIds[0];
      if (!firstQuestionId) {
        continue; // Skip conflicts without question IDs
      }
      const domain = this.extractDomainFromQuestionId(firstQuestionId);
      const intelligentQuestions = await this.generateConflictResolutionQuestions(
        domain,
        conflict
      );

      gaps.push({
        gapId: uuidv4(),
        assessmentId,
        domain,
        category,
        description: `Conflicting responses detected: ${conflict.conflictDescription}`,
        detectedAt: new Date().toISOString(),
        suggestedQuestions: intelligentQuestions.questions,
        followUpPrompts: intelligentQuestions.prompts,
        resolved: false,
        impactOnTimeline: category === 'critical',
        priority: category === 'critical' ? 8 : category === 'important' ? 6 : 4,
        estimatedResolutionTime: 20
      });
    }

    return gaps;
  }

  /**
   * Generate conflict resolution questions using AI
   */
  private async generateConflictResolutionQuestions(
    domain: DomainName,
    conflict: ConflictingResponse
  ): Promise<{ questions: string[], prompts: string[] }> {
    try {
      const prompt = this.buildConflictResolutionPrompt(domain, conflict);

      const response = await this.openAIService.generateCompletion(prompt, {
        model: 'gpt-4o-mini',
        maxTokens: 300,
        temperature: 0.7
      });

      return this.parseFollowUpQuestionResponse(response, 'general');

    } catch (error) {
      console.warn('Failed to generate conflict resolution questions, using fallbacks:', error);
      return {
        questions: [
          conflict.suggestedResolution,
          'Please clarify this apparent contradiction',
          'How do you reconcile these different aspects of your organization?'
        ],
        prompts: [
          'Understanding this will help us provide more accurate recommendations',
          'Please provide additional context to resolve this inconsistency'
        ]
      };
    }
  }

  /**
   * Build prompt for conflict resolution questions
   */
  private buildConflictResolutionPrompt(domain: DomainName, conflict: ConflictingResponse): string {
    const domainContext = this.getDomainContext(domain);

    return `You are an expert business consultant helping resolve conflicting information in an assessment.

DOMAIN: ${domain.replace('-', ' ')} - ${domainContext}
CONFLICTING QUESTIONS: ${conflict.questionIds.join(', ')}
CONFLICT DESCRIPTION: ${conflict.conflictDescription}
SEVERITY: ${conflict.severity}

Your task is to generate 2-3 thoughtful questions that will help the client clarify and resolve this contradiction.

Requirements:
1. Questions should be non-confrontational and supportive
2. Questions should help uncover the underlying business reality
3. Questions should acknowledge that both aspects might be partially true
4. Focus on understanding context and nuance

Format your response as JSON:
{
  "questions": ["Question 1", "Question 2", "Question 3"],
  "prompts": ["Supportive prompt 1", "Supportive prompt 2"]
}

Help the client explain how both aspects of the apparent conflict might coexist or which is more accurate.`;
  }

  /**
   * Prioritize gaps based on impact and category
   */
  private prioritizeGaps(gaps: AssessmentGap[]): AssessmentGap[] {
    return gaps.sort((a, b) => {
      // Sort by priority (higher first), then by category, then by domain importance
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      const categoryOrder = { 'critical': 3, 'important': 2, 'nice-to-have': 1 };
      if (a.category !== b.category) {
        return categoryOrder[b.category] - categoryOrder[a.category];
      }

      const domainWeight = this.defaultScoringConfig.domainWeights;
      return (domainWeight[b.domain] || 1) - (domainWeight[a.domain] || 1);
    });
  }

  /**
   * Resolve a specific gap with client response
   */
  async resolveGap(request: GapResolutionRequest): Promise<GapResolutionResponse> {
    try {
      // Get the gap
      const gap = await this.getGap(request.gapId);
      if (!gap) {
        throw new Error('Gap not found');
      }

      if (request.skipGap) {
        // Mark gap as resolved without processing response
        await this.markGapResolved(request.gapId, 'founder-override');
        return {
          gapId: request.gapId,
          resolved: true,
          impactOnCompleteness: 0,
          message: 'Gap marked as resolved by user'
        };
      }

      // Process the client response
      const updatedGap: Partial<AssessmentGap> = {
        clientResponse: request.clientResponse,
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolutionMethod: 'client-input'
      };

      await this.updateGap(request.gapId, updatedGap);

      // Analyze if the response creates new gaps
      const newGaps = await this.analyzeResponseForNewGaps(gap, request.clientResponse);

      // Calculate impact on completeness
      const impactOnCompleteness = this.calculateCompletenessImpact(gap, request.clientResponse);

      // Check if timeline should be resumed after gap resolution
      if (gap.category === 'critical') {
        console.log(`Critical gap ${request.gapId} resolved, checking timeline resume conditions`);
        try {
          await this.timelineManager.resumeAfterGapResolution(gap.assessmentId, [request.gapId], 'system');
        } catch (error) {
          console.error(`Failed to resume timeline after gap resolution:`, error);
          // Continue processing even if timeline resume fails
        }
      }

      return {
        gapId: request.gapId,
        resolved: true,
        newGaps,
        impactOnCompleteness,
        message: 'Gap resolved successfully'
      };

    } catch (error) {
      console.error('Error resolving gap:', error);
      throw error;
    }
  }

  /**
   * Resolve multiple gaps in bulk
   */
  async resolveBulkGaps(request: BulkGapResolutionRequest): Promise<BulkGapResolutionResponse> {
    const results: BulkGapResolutionResponse = {
      assessmentId: request.assessmentId,
      processedCount: 0,
      resolvedCount: 0,
      newGapsCount: 0,
      overallCompletenessScore: 0,
      failedResolutions: []
    };

    for (const resolution of request.resolutions) {
      try {
        results.processedCount++;
        const result = await this.resolveGap(resolution);

        if (result.resolved) {
          results.resolvedCount++;
          if (result.newGaps) {
            results.newGapsCount += result.newGaps.length;
          }
        }
      } catch (error) {
        results.failedResolutions.push({
          gapId: resolution.gapId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Recalculate overall completeness
    const assessment = await this.getAssessment(request.assessmentId);
    if (assessment?.gapAnalysis) {
      results.overallCompletenessScore = assessment.gapAnalysis.overallCompletenessScore;
    }

    // Check if timeline should be resumed after bulk gap resolution
    const resolvedGapIds = request.resolutions
      .filter((_, index) => index < results.resolvedCount)
      .map(resolution => resolution.gapId);

    if (resolvedGapIds.length > 0) {
      console.log(`Bulk resolution completed, checking timeline resume for ${resolvedGapIds.length} gaps`);
      try {
        await this.timelineManager.resumeAfterGapResolution(request.assessmentId, resolvedGapIds, 'system');
      } catch (error) {
        console.error(`Failed to resume timeline after bulk gap resolution:`, error);
        // Continue processing even if timeline resume fails
      }
    }

    return results;
  }

  // Utility methods

  private getAllDomains(): DomainName[] {
    return [
      'strategic-alignment', 'financial-management', 'revenue-engine',
      'operational-excellence', 'people-organization', 'technology-data',
      'customer-experience', 'supply-chain', 'risk-compliance',
      'partnerships', 'customer-success', 'change-management'
    ];
  }

  private getCriticalQuestionsForDomain(domain: DomainName): string[] {
    const criticalQuestions: Record<DomainName, string[]> = {
      'strategic-alignment': ['1.1', '1.2', '1.3'],
      'financial-management': ['2.1', '2.2', '2.3', '2.4'],
      'revenue-engine': ['3.1', '3.2', '3.3'],
      'operational-excellence': ['4.1', '4.2', '4.3'],
      'people-organization': ['5.1', '5.2', '5.3'],
      'technology-data': ['6.1', '6.2', '6.3'],
      'customer-experience': ['7.1', '7.2', '7.3'],
      'supply-chain': ['8.1', '8.2'],
      'risk-compliance': ['9.1', '9.2', '9.3'],
      'partnerships': ['10.1', '10.2'],
      'customer-success': ['11.1', '11.2'],
      'change-management': ['12.1', '12.2']
    };
    return criticalQuestions[domain] || [];
  }

  private isResponseEmpty(response: QuestionResponse): boolean {
    const value = response.value;

    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (typeof value === 'number' && isNaN(value)) return true;
    if (Array.isArray(value) && value.length === 0) return true;

    return false;
  }

  private calculateDomainCompletenessScore(domain: DomainName, domainResponse: DomainResponse, gapCount: number): number {
    const criticalQuestions = this.getCriticalQuestionsForDomain(domain);
    const answeredCritical = criticalQuestions.filter(qId =>
      domainResponse.questions[qId] && !this.isResponseEmpty(domainResponse.questions[qId])
    ).length;

    const criticalScore = (answeredCritical / criticalQuestions.length) * 70; // Up to 70% for critical questions
    const gapPenalty = Math.min(gapCount * 5, 30); // Up to 30% penalty for gaps
    const qualityBonus = domainResponse.completeness ? (domainResponse.completeness * 0.3) : 0; // Up to 30% bonus

    return Math.max(0, Math.min(100, criticalScore - gapPenalty + qualityBonus));
  }

  private calculateDataQualityScore(domainResponse: DomainResponse): number {
    let totalScore = 0;
    let questionCount = 0;

    Object.values(domainResponse.questions).forEach(response => {
      questionCount++;
      if (typeof response.value === 'string') {
        const text = response.value as string;
        let questionScore = 50; // Base score

        // Length scoring
        if (text.length > 50) questionScore += 20;
        if (text.length > 100) questionScore += 15;

        // Depth indicators
        const depthCount = this.defaultScoringConfig.responseQualityFactors.depthIndicators
          .filter(indicator => text.toLowerCase().includes(indicator)).length;
        questionScore += Math.min(depthCount * 5, 15);

        totalScore += Math.min(questionScore, 100);
      } else {
        totalScore += 75; // Non-text responses get standard score
      }
    });

    return questionCount > 0 ? totalScore / questionCount : 0;
  }

  private calculateResponseDepthScore(domainResponse: DomainResponse): number {
    const responses = Object.values(domainResponse.questions);
    const textResponses = responses.filter(r => typeof r.value === 'string');

    if (textResponses.length === 0) return 75; // Default for non-text heavy domains

    const avgLength = textResponses.reduce((sum, r) => sum + (r.value as string).length, 0) / textResponses.length;
    const depthIndicatorCount = textResponses.reduce((count, r) => {
      const text = (r.value as string).toLowerCase();
      return count + this.defaultScoringConfig.responseQualityFactors.depthIndicators
        .filter(indicator => text.includes(indicator)).length;
    }, 0);

    const lengthScore = Math.min((avgLength / 100) * 50, 50);
    const depthScore = Math.min(depthIndicatorCount * 10, 50);

    return lengthScore + depthScore;
  }

  private calculateConsistencyScore(conflicts: ConflictingResponse[]): number {
    if (conflicts.length === 0) return 100;

    const majorConflicts = conflicts.filter(c => c.severity === 'major').length;
    const moderateConflicts = conflicts.filter(c => c.severity === 'moderate').length;
    const minorConflicts = conflicts.filter(c => c.severity === 'minor').length;

    const penalty = (majorConflicts * 30) + (moderateConflicts * 15) + (minorConflicts * 5);
    return Math.max(0, 100 - penalty);
  }

  private calculateOverallCompletenessScore(domainCompleteness: Record<DomainName, DomainCompletenessAnalysis>): number {
    const domains = Object.keys(domainCompleteness) as DomainName[];
    let weightedScore = 0;
    let totalWeight = 0;

    domains.forEach(domain => {
      const weight = this.defaultScoringConfig.domainWeights[domain] || 1;
      weightedScore += domainCompleteness[domain].score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  }

  private getDomainConflictRules(_domain: DomainName): any[] {
    // Return domain-specific conflict detection rules
    // This would be expanded with actual business logic
    return [];
  }

  private checkConflictRule(_rule: any, _domainResponse: DomainResponse): ConflictingResponse | null {
    // Implement rule checking logic
    return null;
  }

  private extractDomainFromQuestionId(questionId: string): DomainName {
    const parts = questionId.split('.');
    return parts[0] as DomainName;
  }

  private getQuestionText(domain: DomainName, questionId: string): string {
    // This would fetch the actual question text from the question database
    return `Question ${questionId} in ${domain.replace('-', ' ')} domain`;
  }

  private getQuestionContext(domain: DomainName, _questionId: string): string {
    // This would provide context for the question
    return `your ${domain.replace('-', ' ')} practices`;
  }

  private assessFinancialCompliance(assessment: Assessment): 'full' | 'partial' | 'missing' {
    const riskDomain = assessment.domainResponses['risk-compliance'];
    if (!riskDomain) return 'missing';

    const requiredQuestions = ['9.1', '9.2', '9.3'];
    const answeredCount = requiredQuestions.filter(qId =>
      riskDomain.questions[qId] && !this.isResponseEmpty(riskDomain.questions[qId])
    ).length;

    if (answeredCount === requiredQuestions.length) return 'full';
    if (answeredCount > 0) return 'partial';
    return 'missing';
  }

  private assessHealthcareCompliance(assessment: Assessment): 'full' | 'partial' | 'missing' {
    const techDomain = assessment.domainResponses['technology-data'];
    const riskDomain = assessment.domainResponses['risk-compliance'];

    if (!techDomain || !riskDomain) return 'missing';

    const requiredQuestions = ['6.4', '9.2'];
    let answeredCount = 0;

    if (techDomain.questions['6.4'] && !this.isResponseEmpty(techDomain.questions['6.4'])) answeredCount++;
    if (riskDomain.questions['9.2'] && !this.isResponseEmpty(riskDomain.questions['9.2'])) answeredCount++;

    if (answeredCount === requiredQuestions.length) return 'full';
    if (answeredCount > 0) return 'partial';
    return 'missing';
  }

  private estimateCost(gapCount: number): number {
    // Rough cost estimation for OpenAI usage
    const baseTokens = 500; // Base analysis tokens
    const perGapTokens = 50; // Additional tokens per gap
    const totalTokens = baseTokens + (gapCount * perGapTokens);

    // GPT-4o-mini pricing: ~$0.000150 per 1K tokens (input) + $0.000600 per 1K tokens (output)
    const avgCostPer1KTokens = 0.000375; // Average of input/output
    return (totalTokens / 1000) * avgCostPer1KTokens;
  }

  private async generateRecommendations(gapAnalysis: GapAnalysis): Promise<GapRecommendation[]> {
    const recommendations: GapRecommendation[] = [];

    // Generate recommendations based on detected gaps
    if (gapAnalysis.criticalGapsCount > 0) {
      recommendations.push({
        title: 'Address Critical Information Gaps',
        description: `You have ${gapAnalysis.criticalGapsCount} critical gaps that require immediate attention to ensure accurate analysis.`,
        suggestedActions: [
          'Review and complete all critical questions marked as missing',
          'Provide detailed responses to improve analysis quality',
          'Resolve any conflicting information identified'
        ],
        estimatedImpact: 'high',
        priority: 10,
        category: 'critical'
      });
    }

    if (gapAnalysis.overallCompletenessScore < 70) {
      recommendations.push({
        title: 'Improve Overall Assessment Completeness',
        description: `Your assessment is ${gapAnalysis.overallCompletenessScore}% complete. Consider providing more detailed responses.`,
        suggestedActions: [
          'Complete remaining questions in partially filled domains',
          'Provide more detailed explanations where possible',
          'Add specific examples to illustrate your points'
        ],
        estimatedImpact: 'medium',
        priority: 7,
        category: 'important'
      });
    }

    return recommendations;
  }

  // Database operations

  private async getAssessment(assessmentId: string): Promise<Assessment | null> {
    try {
      const params = {
        TableName: this.tableName,
        Key: marshall({
          PK: `ASSESSMENT#${assessmentId}`,
          SK: 'METADATA'
        })
      };

      const result = await this.dynamoDb.send(new GetItemCommand(params));

      if (!result.Item) {
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

  private async updateAssessmentWithGapAnalysis(assessmentId: string, gapAnalysis: GapAnalysis): Promise<void> {
    try {
      const params = {
        TableName: this.tableName,
        Key: marshall({
          PK: `ASSESSMENT#${assessmentId}`,
          SK: 'METADATA'
        }),
        UpdateExpression: 'SET gapAnalysis = :gapAnalysis, gapAnalysisCompletedAt = :completedAt, updatedAt = :updatedAt',
        ExpressionAttributeValues: marshall({
          ':gapAnalysis': gapAnalysis,
          ':completedAt': new Date().toISOString(),
          ':updatedAt': new Date().toISOString()
        })
      };

      await this.dynamoDb.send(new UpdateItemCommand(params));
    } catch (error) {
      console.error('Error updating assessment with gap analysis:', error);
      throw error;
    }
  }

  private async storeGapTrackingEntities(assessmentId: string, gaps: AssessmentGap[]): Promise<void> {
    const promises = gaps.map(gap => this.storeGapEntity(assessmentId, gap));
    await Promise.all(promises);
  }

  private async storeGapEntity(assessmentId: string, gap: AssessmentGap): Promise<void> {
    try {
      const entity: GapTrackingEntity = {
        PK: `ASSESSMENT#${assessmentId}`,
        SK: `GAP#${gap.gapId}`,
        GSI1PK: `GAP#${gap.category}`,
        GSI1SK: `PRIORITY#${gap.priority.toString().padStart(2, '0')}#${gap.detectedAt}`,
        GSI2PK: `GAP#${gap.resolved ? 'resolved' : 'pending'}`,
        GSI2SK: `CREATED#${gap.detectedAt}`,
        Data: gap,
        TTL: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
      };

      const params = {
        TableName: this.tableName,
        Item: marshall(entity, { removeUndefinedValues: true })
      };

      await this.dynamoDb.send(new PutItemCommand(params));
    } catch (error) {
      console.error('Error storing gap entity:', error);
      throw error;
    }
  }

  private async getGap(gapId: string): Promise<AssessmentGap | null> {
    try {
      // Query by GSI2 to find the gap
      const params = {
        TableName: this.tableName,
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :gapStatus',
        FilterExpression: 'contains(SK, :gapId)',
        ExpressionAttributeValues: marshall({
          ':gapStatus': 'GAP#pending',
          ':gapId': gapId
        }),
        Limit: 1
      };

      const result = await this.dynamoDb.send(new QueryCommand(params));

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const gapEntity = unmarshall(result.Items[0]!) as GapTrackingEntity;
      return gapEntity.Data;
    } catch (error) {
      console.error('Error getting gap:', error);
      throw error;
    }
  }

  private async updateGap(gapId: string, updates: Partial<AssessmentGap>): Promise<void> {
    try {
      // First find the gap's PK
      const gap = await this.getGap(gapId);
      if (!gap) {
        throw new Error('Gap not found');
      }

      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.entries(updates).forEach(([key, value]) => {
        updateExpressions.push(`#data.#${key} = :${key}`);
        expressionAttributeNames[`#data`] = 'Data';
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      });

      // Update GSI2PK if resolved status changed
      if (updates.resolved !== undefined) {
        updateExpressions.push('GSI2PK = :newGSI2PK');
        expressionAttributeValues[':newGSI2PK'] = `GAP#${updates.resolved ? 'resolved' : 'pending'}`;
      }

      const params = {
        TableName: this.tableName,
        Key: marshall({
          PK: `ASSESSMENT#${gap.assessmentId}`,
          SK: `GAP#${gapId}`
        }),
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: marshall(expressionAttributeValues)
      };

      await this.dynamoDb.send(new UpdateItemCommand(params));
    } catch (error) {
      console.error('Error updating gap:', error);
      throw error;
    }
  }

  private async markGapResolved(gapId: string, resolutionMethod: 'client-input' | 'auto-resolved' | 'founder-override'): Promise<void> {
    await this.updateGap(gapId, {
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolutionMethod
    });
  }

  private async analyzeResponseForNewGaps(_gap: AssessmentGap, _response: string): Promise<AssessmentGap[]> {
    // Placeholder for analyzing if a gap resolution creates new gaps
    // This would use OpenAI to analyze the response
    return [];
  }

  private calculateCompletenessImpact(gap: AssessmentGap, response: string): number {
    // Calculate how much the gap resolution improves completeness score
    const baseImpact = gap.category === 'critical' ? 5 : gap.category === 'important' ? 3 : 1;
    const responseQuality = response.length > 50 ? 1.2 : response.length > 20 ? 1.0 : 0.8;

    return Math.round(baseImpact * responseQuality);
  }
}