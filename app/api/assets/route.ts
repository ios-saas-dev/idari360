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
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('assets')
    .select('*, assigned_user:profiles!assets_assigned_to_fkey(id, full_name, email), facility:facilities(id, name, city)', { count: 'exact' })
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (!['super_admin','company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  }
  if (profile.role === 'employee') query = query.eq('assigned_to', user.id);
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (search) query = query.or(`name.ilike.%${search}%,asset_code.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, page, totalPages: Math.ceil((count || 0) / limit) });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager','facility_officer'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const body = await request.json();
  const { name, category, location, assigned_to, purchase_date, purchase_price, notes, facility_id } = body;
  if (!name || !category) return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 });

  // Generate asset_code: AST-2026-00001 per company
  const year = new Date().getFullYear();
  const { data: lastAsset } = await supabase
    .from('assets')
    .select('asset_code')
    .eq('company_id', profile!.company_id)
    .like('asset_code', `AST-${year}-%`)
    .order('asset_code', { ascending: false })
    .limit(1)
    .maybeSingle();

  let nextSeq = 1;
  if (lastAsset?.asset_code) {
    const parts = lastAsset.asset_code.split('-');
    nextSeq = (parseInt(parts[2] || '0') || 0) + 1;
  }
  const asset_code = `AST-${year}-${String(nextSeq).padStart(5, '0')}`;

  const { data, error } = await supabase.from('assets').insert({
    company_id: profile!.company_id,
    facility_id: facility_id || profile!.facility_id,
    asset_code, name, category,
    location: location || '',
    assigned_to: assigned_to || null,
    status: assigned_to ? 'devirde' : 'aktif',
    purchase_date: purchase_date || null,
    purchase_price: purchase_price || null,
    notes: notes || '',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // QR hedef yolu (etiket/QR okutma için kalıcı referans)
  await supabase.from('assets').update({ qr_code: `/dashboard/assets/${data.id}` }).eq('id', data.id);

  // Zimmetli eklenmişse ilk hareket kaydı (sistem tarihçesi)
  if (assigned_to) {
    const { data: target } = await supabase.from('profiles').select('full_name').eq('id', assigned_to).maybeSingle();
    await supabase.from('asset_history').insert({
      asset_id: data.id,
      action: 'zimmet',
      to_user_id: assigned_to,
      note: `Varlık sisteme eklendi ve ${target?.full_name || 'personele'} zimmetlendi`,
    });
  }

  return NextResponse.json({ data }, { status: 201 });
}
