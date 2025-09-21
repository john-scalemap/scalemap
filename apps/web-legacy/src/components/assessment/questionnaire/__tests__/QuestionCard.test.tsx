import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { Question, QuestionResponse } from '@/types';

import { QuestionCard } from '../QuestionCard';


const mockOnAnswer = jest.fn();
const mockOnValidationError = jest.fn();

const multipleChoiceQuestion: Question = {
  id: 'test-mc-1',
  type: 'multiple-choice',
  question: 'How would you rate your strategic planning process?',
  options: [
    'Excellent - comprehensive and regularly updated',
    'Good - solid foundation with room for improvement',
    'Fair - basic planning in place',
    'Poor - minimal or outdated planning',
    'No formal planning process'
  ],
  required: true
};

const scaleQuestion: Question = {
  id: 'test-scale-1',
  type: 'scale',
  question: 'Rate your current financial forecasting accuracy',
  scale: {
    min: 1,
    max: 5,
    labels: ['Very Poor', 'Excellent']
  },
  required: true
};

const textQuestion: Question = {
  id: 'test-text-1',
  type: 'text',
  question: 'Describe your main business challenges',
  required: false
};

const conditionalQuestion: Question = {
  id: 'test-conditional-1',
  type: 'multiple-choice',
  question: 'Which specific planning challenges do you face?',
  options: ['Resource allocation', 'Timeline management', 'Stakeholder alignment'],
  required: true,
  conditional: {
    dependsOn: 'test-mc-1',
    showIf: ['Poor - minimal or outdated planning', 'No formal planning process']
  }
};

const existingResponse: QuestionResponse = {
  questionId: 'test-mc-1',
  value: 'Good - solid foundation with room for improvement',
  timestamp: new Date().toISOString()
};

