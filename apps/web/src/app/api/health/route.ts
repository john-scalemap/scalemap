import { NextResponse } from 'next/server'

// Mock health data for development
// TODO: Replace with actual API calls to the backend health endpoints
export async function GET() {
  try {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100))

    // Mock health response matching the backend format
    const healthData = {
      status: 'healthy',
      message: 'ScaleMap API is healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.floor(Math.random() * 86400), // Random uptime in seconds
      requestId: `req-${Date.now()}`
    }

    return NextResponse.json(healthData)
  } catch (error) {
    console.error('Health check error:', error)

    return NextResponse.json(
      {
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}