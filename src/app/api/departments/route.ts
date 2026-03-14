import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';
import { validateRequest, sanitizeString, PATTERNS } from '@/lib/validation';

const supabase = createAdminClient();

// GET - Fetch all departments (protected)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'departments.read');
    if ('response' in authResult) return authResult.response;

    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ departments: data });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
  }
}

// POST - Create new department (protected)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request, 20);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'departments.create');
    if ('response' in authResult) return authResult.response;

    const body = await request.json();

    // Validate request
    const { valid, errors, sanitizedData } = validateRequest(body, {
      name: { name: 'Department Name', required: true, type: 'string', minLength: 2, maxLength: 100 },
      faculty_id: { name: 'Faculty ID', required: true, type: 'string', pattern: PATTERNS.UUID },
    });

    if (!valid) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const { name, faculty_id } = sanitizedData!;

    const { data, error } = await supabase
      .from('departments')
      .insert({ name: sanitizeString(name), faculty_id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ department: data });
  } catch (error) {
    console.error('Error creating department:', error);
    return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
  }
}
