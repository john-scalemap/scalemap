import {
  Question,
  DomainName,
  QuestionResponse,
  IndustryClassification,
  DomainTemplate
} from '@/types';

export interface QuestionFilter {
  industryClassification?: IndustryClassification;
  companyProfile?: {
    employeeCount: number;
    revenue?: string;
    hasInternationalOperations?: boolean;
    hasPhysicalProducts?: boolean;
    hasChannelSales?: boolean;
    isRapidGrowth?: boolean;
  };
  previousResponses?: Record<string, QuestionResponse>;
}

export class QuestionService {
  private static instance: QuestionService;
  private questionDatabase: Map<DomainName, Question[]> = new Map();

  static getInstance(): QuestionService {
    if (!QuestionService.instance) {
      QuestionService.instance = new QuestionService();
    }
    return QuestionService.instance;
  }

  async loadQuestionDatabase(): Promise<void> {
    try {
      // Load the comprehensive question database from the content file
      const response = await fetch('/api/assessment/questions');
      const questionData: Record<DomainName, Question[]> = await response.json();

      Object.entries(questionData).forEach(([domain, questions]) => {
        this.questionDatabase.set(domain as DomainName, questions);
      });
    } catch (error) {
      console.error('Failed to load question database:', error);
      // Load from local fallback if API fails
      this.loadFallbackQuestions();
    }
  }

  private loadFallbackQuestions(): void {
    // Strategic Alignment questions based on the assessment database
    const strategicQuestions: Question[] = [
      {
        id: '1.1',
        type: 'multiple-choice',
        question: 'How clearly can your leadership team articulate your company\'s 3-year vision in one sentence?',
        options: [
          'Crystal clear - everyone gives the same answer',
          'Mostly clear - minor variations in wording',
          'Somewhat clear - general alignment but different emphases',
          'Unclear - significant variations in interpretation',
          'No clear vision - leadership gives contradictory answers'
        ],
        required: true
      },
      {
        id: '1.2',
        type: 'multiple-choice',
        question: 'When making resource allocation decisions, how often do teams reference strategic priorities?',
        options: [
          'Always - every major decision includes strategic impact analysis',
          'Usually - strategic considerations are standard part of decisions',
          'Sometimes - strategic alignment happens for bigger decisions',
          'Rarely - decisions made mostly on operational needs',
          'Never - strategic priorities don\'t influence day-to-day resource allocation'
        ],
        required: true
      },
      {
        id: '1.3',
        type: 'multiple-choice',
        question: 'How well do individual team goals connect to company-wide objectives?',
        options: [
          'Perfect alignment - every team goal clearly traces to strategic objectives',
          'Strong alignment - most goals connect with clear reasoning',
          'Moderate alignment - connections exist but aren\'t always clear',
          'Weak alignment - some teams have goals unrelated to strategy',
          'No alignment - team goals set independently of strategic objectives'
        ],
        required: true
      },
      {
        id: '1.4',
        type: 'multiple-choice',
        question: 'How accurately does your leadership team assess your competitive position?',
        options: [
          'Highly accurate - deep market intelligence informs all strategic decisions',
          'Mostly accurate - good understanding with minor blind spots',
          'Reasonably accurate - understanding is correct but not comprehensive',
          'Somewhat inaccurate - significant gaps in competitive intelligence',
          'Highly inaccurate - leadership operates with poor market understanding'
        ],
        required: true
      },
      {
        id: '1.5',
        type: 'multiple-choice',
        question: 'How often does leadership communicate strategic updates to the organization?',
        options: [
          'Weekly - consistent strategic context in regular communications',
          'Monthly - regular strategic updates with clear progress tracking',
          'Quarterly - strategic communication tied to business cycles',
          'Semi-annually - strategic updates happen but infrequently',
          'Annually or less - minimal strategic communication to teams'
        ],
        required: true
      },
      {
        id: '1.6',
        type: 'multiple-choice',
        question: 'When market conditions change, how quickly can your organization adapt strategy?',
        options: [
          'Within weeks - agile strategic planning with rapid execution',
          'Within 1-2 months - efficient strategic adaptation process',
          'Within 3-6 months - standard strategic planning cycles allow adaptation',
          'Within 6-12 months - slow strategic adaptation due to planning constraints',
          'Over 12 months - strategic planning too rigid for market adaptation'
        ],
        required: true
      },
      {
        id: '1.7',
        type: 'multiple-choice',
        question: 'How well does your strategic planning incorporate regulatory compliance requirements?',
        options: [
          'Fully integrated - compliance drives strategic opportunities',
          'Well integrated - compliance considerations built into all strategic decisions',
          'Moderately integrated - compliance considered but not central to strategy',
          'Poorly integrated - compliance seen as separate from strategic planning',
          'Not integrated - regulatory requirements reactive, not strategic'
        ],
        required: false,
        industrySpecific: {
          regulated: true
        }
      }
    ];

    this.questionDatabase.set('strategic-alignment', strategicQuestions);

    // Add other domains with basic questions - would be expanded with full question set
    const domains: DomainName[] = [
      'financial-management', 'revenue-engine', 'operational-excellence',
      'people-organization', 'technology-data', 'customer-experience',
      'supply-chain', 'risk-compliance', 'partnerships', 'customer-success',
      'change-management'
    ];

    domains.forEach(domain => {
      this.questionDatabase.set(domain, this.generateBasicQuestions(domain));
    });
  }

