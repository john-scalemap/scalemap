import { jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';

import { Assessment } from '@/types';

import AssessmentCard from '../AssessmentCard';


// Mock Next.js router
jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>;
  };
});

const mockAssessment: Assessment = {
  id: 'test-assessment-123',
  companyId: 'test-company-456',
  companyName: 'Test Company Inc.',
  contactEmail: 'test@example.com',
  title: 'Test Assessment Title',
  description: 'This is a comprehensive test assessment for our company.',
  status: 'document-processing',
  createdAt: '2024-01-01T10:00:00.000Z',
  updatedAt: '2024-01-01T15:30:00.000Z',
  domainResponses: {},
  progress: {
    overall: 35,
    domains: {} as any,
    completeness: 35,
    estimatedTimeRemaining: '30-45 minutes'
  },
  deliverySchedule: {
    executive24h: '2024-01-02T10:00:00.000Z',
    detailed48h: '2024-01-03T10:00:00.000Z',
    implementation72h: '2024-01-04T10:00:00.000Z'
  },
  clarificationPolicy: {
    allowClarificationUntil: 'detailed48h',
    maxClarificationRequests: 3,
    maxTimelineExtension: 86400000
  }
};

describe('AssessmentCard', () => {
  const mockOnResume = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock current time for consistent relative time calculations
    jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T16:00:00.000Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders assessment information correctly', () => {
    render(<AssessmentCard assessment={mockAssessment} onResume={mockOnResume} />);

    expect(screen.getByText('Test Assessment Title')).toBeInTheDocument();
    expect(screen.getByText('Test Company Inc.')).toBeInTheDocument();
    expect(screen.getByText('This is a comprehensive test assessment for our company.')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('shows progress bar for in-progress assessments', () => {
    render(<AssessmentCard assessment={mockAssessment} onResume={mockOnResume} />);

    expect(screen.getByText('Progress')).toBeInTheDocument();
    expect(screen.getByText('35% complete')).toBeInTheDocument();
    expect(screen.getByText('Est. 30-45 minutes remaining')).toBeInTheDocument();

    const progressBar = screen.getByRole('progressbar', { hidden: true });
    expect(progressBar).toHaveStyle({ width: '35%' });
  });

  it('does not show progress bar for completed assessments', () => {
    const completedAssessment: Assessment = {
      ...mockAssessment,
      status: 'completed',
      completedAt: '2024-01-01T16:00:00.000Z'
    };

    render(<AssessmentCard assessment={completedAssessment} onResume={mockOnResume} />);

    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('35% complete')).not.toBeInTheDocument();
  });

  it('shows resume button for resumable assessments', () => {
    render(<AssessmentCard assessment={mockAssessment} onResume={mockOnResume} />);

    const resumeButton = screen.getByText('Resume Assessment');
    expect(resumeButton).toBeInTheDocument();

    fireEvent.click(resumeButton);
    expect(mockOnResume).toHaveBeenCalledTimes(1);
  });

  it('shows view results button for completed assessments', () => {
    const completedAssessment: Assessment = {
      ...mockAssessment,
      status: 'completed',
      completedAt: '2024-01-01T16:00:00.000Z'
    };

    render(<AssessmentCard assessment={completedAssessment} onResume={mockOnResume} />);

    const viewResultsButton = screen.getByText('View Results');
    expect(viewResultsButton).toBeInTheDocument();
    expect(viewResultsButton.closest('a')).toHaveAttribute('href', '/assessment/test-assessment-123/results');

    expect(screen.queryByText('Resume Assessment')).not.toBeInTheDocument();
  });

  it('shows processing status for non-resumable assessments', () => {
    const processingAssessment: Assessment = {
      ...mockAssessment,
      status: 'payment-pending'
    };

    render(<AssessmentCard assessment={processingAssessment} onResume={mockOnResume} />);

    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.queryByText('Resume Assessment')).not.toBeInTheDocument();
  });

  it('displays correct status colors and labels', () => {
    const testCases = [
      { status: 'document-processing' as const, label: 'In Progress', colorClass: 'bg-blue-100 text-blue-800' },
      { status: 'triaging' as const, label: 'Triaging', colorClass: 'bg-yellow-100 text-yellow-800' },
      { status: 'analyzing' as const, label: 'Analyzing', colorClass: 'bg-yellow-100 text-yellow-800' },
      { status: 'synthesizing' as const, label: 'Synthesizing', colorClass: 'bg-orange-100 text-orange-800' },
      { status: 'validating' as const, label: 'Validating', colorClass: 'bg-orange-100 text-orange-800' },
      { status: 'completed' as const, label: 'Completed', colorClass: 'bg-green-100 text-green-800' },
      { status: 'failed' as const, label: 'Failed', colorClass: 'bg-red-100 text-red-800' }
    ];

    testCases.forEach(({ status, label, colorClass }) => {
      const testAssessment: Assessment = { ...mockAssessment, status };
      const { rerender } = render(<AssessmentCard assessment={testAssessment} onResume={mockOnResume} />);

      const statusBadge = screen.getByText(label);
      expect(statusBadge).toBeInTheDocument();
      expect(statusBadge).toHaveClass(colorClass.split(' ')[0]); // Just check first class

      rerender(<div />); // Clean up before next test
    });
  });

  it('formats relative time correctly', () => {
    // Test various time differences
    const testCases = [
      { updatedAt: '2024-01-01T15:59:30.000Z', expected: 'Just now' },
      { updatedAt: '2024-01-01T15:30:00.000Z', expected: '30m ago' },
      { updatedAt: '2024-01-01T14:00:00.000Z', expected: '2h ago' },
      { updatedAt: '2023-12-31T16:00:00.000Z', expected: 'Yesterday' },
      { updatedAt: '2023-12-29T16:00:00.000Z', expected: '3d ago' }
    ];

    testCases.forEach(({ updatedAt, expected }) => {
      const testAssessment: Assessment = { ...mockAssessment, updatedAt };
      const { rerender } = render(<AssessmentCard assessment={testAssessment} onResume={mockOnResume} />);

      expect(screen.getByText(`Updated ${expected}`)).toBeInTheDocument();

      rerender(<div />); // Clean up before next test
    });
  });

  it('handles missing optional fields gracefully', () => {
    const minimalAssessment: Assessment = {
      ...mockAssessment,
      title: undefined,
      description: undefined,
      progress: undefined
    };

    render(<AssessmentCard assessment={minimalAssessment} onResume={mockOnResume} />);

    expect(screen.getByText('Untitled Assessment')).toBeInTheDocument();
    expect(screen.getByText('Test Company Inc.')).toBeInTheDocument();
    expect(screen.queryByText('This is a comprehensive test assessment')).not.toBeInTheDocument();
    expect(screen.getByText('0% complete')).toBeInTheDocument();
  });

  it('includes view details link', () => {
    render(<AssessmentCard assessment={mockAssessment} onResume={mockOnResume} />);

    const viewDetailsLink = screen.getByText('View Details →');
    expect(viewDetailsLink).toBeInTheDocument();
    expect(viewDetailsLink.closest('a')).toHaveAttribute('href', '/assessment/test-assessment-123');
  });

  it('truncates long titles and descriptions appropriately', () => {
    const longAssessment: Assessment = {
      ...mockAssessment,
      title: 'This is an extremely long assessment title that should be truncated because it is way too long for the UI',
      description: 'This is a very long description that should be line-clamped after two lines because we do not want it to take up too much space in the card layout and make the interface look cluttered.'
    };

    render(<AssessmentCard assessment={longAssessment} onResume={mockOnResume} />);

    // The truncation classes should be applied
    const titleElement = screen.getByText(longAssessment.title);
    const descriptionElement = screen.getByText(longAssessment.description);

    expect(titleElement).toHaveClass('truncate');
    expect(descriptionElement).toHaveClass('line-clamp-2');
  });
});