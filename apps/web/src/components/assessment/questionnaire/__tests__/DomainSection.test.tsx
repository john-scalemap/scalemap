import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DomainName, Question, QuestionResponse, DomainProgress, IndustryClassification } from '@/types';

import { DomainSection } from '../DomainSection';


const mockOnAnswer = jest.fn();
const mockOnNext = jest.fn();
const mockOnPrevious = jest.fn();
const mockOnComplete = jest.fn();

const sampleQuestions: Question[] = [
  {
    id: '1.1',
    type: 'multiple-choice',
    question: 'How clearly can your leadership team articulate your company\'s 3-year vision?',
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
    type: 'scale',
    question: 'Rate your strategic planning effectiveness',
    scale: { min: 1, max: 5, labels: ['Poor', 'Excellent'] },
    required: true
  },
  {
    id: '1.3',
    type: 'text',
    question: 'Describe your main strategic challenges',
    required: false
  }
];

const sampleResponses: Record<string, QuestionResponse> = {
  '1.1': {
    questionId: '1.1',
    value: 'Mostly clear - minor variations in wording',
    timestamp: '2024-01-15T10:30:00Z'
  },
  '1.2': {
    questionId: '1.2',
    value: 3,
    timestamp: '2024-01-15T10:35:00Z'
  }
};

const sampleProgress: DomainProgress = {
  completed: 2,
  total: 3,
  score: 3.0,
  status: 'in-progress',
  requiredQuestions: 2,
  optionalQuestions: 1
};

const sampleIndustryClassification: IndustryClassification = {
  sector: 'technology',
  subSector: 'SaaS',
  regulatoryClassification: 'non-regulated',
  businessModel: 'b2b-saas',
  companyStage: 'growth',
  employeeCount: 50
};

