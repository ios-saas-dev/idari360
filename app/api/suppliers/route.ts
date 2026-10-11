import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('suppliers')
    .select('*, supplier_scores(id, overall_score, period_start, period_end, created_at)')
    .eq('company_id', profile.company_id)
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const body = await request.json();
  const { name, service_type, contact_info, contract_start, contract_end } = body;
  if (!name || !service_type) return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 });

  const { data, error } = await supabase.from('suppliers').insert({
    company_id: profile!.company_id,
    name, service_type,
    contact_info: contact_info || {},
    contract_start: contract_start || null,
    contract_end: contract_end || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
