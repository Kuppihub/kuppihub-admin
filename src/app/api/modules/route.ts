import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAdminToken, createUnauthorizedResponse, rateLimit } from '@/lib/auth';
import { validateRequest, sanitizeString } from '@/lib/validation';

const supabase = createAdminClient();

// GET - Fetch all modules (protected)
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
      .from('modules')
      .select('*')
      .order('code', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ modules: data });
  } catch (error) {
    console.error('Error fetching modules:', error);
    return NextResponse.json({ error: 'Failed to fetch modules' }, { status: 500 });
  }
}

// POST - Create new module (protected)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting (stricter for creation)
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
      code: { name: 'Module Code', required: true, type: 'string', minLength: 2, maxLength: 20 },
      name: { name: 'Module Name', required: true, type: 'string', minLength: 3, maxLength: 200 },
      description: { name: 'Description', type: 'string', maxLength: 1000 },
    });

    if (!valid) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const { code, name, description } = sanitizedData!;

    const { data, error } = await supabase
      .from('modules')
      .insert({ 
        code: sanitizeString(code), 
        name: sanitizeString(name), 
        description: description ? sanitizeString(description) : null 
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ module: data });
  } catch (error) {
    console.error('Error creating module:', error);
    return NextResponse.json({ error: 'Failed to create module' }, { status: 500 });
  }
}
