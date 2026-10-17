import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/* ============================================================================
   HAFTA KOPYALAMA
   - Geçen haftanın (Pazartesi-Cuma) menülerini bu haftaya kopyalar
   - Menü içeriği + planlanan kişi + porsiyon maliyeti kopyalanır
   - Gerçekleşen kişi / üretim / tüketim / fire YENİ haftaya taşınmaz (geçmiş veridir)
   - Hedefte dolu olan gün + öğün kayıtlarına dokunulmaz
============================================================================ */

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role')
    .eq('id', user.id)
    .single();
  if (!profile?.company_id) return NextResponse.json({ error: 'Profile incomplete' }, { status: 400 });
  if (!ALLOWED_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  }
  if (!profile.facility_id) {
    return NextResponse.json({ error: 'Menü kopyalamak için tesis bilgisi gerekli.' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const weekStart = typeof body?.week_start === 'string' ? body.week_start : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: 'week_start (YYYY-MM-DD) zorunludur.' }, { status: 400 });
  }

  const targetDates = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
  const sourceStart = addDays(weekStart, -7);
  const sourceEnd = addDays(weekStart, -3);

  // 1) Kaynak haftanın menüleri
  const { data: sourceMenus, error: srcErr } = await supabase
    .from('cafeteria_menus')
    .select('menu_date, meal_type, items, planned_count, unit_cost')
    .eq('company_id', profile.company_id)
    .eq('facility_id', profile.facility_id)
    .gte('menu_date', sourceStart)
    .lte('menu_date', sourceEnd);

  if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 });
  if (!sourceMenus || sourceMenus.length === 0) {
    return NextResponse.json({ data: { copied: 0, skipped: 0, source: 0 }, message: 'Geçen haftada kopyalanacak menü bulunamadı.' });
  }

  // 2) Hedef haftada dolu olan gün + öğünler
  const { data: existing, error: existErr } = await supabase
    .from('cafeteria_menus')
    .select('menu_date, meal_type')
    .eq('company_id', profile.company_id)
    .eq('facility_id', profile.facility_id)
    .in('menu_date', targetDates);

  if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 });
  const existingKeys = new Set((existing || []).map((m) => `${m.menu_date}|${m.meal_type}`));

  // 3) Kopyalanacak yeni satırlar (içerik + plan; gerçekleşen ve üretim verisi taşınmaz)
  const rows = sourceMenus
    .map((m) => ({
      menu_date: addDays(m.menu_date, 7),
      meal_type: m.meal_type,
      items: m.items,
      planned_count: m.planned_count || 0,
      unit_cost: m.unit_cost ?? null,
    }))
    .filter((m) => !existingKeys.has(`${m.menu_date}|${m.meal_type}`));

  if (rows.length === 0) {
    return NextResponse.json({
      data: { copied: 0, skipped: sourceMenus.length, source: sourceMenus.length },
      message: 'Hedef haftadaki tüm gün ve öğünler zaten dolu.',
    });
  }

  const { error: insertErr } = await supabase.from('cafeteria_menus').insert(
    rows.map((r) => ({
      company_id: profile.company_id,
      facility_id: profile.facility_id,
      menu_date: r.menu_date,
      meal_type: r.meal_type,
      items: r.items,
      planned_count: r.planned_count,
      actual_count: 0,
      produced_kg: null,
      consumed_kg: null,
      waste_kg: null,
      unit_cost: r.unit_cost,
      created_by: user.id,
    }))
  );

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({
    data: {
      copied: rows.length,
      skipped: sourceMenus.length - rows.length,
      source: sourceMenus.length,
    },
  });
}
