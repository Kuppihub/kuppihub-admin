import { NextRequest, NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authResult = await requireAdminPermission(request);
  if ('response' in authResult) return authResult.response;

  return NextResponse.json({
    admin: {
      uid: authResult.admin.uid,
      email: authResult.admin.email,
      role: authResult.admin.role,
      permissions: authResult.admin.permissions,
      isSuperAdmin: authResult.admin.isSuperAdmin,
    },
  });
}
