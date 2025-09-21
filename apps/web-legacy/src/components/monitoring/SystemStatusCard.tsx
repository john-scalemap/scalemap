'use client'

import { SystemMetrics } from '@/stores/monitoring-store'

interface SystemStatusCardProps {
  systemMetrics: SystemMetrics | null
  isLoading: boolean
}

export default function SystemStatusCard({ systemMetrics, isLoading }: SystemStatusCardProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100'
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100'
      case 'unhealthy':
        return 'text-red-600 bg-red-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  const getStatusIcon = (status?: string) => {
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

  const formatUptime = (uptime: number) => {
    const hours = Math.floor(uptime / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = Math.floor(uptime % 60)

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900">System Status</h2>
        {systemMetrics && (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(systemMetrics.status)}`}>
            <span className="mr-1">{getStatusIcon(systemMetrics.status)}</span>
            {systemMetrics.status?.charAt(0).toUpperCase() + (systemMetrics.status?.slice(1) || '')}
          </span>
        )}
      </div>

      {systemMetrics ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <dt className="text-sm font-medium text-gray-500">Version</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {systemMetrics.version}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-500">Uptime</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {formatUptime(systemMetrics.uptime)}
            </dd>
          </div>

          {systemMetrics.responseTime && (
            <div>
              <dt className="text-sm font-medium text-gray-500">Response Time</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900">
                {systemMetrics.responseTime}ms
              </dd>
            </div>
          )}

          <div>
            <dt className="text-sm font-medium text-gray-500">Components</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {systemMetrics.components?.filter(c => c.status === 'healthy').length || 0}/
              {systemMetrics.components?.length || 0}
            </dd>
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">No system metrics available</p>
        </div>
      )}

      {systemMetrics && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <span>Last updated</span>
            <span>{new Date(systemMetrics.timestamp).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}