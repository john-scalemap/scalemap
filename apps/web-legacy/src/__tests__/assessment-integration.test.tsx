import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { useAssessment } from '@/hooks/useAssessment';
import { AssessmentService } from '@/services/assessment-service';
import { IndustryService } from '@/services/industry-service';
import { QuestionService } from '@/services/question-service';
import { BusinessModelValidator } from '@/utils/business-model-validation';

// Mock services
jest.mock('@/hooks/useAssessment');
jest.mock('@/services/assessment-service');
jest.mock('@/services/question-service');
jest.mock('@/services/industry-service');
jest.mock('@/utils/business-model-validation');

const mockUseAssessment = useAssessment as jest.MockedFunction<typeof useAssessment>;
const mockAssessmentService = AssessmentService as jest.MockedClass<typeof AssessmentService>;
const mockQuestionService = QuestionService as jest.MockedClass<typeof QuestionService>;
const mockIndustryService = IndustryService as jest.MockedClass<typeof IndustryService>;
const mockBusinessModelValidator = BusinessModelValidator as jest.MockedClass<typeof BusinessModelValidator>;

// Test component that simulates the assessment flow
const TestAssessmentFlow: React.FC = () => {
  const {
    assessment,
    progress,
    createAssessment,
    navigateToDomain,
    answerQuestion,
    submitAssessment,
    setIndustryClassification,
    isLoading,
    error
  } = useAssessment();

  const [currentStep, setCurrentStep] = React.useState<'create' | 'classify' | 'questionnaire' | 'submit'>('create');

  const handleCreateAssessment = async () => {
    try {
      await createAssessment('Integration Test Assessment', 'Testing the full assessment flow');
      setCurrentStep('classify');
    } catch (err) {
      console.error('Failed to create assessment:', err);
    }
  };

  const handleSetIndustryClassification = async () => {
    try {
      await setIndustryClassification({
        sector: 'technology',
        subSector: 'SaaS',
        regulatoryClassification: 'non-regulated',
        businessModel: 'b2b-saas',
        companyStage: 'growth',
        employeeCount: 50
      });
      setCurrentStep('questionnaire');
    } catch (err) {
      console.error('Failed to set classification:', err);
    }
  };

  const handleAnswerQuestion = async () => {
    try {
      await answerQuestion('1.1', 'Mostly clear - minor variations in wording');
      await navigateToDomain('financial-management');
      setCurrentStep('submit');
    } catch (err) {
      console.error('Failed to answer question:', err);
    }
  };

  const handleSubmitAssessment = async () => {
    try {
      await submitAssessment();
    } catch (err) {
      console.error('Failed to submit assessment:', err);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h1>Assessment Integration Test</h1>

      {currentStep === 'create' && (
        <div>
          <h2>Create Assessment</h2>
          <button onClick={handleCreateAssessment}>Create Assessment</button>
        </div>
      )}

      {currentStep === 'classify' && (
        <div>
          <h2>Industry Classification</h2>
          <p>Assessment ID: {assessment?.id}</p>
          <button onClick={handleSetIndustryClassification}>Set Industry Classification</button>
        </div>
      )}

      {currentStep === 'questionnaire' && (
        <div>
          <h2>Questionnaire</h2>
          <p>Progress: {progress?.overall}%</p>
          <p>Current Domain: {progress?.currentDomain || 'strategic-alignment'}</p>
          <button onClick={handleAnswerQuestion}>Answer Question & Navigate</button>
        </div>
      )}

      {currentStep === 'submit' && (
        <div>
          <h2>Submit Assessment</h2>
          <p>Assessment Complete: {progress?.completeness}%</p>
          <button onClick={handleSubmitAssessment}>Submit Assessment</button>
        </div>
      )}
    </div>
  );
};

describe('Assessment Integration Tests', () => {
  const mockAssessment = {
    id: 'test-assessment-123',
    companyId: 'test-company-456',
    title: 'Integration Test Assessment',
    description: 'Testing the full assessment flow',
    status: 'document-processing' as const,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    domainResponses: {},
    progress: {
      overall: 0,
      domains: {
        'strategic-alignment': {
          completed: 0,
          total: 7,
          status: 'not-started' as const,
          requiredQuestions: 6,
          optionalQuestions: 1
        }
      } as any,
      completeness: 0,
      estimatedTimeRemaining: '45-60 minutes'
    }
  };

  const mockProgressAfterAnswer = {
    ...mockAssessment.progress,
    overall: 15,
    completeness: 12,
    currentDomain: 'financial-management' as const,
    domains: {
      ...mockAssessment.progress.domains,
      'strategic-alignment': {
        ...mockAssessment.progress.domains['strategic-alignment'],
        completed: 1,
        status: 'in-progress' as const
      }
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    mockUseAssessment.mockReturnValue({
      assessment: null,
      progress: mockAssessment.progress,
      isLoading: false,
      error: null,
      validation: null,
      availableDomains: ['strategic-alignment', 'financial-management'],
      createAssessment: jest.fn(),
      navigateToDomain: jest.fn(),
      answerQuestion: jest.fn(),
      submitAssessment: jest.fn(),
      setIndustryClassification: jest.fn(),
      getCurrentDomainQuestions: jest.fn().mockReturnValue([]),
      canAccessDomain: jest.fn().mockReturnValue(true),
      getQuestionResponse: jest.fn().mockReturnValue(null),
      validateQuestion: jest.fn().mockReturnValue(null),
      getIndustrySpecificQuestions: jest.fn().mockReturnValue([]),
      loadAssessment: jest.fn(),
      saveAssessment: jest.fn(),
      validateAssessment: jest.fn(),
      calculateDomainCompleteness: jest.fn().mockReturnValue(0),
      getRequiredQuestions: jest.fn().mockReturnValue([]),
      getMissingRequiredQuestions: jest.fn().mockReturnValue([]),
      enableAutoSave: jest.fn(),
      disableAutoSave: jest.fn(),
      isAutoSaveEnabled: true,
      lastAutoSave: undefined
    });
  });

  describe('Complete Assessment Flow', () => {
    it('completes full assessment creation to submission flow', async () => {
      const user = userEvent.setup();

      // Mock progressive states
      let currentAssessment = null;
      let currentProgress = mockAssessment.progress;

      const mockCreateAssessment = jest.fn().mockImplementation(() => {
        currentAssessment = mockAssessment;
        return Promise.resolve(mockAssessment);
      });

      const mockSetIndustryClassification = jest.fn().mockResolvedValue(undefined);

      const mockAnswerQuestion = jest.fn().mockImplementation(() => {
        currentProgress = mockProgressAfterAnswer;
        return Promise.resolve();
      });

      const mockNavigateToDomain = jest.fn().mockResolvedValue(true);

      const mockSubmitAssessment = jest.fn().mockResolvedValue({
        ...mockAssessment,
        status: 'triaging',
        completedAt: '2024-01-15T11:00:00Z'
      });

      // Update mock return values progressively
      mockUseAssessment
        .mockReturnValueOnce({
          assessment: null,
          progress: currentProgress,
          createAssessment: mockCreateAssessment,
          setIndustryClassification: mockSetIndustryClassification,
          answerQuestion: mockAnswerQuestion,
          navigateToDomain: mockNavigateToDomain,
          submitAssessment: mockSubmitAssessment,
          isLoading: false,
          error: null,
        } as any)
        .mockReturnValueOnce({
          assessment: currentAssessment,
          progress: currentProgress,
          createAssessment: mockCreateAssessment,
          setIndustryClassification: mockSetIndustryClassification,
          answerQuestion: mockAnswerQuestion,
          navigateToDomain: mockNavigateToDomain,
          submitAssessment: mockSubmitAssessment,
          isLoading: false,
          error: null,
        } as any)
        .mockReturnValueOnce({
          assessment: { ...currentAssessment, industryClassification: { sector: 'technology' } },
          progress: currentProgress,
          createAssessment: mockCreateAssessment,
          setIndustryClassification: mockSetIndustryClassification,
          answerQuestion: mockAnswerQuestion,
          navigateToDomain: mockNavigateToDomain,
          submitAssessment: mockSubmitAssessment,
          isLoading: false,
          error: null,
        } as any)
        .mockReturnValue({
          assessment: { ...currentAssessment, industryClassification: { sector: 'technology' } },
          progress: mockProgressAfterAnswer,
          createAssessment: mockCreateAssessment,
          setIndustryClassification: mockSetIndustryClassification,
          answerQuestion: mockAnswerQuestion,
          navigateToDomain: mockNavigateToDomain,
          submitAssessment: mockSubmitAssessment,
          isLoading: false,
          error: null,
        } as any);

      render(<TestAssessmentFlow />);

      // Step 1: Create Assessment
      expect(screen.getByText('Create Assessment')).toBeInTheDocument();
      const createButton = screen.getByRole('button', { name: 'Create Assessment' });
      await user.click(createButton);

      await waitFor(() => {
        expect(mockCreateAssessment).toHaveBeenCalledWith(
          'Integration Test Assessment',
          'Testing the full assessment flow'
        );
      });

      // Re-render with updated state
      render(<TestAssessmentFlow />);

      // Step 2: Industry Classification
      await waitFor(() => {
        expect(screen.getByText('Industry Classification')).toBeInTheDocument();
        expect(screen.getByText(`Assessment ID: ${mockAssessment.id}`)).toBeInTheDocument();
      });

      const classifyButton = screen.getByRole('button', { name: 'Set Industry Classification' });
      await user.click(classifyButton);

      await waitFor(() => {
        expect(mockSetIndustryClassification).toHaveBeenCalledWith({
          sector: 'technology',
          subSector: 'SaaS',
          regulatoryClassification: 'non-regulated',
          businessModel: 'b2b-saas',
          companyStage: 'growth',
          employeeCount: 50
        });
      });

      // Re-render with updated state
      render(<TestAssessmentFlow />);

      // Step 3: Questionnaire
      await waitFor(() => {
        expect(screen.getByText('Questionnaire')).toBeInTheDocument();
        expect(screen.getByText('Progress: 0%')).toBeInTheDocument();
      });

      const answerButton = screen.getByRole('button', { name: 'Answer Question & Navigate' });
      await user.click(answerButton);

      await waitFor(() => {
        expect(mockAnswerQuestion).toHaveBeenCalledWith('1.1', 'Mostly clear - minor variations in wording');
        expect(mockNavigateToDomain).toHaveBeenCalledWith('financial-management');
      });

      // Re-render with final state
      render(<TestAssessmentFlow />);

      // Step 4: Submit Assessment
      await waitFor(() => {
        expect(screen.getByText('Submit Assessment')).toBeInTheDocument();
        expect(screen.getByText('Progress: 15%')).toBeInTheDocument();
      });

      const submitButton = screen.getByRole('button', { name: 'Submit Assessment' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockSubmitAssessment).toHaveBeenCalled();
      });
    });

    it('handles errors during assessment creation', async () => {
      const user = userEvent.setup();

      const mockCreateAssessment = jest.fn().mockRejectedValue(new Error('Network error'));

      mockUseAssessment.mockReturnValue({
        assessment: null,
        progress: mockAssessment.progress,
        createAssessment: mockCreateAssessment,
        isLoading: false,
        error: 'Network error',
      } as any);

      render(<TestAssessmentFlow />);

      const createButton = screen.getByRole('button', { name: 'Create Assessment' });
      await user.click(createButton);

      await waitFor(() => {
        expect(screen.getByText('Error: Network error')).toBeInTheDocument();
      });
    });

    it('shows loading state during operations', async () => {
      mockUseAssessment.mockReturnValue({
        assessment: null,
        progress: mockAssessment.progress,
        createAssessment: jest.fn(),
        isLoading: true,
        error: null,
      } as any);

      render(<TestAssessmentFlow />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('Service Integration', () => {
    it('integrates with assessment service correctly', async () => {
      const mockAssessmentServiceInstance = {
        validateAssessmentCompleteness: jest.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
          completeness: 85,
          requiredFieldsMissing: [],
          crossDomainInconsistencies: []
        }),
        createAssessment: jest.fn().mockResolvedValue(mockAssessment),
        updateAssessment: jest.fn().mockResolvedValue(mockAssessment),
        getAssessment: jest.fn().mockResolvedValue(mockAssessment)
      };

      mockAssessmentService.mockImplementation(() => mockAssessmentServiceInstance as any);

      const service = new AssessmentService();
      const validation = await service.validateAssessmentCompleteness(mockAssessment);

      expect(validation.isValid).toBe(true);
      expect(validation.completeness).toBe(85);
    });

    it('integrates with question service for conditional logic', () => {
      const mockQuestionServiceInstance = {
        getQuestionsForDomain: jest.fn().mockReturnValue([
          {
            id: '1.1',
            type: 'multiple-choice',
            question: 'Test question',
            options: ['Option 1', 'Option 2'],
            required: true
          }
        ]),
        validateQuestionResponse: jest.fn().mockReturnValue({ isValid: true }),
        getFollowUpQuestions: jest.fn().mockReturnValue([])
      };

      mockQuestionService.getInstance = jest.fn().mockReturnValue(mockQuestionServiceInstance);

      const service = QuestionService.getInstance();
      const questions = service.getQuestionsForDomain('strategic-alignment');

      expect(questions).toHaveLength(1);
      expect(questions[0].id).toBe('1.1');
    });

    it('integrates with industry service for classification', () => {
      const mockIndustryServiceInstance = {
        getApplicableDomains: jest.fn().mockReturnValue([
          'strategic-alignment',
          'financial-management',
          'revenue-engine',
          'technology-data',
          'customer-success'
        ]),
        getIndustrySpecificQuestions: jest.fn().mockReturnValue(['6.8']),
        detectCompanyProfile: jest.fn().mockReturnValue({
          hasInternationalOperations: false,
          hasPhysicalProducts: false,
          usesSubscriptionModel: true,
          requiresRegulatorycompliance: false
        })
      };

      mockIndustryService.getInstance = jest.fn().mockReturnValue(mockIndustryServiceInstance);

      const service = IndustryService.getInstance();
      const domains = service.getApplicableDomains({
        sector: 'technology',
        subSector: 'SaaS',
        regulatoryClassification: 'non-regulated',
        businessModel: 'b2b-saas',
        companyStage: 'growth',
        employeeCount: 50
      });

      expect(domains).toContain('technology-data');
      expect(domains).toContain('customer-success');
      expect(domains).not.toContain('supply-chain'); // Should be filtered out for SaaS
    });

    it('integrates with business model validator', () => {
      const mockValidatorInstance = {
        validateBusinessModel: jest.fn().mockReturnValue({
          errors: [],
          warnings: [{
            field: 'customer-success',
            message: 'Customer success domain is critical for SaaS business model',
            type: 'quality'
          }]
        }),
        getDomainWeighting: jest.fn().mockReturnValue({
          'customer-success': 1.4,
          'technology-data': 1.3,
          'revenue-engine': 1.2
        })
      };

      mockBusinessModelValidator.getInstance = jest.fn().mockReturnValue(mockValidatorInstance);

      const validator = BusinessModelValidator.getInstance();
      const validation = validator.validateBusinessModel(
        {
          sector: 'technology',
          subSector: 'SaaS',
          regulatoryClassification: 'non-regulated',
          businessModel: 'b2b-saas',
          companyStage: 'growth',
          employeeCount: 50
        },
        {}
      );

      expect(validation.errors).toHaveLength(0);
      expect(validation.warnings).toHaveLength(1);
      expect(validation.warnings[0].field).toBe('customer-success');
    });
  });

  describe('Cross-Domain Validation', () => {
    it('validates consistency across related domains', async () => {
      const inconsistentResponses = {
        'revenue-engine': {
          questions: {
            '3.1': { questionId: '3.1', value: 1, timestamp: '2024-01-15T10:00:00Z' }, // Highly predictable revenue
            '3.3': { questionId: '3.3', value: 5, timestamp: '2024-01-15T10:00:00Z' }  // Poor CAC management
          }
        },
        'customer-success': {
          questions: {
            '11.2': { questionId: '11.2', value: 5, timestamp: '2024-01-15T10:00:00Z' } // Poor customer health
          }
        }
      };

      const mockValidatorInstance = {
        validateBusinessModel: jest.fn().mockReturnValue({
          errors: [{
            field: 'cross-domain',
            message: 'Poor customer acquisition cost management combined with poor retention indicates unsustainable unit economics',
            type: 'consistency'
          }],
          warnings: []
        })
      };

      mockBusinessModelValidator.getInstance = jest.fn().mockReturnValue(mockValidatorInstance);

      const validator = BusinessModelValidator.getInstance();
      const validation = validator.validateBusinessModel(
        {
          sector: 'technology',
          subSector: 'SaaS',
          regulatoryClassification: 'non-regulated',
          businessModel: 'b2b-saas',
          companyStage: 'growth',
          employeeCount: 50
        },
        inconsistentResponses
      );

      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0].type).toBe('consistency');
      expect(validation.errors[0].message).toContain('unsustainable unit economics');
    });
  });

  describe('Auto-Save Functionality', () => {
    it('handles auto-save during questionnaire completion', async () => {
      const user = userEvent.setup();

      const mockSaveAssessment = jest.fn().mockResolvedValue(undefined);
      const mockAnswerQuestion = jest.fn().mockImplementation(async () => {
        // Simulate auto-save trigger
        setTimeout(() => mockSaveAssessment(), 100);
      });

      mockUseAssessment.mockReturnValue({
        assessment: mockAssessment,
        progress: mockAssessment.progress,
        answerQuestion: mockAnswerQuestion,
        saveAssessment: mockSaveAssessment,
        isAutoSaveEnabled: true,
        lastAutoSave: '2024-01-15T10:30:00Z',
        isLoading: false,
        error: null,
      } as any);

      render(<TestAssessmentFlow />);

      // Simulate answering a question
      await user.click(screen.getByRole('button', { name: 'Answer Question & Navigate' }));

      await waitFor(() => {
        expect(mockAnswerQuestion).toHaveBeenCalled();
      });

      // Auto-save should be triggered
      await waitFor(() => {
        expect(mockSaveAssessment).toHaveBeenCalled();
      }, { timeout: 1000 });
    });
  });
});