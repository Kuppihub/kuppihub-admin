import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';
import { isValidUUID, sanitizeObject, sanitizeString } from '@/lib/validation';

const supabase = createAdminClient();

// GET - Fetch single module (protected)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'modules.read');
    if ('response' in authResult) return authResult.response;

    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid module ID format' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('modules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    return NextResponse.json({ module: data });
  } catch (error) {
    console.error('Error fetching module:', error);
    return NextResponse.json({ error: 'Failed to fetch module' }, { status: 500 });
  }
}

// PATCH - Update module (protected)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting (stricter for writes)
    const rateLimitResponse = rateLimit(request, 30);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'modules.update');
    if ('response' in authResult) return authResult.response;

    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid module ID format' }, { status: 400 });
    }

    const body = await request.json();

    // Sanitize input
    const sanitizedBody = sanitizeObject(body);

    // Whitelist allowed fields to update
    const allowedFields = ['code', 'name', 'description', 'semester_id', 'credits'];
    const filteredBody: Record<string, any> = {};
    for (const field of allowedFields) {
      if (sanitizedBody[field] !== undefined) {
        filteredBody[field] = typeof sanitizedBody[field] === 'string' 
          ? sanitizeString(sanitizedBody[field]) 
          : sanitizedBody[field];
      }
    }

    const { data, error } = await supabase
      .from('modules')
      .update({
        ...filteredBody,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ module: data });
  } catch (error) {
    console.error('Error updating module:', error);
    return NextResponse.json({ error: 'Failed to update module' }, { status: 500 });
  }
}

// DELETE - Delete module (protected)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting (very strict for deletes)
    const rateLimitResponse = rateLimit(request, 10);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'modules.delete');
    if ('response' in authResult) return authResult.response;

    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid module ID format' }, { status: 400 });
    }
    
    // First delete all module assignments
    await supabase
      .from('module_assignments')
      .delete()
      .eq('module_id', id);

    // Then delete the module
    const { error } = await supabase
      .from('modules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting module:', error);
    return NextResponse.json({ error: 'Failed to delete module' }, { status: 500 });
  }
}
