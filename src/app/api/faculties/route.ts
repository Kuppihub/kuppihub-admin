import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';
import { validateRequest, sanitizeString } from '@/lib/validation';

const supabase = createAdminClient();

// GET - Fetch all faculties (protected)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'faculties.read');
    if ('response' in authResult) return authResult.response;

    const { data, error } = await supabase
      .from('faculties')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ faculties: data });
  } catch (error) {
    console.error('Error fetching faculties:', error);
    return NextResponse.json({ error: 'Failed to fetch faculties' }, { status: 500 });
  }
}

// POST - Create new faculty (protected)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request, 20);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'faculties.create');
    if ('response' in authResult) return authResult.response;

    const body = await request.json();

    // Validate request
    const { valid, errors, sanitizedData } = validateRequest(body, {
      name: { name: 'Faculty Name', required: true, type: 'string', minLength: 2, maxLength: 100 },
    });

    if (!valid) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const { name } = sanitizedData!;

    const { data, error } = await supabase
      .from('faculties')
      .insert({ name: sanitizeString(name) })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ faculty: data });
  } catch (error) {
    console.error('Error creating faculty:', error);
    return NextResponse.json({ error: 'Failed to create faculty' }, { status: 500 });
  }
}
