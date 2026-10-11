import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const is_active = searchParams.get('is_active');

  let query = supabase
    .from('service_vehicles')
    .select('*, facility:facilities(id, name, city), routes:service_routes(id, route_name, shift_type)')
    .eq('company_id', profile.company_id)
    .order('plate_number');

  if (!['super_admin','company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  }
  if (is_active !== null && is_active !== undefined) query = query.eq('is_active', is_active === 'true');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const body = await request.json();
  const { plate_number, brand, model, model_year, capacity, driver_name, driver_phone, route_name, facility_id } = body;
  if (!plate_number) return NextResponse.json({ error: 'Plaka zorunlu' }, { status: 400 });

  const { data, error } = await supabase.from('service_vehicles').insert({
    company_id: profile!.company_id,
    facility_id: facility_id || profile!.facility_id,
    plate_number, brand, model, model_year, capacity: capacity || 16,
    driver_name, driver_phone, route_name,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
