import { render, screen } from '@testing-library/react'

import LandingPage from '../LandingPage'

// Mock Next.js Link component
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
})

// Mock SystemStatusIndicator component
jest.mock('../SystemStatusIndicator', () => {
  return function MockSystemStatusIndicator() {
    return <div data-testid="system-status-indicator">System Status Indicator</div>
  }
})

describe('LandingPage', () => {
  it('should render main heading and value proposition', () => {
    render(<LandingPage />)

    expect(screen.getByText('ScaleMap')).toBeInTheDocument()
    expect(screen.getByText('Strategic Enterprise Assessment and Agent Framework')).toBeInTheDocument()
  })

  it('should render call-to-action buttons', () => {
    render(<LandingPage />)

    const getStartedButton = screen.getByText('Get Started')
    const startAssessmentButton = screen.getByText('Start Your Assessment')
    const signInButton = screen.getByText('Sign In')

    expect(getStartedButton).toBeInTheDocument()
    expect(startAssessmentButton).toBeInTheDocument()
    expect(signInButton).toBeInTheDocument()
  })

  it('should render feature sections', () => {
    render(<LandingPage />)

    expect(screen.getByText('Strategic Assessment')).toBeInTheDocument()
    expect(screen.getByText('AI Agent Framework')).toBeInTheDocument()
    expect(screen.getByText('Rapid Implementation')).toBeInTheDocument()
  })

  it('should render system status section', () => {
    render(<LandingPage />)

    expect(screen.getByText('Platform Status')).toBeInTheDocument()
    expect(screen.getByTestId('system-status-indicator')).toBeInTheDocument()
  })

  it('should render CTA section', () => {
    render(<LandingPage />)

    expect(screen.getByText('Ready to Scale Your Enterprise?')).toBeInTheDocument()
  })

  it('should have proper navigation links', () => {
    render(<LandingPage />)

    // Check specific links exist
    expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /start your assessment/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /contact sales/i })).toBeInTheDocument()
  })

  it('should have responsive design structure', () => {
    render(<LandingPage />)

    // Check for responsive grid classes
    const featuresSection = screen.getByText('Strategic Assessment').closest('.grid')
    expect(featuresSection).toHaveClass('md:grid-cols-3')
  })
})