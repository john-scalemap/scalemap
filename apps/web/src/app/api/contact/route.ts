import { NextRequest, NextResponse } from 'next/server'

interface ContactFormData {
  name: string
  email: string
  company?: string
  subject: string
  message: string
}

// Simple in-memory rate limiting (in production, use Redis)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT_WINDOW = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX = 5 // 5 submissions per 15 minutes

function checkRateLimit(clientIP: string): { allowed: boolean; resetTime?: number } {
  const now = Date.now()
  const record = rateLimitMap.get(clientIP)

  if (!record || now > record.resetTime) {
    // First request or window expired
    rateLimitMap.set(clientIP, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return { allowed: true }
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, resetTime: record.resetTime }
  }

  record.count++
  return { allowed: true }
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const rateLimitResult = checkRateLimit(clientIP)

    if (!rateLimitResult.allowed) {
      const resetTimeMinutes = Math.ceil((rateLimitResult.resetTime! - Date.now()) / 60000)
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please try again in ${resetTimeMinutes} minutes.`,
          retryAfter: resetTimeMinutes
        },
        {
          status: 429,
          headers: {
            'Retry-After': resetTimeMinutes.toString()
          }
        }
      )
    }

    const formData: ContactFormData = await request.json()

    // Validate required fields
    const { name, email, subject, message } = formData
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Basic input sanitization
    function sanitizeInput(input: string): string {
      return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    }

    const sanitizedData = {
      name: sanitizeInput(name),
      email: sanitizeInput(email),
      company: formData.company ? sanitizeInput(formData.company) : undefined,
      subject: sanitizeInput(subject),
      message: sanitizeInput(message)
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(sanitizedData.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Determine ticket type based on subject
    let ticketType = 'other'
    const subjectLower = sanitizedData.subject.toLowerCase()
    if (subjectLower === 'sales') ticketType = 'sales'
    else if (subjectLower === 'support') ticketType = 'support'
    else if (subjectLower === 'partnership') ticketType = 'partnership'
    else if (subjectLower === 'demo') ticketType = 'demo'

    // In a real implementation, this would call the Lambda function
    // For now, we'll simulate the API call
    const ticketData = {
      ...sanitizedData,
      type: ticketType
    }

    console.log('Contact form submission:', ticketData)

    // Simulate API response
    const mockTicketId = `TICKET-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`

    // In production, you would:
    // 1. Call the Lambda function via AWS SDK or HTTP request
    // 2. Handle the response and error cases
    // 3. Return appropriate status codes

    // For now, simulate a successful submission
    return NextResponse.json({
      success: true,
      ticketId: mockTicketId,
      message: 'Thank you for your message! We\'ll get back to you within 24 hours.'
    })

  } catch (error) {
    console.error('Error processing contact form:', error)
    return NextResponse.json(
      { error: 'Internal server error. Please try again later.' },
      { status: 500 }
    )
  }
}