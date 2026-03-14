import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';

const supabase = createAdminClient();

// GET - Fetch all users (protected)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'users.read');
    if ('response' in authResult) return authResult.response;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ users: data });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// PUT - Approve user for kuppies (protected)
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request, 30);
    if (rateLimitResponse) return rateLimitResponse;

    const authResult = await requireAdminPermission(request, 'users.approve');
    if ('response' in authResult) return authResult.response;

    const body = await request.json();
    const { id, is_approved_for_kuppies } = body || {};

    if (typeof id !== 'number' || typeof is_approved_for_kuppies !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('users')
      .update({
        is_approved_for_kuppies,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error('Error approving user:', error);
    return NextResponse.json({ error: 'Failed to approve user' }, { status: 500 });
  }
}
