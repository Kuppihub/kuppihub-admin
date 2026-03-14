import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';

const supabase = createAdminClient();

export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const authResult = await requireAdminPermission(request, 'admin.manage');
  if ('response' in authResult) return authResult.response;

  const { data, error } = await supabase
    .from('admin_roles')
    .select('id,name,is_system,admin_role_permissions(admin_permissions(key))')
    .order('name');

  if (error) {
    console.error('Error fetching admin roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }

  const roles = (data || []).map((role: any) => ({
    id: role.id,
    name: role.name,
    is_system: role.is_system,
    permissions: (role.admin_role_permissions || [])
      .map((rp: any) => rp.admin_permissions?.key)
      .filter((key: string | undefined) => typeof key === 'string'),
  }));

  return NextResponse.json({ roles });
}
