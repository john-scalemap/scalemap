import { render, screen, waitFor } from '@testing-library/react'

import SystemStatusIndicator from '../SystemStatusIndicator'

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
})

describe('SystemStatusIndicator', () => {
  beforeEach(() => {
    jest.clearAllTimers()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('should render system status heading', () => {
    render(<SystemStatusIndicator />)

    expect(screen.getByText('System Status')).toBeInTheDocument()
  })

  it('should display operational status by default', async () => {
    render(<SystemStatusIndicator />)

    await waitFor(() => {
      expect(screen.getByText('Operational')).toBeInTheDocument()
    })
  })

  it('should display component statuses', async () => {
    render(<SystemStatusIndicator />)

    await waitFor(() => {
      expect(screen.getByText('API Services')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
    })
  })

  it('should show healthy status for all components by default', async () => {
    render(<SystemStatusIndicator />)

    await waitFor(() => {
      // Check that healthy status appears 3 times (API, Database, Authentication)
      const healthyElements = screen.getAllByText(/healthy/)
      expect(healthyElements).toHaveLength(3)
      expect(screen.getByText('API Services')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Authentication')).toBeInTheDocument()
    })
  })

  it('should display last updated timestamp', async () => {
    render(<SystemStatusIndicator />)

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })
  })

  it('should have proper styling for operational status', async () => {
    render(<SystemStatusIndicator />)

    await waitFor(() => {
      const statusBadge = screen.getByText('Operational')
      expect(statusBadge).toHaveClass('text-green-600', 'bg-green-100')
    })
  })

  it('should update status periodically', async () => {
    render(<SystemStatusIndicator />)

    // Initial render
    await waitFor(() => {
      expect(screen.getByText('Operational')).toBeInTheDocument()
    })

    // Fast-forward time to trigger update
    jest.advanceTimersByTime(30000)

    // Should still show operational (since we're mocking)
    await waitFor(() => {
      expect(screen.getByText('Operational')).toBeInTheDocument()
    })
  })

  it('should display status icons', async () => {
    render(<SystemStatusIndicator />)

    await waitFor(() => {
      // Operational status should show filled circle
      const statusElements = screen.getAllByText('●')
      expect(statusElements.length).toBeGreaterThan(0)
    })
  })

  it('should be contained in a bordered card', () => {
    render(<SystemStatusIndicator />)

    const container = screen.getByText('System Status').closest('.bg-white')
    expect(container).toHaveClass('bg-white', 'border', 'border-gray-200', 'rounded-lg')
  })
})