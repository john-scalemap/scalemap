import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssessmentQuestionnaire } from '../../components/assessment/AssessmentQuestionnaire';
import { Assessment, DomainResponse } from '../../types/assessment';

// Mock the assessment data module
jest.mock('../../data/assessment-questions', () => ({
  assessmentDomains: [
    {
      domain: 'strategic-alignment',
      title: 'Strategic Alignment & Vision',
      description: 'Vision clarity and strategic alignment',
      questions: [
        {
          id: 'sa-1.1',
          type: 'scale',
          question: 'How clearly can your leadership team articulate your company\'s 3-year vision?',
          scale: {
            min: 1,
            max: 5,
            labels: [
              'Crystal clear - everyone gives the same answer',
              'Mostly clear - minor variations in wording',
              'Somewhat clear - general alignment but different emphases',
              'Unclear - significant variations in interpretation',
              'No clear vision - leadership gives contradictory answers'
            ]
          },
          required: true
        },
        {
          id: 'sa-1.2',
          type: 'text',
          question: 'Describe your strategic planning process',
          required: false
        }
      ],
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
        triggerThreshold: 4,
        criticalThreshold: 5,
        weightingFactors: {}
      }
    }
  ],
  getDomainQuestions: jest.fn().mockReturnValue([
    {
      id: 'sa-1.1',
      type: 'scale',
      question: 'How clearly can your leadership team articulate your company\'s 3-year vision?',
      scale: {
        min: 1,
        max: 5,
        labels: [
          'Crystal clear - everyone gives the same answer',
          'Mostly clear - minor variations in wording',
          'Somewhat clear - general alignment but different emphases',
          'Unclear - significant variations in interpretation',
          'No clear vision - leadership gives contradictory answers'
        ]
      },
      required: true
    },
    {
      id: 'sa-1.2',
      type: 'text',
      question: 'Describe your strategic planning process',
      required: false
    }
  ]),
  domainDisplayNames: {
    'strategic-alignment': 'Strategic Alignment & Vision'
  }
}));

const mockAssessment: Assessment = {
  id: 'test-assessment-1',
  companyId: 'test-company-1',
  companyName: 'Test Company',
  contactEmail: 'test@example.com',
  title: 'Test Assessment',
  description: 'A test assessment',
  status: 'document-processing',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  domainResponses: {},
  deliverySchedule: {
    executive24h: '2024-01-02T00:00:00Z',
    detailed48h: '2024-01-03T00:00:00Z',
    implementation72h: '2024-01-04T00:00:00Z'
  },
  clarificationPolicy: {
    allowClarificationUntil: '2024-01-03T00:00:00Z',
    maxClarificationRequests: 3,
    maxTimelineExtension: 24
  }
};

