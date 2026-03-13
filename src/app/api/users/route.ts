import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAdminToken, createUnauthorizedResponse, rateLimit } from '@/lib/auth';

const supabase = createAdminClient();

// GET - Fetch all users (protected)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const uid = await verifyAdminToken(request);
    if (!uid) {
      return createUnauthorizedResponse('Admin authentication required');
    }

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
