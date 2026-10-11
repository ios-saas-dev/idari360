import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { data, error } = await supabase
    .from('assets')
    .select('*, assigned_user:profiles!assets_assigned_to_fkey(id, full_name, email), facility:facilities(id, name), asset_history(id, action, note, created_at, from_user:profiles!asset_history_from_user_id_fkey(full_name), to_user:profiles!asset_history_to_user_id_fkey(full_name))')
    .eq('id', id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager','facility_officer'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const { status, assigned_to, note, action, ...rest } = body;

  const { data: currentAsset } = await supabase.from('assets').select('assigned_to, status').eq('id', id).single();

  const updates: Record<string,unknown> = { ...rest };
  if (status) updates.status = status;
  if (assigned_to !== undefined) updates.assigned_to = assigned_to;

  const { data, error } = await supabase.from('assets').update(updates).eq('id', id).eq('company_id', profile!.company_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log action
  if (action || status !== currentAsset?.status || assigned_to !== currentAsset?.assigned_to) {
    await supabase.from('asset_history').insert({
      asset_id: id,
      action: action || 'devir',
      from_user_id: currentAsset?.assigned_to || null,
      to_user_id: assigned_to || null,
      note: note || null,
    });
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
  const { error } = await supabase.from('assets').delete().eq('id', id).eq('company_id', profile!.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
