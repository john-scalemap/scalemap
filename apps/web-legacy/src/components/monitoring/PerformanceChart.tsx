'use client'

import { useMonitoringStore } from '@/stores/monitoring-store'

interface PerformanceChartProps {
  isLoading: boolean
}

export default function PerformanceChart({ isLoading }: PerformanceChartProps) {
  const { historicalMetrics } = useMonitoringStore()

  const getChartData = () => {
    if (!historicalMetrics.length) return { labels: [], data: [] }

    const last20 = historicalMetrics.slice(-20)
    const labels = last20.map((_, index) => `${index + 1}`)
    const data = last20.map(metric => metric.responseTime || 0)

    return { labels, data }
  }

  const getStatusCounts = () => {
    if (!historicalMetrics.length) return { healthy: 0, degraded: 0, unhealthy: 0 }

    const counts = historicalMetrics.reduce((acc, metric) => {
      acc[metric.status] = (acc[metric.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      healthy: counts.healthy || 0,
      degraded: counts.degraded || 0,
      unhealthy: counts.unhealthy || 0
    }
  }

  const { labels, data } = getChartData()
  const statusCounts = getStatusCounts()

  const maxValue = Math.max(...data, 100)
  const chartHeight = 200

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-48 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Performance Metrics</h2>
        <div className="flex space-x-4 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="text-gray-600">Healthy ({statusCounts.healthy})</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
            <span className="text-gray-600">Degraded ({statusCounts.degraded})</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
            <span className="text-gray-600">Unhealthy ({statusCounts.unhealthy})</span>
          </div>
        </div>
      </div>

      {data.length > 0 ? (
        <div className="space-y-6">
          {/* Response Time Chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-4">Response Time (Last 20 Checks)</h3>
            <div className="relative" style={{ height: chartHeight }}>
              <svg width="100%" height={chartHeight} className="border border-gray-200 rounded">
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                  <line
                    key={ratio}
                    x1="0"
                    y1={chartHeight * ratio}
                    x2="100%"
                    y2={chartHeight * ratio}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                ))}

                {/* Chart line */}
                <polyline
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  points={data.map((value, index) => {
                    const x = (index / Math.max(data.length - 1, 1)) * 100
                    const y = chartHeight - (value / maxValue) * chartHeight
                    return `${x}%,${y}`
                  }).join(' ')}
                />

                {/* Data points */}
                {data.map((value, index) => {
                  const x = (index / Math.max(data.length - 1, 1)) * 100
                  const y = chartHeight - (value / maxValue) * chartHeight
                  return (
                    <circle
                      key={index}
                      cx={`${x}%`}
                      cy={y}
                      r="3"
                      fill="#3b82f6"
                    />
                  )
                })}
              </svg>

              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 -ml-8">
                <span>{maxValue}ms</span>
                <span>{Math.round(maxValue * 0.75)}ms</span>
                <span>{Math.round(maxValue * 0.5)}ms</span>
                <span>{Math.round(maxValue * 0.25)}ms</span>
                <span>0ms</span>
              </div>
            </div>
          </div>

          {/* Summary Statistics */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <dt className="text-sm font-medium text-gray-500">Average Response</dt>
              <dd className="mt-1 text-2xl font-semibold text-gray-900">
                {Math.round(data.reduce((sum, val) => sum + val, 0) / data.length)}ms
              </dd>
            </div>
            <div className="text-center">
              <dt className="text-sm font-medium text-gray-500">Min Response</dt>
              <dd className="mt-1 text-2xl font-semibold text-green-600">
                {Math.min(...data)}ms
              </dd>
            </div>
            <div className="text-center">
              <dt className="text-sm font-medium text-gray-500">Max Response</dt>
              <dd className="mt-1 text-2xl font-semibold text-red-600">
                {Math.max(...data)}ms
              </dd>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-sm font-medium text-gray-900">No Performance Data</h3>
          <p className="mt-1 text-sm text-gray-500">
            Performance data will appear here after health checks are collected.
          </p>
        </div>
      )}
    </div>
  )
}