  private generateBasicQuestions(domain: DomainName): Question[] {
    // This would be replaced with the full question database from the content file
    return [
      {
        id: `${domain}-1`,
        type: 'scale',
        question: `How would you rate your organization's performance in ${domain.replace('-', ' ')}?`,
        scale: { min: 1, max: 5, labels: ['Poor', 'Excellent'] },
        required: true
      }
    ];
  }

  getQuestionsForDomain(
    domain: DomainName,
    filter: QuestionFilter = {}
  ): Question[] {
    const baseQuestions = this.questionDatabase.get(domain) || [];

    return this.filterQuestions(baseQuestions, filter);
  }

  private filterQuestions(
    questions: Question[],
    filter: QuestionFilter
  ): Question[] {
    return questions.filter(question => {
      // Industry-specific filtering
      if (question.industrySpecific && filter.industryClassification) {
        const { industryClassification } = filter;
        const { companyProfile } = filter;

        // Check regulated industry requirement
        if (question.industrySpecific.regulated !== undefined) {
          const isRegulated = industryClassification.regulatoryClassification !== 'non-regulated';
          if (question.industrySpecific.regulated !== isRegulated) {
            return false;
          }
        }

        // Check business model requirement
        if (question.industrySpecific.businessModels) {
          if (!question.industrySpecific.businessModels.includes(industryClassification.businessModel)) {
            return false;
          }
        }

        // Check company stage requirement
        if (question.industrySpecific.companyStages) {
          if (!question.industrySpecific.companyStages.includes(industryClassification.companyStage)) {
            return false;
          }
        }

        // Check minimum revenue requirement
        if (question.industrySpecific.minRevenue && companyProfile?.revenue) {
          // Simple revenue check - in real implementation would need more sophisticated parsing
          const hasMinRevenue = companyProfile.revenue.includes('£10M') || companyProfile.revenue.includes('£50M');
          if (!hasMinRevenue) {
            return false;
          }
        }

        // Check minimum employee count
        if (question.industrySpecific.minEmployees && companyProfile?.employeeCount) {
          if (companyProfile.employeeCount < question.industrySpecific.minEmployees) {
            return false;
          }
        }

        // Check international operations
        if (question.industrySpecific.hasInternationalOperations !== undefined && companyProfile) {
          if (question.industrySpecific.hasInternationalOperations !== companyProfile.hasInternationalOperations) {
            return false;
          }
        }

        // Check physical products
        if (question.industrySpecific.hasPhysicalProducts !== undefined && companyProfile) {
          if (question.industrySpecific.hasPhysicalProducts !== companyProfile.hasPhysicalProducts) {
            return false;
          }
        }

        // Check channel sales
        if (question.industrySpecific.hasChannelSales !== undefined && companyProfile) {
          if (question.industrySpecific.hasChannelSales !== companyProfile.hasChannelSales) {
            return false;
          }
        }

        // Check rapid growth
        if (question.industrySpecific.rapidGrowth !== undefined && companyProfile) {
          if (question.industrySpecific.rapidGrowth !== companyProfile.isRapidGrowth) {
            return false;
          }
        }
      }

      // Legacy company profile filtering (keeping for backwards compatibility)
      if (filter.companyProfile) {
        const { companyProfile } = filter;

        // Employee count based questions (legacy)
        if (question.id.includes('middle-management') && companyProfile.employeeCount <= 50) {
          return false;
        }

        // Revenue based questions (legacy)
        if (question.id.includes('enterprise') &&
            (!companyProfile.revenue || !companyProfile.revenue.includes('£10M'))) {
          return false;
        }

        // International operations (legacy)
        if (question.id.includes('international') && !companyProfile.hasInternationalOperations) {
          return false;
        }

        // Physical products (legacy)
        if (question.id.includes('supply-chain') && !companyProfile.hasPhysicalProducts) {
          return false;
        }

        // Channel sales (legacy)
        if (question.id.includes('channel') && !companyProfile.hasChannelSales) {
          return false;
        }

        // Rapid growth (legacy)
        if (question.id.includes('scaling') && !companyProfile.isRapidGrowth) {
          return false;
        }
      }

      // Conditional logic filtering
      if (question.conditional && filter.previousResponses) {
        const dependentResponse = filter.previousResponses[question.conditional.dependsOn];
        if (!dependentResponse) {
          return false;
        }

        const shouldShow = question.conditional.showIf.includes(String(dependentResponse.value));
        if (!shouldShow) {
          return false;
        }
      }

      return true;
    });
  }

