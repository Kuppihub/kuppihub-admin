import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';

const supabase = createAdminClient();

const getSuperAdminRoleId = async () => {
  const { data } = await supabase
    .from('admin_roles')
    .select('id')
    .eq('name', 'super_admin')
    .maybeSingle();
  return data?.id || null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimit(request, 20);
  if (rateLimitResponse) return rateLimitResponse;

  const authResult = await requireAdminPermission(request, 'admin.manage');
  if ('response' in authResult) return authResult.response;

  const { id } = await params;
  const adminId = Number(id);
  if (!Number.isFinite(adminId)) {
    return NextResponse.json({ error: 'Invalid admin ID' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body?.role_id !== undefined) {
      const roleId = Number(body.role_id);
      if (!Number.isFinite(roleId)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      updates.role_id = roleId;
    }

    if (body?.is_active !== undefined) {
      if (typeof body.is_active !== 'boolean') {
        return NextResponse.json({ error: 'Invalid is_active value' }, { status: 400 });
      }
      updates.is_active = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: currentAdmin } = await supabase
      .from('admin_users')
      .select('id, role_id, is_active, admin_roles(name)')
      .eq('id', adminId)
      .maybeSingle();

    if (!currentAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if ((updates.is_active === false || updates.role_id) && currentAdmin.admin_roles?.name === 'super_admin') {
      const superAdminRoleId = await getSuperAdminRoleId();
      if (superAdminRoleId) {
        const { count } = await supabase
          .from('admin_users')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('role_id', superAdminRoleId);

        if ((count || 0) <= 1 && currentAdmin.is_active) {
          return NextResponse.json({ error: 'Cannot modify the last active super admin' }, { status: 400 });
        }
      }
    }

    const { data, error } = await supabase
      .from('admin_users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', adminId)
      .select('id,email,is_active,created_at,updated_at,role_id')
      .single();

    if (error) throw error;

    return NextResponse.json({ admin: data });
  } catch (error) {
    console.error('Error updating admin:', error);
    return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const rateLimitResponse = rateLimit(request, 10);
  if (rateLimitResponse) return rateLimitResponse;

  const authResult = await requireAdminPermission(request, 'admin.manage');
  if ('response' in authResult) return authResult.response;

  const { id } = await params;
  const adminId = Number(id);
  if (!Number.isFinite(adminId)) {
    return NextResponse.json({ error: 'Invalid admin ID' }, { status: 400 });
  }

  try {
    const { data: currentAdmin } = await supabase
      .from('admin_users')
      .select('id, is_active, admin_roles(name)')
      .eq('id', adminId)
      .maybeSingle();

    if (!currentAdmin) {
      return NextResponse.json({ error: 'Admin not found' }, { status: 404 });
    }

    if (currentAdmin.admin_roles?.name === 'super_admin' && currentAdmin.is_active) {
      const superAdminRoleId = await getSuperAdminRoleId();
      if (superAdminRoleId) {
        const { count } = await supabase
          .from('admin_users')
          .select('id', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('role_id', superAdminRoleId);

        if ((count || 0) <= 1) {
          return NextResponse.json({ error: 'Cannot delete the last active super admin' }, { status: 400 });
        }
      }
    }

    const { error } = await supabase
      .from('admin_users')
      .delete()
      .eq('id', adminId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting admin:', error);
    return NextResponse.json({ error: 'Failed to delete admin' }, { status: 500 });
  }
}
