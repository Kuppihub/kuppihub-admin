import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';

const supabase = createAdminClient();

const normalizeEmail = (email: string) => email.trim().toLowerCase();

export async function GET(request: NextRequest) {
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const authResult = await requireAdminPermission(request, 'admin.manage');
  if ('response' in authResult) return authResult.response;

  const { data, error } = await supabase
    .from('admin_users')
    .select('id,email,is_active,created_at,updated_at,role_id,admin_roles(id,name)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching admin users:', error);
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 });
  }

  const admins = (data || []).map((admin: any) => ({
    id: admin.id,
    email: admin.email,
    is_active: admin.is_active,
    created_at: admin.created_at,
    updated_at: admin.updated_at,
    role_id: admin.role_id,
    role_name: admin.admin_roles?.name || null,
  }));

  return NextResponse.json({ admins });
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = rateLimit(request, 20);
  if (rateLimitResponse) return rateLimitResponse;

  const authResult = await requireAdminPermission(request, 'admin.manage');
  if ('response' in authResult) return authResult.response;

  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? normalizeEmail(body.email) : '';
    const roleId = Number(body?.role_id);

    if (!email || !email.includes('@') || !Number.isFinite(roleId)) {
      return NextResponse.json({ error: 'Invalid email or role' }, { status: 400 });
    }

    const { data: role } = await supabase
      .from('admin_roles')
      .select('id')
      .eq('id', roleId)
      .maybeSingle();

    if (!role) {
      return NextResponse.json({ error: 'Role not found' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('admin_users')
      .insert({
        email,
        role_id: roleId,
      })
      .select('id,email,is_active,created_at,updated_at,role_id')
      .single();

    if (error) throw error;

    return NextResponse.json({ admin: data }, { status: 201 });
  } catch (error) {
    console.error('Error creating admin:', error);
    return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
  }
}
