import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const MANAGER_ROLES = ['super_admin', 'company_admin', 'facility_manager'];
const SERVICE_TYPES = ['yemekhane', 'servis', 'temizlik', 'teknik', 'guvenlik', 'diger'];

/** Tedarikçi düzenle (PATCH) — yalnız müdür+ */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!MANAGER_ROLES.includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'Firma adı boş olamaz' }, { status: 400 });
    }
    patch.name = body.name.trim();
  }
  if (body.service_type !== undefined) {
    if (!SERVICE_TYPES.includes(body.service_type)) {
      return NextResponse.json({ error: 'Geçersiz hizmet türü' }, { status: 400 });
    }
    patch.service_type = body.service_type;
  }
  if (body.contact_info !== undefined) patch.contact_info = body.contact_info || {};
  if (body.contract_start !== undefined) patch.contract_start = body.contract_start || null;
  if (body.contract_end !== undefined) patch.contract_end = body.contract_end || null;
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'Geçersiz durum' }, { status: 400 });
    }
    patch.is_active = body.is_active;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('suppliers')
    .update(patch)
    .eq('id', id)
    .eq('company_id', profile!.company_id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Tedarikçi bulunamadı' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

/** Tedarikçi sil (DELETE) — puan geçmişi de silinir; yalnız müdür+ */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!MANAGER_ROLES.includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const { id } = await params;
  const { data, error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
    .eq('company_id', profile!.company_id)
    .select('id, name')
    .single();

  if (error) {
    if (error.code === 'PGRST116') return NextResponse.json({ error: 'Tedarikçi bulunamadı' }, { status: 404 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, data });
}