describe('Assessment Flow Integration', () => {
  const mockOnSave = jest.fn();
  const mockOnComplete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render questionnaire with domain questions', () => {
    render(
      <AssessmentQuestionnaire
        assessment={mockAssessment}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('Strategic Alignment & Vision')).toBeInTheDocument();
    expect(screen.getByText('How clearly can your leadership team articulate your company\'s 3-year vision?')).toBeInTheDocument();
    expect(screen.getByText('Describe your strategic planning process')).toBeInTheDocument();
  });

  it('should handle scale question responses', async () => {
    const user = userEvent.setup();

    render(
      <AssessmentQuestionnaire
        assessment={mockAssessment}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    // Select option 3 for the scale question
    const option3 = screen.getByLabelText(/3 - Somewhat clear/);
    await user.click(option3);

    expect(option3).toBeChecked();
  });

  it('should handle text question responses', async () => {
    const user = userEvent.setup();

    render(
      <AssessmentQuestionnaire
        assessment={mockAssessment}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    const textArea = screen.getByPlaceholderText('Enter your response...');
    await user.type(textArea, 'Our strategic planning process involves quarterly reviews and annual goal setting.');

    expect(textArea).toHaveValue('Our strategic planning process involves quarterly reviews and annual goal setting.');
  });

  it('should show validation errors for required questions', async () => {
    const user = userEvent.setup();

    render(
      <AssessmentQuestionnaire
        assessment={mockAssessment}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    // Try to proceed without answering required question
    const nextButton = screen.getByText('Next Domain');
    await user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('This question is required')).toBeInTheDocument();
    });

    expect(mockOnSave).not.toHaveBeenCalled();
  });

  it('should save draft responses', async () => {
    const user = userEvent.setup();
    mockOnSave.mockResolvedValue(undefined);

    render(
      <AssessmentQuestionnaire
        assessment={mockAssessment}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    // Answer the required question
    const option2 = screen.getByLabelText(/2 - Mostly clear/);
    await user.click(option2);

    // Click save draft
    const saveDraftButton = screen.getByText('Save Draft');
    await user.click(saveDraftButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          'strategic-alignment': expect.objectContaining({
            domain: 'strategic-alignment',
            questions: expect.objectContaining({
              'sa-1.1': expect.objectContaining({
                questionId: 'sa-1.1',
                value: 2
              })
            })
          })
        })
      );
    });
  });

  it('should show progress indicator', () => {
    render(
      <AssessmentQuestionnaire
        assessment={mockAssessment}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText('Domain 1 of 1')).toBeInTheDocument();
    expect(screen.getByText(/\d+% Complete/)).toBeInTheDocument();
  });

  it('should handle successful completion', async () => {
    const user = userEvent.setup();
    mockOnSave.mockResolvedValue(undefined);
    mockOnComplete.mockResolvedValue(undefined);

    // Mock a single domain assessment for easier testing
    const singleDomainAssessment = {
      ...mockAssessment,
      domainResponses: {
        'strategic-alignment': {
          domain: 'strategic-alignment' as const,
          questions: {
            'sa-1.1': {
              questionId: 'sa-1.1',
              value: 3,
              timestamp: '2024-01-01T00:00:00Z'
            }
          },
          completeness: 100,
          lastUpdated: '2024-01-01T00:00:00Z'
        }
      }
    };

    render(
      <AssessmentQuestionnaire
        assessment={singleDomainAssessment}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    // Answer the required question
    const option2 = screen.getByLabelText(/2 - Mostly clear/);
    await user.click(option2);

    // Complete assessment (this would be the last domain)
    const completeButton = screen.getByText('Complete Assessment');
    await user.click(completeButton);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  it('should display previous responses when loading existing assessment', () => {
    const assessmentWithResponses = {
      ...mockAssessment,
      domainResponses: {
        'strategic-alignment': {
          domain: 'strategic-alignment' as const,
          questions: {
            'sa-1.1': {
              questionId: 'sa-1.1',
              value: 4,
              timestamp: '2024-01-01T00:00:00Z'
            },
            'sa-1.2': {
              questionId: 'sa-1.2',
              value: 'We have a comprehensive strategic planning process.',
              timestamp: '2024-01-01T00:00:00Z'
            }
          },
          completeness: 100,
          lastUpdated: '2024-01-01T00:00:00Z'
        }
      }
    };

    render(
      <AssessmentQuestionnaire
        assessment={assessmentWithResponses}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    // Check that previous responses are displayed
    const option4 = screen.getByLabelText(/4 - Unclear/);
    expect(option4).toBeChecked();

    const textArea = screen.getByDisplayValue('We have a comprehensive strategic planning process.');
    expect(textArea).toBeInTheDocument();
  });

  it('should handle API errors gracefully', async () => {
    const user = userEvent.setup();
    mockOnSave.mockRejectedValue(new Error('Network error'));

    // Mock console.error to avoid test output noise
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    render(
      <AssessmentQuestionnaire
        assessment={mockAssessment}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    // Answer the required question
    const option2 = screen.getByLabelText(/2 - Mostly clear/);
    await user.click(option2);

    // Try to save
    const saveDraftButton = screen.getByText('Save Draft');
    await user.click(saveDraftButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalled();
    });

    // Error should be logged but component should remain functional
    expect(consoleSpy).toHaveBeenCalledWith('Error saving responses:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should update completeness as questions are answered', async () => {
    const user = userEvent.setup();

    render(
      <AssessmentQuestionnaire
        assessment={mockAssessment}
        onSave={mockOnSave}
        onComplete={mockOnComplete}
      />
    );

    // Initially should show 0% for the domain
    expect(screen.getByText('0% complete')).toBeInTheDocument();

    // Answer the required question
    const option2 = screen.getByLabelText(/2 - Mostly clear/);
    await user.click(option2);

    // Should update to show partial completion
    await waitFor(() => {
      expect(screen.getByText(/\d+% complete/)).toBeInTheDocument();
    });
  });
});