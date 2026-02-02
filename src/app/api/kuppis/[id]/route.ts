import { NextRequest, NextResponse } from 'next/server';
import supabase from '@/lib/supabase';
import { verifyAdminToken, createUnauthorizedResponse, rateLimit } from '@/lib/auth';
import { sanitizeObject } from '@/lib/validation';

// GET - Fetch single kuppi (protected)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const uid = await verifyAdminToken(request);
    if (!uid) {
      return createUnauthorizedResponse('Admin authentication required');
    }

    const { id } = await params;

    // Validate ID is numeric
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid kuppi ID format' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('videos')
      .select(`
        *,
        modules:module_id (id, code, name),
        students:student_id (id, name)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ kuppi: data });
  } catch (error) {
    console.error('Error fetching kuppi:', error);
    return NextResponse.json({ error: 'Failed to fetch kuppi' }, { status: 500 });
  }
}

// PATCH - Update kuppi (protected)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting (stricter for writes)
    const rateLimitResponse = rateLimit(request, 30);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const uid = await verifyAdminToken(request);
    if (!uid) {
      return createUnauthorizedResponse('Admin authentication required');
    }

    const { id } = await params;

    // Validate ID is numeric
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid kuppi ID format' }, { status: 400 });
    }

    const body = await request.json();

    // Sanitize input
    const sanitizedBody = sanitizeObject(body);

    // Whitelist allowed fields to update
    const allowedFields = [
      'title', 'description', 'youtube_links', 'telegram_links',
      'material_urls', 'is_approved', 'is_hidden', 'language_code'
    ];
    const filteredBody: Record<string, any> = {};
    for (const field of allowedFields) {
      if (sanitizedBody[field] !== undefined) {
        filteredBody[field] = sanitizedBody[field];
      }
    }

    const { data, error } = await supabase
      .from('videos')
      .update({
        ...filteredBody,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ kuppi: data });
  } catch (error) {
    console.error('Error updating kuppi:', error);
    return NextResponse.json({ error: 'Failed to update kuppi' }, { status: 500 });
  }
}

// DELETE - Delete kuppi (protected)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting (very strict for deletes)
    const rateLimitResponse = rateLimit(request, 10);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const uid = await verifyAdminToken(request);
    if (!uid) {
      return createUnauthorizedResponse('Admin authentication required');
    }

    const { id } = await params;

    // Validate ID is numeric
    if (!/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid kuppi ID format' }, { status: 400 });
    }

    const { error } = await supabase
      .from('videos')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting kuppi:', error);
    return NextResponse.json({ error: 'Failed to delete kuppi' }, { status: 500 });
  }
}
