import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAdminToken, createUnauthorizedResponse, rateLimit } from '@/lib/auth';
import { validateRequest, sanitizeString } from '@/lib/validation';

const supabase = createAdminClient();

// GET - Fetch all semesters (protected)
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
      .from('semesters')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ semesters: data });
  } catch (error) {
    console.error('Error fetching semesters:', error);
    return NextResponse.json({ error: 'Failed to fetch semesters' }, { status: 500 });
  }
}

// POST - Create new semester (protected)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request, 20);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const uid = await verifyAdminToken(request);
    if (!uid) {
      return createUnauthorizedResponse('Admin authentication required');
    }

    const body = await request.json();

    // Validate request
    const { valid, errors, sanitizedData } = validateRequest(body, {
      name: { name: 'Semester Name', required: true, type: 'string', minLength: 1, maxLength: 50 },
    });

    if (!valid) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const { name } = sanitizedData!;

    const { data, error } = await supabase
      .from('semesters')
      .insert({ name: sanitizeString(name) })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ semester: data });
  } catch (error) {
    console.error('Error creating semester:', error);
    return NextResponse.json({ error: 'Failed to create semester' }, { status: 500 });
  }
}
