import {
  AssessmentGap,
  DomainName,
  QuestionResponse,
  GapAnalysisRequest
} from '@/types';

interface RealTimeGapDetectionConfig {
  apiBaseUrl: string;
  debounceMs: number;
  enableLocalValidation: boolean;
  criticalGapThreshold: number;
}

interface LocalValidationRule {
  pattern: RegExp;
  category: 'critical' | 'important' | 'nice-to-have';
  message: string;
  suggestions: string[];
}

export class RealTimeGapDetectionService {
  private config: RealTimeGapDetectionConfig;
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private analysisCallbacks: Map<string, (gaps: AssessmentGap[]) => void> = new Map();

  // Local validation rules for immediate feedback
  private localValidationRules: Record<DomainName, LocalValidationRule[]> = {
    'strategic-alignment': [
      {
        pattern: /^(yes|no|good|bad|okay|ok)$/i,
        category: 'important',
        message: 'Response appears too brief for strategic analysis',
        suggestions: [
          'What specific strategic initiatives are you currently implementing?',
          'How do you ensure alignment between different departments?',
          'What metrics do you use to measure strategic success?'
        ]
      },
      {
        pattern: /^.{1,10}$/,
        category: 'critical',
        message: 'Strategic questions require detailed responses',
        suggestions: [
          'Please provide specific examples of your strategic approach',
          'Describe your current strategic planning process',
          'What are your key strategic objectives for the next 12 months?'
        ]
      }
    ],
    'financial-management': [
      {
        pattern: /^(yes|no|good|bad|fine|okay|ok)$/i,
        category: 'critical',
        message: 'Financial questions require specific data and details',
        suggestions: [
          'What specific financial metrics do you track?',
          'How often do you review financial performance?',
          'What are your current cash flow challenges?'
        ]
      },
      {
        pattern: /\b(budget|profit|revenue|cash)\b/i,
        category: 'nice-to-have',
        message: 'Consider providing specific numbers or percentages',
        suggestions: [
          'Can you share specific revenue targets or growth rates?',
          'What percentage of revenue is allocated to different areas?',
          'How has your financial performance changed over the last year?'
        ]
      }
    ],
    'revenue-engine': [
      {
        pattern: /^(growing|declining|stable|good|bad)$/i,
        category: 'important',
        message: 'Revenue analysis requires specific metrics and processes',
        suggestions: [
          'What are your specific revenue targets and how do you track them?',
          'What is your customer acquisition cost and lifetime value?',
          'Describe your sales process and conversion rates'
        ]
      }
    ],
    'operational-excellence': [
      {
        pattern: /^(efficient|inefficient|smooth|rough)$/i,
        category: 'important',
        message: 'Operations analysis requires process details',
        suggestions: [
          'What specific processes have you optimized recently?',
          'How do you measure operational efficiency?',
          'What are your main operational bottlenecks?'
        ]
      }
    ],
    'people-organization': [
      {
        pattern: /^(happy|unhappy|good|bad|motivated)$/i,
        category: 'important',
        message: 'People questions benefit from specific examples and metrics',
        suggestions: [
          'What are your employee satisfaction scores or retention rates?',
          'How do you measure team performance and engagement?',
          'What specific people challenges are you facing?'
        ]
      }
    ],
    'technology-data': [
      {
        pattern: /^(modern|outdated|good|bad|working)$/i,
        category: 'important',
        message: 'Technology questions require specific details about systems and capabilities',
        suggestions: [
          'What specific technologies and platforms are you using?',
          'How do you measure technology performance and reliability?',
          'What are your main technology challenges or limitations?'
        ]
      }
    ],
    'customer-experience': [
      {
        pattern: /^(satisfied|unsatisfied|happy|unhappy|good|bad)$/i,
        category: 'important',
        message: 'Customer experience requires specific metrics and feedback',
        suggestions: [
          'What are your customer satisfaction scores or NPS ratings?',
          'How do you collect and analyze customer feedback?',
          'What specific customer experience improvements have you made?'
        ]
      }
    ],
    'supply-chain': [
      {
        pattern: /^(efficient|inefficient|smooth|problematic)$/i,
        category: 'important',
        message: 'Supply chain questions benefit from specific details about processes and metrics',
        suggestions: [
          'What are your key supply chain performance metrics?',
          'How do you manage supplier relationships and contracts?',
          'What supply chain challenges have you encountered?'
        ]
      }
    ],
    'risk-compliance': [
      {
        pattern: /^(compliant|non-compliant|secure|insecure|good|bad)$/i,
        category: 'critical',
        message: 'Risk and compliance require specific policies and procedures',
        suggestions: [
          'What specific compliance frameworks do you follow?',
          'How do you identify and assess business risks?',
          'What security measures and policies do you have in place?'
        ]
      }
    ],
    'partnerships': [
      {
        pattern: /^(good|bad|working|not working|few|many)$/i,
        category: 'nice-to-have',
        message: 'Partnership questions benefit from specific examples and outcomes',
        suggestions: [
          'What are your key strategic partnerships and their value?',
          'How do you evaluate and manage partner relationships?',
          'What partnership opportunities are you exploring?'
        ]
      }
    ],
    'customer-success': [
      {
        pattern: /^(successful|unsuccessful|good|bad|working|not working)$/i,
        category: 'important',
        message: 'Customer success requires specific metrics and processes',
        suggestions: [
          'What are your customer retention and churn rates?',
          'How do you measure customer success and satisfaction?',
          'What specific customer success initiatives do you have?'
        ]
      }
    ],
    'change-management': [
      {
        pattern: /^(smooth|difficult|good|bad|working|challenging)$/i,
        category: 'important',
        message: 'Change management questions benefit from specific examples and methodologies',
        suggestions: [
          'What change management frameworks or processes do you use?',
          'How do you measure the success of organizational changes?',
          'What recent changes have you implemented and what were the outcomes?'
        ]
      }
    ]
  };

