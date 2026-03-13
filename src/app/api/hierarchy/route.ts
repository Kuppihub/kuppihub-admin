import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyAdminToken, createUnauthorizedResponse, rateLimit } from '@/lib/auth';
import { sanitizeObject } from '@/lib/validation';

const supabase = createAdminClient();

// GET - Fetch hierarchy data (protected)
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
      .from('faculty_hierarchy')
      .select('data')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    return NextResponse.json({ data: data?.data || null });
  } catch (error) {
    console.error('Error fetching hierarchy:', error);
    return NextResponse.json({ error: 'Failed to fetch hierarchy' }, { status: 500 });
  }
}

// PUT - Update hierarchy data (protected)
export async function PUT(request: NextRequest) {
  try {
    // Rate limiting (stricter for writes)
    const rateLimitResponse = rateLimit(request, 20);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const uid = await verifyAdminToken(request);
    if (!uid) {
      return createUnauthorizedResponse('Admin authentication required');
    }

    const body = await request.json();
    const { data: hierarchyData } = body;

    if (!hierarchyData) {
      return NextResponse.json({ error: 'Hierarchy data is required' }, { status: 400 });
    }

    // Sanitize the hierarchy data
    const sanitizedHierarchyData = sanitizeObject(hierarchyData);

    // Get the current hierarchy record ID
    const { data: current } = await supabase
      .from('faculty_hierarchy')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (current) {
      // Update existing record
      const { data, error } = await supabase
        .from('faculty_hierarchy')
        .update({ 
          data: sanitizedHierarchyData,
          updated_at: new Date().toISOString()
        })
        .eq('id', current.id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data: data?.data });
    } else {
      // Insert new record
      const { data, error } = await supabase
        .from('faculty_hierarchy')
        .insert({ data: sanitizedHierarchyData })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ success: true, data: data?.data });
    }
  } catch (error) {
    console.error('Error updating hierarchy:', error);
    return NextResponse.json({ error: 'Failed to update hierarchy' }, { status: 500 });
  }
}
