import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    id: string
  }
}

// POST /api/assessment/[id]/submit - Submit assessment for processing
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const body = await request.json()
    const { domainResponses, progress, industryClassification } = body

    // Mock submission - in production, would trigger analysis pipeline
    const submittedAssessment = {
      id,
      title: 'Sample Assessment',
      description: 'A sample operational assessment',
      status: 'submitted',
      createdAt: '2025-01-15T10:00:00Z',
      updatedAt: new Date().toISOString(),
      submittedAt: new Date().toISOString(),
      userId: 'temp-user-id',
      companyId: 'temp-company-id',
      industryClassification,
      domainResponses,
      progress,
      deliverySchedule: {
        executive24h: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        detailed48h: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        implementation72h: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      },
      metadata: {
        version: '1.0',
        schema: 'assessment-v1',
        submissionId: crypto.randomUUID(),
        analysisTriggered: true
      }
    }

    console.log('Assessment submitted for analysis:', {
      assessmentId: id,
      domainsCompleted: Object.keys(domainResponses || {}).length,
      overallProgress: progress?.overall || 0,
      completeness: progress?.completeness || 0
    })

    return NextResponse.json(submittedAssessment, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      }
    })

  } catch (error) {
    console.error('Assessment submission error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to submit assessment' }
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}