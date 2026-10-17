import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { computeFacilityHealth } from '@/lib/facility-health';

/**
 * Şube Detayı (360°) — tek tesise ait tüm modül verilerinin özeti.
 *
 * Kapsam: super_admin (tümü) · company_admin (kendi şirketi) ·
 *         facility_manager / facility_officer (yalnızca kendi tesisi)
 */

const ALLOWED_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];
const OPEN_REQUEST_STATUSES = ['yeni', 'atandi', 'onaylandi', 'islemde'];
const OPEN_ACTION_STATUSES = ['acik', 'devam_ediyor', 'gecikti'];
const DONE_AUDIT_STATUSES = ['completed', 'approved'];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

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

    // Tesis rolleri yalnızca kendi tesisini görebilir
    if (['facility_manager', 'facility_officer'].includes(profile.role) && profile.facility_id !== id) {
      return NextResponse.json({ error: 'Bu tesis için yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    const admin = createAdminClient();
    const { data: facility, error: facError } = await admin
      .from('facilities')
      .select('id, name, code, city, region, address, is_active, company_id, created_at, companies(name)')
      .eq('id', id)
      .single();

    if (facError || !facility) {
      return NextResponse.json({ error: 'Tesis bulunamadı.' }, { status: 404 });
    }

    // Şirket yöneticisi başka şirketin tesisine erişemez
    if (profile.role !== 'super_admin' && facility.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Bu tesis için yetkiniz bulunmamaktadır.' }, { status: 403 });
    }

    const now = new Date();
    const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const trendStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [reqRes, audRes, actRes, astRes, staffRes, equipRes, satRes, usrRes] = await Promise.all([
      admin
        .from('requests')
        .select(
          'id, request_number, status, category, priority, created_at, closed_at, assigned_at, sla_response_minutes, sla_resolution_minutes, sla_total_minutes, assignee:profiles!requests_assigned_to_fkey(id, full_name)'
        )
        .eq('facility_id', id)
        .order('created_at', { ascending: false }),
      admin
        .from('audits')
        .select('id, audit_date, percentage, status, audit_type:audit_types(name)')
        .eq('facility_id', id)
        .gte('audit_date', trendStart.toISOString().slice(0, 10))
        .order('audit_date', { ascending: false }),
      admin
        .from('actions')
        .select(
          'id, action_number, title, priority, status, due_date, responsible:profiles!actions_responsible_user_id_fkey(id, full_name)'
        )
        .eq('facility_id', id),
      admin.from('assets').select('id, status, category').eq('facility_id', id),
      admin
        .from('cleaning_staff')
        .select('id, full_name, position, is_active')
        .eq('facility_id', id),
      admin
        .from('cleaning_equipment')
        .select('id, name, type, quantity, condition')
        .eq('facility_id', id),
      admin
        .from('satisfaction_ratings')
        .select('id, score, comment, created_at')
        .eq('facility_id', id)
        .order('created_at', { ascending: false })
        .limit(30),
      admin.from('profiles').select('id, is_active').eq('facility_id', id),
    ]);

    const requests = reqRes.data || [];
    const audits = audRes.data || [];
    const actions = actRes.data || [];
    const assets = astRes.data || [];
    const staff = staffRes.data || [];
    const equipment = equipRes.data || [];
    const ratings = satRes.data || [];
    const users = usrRes.data || [];

    // ----- KPI'lar -----
    const openRequests = requests.filter((r: any) => OPEN_REQUEST_STATUSES.includes(r.status)).length;
    const solvedRequests = requests.filter((r: any) => ['cozumlendi', 'tamamlandi'].includes(r.status)).length;

    const respSamples = requests
      .filter((r: any) => r.created_at && r.created_at >= since90.toISOString())
      .map((r: any) => (r.sla_response_minutes != null ? Number(r.sla_response_minutes) : null))
      .filter((v: number | null): v is number => v != null && v >= 0);
    const avgResponse = respSamples.length
      ? Math.round(respSamples.reduce((a: number, b: number) => a + b, 0) / respSamples.length)
      : null;

    const doneAudits90 = audits.filter(
      (a: any) => DONE_AUDIT_STATUSES.includes(a.status) && a.audit_date >= since90.toISOString().slice(0, 10)
    );
    const auditScores = doneAudits90
      .map((a: any) => Number(a.percentage))
      .filter((v: number) => Number.isFinite(v));
    const auditAvg = auditScores.length
      ? Math.round((auditScores.reduce((a: number, b: number) => a + b, 0) / auditScores.length) * 10) / 10
      : null;

    const openActions = actions.filter((a: any) => OPEN_ACTION_STATUSES.includes(a.status)).length;
    const overdueActions = actions.filter(
      (a: any) => OPEN_ACTION_STATUSES.includes(a.status) && a.due_date && a.due_date < todayStr
    ).length;

    const satScores90 = ratings
      .filter((r: any) => r.created_at && r.created_at >= since90.toISOString())
      .map((r: any) => Number(r.score))
      .filter((v: number) => Number.isFinite(v) && v >= 1 && v <= 5);
    const satAvg = satScores90.length
      ? Math.round((satScores90.reduce((a: number, b: number) => a + b, 0) / satScores90.length) * 10) / 10
      : null;

    const staffActive = staff.filter((s: any) => s.is_active).length;
    const assetsBroken = assets.filter((a: any) => ['ariza', 'bakimda'].includes(a.status)).length;

    const health = computeFacilityHealth({
      audit_avg: auditAvg,
      audit_count: doneAudits90.length,
      satisfaction_avg: satAvg,
      satisfaction_count: satScores90.length,
      overdue_actions: overdueActions,
      avg_response_minutes: avgResponse,
      response_sample_count: respSamples.length,
      request_total: requests.length,
    });

    // ----- Denetim trendi (son 12 ay) -----
    const auditTrend = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthAudits = audits.filter(
        (a: any) => DONE_AUDIT_STATUSES.includes(a.status) && a.audit_date?.startsWith(key)
      );
      const scores = monthAudits
        .map((a: any) => Number(a.percentage))
        .filter((v: number) => Number.isFinite(v));
      return {
        month: d.toLocaleDateString('tr-TR', { month: 'short' }),
        month_key: key,
        avg: scores.length ? Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length) : null,
        count: scores.length,
      };
    });

    // ----- Listeler -----
    const recentAudits = audits.slice(0, 8).map((a: any) => ({
      id: a.id,
      audit_date: a.audit_date,
      percentage: Number(a.percentage) || 0,
      status: a.status,
      type_name: a.audit_type?.name || 'Denetim',
    }));

    const recentRequests = requests.slice(0, 8).map((r: any) => ({
      id: r.id,
      request_number: r.request_number,
      status: r.status,
      category: r.category,
      priority: r.priority,
      created_at: r.created_at,
      assignee_name: r.assignee?.full_name || null,
    }));

    const openActionsList = actions
      .filter((a: any) => OPEN_ACTION_STATUSES.includes(a.status))
      .sort((a: any, b: any) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date < b.due_date ? -1 : 1;
      })
      .slice(0, 10)
      .map((a: any) => ({
        id: a.id,
        action_number: a.action_number,
        title: a.title,
        priority: a.priority,
        status: a.status,
        due_date: a.due_date,
        overdue: !!a.due_date && a.due_date < todayStr,
        responsible_name: a.responsible?.full_name || null,
      }));

    const assetsByStatus: Record<string, number> = {};
    assets.forEach((a: any) => {
      assetsByStatus[a.status] = (assetsByStatus[a.status] || 0) + 1;
    });

    return NextResponse.json({
      data: {
        facility,
        health,
        kpi: {
          open_requests: openRequests,
          total_requests: requests.length,
          solved_requests: solvedRequests,
          avg_response_minutes: avgResponse,
          avg_audit_score: auditAvg,
          audit_count: doneAudits90.length,
          satisfaction_avg: satAvg,
          satisfaction_count: satScores90.length,
          open_actions: openActions,
          overdue_actions: overdueActions,
          assets_total: assets.length,
          assets_broken: assetsBroken,
          staff_active: staffActive,
          users_active: users.filter((u: any) => u.is_active).length,
        },
        audit_trend: auditTrend,
        recent_audits: recentAudits,
        recent_requests: recentRequests,
        open_actions: openActionsList,
        assets_by_status: assetsByStatus,
        staff: staff.slice(0, 20),
        equipment: equipment.slice(0, 20),
        recent_satisfaction: ratings.slice(0, 5).map((r: any) => ({
          score: Number(r.score),
          comment: r.comment,
          created_at: r.created_at,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Hata oluştu.' }, { status: 500 });
  }
}
