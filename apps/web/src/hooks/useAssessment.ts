import { useState, useEffect, useCallback } from 'react';

import { assessmentService } from '@/lib/api';
import { useAuth } from '@/lib/auth/auth-context';
import { useAssessmentStore } from '@/stores/assessment-store';
import {
  Assessment,
  DomainName,
  QuestionResponse,
  AssessmentValidation,
  IndustryClassification,
  Question,
  DomainTemplate,
  DomainProgress,
} from '@/types';

export interface UseAssessmentOptions {
  assessmentId?: string;
  autoSave?: boolean;
  validationMode?: 'strict' | 'lenient';
}

export interface ListAssessmentsResult {
  assessments: Assessment[];
  count: number;
  hasMore: boolean;
}

export interface UseAssessmentReturn {
  assessment: Assessment | null;
  isLoading: boolean;
  error: string | null;
  validation: AssessmentValidation | null;

  // Progress management
  progress: {
    overall: number;
    domains: Record<DomainName, DomainProgress>;
    currentDomain?: DomainName;
    completeness: number;
    estimatedTimeRemaining: string;
    canProgress: boolean;
  };

  // Domain management
  availableDomains: DomainName[];
  getCurrentDomainQuestions: () => Question[];
  navigateToDomain: (domain: DomainName) => Promise<boolean>;
  canAccessDomain: (domain: DomainName) => boolean;

  // Question management
  answerQuestion: (questionId: string, response: any) => Promise<void>;
  getQuestionResponse: (questionId: string) => QuestionResponse | null;
  validateQuestion: (questionId: string, value: any) => string | null;

  // Industry classification
  setIndustryClassification: (classification: IndustryClassification) => Promise<void>;
  getIndustrySpecificQuestions: (domain: DomainName) => Question[];

  // Assessment lifecycle
  createAssessment: (title: string, description: string) => Promise<Assessment>;
  saveAssessment: () => Promise<void>;
  submitAssessment: () => Promise<Assessment>;
  loadAssessment: (id: string) => Promise<void>;
  listAssessments: (status?: string[]) => Promise<ListAssessmentsResult>;

  // Validation and scoring
  validateAssessment: () => Promise<AssessmentValidation>;
  calculateDomainCompleteness: (domain: DomainName) => number;
  getRequiredQuestions: (domain: DomainName) => Question[];
  getMissingRequiredQuestions: (domain: DomainName) => Question[];

  // Auto-save management
  enableAutoSave: () => void;
  disableAutoSave: () => void;
  isAutoSaveEnabled: boolean;
  lastAutoSave?: string;
}

