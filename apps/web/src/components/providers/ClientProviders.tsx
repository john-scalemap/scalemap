'use client'

import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { ErrorProvider, ErrorNotifications } from '@/contexts/ErrorContext'
import { AuthProvider } from '@/lib/auth/auth-context'

interface ClientProvidersProps {
  children: React.ReactNode
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  console.log('🔧 ClientProviders: Rendering wrapper components');

  return (
    <ErrorProvider>
      <AuthProvider>
        <ErrorBoundary>
          {children}
          <ErrorNotifications />
        </ErrorBoundary>
      </AuthProvider>
    </ErrorProvider>
  )
}