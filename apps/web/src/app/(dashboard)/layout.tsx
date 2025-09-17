import { ReactNode } from 'react'

interface DashboardLayoutProps {
  children: ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">ScaleMap Dashboard</h1>
            </div>
            <nav className="flex space-x-8">
              <a href="/monitoring" className="text-gray-500 hover:text-gray-900">Monitoring</a>
              <a href="/settings" className="text-gray-500 hover:text-gray-900">Settings</a>
              <a href="/profile" className="text-gray-500 hover:text-gray-900">Profile</a>
              <a href="/" className="text-gray-500 hover:text-gray-900">Public Site</a>
            </nav>
          </div>
        </div>
      </header>

      <main>{children}</main>
    </div>
  )
}