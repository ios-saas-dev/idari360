import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let query = supabase
    .from('cleaning_equipment')
    .select('*, facility:facilities(id, name)')
    .eq('company_id', profile.company_id)
    .order('name');

  if (!['super_admin','company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager','facility_officer'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const body = await req.json();
  const { name, type, brand, model, quantity, condition, location, facility_id } = body;
  if (!name) return NextResponse.json({ error: 'Ad zorunlu' }, { status: 400 });

  const { data, error } = await supabase.from('cleaning_equipment').insert({
    company_id: profile!.company_id,
    facility_id: facility_id || profile!.facility_id,
    name, type, brand, model,
    quantity: quantity || 1,
    condition: condition || 'İyi',
    location: location || '',
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager','facility_officer'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const body = await req.json();
  const { id, name, type, brand, model, quantity, condition, location, facility_id } = body;
  if (!id) return NextResponse.json({ error: 'ID zorunlu' }, { status: 400 });

  const updateData: Record<string, any> = {};
  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (brand !== undefined) updateData.brand = brand;
  if (model !== undefined) updateData.model = model;
  if (quantity !== undefined) updateData.quantity = quantity;
  if (condition !== undefined) updateData.condition = condition;
  if (location !== undefined) updateData.location = location;
  if (facility_id !== undefined) updateData.facility_id = facility_id;

  const { data, error } = await supabase
    .from('cleaning_equipment')
    .update(updateData)
    .eq('id', id)
    .eq('company_id', profile!.company_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
