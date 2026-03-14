import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, cert, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { ServiceAccount } from 'firebase-admin/app';
import { createAdminClient } from '@/lib/supabase';

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
const supabase = createAdminClient();

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

export interface AdminAuthContext {
  uid: string;
  email: string;
  role: string;
  permissions: string[];
  isSuperAdmin: boolean;
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

    // Legacy behavior retained for compatibility; use requireAdminPermission instead.
    const email = decodedToken.email?.toLowerCase() || '';
    if (!email) return null;

    const adminUser = await getAdminByEmail(email);
    if (!adminUser?.is_active) return null;

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

    const email = decodedToken.email?.toLowerCase() || '';
    if (!email) {
      return { success: false, error: 'Access denied. Admin privileges required.' };
    }

    const adminUser = await getAdminByEmail(email);
    if (!adminUser?.is_active) {
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

interface AdminLookup {
  id: number;
  email: string;
  role_id: number;
  role_name: string;
  is_active: boolean;
}

const getBootstrapAdminEmails = (): string[] => {
  const envEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
  if (!envEmails) return [];
  return envEmails.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
};

async function getAdminUserCount(): Promise<number> {
  try {
    const { count } = await supabase
      .from('admin_users')
      .select('*', { count: 'exact', head: true });
    return count || 0;
  } catch (error) {
    console.warn('Admin user count lookup failed:', error);
    return 0;
  }
}

async function getAdminByEmail(email: string): Promise<AdminLookup | null> {
  const { data, error } = await supabase
    .from('admin_users')
    .select('id,email,is_active,role_id,admin_roles(id,name)')
    .eq('email', email)
    .maybeSingle();

  if (error || !data) return null;
  const role = (data as any).admin_roles;
  if (!role?.id || !role?.name) return null;

  return {
    id: data.id,
    email: data.email,
    role_id: role.id,
    role_name: role.name,
    is_active: data.is_active,
  };
}

async function getRolePermissions(roleId: number): Promise<string[]> {
  const { data } = await supabase
    .from('admin_role_permissions')
    .select('admin_permissions(key)')
    .eq('role_id', roleId);

  if (!data) return [];
  return data
    .map((row: any) => row.admin_permissions?.key)
    .filter((key: string | undefined) => typeof key === 'string');
}

async function getAdminContext(email: string, uid: string): Promise<AdminAuthContext | null> {
  const adminUser = await getAdminByEmail(email);
  if (!adminUser || !adminUser.is_active) return null;

  const isSuperAdmin = adminUser.role_name === 'super_admin';
  const permissions = isSuperAdmin ? ['*'] : await getRolePermissions(adminUser.role_id);

  return {
    uid,
    email,
    role: adminUser.role_name,
    permissions,
    isSuperAdmin,
  };
}

function hasPermission(admin: AdminAuthContext, permission: string): boolean {
  if (admin.isSuperAdmin) return true;
  return admin.permissions.includes(permission);
}

export async function requireAdminPermission(
  request: NextRequest,
  permission?: string
): Promise<{ admin: AdminAuthContext } | { response: NextResponse }> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return { response: createUnauthorizedResponse('Missing or invalid authorization header') };
    }

    const token = authHeader.substring(7);
    if (!token || token.length < 100) {
      return { response: createUnauthorizedResponse('Invalid token format') };
    }

    const decodedToken = await auth.verifyIdToken(token);
    const email = decodedToken.email?.toLowerCase() || '';
    if (!email) {
      return { response: createUnauthorizedResponse('Access denied. Admin privileges required.') };
    }

    let adminContext = await getAdminContext(email, decodedToken.uid);

    if (!adminContext) {
      const adminCount = await getAdminUserCount();
      const bootstrapAdmins = getBootstrapAdminEmails();
      if (adminCount === 0 && bootstrapAdmins.includes(email)) {
        adminContext = {
          uid: decodedToken.uid,
          email,
          role: 'super_admin',
          permissions: ['*'],
          isSuperAdmin: true,
        };
      }
    }

    if (!adminContext) {
      return { response: createUnauthorizedResponse('Access denied. Admin privileges required.') };
    }

    if (permission && !hasPermission(adminContext, permission)) {
      return { response: createForbiddenResponse('Insufficient permissions') };
    }

    return { admin: adminContext };
  } catch (error) {
    console.error('Authorization error:', error);
    return { response: createUnauthorizedResponse('Authentication failed') };
  }
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
