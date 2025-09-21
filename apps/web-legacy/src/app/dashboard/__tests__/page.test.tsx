import { jest } from '@jest/globals';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

import { Assessment } from '@/types';

import DashboardPage from '../page';


// Mock Next.js components
jest.mock('next/link', () => {
  return function MockLink({ children, href }: any) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}));

// Mock the useAssessment hook
const mockListAssessments = jest.fn();
jest.mock('@/hooks/useAssessment', () => ({
  useAssessment: () => ({
    listAssessments: mockListAssessments
  })
}));

// Mock AssessmentCard component
jest.mock('@/components/AssessmentCard', () => {
  return function MockAssessmentCard({ assessment, onResume }: any) {
    return (
      <div data-testid={`assessment-card-${assessment.id}`}>
        <h3>{assessment.title}</h3>
        <p>{assessment.companyName}</p>
        <button onClick={onResume}>Resume Assessment</button>
      </div>
    );
  };
});

const mockAssessments: Assessment[] = [
  {
    id: 'assessment-1',
    companyId: 'company-123',
    companyName: 'Test Company 1',
    contactEmail: 'test1@example.com',
    title: 'Strategic Assessment Q1',
    description: 'Quarterly strategic review',
    status: 'document-processing',
    createdAt: '2024-01-01T10:00:00.000Z',
    updatedAt: '2024-01-01T15:30:00.000Z',
    domainResponses: {},
    progress: {
      overall: 45,
      domains: {} as any,
      completeness: 45,
      estimatedTimeRemaining: '25-30 minutes'
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
  },
  {
    id: 'assessment-2',
    companyId: 'company-123',
    companyName: 'Test Company 1',
    contactEmail: 'test1@example.com',
    title: 'Operational Excellence Review',
    description: 'Process optimization assessment',
    status: 'triaging',
    createdAt: '2024-01-02T10:00:00.000Z',
    updatedAt: '2024-01-02T12:00:00.000Z',
    domainResponses: {},
    progress: {
      overall: 20,
      domains: {} as any,
      completeness: 20,
      estimatedTimeRemaining: '40-50 minutes'
    },
    deliverySchedule: {
      executive24h: '2024-01-03T10:00:00.000Z',
      detailed48h: '2024-01-04T10:00:00.000Z',
      implementation72h: '2024-01-05T10:00:00.000Z'
    },
    clarificationPolicy: {
      allowClarificationUntil: 'detailed48h',
      maxClarificationRequests: 3,
      maxTimelineExtension: 86400000
    }
  }
];

describe('Dashboard Page - My Assessments', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock localStorage for user data
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      companyId: 'company-123',
      role: 'admin',
      emailVerified: true
    };

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(JSON.stringify(mockUser)),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      },
      writable: true
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders welcome message with user name', async () => {
    mockListAssessments.mockResolvedValueOnce({
      assessments: [],
      count: 0,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome back, John!')).toBeInTheDocument();
    });
  });

  it('shows My Assessments section with proper header', async () => {
    mockListAssessments.mockResolvedValueOnce({
      assessments: [],
      count: 0,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('My Assessments')).toBeInTheDocument();
      expect(screen.getByText('New Assessment')).toBeInTheDocument();
    });
  });

  it('displays loading state while fetching assessments', () => {
    // Return a promise that doesn't resolve immediately
    mockListAssessments.mockReturnValueOnce(new Promise(() => {}));

    render(<DashboardPage />);

    // Should show loading skeleton
    const loadingElements = screen.getAllByRole('generic');
    const hasLoadingAnimation = loadingElements.some(el =>
      el.className.includes('animate-pulse')
    );
    expect(hasLoadingAnimation).toBe(true);
  });

  it('displays assessments when loaded successfully', async () => {
    mockListAssessments.mockResolvedValueOnce({
      assessments: mockAssessments,
      count: 2,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('assessment-card-assessment-1')).toBeInTheDocument();
      expect(screen.getByTestId('assessment-card-assessment-2')).toBeInTheDocument();
      expect(screen.getByText('Strategic Assessment Q1')).toBeInTheDocument();
      expect(screen.getByText('Operational Excellence Review')).toBeInTheDocument();
    });
  });

  it('shows empty state when no assessments exist', async () => {
    mockListAssessments.mockResolvedValueOnce({
      assessments: [],
      count: 0,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No assessments in progress')).toBeInTheDocument();
      expect(screen.getByText('Start your first assessment to see your progress here')).toBeInTheDocument();
      expect(screen.getByText('Create Assessment')).toBeInTheDocument();
    });
  });

  it('displays error state when assessment loading fails', async () => {
    const errorMessage = 'Failed to fetch assessments';
    mockListAssessments.mockRejectedValueOnce(new Error(errorMessage));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load assessments')).toBeInTheDocument();
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });
  });

  it('allows retrying when assessment loading fails', async () => {
    const errorMessage = 'Network error';
    mockListAssessments
      .mockRejectedValueOnce(new Error(errorMessage))
      .mockResolvedValueOnce({
        assessments: mockAssessments,
        count: 2,
        hasMore: false
      });

    render(<DashboardPage />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByText('Failed to load assessments')).toBeInTheDocument();
    });

    // Click retry button
    const retryButton = screen.getByText('Try Again');
    fireEvent.click(retryButton);

    // Should show assessments after retry
    await waitFor(() => {
      expect(screen.getByTestId('assessment-card-assessment-1')).toBeInTheDocument();
      expect(screen.getByTestId('assessment-card-assessment-2')).toBeInTheDocument();
    });

    expect(mockListAssessments).toHaveBeenCalledTimes(2);
  });

  it('shows "View all assessments" link when assessments exist', async () => {
    mockListAssessments.mockResolvedValueOnce({
      assessments: mockAssessments,
      count: 2,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      const viewAllLink = screen.getByText('View all assessments →');
      expect(viewAllLink).toBeInTheDocument();
      expect(viewAllLink.closest('a')).toHaveAttribute('href', '/assessments');
    });
  });

  it('calls listAssessments with correct status filter', async () => {
    mockListAssessments.mockResolvedValueOnce({
      assessments: [],
      count: 0,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(mockListAssessments).toHaveBeenCalledWith([
        'document-processing',
        'triaging',
        'analyzing',
        'synthesizing',
        'validating'
      ]);
    });
  });

  it('includes navigation links in header', async () => {
    mockListAssessments.mockResolvedValueOnce({
      assessments: [],
      count: 0,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('ScaleMap Dashboard')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /monitoring/i })).toHaveAttribute('href', '/monitoring');
      expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
      expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile');
    });
  });

  it('shows quick stats cards', async () => {
    mockListAssessments.mockResolvedValueOnce({
      assessments: [],
      count: 0,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Assessments')).toBeInTheDocument();
      expect(screen.getByText('Create new business assessment')).toBeInTheDocument();
      expect(screen.getByText('Monitoring')).toBeInTheDocument();
      expect(screen.getByText('View system performance')).toBeInTheDocument();
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Configure your account')).toBeInTheDocument();
    });
  });

  it('displays user account information', async () => {
    mockListAssessments.mockResolvedValueOnce({
      assessments: [],
      count: 0,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Account Information')).toBeInTheDocument();
      expect(screen.getByText('test@example.com')).toBeInTheDocument();
      expect(screen.getByText('admin')).toBeInTheDocument();
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });
  });

  it('handles missing user data gracefully', async () => {
    // Mock empty localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: jest.fn().mockReturnValue(null),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn()
      },
      writable: true
    });

    mockListAssessments.mockResolvedValueOnce({
      assessments: [],
      count: 0,
      hasMore: false
    });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome back!')).toBeInTheDocument();
      expect(screen.queryByText('Account Information')).not.toBeInTheDocument();
    });

    // Should not call listAssessments when no user
    expect(mockListAssessments).not.toHaveBeenCalled();
  });
});