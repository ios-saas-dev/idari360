import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const module_type = searchParams.get('module');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  let query = supabase
    .from('audits')
    .select(`*, audit_type:audit_types(id, name, module), auditor:profiles!audits_auditor_id_fkey(id, full_name), facility:facilities(id, name, city)`, { count: 'exact' })
    .eq('company_id', profile.company_id)
    .order('audit_date', { ascending: false })
    .range((page-1)*limit, page*limit-1);

  if (!['super_admin','company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  }
  if (status) query = query.eq('status', status);
  if (module_type) query = query.eq('audit_types.module', module_type);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, page, totalPages: Math.ceil((count||0)/limit) });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager','facility_officer'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const body = await request.json();
  const { audit_type_id, audit_date, notes, facility_id } = body;
  if (!audit_type_id || !audit_date) return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 });

  const { data: auditType } = await supabase.from('audit_types').select('max_score').eq('id', audit_type_id).single();

  const { data, error } = await supabase.from('audits').insert({
    company_id: profile!.company_id,
    facility_id: facility_id || profile!.facility_id,
    audit_type_id,
    auditor_id: user.id,
    audit_date,
    total_score: 0,
    max_possible_score: auditType?.max_score || 100,
    percentage: 0,
    status: 'draft',
    notes: notes || '',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