  getFollowUpQuestions(
    questionId: string,
    response: QuestionResponse,
    domain: DomainName
  ): Question[] {
    const baseQuestions = this.questionDatabase.get(domain) || [];
    const mainQuestion = baseQuestions.find(q => q.id === questionId);

    if (!mainQuestion || !mainQuestion.followUpQuestions) {
      return [];
    }

    // Check if the response triggers follow-up questions
    const responseValue = String(response.value);
    const numericValue = Number(response.value);

    // For scale questions, trigger follow-ups for concerning responses (scores 4+ indicating problems)
    if (mainQuestion.type === 'scale' && numericValue >= 4) {
      return mainQuestion.followUpQuestions;
    }

    // For multiple-choice questions, check if the response value matches the conditional logic
    if (mainQuestion.type === 'multiple-choice' && mainQuestion.followUpQuestions) {
      const triggeredFollowUps: Question[] = [];

      mainQuestion.followUpQuestions.forEach(followUp => {
        if (followUp.conditional && followUp.conditional.showIf.includes(responseValue)) {
          triggeredFollowUps.push(followUp);
        }
      });

      return triggeredFollowUps;
    }

    return [];
  }

  generateDynamicQuestions(
    domain: DomainName,
    previousResponses: Record<string, QuestionResponse>,
    industryClassification?: IndustryClassification
  ): Question[] {
    const dynamicQuestions: Question[] = [];

    // Generate questions based on concerning scores
    Object.entries(previousResponses).forEach(([questionId, response]) => {
      const score = Number(response.value);

      if (score >= 4) { // Concerning score
        const followUps = this.generateConcernFollowUps(questionId, score, domain);
        dynamicQuestions.push(...followUps);
      }
    });

    // Generate industry-specific follow-ups
    if (industryClassification) {
      const industryFollowUps = this.generateIndustryFollowUps(
        domain,
        industryClassification,
        previousResponses
      );
      dynamicQuestions.push(...industryFollowUps);
    }

    return dynamicQuestions;
  }

