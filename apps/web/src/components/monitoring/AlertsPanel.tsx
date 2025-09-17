'use client'

import { useState } from 'react'

import { useMonitoringStore } from '@/stores/monitoring-store'

export default function AlertsPanel() {
  const { alerts, activeAlerts, updateAlert } = useMonitoringStore()
  const [showAllAlerts, setShowAllAlerts] = useState(false)

  const toggleAlert = (id: string) => {
    const alert = alerts.find(a => a.id === id)
    if (alert) {
      updateAlert(id, { enabled: !alert.enabled })
    }
  }

  const getAlertStatusIcon = (alertId: string) => {
    if (activeAlerts.includes(alertId)) {
      return '🔴'
    }
    return '🟢'
  }

  const getAlertDescription = (alert: any) => {
    switch (alert.condition) {
      case 'unhealthy':
        return 'Triggers when system status is unhealthy'
      case 'degraded':
        return 'Triggers when system status is degraded'
      case 'slow_response':
        return `Triggers when response time exceeds ${alert.threshold}ms`
      default:
        return 'Custom alert condition'
    }
  }

  const activeAlertsList = alerts.filter(alert => activeAlerts.includes(alert.id))
  const displayAlerts = showAllAlerts ? alerts : activeAlertsList

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAllAlerts(!showAllAlerts)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showAllAlerts ? 'Show Active Only' : 'Show All'}
          </button>
        </div>
      </div>

      {/* Active Alerts Summary */}
      {activeAlertsList.length > 0 && !showAllAlerts && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {activeAlertsList.length} Active Alert{activeAlertsList.length !== 1 ? 's' : ''}
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc list-inside space-y-1">
                  {activeAlertsList.map(alert => (
                    <li key={alert.id}>{alert.name}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Configuration List */}
      <div className="space-y-4">
        {displayAlerts.length > 0 ? (
          displayAlerts.map((alert) => (
            <div key={alert.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <span className="text-lg">
                    {getAlertStatusIcon(alert.id)}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {alert.name}
                    </h4>
                    <p className="mt-1 text-xs text-gray-500">
                      {getAlertDescription(alert)}
                    </p>
                    <div className="mt-2 text-xs text-gray-400">
                      Recipients: {alert.recipients.join(', ')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      alert.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {alert.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              {activeAlerts.includes(alert.id) && (
                <div className="mt-3 pt-3 border-t border-red-200">
                  <div className="flex items-center text-sm text-red-600">
                    <span className="mr-2">🚨</span>
                    <span>Alert is currently active</span>
                  </div>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <span className="text-4xl">🔔</span>
            </div>
            <h3 className="text-sm font-medium text-gray-900">
              {showAllAlerts ? 'No Alerts Configured' : 'No Active Alerts'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {showAllAlerts
                ? 'Alert configurations will appear here.'
                : 'All systems are operating normally.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-500">
            {alerts.filter(a => a.enabled).length} of {alerts.length} alerts enabled
          </span>
          <button className="text-blue-600 hover:text-blue-700">
            Manage Alerts
          </button>
        </div>
      </div>
    </div>
  )
}