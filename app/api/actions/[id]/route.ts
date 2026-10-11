import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { data, error } = await supabase
    .from('actions')
    .select(`*, responsible:profiles!actions_responsible_user_id_fkey(id, full_name, email), creator:profiles!actions_created_by_fkey(id, full_name), facility:facilities(id, name), action_history(id, old_status, new_status, note, created_at, changer:profiles(id, full_name))`)
    .eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  const { id } = await params;
  const body = await request.json();
  const { status, note, ...rest } = body;

  const { data: current } = await supabase.from('actions').select('status, company_id').eq('id', id).single();
  if (!current || current.company_id !== profile!.company_id) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });

  const updates: Record<string,unknown> = { ...rest };
  if (status) { updates.status = status; if (status === 'kapali') updates.closed_at = new Date().toISOString(); }

  const { data, error } = await supabase.from('actions').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status && status !== current.status) {
    await supabase.from('action_history').insert({ action_id: id, old_status: current.status, new_status: status, changed_by: user.id, note: note || null });
  }
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  const { id } = await params;
  const { error } = await supabase.from('actions').delete().eq('id', id).eq('company_id', profile!.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
