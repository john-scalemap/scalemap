import {
  Assessment,
  DomainName,
  TriageResult,
  AgentAnalysisResult,
  PrioritizationResult,
  TokenUsage,
  ClientData,
  ProcessedDocument
} from '@scalemap/shared';
import OpenAI from 'openai';

export interface OpenAIConfig {
  apiKey: string;
  organizationId?: string;
  models: {
    primary: string;
    costOptimized: string;
    advanced: string;
  };
  limits: {
    maxTokensPerRequest: number;
    maxCostPerAssessment: number;
    circuitBreakerThreshold: number;
  };
  monitoring: {
    trackUsage: boolean;
    logRequests: boolean;
  };
}

export interface OpenAIServiceMetrics {
  totalTokensUsed: number;
  totalCost: number;
  requestCount: number;
  averageLatency: number;
  errorCount: number;
  circuitBreakerActive: boolean;
}

export class OpenAIService {
  private client: OpenAI;
  private config: OpenAIConfig;
  private metrics: OpenAIServiceMetrics;
  private circuitBreakerFailures: number = 0;
  private lastFailureTime: number = 0;
  private readonly CIRCUIT_BREAKER_RESET_TIMEOUT = 60000; // 1 minute

  constructor(config?: Partial<OpenAIConfig>) {
    this.config = {
      apiKey: process.env.OPENAI_API_KEY || '',
      organizationId: process.env.OPENAI_ORGANIZATION_ID,
      models: {
        primary: process.env.OPENAI_MODEL_PRIMARY || 'gpt-4o',
        costOptimized: process.env.OPENAI_MODEL_COST_OPTIMIZED || 'gpt-4o-mini',
        advanced: process.env.OPENAI_MODEL_ADVANCED || 'o1-preview'
      },
      limits: {
        maxTokensPerRequest: 8000,
        maxCostPerAssessment: parseFloat(process.env.OPENAI_MAX_COST_PER_ASSESSMENT || '2.00'),
        circuitBreakerThreshold: parseInt(process.env.OPENAI_CIRCUIT_BREAKER_THRESHOLD || '5')
      },
      monitoring: {
        trackUsage: true,
        logRequests: process.env.NODE_ENV === 'development'
      },
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      organization: this.config.organizationId,
    });

