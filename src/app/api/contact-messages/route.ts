import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { rateLimit, requireAdminPermission } from '@/lib/auth';

const supabase = createAdminClient();

// GET - Fetch all contact messages (admin authenticated)
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const authResult = await requireAdminPermission(request);
    if ('response' in authResult) return authResult.response;

    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ messages: data || [] });
  } catch (error) {
    console.error('Error fetching contact messages:', error);
    return NextResponse.json({ error: 'Failed to fetch contact messages' }, { status: 500 });
  }
}
