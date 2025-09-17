import {
  Assessment
} from '@scalemap/shared';
import {
  TriageAnalysis,
  DomainScore,
  IndustryContext,
  ProcessingMetrics,
  TriageValidationResult,
  TriageConfiguration
} from '@scalemap/shared/src/types/triage';
import OpenAI from 'openai';

export class TriageAnalyzer {
  private openai: OpenAI;
  private config: TriageConfiguration;
  private readonly ALGORITHM_VERSION = '1.0.0';

  constructor(config?: Partial<TriageConfiguration>) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      organization: process.env.OPENAI_ORGANIZATION_ID,
    });

    this.config = {
      algorithmVersion: this.ALGORITHM_VERSION,
      modelSelection: {
        primary: 'gpt-4o-mini',
        fallback: 'gpt-4o',
        costOptimized: 'gpt-4o-mini'
      },
      thresholds: {
        domainSelection: 4.0,
        confidenceMinimum: 0.7,
        dataCompletenessRequired: 0.6
      },
      industryRules: {
        'financial-services': {
          weightingMultipliers: {
            'risk-compliance': 1.5,
            'financial-management': 1.3,
            'operational-excellence': 1.2
          },
          requiredDomains: ['risk-compliance', 'financial-management'],
          excludedDomains: []
        },
        'healthcare': {
          weightingMultipliers: {
            'risk-compliance': 1.4,
            'operational-excellence': 1.3,
            'people-organization': 1.2
          },
          requiredDomains: ['risk-compliance'],
          excludedDomains: []
        },
        'technology': {
          weightingMultipliers: {
            'technology-data': 1.4,
            'revenue-engine': 1.3,
            'operational-excellence': 1.2
          },
          requiredDomains: [],
          excludedDomains: []
        }
      },
      performance: {
        maxProcessingTime: 120000, // 2 minutes
        maxTokensPerRequest: 8000,
        maxCostPerTriage: 0.5 // £0.5 target
      },
      ...config
    };

    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required for triage analysis');
    }
  }

  /**
   * Perform comprehensive domain triage analysis
   */
  async performTriage(assessment: Assessment): Promise<TriageAnalysis> {
    const startTime = Date.now();

    try {
      // 1. Validate assessment data completeness
      const validation = this.validateAssessmentData(assessment);
      if (!validation.isValid) {
        throw new Error(`Assessment validation failed: ${validation.validationErrors.join(', ')}`);
      }

      // 2. Build industry context
      const industryContext = this.buildIndustryContext(assessment);

      // 3. Calculate base domain scores
      const baseDomainScores = this.calculateBaseDomainScores(assessment);

      // 4. Apply AI-powered analysis for complex scoring
      const aiEnhancedScores = await this.performAIAnalysis(
        assessment,
        baseDomainScores,
        industryContext
      );

      // 5. Apply cross-domain impact analysis
      const finalScores = this.applyCrossDomainImpacts(aiEnhancedScores, industryContext);

      // 6. Select critical domains based on scoring
      const criticalDomains = this.selectCriticalDomains(finalScores, industryContext);

      // 7. Calculate overall confidence
      const confidence = this.calculateOverallConfidence(finalScores, validation);

      // 8. Build processing metrics
      const processingTime = Date.now() - startTime;
      const processingMetrics: ProcessingMetrics = {
        processingTime,
        modelUsed: this.config.modelSelection.primary,
        tokenUsage: {
          prompt: 0, // Will be updated from actual API call
          completion: 0,
          total: 0
        },
        costEstimate: this.estimateCost(processingTime)
      };

      return {
        domainScores: finalScores,
        criticalDomains,
        confidence,
        reasoning: this.generateTriageReasoning(finalScores, criticalDomains, industryContext),
        industryContext,
        processingMetrics
      };

    } catch (error) {
      console.error('Triage analysis failed:', error);
      throw new Error(`Triage analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate assessment data for triage readiness
   */
  private validateAssessmentData(assessment: Assessment): TriageValidationResult {
    const errors: string[] = [];
    let totalQuestions = 0;
    let answeredQuestions = 0;

    // Check if assessment has domain responses
    if (!assessment.domainResponses || Object.keys(assessment.domainResponses).length === 0) {
      errors.push('No domain responses found');
      return {
        isValid: false,
        confidence: 0,
        validationErrors: errors,
        fallbackActivated: false,
        dataCompleteness: 0,
        qualityScore: 0
      };
    }

    // Calculate data completeness
    Object.values(assessment.domainResponses).forEach(domain => {
      if (domain.questions) {
        const questions = Object.values(domain.questions);
        totalQuestions += questions.length;
        answeredQuestions += questions.filter(q =>
          q.value !== null && q.value !== undefined && q.value !== ''
        ).length;
      }
    });

    const dataCompleteness = totalQuestions > 0 ? answeredQuestions / totalQuestions : 0;

    if (dataCompleteness < this.config.thresholds.dataCompletenessRequired) {
      errors.push(`Data completeness (${Math.round(dataCompleteness * 100)}%) below required threshold (${Math.round(this.config.thresholds.dataCompletenessRequired * 100)}%)`);
    }

    // Check industry classification (warning only, not blocking)
    // Industry classification is preferred but not required

    // Calculate quality score based on response consistency
    const qualityScore = this.calculateResponseQuality(assessment);

    return {
      isValid: errors.length === 0,
      confidence: Math.min(dataCompleteness, qualityScore),
      validationErrors: errors,
      fallbackActivated: false,
      dataCompleteness,
      qualityScore
    };
  }

  /**
   * Build industry-specific context
   */
  private buildIndustryContext(assessment: Assessment): IndustryContext {
    const industry = assessment.industryClassification;

    if (!industry) {
      // Default context for unknown industry
      return {
        sector: 'unknown',
        regulatoryClassification: 'lightly-regulated',
        specificRules: [],
        benchmarks: {},
        weightingMultipliers: {}
      };
    }

    // Map regulatory classification
    let regulatoryClassification: 'lightly-regulated' | 'moderately-regulated' | 'heavily-regulated' = 'lightly-regulated';

    switch (industry.sector) {
      case 'financial-services':
        regulatoryClassification = 'heavily-regulated';
        break;
      case 'healthcare':
        regulatoryClassification = 'heavily-regulated';
        break;
      case 'technology':
        regulatoryClassification = 'lightly-regulated';
        break;
      default:
        regulatoryClassification = 'moderately-regulated';
    }

    const industryRules = this.config.industryRules[industry.sector] || {
      weightingMultipliers: {},
      requiredDomains: [],
      excludedDomains: []
    };

    return {
      sector: industry.sector,
      regulatoryClassification,
      specificRules: industryRules.requiredDomains,
      benchmarks: this.getIndustryBenchmarks(industry.sector),
      weightingMultipliers: industryRules.weightingMultipliers
    };
  }

  /**
   * Calculate base domain scores from assessment responses
   */
  private calculateBaseDomainScores(assessment: Assessment): Record<string, DomainScore> {
    const domainScores: Record<string, DomainScore> = {};

    Object.entries(assessment.domainResponses).forEach(([domainName, domainResponse]) => {
      if (!domainResponse.questions) {
        return;
      }

      const scores = Object.values(domainResponse.questions)
        .map(q => typeof q.value === 'number' ? q.value : 0)
        .filter(v => v > 0);

      const averageScore = scores.length > 0
        ? scores.reduce((sum, score) => sum + score, 0) / scores.length
        : 1; // Default low score if no data

      // Calculate confidence based on data completeness and consistency
      const dataCompleteness = scores.length / Math.max(Object.keys(domainResponse.questions).length, 1);
      const scoreVariance = this.calculateVariance(scores);
      const confidence = Math.min(dataCompleteness, (1 - scoreVariance / 25)); // Normalize variance

      domainScores[domainName] = {
        score: Math.min(5, Math.max(1, averageScore)),
        confidence: Math.max(0.1, Math.min(1, confidence)),
        reasoning: `Base score calculated from ${scores.length} responses`,
        criticalFactors: this.identifyBaseCriticalFactors(domainResponse, averageScore),
        crossDomainImpacts: [],
        severity: this.classifySeverity(averageScore),
        priorityLevel: this.classifyPriorityLevel(averageScore),
        agentActivation: this.determineAgentActivation(averageScore)
      };
    });

    return domainScores;
  }

  /**
   * Perform AI-powered analysis for complex scoring
   */
  private async performAIAnalysis(
    assessment: Assessment,
    baseScores: Record<string, DomainScore>,
    industryContext: IndustryContext
  ): Promise<Record<string, DomainScore>> {
    const model = this.selectOptimalModel();

    const prompt = this.buildAIAnalysisPrompt(assessment, baseScores, industryContext);

    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert business consultant performing domain triage analysis. Analyze the assessment data and provide enhanced scoring with detailed reasoning for each domain.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      });

      const messageContent = response.choices[0]?.message?.content
      if (!messageContent) {
        throw new Error('No content received from OpenAI API')
      }
      const result = JSON.parse(messageContent);

      // Update processing metrics with actual token usage
      if (response.usage) {
        // This would be stored in the metrics object
        console.log('Token usage:', response.usage);
      }

      return this.mergeAIEnhancedScores(baseScores, result.domainAnalysis || {});

    } catch (error) {
      console.warn('AI analysis failed, using base scores:', error);
      return baseScores; // Fallback to base scores
    }
  }

  /**
   * Apply cross-domain impact analysis
   */
  private applyCrossDomainImpacts(
    domainScores: Record<string, DomainScore>,
    industryContext: IndustryContext
  ): Record<string, DomainScore> {
    const impactMatrix = this.getCrossDomainImpactMatrix();
    const enhancedScores = { ...domainScores };

    Object.keys(enhancedScores).forEach(domainName => {
      const domain = enhancedScores[domainName];
      if (!domain) {
        return; // Skip if domain is undefined
      }

      const impacts = impactMatrix[domainName] || {};

      let crossDomainBoost = 0;
      const crossDomainImpacts: string[] = [];

      Object.entries(impacts).forEach(([impactedDomain, impactWeight]) => {
        const impactedScore = enhancedScores[impactedDomain];
        if (impactedScore && impactedScore.score >= 4.0) {
          crossDomainBoost += impactWeight * 0.2; // Max 20% boost
          crossDomainImpacts.push(`High ${impactedDomain} score increases ${domainName} priority`);
        }
      });

      // Apply industry-specific weighting
      const industryMultiplier = industryContext.weightingMultipliers[domainName] || 1.0;
      const finalScore = Math.min(5.0, (domain.score + crossDomainBoost) * industryMultiplier);

      enhancedScores[domainName] = {
        score: finalScore,
        confidence: domain.confidence,
        reasoning: domain.reasoning,
        criticalFactors: domain.criticalFactors,
        crossDomainImpacts,
        severity: this.classifySeverity(finalScore),
        priorityLevel: this.classifyPriorityLevel(finalScore),
        agentActivation: this.determineAgentActivation(finalScore)
      };
    });

    return enhancedScores;
  }

  /**
   * Select critical domains for agent activation
   */
  private selectCriticalDomains(
    domainScores: Record<string, DomainScore>,
    industryContext: IndustryContext
  ): string[] {
    const scoredDomains = Object.entries(domainScores)
      .map(([domain, score]) => ({ domain, ...score }))
      .sort((a, b) => b.score - a.score);

    const criticalDomains: string[] = [];

    // Always include domains above the selection threshold
    scoredDomains.forEach(({ domain, score }) => {
      if (score >= this.config.thresholds.domainSelection) {
        criticalDomains.push(domain);
      }
    });

    // Ensure industry-required domains are included
    industryContext.specificRules.forEach(requiredDomain => {
      if (!criticalDomains.includes(requiredDomain)) {
        criticalDomains.push(requiredDomain);
      }
    });

    // Ensure we have 3-5 domains total (target range)
    while (criticalDomains.length < 3 && criticalDomains.length < scoredDomains.length) {
      const nextDomain = scoredDomains[criticalDomains.length];
      if (nextDomain && !criticalDomains.includes(nextDomain.domain)) {
        criticalDomains.push(nextDomain.domain);
      } else {
        break;
      }
    }

    // Cap at 5 domains for cost optimization
    return criticalDomains.slice(0, 5);
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallConfidence(
    domainScores: Record<string, DomainScore>,
    validation: TriageValidationResult
  ): number {
    const scores = Object.values(domainScores);
    const averageConfidence = scores.reduce((sum, domain) => sum + domain.confidence, 0) / scores.length;

    // Weight confidence by data quality and completeness
    const weightedConfidence = (
      averageConfidence * 0.5 +
      validation.dataCompleteness * 0.3 +
      validation.qualityScore * 0.2
    );

    return Math.max(0.1, Math.min(1.0, weightedConfidence));
  }

  /**
   * Generate human-readable triage reasoning
   */
  private generateTriageReasoning(
    domainScores: Record<string, DomainScore>,
    criticalDomains: string[],
    industryContext: IndustryContext
  ): string {
    const topDomains = criticalDomains.slice(0, 3);
    const industryNote = industryContext.sector !== 'unknown'
      ? ` Given the ${industryContext.sector} industry context and ${industryContext.regulatoryClassification} regulatory environment,`
      : '';

    const domainList = topDomains.map(domain => {
      const score = domainScores[domain];
      if (!score) {
        return `${domain.replace('-', ' ')} (score: N/A, confidence: N/A)`;
      }
      return `${domain.replace('-', ' ')} (score: ${score.score.toFixed(1)}, confidence: ${(score.confidence * 100).toFixed(0)}%)`;
    }).join(', ');

    return `Triage identified ${criticalDomains.length} critical domains requiring agent analysis.${industryNote} Priority domains: ${domainList}. Analysis will focus on areas with highest business impact and implementation feasibility.`;
  }

  // Helper methods

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return variance;
  }

  private calculateResponseQuality(_assessment: Assessment): number {
    // Implement quality scoring based on response patterns, consistency, etc.
    // For now, return a baseline quality score
    return 0.8;
  }

  private classifySeverity(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 4.5) return 'critical';
    if (score >= 4.0) return 'high';
    if (score >= 3.0) return 'medium';
    return 'low';
  }

  private classifyPriorityLevel(score: number): 'HEALTHY' | 'MODERATE' | 'HIGH' | 'CRITICAL' {
    if (score >= 4.5) return 'CRITICAL';
    if (score >= 4.0) return 'HIGH';
    if (score >= 3.5) return 'MODERATE';
    return 'HEALTHY';
  }

  private determineAgentActivation(score: number): 'NOT_REQUIRED' | 'CONDITIONAL' | 'REQUIRED' {
    if (score >= 4.0) return 'REQUIRED';
    if (score >= 3.5) return 'CONDITIONAL';
    return 'NOT_REQUIRED';
  }

  private identifyBaseCriticalFactors(domainResponse: any, score: number): string[] {
    const factors: string[] = [];

    if (score >= 4.0) {
      factors.push('Multiple high-severity responses detected');
    }
    if (score >= 4.5) {
      factors.push('Critical operational gaps identified');
    }

    return factors;
  }

  private getIndustryBenchmarks(sector: string): Record<string, number> {
    const benchmarks: Record<string, Record<string, number>> = {
      'financial-services': {
        'risk-compliance': 4.2,
        'financial-management': 4.0,
        'operational-excellence': 3.8
      },
      'technology': {
        'technology-data': 4.1,
        'revenue-engine': 3.9,
        'people-organization': 3.7
      }
    };

    return benchmarks[sector] || {};
  }

  private selectOptimalModel(): string {
    // Simple model selection based on cost optimization
    return this.config.modelSelection.primary;
  }

  private buildAIAnalysisPrompt(
    assessment: Assessment,
    baseScores: Record<string, DomainScore>,
    industryContext: IndustryContext
  ): string {
    const scoresText = Object.entries(baseScores)
      .map(([domain, score]) => `${domain}: ${score.score.toFixed(1)} (confidence: ${(score.confidence * 100).toFixed(0)}%)`)
      .join('\n');

    return `
Analyze this operational assessment for enhanced domain triage:

Company: ${assessment.companyName}
Industry: ${industryContext.sector} (${industryContext.regulatoryClassification})
Stage: ${assessment.companyStage || 'Unknown'}

Base Domain Scores:
${scoresText}

Assessment Context:
- Primary challenges: ${assessment.assessmentContext?.primaryBusinessChallenges?.join(', ') || 'Not specified'}
- Strategic objectives: ${assessment.assessmentContext?.strategicObjectives?.join(', ') || 'Not specified'}

Please provide enhanced analysis in JSON format:
{
  "domainAnalysis": {
    "domain-name": {
      "adjustedScore": 4.2,
      "confidence": 0.85,
      "reasoning": "Detailed analysis of why this score was adjusted",
      "criticalFactors": ["Factor 1", "Factor 2"],
      "severity": "high"
    }
  }
}

Focus on identifying truly critical operational gaps that require immediate attention.
`;
  }

  private mergeAIEnhancedScores(
    baseScores: Record<string, DomainScore>,
    aiAnalysis: Record<string, any>
  ): Record<string, DomainScore> {
    const enhanced = { ...baseScores };

    Object.entries(aiAnalysis).forEach(([domain, analysis]) => {
      if (enhanced[domain] && analysis) {
        enhanced[domain] = {
          ...enhanced[domain],
          score: analysis.adjustedScore || enhanced[domain].score,
          confidence: analysis.confidence || enhanced[domain].confidence,
          reasoning: analysis.reasoning || enhanced[domain].reasoning,
          criticalFactors: analysis.criticalFactors || enhanced[domain].criticalFactors,
          severity: analysis.severity || enhanced[domain].severity
        };
      }
    });

    return enhanced;
  }


  private getCrossDomainImpactMatrix(): Record<string, Record<string, number>> {
    return {
      'strategic-alignment': {
        'people-organization': 0.8,
        'change-management': 0.9,
        'operational-excellence': 0.7
      },
      'financial-management': {
        'revenue-engine': 0.9,
        'operational-excellence': 0.7,
        'risk-compliance': 0.6
      },
      'revenue-engine': {
        'customer-experience': 0.8,
        'customer-success': 0.9,
        'technology-data': 0.6
      },
      'people-organization': {
        'change-management': 0.9,
        'operational-excellence': 0.7,
        'strategic-alignment': 0.6
      }
    };
  }

  private estimateCost(processingTime: number): number {
    // Rough cost estimate based on processing time and model usage
    // This would be more sophisticated in production
    const baseCost = 0.1; // Base API call cost
    const timeFactor = processingTime / 60000; // Per minute
    return baseCost + (timeFactor * 0.05);
  }
}