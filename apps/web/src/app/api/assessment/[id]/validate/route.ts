import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
  params: {
    id: string
  }
}

// POST /api/assessment/[id]/validate - Validate assessment responses
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params
    const body = await request.json()
    const { domainResponses, industryClassification } = body

    // Mock validation - in production, would perform comprehensive validation
    const validation = {
      isValid: true,
      errors: [] as { field: string; message: string; type: string }[],
      warnings: [] as { field: string; message: string; type: string }[],
      completeness: calculateCompleteness(domainResponses),
      requiredFieldsMissing: [] as string[],
      crossDomainInconsistencies: [] as { domain1: string; domain2: string; issue: string }[]
    }

    // Add some basic validation logic
    if (!domainResponses || Object.keys(domainResponses).length === 0) {
      validation.isValid = false
      validation.errors.push({
        field: 'domainResponses',
        message: 'No domain responses provided',
        type: 'required'
      })
    }

    if (!industryClassification) {
      validation.warnings.push({
        field: 'industryClassification',
        message: 'Industry classification not set - some questions may not be tailored correctly',
        type: 'optional'
      })
    }

    return NextResponse.json(validation, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      }
    })

  } catch (error) {
    console.error('Assessment validation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to validate assessment' }
      },
      { status: 500 }
    )
  }
}

// Helper function to calculate completeness
function calculateCompleteness(domainResponses: any): number {
  if (!domainResponses) return 0

  const totalDomains = 12
  const domainsWithResponses = Object.keys(domainResponses).length

  if (domainsWithResponses === 0) return 0

  // Calculate average completeness across domains
  let totalCompleteness = 0
  for (const domain in domainResponses) {
    const responses = domainResponses[domain].questions || {}
    const responseCount = Object.keys(responses).length
    // Assume average of 8 questions per domain
    const domainCompleteness = Math.min(100, (responseCount / 8) * 100)
    totalCompleteness += domainCompleteness
  }

  return Math.round(totalCompleteness / domainsWithResponses)
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