'use client'

import { useState, useEffect } from 'react'

interface SystemStatus {
  status: 'operational' | 'degraded' | 'down'
  lastUpdated: string
  components: {
    api: 'healthy' | 'unhealthy' | 'degraded'
    database: 'healthy' | 'unhealthy' | 'degraded'
    auth: 'healthy' | 'unhealthy' | 'degraded'
  }
}

export default function SystemStatusIndicator() {
  const [mounted, setMounted] = useState(false)
  const [status, setStatus] = useState<SystemStatus>({
    status: 'operational',
    lastUpdated: new Date().toISOString(),
    components: {
      api: 'healthy',
      database: 'healthy',
      auth: 'healthy'
    }
  })

  useEffect(() => {
    setMounted(true)

    const fetchSystemStatus = async () => {
      try {
        const response = await fetch('/api/health/detailed')

        if (!response.ok) {
          throw new Error('Failed to fetch system status')
        }

        const data = await response.json()

        // Map the detailed health response to the component format
        const componentMap: Record<string, 'healthy' | 'unhealthy' | 'degraded'> = {
          api: data.status === 'healthy' ? 'healthy' : data.status === 'degraded' ? 'degraded' : 'unhealthy',
          database: 'healthy',
          auth: 'healthy'
        }

        // Find specific components and map them
        if (data.components) {
          const dynamoComponent = data.components.find((c: any) => c.name === 'dynamodb')
          if (dynamoComponent) {
            componentMap.database = dynamoComponent.status
          }

          // Use API status as a general indicator
          const overallApiHealth = data.status === 'healthy' ? 'healthy' :
                                  data.status === 'degraded' ? 'degraded' : 'unhealthy'
          componentMap.api = overallApiHealth
          componentMap.auth = overallApiHealth
        }

        const overallStatus = data.status === 'healthy' ? 'operational' :
                             data.status === 'degraded' ? 'degraded' : 'down'

        setStatus({
          status: overallStatus,
          lastUpdated: data.timestamp,
          components: componentMap
        })
      } catch (error) {
        console.error('Failed to fetch system status:', error)
        setStatus(prev => ({
          ...prev,
          status: 'degraded',
          lastUpdated: new Date().toISOString()
        }))
      }
    }

    fetchSystemStatus()
    const interval = setInterval(fetchSystemStatus, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational':
      case 'healthy':
        return 'text-green-600 bg-green-100'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100'
      case 'down':
      case 'unhealthy':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
      case 'healthy':
        return '●'
      case 'degraded':
        return '◐'
      case 'down':
      case 'unhealthy':
        return '●'
      default:
        return '◯'
    }
  }

  // Don't render during SSR to avoid hydration issues
  if (!mounted) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-600 bg-gray-100">
            <span className="mr-1">◯</span>
            Loading...
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status.status)}`}>
          <span className="mr-1">{getStatusIcon(status.status)}</span>
          {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">API Services</span>
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${getStatusColor(status.components.api)}`}>
            {getStatusIcon(status.components.api)} {status.components.api}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Database</span>
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${getStatusColor(status.components.database)}`}>
            {getStatusIcon(status.components.database)} {status.components.database}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Authentication</span>
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${getStatusColor(status.components.auth)}`}>
            {getStatusIcon(status.components.auth)} {status.components.auth}
          </span>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">
          Last updated: {new Date(status.lastUpdated).toLocaleString()}
        </p>
      </div>
    </div>
  )
}