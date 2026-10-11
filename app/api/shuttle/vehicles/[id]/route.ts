import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const { data, error } = await supabase.from('service_vehicles').update(body).eq('id', id).eq('company_id', profile!.company_id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  const { id } = await params;
  const { error } = await supabase.from('service_vehicles').delete().eq('id', id).eq('company_id', profile!.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
