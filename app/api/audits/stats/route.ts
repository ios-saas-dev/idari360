import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/audits/stats — Denetim istatistik dashboard'u için özet veriler
// (Excel: "aylık denetim sayıları, ortalama puan grafiği, son 12 ay,
//  bölgesel başarı, en iyi/en kötü ilk 10")

const MONTHS_TR_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
];

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Kapsam: liste rotası ile birebir aynı rol/tesis kuralları
  let query = supabase
    .from('audits')
    .select('id, status, percentage, audit_date, facility:facilities(id, name, city)')
    .eq('company_id', profile.company_id)
    .order('audit_date', { ascending: false });

  if (!['super_admin', 'company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all = (data || []) as unknown as Array<{
    id: string;
    status: string;
    percentage: number | null;
    audit_date: string | null;
    facility: { id: string; name: string; city: string | null } | null;
  }>;

  const isCompleted = (s: string) => s === 'completed' || s === 'approved';
  const completed = all.filter((a) => isCompleted(a.status));

  // İstanbul'a göre "bugün" ve son 12 ay penceresi
  const todayIstanbul = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
  }).format(new Date()); // YYYY-MM-DD
  const [curYear, curMonth] = todayIstanbul.split('-').map(Number); // curMonth: 1-12

  const monthSlots: Array<{ key: string; label: string }> = [];
  for (let i = 11; i >= 0; i--) {
    const idx = curYear * 12 + (curMonth - 1) - i;
    const y = Math.floor(idx / 12);
    const m = idx % 12; // 0-11
    monthSlots.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: m === 0 ? `${MONTHS_TR_SHORT[m]} '${String(y).slice(2)}` : MONTHS_TR_SHORT[m],
    });
  }
  const windowKeys = new Set(monthSlots.map((s) => s.key));
  const keyOf = (d: string | null) => (d ? String(d).slice(0, 7) : null);

  const monthly = monthSlots.map((slot) => {
    const inMonth = completed.filter((a) => keyOf(a.audit_date) === slot.key);
    const scored = inMonth.filter((a) => a.percentage !== null && a.percentage !== undefined);
    const avg =
      scored.length > 0
        ? Math.round(
            (scored.reduce((s, a) => s + Number(a.percentage), 0) / scored.length) * 10
          ) / 10
        : null;
    return { key: slot.key, label: slot.label, count: inMonth.length, avgScore: avg };
  });

  // Son 12 ay penceresindeki skorlu tamamlanan denetimler
  const scoredInWindow = completed.filter(
    (a) =>
      a.percentage !== null &&
      a.percentage !== undefined &&
      windowKeys.has(keyOf(a.audit_date) || '')
  );
  const avgScore =
    scoredInWindow.length > 0
      ? Math.round(
          (scoredInWindow.reduce((s, a) => s + Number(a.percentage), 0) /
            scoredInWindow.length) *
            10
        ) / 10
      : null;

  const thisMonthKey = `${curYear}-${String(curMonth).padStart(2, '0')}`;
  const thisMonthCompleted = completed.filter(
    (a) => keyOf(a.audit_date) === thisMonthKey
  ).length;

  // Puan bantları (tamamlanan, skorlu)
  const allScored = completed.filter(
    (a) => a.percentage !== null && a.percentage !== undefined
  );
  const bands = { uygun: 0, takip: 0, kritik: 0 };
  for (const a of allScored) {
    const p = Number(a.percentage);
    if (p >= 80) bands.uygun++;
    else if (p >= 60) bands.takip++;
    else bands.kritik++;
  }

  // Bölgesel başarı (tesis bazlı; yalnız tamamlanan denetimler)
  const facilityMap = new Map<
    string,
    { id: string; name: string; city: string | null; auditCount: number; scoreSum: number; scoredCount: number }
  >();
  for (const a of completed) {
    if (!a.facility?.id) continue;
    const entry = facilityMap.get(a.facility.id) || {
      id: a.facility.id,
      name: a.facility.name,
      city: a.facility.city,
      auditCount: 0,
      scoreSum: 0,
      scoredCount: 0,
    };
    entry.auditCount++;
    if (a.percentage !== null && a.percentage !== undefined) {
      entry.scoreSum += Number(a.percentage);
      entry.scoredCount++;
    }
    facilityMap.set(a.facility.id, entry);
  }

  const facilities = [...facilityMap.values()]
    .filter((f) => f.scoredCount > 0)
    .map((f) => ({
      id: f.id,
      name: f.name,
      city: f.city,
      auditCount: f.auditCount,
      avgScore: Math.round((f.scoreSum / f.scoredCount) * 10) / 10,
    }))
    .sort((a, b) => b.avgScore - a.avgScore || b.auditCount - a.auditCount);

  return NextResponse.json({
    totals: {
      total: all.length,
      completed: completed.length,
      thisMonth: thisMonthCompleted,
      avgScore,
      scoredCount: scoredInWindow.length,
      facilitiesCount: facilities.length,
    },
    bands,
    monthly,
    facilities,
    top: facilities.slice(0, 10),
    worst: [...facilities].reverse().slice(0, 10),
  });
}
