'use client'

import { create } from 'zustand'

export interface ComponentHealth {
  name: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  lastCheck: string
  details?: Record<string, any>
}

export interface SystemMetrics {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version?: string
  responseTime?: number
  components?: ComponentHealth[]
}

export interface DashboardData {
  systemOverview: {
    overallStatus: 'healthy' | 'degraded' | 'unhealthy'
    componentCount: number
    activeIncidents: number
    lastChecked: string
  }
  components: Array<{
    name: string
    status: 'healthy' | 'degraded' | 'unhealthy'
    responseTime: number
    uptime: number
    lastCheck: string
  }>
  recentIncidents: Array<{
    incidentId: string
    alertName: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    status: 'open' | 'acknowledged' | 'resolved'
    createdAt: string
    affectedComponents: string[]
  }>
  metrics: {
    responseTimeHistory: Array<{ timestamp: string; value: number }>
    errorRateHistory: Array<{ timestamp: string; value: number }>
    uptimePercentage: number
  }
}

export interface AlertConfig {
  id: string
  name: string
  enabled: boolean
  condition: 'unhealthy' | 'degraded' | 'slow_response'
  threshold?: number
  recipients: string[]
}

interface MonitoringState {
  // Current system status
  systemMetrics: SystemMetrics | null
  dashboardData: DashboardData | null
  isLoading: boolean
  lastUpdated: string | null
  error: string | null

  // Historical data
  historicalMetrics: SystemMetrics[]

  // Alerts and incidents
  alerts: AlertConfig[]
  activeAlerts: string[]
  recentIncidents: DashboardData['recentIncidents']

  // Actions
  fetchSystemMetrics: () => Promise<void>
  fetchDetailedMetrics: () => Promise<void>
  fetchDashboardData: (timeRange?: string) => Promise<void>
  addAlert: (alert: AlertConfig) => void
  updateAlert: (id: string, updates: Partial<AlertConfig>) => void
  removeAlert: (id: string) => void
  clearError: () => void
}

export const useMonitoringStore = create<MonitoringState>((set, get) => ({
  systemMetrics: null,
  dashboardData: null,
  isLoading: false,
  lastUpdated: null,
  error: null,
  historicalMetrics: [],
  alerts: [
    {
      id: 'system-unhealthy',
      name: 'System Unhealthy',
      enabled: true,
      condition: 'unhealthy',
      recipients: ['admin@scalemap.ai']
    },
    {
      id: 'system-degraded',
      name: 'System Degraded',
      enabled: true,
      condition: 'degraded',
      recipients: ['admin@scalemap.ai']
    },
    {
      id: 'slow-response',
      name: 'Slow Response Time',
      enabled: true,
      condition: 'slow_response',
      threshold: 5000,
      recipients: ['admin@scalemap.ai']
    }
  ],
  activeAlerts: [],
  recentIncidents: [],

  fetchSystemMetrics: async () => {
    try {
      set({ isLoading: true, error: null })

      // TODO: Replace with actual API call
      const response = await fetch('/api/health')

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      set({
        systemMetrics: data,
        lastUpdated: new Date().toISOString(),
        isLoading: false
      })
    } catch (error) {
      console.error('Failed to fetch system metrics:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch metrics',
        isLoading: false
      })
    }
  },

  fetchDetailedMetrics: async () => {
    try {
      set({ isLoading: true, error: null })

      // TODO: Replace with actual API call
      const response = await fetch('/api/health/detailed')

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Add to historical data
      const currentHistorical = get().historicalMetrics
      const newHistorical = [...currentHistorical, data].slice(-50) // Keep last 50 entries

      set({
        systemMetrics: data,
        historicalMetrics: newHistorical,
        lastUpdated: new Date().toISOString(),
        isLoading: false
      })

      // Check for alerts
      const alerts = get().alerts.filter(alert => alert.enabled)
      const newActiveAlerts: string[] = []

      alerts.forEach(alert => {
        switch (alert.condition) {
          case 'unhealthy':
            if (data.status === 'unhealthy') {
              newActiveAlerts.push(alert.id)
            }
            break
          case 'degraded':
            if (data.status === 'degraded') {
              newActiveAlerts.push(alert.id)
            }
            break
          case 'slow_response':
            if (data.responseTime && alert.threshold && data.responseTime > alert.threshold) {
              newActiveAlerts.push(alert.id)
            }
            break
        }
      })

      set({ activeAlerts: newActiveAlerts })
    } catch (error) {
      console.error('Failed to fetch detailed metrics:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch detailed metrics',
        isLoading: false
      })
    }
  },

  fetchDashboardData: async (timeRange = '1h') => {
    try {
      set({ isLoading: true, error: null })

      const response = await fetch(`/api/monitoring/dashboard?timeRange=${timeRange}`)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const dashboardData: DashboardData = await response.json()

      // Transform dashboard data to system metrics format for compatibility
      const systemMetrics: SystemMetrics = {
        status: dashboardData.systemOverview.overallStatus,
        timestamp: dashboardData.systemOverview.lastChecked,
        uptime: dashboardData.metrics.uptimePercentage,
        components: dashboardData.components.map(comp => ({
          name: comp.name,
          status: comp.status,
          responseTime: comp.responseTime,
          lastCheck: comp.lastCheck
        }))
      }

      set({
        dashboardData,
        systemMetrics,
        recentIncidents: dashboardData.recentIncidents,
        lastUpdated: new Date().toISOString(),
        isLoading: false
      })

      // Update active alerts based on incidents
      const activeAlertIds = dashboardData.recentIncidents
        .filter(incident => incident.status === 'open')
        .map(incident => incident.alertName.toLowerCase().replace(/\s+/g, '-'))

      set({ activeAlerts: activeAlertIds })

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch dashboard data',
        isLoading: false
      })
    }
  },

  addAlert: (alert) => {
    const alerts = get().alerts
    set({ alerts: [...alerts, alert] })
  },

  updateAlert: (id, updates) => {
    const alerts = get().alerts
    const updatedAlerts = alerts.map(alert =>
      alert.id === id ? { ...alert, ...updates } : alert
    )
    set({ alerts: updatedAlerts })
  },

  removeAlert: (id) => {
    const alerts = get().alerts
    const filteredAlerts = alerts.filter(alert => alert.id !== id)
    set({ alerts: filteredAlerts })
  },

  clearError: () => {
    set({ error: null })
  }
}))