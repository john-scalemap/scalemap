import { jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'

import ErrorPage from '../ErrorPage'

describe('ErrorPage', () => {
  it('renders with default props', () => {
    render(
      <ErrorPage
        title="Test Error"
        description="This is a test error"
      />
    )

    expect(screen.getByText('Test Error')).toBeInTheDocument()
    expect(screen.getByText('This is a test error')).toBeInTheDocument()
    expect(screen.getByText('Go back home')).toBeInTheDocument()
    expect(screen.getByText('Contact support')).toBeInTheDocument()
  })

  it('displays status code when provided', () => {
    render(
      <ErrorPage
        title="Not Found"
        description="Page not found"
        statusCode={404}
      />
    )

    expect(screen.getByText('404')).toBeInTheDocument()
  })

  it('displays custom icon when provided', () => {
    render(
      <ErrorPage
        title="Custom Error"
        description="Custom error description"
        icon={<span data-testid="custom-icon">🔥</span>}
      />
    )

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
  })

  it('renders custom actions', () => {
    const mockAction = jest.fn()

    render(
      <ErrorPage
        title="Error"
        description="Description"
        actions={[
          { label: 'Custom Action', onClick: mockAction, variant: 'primary' }
        ]}
      />
    )

    const button = screen.getByText('Custom Action')
    expect(button).toBeInTheDocument()

    fireEvent.click(button)
    expect(mockAction).toHaveBeenCalled()
  })

  it('shows popular pages when enabled', () => {
    render(
      <ErrorPage
        title="Error"
        description="Description"
        showPopularPages={true}
      />
    )

    expect(screen.getByText('Popular pages:')).toBeInTheDocument()
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Contact')).toBeInTheDocument()
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.getByText('Register')).toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <ErrorPage
        title="Error"
        description="Description"
      >
        <div data-testid="custom-content">Custom content</div>
      </ErrorPage>
    )

    expect(screen.getByTestId('custom-content')).toBeInTheDocument()
    expect(screen.getByText('Custom content')).toBeInTheDocument()
  })

  it('applies correct styling for primary and secondary actions', () => {
    render(
      <ErrorPage
        title="Error"
        description="Description"
        actions={[
          { label: 'Primary', href: '/', variant: 'primary' },
          { label: 'Secondary', href: '/contact', variant: 'secondary' }
        ]}
      />
    )

    const primaryLink = screen.getByText('Primary')
    const secondaryLink = screen.getByText('Secondary')

    expect(primaryLink).toHaveClass('bg-blue-600')
    expect(secondaryLink).toHaveClass('bg-white')
  })
})