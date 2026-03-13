import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { ServiceAccount } from 'firebase-admin/app';

// Initialize Firebase Admin (modular SDK)
if (!getApps().length) {
  const serviceAccount: Partial<ServiceAccount> = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };

  const hasServiceAccount =
    !!serviceAccount.projectId && !!serviceAccount.clientEmail && !!serviceAccount.privateKey;

  initializeApp({
    credential: hasServiceAccount
      ? cert(serviceAccount as ServiceAccount)
      : applicationDefault(),
  });
}

const auth = getAuth();

// Rate limiting store (in-memory, consider Redis for production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100; // Max requests per window

export interface AuthResult {
  success: boolean;
  uid?: string;
  email?: string;
  error?: string;
}

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIP) {
    return realIP;
  }
  return 'unknown';
}

/**
 * Check rate limit for a given identifier
 */
export function checkRateLimit(identifier: string, maxRequests: number = RATE_LIMIT_MAX_REQUESTS): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Rate limit middleware check
 */
export function rateLimit(request: NextRequest, maxRequests: number = RATE_LIMIT_MAX_REQUESTS): NextResponse | null {
  const clientIP = getClientIP(request);
  const endpoint = request.nextUrl.pathname;
  const identifier = `${clientIP}:${endpoint}`;

  if (!checkRateLimit(identifier, maxRequests)) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { 
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
        }
      }
    );
  }

  return null;
}

/**
 * Verify admin token and return auth result
 */
export async function verifyAdminToken(request: NextRequest): Promise<string | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    
    // Validate token format (basic check)
    if (!token || token.length < 100) {
      return null;
    }

    const decodedToken = await auth.verifyIdToken(token);

    // Check token expiration (extra validation)
    const tokenAge = Date.now() / 1000 - decodedToken.iat;
    const MAX_TOKEN_AGE = 3600; // 1 hour
    if (tokenAge > MAX_TOKEN_AGE) {
      console.warn('Token too old:', tokenAge);
      return null;
    }

    // Check if user is admin by email
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
    if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) {
      console.warn('Non-admin access attempt:', decodedToken.email);
      return null;
    }

    return decodedToken.uid;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

/**
 * Full authentication check with rate limiting
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  // Check rate limit first
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) {
    return { success: false, error: 'Rate limit exceeded' };
  }

  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { success: false, error: 'Missing or invalid authorization header' };
    }

    const token = authHeader.substring(7);
    
    if (!token || token.length < 100) {
      return { success: false, error: 'Invalid token format' };
    }

    const decodedToken = await auth.verifyIdToken(token);

    // Check if user is admin by email
    const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
    if (!adminEmails.includes(decodedToken.email?.toLowerCase() || '')) {
      return { success: false, error: 'Access denied. Admin privileges required.' };
    }

    return { 
      success: true, 
      uid: decodedToken.uid, 
      email: decodedToken.email || undefined 
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Wrapper for protected API routes
 */
export async function withAuth(
  request: NextRequest,
  handler: (request: NextRequest, uid: string) => Promise<NextResponse>
): Promise<NextResponse> {
  const authResult = await authenticateRequest(request);
  
  if (!authResult.success) {
    return createUnauthorizedResponse(authResult.error);
  }

  return handler(request, authResult.uid!);
}

/**
 * Validate request body size
 */
export async function validateRequestSize(request: NextRequest, maxSizeBytes: number = 1024 * 1024): Promise<boolean> {
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxSizeBytes) {
    return false;
  }
  return true;
}

export function createUnauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function createForbiddenResponse(message: string = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function createBadRequestResponse(message: string = 'Bad request') {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function createRateLimitResponse(message: string = 'Too many requests') {
  return NextResponse.json(
    { error: message },
    { 
      status: 429,
      headers: { 'Retry-After': '60' }
    }
  );
}

export function createServerErrorResponse(message: string = 'Internal server error') {
  return NextResponse.json({ error: message }, { status: 500 });
}
