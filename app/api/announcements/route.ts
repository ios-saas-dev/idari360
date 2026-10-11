import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('announcements')
    .select('*, publisher:profiles!announcements_published_by_fkey(id, full_name, role)')
    .eq('company_id', profile.company_id)
    .order('published_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!['super_admin', 'company_admin', 'facility_manager'].includes(profile?.role || '')) {
    return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  }

  const body = await request.json();
  const { title, content, priority, expires_at } = body;
  if (!title || !content) return NextResponse.json({ error: 'Başlık ve içerik zorunlu' }, { status: 400 });

  const { data, error } = await supabase.from('announcements').insert({
    company_id: profile!.company_id,
    title,
    content,
    priority: priority || 'orta',
    published_by: user.id,
    expires_at: expires_at || null,
    is_active: true,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
