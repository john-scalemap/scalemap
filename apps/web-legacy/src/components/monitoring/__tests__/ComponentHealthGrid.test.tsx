import { render, screen } from '@testing-library/react'

import ComponentHealthGrid from '../ComponentHealthGrid'

describe('ComponentHealthGrid', () => {
  const mockComponents = [
    {
      name: 'dynamodb',
      status: 'healthy' as const,
      responseTime: 45,
      lastCheck: '2025-09-15T10:00:00Z'
    },
    {
      name: 'ses',
      status: 'unhealthy' as const,
      responseTime: 5000,
      lastCheck: '2025-09-15T10:00:00Z',
      details: { error: 'Connection timeout' }
    },
    {
      name: 'openai',
      status: 'degraded' as const,
      responseTime: 1200,
      lastCheck: '2025-09-15T10:00:00Z',
      details: { note: 'Mock implementation' }
    }
  ]

  it('should render loading state', () => {
    render(<ComponentHealthGrid components={[]} isLoading={true} />)

    expect(screen.getByText('Component Health')).toBeInTheDocument()
    expect(document.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })

  it('should render component health cards correctly', () => {
    render(<ComponentHealthGrid components={mockComponents} isLoading={false} />)

    expect(screen.getByText('Component Health')).toBeInTheDocument()
    expect(screen.getByText('DynamoDB')).toBeInTheDocument()
    expect(screen.getByText('SES Email')).toBeInTheDocument()
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
  })

  it('should display correct status for each component', () => {
    render(<ComponentHealthGrid components={mockComponents} isLoading={false} />)

    expect(screen.getByText('Healthy')).toBeInTheDocument()
    expect(screen.getByText('Unhealthy')).toBeInTheDocument()
    expect(screen.getByText('Degraded')).toBeInTheDocument()
  })

  it('should display response times correctly', () => {
    render(<ComponentHealthGrid components={mockComponents} isLoading={false} />)

    expect(screen.getByText('45ms')).toBeInTheDocument()
    expect(screen.getByText('5000ms')).toBeInTheDocument()
    expect(screen.getByText('1200ms')).toBeInTheDocument()
  })

  it('should display last check times', () => {
    render(<ComponentHealthGrid components={mockComponents} isLoading={false} />)

    // Check that time strings are displayed (format may vary by locale)
    const timeElements = screen.getAllByText(/\d{1,2}:\d{2}:\d{2} (AM|PM)/)
    expect(timeElements.length).toBeGreaterThanOrEqual(3) // At least one for each component
  })

  it('should show error details for unhealthy components', () => {
    render(<ComponentHealthGrid components={mockComponents} isLoading={false} />)

    expect(screen.getByText(/Error: Connection timeout/)).toBeInTheDocument()
  })

  it('should show additional details when available', () => {
    render(<ComponentHealthGrid components={mockComponents} isLoading={false} />)

    expect(screen.getByText('Mock implementation')).toBeInTheDocument()
  })

  it('should apply correct styling based on status', () => {
    render(<ComponentHealthGrid components={mockComponents} isLoading={false} />)

    // Find the card containers by looking for elements that contain the right status colors
    const healthyCard = document.querySelector('.border-green-200.bg-green-50')
    const unhealthyCard = document.querySelector('.border-red-200.bg-red-50')
    const degradedCard = document.querySelector('.border-yellow-200.bg-yellow-50')

    expect(healthyCard).toBeInTheDocument()
    expect(unhealthyCard).toBeInTheDocument()
    expect(degradedCard).toBeInTheDocument()
  })

  it('should show no data message when components array is empty', () => {
    render(<ComponentHealthGrid components={[]} isLoading={false} />)

    expect(screen.getByText('No component data available')).toBeInTheDocument()
  })

  it('should display correct component names', () => {
    const customComponents = [
      {
        name: 'stripe',
        status: 'healthy' as const,
        responseTime: 100,
        lastCheck: '2025-09-15T10:00:00Z'
      },
      {
        name: 'custom-service',
        status: 'healthy' as const,
        responseTime: 50,
        lastCheck: '2025-09-15T10:00:00Z'
      }
    ]

    render(<ComponentHealthGrid components={customComponents} isLoading={false} />)

    expect(screen.getByText('Stripe')).toBeInTheDocument()
    expect(screen.getByText('Custom-service')).toBeInTheDocument()
  })
})