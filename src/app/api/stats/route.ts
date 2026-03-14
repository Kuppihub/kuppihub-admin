import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireAdminPermission, rateLimit } from '@/lib/auth';

const supabase = createAdminClient();

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = rateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Authentication
    const authResult = await requireAdminPermission(request, 'stats.read');
    if ('response' in authResult) return authResult.response;

    // Get counts from different tables
    const [usersRes, modulesRes, kuppisRes, tutorsRes, pendingKuppisRes] = await Promise.all([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('modules').select('id', { count: 'exact', head: true }),
      supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_kuppi', true),
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('videos').select('id', { count: 'exact', head: true }).eq('is_approved', false),
    ]);

    // Get users who have added kuppis but are not approved yet
    // First get all unique user IDs who have added videos
    const { data: videoUsers } = await supabase
      .from('videos')
      .select('added_by_user_id')
      .not('added_by_user_id', 'is', null);

    // Get unique user IDs
    const uniqueUserIds = [...new Set(videoUsers?.map(v => v.added_by_user_id).filter(Boolean))];

    // Get users who added kuppis but aren't approved
    let pendingUsers: any[] = [];
    if (uniqueUserIds.length > 0) {
      const { data: pending } = await supabase
        .from('users')
        .select('id, firebase_uid, email, display_name, photo_url, created_at, is_approved_for_kuppies')
        .in('id', uniqueUserIds)
        .eq('is_approved_for_kuppies', false);
      
      // Get kuppi count for each pending user
      if (pending && pending.length > 0) {
        const pendingWithCount = await Promise.all(
          pending.map(async (user) => {
            const { count } = await supabase
              .from('videos')
              .select('id', { count: 'exact', head: true })
              .eq('added_by_user_id', user.id);
            return { ...user, kuppi_count: count || 0 };
          })
        );
        pendingUsers = pendingWithCount;
      }
    }

    // Get pending kuppis (not approved)
    const { data: pendingKuppisData } = await supabase
      .from('videos')
      .select(`
        id,
        title,
        created_at,
        added_by_user_id,
        module_id,
        modules:module_id (code, name)
      `)
      .eq('is_approved', false)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get user info for pending kuppis
    let pendingKuppis: any[] = [];
    if (pendingKuppisData && pendingKuppisData.length > 0) {
      const userIds = [...new Set(pendingKuppisData.map(k => k.added_by_user_id).filter(Boolean))];
      const { data: usersData } = await supabase
        .from('users')
        .select('id, email, display_name, photo_url')
        .in('id', userIds.length > 0 ? userIds : [0]);

      const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
      
      pendingKuppis = pendingKuppisData.map(k => ({
        ...k,
        user: usersMap.get(k.added_by_user_id) || null,
      }));
    }

    return NextResponse.json({
      users: usersRes.count || 0,
      modules: modulesRes.count || 0,
      kuppis: kuppisRes.count || 0,
      tutors: tutorsRes.count || 0,
      pendingKuppisCount: pendingKuppisRes.count || 0,
      pendingUsers,
      pendingKuppis,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
