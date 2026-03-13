import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAdminToken, createUnauthorizedResponse, rateLimit } from '@/lib/auth';
import { isValidUUID } from '@/lib/validation';

const supabase = createAdminClient();

// DELETE - Delete module assignment (protected)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting (strict for deletes)
    const rateLimitResponse = rateLimit(request, 10);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const uid = await verifyAdminToken(request);
    if (!uid) {
      return createUnauthorizedResponse('Admin authentication required');
    }

    const { id } = await params;

    // Validate ID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid assignment ID format' }, { status: 400 });
    }

    const { error } = await supabase
      .from('module_assignments')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting module assignment:', error);
    return NextResponse.json({ error: 'Failed to delete module assignment' }, { status: 500 });
  }
}
