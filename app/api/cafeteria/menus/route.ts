import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date'); // YYYY-MM-DD
  const month = searchParams.get('month'); // YYYY-MM
  const facility_id = searchParams.get('facility_id');

  let query = supabase
    .from('cafeteria_menus')
    .select('*, creator:profiles!cafeteria_menus_created_by_fkey(id, full_name), facility:facilities(id, name)')
    .eq('company_id', profile.company_id)
    .order('menu_date', { ascending: false });

  if (!['super_admin', 'company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  } else if (facility_id) {
    query = query.eq('facility_id', facility_id);
  }
  if (date) query = query.eq('menu_date', date);
  if (month) query = query.like('menu_date', `${month}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile?.company_id) return NextResponse.json({ error: 'Profile incomplete' }, { status: 400 });

  const allowed = ['super_admin','company_admin','facility_manager','facility_officer'];
  if (!allowed.includes(profile.role)) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const body = await request.json();
  const { menu_date, meal_type, items, planned_count, actual_count, facility_id } = body;
  if (!menu_date || !meal_type || !items) return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 });

  const fid = facility_id || profile.facility_id;
  const { data, error } = await supabase.from('cafeteria_menus').upsert({
    company_id: profile.company_id,
    facility_id: fid,
    menu_date,
    meal_type,
    items,
    planned_count: planned_count || 0,
    actual_count: actual_count || 0,
    created_by: user.id,
  }, { onConflict: 'company_id,facility_id,menu_date,meal_type' }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
