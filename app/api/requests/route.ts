import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const category = searchParams.get('category');
  const priority = searchParams.get('priority');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('requests')
    .select(`
      *,
      creator:profiles!requests_created_by_fkey(id, full_name, email, avatar_url),
      assignee:profiles!requests_assigned_to_fkey(id, full_name, email, avatar_url),
      approver:profiles!requests_approved_by_fkey(id, full_name, email, avatar_url),
      facility:facilities(id, name, city)
    `, { count: 'exact' })
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  // Facility-level isolation
  if (!['super_admin', 'company_admin'].includes(profile.role)) {
    if (profile.facility_id) query = query.eq('facility_id', profile.facility_id);
  }
  if (profile.role === 'employee') {
    query = query.eq('created_by', user.id);
  }

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (priority) query = query.eq('priority', priority);
  if (search) query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,request_number.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, totalPages: Math.ceil((count || 0) / limit) });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile?.company_id || !profile?.facility_id) return NextResponse.json({ error: 'Profile incomplete' }, { status: 400 });

  const body = await request.json();
  const { title, description, category, priority, assigned_to, attachment_urls, facility_id } = body;

  if (!title || !description || !category) return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 });

  const targetFacilityId = facility_id || profile.facility_id;
  if (!targetFacilityId) return NextResponse.json({ error: 'Tesis bilgisi bulunamadı' }, { status: 400 });

  // Generate request number: REQ-2026-00001 per company
  const year = new Date().getFullYear();
  const { data: lastReq } = await supabase
    .from('requests')
    .select('request_number')
    .eq('company_id', profile.company_id)
    .like('request_number', `REQ-${year}-%`)
    .order('request_number', { ascending: false })
    .limit(1)
    .single();

  let nextSeq = 1;
  if (lastReq?.request_number) {
    const parts = lastReq.request_number.split('-');
    nextSeq = (parseInt(parts[2] || '0') || 0) + 1;
  }
  const request_number = `REQ-${year}-${String(nextSeq).padStart(5, '0')}`;

  const { data: newReq, error } = await supabase.from('requests').insert({
    company_id: profile.company_id,
    facility_id: targetFacilityId,
    request_number,
    title,
    description,
    category,
    priority: priority || 'orta',
    status: 'yeni',
    assigned_to: assigned_to || null,
    attachment_urls: attachment_urls || [],
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log to request_history
  await supabase.from('request_history').insert({
    request_id: newReq.id,
    new_status: 'yeni',
    changed_by: user.id,
    note: 'Talep oluşturuldu (T1: Açılış)',
    attachment_urls: attachment_urls || [],
  });

  return NextResponse.json({ data: newReq }, { status: 201 });
}
