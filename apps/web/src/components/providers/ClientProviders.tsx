'use client'

import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { ErrorProvider, ErrorNotifications } from '@/contexts/ErrorContext'

interface ClientProvidersProps {
  children: React.ReactNode
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <ErrorProvider>
      <ErrorBoundary>
        {children}
        <ErrorNotifications />
      </ErrorBoundary>
    </ErrorProvider>
  )
}