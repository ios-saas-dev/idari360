import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { computeFacilityHealth } from '@/lib/facility-health';

/**
 * Şube 360° İstatistikleri — Şubeler sayfası kartları + rapor trafik ışığı için.
 *
 * Kapsam: super_admin (tüm şirketler) · company_admin (kendi şirketi) ·
 *         facility_manager / facility_officer (yalnızca kendi tesisi)
 *
 * Metrikler:
 *  - Talep: açık talep (tüm zamanlar), bu ay açılan, son 90 gün ort. karşılama (T2-T1)
 *  - Denetim: son 90 gün tamamlanmış denetim ort. puanı
 *  - Aksiyon: açık + gecikmiş aksiyon
 *  - Varlık: toplam + arızalı
 *  - Personel: temizlik personeli (aktif) + uygulama kullanıcıları (aktif)
 *  - Memnuniyet: son 90 gün ort. (1-5)
 *  - Sağlık: trafik ışığı (lib/facility-health)
 */

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];
const OPEN_REQUEST_STATUSES = ['yeni', 'atandi', 'onaylandi', 'islemde'];
const OPEN_ACTION_STATUSES = ['acik', 'devam_ediyor', 'gecikti'];
const DONE_AUDIT_STATUSES = ['completed', 'approved'];

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Oturum açmanız gerekiyor.' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, company_id, facility_id')
      .eq('id', user.id)
      .single();

    if (!profile || !ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    const admin = createAdminClient();
    let facQuery = admin
      .from('facilities')
      .select('id, name, code, city, region, address, is_active, company_id, created_at, companies(name)')
      .order('name');

    if (profile.role !== 'super_admin') {
      facQuery = facQuery.eq('company_id', profile.company_id);
    }
    if (['facility_manager', 'facility_officer'].includes(profile.role)) {
      if (!profile.facility_id) {
        return NextResponse.json({ facilities: [] });
      }
      facQuery = facQuery.eq('id', profile.facility_id);
    }

    const { data: facilities, error: facError } = await facQuery;
    if (facError) {
      return NextResponse.json({ error: facError.message }, { status: 500 });
    }
    if (!facilities || facilities.length === 0) {
      return NextResponse.json({ facilities: [] });
    }

    const facilityIds = facilities.map((f: any) => f.id);

    const now = new Date();
    const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [reqRes, audRes, actRes, astRes, staffRes, usersRes, satRes] = await Promise.all([
      // Açık talepler (her yaştan) + son 90 günün tüm talepleri
      admin
        .from('requests')
        .select('id, facility_id, status, created_at, sla_response_minutes')
        .in('facility_id', facilityIds)
        .or(`created_at.gte.${since90.toISOString()},status.in.(${OPEN_REQUEST_STATUSES.join(',')})`),
      // Son 90 günde tamamlanmış denetimler
      admin
        .from('audits')
        .select('id, facility_id, percentage, status, audit_date')
        .in('facility_id', facilityIds)
        .in('status', DONE_AUDIT_STATUSES)
        .gte('audit_date', since90.toISOString().slice(0, 10)),
      // Tüm aksiyonlar (açık/gecikmiş hesabı)
      admin
        .from('actions')
        .select('id, facility_id, status, due_date')
        .in('facility_id', facilityIds),
      // Varlıklar
      admin
        .from('assets')
        .select('id, facility_id, status')
        .in('facility_id', facilityIds),
      // Temizlik personeli
      admin
        .from('cleaning_staff')
        .select('id, facility_id, is_active')
        .in('facility_id', facilityIds),
      // Uygulama kullanıcıları
      admin
        .from('profiles')
        .select('id, facility_id, is_active')
        .in('facility_id', facilityIds),
      // Son 90 gün memnuniyet
      admin
        .from('satisfaction_ratings')
        .select('id, facility_id, score, created_at')
        .in('facility_id', facilityIds)
        .gte('created_at', since90.toISOString()),
    ]);

    const requests = reqRes.data || [];
    const audits = audRes.data || [];
    const actions = actRes.data || [];
    const assets = astRes.data || [];
    const staff = staffRes.data || [];
    const users = usersRes.data || [];
    const ratings = satRes.data || [];

    const monthStartIso = monthStart.toISOString();

    const result = facilities.map((f: any) => {
      const fRequests = requests.filter((r: any) => r.facility_id === f.id);
      const fAudits = audits.filter((a: any) => a.facility_id === f.id);
      const fActions = actions.filter((a: any) => a.facility_id === f.id);
      const fAssets = assets.filter((a: any) => a.facility_id === f.id);
      const fStaff = staff.filter((s: any) => s.facility_id === f.id);
      const fUsers = users.filter((u: any) => u.facility_id === f.id);
      const fRatings = ratings.filter((r: any) => r.facility_id === f.id);

      const openRequests = fRequests.filter((r: any) => OPEN_REQUEST_STATUSES.includes(r.status)).length;
      const monthRequests = fRequests.filter(
        (r: any) => r.created_at && r.created_at >= monthStartIso
      ).length;

      const respSamples = fRequests
        .map((r: any) => (r.sla_response_minutes != null ? Number(r.sla_response_minutes) : null))
        .filter((v: number | null): v is number => v != null && v >= 0);
      const avgResponse = respSamples.length
        ? Math.round(respSamples.reduce((a: number, b: number) => a + b, 0) / respSamples.length)
        : null;

      const auditScores = fAudits
        .map((a: any) => Number(a.percentage))
        .filter((v: number) => Number.isFinite(v));
      const auditAvg = auditScores.length
        ? Math.round((auditScores.reduce((a: number, b: number) => a + b, 0) / auditScores.length) * 10) / 10
        : null;

      const openActions = fActions.filter((a: any) => OPEN_ACTION_STATUSES.includes(a.status)).length;
      const overdueActions = fActions.filter(
        (a: any) => OPEN_ACTION_STATUSES.includes(a.status) && a.due_date && a.due_date < todayStr
      ).length;

      const satScores = fRatings
        .map((r: any) => Number(r.score))
        .filter((v: number) => Number.isFinite(v) && v >= 1 && v <= 5);
      const satAvg = satScores.length
        ? Math.round((satScores.reduce((a: number, b: number) => a + b, 0) / satScores.length) * 10) / 10
        : null;

      const staffActive = fStaff.filter((s: any) => s.is_active).length;
      const usersActive = fUsers.filter((u: any) => u.is_active).length;
      const assetsBroken = fAssets.filter((a: any) => ['ariza', 'bakimda'].includes(a.status)).length;

      const health = computeFacilityHealth({
        audit_avg: auditAvg,
        audit_count: fAudits.length,
        satisfaction_avg: satAvg,
        satisfaction_count: satScores.length,
        overdue_actions: overdueActions,
        avg_response_minutes: avgResponse,
        response_sample_count: respSamples.length,
        request_total: fRequests.length,
      });

      return {
        ...f,
        stats: {
          open_requests: openRequests,
          month_requests: monthRequests,
          avg_response_minutes: avgResponse,
          open_actions: openActions,
          overdue_actions: overdueActions,
          assets_total: fAssets.length,
          assets_broken: assetsBroken,
          staff_active: staffActive,
          users_active: usersActive,
          audit_avg_90d: auditAvg,
          audit_count_90d: fAudits.length,
          satisfaction_avg: satAvg,
          satisfaction_count: satScores.length,
        },
        health,
      };
    });

    return NextResponse.json({ facilities: result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Hata oluştu.' }, { status: 500 });
  }
}