  private generateConcernFollowUps(
    questionId: string,
    score: number,
    domain: DomainName
  ): Question[] {
    const followUps: Question[] = [];

    // Common follow-up patterns for concerning scores
    if (questionId.includes('predictability') || questionId.includes('planning')) {
      followUps.push({
        id: `${questionId}-followup-1`,
        type: 'text',
        question: 'What are the main factors causing unpredictability in this area?',
        required: false
      });
    }

    if (questionId.includes('process') || questionId.includes('management')) {
      followUps.push({
        id: `${questionId}-followup-2`,
        type: 'multiple-select',
        question: 'Which of these issues contribute to the challenges?',
        options: [
          'Lack of documentation',
          'Insufficient resources',
          'Poor communication',
          'Unclear responsibilities',
          'Inadequate tools/systems',
          'Skills gaps',
          'Resistance to change'
        ],
        required: false
      });
    }

    return followUps;
  }

  private generateIndustryFollowUps(
    domain: DomainName,
    industryClassification: IndustryClassification,
    previousResponses: Record<string, QuestionResponse>
  ): Question[] {
    const followUps: Question[] = [];

    // SaaS-specific follow-ups
    if (industryClassification.businessModel === 'b2b-saas' && domain === 'customer-success') {
      followUps.push({
        id: 'saas-metrics',
        type: 'multiple-select',
        question: 'Which SaaS metrics do you actively track?',
        options: ['MRR', 'ARR', 'Churn Rate', 'LTV', 'CAC', 'NPS', 'Product Usage'],
        required: false
      });
    }

    // Regulated industry follow-ups
    if (industryClassification.regulatoryClassification !== 'non-regulated' &&
        domain === 'risk-compliance') {
      followUps.push({
        id: 'regulatory-frameworks',
        type: 'multiple-select',
        question: 'Which regulatory frameworks does your organization need to comply with?',
        options: ['GDPR', 'SOX', 'PCI DSS', 'HIPAA', 'FDA', 'FCA', 'Other'],
        required: false
      });
    }

    return followUps;
  }

  getQuestionWeight(questionId: string, domain: DomainName): number {
    // Question weighting for scoring - would be loaded from schema
    const weights: Record<string, Record<string, number>> = {
      'strategic-alignment': {
        '1.1': 0.25, '1.2': 0.20, '1.3': 0.15, '1.4': 0.15, '1.5': 0.10, '1.6': 0.15
      }
      // Add other domains...
    };

    return weights[domain]?.[questionId] || 0.1;
  }

  validateQuestionResponse(
    question: Question,
    response: QuestionResponse
  ): { isValid: boolean; error?: string } {
    const value = response.value;

    if (question.required && (value === null || value === undefined || value === '')) {
      return { isValid: false, error: 'This question is required' };
    }

    switch (question.type) {
      case 'scale':
        if (question.scale) {
          const numValue = Number(value);
          if (isNaN(numValue) || numValue < question.scale.min || numValue > question.scale.max) {
            return {
              isValid: false,
              error: `Value must be between ${question.scale.min} and ${question.scale.max}`
            };
          }
        }
        break;

      case 'multiple-choice':
        if (question.options && !question.options.includes(String(value))) {
          return { isValid: false, error: 'Invalid option selected' };
        }
        break;

      case 'multiple-select':
        if (question.options && Array.isArray(value)) {
          const invalidOptions = value.filter(v => !question.options!.includes(v));
          if (invalidOptions.length > 0) {
            return { isValid: false, error: 'Invalid options selected' };
          }
        }
        break;
    }

    return { isValid: true };
  }
}