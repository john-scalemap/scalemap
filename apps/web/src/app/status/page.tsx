'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface SystemStatus {
  overall: 'operational' | 'degraded' | 'maintenance' | 'outage'
  components: {
    name: string
    status: 'operational' | 'degraded' | 'outage'
    description?: string
  }[]
  lastUpdated: string
}

export default function StatusPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/health/detailed')
        if (response.ok) {
          const healthData = await response.json()

          // Transform health data to status format
          const components = Object.entries(healthData.components || {}).map(([name, data]: [string, any]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            status: data.status === 'healthy' ? 'operational' : data.status === 'degraded' ? 'degraded' : 'outage',
            description: data.message || `Response time: ${data.responseTime}ms`
          }))

          const overallStatus = healthData.status === 'healthy' ? 'operational' :
                              healthData.status === 'degraded' ? 'degraded' : 'outage'

          setStatus({
            overall: overallStatus,
            components,
            lastUpdated: new Date().toISOString()
          })
        } else {
          // Fallback status if API is not available
          setStatus({
            overall: 'outage',
            components: [
              { name: 'API', status: 'outage', description: 'Unable to fetch status' },
              { name: 'Database', status: 'outage', description: 'Status unknown' },
              { name: 'Authentication', status: 'outage', description: 'Status unknown' }
            ],
            lastUpdated: new Date().toISOString()
          })
        }
      } catch (error) {
        console.error('Failed to fetch status:', error)
        setStatus({
          overall: 'outage',
          components: [
            { name: 'System', status: 'outage', description: 'Status check failed' }
          ],
          lastUpdated: new Date().toISOString()
        })
      } finally {
        setLoading(false)
      }
    }

    fetchStatus()

    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-green-100 text-green-800'
      case 'degraded': return 'bg-yellow-100 text-yellow-800'
      case 'maintenance': return 'bg-blue-100 text-blue-800'
      case 'outage': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return '✅'
      case 'degraded': return '⚠️'
      case 'maintenance': return '🔧'
      case 'outage': return '❌'
      default: return '❓'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">Loading system status...</h2>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">ScaleMap System Status</h1>
          <p className="mt-2 text-gray-600">Current operational status of all ScaleMap services</p>
          {status && (
            <p className="mt-1 text-sm text-gray-500">
              Last updated: {new Date(status.lastUpdated).toLocaleString()}
            </p>
          )}
        </div>

        {status && (
          <div className="space-y-6">
            {/* Overall Status */}
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Overall Status</h2>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(status.overall)}`}>
                  {getStatusIcon(status.overall)} {status.overall.charAt(0).toUpperCase() + status.overall.slice(1)}
                </span>
              </div>
              {status.overall === 'operational' && (
                <p className="mt-2 text-green-600">All systems are operating normally.</p>
              )}
              {status.overall === 'degraded' && (
                <p className="mt-2 text-yellow-600">Some systems are experiencing issues.</p>
              )}
              {status.overall === 'outage' && (
                <p className="mt-2 text-red-600">Some systems are currently unavailable.</p>
              )}
              {status.overall === 'maintenance' && (
                <p className="mt-2 text-blue-600">System is under maintenance.</p>
              )}
            </div>

            {/* Component Status */}
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Component Status</h2>
              <div className="space-y-4">
                {status.components.map((component, index) => (
                  <div key={index} className="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{component.name}</h3>
                      {component.description && (
                        <p className="text-sm text-gray-500">{component.description}</p>
                      )}
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(component.status)}`}>
                      {getStatusIcon(component.status)} {component.status.charAt(0).toUpperCase() + component.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="text-center">
              <div className="inline-flex space-x-4">
                <Link
                  href="/"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Back to ScaleMap
                </Link>
                <Link
                  href="/contact"
                  className="bg-white hover:bg-gray-50 text-gray-900 px-4 py-2 rounded-md border border-gray-300 text-sm font-medium"
                >
                  Contact Support
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}