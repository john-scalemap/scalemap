import { render, screen } from '@testing-library/react'

import SystemStatusCard from '../SystemStatusCard'

describe('SystemStatusCard', () => {
  const mockSystemMetrics = {
    status: 'healthy' as const,
    timestamp: '2025-09-15T10:00:00Z',
    uptime: 3661, // 1 hour, 1 minute, 1 second
    version: '1.0.0',
    responseTime: 150,
    components: []
  }

  it('should render loading state', () => {
    render(<SystemStatusCard systemMetrics={null} isLoading={true} />)

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('should render system metrics correctly', () => {
    render(<SystemStatusCard systemMetrics={mockSystemMetrics} isLoading={false} />)

    expect(screen.getByText('System Status')).toBeInTheDocument()
    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('1.0.0')).toBeInTheDocument()
    expect(screen.getByText('1h 1m 1s')).toBeInTheDocument()
    expect(screen.getByText('150ms')).toBeInTheDocument()
  })

  it('should format uptime correctly for different durations', () => {
    const shortUptime = { ...mockSystemMetrics, uptime: 45 }
    const { rerender } = render(<SystemStatusCard systemMetrics={shortUptime} isLoading={false} />)
    expect(screen.getByText('45s')).toBeInTheDocument()

    const mediumUptime = { ...mockSystemMetrics, uptime: 150 }
    rerender(<SystemStatusCard systemMetrics={mediumUptime} isLoading={false} />)
    expect(screen.getByText('2m 30s')).toBeInTheDocument()
  })

  it('should show component count when components are provided', () => {
    const metricsWithComponents = {
      ...mockSystemMetrics,
      components: [
        { name: 'api', status: 'healthy' as const, responseTime: 100, lastCheck: '2025-09-15T10:00:00Z' },
        { name: 'db', status: 'unhealthy' as const, responseTime: 200, lastCheck: '2025-09-15T10:00:00Z' }
      ]
    }

    render(<SystemStatusCard systemMetrics={metricsWithComponents} isLoading={false} />)

    expect(screen.getByText('1/2')).toBeInTheDocument() // 1 healthy out of 2 total
  })

  it('should show unhealthy status with appropriate styling', () => {
    const unhealthyMetrics = { ...mockSystemMetrics, status: 'unhealthy' as const }
    render(<SystemStatusCard systemMetrics={unhealthyMetrics} isLoading={false} />)

    const statusBadge = screen.getByText('Unhealthy')
    expect(statusBadge).toHaveClass('text-red-600', 'bg-red-100')
  })

  it('should show no data message when metrics are null', () => {
    render(<SystemStatusCard systemMetrics={null} isLoading={false} />)

    expect(screen.getByText('No system metrics available')).toBeInTheDocument()
  })

  it('should display last updated timestamp', () => {
    render(<SystemStatusCard systemMetrics={mockSystemMetrics} isLoading={false} />)

    expect(screen.getByText('Last updated')).toBeInTheDocument()
    // Check that a timestamp is displayed (format may vary by locale)
    expect(screen.getByText(/\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)/)).toBeInTheDocument()
  })

  it('should not show response time when not provided', () => {
    const metricsWithoutResponseTime = { ...mockSystemMetrics }
    delete metricsWithoutResponseTime.responseTime

    render(<SystemStatusCard systemMetrics={metricsWithoutResponseTime} isLoading={false} />)

    expect(screen.queryByText('150ms')).not.toBeInTheDocument()
    expect(screen.queryByText('Response Time')).not.toBeInTheDocument()
  })
})