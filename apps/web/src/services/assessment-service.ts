import {
  Assessment,
  DomainName,
  QuestionResponse,
  AssessmentValidation,
  ValidationError,
  ValidationWarning,
  IndustryClassification,
  DomainTemplate,
  Question
} from '@/types';

export class AssessmentService {
  private static instance: AssessmentService;
  private domainTemplates: Map<string, DomainTemplate> = new Map();
  private validationRules: any = {};

  static getInstance(): AssessmentService {
    if (!AssessmentService.instance) {
      AssessmentService.instance = new AssessmentService();
    }
    return AssessmentService.instance;
  }

  async loadDomainTemplates(): Promise<void> {
    try {
      const response = await fetch('/api/assessment/questions');
      const questionsData: Record<DomainName, any[]> = await response.json();

      // Convert questions data to domain templates
      Object.entries(questionsData).forEach(([domain, questions]) => {
        const domainName = domain as DomainName;
        const template: DomainTemplate = {
          domain: domainName,
          title: this.getDomainTitle(domainName),
          description: this.getDomainDescription(domainName),
          questions: questions as Question[],
          industrySpecific: {
            regulated: { additionalQuestions: [], requiredFields: [] },
            nonRegulated: { skipQuestions: [] }
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
        this.domainTemplates.set(domain, template);
      });
    } catch (error) {
      console.error('Failed to load domain templates:', error);
    }
  }

  getDomainTemplate(domain: DomainName): DomainTemplate | null {
    return this.domainTemplates.get(domain) || null;
  }

  getFilteredQuestions(
    domain: DomainName,
    industryClassification?: IndustryClassification
  ): Question[] {
    const template = this.getDomainTemplate(domain);
    if (!template) return [];

    let questions = [...template.questions];

    if (industryClassification) {
      // Add industry-specific questions for regulated industries
      if (industryClassification.regulatoryClassification !== 'non-regulated') {
        questions = [...questions, ...template.industrySpecific.regulated.additionalQuestions];
      }

      // Add company stage specific questions
      const stageVariations = template.companyStageVariations[industryClassification.companyStage];
      if (stageVariations.questions) {
        questions = [...questions, ...stageVariations.questions];
      }

      // Filter questions based on business model
      questions = questions.filter(q => {
        if (!q.industrySpecific?.businessModels) return true;
        return q.industrySpecific.businessModels.includes(industryClassification.businessModel);
      });

      // Filter questions based on company stage
      questions = questions.filter(q => {
        if (!q.industrySpecific?.companyStages) return true;
        return q.industrySpecific.companyStages.includes(industryClassification.companyStage);
      });
    }

    return questions;
  }

  validateResponse(question: Question, response: QuestionResponse): ValidationError | null {
    const value = response.value;

    // Check required fields
    if (question.required && (value === null || value === undefined || value === '')) {
      return {
        field: question.id,
        message: 'This question is required',
        type: 'required'
      };
    }

    // Validate based on question type
    switch (question.type) {
      case 'scale':
        if (question.scale) {
          const numValue = Number(value);
          if (isNaN(numValue) || numValue < question.scale.min || numValue > question.scale.max) {
            return {
              field: question.id,
              message: `Value must be between ${question.scale.min} and ${question.scale.max}`,
              type: 'range'
            };
          }
        }
        break;

      case 'multiple-choice':
        if (question.options && !question.options.includes(String(value))) {
          return {
            field: question.id,
            message: 'Invalid option selected',
            type: 'format'
          };
        }
        break;

      case 'multiple-select':
        if (question.options && Array.isArray(value)) {
          const invalidOptions = value.filter(v => !question.options!.includes(v));
          if (invalidOptions.length > 0) {
            return {
              field: question.id,
              message: `Invalid options selected: ${invalidOptions.join(', ')}`,
              type: 'format'
            };
          }
        }
        break;

      case 'number':
        if (isNaN(Number(value))) {
          return {
            field: question.id,
            message: 'Value must be a number',
            type: 'format'
          };
        }
        break;

      case 'boolean':
        if (typeof value !== 'boolean') {
          return {
            field: question.id,
            message: 'Value must be true or false',
            type: 'format'
          };
        }
        break;
    }

    return null;
  }

  validateConditionalQuestions(
    domain: DomainName,
    responses: Record<string, QuestionResponse>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const questions = this.getFilteredQuestions(domain);

    questions.forEach(question => {
      if (question.conditional) {
        const dependentResponse = responses[question.conditional.dependsOn];

        if (dependentResponse) {
          const shouldShow = question.conditional.showIf.includes(String(dependentResponse.value));
          const hasResponse = question.id in responses;

          if (shouldShow && question.required && !hasResponse) {
            errors.push({
              field: question.id,
              message: 'This conditional question is required based on your previous answer',
              type: 'required'
            });
          }
        }
      }
    });

    return errors;
  }

  calculateDomainScore(domain: DomainName, responses: Record<string, QuestionResponse>): number {
    const rules = this.validationRules[domain];
    if (!rules || !rules.scoringWeights) return 0;

    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(rules.scoringWeights).forEach(([questionId, weight]) => {
      const response = responses[questionId];
      if (response && typeof response.value === 'number') {
        weightedSum += response.value * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  calculateDomainCompleteness(
    domain: DomainName,
    responses: Record<string, QuestionResponse>,
    industryClassification?: IndustryClassification
  ): number {
    const questions = this.getFilteredQuestions(domain, industryClassification);
    const requiredQuestions = questions.filter(q => q.required);

    if (requiredQuestions.length === 0) return 100;

    const answeredRequired = requiredQuestions.filter(q => q.id in responses).length;
    return Math.round((answeredRequired / requiredQuestions.length) * 100);
  }

  validateCrossDomainConsistency(assessment: Assessment): ValidationError[] {
    const errors: ValidationError[] = [];

    // Strategic Alignment affects all domains
    const strategicScore = this.calculateDomainScore('strategic-alignment',
      assessment.domainResponses['strategic-alignment']?.questions || {});

    if (strategicScore <= 2) {
      errors.push({
        field: 'cross-domain',
        message: 'Poor strategic alignment (score ≤ 2) will negatively impact all other operational domains',
        type: 'consistency'
      });
    }

    // Financial Management constraints affect implementation capacity
    const financialScore = this.calculateDomainScore('financial-management',
      assessment.domainResponses['financial-management']?.questions || {});

    const changeScore = this.calculateDomainScore('change-management',
      assessment.domainResponses['change-management']?.questions || {});

    if (financialScore <= 2 && changeScore >= 4) {
      errors.push({
        field: 'cross-domain',
        message: 'Change management initiatives may be limited by poor financial management capabilities',
        type: 'consistency'
      });
    }

    // Revenue predictability vs cash flow predictability
    const revenueResponses = assessment.domainResponses['revenue-engine']?.questions || {};
    const financialResponses = assessment.domainResponses['financial-management']?.questions || {};

    const revenuePredictability = revenueResponses['3.1']?.value;
    const cashFlowPredictability = financialResponses['2.1']?.value;

    if (revenuePredictability && cashFlowPredictability) {
      const revScore = Number(revenuePredictability);
      const cashScore = Number(cashFlowPredictability);

      if (Math.abs(revScore - cashScore) > 2) {
        errors.push({
          field: 'cross-domain',
          message: 'Significant mismatch between revenue predictability and cash flow predictability indicates potential systemic issues',
          type: 'consistency'
        });
      }
    }

    return errors;
  }

  async validateAssessment(assessment: Assessment): Promise<AssessmentValidation> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const requiredFieldsMissing: string[] = [];
    const crossDomainInconsistencies: string[] = [];

    // Validate each domain
    Object.entries(assessment.domainResponses).forEach(([domainName, domainResponse]) => {
      const domain = domainName as DomainName;
      const questions = this.getFilteredQuestions(domain, assessment.industryClassification);

      // Validate individual responses
      questions.forEach(question => {
        const response = domainResponse.questions[question.id];

        if (response) {
          const error = this.validateResponse(question, response);
          if (error) {
            errors.push(error);
          }
        } else if (question.required) {
          requiredFieldsMissing.push(`${domain}.${question.id}`);
          errors.push({
            field: `${domain}.${question.id}`,
            message: `Required question not answered: ${question.question}`,
            type: 'required'
          });
        }
      });

      // Validate conditional questions
      const conditionalErrors = this.validateConditionalQuestions(domain, domainResponse.questions);
      errors.push(...conditionalErrors);

      // Check domain completeness
      const completeness = this.calculateDomainCompleteness(
        domain,
        domainResponse.questions,
        assessment.industryClassification
      );

      if (completeness < 70) {
        warnings.push({
          field: domain,
          message: `Domain only ${completeness}% complete. Minimum 70% recommended for reliable analysis.`,
          type: 'completeness'
        });
      }
    });

    // Cross-domain validation
    const crossDomainErrors = this.validateCrossDomainConsistency(assessment);
    errors.push(...crossDomainErrors);
    crossDomainInconsistencies.push(...crossDomainErrors.map(e => e.message));

    // Calculate overall completeness
    const totalDomains = Object.keys(assessment.domainResponses).length;
    const expectedDomains = 12; // All 12 domains
    const domainCompleteness = totalDomains > 0 ? (totalDomains / expectedDomains) * 100 : 0;

    const avgDomainCompleteness = Object.entries(assessment.domainResponses)
      .reduce((sum, [domainName, domainResponse]) => {
        return sum + this.calculateDomainCompleteness(
          domainName as DomainName,
          domainResponse.questions,
          assessment.industryClassification
        );
      }, 0) / Math.max(totalDomains, 1);

    const overallCompleteness = (domainCompleteness + avgDomainCompleteness) / 2;

    // Quality warnings
    const minimumThreshold = 70; // Default minimum threshold
    if (overallCompleteness < minimumThreshold) {
      warnings.push({
        field: 'overall',
        message: `Assessment completeness (${Math.round(overallCompleteness)}%) below minimum threshold (${minimumThreshold}%)`,
        type: 'quality'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness: Math.round(overallCompleteness),
      requiredFieldsMissing,
      crossDomainInconsistencies
    };
  }

  getTriggeredAgents(assessment: Assessment): DomainName[] {
    const triggeredAgents: DomainName[] = [];
    const triggerThreshold = 4.0; // Default trigger threshold
    const domainPrioritization: Record<DomainName, number> = {
      'strategic-alignment': 2.0,
      'financial-management': 1.8,
      'revenue-engine': 1.8,
      'operational-excellence': 1.5,
      'people-organization': 1.4,
      'technology-data': 1.3,
      'customer-experience': 1.7,
      'supply-chain': 1.2,
      'risk-compliance': 1.6,
      'partnerships': 1.1,
      'customer-success': 1.4,
      'change-management': 1.3
    };

    Object.entries(assessment.domainResponses).forEach(([domainName, domainResponse]) => {
      const domain = domainName as DomainName;
      const score = this.calculateDomainScore(domain, domainResponse.questions);
      const priorityWeight = domainPrioritization[domain] || 1.0;
      const adjustedThreshold = triggerThreshold / priorityWeight;

      if (score >= adjustedThreshold) {
        triggeredAgents.push(domain);
      }
    });

    // Sort by priority (strategic alignment always first)
    return triggeredAgents.sort((a, b) => {
      const priorityA = domainPrioritization[a] || 0;
      const priorityB = domainPrioritization[b] || 0;
      return priorityB - priorityA;
    });
  }

  calculateEstimatedTime(
    assessment: Assessment,
    industryClassification?: IndustryClassification
  ): string {
    let totalQuestions = 0;
    let answeredQuestions = 0;

    Object.keys(assessment.domainResponses).forEach(domainName => {
      const domain = domainName as DomainName;
      const questions = this.getFilteredQuestions(domain, industryClassification);
      const responses = assessment.domainResponses[domain]?.questions || {};

      totalQuestions += questions.length;
      answeredQuestions += Object.keys(responses).length;
    });

    const remainingQuestions = totalQuestions - answeredQuestions;
    const estimatedMinutes = Math.ceil(remainingQuestions * 0.75); // 45 seconds per question

    if (estimatedMinutes <= 5) return '< 5 minutes';
    if (estimatedMinutes <= 15) return '5-15 minutes';
    if (estimatedMinutes <= 30) return '15-30 minutes';
    if (estimatedMinutes <= 45) return '30-45 minutes';
    return '45-60 minutes';
  }

  generateCompletenessReport(assessment: Assessment): {
    overall: number;
    domains: Record<DomainName, number>;
    recommendations: string[];
  } {
    const domains: Record<DomainName, number> = {} as Record<DomainName, number>;
    const recommendations: string[] = [];

    // Calculate domain completeness
    Object.entries(assessment.domainResponses).forEach(([domainName, domainResponse]) => {
      const domain = domainName as DomainName;
      const completeness = this.calculateDomainCompleteness(
        domain,
        domainResponse.questions,
        assessment.industryClassification
      );
      domains[domain] = completeness;

      if (completeness < 70) {
        recommendations.push(`Complete ${domain} domain (currently ${completeness}% complete)`);
      }
    });

    // Calculate overall completeness
    const domainValues = Object.values(domains);
    const overall = domainValues.length > 0 ?
      Math.round(domainValues.reduce((sum, val) => sum + val, 0) / domainValues.length) : 0;

    const recommendedThreshold = 85; // Default recommended threshold
    if (overall < recommendedThreshold) {
      recommendations.push('Increase overall assessment completeness to at least 85% for comprehensive analysis');
    }

    return { overall, domains, recommendations };
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
}