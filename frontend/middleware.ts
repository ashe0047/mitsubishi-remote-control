import { NextRequest, NextResponse } from 'next/server';

// Define protected and public routes
const protectedRoutes = [
  '/dashboard',
  '/family',
  '/quotas',
  '/settings',
  '/profile',
  '/rooms',
];

const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/', // Home page - should redirect authenticated users
];

// Routes that should be accessible to everyone (including when not authenticated)
const publicAccessRoutes = [
  '/offline',
  '/api/auth/refresh',
  '/api/health',
];

// Admin-only routes (for parent users)
const adminRoutes = [
  '/family',
  '/quotas/manage',
  '/dashboard/admin',
];

// Child-only routes
const childRoutes = [
  '/quotas/status',
  '/dashboard/child',
];

/**
 * Validates JWT token structure and expiration (basic validation)
 * Note: This is a lightweight check. Full validation happens server-side.
 */
function isValidToken(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Decode payload to check expiration
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    return payload.exp && payload.exp > currentTime;
  } catch {
    return false;
  }
}

/**
 * Extracts user role from JWT token payload
 */
function getUserRoleFromToken(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

/**
 * Checks if user has authentication token in cookies
 * Note: Middleware can only access cookies, not localStorage
 */
function getAuthTokenFromRequest(request: NextRequest): string | null {
  // Primary: Check for httpOnly cookie set by login process
  const tokenCookie = request.cookies.get('auth-token')?.value;
  if (tokenCookie) return tokenCookie;
  
  // Fallback: Check for session cookie if auth-token is not available
  const sessionCookie = request.cookies.get('session')?.value;
  return sessionCookie || null;
}

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for public access routes
  if (publicAccessRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Get authentication token
  const token = getAuthTokenFromRequest(request);
  const isAuthenticated = token && isValidToken(token);
  const userRole = token ? getUserRoleFromToken(token) : null;
  
  // Check if current route is protected or public
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some(route => pathname.startsWith(route));
  const isChildRoute = childRoutes.some(route => pathname.startsWith(route));
  
  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // Redirect authenticated users from public routes to appropriate dashboard
  if (isPublicRoute && isAuthenticated) {
    if (userRole === 'PARENT') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    } else if (userRole === 'CHILD') {
      return NextResponse.redirect(new URL('/rooms', request.url));
    }
    // Fallback to main dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  
  // Role-based access control
  if (isAuthenticated && userRole) {
    // Restrict admin routes to parent users only
    if (isAdminRoute && userRole !== 'PARENT') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
    
    // Redirect parents trying to access child-only routes
    if (isChildRoute && userRole === 'PARENT') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }
  
  // Add authentication headers for client-side consumption
  const response = NextResponse.next();
  
  if (isAuthenticated && token) {
    response.headers.set('x-user-authenticated', 'true');
    if (userRole) {
      response.headers.set('x-user-role', userRole);
    }
  } else {
    response.headers.set('x-user-authenticated', 'false');
  }
  
  return response;
}

// Configure which routes the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes - handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest.json (metadata files)
     * - images, icons (static assets)
     * - sw.js, workbox- (service worker files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|workbox-|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)',
  ],
};