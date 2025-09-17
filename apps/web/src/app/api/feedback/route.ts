import { NextRequest, NextResponse } from 'next/server'

interface FeedbackData {
  type: 'bug' | 'feature' | 'improvement' | 'other'
  title: string
  description: string
  email?: string
  rating?: number
  page: string
  userAgent: string
}

export async function POST(request: NextRequest) {
  try {
    const feedbackData: FeedbackData = await request.json()

    // Validate required fields
    const { type, title, description, page, userAgent } = feedbackData
    if (!type || !title || !description || !page || !userAgent) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate email format if provided
    if (feedbackData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(feedbackData.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate rating if provided
    if (feedbackData.rating && (feedbackData.rating < 1 || feedbackData.rating > 5)) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Add timestamp and additional metadata
    const enhancedFeedback = {
      ...feedbackData,
      timestamp: new Date().toISOString(),
      ip: request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
      id: `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`
    }

    console.log('Feedback received:', enhancedFeedback)

    // In a real implementation, you would:
    // 1. Store feedback in database
    // 2. Send notification to development team
    // 3. Create ticket in tracking system if it's a bug
    // 4. Send confirmation email if email provided

    // For now, simulate processing
    if (type === 'bug') {
      console.log('Bug report - creating high priority ticket')
    } else if (type === 'feature') {
      console.log('Feature request - adding to product backlog')
    }

    return NextResponse.json({
      success: true,
      id: enhancedFeedback.id,
      message: 'Thank you for your feedback! We appreciate your input.'
    })

  } catch (error) {
    console.error('Error processing feedback:', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 }
    )
  }
}