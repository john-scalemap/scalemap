'use client'

import { ComponentHealth } from '@/stores/monitoring-store'

interface ComponentHealthGridProps {
  components: ComponentHealth[]
  isLoading: boolean
}

export default function ComponentHealthGrid({ components, isLoading }: ComponentHealthGridProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'border-green-200 bg-green-50'
      case 'degraded':
        return 'border-yellow-200 bg-yellow-50'
      case 'unhealthy':
        return 'border-red-200 bg-red-50'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✓'
      case 'degraded':
        return '◐'
      case 'unhealthy':
        return '✗'
      default:
        return '◯'
    }
  }

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-800'
      case 'degraded':
        return 'text-yellow-800'
      case 'unhealthy':
        return 'text-red-800'
      default:
        return 'text-gray-800'
    }
  }

  const getComponentDisplayName = (name: string) => {
    const nameMap: Record<string, string> = {
      dynamodb: 'DynamoDB',
      ses: 'SES Email',
      openai: 'OpenAI',
      stripe: 'Stripe'
    }
    return nameMap[name] || name.charAt(0).toUpperCase() + name.slice(1)
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-6">Component Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-3"></div>
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Component Health</h2>

      {components.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {components.map((component) => (
            <div
              key={component.name}
              className={`border rounded-lg p-4 transition-all duration-200 hover:shadow-md ${getStatusColor(component.status)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900">
                  {getComponentDisplayName(component.name)}
                </h3>
                <span className={`text-lg ${getStatusTextColor(component.status)}`}>
                  {getStatusIcon(component.status)}
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Status</span>
                  <span className={`text-xs font-medium ${getStatusTextColor(component.status)}`}>
                    {component.status.charAt(0).toUpperCase() + component.status.slice(1)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Response</span>
                  <span className="text-xs text-gray-900">
                    {component.responseTime}ms
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Last Check</span>
                  <span className="text-xs text-gray-900">
                    {new Date(component.lastCheck).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* Show error details if component is unhealthy */}
              {component.status === 'unhealthy' && component.details?.error && (
                <div className="mt-3 pt-3 border-t border-red-200">
                  <p className="text-xs text-red-700 truncate" title={component.details.error}>
                    Error: {component.details.error}
                  </p>
                </div>
              )}

              {/* Show additional details for mock services */}
              {component.details?.note && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-600 truncate" title={component.details.note}>
                    {component.details.note}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">No component data available</p>
        </div>
      )}
    </div>
  )
}