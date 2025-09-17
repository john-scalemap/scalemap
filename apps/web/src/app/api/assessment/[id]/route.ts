import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/assessment/[id] - Fetch specific assessment
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params

    // For development/demo purposes, create a mock assessment
    // In production, this would fetch from database
    const assessment = {
      id,
      title: 'Sample Assessment',
      description: 'A sample operational assessment',
      status: 'draft',
      createdAt: '2025-01-15T10:00:00Z',
      updatedAt: new Date().toISOString(),
      userId: 'temp-user-id',
      companyId: 'temp-company-id',
      industryClassification: {
        sector: 'technology',
        subSector: 'saas',
        regulatoryClassification: 'lightly-regulated',
        businessModel: 'b2b-saas',
        companyStage: 'growth',
        employeeCount: 50
      },
      domainResponses: {},
      progress: {
        overall: 0,
        completeness: 0,
        estimatedTimeRemaining: '45-60 minutes',
        domains: {
          'strategic-alignment': { completed: 0, total: 7, status: 'not-started', requiredQuestions: 6, optionalQuestions: 1 },
          'financial-management': { completed: 0, total: 9, status: 'not-started', requiredQuestions: 7, optionalQuestions: 2 },
          'revenue-engine': { completed: 0, total: 9, status: 'not-started', requiredQuestions: 7, optionalQuestions: 2 },
          'operational-excellence': { completed: 0, total: 8, status: 'not-started', requiredQuestions: 7, optionalQuestions: 1 },
          'people-organization': { completed: 0, total: 9, status: 'not-started', requiredQuestions: 7, optionalQuestions: 2 },
          'technology-data': { completed: 0, total: 8, status: 'not-started', requiredQuestions: 7, optionalQuestions: 1 },
          'customer-experience': { completed: 0, total: 8, status: 'not-started', requiredQuestions: 7, optionalQuestions: 1 },
          'supply-chain': { completed: 0, total: 6, status: 'not-started', requiredQuestions: 4, optionalQuestions: 2 },
          'risk-compliance': { completed: 0, total: 8, status: 'not-started', requiredQuestions: 6, optionalQuestions: 2 },
          'partnerships': { completed: 0, total: 7, status: 'not-started', requiredQuestions: 6, optionalQuestions: 1 },
          'customer-success': { completed: 0, total: 8, status: 'not-started', requiredQuestions: 6, optionalQuestions: 2 },
          'change-management': { completed: 0, total: 8, status: 'not-started', requiredQuestions: 7, optionalQuestions: 1 }
        }
      },
      metadata: {
        version: '1.0',
        schema: 'assessment-v1'
      }
    }

    return NextResponse.json(assessment, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
      }
    })

  } catch (error) {
    console.error('Assessment fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assessment' }
      },
      { status: 500 }
    )
  }
}

// PUT /api/assessment/[id] - Update assessment
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const body = await request.json()

    // Mock update - in production, update database
    console.log('Updating assessment:', id, body)

    // Return success response
    return NextResponse.json(
      { success: true, message: 'Assessment updated successfully' },
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
        }
      }
    )

  } catch (error) {
    console.error('Assessment update error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to update assessment' }
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
      'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}