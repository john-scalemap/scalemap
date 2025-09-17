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
    const authHeader = request.headers.get('authorization');

    const response = await fetch(`${backendUrl}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader || '',
      },
      body,
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

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}