export const useAssessment = (options: UseAssessmentOptions = {}): UseAssessmentReturn => {
  const { assessmentId, autoSave = true, validationMode = 'lenient' } = options;

  const [error, setError] = useState<string | null>(null);
  const [domainTemplates, setDomainTemplates] = useState<Record<DomainName, DomainTemplate>>(
    {} as Record<DomainName, DomainTemplate>
  );

  // Get auth context for user and company data
  const { user, company, isAuthenticated, isLoading: authLoading } = useAuth();

  const {
    currentAssessment,
    workflowState,
    progressState,
    industryClassification,
    validation,
    setCurrentAssessment,
    updateQuestionResponse,
    setCurrentDomain,
    setIndustryClassification: setIndustryClassificationStore,
    setValidation,
    setLoading,
    enableAutoSave,
    disableAutoSave,
    loadAssessment,
    saveAssessment,
    submitAssessment,
    calculateCompleteness,
    canProgressToDomain,
    // TODO: Implement auto-save functionality - performAutoSave not used yet
  } = useAssessmentStore();

  // Load assessment on mount if assessmentId provided
  useEffect(() => {
    if (assessmentId && !currentAssessment) {
      loadAssessmentById(assessmentId);
    }
  }, [assessmentId]);

  // Set up auto-save
  useEffect(() => {
    if (autoSave) {
      enableAutoSave();
    } else {
      disableAutoSave();
    }
  }, [autoSave]);

  // Load domain templates
  useEffect(() => {
    loadDomainTemplates();
  }, [industryClassification]);

  const loadAssessmentById = useCallback(
    async (id: string) => {
      try {
        setError(null);
        await loadAssessment(id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load assessment');
      }
    },
    [loadAssessment]
  );

  const loadDomainTemplates = useCallback(async () => {
    try {
      const { TokenManager } = await import('@/lib/auth/token-manager');
      const token = TokenManager.getAccessToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch('/api/assessment/questions', {
        headers,
      });

      if (!response.ok) {
        throw new Error('Failed to load domain templates');
      }

      const questionsData: Record<DomainName, any[]> = await response.json();

      // Convert questions data to domain templates
      const templates: Record<DomainName, DomainTemplate> = {};
      Object.entries(questionsData).forEach(([domain, questions]) => {
        const domainName = domain as DomainName;
        templates[domainName] = {
          domain: domainName,
          title: getDomainTitle(domainName),
          description: getDomainDescription(domainName),
          questions: questions as any,
          industrySpecific: {
            regulated: { additionalQuestions: [], requiredFields: [] },
            nonRegulated: { skipQuestions: [] },
          },
          companyStageVariations: {
            startup: { focusAreas: [] },
            growth: { focusAreas: [] },
            mature: { focusAreas: [] },
          },
          scoringRules: {
            triggerThreshold: 4.0,
            criticalThreshold: 4.5,
            weightingFactors: {},
          },
        };
      });

      setDomainTemplates(templates);
    } catch (err) {
      console.error('Failed to load domain templates:', err);
    }
  }, []);

  // Helper functions for domain metadata
  const getDomainTitle = (domain: DomainName): string => {
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
      partnerships: 'External Partnerships & Ecosystem',
      'customer-success': 'Customer Success & Growth',
      'change-management': 'Change Management & Implementation',
    };
    return titles[domain];
  };

  const getDomainDescription = (domain: DomainName): string => {
    const descriptions: Record<DomainName, string> = {
      'strategic-alignment':
        'Assess how well your organization aligns strategy across all levels and adapts to market changes.',
      'financial-management':
        'Evaluate financial planning, cash flow management, and capital efficiency practices.',
      'revenue-engine':
        'Analyze sales processes, customer acquisition, and revenue growth systems.',
      'operational-excellence':
        'Review process management, efficiency, and scalability of operations.',
      'people-organization':
        'Examine talent management, culture, and organizational development capabilities.',
      'technology-data':
        'Assess technology infrastructure, data management, and digital capabilities.',
      'customer-experience':
        'Evaluate customer satisfaction, product development, and experience optimization.',
      'supply-chain':
        'Review supply chain efficiency, vendor relationships, and operational resilience.',
      'risk-compliance':
        'Analyze risk management practices and regulatory compliance capabilities.',
      partnerships:
        'Assess strategic partnerships, ecosystem integration, and external relationships.',
      'customer-success':
        'Evaluate customer lifecycle management, retention, and expansion strategies.',
      'change-management':
        'Review organizational change capabilities and implementation effectiveness.',
    };
    return descriptions[domain];
  };

  const createAssessment = useCallback(
    async (title: string, description: string): Promise<Assessment> => {
      try {
        setError(null);
        setLoading(true);

        // Wait for auth to finish loading
        if (authLoading) {
          throw new Error('Authentication is loading. Please wait a moment and try again.');
        }

        // Get token first as it's most reliable
        const { TokenManager } = await import('@/lib/auth/token-manager');
        const accessToken = TokenManager.getAccessToken();

        // Enhanced authentication check with better error reporting
        console.log('CreateAssessment auth check:', {
          authLoading,
          isAuthenticated,
          hasUser: !!user,
          hasCompany: !!company,
          userEmail: user?.email,
          companyName: company?.name,
          hasToken: !!accessToken,
          tokenLength: accessToken?.length || 0,
        });

        if (!accessToken) {
          console.error('No access token found');
          throw new Error('Authentication token missing. Please log in again.');
        }

        // Try to get user data from AuthContext, fallback to JWT if needed
        let userData = user;
        let companyData = company;

        if (!userData || !userData.email) {
          console.log('User data missing from AuthContext, attempting JWT fallback');

          // Try to extract user from JWT token
          try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            if (payload?.email) {
              userData = {
                id: payload.sub,
                email: payload.email,
                firstName: '',
                lastName: '',
                companyId: payload.companyId,
              } as any;
              console.log('Reconstructed user from JWT:', userData);
            }
          } catch (jwtError) {
            console.error('Failed to extract user from JWT:', jwtError);
          }
        }

        if (!companyData || !companyData.id) {
          console.log('Company data missing from AuthContext, attempting fallback');

          // Try to get company ID from user data or JWT
          const companyId =
            userData?.companyId ||
            (userData as any)?.company?.id ||
            (() => {
              try {
                const payload = JSON.parse(atob(accessToken.split('.')[1]));
                return payload?.companyId;
              } catch {
                return null;
              }
            })();

          if (companyId) {
            companyData = {
              id: companyId,
              name: 'Your Company',
              // Add other required company fields with defaults
              industry: '',
              businessModel: 'other',
              size: '1-10',
              description: '',
              website: '',
              headquarters: '',
              subscription: {
                plan: 'basic',
                status: 'active',
                startDate: new Date().toISOString(),
                endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                features: ['basic_assessment'],
              },
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as any;
            console.log('Reconstructed company from fallback:', companyData);
          }
        }

        // Final validation
        if (!userData || !userData.email) {
          console.error('User data still missing after fallback attempts');
          throw new Error('Authentication required. Please log in again.');
        }

        if (!companyData || !companyData.id) {
          console.error('Company data still missing after fallback attempts');
          throw new Error('Company information missing. Please refresh the page and try again.');
        }

        const response = await assessmentService.createAssessment({
          title,
          description,
          companyName: companyData.name,
          contactEmail: userData.email,
          companyId: companyData.id,
        });

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to create assessment');
        }

        const assessment = response.data!;
        setCurrentAssessment(assessment);
        return assessment;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create assessment';
        console.error('Failed to create assessment:', err);
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [authLoading, isAuthenticated, user, company, setCurrentAssessment, setLoading]
  );

  const navigateToDomain = useCallback(
    async (domain: DomainName): Promise<boolean> => {
      if (!canProgressToDomain(domain)) {
        setError(`Cannot access ${domain} domain yet. Please complete prerequisite domains.`);
        return false;
      }

      setCurrentDomain(domain);
      setError(null);
      return true;
    },
    [canProgressToDomain, setCurrentDomain]
  );

  const canAccessDomain = useCallback(
    (domain: DomainName): boolean => {
      return canProgressToDomain(domain);
    },
    [canProgressToDomain]
  );

  const getCurrentDomainQuestions = useCallback((): Question[] => {
    const currentDomain = workflowState.currentDomain;
    if (!currentDomain || !domainTemplates[currentDomain]) {
      return [];
    }

    const template = domainTemplates[currentDomain];
    let questions = [...template.questions];

    // Add industry-specific questions
    if (industryClassification) {
      if (
        industryClassification.regulatoryClassification === 'heavily-regulated' ||
        industryClassification.regulatoryClassification === 'lightly-regulated'
      ) {
        questions = [...questions, ...template.industrySpecific.regulated.additionalQuestions];
      }

      // Add company stage specific questions
      const stageVariations = template.companyStageVariations[industryClassification.companyStage];
      if (stageVariations.questions) {
        questions = [...questions, ...stageVariations.questions];
      }
    }

    return questions;
  }, [workflowState.currentDomain, domainTemplates, industryClassification]);

  const getIndustrySpecificQuestions = useCallback(
    (domain: DomainName): Question[] => {
      const template = domainTemplates[domain];
      if (!template || !industryClassification) {
        return [];
      }

      let additionalQuestions: Question[] = [];

      // Add regulated industry questions
      if (industryClassification.regulatoryClassification !== 'non-regulated') {
        additionalQuestions = [
          ...additionalQuestions,
          ...template.industrySpecific.regulated.additionalQuestions,
        ];
      }

      // Add company stage specific questions
      const stageVariations = template.companyStageVariations[industryClassification.companyStage];
      if (stageVariations.questions) {
        additionalQuestions = [...additionalQuestions, ...stageVariations.questions];
      }

      return additionalQuestions;
    },
    [domainTemplates, industryClassification]
  );

  const answerQuestion = useCallback(
    async (questionId: string, value: any) => {
      if (!currentAssessment || !workflowState.currentDomain) {
        throw new Error('No active assessment or domain');
      }

      const validationError = validateQuestion(questionId, value);
      if (validationError && validationMode === 'strict') {
        throw new Error(validationError);
      }

      const response: QuestionResponse = {
        questionId,
        value,
        timestamp: new Date().toISOString(),
      };

      updateQuestionResponse(workflowState.currentDomain, questionId, response);

      // Trigger validation after answer
      if (validationMode === 'strict') {
        await validateAssessment();
      }
    },
    [currentAssessment, workflowState.currentDomain, updateQuestionResponse, validationMode]
  );

  const getQuestionResponse = useCallback(
    (questionId: string): QuestionResponse | null => {
      if (!currentAssessment || !workflowState.currentDomain) {
        return null;
      }

      const domainResponse = currentAssessment.domainResponses[workflowState.currentDomain];
      return domainResponse?.questions[questionId] || null;
    },
    [currentAssessment, workflowState.currentDomain]
  );

  const validateQuestion = useCallback(
    (questionId: string, value: any): string | null => {
      const questions = getCurrentDomainQuestions();
      const question = questions.find((q) => q.id === questionId);

      if (!question) {
        return 'Question not found';
      }

      if (question.required && (value === null || value === undefined || value === '')) {
        return 'This question is required';
      }

      if (question.type === 'scale' && question.scale) {
        const numValue = Number(value);
        if (isNaN(numValue) || numValue < question.scale.min || numValue > question.scale.max) {
          return `Value must be between ${question.scale.min} and ${question.scale.max}`;
        }
      }

      if (question.type === 'multiple-choice' && question.options) {
        if (!question.options.includes(value)) {
          return 'Invalid option selected';
        }
      }

      return null;
    },
    [getCurrentDomainQuestions]
  );

  const setIndustryClassificationHandler = useCallback(
    async (classification: IndustryClassification) => {
      try {
        setIndustryClassificationStore(classification);

        if (currentAssessment) {
          await saveAssessment();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save industry classification');
      }
    },
    [setIndustryClassificationStore, currentAssessment, saveAssessment]
  );

  const validateAssessment = useCallback(async (): Promise<AssessmentValidation> => {
    if (!currentAssessment) {
      const validation: AssessmentValidation = {
        isValid: false,
        errors: [{ field: 'assessment', message: 'No assessment found', type: 'required' }],
        warnings: [],
        completeness: 0,
        requiredFieldsMissing: [],
        crossDomainInconsistencies: [],
      };
      setValidation(validation);
      return validation;
    }

    try {
      const { TokenManager } = await import('@/lib/auth/token-manager');
      const token = TokenManager.getAccessToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add authentication header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/assessment/${currentAssessment.id}/validate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          domainResponses: currentAssessment.domainResponses,
          industryClassification,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to validate assessment');
      }

      const validation: AssessmentValidation = await response.json();
      setValidation(validation);
      return validation;
    } catch (err) {
      const validation: AssessmentValidation = {
        isValid: false,
        errors: [{ field: 'validation', message: 'Validation failed', type: 'required' }],
        warnings: [],
        completeness: calculateCompleteness(),
        requiredFieldsMissing: [],
        crossDomainInconsistencies: [],
      };
      setValidation(validation);
      return validation;
    }
  }, [currentAssessment, industryClassification, setValidation, calculateCompleteness]);

  const calculateDomainCompleteness = useCallback(
    (domain: DomainName): number => {
      if (!currentAssessment) return 0;

      const domainResponse = currentAssessment.domainResponses[domain];
      if (!domainResponse) return 0;

      const template = domainTemplates[domain];
      if (!template) return 0;

      const totalQuestions = template.questions.length;
      const answeredQuestions = Object.keys(domainResponse.questions).length;

      return totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
    },
    [currentAssessment, domainTemplates]
  );

  const getRequiredQuestions = useCallback(
    (domain: DomainName): Question[] => {
      const template = domainTemplates[domain];
      if (!template) return [];

      return template.questions.filter((q) => q.required);
    },
    [domainTemplates]
  );

  const getMissingRequiredQuestions = useCallback(
    (domain: DomainName): Question[] => {
      if (!currentAssessment) return [];

      const requiredQuestions = getRequiredQuestions(domain);
      const domainResponse = currentAssessment.domainResponses[domain];

      if (!domainResponse) return requiredQuestions;

      return requiredQuestions.filter((q) => !(q.id in domainResponse.questions));
    },
    [currentAssessment, getRequiredQuestions]
  );

  const listAssessments = useCallback(async (status?: string[]): Promise<ListAssessmentsResult> => {
    try {
      setError(null);

      const response = await assessmentService.getAssessments({
        status: status as any, // Cast to match the service type
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to list assessments');
      }

      return response.data!;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to list assessments';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  const availableDomains: DomainName[] = [
    'strategic-alignment',
    'financial-management',
    'revenue-engine',
    'operational-excellence',
    'people-organization',
    'technology-data',
    'customer-experience',
    'supply-chain',
    'risk-compliance',
    'partnerships',
    'customer-success',
    'change-management',
  ];

  return {
    assessment: currentAssessment,
    isLoading: workflowState.isLoading,
    error,
    validation,

    progress: {
      overall: progressState.overall,
      domains: progressState.domains,
      currentDomain: workflowState.currentDomain,
      completeness: progressState.completeness,
      estimatedTimeRemaining: progressState.estimatedTimeRemaining,
      canProgress: workflowState.canProceed,
    },

    availableDomains,
    getCurrentDomainQuestions,
    navigateToDomain,
    canAccessDomain,

    answerQuestion,
    getQuestionResponse,
    validateQuestion,

    setIndustryClassification: setIndustryClassificationHandler,
    getIndustrySpecificQuestions,

    createAssessment,
    saveAssessment,
    submitAssessment: async () => {
      await submitAssessment();
      return currentAssessment!;
    },
    loadAssessment: loadAssessmentById,
    listAssessments,

    validateAssessment,
    calculateDomainCompleteness,
    getRequiredQuestions,
    getMissingRequiredQuestions,

    enableAutoSave,
    disableAutoSave,
    isAutoSaveEnabled: workflowState.autoSaveEnabled,
    lastAutoSave: workflowState.lastAutoSave,
  };
};
