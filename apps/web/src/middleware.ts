import { NextRequest, NextResponse } from 'next/server';

// Define protected routes and their requirements
const protectedRoutes = [
  {
    path: '/dashboard',
    permissions: ['assessments:read'],
  },
  {
    path: '/assessments',
    permissions: ['assessments:read'],
  },
  {
    path: '/company',
    permissions: ['company:read'],
  },
  {
    path: '/settings',
    permissions: ['company:read'],
  },
  {
    path: '/admin',
    role: 'admin',
  },
];

// Public routes that don't require authentication
const publicRoutes = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/contact',
  '/about',
  '/privacy',
  '/terms',
];

// API routes that handle their own authentication
const apiRoutes = [
  '/api',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, images, and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Skip middleware for API routes (they handle their own auth)
  if (apiRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Allow public routes
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // Check if route is protected
  const protectedRoute = protectedRoutes.find(route =>
    pathname.startsWith(route.path)
  );

  if (protectedRoute) {
    // Check for authentication token
    const authToken = request.cookies.get('scalemap_refresh_token')?.value;

    if (!authToken) {
      // No auth token, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // For client-side routing, we'll let the React components handle
    // detailed permission checking. The middleware just ensures
    // basic authentication is present.

    // Add auth headers for the client
    const response = NextResponse.next();
    response.headers.set('x-authenticated', 'true');
    return response;
  }

  // Allow other routes to pass through
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};