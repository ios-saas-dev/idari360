import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { data, error } = await supabase
    .from('supplier_scores')
    .select('*, scorer:profiles!supplier_scores_scored_by_fkey(id, full_name)')
    .eq('supplier_id', id)
    .order('period_start', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const { period_start, period_end, service_quality, timeliness, complaint_management, staff_suitability, audit_results, action_closure } = body;
  
  const scores = [service_quality, timeliness, complaint_management, staff_suitability, audit_results, action_closure].filter((val) => typeof val === 'number' && !isNaN(val));
  const overall_score = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;

  const { data, error } = await supabase.from('supplier_scores').insert({
    supplier_id: id,
    period_start, period_end,
    service_quality: service_quality || 0,
    timeliness: timeliness || 0,
    complaint_management: complaint_management || 0,
    staff_suitability: staff_suitability || 0,
    audit_results: audit_results || 0,
    action_closure: action_closure || 0,
    overall_score: Math.round(overall_score * 10) / 10,
    scored_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
