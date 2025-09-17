import { NextResponse } from 'next/server'

// Mock detailed health data for development
// TODO: Replace with actual API calls to the backend detailed health endpoints
export async function GET() {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200))

    // Generate random response times and occasionally unhealthy components
    const generateRandomHealth = () => {
      const rand = Math.random()
      if (rand < 0.8) return { status: 'healthy', responseTime: 50 + Math.random() * 100 }
      if (rand < 0.95) return { status: 'degraded', responseTime: 200 + Math.random() * 300 }
      return { status: 'unhealthy', responseTime: 5000 + Math.random() * 2000 }
    }

    const dynamoHealth = generateRandomHealth()
    const sesHealth = generateRandomHealth()
    const openaiHealth = generateRandomHealth()
    const stripeHealth = generateRandomHealth()

    const components = [
      {
        name: 'dynamodb',
        status: dynamoHealth.status,
        responseTime: Math.round(dynamoHealth.responseTime),
        lastCheck: new Date().toISOString(),
        details: dynamoHealth.status === 'unhealthy' ? { error: 'Connection timeout' } : { tableName: 'scalemap-main', tableStatus: 'ACTIVE' }
      },
      {
        name: 'ses',
        status: sesHealth.status,
        responseTime: Math.round(sesHealth.responseTime),
        lastCheck: new Date().toISOString(),
        details: sesHealth.status === 'unhealthy' ? { error: 'Rate limit exceeded' } : undefined
      },
      {
        name: 'openai',
        status: openaiHealth.status,
        responseTime: Math.round(openaiHealth.responseTime),
        lastCheck: new Date().toISOString(),
        details: openaiHealth.status === 'unhealthy' ? { error: 'API key invalid' } : { note: 'Mock implementation - replace with actual OpenAI API check' }
      },
      {
        name: 'stripe',
        status: stripeHealth.status,
        responseTime: Math.round(stripeHealth.responseTime),
        lastCheck: new Date().toISOString(),
        details: stripeHealth.status === 'unhealthy' ? { error: 'Webhook validation failed' } : { note: 'Mock implementation - replace with actual Stripe API check' }
      }
    ]

    // Determine overall status
    const unhealthyComponents = components.filter(c => c.status === 'unhealthy')
    const degradedComponents = components.filter(c => c.status === 'degraded')

    let overallStatus = 'healthy'
    if (unhealthyComponents.some(c => c.name === 'dynamodb')) {
      overallStatus = 'unhealthy'
    } else if (unhealthyComponents.length > 0 || degradedComponents.length > 0) {
      overallStatus = 'degraded'
    }

    const totalResponseTime = components.reduce((sum, c) => sum + c.responseTime, 0)

    const detailedHealthData = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(Math.random() * 86400),
      version: '1.0.0',
      components,
      responseTime: Math.round(totalResponseTime / components.length)
    }

    return NextResponse.json(detailedHealthData)
  } catch (error) {
    console.error('Detailed health check error:', error)

    return NextResponse.json(
      {
        error: 'Detailed health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}