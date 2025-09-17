'use client'

import { useEffect } from 'react'

import ErrorPage from '@/components/ui/ErrorPage'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Global error caught:', error)

    // Send error to tracking service in production
    if (typeof window !== 'undefined' && window.navigator?.sendBeacon) {
      try {
        const errorData = {
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        }

        window.navigator.sendBeacon(
          '/api/errors',
          JSON.stringify(errorData)
        )
      } catch (e) {
        console.warn('Failed to send error report:', e)
      }
    }
  }, [error])

  return (
    <ErrorPage
      title="Something went wrong"
      description="We're sorry, but something unexpected happened. Our team has been notified and is working to fix this issue."
      icon={<span className="text-red-600 text-xl">⚠</span>}
      actions={[
        {
          label: 'Try again',
          onClick: reset,
          variant: 'primary'
        },
        {
          label: 'Go to homepage',
          href: '/',
          variant: 'secondary'
        }
      ]}
    >
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
            Technical Details (Development Only)
          </summary>
          <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto max-h-40">
            {error.message}
            {error.stack && `\n\nStack trace:\n${error.stack}`}
          </pre>
        </details>
      )}
    </ErrorPage>
  )
}