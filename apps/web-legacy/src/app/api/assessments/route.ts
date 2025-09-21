import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Redirect to live backend API
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod';

  try {
    const { searchParams } = new URL(request.url);
    const authHeader = request.headers.get('authorization');

    const response = await fetch(`${backendUrl}/assessments?${searchParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
      },
    });

    const data = await response.json();

    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      }
    });

  } catch (error) {
    console.error('Assessment proxy error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: 'Failed to reach backend service' } },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Redirect to live backend API
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://nb3pzj6u65.execute-api.eu-west-1.amazonaws.com/prod';

  try {
    const body = await request.text();
    let authHeader = request.headers.get('authorization');

    // If no auth header provided, try to get it from cookies or custom header
    if (!authHeader) {
      // Check for a custom header that the frontend might be using
      const tokenHeader = request.headers.get('x-access-token');
      if (tokenHeader) {
        authHeader = `Bearer ${tokenHeader}`;
      }
    }

    console.log('Assessment API Proxy: Auth header present:', !!authHeader);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Only add Authorization header if we have a token
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${backendUrl}/assessments`, {
      method: 'POST',
      headers,
      body,
    });

    const data = await response.json();

    // Return proper CORS headers for the frontend domain
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Access-Token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Credentials': 'true',
      }
    });

  } catch (error) {
    console.error('Assessment proxy error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: 'Failed to reach backend service' } },
      { status: 502 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Access-Token',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}