import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const is_active = searchParams.get('is_active');

  let query = supabase
    .from('cleaning_staff')
    .select('*, facility:facilities(id, name)')
    .eq('company_id', profile.company_id)
    .order('full_name');

  if (!['super_admin','company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  }
  if (is_active !== null) query = query.eq('is_active', is_active !== 'false');

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
  const { full_name, position, facility_id, supervisor_id } = body;
  if (!full_name) return NextResponse.json({ error: 'Ad zorunlu' }, { status: 400 });

  const { data, error } = await supabase.from('cleaning_staff').insert({
    company_id: profile!.company_id,
    facility_id: facility_id || profile!.facility_id,
    full_name,
    position: position || 'Temizlik Görevlisi',
    supervisor_id: supervisor_id || null,
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
  const { id, full_name, position, is_active, facility_id, supervisor_id } = body;
  if (!id) return NextResponse.json({ error: 'ID zorunlu' }, { status: 400 });

  const updateData: Record<string, any> = {};
  if (full_name !== undefined) updateData.full_name = full_name;
  if (position !== undefined) updateData.position = position;
  if (is_active !== undefined) updateData.is_active = is_active;
  if (facility_id !== undefined) updateData.facility_id = facility_id;

  // Organizasyon şeması: bağlı olduğu kişi (döngü oluşturamaz)
  if (supervisor_id !== undefined) {
    const sup = (supervisor_id as string) || null;
    if (sup === id) {
      return NextResponse.json({ error: 'Kişi kendisinin bağlı olduğu kişi olamaz.' }, { status: 400 });
    }
    if (sup) {
      let cursor: string | null = sup;
      let depth = 0;
      while (cursor && depth < 10) {
        const lookup = (await supabase
          .from('cleaning_staff')
          .select('supervisor_id')
          .eq('id', cursor)
          .eq('company_id', profile!.company_id)
          .maybeSingle()) as { data: { supervisor_id: string | null } | null };
        const row = lookup.data;
        if (!row) break;
        if (row.supervisor_id === id) {
          return NextResponse.json({ error: 'Bu atama hiyerarşide döngü oluşturur.' }, { status: 400 });
        }
        cursor = row.supervisor_id;
        depth++;
      }
    }
    updateData.supervisor_id = sup;
  }

  const { data, error } = await supabase
    .from('cleaning_staff')
    .update(updateData)
    .eq('id', id)
    .eq('company_id', profile!.company_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