describe('DomainSection', () => {
  beforeEach(() => {
    mockOnAnswer.mockClear();
    mockOnNext.mockClear();
    mockOnPrevious.mockClear();
    mockOnComplete.mockClear();
  });

  it('renders domain header with progress information', () => {
    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
      />
    );

    expect(screen.getByText('Strategic Alignment & Vision')).toBeInTheDocument();
    expect(screen.getByText('Assess strategic alignment across the organization')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument(); // 2/3 completed
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('displays progress bars for overall and required questions', () => {
    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
      />
    );

    // Check progress text
    expect(screen.getByText('2 of 3 answered')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument(); // Required questions (2/2)

    // Check progress bars exist
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBeGreaterThanOrEqual(2);
  });

  it('shows question navigation with numbered buttons', () => {
    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
      />
    );

    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();

    // Check numbered navigation buttons
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('navigates between questions using numbered buttons', async () => {
    const user = userEvent.setup();

    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
      />
    );

    // Initially on question 1
    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();

    // Click on question 2 button
    const question2Button = screen.getByRole('button', { name: '2' });
    await user.click(question2Button);

    expect(screen.getByText('Question 2 of 3')).toBeInTheDocument();
  });

  it('shows answered questions with green indicator', () => {
    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
      />
    );

    const question1Button = screen.getByRole('button', { name: '1' });
    const question2Button = screen.getByRole('button', { name: '2' });
    const question3Button = screen.getByRole('button', { name: '3' });

    // Questions 1 and 2 should have answered styling (green)
    expect(question1Button).toHaveClass('bg-green-100', 'text-green-800');
    expect(question2Button).toHaveClass('bg-green-100', 'text-green-800');

    // Question 3 should be unanswered (gray)
    expect(question3Button).toHaveClass('bg-gray-100', 'text-gray-600');
  });

  it('handles question answering', async () => {
    const user = userEvent.setup();

    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
      />
    );

    // Navigate to unanswered question (question 3)
    const question3Button = screen.getByRole('button', { name: '3' });
    await user.click(question3Button);

    // Find the textarea and type in it
    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Market competition is our main challenge');

    await waitFor(() => {
      expect(mockOnAnswer).toHaveBeenCalledWith(
        '1.3',
        'Market competition is our main challenge'
      );
    });
  });

  it('shows previous/next question navigation buttons', async () => {
    const user = userEvent.setup();

    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
      />
    );

    // Should show next question button
    const nextQuestionButton = screen.getByRole('button', { name: 'Next Question' });
    expect(nextQuestionButton).toBeInTheDocument();

    // Previous should be disabled on first question
    const previousQuestionButton = screen.getByRole('button', { name: 'Previous Question' });
    expect(previousQuestionButton).toBeDisabled();

    // Click next
    await user.click(nextQuestionButton);
    expect(screen.getByText('Question 2 of 3')).toBeInTheDocument();

    // Now previous should be enabled
    expect(previousQuestionButton).not.toBeDisabled();
  });

  it('shows domain completion and next domain buttons on last question', async () => {
    const user = userEvent.setup();

    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
        onNext={mockOnNext}
        onComplete={mockOnComplete}
        canProceed={true}
      />
    );

    // Navigate to last question
    const question3Button = screen.getByRole('button', { name: '3' });
    await user.click(question3Button);

    // Should show complete domain and next domain buttons
    expect(screen.getByRole('button', { name: 'Complete Domain' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Domain' })).toBeInTheDocument();

    // Test complete domain functionality
    const completeDomainButton = screen.getByRole('button', { name: 'Complete Domain' });
    await user.click(completeDomainButton);

    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('filters questions based on industry classification', () => {
    const questionsWithIndustrySpecific: Question[] = [
      ...sampleQuestions,
      {
        id: '1.7',
        type: 'multiple-choice',
        question: 'How well integrated is regulatory compliance?',
        options: ['Fully integrated', 'Well integrated', 'Moderately integrated'],
        required: false,
        industrySpecific: {
          regulated: true
        }
      }
    ];

    // Non-regulated industry should not show regulated question
    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={questionsWithIndustrySpecific}
        responses={sampleResponses}
        progress={sampleProgress}
        industryClassification={sampleIndustryClassification}
        onAnswer={mockOnAnswer}
      />
    );

    // Should only show 3 questions, not 4 (regulatory question filtered out)
    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
    expect(screen.queryByText('Question 1 of 4')).not.toBeInTheDocument();
  });

  it('shows domain summary with completion requirements', () => {
    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
      />
    );

    expect(screen.getByText('Domain Summary')).toBeInTheDocument();
    expect(screen.getByText('Total Questions:')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Required:')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Optional:')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows completion warning when required questions are incomplete', () => {
    const incompleteProgress: DomainProgress = {
      ...sampleProgress,
      completed: 1, // Only 1 out of 2 required questions completed
    };

    const incompleteResponses = {
      '1.1': sampleResponses['1.1']
      // Missing '1.2' response
    };

    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={incompleteResponses}
        progress={incompleteProgress}
        onAnswer={mockOnAnswer}
      />
    );

    expect(screen.getByText(/Complete at least 80% of required questions/)).toBeInTheDocument();
  });

  it('handles empty question list gracefully', () => {
    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={[]}
        responses={{}}
        progress={{
          completed: 0,
          total: 0,
          status: 'not-started',
          requiredQuestions: 0,
          optionalQuestions: 0
        }}
        onAnswer={mockOnAnswer}
      />
    );

    expect(screen.getByText('No questions available for this domain based on your company profile.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to Next Domain' })).toBeInTheDocument();
  });

  it('shows conditional questions based on previous responses', () => {
    const conditionalQuestion: Question = {
      id: '1.4',
      type: 'text',
      question: 'What specific challenges do you face?',
      required: false,
      conditional: {
        dependsOn: '1.1',
        showIf: ['Unclear - significant variations in interpretation', 'No clear vision - leadership gives contradictory answers']
      }
    };

    const questionsWithConditional = [...sampleQuestions, conditionalQuestion];

    // Conditional question should not be shown initially
    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={questionsWithConditional}
        responses={sampleResponses}
        progress={sampleProgress}
        onAnswer={mockOnAnswer}
      />
    );

    // Should still show 3 questions (conditional not triggered)
    expect(screen.getByText('Question 1 of 3')).toBeInTheDocument();
  });

  it('disables next question button for required questions without answers', async () => {
    const user = userEvent.setup();

    const emptyResponses = {};
    const emptyProgress: DomainProgress = {
      completed: 0,
      total: 3,
      status: 'not-started',
      requiredQuestions: 2,
      optionalQuestions: 1
    };

    render(
      <DomainSection
        domain="strategic-alignment"
        title="Strategic Alignment & Vision"
        description="Assess strategic alignment across the organization"
        questions={sampleQuestions}
        responses={emptyResponses}
        progress={emptyProgress}
        onAnswer={mockOnAnswer}
      />
    );

    const nextQuestionButton = screen.getByRole('button', { name: 'Next Question' });

    // Should be disabled for required unanswered question
    expect(nextQuestionButton).toBeDisabled();
  });
});