    this.metrics = {
      totalTokensUsed: 0,
      totalCost: 0,
      requestCount: 0,
      averageLatency: 0,
      errorCount: 0,
      circuitBreakerActive: false
    };
  }

  /**
   * Generate a completion using OpenAI with specified parameters
   */
  async generateCompletion(prompt: string, options: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  } = {}): Promise<string> {
    try {
      const startTime = Date.now();

      if (this.isCircuitBreakerOpen()) {
        throw new Error('OpenAI service circuit breaker is open - too many recent failures');
      }

      const response = await this.client.chat.completions.create({
        model: options.model || this.config.models.costOptimized,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature ?? 0.7,
      });

      const completion = response.choices[0]?.message?.content || '';

      // Track metrics
      this.updateMetrics(Date.now() - startTime, false);

      return completion;
    } catch (error) {
      this.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Perform domain triage analysis to identify critical areas requiring agent attention
   */
  async performTriage(assessmentData: Assessment): Promise<TriageResult> {
    try {
      const startTime = Date.now();

      if (this.isCircuitBreakerOpen()) {
        throw new Error('OpenAI service circuit breaker is open - too many recent failures');
      }

      const model = this.selectModel('triage');

      const triagePrompt = this.buildTriagePrompt(assessmentData);

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert business consultant performing operational domain triage. Analyze the assessment data and identify 3-5 critical domains that require immediate attention based on problem severity and business impact.'
          },
          {
            role: 'user',
            content: triagePrompt
          }
        ],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      });

      const usage = response.usage;
      if (usage) {
        this.trackTokenUsage('triage', {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          model
        });
      }

      const latency = Date.now() - startTime;
      this.updateMetrics(latency, false);

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        assessmentId: assessmentData.id,
        criticalDomains: result.criticalDomains || [],
        priorityScore: result.priorityScore || {},
        reasoning: result.reasoning || '',
        confidence: result.confidence || 0.8,
        processingTime: latency,
        modelUsed: model
      };

    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Execute domain-specific agent analysis
   */
  async executeAgentAnalysis(
    agentPrompt: string,
    clientData: ClientData,
    documents: ProcessedDocument[],
    domain: DomainName
  ): Promise<AgentAnalysisResult> {
    try {
      const startTime = Date.now();

      if (this.isCircuitBreakerOpen()) {
        throw new Error('OpenAI service circuit breaker is open - too many recent failures');
      }

      const model = this.selectModel('analysis');

      const analysisPrompt = this.buildAgentAnalysisPrompt(agentPrompt, clientData, documents, domain);

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: agentPrompt
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const usage = response.usage;
      if (usage) {
        this.trackTokenUsage(`agent-${domain}`, {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          model
        });
      }

      const latency = Date.now() - startTime;
      this.updateMetrics(latency, false);

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        domain,
        findings: result.findings || [],
        recommendations: result.recommendations || [],
        severity: result.severity || 'medium',
        confidence: result.confidence || 0.8,
        supportingEvidence: result.supportingEvidence || [],
        processingTime: latency,
        modelUsed: model,
        agentName: result.agentName || `${domain} specialist`
      };

    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Synthesize final prioritization from all agent analyses
   */
  async synthesizePrioritization(analyses: AgentAnalysisResult[]): Promise<PrioritizationResult> {
    try {
      const startTime = Date.now();

      if (this.isCircuitBreakerOpen()) {
        throw new Error('OpenAI service circuit breaker is open - too many recent failures');
      }

      const model = this.selectModel('synthesis');

      const synthesisPrompt = this.buildSynthesisPrompt(analyses);

      const response = await this.client.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are the lead consultant synthesizing findings from domain specialists. Create Perfect Prioritization - identify the 2-3 operational changes that will unlock 80% of growth potential.'
          },
          {
            role: 'user',
            content: synthesisPrompt
          }
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      });

      const usage = response.usage;
      if (usage) {
        this.trackTokenUsage('synthesis', {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          model
        });
      }

      const latency = Date.now() - startTime;
      this.updateMetrics(latency, false);

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        priorityRecommendations: result.priorityRecommendations || [],
        impactAnalysis: result.impactAnalysis || {},
        implementationRoadmap: result.implementationRoadmap || [],
        confidence: result.confidence || 0.8,
        reasoning: result.reasoning || '',
        processingTime: latency,
        modelUsed: model
      };

    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Track token usage and costs
   */
  trackTokenUsage(operation: string, usage: TokenUsage): void {
    if (!this.config.monitoring.trackUsage) return;

    const cost = this.calculateCost(usage.model, usage.totalTokens);

    this.metrics.totalTokensUsed += usage.totalTokens;
    this.metrics.totalCost += cost;
    this.metrics.requestCount += 1;

    if (this.config.monitoring.logRequests) {
      console.log(`OpenAI Usage - ${operation}:`, {
        model: usage.model,
        tokens: usage.totalTokens,
        cost: cost.toFixed(4),
        operation
      });
    }

    // Check if we're approaching cost limits
    if (this.metrics.totalCost > this.config.limits.maxCostPerAssessment * 0.9) {
      console.warn(`OpenAI cost approaching limit: $${this.metrics.totalCost.toFixed(2)} / $${this.config.limits.maxCostPerAssessment}`);
    }
  }

  /**
   * Get current service metrics
   */
  getMetrics(): OpenAIServiceMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics (typically called at start of new assessment)
   */
  resetMetrics(): void {
    this.metrics = {
      totalTokensUsed: 0,
      totalCost: 0,
      requestCount: 0,
      averageLatency: 0,
      errorCount: 0,
      circuitBreakerActive: this.isCircuitBreakerOpen()
    };
  }

  /**
   * Select appropriate model based on task complexity and cost constraints
   */
  private selectModel(taskType: 'triage' | 'analysis' | 'synthesis'): string {
    const { models } = this.config;

    // If we're approaching cost limits, use cost-optimized model
    if (this.metrics.totalCost > this.config.limits.maxCostPerAssessment * 0.7) {
      return models.costOptimized;
    }

    switch (taskType) {
      case 'triage':
        return models.costOptimized; // Triage can use faster model
      case 'analysis':
        return models.primary; // Domain analysis needs full capability
      case 'synthesis':
        return models.advanced; // Perfect Prioritization needs highest reasoning
      default:
        return models.primary;
    }
  }

  /**
   * Build triage prompt from assessment data
   */
  private buildTriagePrompt(assessment: Assessment): string {
    const domainScores = Object.entries(assessment.domainResponses)
      .map(([domain, responses]) => {
        const avgScore = this.calculateDomainScore(responses);
        return `${domain}: ${avgScore}/5`;
      })
      .join('\n');

    return `
Analyze this operational assessment for domain triage:

Company: ${assessment.companyName}
Industry: ${assessment.industryClassification?.sector || 'Unknown'}
Stage: ${assessment.companyStage || 'Unknown'}

Domain Scores:
${domainScores}

Assessment Context:
- Primary challenges: ${assessment.assessmentContext?.primaryBusinessChallenges?.join(', ') || 'Not specified'}
- Strategic objectives: ${assessment.assessmentContext?.strategicObjectives?.join(', ') || 'Not specified'}
- Resource constraints: ${JSON.stringify(assessment.assessmentContext?.resourceConstraints || {})}

Return JSON with:
{
  "criticalDomains": ["domain1", "domain2", "domain3"],
  "priorityScore": {"domain1": 0.9, "domain2": 0.8},
  "reasoning": "Explanation of why these domains are critical",
  "confidence": 0.85
}
`;
  }

  /**
   * Build agent analysis prompt
   */
  private buildAgentAnalysisPrompt(
    agentPrompt: string,
    clientData: ClientData,
    documents: ProcessedDocument[],
    domain: DomainName
  ): string {
    const documentContext = documents.length > 0
      ? `\nSupporting Documents:\n${documents.map(doc => `- ${doc.name}: ${doc.content.substring(0, 500)}...`).join('\n')}`
      : '';

    return `
Perform deep analysis for ${domain} domain:

Company Context:
${JSON.stringify(clientData, null, 2)}

Domain Assessment Data:
${JSON.stringify(clientData.domainResponses?.[domain] || {}, null, 2)}
${documentContext}

Provide detailed analysis in JSON format:
{
  "findings": ["Finding 1", "Finding 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "severity": "low|medium|high|critical",
  "confidence": 0.8,
  "supportingEvidence": ["Evidence 1", "Evidence 2"],
  "agentName": "Domain Specialist Name"
}
`;
  }

  /**
   * Build synthesis prompt from all agent analyses
   */
  private buildSynthesisPrompt(analyses: AgentAnalysisResult[]): string {
    const analysisText = analyses.map(analysis =>
      `${analysis.domain}: ${analysis.severity} severity
Findings: ${analysis.findings.join(', ')}
Recommendations: ${analysis.recommendations.join(', ')}`
    ).join('\n\n');

    return `
Synthesize Perfect Prioritization from these domain analyses:

${analysisText}

Create 2-3 priority recommendations that will deliver 80% of growth impact.
Return JSON:
{
  "priorityRecommendations": [
    {
      "title": "Priority 1",
      "description": "What to do",
      "impactScore": 0.9,
      "implementationEffort": "low|medium|high",
      "timeframe": "30|60|90 days",
      "dependencies": ["dependency1"]
    }
  ],
  "impactAnalysis": {"revenue": "High", "efficiency": "Medium"},
  "implementationRoadmap": ["Step 1", "Step 2"],
  "confidence": 0.85,
  "reasoning": "Why these priorities deliver maximum impact"
}
`;
  }

  /**
   * Calculate approximate cost for token usage
   */
  private calculateCost(model: string, tokens: number): number {
    const pricing = {
      'gpt-4o': { input: 0.0025, output: 0.01 }, // per 1K tokens
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'o1-preview': { input: 0.015, output: 0.06 },
      'default': { input: 0.0025, output: 0.01 }
    };

    const rates = pricing[model as keyof typeof pricing] || pricing.default;
    // Approximation: assume 70% input, 30% output
    const inputTokens = tokens * 0.7;
    const outputTokens = tokens * 0.3;

    return ((inputTokens * rates.input) + (outputTokens * rates.output)) / 1000;
  }

  /**
   * Calculate domain score from responses
   */
  private calculateDomainScore(responses: any): number {
    if (!responses?.questions) return 0;

    const scores = Object.values(responses.questions)
      .map((q: any) => q?.value || 0)
      .filter(v => v > 0);

    return scores.length > 0
      ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
      : 0;
  }

  /**
   * Circuit breaker logic
   */
  private isCircuitBreakerOpen(): boolean {
    if (this.circuitBreakerFailures < this.config.limits.circuitBreakerThreshold) {
      return false;
    }

    // Check if enough time has passed to reset
    if (Date.now() - this.lastFailureTime > this.CIRCUIT_BREAKER_RESET_TIMEOUT) {
      this.circuitBreakerFailures = 0;
      return false;
    }

    this.metrics.circuitBreakerActive = true;
    return true;
  }

  /**
   * Handle API errors and update circuit breaker
   */
  private handleError(error: any): void {
    this.circuitBreakerFailures++;
    this.lastFailureTime = Date.now();
    this.metrics.errorCount++;

    console.error('OpenAI API Error:', {
      message: error.message,
      failures: this.circuitBreakerFailures,
      circuitBreakerOpen: this.isCircuitBreakerOpen()
    });
  }

  /**
   * Update service metrics
   */
  private updateMetrics(latency: number, isError: boolean): void {
    if (!isError) {
      const currentAvg = this.metrics.averageLatency;
      const count = this.metrics.requestCount;
      this.metrics.averageLatency = ((currentAvg * (count - 1)) + latency) / count;
    }

    this.metrics.circuitBreakerActive = this.isCircuitBreakerOpen();
  }
}