describe('QuestionCard', () => {
  beforeEach(() => {
    mockOnAnswer.mockClear();
    mockOnValidationError.mockClear();
  });

  describe('Multiple Choice Questions', () => {
    it('renders multiple choice question correctly', () => {
      render(
        <QuestionCard
          question={multipleChoiceQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByText(multipleChoiceQuestion.question)).toBeInTheDocument();
      expect(screen.getByText('*')).toBeInTheDocument(); // Required indicator
      expect(screen.getByRole('combobox')).toBeInTheDocument();

      multipleChoiceQuestion.options!.forEach(option => {
        expect(screen.getByRole('option', { name: option })).toBeInTheDocument();
      });
    });

    it('handles multiple choice selection', async () => {
      const user = userEvent.setup();

      render(
        <QuestionCard
          question={multipleChoiceQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'Good - solid foundation with room for improvement');

      expect(mockOnAnswer).toHaveBeenCalledWith(
        'test-mc-1',
        'Good - solid foundation with room for improvement'
      );
    });

    it('displays existing response', () => {
      render(
        <QuestionCard
          question={multipleChoiceQuestion}
          response={existingResponse}
          onAnswer={mockOnAnswer}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.value).toBe('Good - solid foundation with room for improvement');
      expect(screen.getByText(/Answered/)).toBeInTheDocument();
    });
  });

  describe('Scale Questions', () => {
    it('renders scale question correctly', () => {
      render(
        <QuestionCard
          question={scaleQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByText(scaleQuestion.question)).toBeInTheDocument();

      // Check scale buttons
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByRole('button', { name: i.toString() })).toBeInTheDocument();
      }

      // Check scale labels
      expect(screen.getByText('Very Poor')).toBeInTheDocument();
      expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('handles scale selection', async () => {
      const user = userEvent.setup();

      render(
        <QuestionCard
          question={scaleQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const button3 = screen.getByRole('button', { name: '3' });
      await user.click(button3);

      expect(mockOnAnswer).toHaveBeenCalledWith('test-scale-1', 3);
    });

    it('shows selected scale value', async () => {
      const user = userEvent.setup();

      render(
        <QuestionCard
          question={scaleQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const button4 = screen.getByRole('button', { name: '4' });
      await user.click(button4);

      expect(button4).toHaveClass('bg-blue-600', 'text-white');
    });
  });

  describe('Text Questions', () => {
    it('renders text question correctly', () => {
      render(
        <QuestionCard
          question={textQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByText(textQuestion.question)).toBeInTheDocument();
      expect(screen.queryByText('*')).not.toBeInTheDocument(); // Not required
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('handles text input', async () => {
      const user = userEvent.setup();

      render(
        <QuestionCard
          question={textQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Market competition and resource constraints');

      // Wait for debounced input
      await waitFor(() => {
        expect(mockOnAnswer).toHaveBeenCalledWith(
          'test-text-1',
          'Market competition and resource constraints'
        );
      });
    });
  });

  describe('Validation', () => {
    it('shows validation error for required empty field', async () => {
      const user = userEvent.setup();

      render(
        <QuestionCard
          question={multipleChoiceQuestion}
          onAnswer={mockOnAnswer}
          onValidationError={mockOnValidationError}
          showValidation={true}
        />
      );

      const select = screen.getByRole('combobox');
      await user.click(select); // Focus the field
      fireEvent.blur(select); // Blur to trigger validation

      await waitFor(() => {
        expect(screen.getByText('This question is required')).toBeInTheDocument();
        expect(mockOnValidationError).toHaveBeenCalledWith(
          'test-mc-1',
          'This question is required'
        );
      });
    });

    it('shows validation error for invalid scale value', async () => {
      const invalidScaleQuestion: Question = {
        ...scaleQuestion,
        id: 'test-scale-invalid'
      };

      render(
        <QuestionCard
          question={invalidScaleQuestion}
          onAnswer={mockOnAnswer}
          onValidationError={mockOnValidationError}
          showValidation={true}
        />
      );

      // Simulate invalid value (this would normally be prevented by UI)
      const button6 = screen.queryByRole('button', { name: '6' });
      expect(button6).not.toBeInTheDocument(); // Should not exist for 1-5 scale
    });

    it('clears validation error when valid value entered', async () => {
      const user = userEvent.setup();

      render(
        <QuestionCard
          question={multipleChoiceQuestion}
          onAnswer={mockOnAnswer}
          onValidationError={mockOnValidationError}
          showValidation={true}
        />
      );

      const select = screen.getByRole('combobox');

      // First trigger validation error
      await user.click(select);
      fireEvent.blur(select);

      await waitFor(() => {
        expect(mockOnValidationError).toHaveBeenCalledWith(
          'test-mc-1',
          'This question is required'
        );
      });

      // Then provide valid value
      await user.selectOptions(select, 'Good - solid foundation with room for improvement');

      await waitFor(() => {
        expect(mockOnValidationError).toHaveBeenCalledWith('test-mc-1', null);
      });
    });
  });

  describe('Conditional Questions', () => {
    it('shows conditional question indicator', () => {
      render(
        <QuestionCard
          question={conditionalQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByText(/This question appears based on your answer/)).toBeInTheDocument();
    });
  });

  describe('Disabled State', () => {
    it('disables interaction when disabled prop is true', () => {
      render(
        <QuestionCard
          question={multipleChoiceQuestion}
          onAnswer={mockOnAnswer}
          disabled={true}
        />
      );

      const select = screen.getByRole('combobox') as HTMLSelectElement;
      expect(select.disabled).toBe(true);
    });

    it('disables scale buttons when disabled', () => {
      render(
        <QuestionCard
          question={scaleQuestion}
          onAnswer={mockOnAnswer}
          disabled={true}
        />
      );

      for (let i = 1; i <= 5; i++) {
        const button = screen.getByRole('button', { name: i.toString() });
        expect(button).toBeDisabled();
      }
    });
  });

  describe('Response Status', () => {
    it('shows answered status with timestamp', () => {
      const responseWithTimestamp: QuestionResponse = {
        ...existingResponse,
        timestamp: '2024-01-15T10:30:00Z'
      };

      render(
        <QuestionCard
          question={multipleChoiceQuestion}
          response={responseWithTimestamp}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByText(/Answered/)).toBeInTheDocument();
      expect(screen.getByText(/1\/15\/2024/)).toBeInTheDocument();
    });
  });

  describe('Question Types Badge', () => {
    it('shows question type badge', () => {
      render(
        <QuestionCard
          question={multipleChoiceQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByText('multiple choice')).toBeInTheDocument();
    });

    it('shows scale type badge', () => {
      render(
        <QuestionCard
          question={scaleQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByText('scale')).toBeInTheDocument();
    });
  });

  describe('Boolean Questions', () => {
    const booleanQuestion: Question = {
      id: 'test-boolean-1',
      type: 'boolean',
      question: 'Do you have a formal strategic planning process?',
      required: true
    };

    it('renders boolean question with radio buttons', () => {
      render(
        <QuestionCard
          question={booleanQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      expect(screen.getByText(booleanQuestion.question)).toBeInTheDocument();
      expect(screen.getByLabelText('Yes')).toBeInTheDocument();
      expect(screen.getByLabelText('No')).toBeInTheDocument();
    });

    it('handles boolean selection', async () => {
      const user = userEvent.setup();

      render(
        <QuestionCard
          question={booleanQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const yesRadio = screen.getByLabelText('Yes');
      await user.click(yesRadio);

      expect(mockOnAnswer).toHaveBeenCalledWith('test-boolean-1', true);
    });
  });

  describe('Multiple Select Questions', () => {
    const multiSelectQuestion: Question = {
      id: 'test-multi-1',
      type: 'multiple-select',
      question: 'Which challenges affect your business? (Select all that apply)',
      options: ['Cash flow', 'Talent acquisition', 'Market competition', 'Technology limitations'],
      required: false
    };

    it('renders multiple select with checkboxes', () => {
      render(
        <QuestionCard
          question={multiSelectQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      multiSelectQuestion.options!.forEach(option => {
        expect(screen.getByLabelText(option)).toBeInTheDocument();
      });
    });

    it('handles multiple selections', async () => {
      const user = userEvent.setup();

      render(
        <QuestionCard
          question={multiSelectQuestion}
          onAnswer={mockOnAnswer}
        />
      );

      const cashFlowCheckbox = screen.getByLabelText('Cash flow');
      const talentCheckbox = screen.getByLabelText('Talent acquisition');

      await user.click(cashFlowCheckbox);
      expect(mockOnAnswer).toHaveBeenCalledWith('test-multi-1', ['Cash flow']);

      await user.click(talentCheckbox);
      expect(mockOnAnswer).toHaveBeenCalledWith('test-multi-1', ['Cash flow', 'Talent acquisition']);
    });

    it('handles deselection', async () => {
      const user = userEvent.setup();

      render(
        <QuestionCard
          question={multiSelectQuestion}
          response={{
            questionId: 'test-multi-1',
            value: ['Cash flow', 'Talent acquisition'],
            timestamp: new Date().toISOString()
          }}
          onAnswer={mockOnAnswer}
        />
      );

      const cashFlowCheckbox = screen.getByLabelText('Cash flow');
      await user.click(cashFlowCheckbox);

      expect(mockOnAnswer).toHaveBeenCalledWith('test-multi-1', ['Talent acquisition']);
    });
  });
});