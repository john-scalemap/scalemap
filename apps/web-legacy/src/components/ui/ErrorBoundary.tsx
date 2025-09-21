'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

import ErrorPage from './ErrorPage'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: (error: Error, reset: () => void) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showRetry?: boolean
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // In production, you would send this to your error tracking service
    if (typeof window !== 'undefined' && window.navigator?.sendBeacon) {
      try {
        const errorData = {
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }

        // Send to error tracking endpoint
        window.navigator.sendBeacon(
          '/api/errors',
          JSON.stringify(errorData)
        )
      } catch (e) {
        console.warn('Failed to send error report:', e)
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset)
      }

      const actions = this.props.showRetry !== false ? [
        {
          label: 'Try again',
          onClick: this.handleReset,
          variant: 'primary' as const
        },
        {
          label: 'Go back home',
          href: '/',
          variant: 'secondary' as const
        }
      ] : [
        {
          label: 'Go back home',
          href: '/',
          variant: 'primary' as const
        }
      ]

      return (
        <ErrorPage
          title="Something went wrong"
          description="We're sorry, but something unexpected happened. Our team has been notified and is working to fix this issue."
          icon={<span className="text-red-600 text-xl">⚠</span>}
          actions={actions}
        >
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                Technical Details (Development Only)
              </summary>
              <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-40">
                {this.state.error.message}
                {this.state.error.stack && `\n\nStack trace:\n${this.state.error.stack}`}
              </pre>
            </details>
          )}
        </ErrorPage>
      )
    }

    return this.props.children
  }
}