import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: {
    id: string;
  };
}

// GET /api/assessments/[id] - Fetch specific assessment
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;

    // Proxy to live backend API
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod';
    const authHeader = request.headers.get('authorization');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${backendUrl}/assessments/${id}`, {
      method: 'GET',
      headers,
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,PUT,PATCH,OPTIONS',
      },
    });
  } catch (error) {
    console.error('Assessment fetch error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch assessment' },
      },
      { status: 500 }
    );
  }
}

// PUT /api/assessments/[id] - Update assessment
export async function PUT(request: NextRequest, { params }: RouteParams) {
  return handleUpdateAssessment(request, params);
}

// PATCH /api/assessments/[id] - Update assessment (partial)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return handleUpdateAssessment(request, params);
}

async function handleUpdateAssessment(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const body = await request.json();

    // Proxy to live backend API
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      'https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod';

    // Get auth header
    const authHeader = request.headers.get('authorization');

    console.log('Updating assessment:', id, 'Auth header present:', !!authHeader);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Only add Authorization header if we have a token
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${backendUrl}/assessments/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,PUT,PATCH,OPTIONS',
      },
    });
  } catch (error) {
    console.error('Assessment update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'PROXY_ERROR', message: 'Failed to reach backend service' },
      },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, PUT, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