  constructor(config: Partial<RealTimeGapDetectionConfig> = {}) {
    this.config = {
      apiBaseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod',
      debounceMs: 2000,
      enableLocalValidation: true,
      criticalGapThreshold: 3,
      ...config
    };
  }

  /**
   * Analyze response in real-time with local validation and optional API call
   */
  async analyzeResponse(
    assessmentId: string,
    domain: DomainName,
    questionId: string,
    response: string,
    callback: (gaps: AssessmentGap[]) => void,
    useAPI: boolean = false
  ): Promise<void> {
    const cacheKey = `${assessmentId}-${domain}-${questionId}`;

    // Clear existing timer for this question
    const existingTimer = this.debounceTimers.get(cacheKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Store callback
    this.analysisCallbacks.set(cacheKey, callback);

    // Immediate local validation for critical issues
    if (this.config.enableLocalValidation) {
      const localGaps = this.performLocalValidation(assessmentId, domain, questionId, response);
      if (localGaps.length > 0) {
        callback(localGaps);
      }
    }

    // Debounced API analysis (if enabled)
    if (useAPI && response.trim().length > 0) {
      const timer = setTimeout(async () => {
        try {
          const apiGaps = await this.performAPIAnalysis(assessmentId, domain, response);
          const currentCallback = this.analysisCallbacks.get(cacheKey);
          if (currentCallback) {
            currentCallback(apiGaps);
          }
        } catch (error) {
          console.warn('API gap analysis failed:', error);
        } finally {
          this.debounceTimers.delete(cacheKey);
          this.analysisCallbacks.delete(cacheKey);
        }
      }, this.config.debounceMs);

      this.debounceTimers.set(cacheKey, timer);
    }
  }

  /**
   * Perform immediate local validation using predefined rules
   */
  private performLocalValidation(
    assessmentId: string,
    domain: DomainName,
    questionId: string,
    response: string
  ): AssessmentGap[] {
    const gaps: AssessmentGap[] = [];
    const rules = this.localValidationRules[domain] || [];

    for (const rule of rules) {
      if (rule.pattern.test(response.trim())) {
        gaps.push({
          gapId: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          assessmentId,
          domain,
          category: rule.category,
          description: rule.message,
          detectedAt: new Date().toISOString(),
          suggestedQuestions: rule.suggestions,
          followUpPrompts: [
            'Consider providing more specific details',
            'Examples and metrics would be helpful'
          ],
          resolved: false,
          impactOnTimeline: rule.category === 'critical',
          priority: rule.category === 'critical' ? 8 : rule.category === 'important' ? 6 : 4,
          estimatedResolutionTime: 10
        });
      }
    }

    return gaps;
  }

  /**
   * Perform API-based gap analysis for more sophisticated detection
   */
  private async performAPIAnalysis(
    assessmentId: string,
    domain: DomainName,
    response: string
  ): Promise<AssessmentGap[]> {
    try {
      const analysisRequest: GapAnalysisRequest = {
        assessmentId,
        analysisDepth: 'quick',
        forceReanalysis: true,
        focusDomains: [domain]
      };

      const apiResponse = await fetch(`${this.config.apiBaseUrl}/assessments/${assessmentId}/gaps/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisRequest),
      });

      if (!apiResponse.ok) {
        throw new Error(`API analysis failed: ${apiResponse.statusText}`);
      }

      const result = await apiResponse.json();
      return result.gapAnalysis?.detectedGaps || [];

    } catch (error) {
      console.error('API gap analysis error:', error);
      return [];
    }
  }

  /**
   * Cleanup timers and callbacks
   */
  cleanup(): void {
    // Clear all pending timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.analysisCallbacks.clear();
  }

  /**
   * Get configuration
   */
  getConfig(): RealTimeGapDetectionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RealTimeGapDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if response meets minimum quality threshold
   */
  isResponseAdequate(response: string, domain: DomainName): boolean {
    const trimmed = response.trim();

    // Basic length check
    if (trimmed.length < 10) {
      return false;
    }

    // Check against local validation rules
    const rules = this.localValidationRules[domain] || [];
    for (const rule of rules) {
      if (rule.category === 'critical' && rule.pattern.test(trimmed)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get suggestions for improving a response
   */
  getSuggestionsForResponse(response: string, domain: DomainName): string[] {
    const rules = this.localValidationRules[domain] || [];

    for (const rule of rules) {
      if (rule.pattern.test(response.trim())) {
        return rule.suggestions;
      }
    }

    // Default suggestions based on domain
    return this.getDefaultSuggestions(domain);
  }

  private getDefaultSuggestions(domain: DomainName): string[] {
    const defaultSuggestions: Record<DomainName, string[]> = {
      'strategic-alignment': [
        'Describe your strategic planning process',
        'What are your key strategic objectives?',
        'How do you measure strategic success?'
      ],
      'financial-management': [
        'Share specific financial metrics you track',
        'Describe your budgeting and planning process',
        'What are your main financial challenges?'
      ],
      'revenue-engine': [
        'Provide details about your sales process',
        'Share customer acquisition and retention metrics',
        'Describe your revenue growth strategy'
      ],
      'operational-excellence': [
        'Describe your key operational processes',
        'Share efficiency metrics and KPIs',
        'What operational improvements have you made?'
      ],
      'people-organization': [
        'Describe your team structure and culture',
        'Share employee satisfaction and retention data',
        'What people challenges are you addressing?'
      ],
      'technology-data': [
        'Describe your technology stack and infrastructure',
        'Share data management and analytics capabilities',
        'What technology improvements are planned?'
      ],
      'customer-experience': [
        'Share customer satisfaction metrics',
        'Describe your customer feedback process',
        'What customer experience improvements have you made?'
      ],
      'supply-chain': [
        'Describe your supply chain processes',
        'Share supplier relationship management approach',
        'What supply chain challenges do you face?'
      ],
      'risk-compliance': [
        'Describe your risk management framework',
        'Share compliance policies and procedures',
        'What security measures do you have in place?'
      ],
      'partnerships': [
        'Describe your key strategic partnerships',
        'Share partnership evaluation criteria',
        'What partnership opportunities are you exploring?'
      ],
      'customer-success': [
        'Share customer success metrics and KPIs',
        'Describe your customer onboarding process',
        'How do you ensure customer satisfaction?'
      ],
      'change-management': [
        'Describe your change management process',
        'Share examples of recent organizational changes',
        'How do you measure change success?'
      ]
    };

    return defaultSuggestions[domain] || [
      'Please provide more specific details',
      'Consider sharing examples or metrics',
      'Additional context would be helpful'
    ];
  }
}