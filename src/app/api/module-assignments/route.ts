import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';
import { validateRequest, PATTERNS } from '@/lib/validation';

const supabase = createAdminClient();

// GET - Fetch all module assignments (protected)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'module_assignments.read');
    if ('response' in authResult) return authResult.response;

    const { data, error } = await supabase
      .from('module_assignments')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ assignments: data });
  } catch (error) {
    console.error('Error fetching module assignments:', error);
    return NextResponse.json({ error: 'Failed to fetch module assignments' }, { status: 500 });
  }
}

// POST - Create new module assignment (protected)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request, 20);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'module_assignments.create');
    if ('response' in authResult) return authResult.response;

    const body = await request.json();

    // Validate request
    const { valid, errors, sanitizedData } = validateRequest(body, {
      module_id: { name: 'Module ID', required: true, type: 'string', pattern: PATTERNS.UUID },
      faculty_id: { name: 'Faculty ID', required: true, type: 'string', pattern: PATTERNS.UUID },
      department_id: { name: 'Department ID', required: true, type: 'string', pattern: PATTERNS.UUID },
      semester_id: { name: 'Semester ID', required: true, type: 'string', pattern: PATTERNS.UUID },
    });

    if (!valid) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const { module_id, faculty_id, department_id, semester_id } = sanitizedData!;

    // Check if assignment already exists
    const { data: existing } = await supabase
      .from('module_assignments')
      .select('id')
      .eq('module_id', module_id)
      .eq('faculty_id', faculty_id)
      .eq('department_id', department_id)
      .eq('semester_id', semester_id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'This assignment already exists' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('module_assignments')
      .insert({ module_id, faculty_id, department_id, semester_id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ assignment: data });
  } catch (error) {
    console.error('Error creating module assignment:', error);
    return NextResponse.json({ error: 'Failed to create module assignment' }, { status: 500 });
  }
}
