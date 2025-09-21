import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, description } = body

    // Basic validation
    if (!title || !description) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_REQUEST', message: 'Title and description are required' }
        },
        { status: 400 }
      )
    }

    // For development/demo purposes, create a mock assessment
    const assessment = {
      id: crypto.randomUUID(),
      title,
      description,
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: crypto.randomUUID(), // In real app, get from auth token
      companyId: crypto.randomUUID(),
      industryClassification: null,
      domainResponses: {},
      progress: {
        overall: 0,
        completeness: 0,
        estimatedTimeRemaining: '45-60 minutes'
      },
      metadata: {
        version: '1.0',
        schema: 'assessment-v1'
      }
    }

    return NextResponse.json(assessment, {
      status: 201,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
      }
    })

  } catch (error) {
    console.error('Assessment creation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to create assessment' }
      },
      { status: 500 }
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}