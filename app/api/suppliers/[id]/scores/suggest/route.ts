import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const MANAGER_ROLES = ['super_admin', 'company_admin', 'facility_manager'];

/**
 * Hizmet türü → veri eşlemesi
 *  - auditKeyword: denetim türü adında aranacak kelime (Denetim Sonuçları kriteri)
 *  - requestCategory: talep kategorisi (Şikayet Yönetimi kriteri)
 */
const SERVICE_MAP: Record<string, { auditKeyword: string | null; requestCategory: string | null }> = {
  temizlik: { auditKeyword: 'Temizlik', requestCategory: 'temizlik' },
  servis: { auditKeyword: 'Servis', requestCategory: 'servis' },
  yemekhane: { auditKeyword: 'Yemekhane', requestCategory: 'yemekhane' },
  guvenlik: { auditKeyword: 'Güvenlik', requestCategory: null },
  teknik: { auditKeyword: null, requestCategory: 'teknik' },
  diger: { auditKeyword: null, requestCategory: null },
};

const CRITERIA = [
  'service_quality',
  'timeliness',
  'complaint_management',
  'staff_suitability',
  'audit_results',
  'action_closure',
] as const;

interface Suggestion {
  value: number | null;
  count: number;
  note: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * GET /api/suppliers/[id]/scores/suggest?period_start=YYYY-MM-DD&period_end=YYYY-MM-DD
 * Gerçek verilerden karne kriter önerileri üretir (0-10 ölçeği):
 *  - Denetim Sonuçları ← hizmet türüyle eşleşen tamamlanmış denetimlerin ortalaması
 *  - Aksiyon Kapatma ← dönemde oluşturulan aksiyonların kapatılma oranı
 *  - Zamanında Hizmet ← kapatılan aksiyonların termin (due_date) uyumu
 *  - Şikayet Yönetimi ← kategori eşleşen taleplerin çözüm oranı
 *  - Hizmet Kalitesi ← memnuniyet anketleri ortalaması (1-5 → ×2)
 *  - Personel Uygunluğu ← veri kaynağı yok (manuel)
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!MANAGER_ROLES.includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const { id } = await params;
  const url = new URL(request.url);
  const periodStart = url.searchParams.get('period_start') || '';
  const periodEnd = url.searchParams.get('period_end') || '';
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDate.test(periodStart) || !isoDate.test(periodEnd) || periodStart > periodEnd) {
    return NextResponse.json({ error: 'Geçerli dönem gerekli (period_start, period_end)' }, { status: 400 });
  }

  const companyId = profile!.company_id;
  const { data: supplier, error: supError } = await supabase
    .from('suppliers')
    .select('id, name, service_type')
    .eq('id', id)
    .eq('company_id', companyId)
    .single();
  if (supError || !supplier) return NextResponse.json({ error: 'Tedarikçi bulunamadı' }, { status: 404 });

  const map = SERVICE_MAP[supplier.service_type] || { auditKeyword: null, requestCategory: null };
  const startIso = `${periodStart}T00:00:00.000Z`;
  const endIso = `${periodEnd}T23:59:59.999Z`;

  const suggestions: Record<string, Suggestion> = {};

  // 1) Denetim Sonuçları — hizmet türüyle eşleşen denetim türlerindeki tamamlanmış denetimler
  let auditValue: number | null = null;
  let auditCount = 0;
  let auditNote = 'Bu hizmet türü için denetim eşlemesi yok';
  if (map.auditKeyword) {
    const { data: types } = await supabase
      .from('audit_types')
      .select('id')
      .eq('company_id', companyId)
      .ilike('name', `%${map.auditKeyword}%`);
    const typeIds = (types || []).map((t) => t.id);
    if (typeIds.length > 0) {
      const { data: audits } = await supabase
        .from('audits')
        .select('percentage')
        .eq('company_id', companyId)
        .in('audit_type_id', typeIds)
        .in('status', ['completed', 'approved'])
        .gte('audit_date', periodStart)
        .lte('audit_date', periodEnd);
      const vals = (audits || [])
        .filter((a) => a.percentage !== null && a.percentage !== undefined)
        .map((a) => Number(a.percentage))
        .filter((v) => !isNaN(v));
      if (vals.length > 0) {
        auditValue = round1(vals.reduce((a, b) => a + b, 0) / vals.length / 10);
        auditCount = vals.length;
        auditNote = `${map.auditKeyword} denetimleri ortalaması (dönem içi, tamamlanmış)`;
      } else {
        auditNote = `${map.auditKeyword} denetimi bulunamadı (dönem içi, tamamlanmış)`;
      }
    }
  }
  suggestions.audit_results = { value: auditValue, count: auditCount, note: auditNote };

  // 2) Aksiyon Kapatma — dönemde oluşturulan tüm aksiyonların kapatılma oranı
  const { data: actions } = await supabase
    .from('actions')
    .select('status, closed_at, due_date')
    .eq('company_id', companyId)
    .gte('created_at', startIso)
    .lte('created_at', endIso);
  const actionRows = actions || [];

  let closureValue: number | null = null;
  if (actionRows.length > 0) {
    const closed = actionRows.filter((a) => a.status === 'kapali').length;
    closureValue = round1((closed / actionRows.length) * 10);
  }
  suggestions.action_closure = {
    value: closureValue,
    count: actionRows.length,
    note: 'Dönemde oluşturulan aksiyonların kapatılma oranı',
  };

  // 3) Zamanında Hizmet — termin verilmiş kapatılmış aksiyonların termin uyumu
  const closedWithDue = actionRows.filter((a) => a.status === 'kapali' && a.due_date && a.closed_at);
  let timelinessValue: number | null = null;
  if (closedWithDue.length > 0) {
    const onTime = closedWithDue.filter(
      (a) => String(a.closed_at).slice(0, 10) <= String(a.due_date).slice(0, 10)
    ).length;
    timelinessValue = round1((onTime / closedWithDue.length) * 10);
  }
  suggestions.timeliness = {
    value: timelinessValue,
    count: closedWithDue.length,
    note: 'Kapatılan aksiyonların termin uyumu (dönem içi)',
  };

  // 4) Şikayet Yönetimi — kategori eşleşen taleplerin çözüm oranı
  let complaintValue: number | null = null;
  let requestCount = 0;
  let complaintNote = 'Bu hizmet türü için talep kategorisi eşlemesi yok';
  if (map.requestCategory) {
    const { data: requests } = await supabase
      .from('requests')
      .select('status')
      .eq('company_id', companyId)
      .eq('category', map.requestCategory)
      .gte('created_at', startIso)
      .lte('created_at', endIso);
    const rows = requests || [];
    requestCount = rows.length;
    if (rows.length > 0) {
      const resolved = rows.filter((r) => r.status === 'cozumlendi' || r.status === 'tamamlandi').length;
      complaintValue = round1((resolved / rows.length) * 10);
      complaintNote = `${map.requestCategory} kategorili taleplerin çözüm oranı (dönem içi)`;
    } else {
      complaintNote = `${map.requestCategory} kategorisinde talep bulunamadı (dönem içi)`;
    }
  }
  suggestions.complaint_management = { value: complaintValue, count: requestCount, note: complaintNote };

  // 5) Hizmet Kalitesi — memnuniyet anketleri ortalaması (1-5 → 0-10)
  const { data: ratings } = await supabase
    .from('satisfaction_ratings')
    .select('score')
    .eq('company_id', companyId)
    .gte('period', periodStart)
    .lte('period', periodEnd);
  const ratingVals = (ratings || [])
    .map((r) => Number(r.score))
    .filter((v) => !isNaN(v) && v > 0);
  let qualityValue: number | null = null;
  if (ratingVals.length > 0) {
    qualityValue = round1((ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length) * 2);
  }
  suggestions.service_quality = {
    value: qualityValue,
    count: ratingVals.length,
    note: 'Memnuniyet anketleri ortalaması (dönem içi)',
  };

  // 6) Personel Uygunluğu — veri kaynağı yok, manuel değerlendirme
  suggestions.staff_suitability = {
    value: null,
    count: 0,
    note: 'Manuel değerlendirme (otomatik veri kaynağı yok)',
  };

  return NextResponse.json({
    data: {
      supplier: { id: supplier.id, name: supplier.name, service_type: supplier.service_type },
      period: { start: periodStart, end: periodEnd },
      criteria: CRITERIA,
      suggestions,
    },
  });
}
