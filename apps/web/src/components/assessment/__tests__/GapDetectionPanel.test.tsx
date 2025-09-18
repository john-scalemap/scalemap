import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import '@testing-library/jest-dom';
import { AssessmentGap } from '@/types';

import { useGapAnalysis } from '../../../hooks/useGapAnalysis';
import { GapDetectionPanel } from '../gap-detection/GapDetectionPanel';


// Mock the useGapAnalysis hook
jest.mock('../../../hooks/useGapAnalysis');

const mockUseGapAnalysis = useGapAnalysis as jest.MockedFunction<typeof useGapAnalysis>;

describe('GapDetectionPanel', () => {
  const mockProps = {
    assessmentId: 'test-assessment-123',
    currentDomain: 'strategic-alignment' as const,
    isVisible: true,
    onToggleVisibility: jest.fn()
  };

  const mockGaps: AssessmentGap[] = [
    {
      gapId: 'gap-1',
      assessmentId: 'test-assessment-123',
      domain: 'strategic-alignment',
      category: 'critical',
      description: 'Missing strategic vision details',
      detectedAt: new Date().toISOString(),
      suggestedQuestions: [
        'What is your company\'s strategic vision?',
        'How do you communicate strategy across teams?'
      ],
      followUpPrompts: [
        'Please provide specific examples',
        'Additional context would be helpful'
      ],
      resolved: false,
      impactOnTimeline: true,
      priority: 9,
      estimatedResolutionTime: 15
    },
    {
      gapId: 'gap-2',
      assessmentId: 'test-assessment-123',
      domain: 'financial-management',
      category: 'important',
      description: 'Financial metrics need more detail',
      detectedAt: new Date().toISOString(),
      suggestedQuestions: [
        'What specific financial KPIs do you track?'
      ],
      followUpPrompts: [
        'Specific numbers would be valuable'
      ],
      resolved: false,
      impactOnTimeline: false,
      priority: 6,
      estimatedResolutionTime: 10
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseGapAnalysis.mockReturnValue({
      gaps: mockGaps,
      isAnalyzing: false,
      isLoading: false,
      completenessScore: 75,
      criticalGapsCount: 1,
      totalGapsCount: 2,
      error: null,
      triggerRealTimeAnalysis: jest.fn(),
      loadGaps: jest.fn(),
      resolveGap: jest.fn(),
      skipGap: jest.fn(),
      markGapAsReviewed: jest.fn(),
      clearErrors: jest.fn()
    });
  });

  it('renders panel with correct gap counts when visible', () => {
    render(<GapDetectionPanel {...mockProps} />);

    expect(screen.getByText('Gap Detection')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // Critical gaps
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Total gaps
  });

  it('renders collapsed state when not visible', () => {
    render(<GapDetectionPanel {...mockProps} isVisible={false} />);

    expect(screen.queryByText('Gap Detection')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Show gap detection panel')).toBeInTheDocument();
  });

  it('toggles visibility when clicking collapse/expand buttons', () => {
    const onToggleVisibility = jest.fn();

    render(<GapDetectionPanel {...mockProps} onToggleVisibility={onToggleVisibility} />);

    fireEvent.click(screen.getByLabelText('Hide gap detection panel'));
    expect(onToggleVisibility).toHaveBeenCalledTimes(1);
  });

  it('filters gaps by current domain', () => {
    render(<GapDetectionPanel {...mockProps} currentDomain="strategic-alignment" />);

    // Should only show strategic-alignment gaps
    expect(screen.getByText('Missing strategic vision details')).toBeInTheDocument();
    expect(screen.queryByText('Financial metrics need more detail')).not.toBeInTheDocument();

    // Critical count should be 1 (only strategic-alignment gap)
    const criticalCounts = screen.getAllByText('1');
    expect(criticalCounts.length).toBeGreaterThanOrEqual(1);
  });

  it('shows all gaps when no current domain specified', () => {
    render(<GapDetectionPanel {...mockProps} currentDomain={undefined} />);

    expect(screen.getByText('Missing strategic vision details')).toBeInTheDocument();
    expect(screen.getByText('Financial metrics need more detail')).toBeInTheDocument();
  });

  it('triggers real-time analysis when clicking check button', async () => {
    const mockTriggerAnalysis = jest.fn();

    mockUseGapAnalysis.mockReturnValue({
      gaps: mockGaps,
      isAnalyzing: false,
      isLoading: false,
      completenessScore: 75,
      criticalGapsCount: 1,
      totalGapsCount: 2,
      error: null,
      triggerRealTimeAnalysis: mockTriggerAnalysis,
      loadGaps: jest.fn(),
      resolveGap: jest.fn(),
      skipGap: jest.fn(),
      markGapAsReviewed: jest.fn(),
      clearErrors: jest.fn()
    });

    render(<GapDetectionPanel {...mockProps} />);

    fireEvent.click(screen.getByText('Check Current Responses'));

    expect(mockTriggerAnalysis).toHaveBeenCalledWith('strategic-alignment');
  });

  it('shows analyzing state correctly', () => {
    mockUseGapAnalysis.mockReturnValue({
      gaps: mockGaps,
      isAnalyzing: true,
      isLoading: false,
      completenessScore: 75,
      criticalGapsCount: 1,
      totalGapsCount: 2,
      error: null,
      triggerRealTimeAnalysis: jest.fn(),
      loadGaps: jest.fn(),
      resolveGap: jest.fn(),
      skipGap: jest.fn(),
      markGapAsReviewed: jest.fn(),
      clearErrors: jest.fn()
    });

    render(<GapDetectionPanel {...mockProps} />);

    expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    expect(screen.getByText('Analyzing...')).toBeDisabled();
  });

  it('shows empty state when no gaps exist', () => {
    mockUseGapAnalysis.mockReturnValue({
      gaps: [],
      isAnalyzing: false,
      isLoading: false,
      completenessScore: 95,
      criticalGapsCount: 0,
      totalGapsCount: 0,
      error: null,
      triggerRealTimeAnalysis: jest.fn(),
      loadGaps: jest.fn(),
      resolveGap: jest.fn(),
      skipGap: jest.fn(),
      markGapAsReviewed: jest.fn(),
      clearErrors: jest.fn()
    });

    render(<GapDetectionPanel {...mockProps} />);

    expect(screen.getByText('No gaps detected yet')).toBeInTheDocument();
    expect(screen.getByText('Keep answering questions to improve completeness')).toBeInTheDocument();
  });

  it('expands gap cards when clicked', async () => {
    render(<GapDetectionPanel {...mockProps} />);

    // Initially, detailed content should not be visible
    expect(screen.queryByText('Suggested clarifications:')).not.toBeInTheDocument();

    // Click to expand the first gap
    const expandButton = screen.getAllByText('+')[0];
    fireEvent.click(expandButton);

    // Now detailed content should be visible
    await waitFor(() => {
      expect(screen.getByText('Suggested clarifications:')).toBeInTheDocument();
      expect(screen.getByText('What is your company\'s strategic vision?')).toBeInTheDocument();
    });
  });

  it('marks gaps as reviewed when clicking mark reviewed button', async () => {
    const mockMarkReviewed = jest.fn();

    mockUseGapAnalysis.mockReturnValue({
      gaps: mockGaps,
      isAnalyzing: false,
      isLoading: false,
      completenessScore: 75,
      criticalGapsCount: 1,
      totalGapsCount: 2,
      error: null,
      triggerRealTimeAnalysis: jest.fn(),
      loadGaps: jest.fn(),
      resolveGap: jest.fn(),
      skipGap: jest.fn(),
      markGapAsReviewed: mockMarkReviewed,
      clearErrors: jest.fn()
    });

    render(<GapDetectionPanel {...mockProps} />);

    // Expand the gap to see the mark reviewed button
    const expandButton = screen.getAllByText('+')[0];
    fireEvent.click(expandButton);

    await waitFor(() => {
      const markReviewedButton = screen.getByText('Mark as reviewed');
      fireEvent.click(markReviewedButton);
      expect(mockMarkReviewed).toHaveBeenCalledWith('gap-1');
    });
  });

  it('shows correct completeness score colors', () => {
    // Test high completeness (green)
    mockUseGapAnalysis.mockReturnValue({
      gaps: [],
      isAnalyzing: false,
      isLoading: false,
      completenessScore: 90,
      criticalGapsCount: 0,
      totalGapsCount: 0,
      error: null,
      triggerRealTimeAnalysis: jest.fn(),
      loadGaps: jest.fn(),
      resolveGap: jest.fn(),
      skipGap: jest.fn(),
      markGapAsReviewed: jest.fn(),
      clearErrors: jest.fn()
    });

    const { rerender } = render(<GapDetectionPanel {...mockProps} />);

    // Should have green progress bar for high score
    const progressBar = document.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();

    // Test medium completeness (yellow)
    mockUseGapAnalysis.mockReturnValue({
      gaps: [],
      isAnalyzing: false,
      isLoading: false,
      completenessScore: 75,
      criticalGapsCount: 0,
      totalGapsCount: 0,
      error: null,
      triggerRealTimeAnalysis: jest.fn(),
      loadGaps: jest.fn(),
      resolveGap: jest.fn(),
      skipGap: jest.fn(),
      markGapAsReviewed: jest.fn(),
      clearErrors: jest.fn()
    });

    rerender(<GapDetectionPanel {...mockProps} />);

    const yellowProgressBar = document.querySelector('.bg-yellow-500');
    expect(yellowProgressBar).toBeInTheDocument();
  });

  it('handles gap categories correctly', () => {
    render(<GapDetectionPanel {...mockProps} />);

    // Should show critical gap with red styling
    const criticalGapElement = screen.getByText('Missing strategic vision details').closest('div');
    expect(criticalGapElement).toHaveClass('border-red-200', 'bg-red-50');

    // Should show correct gap counts
    expect(screen.getByText('1')).toBeInTheDocument(); // Critical count
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });
});