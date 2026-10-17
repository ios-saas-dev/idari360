import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getAssetFlow, getAssetStatusMeta } from '@/lib/asset-flow';

const MANAGE_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];
/** Genel güncellemede izin verilen tanımlayıcı alanlar (durum/zimmet akışla yönetilir) */
const EDITABLE_FIELDS = ['name', 'category', 'location', 'purchase_date', 'purchase_price', 'notes'] as const;

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { data, error } = await supabase
    .from('assets')
    .select('*, assigned_user:profiles!assets_assigned_to_fkey(id, full_name, email), facility:facilities(id, name), asset_history(id, action, note, created_at, from_user:profiles!asset_history_from_user_id_fkey(full_name), to_user:profiles!asset_history_to_user_id_fkey(full_name))')
    .eq('id', id)
    .order('created_at', { referencedTable: 'asset_history', ascending: false })
    .single();
  if (error) return NextResponse.json({ error: 'Varlık bulunamadı veya yetkiniz yok.' }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!MANAGE_ROLES.includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  const { id } = await params;
  const body = await request.json();
  const { action, note, assigned_to } = body;

  // ---------------------------------------------------------------
  // MOD 1: Akış işlemi (devir / zimmet / iade / arıza / bakım / kayıp / hurda ...)
  // Sunucu tarafı geçiş doğrulaması + tarihçe kaydı buradan yapılır.
  // ---------------------------------------------------------------
  if (action) {
    const flow = getAssetFlow(action);
    if (!flow) return NextResponse.json({ error: 'Geçersiz varlık işlemi.' }, { status: 400 });

    const { data: current, error: fetchError } = await supabase
      .from('assets')
      .select('id, status, assigned_to, name, asset_code')
      .eq('id', id)
      .single();
    if (fetchError || !current) return NextResponse.json({ error: 'Varlık bulunamadı veya yetkiniz yok.' }, { status: 404 });

    if (!flow.from.includes(current.status)) {
      const fromLabel = getAssetStatusMeta(current.status).label;
      return NextResponse.json(
        { error: `"${flow.label}" işlemi "${fromLabel}" durumundaki varlığa uygulanamaz.` },
        { status: 400 }
      );
    }

    let targetUserId: string | null = (assigned_to as string) || null;
    if (flow.requiresUser) {
      if (!targetUserId) return NextResponse.json({ error: 'Bu işlem için hedef kişi seçilmelidir.' }, { status: 400 });
      if (targetUserId === current.assigned_to) {
        return NextResponse.json({ error: 'Hedef kişi mevcut zimmetli kişiyle aynı olamaz.' }, { status: 400 });
      }
    } else {
      targetUserId = null;
    }

    const resolvedTo = flow.requiresUser ? targetUserId : current.assigned_to;
    const newStatus = flow.resolveTo(resolvedTo);

    const updates: Record<string, unknown> = { status: newStatus };
    if (flow.requiresUser) updates.assigned_to = targetUserId;
    if (action === 'iade' || action === 'hurda') updates.assigned_to = null;

    const { data, error } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Hareketi tarihçeye yaz (kişi adlarıyla zenginleştirilmiş not)
    let enrichedNote = (note as string | undefined)?.trim() || null;
    if (flow.requiresUser) {
      const { data: target } = await supabase.from('profiles').select('full_name').eq('id', targetUserId!).maybeSingle();
      const suffix = `${target?.full_name || 'Personel'} kişisine`;
      enrichedNote = enrichedNote ? `${suffix} — ${enrichedNote}` : suffix;
    }

    await supabase.from('asset_history').insert({
      asset_id: id,
      action: flow.key,
      from_user_id: current.assigned_to || null,
      to_user_id: flow.requiresUser ? targetUserId : null,
      note: enrichedNote,
    });

    return NextResponse.json({ data, flow: flow.key, status: newStatus });
  }

  // ---------------------------------------------------------------
  // MOD 2: Tanımlayıcı alan güncellemesi (durum/zimmet burada değiştirilemez)
  // ---------------------------------------------------------------
  if (body.status !== undefined || body.assigned_to !== undefined) {
    return NextResponse.json(
      { error: 'Durum ve zimmet değişiklikleri varlık akış işlemleriyle (zimmet, devir, iade...) yapılır.' },
      { status: 400 }
    );
  }

  const updates: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan bulunamadı.' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('assets')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!['super_admin', 'company_admin'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  const { id } = await params;
  const { error } = await supabase.from('assets').delete().eq('id', id).eq('company_id', profile!.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
