import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';
import { validateRequest, sanitizeString, PATTERNS } from '@/lib/validation';

const supabase = createAdminClient();

// GET - Fetch all kuppis (protected)
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'kuppis.read');
    if ('response' in authResult) return authResult.response;

    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        modules:module_id (id, code, name),
        students:student_id (id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ kuppis: data });
  } catch (error) {
    console.error('Error fetching kuppis:', error);
    return NextResponse.json({ error: 'Failed to fetch kuppis' }, { status: 500 });
  }
}

// POST - Create new kuppi (protected)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting (stricter for creation)
    const rateLimitResponse = rateLimit(request, 20);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'kuppis.create');
    if ('response' in authResult) return authResult.response;

    const body = await request.json();

    // Validate request
    const { valid, errors, sanitizedData } = validateRequest(body, {
      module_id: { name: 'Module ID', required: true, type: 'string', pattern: PATTERNS.UUID },
      title: { name: 'Title', required: true, type: 'string', minLength: 3, maxLength: 200 },
      description: { name: 'Description', type: 'string', maxLength: 2000 },
      youtube_links: { name: 'YouTube Links', required: true, type: 'array', minLength: 1 },
      telegram_links: { name: 'Telegram Links', type: 'array' },
      material_urls: { name: 'Material URLs', type: 'array' },
      student_id: { name: 'Student ID', type: 'string', pattern: PATTERNS.UUID },
      language_code: { name: 'Language Code', type: 'string', enum: ['si', 'en', 'ta'] },
    });

    if (!valid) {
      return NextResponse.json({ error: errors.join(', ') }, { status: 400 });
    }

    const {
      module_id,
      title,
      description,
      youtube_links,
      telegram_links,
      material_urls,
      student_id,
      language_code,
    } = sanitizedData!;

    const { data, error } = await supabase
      .from('videos')
      .insert({
        module_id,
        title: sanitizeString(title),
        description: description ? sanitizeString(description) : null,
        youtube_links,
        telegram_links,
        material_urls,
        student_id,
        language_code: language_code || 'si',
        is_kuppi: true,
        is_approved: false,
        is_hidden: false,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ kuppi: data });
  } catch (error) {
    console.error('Error creating kuppi:', error);
    return NextResponse.json({ error: 'Failed to create kuppi' }, { status: 500 });
  }
}
