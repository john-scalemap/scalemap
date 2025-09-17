import { jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'

import MonitoringDashboard from '../MonitoringDashboard'

// Mock the monitoring store
jest.mock('@/stores/monitoring-store')
import { useMonitoringStore } from '@/stores/monitoring-store'

const mockUseMonitoringStore = useMonitoringStore as jest.MockedFunction<typeof useMonitoringStore>

// Mock child components
jest.mock('../SystemStatusCard', () => {
  return function MockSystemStatusCard({ systemMetrics, isLoading }: any) {
    return <div data-testid="system-status-card">System Status: {systemMetrics?.status || 'loading'}</div>
  }
})

jest.mock('../ComponentHealthGrid', () => {
  return function MockComponentHealthGrid({ components, isLoading }: any) {
    return <div data-testid="component-health-grid">Components: {components?.length || 0}</div>
  }
})

jest.mock('../PerformanceChart', () => {
  return function MockPerformanceChart({ isLoading }: any) {
    return <div data-testid="performance-chart">Performance Chart</div>
  }
})

jest.mock('../AlertsPanel', () => {
  return function MockAlertsPanel() {
    return <div data-testid="alerts-panel">Alerts Panel</div>
  }
})

describe('MonitoringDashboard', () => {
  const mockStoreData = {
    systemMetrics: {
      status: 'healthy' as const,
      timestamp: '2025-09-15T10:00:00.000Z',
      uptime: 99.9,
      components: [
        {
          name: 'dynamodb',
          status: 'healthy' as const,
          responseTime: 150,
          lastCheck: '2025-09-15T10:00:00.000Z'
        }
      ]
    },
    dashboardData: null,
    isLoading: false,
    error: null,
    lastUpdated: '2025-09-15T10:00:00.000Z',
    activeAlerts: [],
    recentIncidents: [],
    fetchDetailedMetrics: jest.fn(),
    fetchDashboardData: jest.fn(),
    clearError: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.clearAllTimers()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should render dashboard components when data is loaded', () => {
    mockUseMonitoringStore.mockReturnValue(mockStoreData)

    render(<MonitoringDashboard />)

    expect(screen.getByText('System Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Real-time system health and performance metrics')).toBeInTheDocument()
    expect(screen.getByTestId('system-status-card')).toBeInTheDocument()
    expect(screen.getByTestId('component-health-grid')).toBeInTheDocument()
    expect(screen.getByTestId('performance-chart')).toBeInTheDocument()
    expect(screen.getByTestId('alerts-panel')).toBeInTheDocument()
  })

  it('should show last updated time when available', () => {
    mockUseMonitoringStore.mockReturnValue(mockStoreData)

    render(<MonitoringDashboard />)

    expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
  })

  it('should show refresh button and handle refresh clicks', () => {
    const mockFetchDashboardData = jest.fn()
    mockUseMonitoringStore.mockReturnValue({
      ...mockStoreData,
      fetchDashboardData: mockFetchDashboardData
    })

    render(<MonitoringDashboard />)

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    expect(refreshButton).toBeInTheDocument()

    refreshButton.click()
    expect(mockFetchDashboardData).toHaveBeenCalledWith('1h')
  })

  it('should show loading state', () => {
    mockUseMonitoringStore.mockReturnValue({
      ...mockStoreData,
      isLoading: true
    })

    render(<MonitoringDashboard />)

    const refreshButton = screen.getByRole('button', { name: /refreshing/i })
    expect(refreshButton).toBeDisabled()
  })

  it('should display active alerts banner when alerts exist', () => {
    mockUseMonitoringStore.mockReturnValue({
      ...mockStoreData,
      activeAlerts: ['alert-1', 'alert-2']
    })

    render(<MonitoringDashboard />)

    expect(screen.getByText('2 active alerts detected')).toBeInTheDocument()
  })

  it('should not display alerts banner when no alerts', () => {
    mockUseMonitoringStore.mockReturnValue(mockStoreData)

    render(<MonitoringDashboard />)

    expect(screen.queryByText(/active alert/)).not.toBeInTheDocument()
  })

  it('should render error state with retry and clear options', () => {
    const mockClearError = jest.fn()
    const mockFetchDashboardData = jest.fn()

    mockUseMonitoringStore.mockReturnValue({
      ...mockStoreData,
      error: 'Failed to fetch monitoring data',
      clearError: mockClearError,
      fetchDashboardData: mockFetchDashboardData
    })

    render(<MonitoringDashboard />)

    expect(screen.getByText('Error Loading Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch monitoring data')).toBeInTheDocument()

    const retryButton = screen.getByRole('button', { name: /retry/i })
    const clearButton = screen.getByRole('button', { name: /clear error/i })

    retryButton.click()
    expect(mockFetchDashboardData).toHaveBeenCalledWith('1h')

    clearButton.click()
    expect(mockClearError).toHaveBeenCalled()
  })

  it('should fetch dashboard data on mount and set up polling', async () => {
    const mockFetchDashboardData = jest.fn()

    mockUseMonitoringStore.mockReturnValue({
      ...mockStoreData,
      fetchDashboardData: mockFetchDashboardData
    })

    render(<MonitoringDashboard />)

    // Should fetch immediately on mount
    expect(mockFetchDashboardData).toHaveBeenCalledWith('1h')

    // Should set up polling every 30 seconds
    jest.advanceTimersByTime(30000)
    expect(mockFetchDashboardData).toHaveBeenCalledTimes(2)

    jest.advanceTimersByTime(30000)
    expect(mockFetchDashboardData).toHaveBeenCalledTimes(3)
  })

  it('should clean up polling interval on unmount', () => {
    const mockFetchDashboardData = jest.fn()

    mockUseMonitoringStore.mockReturnValue({
      ...mockStoreData,
      fetchDashboardData: mockFetchDashboardData
    })

    const { unmount } = render(<MonitoringDashboard />)

    // Initial call
    expect(mockFetchDashboardData).toHaveBeenCalledTimes(1)

    // Unmount component
    unmount()

    // Advance time and verify no more calls
    jest.advanceTimersByTime(60000)
    expect(mockFetchDashboardData).toHaveBeenCalledTimes(1) // Still only initial call
  })

  it('should pass correct props to child components', () => {
    mockUseMonitoringStore.mockReturnValue(mockStoreData)

    render(<MonitoringDashboard />)

    expect(screen.getByTestId('system-status-card')).toHaveTextContent('System Status: healthy')
    expect(screen.getByTestId('component-health-grid')).toHaveTextContent('Components: 1')
  })

  it('should handle single alert correctly', () => {
    mockUseMonitoringStore.mockReturnValue({
      ...mockStoreData,
      activeAlerts: ['single-alert']
    })

    render(<MonitoringDashboard />)

    expect(screen.getByText('1 active alert detected')).toBeInTheDocument()
  })
})