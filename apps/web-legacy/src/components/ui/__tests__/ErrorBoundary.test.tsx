import { jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'

import ErrorBoundary from '../ErrorBoundary'

// Mock component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>Working component</div>
}

describe('ErrorBoundary', () => {
  // Suppress console.error during tests
  const originalError = console.error
  beforeEach(() => {
    console.error = jest.fn()
  })

  afterEach(() => {
    console.error = originalError
  })

  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Working component')).toBeInTheDocument()
  })

  it('renders error page when error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText("We're sorry, but something unexpected happened. Our team has been notified and is working to fix this issue.")).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    expect(screen.getByText('Go back home')).toBeInTheDocument()
  })

  it('calls onError callback when error occurs', () => {
    const onError = jest.fn()

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('uses custom fallback when provided', () => {
    const customFallback = (error: Error, reset: () => void) => (
      <div>
        <h2>Custom Error: {error.message}</h2>
        <button onClick={reset}>Custom Reset</button>
      </div>
    )

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom Error: Test error')).toBeInTheDocument()
    expect(screen.getByText('Custom Reset')).toBeInTheDocument()
  })

  it('resets error state when retry button is clicked', () => {
    let shouldThrow = true
    const TestComponent = () => {
      if (shouldThrow) {
        throw new Error('Test error')
      }
      return <div>Component recovered</div>
    }

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Simulate component fixing itself
    shouldThrow = false

    const retryButton = screen.getByText('Try again')
    fireEvent.click(retryButton)

    expect(screen.getByText('Component recovered')).toBeInTheDocument()
  })

  it('hides retry button when showRetry is false', () => {
    render(
      <ErrorBoundary showRetry={false}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.queryByText('Try again')).not.toBeInTheDocument()
    expect(screen.getByText('Go back home')).toBeInTheDocument()
  })

  it('shows technical details in development mode', () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Technical Details (Development Only)')).toBeInTheDocument()

    process.env.NODE_ENV = originalEnv
  })
})