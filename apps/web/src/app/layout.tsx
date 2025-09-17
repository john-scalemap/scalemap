import type { Metadata } from 'next'

import ClientProviders from '@/components/providers/ClientProviders'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'ScaleMap',
  description: 'Strategic Enterprise Assessment and Agent Framework',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}