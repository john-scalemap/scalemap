import {
  Assessment,
  AssessmentValidation,
  AssessmentValidationError,
  ValidationWarning,
  DomainResponse,
  QuestionResponse,
  Question,
  DomainName
} from '../../types/assessment';
import { getDomainQuestions } from '../../data/assessment-questions';

export class AssessmentValidator {

  /**
   * Validates an entire assessment
   */
  static validateAssessment(assessment: Assessment): AssessmentValidation {
    const errors: AssessmentValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const requiredFieldsMissing: string[] = [];
    const crossDomainInconsistencies: string[] = [];

    // Validate basic assessment fields
    this.validateBasicFields(assessment, errors);

    // Validate domain responses
    this.validateDomainResponses(assessment, errors, warnings, requiredFieldsMissing);

    // Validate cross-domain consistency
    this.validateCrossDomainConsistency(assessment, crossDomainInconsistencies);

    // Calculate completeness
    const completeness = this.calculateCompleteness(assessment);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      completeness,
      requiredFieldsMissing,
      crossDomainInconsistencies
    };
  }

  /**
   * Validates basic assessment fields
   */
  private static validateBasicFields(assessment: Assessment, errors: AssessmentValidationError[]) {
    if (!assessment.companyName?.trim()) {
      errors.push({
        field: 'companyName',
        message: 'Company name is required',
        type: 'required'
      });
    }

    if (!assessment.contactEmail?.trim()) {
      errors.push({
        field: 'contactEmail',
        message: 'Contact email is required',
        type: 'required'
      });
    } else if (!this.isValidEmail(assessment.contactEmail)) {
      errors.push({
        field: 'contactEmail',
        message: 'Invalid email format',
        type: 'format'
      });
    }

    if (!assessment.title?.trim()) {
      errors.push({
        field: 'title',
        message: 'Assessment title is required',
        type: 'required'
      });
    }

    if (!assessment.description?.trim()) {
      errors.push({
        field: 'description',
        message: 'Assessment description is required',
        type: 'required'
      });
    }
  }

  /**
   * Validates domain responses
   */
  private static validateDomainResponses(
    assessment: Assessment,
    errors: AssessmentValidationError[],
    warnings: ValidationWarning[],
    requiredFieldsMissing: string[]
  ) {
    const isRegulated = assessment.industryClassification?.regulatoryClassification === 'heavily-regulated';
    const companyStage = assessment.companyStage;

    for (const [domainName, domainResponse] of Object.entries(assessment.domainResponses || {})) {
      const domain = domainName as DomainName;
      const questions = getDomainQuestions(domain, companyStage, isRegulated);

      this.validateDomainResponse(domain, domainResponse, questions, errors, warnings, requiredFieldsMissing);
    }
  }

  /**
   * Validates a single domain response
   */
  private static validateDomainResponse(
    domain: DomainName,
    domainResponse: DomainResponse,
    questions: Question[],
    errors: AssessmentValidationError[],
    warnings: ValidationWarning[],
    requiredFieldsMissing: string[]
  ) {
    const requiredQuestions = questions.filter(q => q.required);

    // Check for missing required questions
    for (const question of requiredQuestions) {
      const response = domainResponse.questions[question.id];

      if (!response || this.isEmptyResponse(response.value)) {
        requiredFieldsMissing.push(`${domain}.${question.id}`);
        errors.push({
          field: `${domain}.${question.id}`,
          message: `Required question "${question.question}" must be answered`,
          type: 'required'
        });
      } else {
        // Validate response format and range
        this.validateQuestionResponse(domain, question, response, errors);
      }
    }

    // Check for quality issues
    this.validateResponseQuality(domain, domainResponse, questions, warnings);
  }

  /**
   * Validates a single question response
   */
  private static validateQuestionResponse(
    domain: DomainName,
    question: Question,
    response: QuestionResponse,
    errors: AssessmentValidationError[]
  ) {
    const fieldPath = `${domain}.${question.id}`;

    switch (question.type) {
      case 'scale':
        if (question.scale) {
          const numValue = Number(response.value);
          if (isNaN(numValue) || numValue < question.scale.min || numValue > question.scale.max) {
            errors.push({
              field: fieldPath,
              message: `Scale response must be between ${question.scale.min} and ${question.scale.max}`,
              type: 'range'
            });
          }
        }
        break;

      case 'multiple-choice':
        if (question.options && !question.options.includes(String(response.value))) {
          errors.push({
            field: fieldPath,
            message: 'Invalid option selected',
            type: 'format'
          });
        }
        break;

      case 'multiple-select':
        if (Array.isArray(response.value)) {
          const invalidOptions = response.value.filter(v =>
            !question.options?.includes(String(v))
          );
          if (invalidOptions.length > 0) {
            errors.push({
              field: fieldPath,
              message: `Invalid options selected: ${invalidOptions.join(', ')}`,
              type: 'format'
            });
          }
        } else {
          errors.push({
            field: fieldPath,
            message: 'Multiple select response must be an array',
            type: 'format'
          });
        }
        break;

      case 'number':
        if (typeof response.value !== 'number' || isNaN(response.value)) {
          errors.push({
            field: fieldPath,
            message: 'Response must be a valid number',
            type: 'format'
          });
        }
        break;

      case 'boolean':
        if (typeof response.value !== 'boolean') {
          errors.push({
            field: fieldPath,
            message: 'Response must be true or false',
            type: 'format'
          });
        }
        break;

      case 'text':
        if (typeof response.value !== 'string') {
          errors.push({
            field: fieldPath,
            message: 'Response must be text',
            type: 'format'
          });
        } else if (response.value.length > 10000) {
          errors.push({
            field: fieldPath,
            message: 'Response text is too long (maximum 10,000 characters)',
            type: 'format'
          });
        }
        break;
    }
  }

  /**
   * Validates response quality and provides warnings
   */
  private static validateResponseQuality(
    domain: DomainName,
    domainResponse: DomainResponse,
    questions: Question[],
    warnings: ValidationWarning[]
  ) {
    const responses = Object.values(domainResponse.questions);

    // Check for incomplete responses
    const completedResponses = responses.filter(r => !this.isEmptyResponse(r.value));
    const completionRate = completedResponses.length / questions.length;

    if (completionRate < 0.8) {
      warnings.push({
        field: domain,
        message: `Only ${Math.round(completionRate * 100)}% of questions answered. Consider completing more questions for better insights.`,
        type: 'completeness'
      });
    }

    // Check for response consistency (all extreme values)
    const scaleResponses = responses.filter(r => typeof r.value === 'number');
    if (scaleResponses.length > 3) {
      const allHigh = scaleResponses.every(r => Number(r.value) >= 4);
      const allLow = scaleResponses.every(r => Number(r.value) <= 2);

      if (allHigh || allLow) {
        warnings.push({
          field: domain,
          message: 'Responses appear to be consistently extreme. Consider reviewing answers for accuracy.',
          type: 'consistency'
        });
      }
    }

    // Check for very short text responses
    const textResponses = responses.filter(r => typeof r.value === 'string' && r.value.length > 0);
    const shortResponses = textResponses.filter(r => String(r.value).length < 10);

    if (shortResponses.length > 0 && shortResponses.length / textResponses.length > 0.5) {
      warnings.push({
        field: domain,
        message: 'Many text responses are very brief. More detailed responses will improve assessment quality.',
        type: 'quality'
      });
    }
  }

  /**
   * Validates cross-domain consistency
   */
  private static validateCrossDomainConsistency(assessment: Assessment, inconsistencies: string[]) {
    const responses = assessment.domainResponses || {};

    // Check strategic alignment vs operational domains
    const strategicResponse = responses['strategic-alignment'];
    const operationalResponse = responses['operational-excellence'];

    if (strategicResponse && operationalResponse) {
      // Example: If strategic alignment shows clear vision (1-2) but operational excellence is poor (4-5),
      // this could indicate implementation gaps
      const visionClarityResponse = strategicResponse.questions['sa-1.1'];
      const operationalEfficiencyResponses = Object.values(operationalResponse.questions)
        .filter(r => typeof r.value === 'number');

      if (visionClarityResponse && operationalEfficiencyResponses.length > 0) {
        const visionScore = Number(visionClarityResponse.value);
        const avgOperationalScore = operationalEfficiencyResponses
          .reduce((sum, r) => sum + Number(r.value), 0) / operationalEfficiencyResponses.length;

        if (visionScore <= 2 && avgOperationalScore >= 4) {
          inconsistencies.push(
            'Strategic vision appears clear but operational execution is struggling. This gap may indicate implementation challenges.'
          );
        }
      }
    }

    // Check financial vs revenue engine consistency
    const financialResponse = responses['financial-management'];
    const revenueResponse = responses['revenue-engine'];

    if (financialResponse && revenueResponse) {
      const cashFlowResponse = financialResponse.questions['fm-2.2'];
      const pipelineResponse = revenueResponse.questions['re-3.1'];

      if (cashFlowResponse && pipelineResponse) {
        const cashFlowScore = Number(cashFlowResponse.value);
        const pipelineScore = Number(pipelineResponse.value);

        if (cashFlowScore >= 4 && pipelineScore <= 2) {
          inconsistencies.push(
            'Strong sales pipeline but cash flow concerns may indicate collection or margin issues.'
          );
        }
      }
    }
  }

  /**
   * Calculates overall assessment completeness
   */
  private static calculateCompleteness(assessment: Assessment): number {
    const domainResponses = assessment.domainResponses || {};
    const totalDomains = 12; // Total number of domains

    if (Object.keys(domainResponses).length === 0) {
      return 0;
    }

    const domainCompleteness = Object.values(domainResponses)
      .map(response => response.completeness || 0);

    const avgCompleteness = domainCompleteness.reduce((sum, comp) => sum + comp, 0) / totalDomains;
    return Math.round(avgCompleteness);
  }

  /**
   * Checks if a response value is empty
   */
  private static isEmptyResponse(value: QuestionResponse['value']): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (Array.isArray(value) && value.length === 0) return true;
    return false;
  }

  /**
   * Validates email format
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validates a single domain for real-time feedback
   */
  static validateDomain(
    domain: DomainName,
    domainResponse: DomainResponse,
    assessment: Assessment
  ): { errors: AssessmentValidationError[]; warnings: ValidationWarning[] } {
    const errors: AssessmentValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const isRegulated = assessment.industryClassification?.regulatoryClassification === 'heavily-regulated';
    const companyStage = assessment.companyStage;
    const questions = getDomainQuestions(domain, companyStage, isRegulated);

    this.validateDomainResponse(domain, domainResponse, questions, errors, warnings, []);

    return { errors, warnings };
  }

  /**
   * Validates assessment context
   */
  static validateAssessmentContext(context: any): AssessmentValidationError[] {
    const errors: AssessmentValidationError[] = [];

    if (!context.primaryBusinessChallenges || context.primaryBusinessChallenges.length === 0) {
      errors.push({
        field: 'primaryBusinessChallenges',
        message: 'At least one business challenge must be selected',
        type: 'required'
      });
    }

    if (!context.strategicObjectives || context.strategicObjectives.length === 0) {
      errors.push({
        field: 'strategicObjectives',
        message: 'At least one strategic objective must be selected',
        type: 'required'
      });
    }

    if (!context.resourceConstraints) {
      errors.push({
        field: 'resourceConstraints',
        message: 'Resource constraints must be specified',
        type: 'required'
      });
    } else {
      const { budget, team, timeAvailability } = context.resourceConstraints;

      const validBudgetOptions = ['limited', 'moderate', 'substantial'];
      const validTeamOptions = ['stretched', 'adequate', 'well-staffed'];
      const validTimeOptions = ['minimal', 'moderate', 'flexible'];

      if (!validBudgetOptions.includes(budget)) {
        errors.push({
          field: 'resourceConstraints.budget',
          message: 'Invalid budget constraint option',
          type: 'format'
        });
      }

      if (!validTeamOptions.includes(team)) {
        errors.push({
          field: 'resourceConstraints.team',
          message: 'Invalid team constraint option',
          type: 'format'
        });
      }

      if (!validTimeOptions.includes(timeAvailability)) {
        errors.push({
          field: 'resourceConstraints.timeAvailability',
          message: 'Invalid time availability option',
          type: 'format'
        });
      }
    }

    return errors;
  }
}