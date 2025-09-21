'use client'

import { useEffect } from 'react'

import { useMonitoringStore } from '@/stores/monitoring-store'

import AlertsPanel from './AlertsPanel'
import ComponentHealthGrid from './ComponentHealthGrid'
import PerformanceChart from './PerformanceChart'
import SystemStatusCard from './SystemStatusCard'

export default function MonitoringDashboard() {
  const {
    systemMetrics,
    dashboardData,
    isLoading,
    error,
    lastUpdated,
    activeAlerts,
    recentIncidents,
    fetchDetailedMetrics,
    fetchDashboardData,
    clearError
  } = useMonitoringStore()

  useEffect(() => {
    // Initial fetch - use dashboard data for richer information
    fetchDashboardData('1h')

    // Set up polling every 30 seconds
    const interval = setInterval(() => fetchDashboardData('1h'), 30000)

    return () => clearInterval(interval)
  }, [fetchDashboardData])

  const handleRefresh = () => {
    fetchDashboardData('1h')
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error Loading Dashboard
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <div className="flex space-x-2">
                    <button
                      onClick={handleRefresh}
                      className="bg-red-100 px-3 py-2 rounded-md text-sm text-red-800 hover:bg-red-200"
                    >
                      Retry
                    </button>
                    <button
                      onClick={clearError}
                      className="bg-red-100 px-3 py-2 rounded-md text-sm text-red-800 hover:bg-red-200"
                    >
                      Clear Error
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
              <p className="mt-1 text-sm text-gray-500">
                Real-time system health and performance metrics
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Last updated: {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Active Alerts */}
          {activeAlerts.length > 0 && (
            <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <span className="text-yellow-400">⚠</span>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    {activeAlerts.length} active alert{activeAlerts.length !== 1 ? 's' : ''} detected
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {/* System Status Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SystemStatusCard
                systemMetrics={systemMetrics}
                isLoading={isLoading}
              />
            </div>
            <div>
              <AlertsPanel />
            </div>
          </div>

          {/* Component Health Grid */}
          <ComponentHealthGrid
            components={systemMetrics?.components || []}
            isLoading={isLoading}
          />

          {/* Performance Chart */}
          <PerformanceChart isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}