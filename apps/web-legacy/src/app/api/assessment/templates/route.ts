import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Mock domain templates for development
    // In production, this would fetch from a database or external service
    const templates = {
      'strategic-alignment': {
        name: 'Strategic Alignment',
        description: 'Assess strategic clarity, goal alignment, and organizational focus',
        questions: [
          {
            id: '1.1',
            question: 'How clear and well-defined is your company\'s strategic vision?',
            type: 'scale',
            required: true,
            scale: { min: 1, max: 5 },
            options: null,
            conditional: null,
            industrySpecific: null
          },
          {
            id: '1.2',
            question: 'How well aligned are your teams and departments with strategic objectives?',
            type: 'scale',
            required: true,
            scale: { min: 1, max: 5 },
            options: null,
            conditional: null,
            industrySpecific: null
          },
          {
            id: '1.3',
            question: 'How often do you review and adjust your strategic priorities?',
            type: 'multiple-choice',
            required: true,
            scale: null,
            options: ['Never', 'Annually', 'Quarterly', 'Monthly', 'Continuously'],
            conditional: null,
            industrySpecific: null
          }
        ],
        industrySpecific: {
          regulated: {
            additionalQuestions: [
              {
                id: '1.R1',
                question: 'How well integrated are regulatory requirements into your strategic planning?',
                type: 'scale',
                required: true,
                scale: { min: 1, max: 5 },
                options: null,
                conditional: null,
                industrySpecific: null
              }
            ]
          }
        },
        companyStageVariations: {
          startup: {
            questions: [
              {
                id: '1.S1',
                question: 'How validated is your product-market fit?',
                type: 'scale',
                required: true,
                scale: { min: 1, max: 5 },
                options: null,
                conditional: null,
                industrySpecific: null
              }
            ]
          },
          growth: {
            questions: [
              {
                id: '1.G1',
                question: 'How scalable is your current strategic framework?',
                type: 'scale',
                required: true,
                scale: { min: 1, max: 5 },
                options: null,
                conditional: null,
                industrySpecific: null
              }
            ]
          },
          mature: {
            questions: [
              {
                id: '1.M1',
                question: 'How effectively do you identify and pursue new market opportunities?',
                type: 'scale',
                required: true,
                scale: { min: 1, max: 5 },
                options: null,
                conditional: null,
                industrySpecific: null
              }
            ]
          }
        }
      },
      'financial-management': {
        name: 'Financial Management',
        description: 'Evaluate financial planning, cash flow management, and fiscal health',
        questions: [
          {
            id: '2.1',
            question: 'How predictable is your cash flow?',
            type: 'scale',
            required: true,
            scale: { min: 1, max: 5 },
            options: null,
            conditional: null,
            industrySpecific: null
          },
          {
            id: '2.2',
            question: 'How comprehensive is your financial reporting and analytics?',
            type: 'scale',
            required: true,
            scale: { min: 1, max: 5 },
            options: null,
            conditional: null,
            industrySpecific: null
          }
        ],
        industrySpecific: {
          regulated: {
            additionalQuestions: [
              {
                id: '2.R1',
                question: 'How well do you manage regulatory compliance costs?',
                type: 'scale',
                required: true,
                scale: { min: 1, max: 5 },
                options: null,
                conditional: null,
                industrySpecific: null
              }
            ]
          }
        },
        companyStageVariations: {
          startup: {
            questions: [
              {
                id: '2.S1',
                question: 'How long is your current runway?',
                type: 'multiple-choice',
                required: true,
                scale: null,
                options: ['< 6 months', '6-12 months', '12-24 months', '> 24 months'],
                conditional: null,
                industrySpecific: null
              }
            ]
          },
          growth: {
            questions: [
              {
                id: '2.G1',
                question: 'How well do you manage growth-related cash flow challenges?',
                type: 'scale',
                required: true,
                scale: { min: 1, max: 5 },
                options: null,
                conditional: null,
                industrySpecific: null
              }
            ]
          },
          mature: {
            questions: [
              {
                id: '2.M1',
                question: 'How optimized are your capital allocation decisions?',
                type: 'scale',
                required: true,
                scale: { min: 1, max: 5 },
                options: null,
                conditional: null,
                industrySpecific: null
              }
            ]
          }
        }
      }
    }

    return NextResponse.json(templates, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
      }
    })

  } catch (error) {
    console.error('Templates fetch error:', error)
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch templates' }
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}