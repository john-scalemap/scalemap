import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Mock data for demonstration - in production this would call the Lambda function
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '1h'
    const component = searchParams.get('component')

    // In a real implementation, this would:
    // 1. Call the dashboard-data Lambda function
    // 2. Or directly query CloudWatch and DynamoDB
    // For now, we'll return mock data

    const mockDashboardData = {
      systemOverview: {
        overallStatus: 'healthy' as const,
        componentCount: 4,
        activeIncidents: 0,
        lastChecked: new Date().toISOString()
      },
      components: [
        {
          name: 'dynamodb',
          status: 'healthy' as const,
          responseTime: 150,
          uptime: 99.9,
          lastCheck: new Date().toISOString()
        },
        {
          name: 'ses',
          status: 'healthy' as const,
          responseTime: 300,
          uptime: 99.8,
          lastCheck: new Date().toISOString()
        },
        {
          name: 'openai',
          status: 'healthy' as const,
          responseTime: 800,
          uptime: 99.5,
          lastCheck: new Date().toISOString()
        },
        {
          name: 'stripe',
          status: 'healthy' as const,
          responseTime: 400,
          uptime: 99.9,
          lastCheck: new Date().toISOString()
        }
      ].filter(comp => !component || comp.name === component),
      recentIncidents: [
        // Mock incident data
        {
          incidentId: 'INC-1234567890-ABC123',
          alertName: 'High Response Time Alert',
          severity: 'medium' as const,
          status: 'resolved' as const,
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
          affectedComponents: ['openai']
        }
      ],
      metrics: {
        responseTimeHistory: generateMockHistory(timeRange, 'responseTime'),
        errorRateHistory: generateMockHistory(timeRange, 'errorRate'),
        uptimePercentage: 99.7
      }
    }

    return NextResponse.json(mockDashboardData)

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateMockHistory(timeRange: string, metricType: 'responseTime' | 'errorRate') {
  const now = new Date()
  const points: Array<{ timestamp: string; value: number }> = []

  let intervalMinutes: number
  let pointCount: number

  switch (timeRange) {
    case '1h':
      intervalMinutes = 5
      pointCount = 12
      break
    case '6h':
      intervalMinutes = 30
      pointCount = 12
      break
    case '24h':
      intervalMinutes = 120
      pointCount = 12
      break
    case '7d':
      intervalMinutes = 720
      pointCount = 14
      break
    case '30d':
      intervalMinutes = 2880
      pointCount = 15
      break
    default:
      intervalMinutes = 5
      pointCount = 12
  }

  for (let i = pointCount; i >= 0; i--) {
    const timestamp = new Date(now.getTime() - i * intervalMinutes * 60 * 1000)

    let value: number
    if (metricType === 'responseTime') {
      // Generate response time between 100-1000ms with some variation
      value = 200 + Math.random() * 300 + Math.sin(i / 3) * 100
    } else {
      // Generate error rate between 0-5% with mostly low values
      value = Math.random() * 2 + Math.random() * Math.random() * 3
    }

    points.push({
      timestamp: timestamp.toISOString(),
      value: Math.round(value * 100) / 100
    })
  }

  return points
}