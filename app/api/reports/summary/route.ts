import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role, full_name')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const timeRange = searchParams.get('range') || 'son_6_ay';
  const queryFacilityId = searchParams.get('facility_id');

  const cid = profile.company_id;
  
  // Tesis izolasyonu: Tesis Müdürü / Sorumlusu yalnızca kendi tesisini görür
  // Üst yöneticiler (super_admin, company_admin) konsolide tüm tesisleri görür (veya seçilen tesisi filtreler)
  let activeFacilityId: string | null = null;
  if (!['super_admin', 'company_admin'].includes(profile.role)) {
    activeFacilityId = profile.facility_id || null;
  } else if (queryFacilityId && queryFacilityId !== 'all') {
    activeFacilityId = queryFacilityId;
  }

  // Tarih aralığı filtresi
  const now = new Date();
  let startDate: Date | null = null;
  if (timeRange === 'bu_ay') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (timeRange === 'son_3_ay') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  } else if (timeRange === 'son_6_ay') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  } else if (timeRange === 'bu_yil') {
    startDate = new Date(now.getFullYear(), 0, 1);
  }

  // 1. Talepleri Çek
  let reqQuery = supabase
    .from('requests')
    .select(`
      id,
      request_number,
      status,
      category,
      priority,
      created_at,
      assigned_at,
      closed_at,
      sla_response_minutes,
      sla_resolution_minutes,
      sla_total_minutes,
      facility_id,
      assigned_to,
      facility:facilities(id, name, city),
      assignee:profiles!requests_assigned_to_fkey(id, full_name, role)
    `)
    .eq('company_id', cid);

  if (activeFacilityId) {
    reqQuery = reqQuery.eq('facility_id', activeFacilityId);
  }
  if (startDate) {
    reqQuery = reqQuery.gte('created_at', startDate.toISOString());
  }

  // 2. Aksiyonlar, Denetimler, Varlıklar
  let actQuery = supabase.from('actions').select('id, status, priority, created_at, due_date').eq('company_id', cid);
  let audQuery = supabase.from('audits').select('id, status, percentage, audit_date').eq('company_id', cid);
  let astQuery = supabase.from('assets').select('id, status, category').eq('company_id', cid);
  let facQuery = supabase.from('facilities').select('id, name, city').eq('company_id', cid).eq('is_active', true);

  if (activeFacilityId) {
    actQuery = actQuery.eq('facility_id', activeFacilityId);
    audQuery = audQuery.eq('facility_id', activeFacilityId);
    astQuery = astQuery.eq('facility_id', activeFacilityId);
  }

  const [requestsRes, actionsRes, auditsRes, assetsRes, facilitiesRes] = await Promise.all([
    reqQuery,
    actQuery,
    audQuery,
    astQuery,
    facQuery,
  ]);

  const requests = requestsRes.data || [];
  const actions = actionsRes.data || [];
  const audits = auditsRes.data || [];
  const assets = assetsRes.data || [];
  const facilities = facilitiesRes.data || [];

  // =========================================================================
  // A. ÖZET BİLGİ (KPI) METRİKLERİ VE SLA HESAPLARI
  // =========================================================================
  const totalRequests = requests.length;
  const solvedRequests = requests.filter((r: any) => r.status === 'cozumlendi' || r.status === 'tamamlandi').length;
  const rejectedRequests = requests.filter((r: any) => r.status === 'reddedildi').length;
  const inProgressRequests = requests.filter((r: any) => r.status === 'islemde' || r.status === 'atandi').length;
  const openRequests = requests.filter((r: any) => r.status === 'yeni').length;

  // Karşılama Süresi (T2 - T1): Dakika cinsinden
  const responseMinutesList = requests
    .map((r: any) => {
      if (r.sla_response_minutes != null) return Number(r.sla_response_minutes);
      if (r.assigned_at && r.created_at) {
        return (new Date(r.assigned_at).getTime() - new Date(r.created_at).getTime()) / 60000;
      }
      return null;
    })
    .filter((v: number | null): v is number => v !== null && v >= 0);

  const avgResponseMinutes = responseMinutesList.length > 0
    ? Math.round(responseMinutesList.reduce((a, b) => a + b, 0) / responseMinutesList.length)
    : 0;

  // Çözüm İşlem Süresi (T3 - T2): Dakika cinsinden
  const resolutionMinutesList = requests
    .map((r: any) => {
      if (r.sla_resolution_minutes != null) return Number(r.sla_resolution_minutes);
      if (r.closed_at && r.assigned_at) {
        return (new Date(r.closed_at).getTime() - new Date(r.assigned_at).getTime()) / 60000;
      }
      return null;
    })
    .filter((v: number | null): v is number => v !== null && v >= 0);

  const avgResolutionMinutes = resolutionMinutesList.length > 0
    ? Math.round(resolutionMinutesList.reduce((a, b) => a + b, 0) / resolutionMinutesList.length)
    : 0;

  // Toplam Süre (T3 - T1): Dakika cinsinden
  const totalMinutesList = requests
    .map((r: any) => {
      if (r.sla_total_minutes != null) return Number(r.sla_total_minutes);
      if (r.closed_at && r.created_at) {
        return (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / 60000;
      }
      return null;
    })
    .filter((v: number | null): v is number => v !== null && v >= 0);

  const avgTotalMinutes = totalMinutesList.length > 0
    ? Math.round(totalMinutesList.reduce((a, b) => a + b, 0) / totalMinutesList.length)
    : 0;

  // Hedef süreler (SLA Benchmark)
  const RESPONSE_TARGET_MINUTES = 60; // Hedef: 60 dakika (1 saat)
  const RESOLUTION_TARGET_MINUTES = 240; // Hedef: 240 dakika (4 saat)
  const isResponseOnTarget = avgResponseMinutes > 0 && avgResponseMinutes <= RESPONSE_TARGET_MINUTES;
  const isResolutionOnTarget = avgResolutionMinutes > 0 && avgResolutionMinutes <= RESOLUTION_TARGET_MINUTES;

  // =========================================================================
  // B. GRAFİKLER VE ANALİZLER
  // =========================================================================

  // 1. Talep Durum Dağılımı (Donut Chart)
  const statusDistribution = [
    {
      id: 'cozumlendi',
      label: 'Çözümlendi',
      count: solvedRequests,
      percentage: totalRequests > 0 ? Math.round((solvedRequests / totalRequests) * 100) : 0,
      color: '#10b981', // green-500
    },
    {
      id: 'islemde',
      label: 'İşlemde / Üzerime Alındı',
      count: inProgressRequests,
      percentage: totalRequests > 0 ? Math.round((inProgressRequests / totalRequests) * 100) : 0,
      color: '#f59e0b', // amber-500
    },
    {
      id: 'yeni',
      label: 'Açık / Beklemede',
      count: openRequests,
      percentage: totalRequests > 0 ? Math.round((openRequests / totalRequests) * 100) : 0,
      color: '#3b82f6', // blue-500
    },
    {
      id: 'reddedildi',
      label: 'Reddedildi',
      count: rejectedRequests,
      percentage: totalRequests > 0 ? Math.round((rejectedRequests / totalRequests) * 100) : 0,
      color: '#ef4444', // red-500
    },
  ];

  // 2. Kategori Bazlı Performans (Talep sayısı, çözüm oranı % ve süreler)
  const CATEGORIES = [
    { key: 'temizlik', label: 'Temizlik & Hijyen', color: '#06b6d4' },
    { key: 'yemekhane', label: 'Yemekhane', color: '#f97316' },
    { key: 'teknik', label: 'Teknik & Bakım', color: '#f43f5e' },
    { key: 'servis', label: 'Servis / Ulaşım', color: '#3b82f6' },
    { key: 'filo', label: 'Filo & Taşıt', color: '#a855f7' },
    { key: 'varlik', label: 'Varlık & Zimmet', color: '#6366f1' },
    { key: 'diger', label: 'Diğer Talepler', color: '#64748b' },
  ];

  const categoryPerformance = CATEGORIES.map((cat) => {
    const catReqs = requests.filter((r: any) => r.category === cat.key);
    const catTotal = catReqs.length;
    const catSolved = catReqs.filter((r: any) => r.status === 'cozumlendi' || r.status === 'tamamlandi').length;
    const catRejected = catReqs.filter((r: any) => r.status === 'reddedildi').length;
    const catInProgress = catReqs.filter((r: any) => r.status === 'islemde' || r.status === 'atandi').length;
    const catOpen = catReqs.filter((r: any) => r.status === 'yeni').length;
    const resolutionRate = catTotal > 0 ? Math.round((catSolved / catTotal) * 100) : 0;

    // SLA averages for this category
    const catRespList = catReqs
      .map((r: any) => r.sla_response_minutes != null ? Number(r.sla_response_minutes) : null)
      .filter((v: number | null): v is number => v !== null && v >= 0);
    const catAvgResp = catRespList.length > 0 ? Math.round(catRespList.reduce((a, b) => a + b, 0) / catRespList.length) : 0;

    const catResolList = catReqs
      .map((r: any) => r.sla_resolution_minutes != null ? Number(r.sla_resolution_minutes) : null)
      .filter((v: number | null): v is number => v !== null && v >= 0);
    const catAvgResol = catResolList.length > 0 ? Math.round(catResolList.reduce((a, b) => a + b, 0) / catResolList.length) : 0;

    const catTotList = catReqs
      .map((r: any) => r.sla_total_minutes != null ? Number(r.sla_total_minutes) : null)
      .filter((v: number | null): v is number => v !== null && v >= 0);
    const catAvgTot = catTotList.length > 0 ? Math.round(catTotList.reduce((a, b) => a + b, 0) / catTotList.length) : 0;

    return {
      category: cat.key,
      label: cat.label,
      color: cat.color,
      total: catTotal,
      solved: catSolved,
      rejected: catRejected,
      in_progress: catInProgress,
      open: catOpen,
      resolution_rate: resolutionRate,
      avg_response_minutes: catAvgResp,
      avg_resolution_minutes: catAvgResol,
      avg_total_minutes: catAvgTot,
    };
  });

  // 3. Süre ve Performans Analizi (Bar Chart): Açılış-Karşılama, Karşılama-Çözüm ve Toplam Süre kıyaslaması
  const durationComparison = categoryPerformance
    .filter((c) => c.total > 0)
    .map((c) => ({
      label: c.label,
      response_minutes: c.avg_response_minutes,
      resolution_minutes: c.avg_resolution_minutes,
      total_minutes: c.avg_total_minutes,
    }));

  // 4. Tesis / Sorumlu Karnesi (Facility & Sorumlu Scorecard)
  // Tesis bazında ve sorumlu bazında müdahale hızı, çözüm süresi ve başarı karnesi
  const facilityScorecardsMap: Record<string, {
    facility_id: string;
    facility_name: string;
    city: string;
    total: number;
    solved: number;
    rejected: number;
    in_progress: number;
    open: number;
    response_times: number[];
    resolution_times: number[];
  }> = {};

  requests.forEach((r: any) => {
    const fid = r.facility_id || 'unassigned';
    const fname = r.facility?.name || 'Tesis Belirtilmemiş';
    const city = r.facility?.city || '';

    if (!facilityScorecardsMap[fid]) {
      facilityScorecardsMap[fid] = {
        facility_id: fid,
        facility_name: fname,
        city,
        total: 0,
        solved: 0,
        rejected: 0,
        in_progress: 0,
        open: 0,
        response_times: [],
        resolution_times: [],
      };
    }

    const item = facilityScorecardsMap[fid];
    item.total += 1;
    if (r.status === 'cozumlendi' || r.status === 'tamamlandi') item.solved += 1;
    else if (r.status === 'reddedildi') item.rejected += 1;
    else if (r.status === 'islemde' || r.status === 'atandi') item.in_progress += 1;
    else if (r.status === 'yeni') item.open += 1;

    if (r.sla_response_minutes != null && Number(r.sla_response_minutes) >= 0) {
      item.response_times.push(Number(r.sla_response_minutes));
    }
    if (r.sla_resolution_minutes != null && Number(r.sla_resolution_minutes) >= 0) {
      item.resolution_times.push(Number(r.sla_resolution_minutes));
    }
  });

  const facilityScorecards = Object.values(facilityScorecardsMap).map((f) => {
    const avgResp = f.response_times.length > 0
      ? Math.round(f.response_times.reduce((a, b) => a + b, 0) / f.response_times.length)
      : 0;
    const avgResol = f.resolution_times.length > 0
      ? Math.round(f.resolution_times.reduce((a, b) => a + b, 0) / f.resolution_times.length)
      : 0;
    const successRate = f.total > 0 ? Math.round((f.solved / f.total) * 100) : 0;
    const onTarget = avgResp > 0 && avgResp <= RESPONSE_TARGET_MINUTES;

    return {
      facility_id: f.facility_id,
      facility_name: f.facility_name,
      city: f.city,
      total_handled: f.total,
      solved_count: f.solved,
      rejected_count: f.rejected,
      in_progress_count: f.in_progress,
      open_count: f.open,
      success_rate: successRate,
      avg_response_minutes: avgResp,
      avg_resolution_minutes: avgResol,
      on_target: onTarget,
      target_badge: onTarget ? 'Hedefte' : 'Gecikmeli',
    };
  });

  // Aylık trend (Son 6 ay)
  const monthlyRequests = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const month_label = d.toLocaleDateString('tr-TR', { month: 'short' });
    const count = requests.filter((r: any) => r.created_at?.startsWith(key)).length;
    const solved = requests.filter((r: any) => (r.status === 'cozumlendi' || r.status === 'tamamlandi') && r.created_at?.startsWith(key)).length;
    return { month: month_label, count, solved };
  });

  const summary = {
    user_scope: {
      role: profile.role,
      facility_id: activeFacilityId,
      facility_name: profile.facility_id ? facilities.find((f: any) => f.id === profile.facility_id)?.name : 'Tüm Tesisler (Konsolide)',
    },
    facilities_list: facilities,
    kpi: {
      total_requests: totalRequests,
      solved_requests: solvedRequests,
      rejected_requests: rejectedRequests,
      in_progress_requests: inProgressRequests,
      open_requests: openRequests,
      avg_response_minutes: avgResponseMinutes,
      avg_resolution_minutes: avgResolutionMinutes,
      avg_total_minutes: avgTotalMinutes,
      response_target_minutes: RESPONSE_TARGET_MINUTES,
      resolution_target_minutes: RESOLUTION_TARGET_MINUTES,
      is_response_on_target: isResponseOnTarget,
      is_resolution_on_target: isResolutionOnTarget,
    },
    donut_chart: statusDistribution,
    duration_analysis: durationComparison,
    category_performance: categoryPerformance,
    facility_scorecards: facilityScorecards,
    monthly_trend: monthlyRequests,
    actions: {
      total: actions.length,
      open: actions.filter((a: any) => a.status === 'acik').length,
      in_progress: actions.filter((a: any) => a.status === 'devam_ediyor').length,
      closed: actions.filter((a: any) => a.status === 'kapali').length,
      overdue: actions.filter((a: any) => ['acik', 'devam_ediyor'].includes(a.status) && a.due_date && new Date(a.due_date) < now).length,
    },
    audits: {
      total: audits.length,
      completed: audits.filter((a: any) => a.status === 'completed').length,
      avg_score: audits.length > 0 ? Math.round(audits.reduce((sum: number, a: any) => sum + (a.percentage || 0), 0) / audits.length) : 0,
    },
    assets: {
      total: assets.length,
      active: assets.filter((a: any) => a.status === 'aktif').length,
      in_transfer: assets.filter((a: any) => a.status === 'devirde').length,
      broken: assets.filter((a: any) => a.status === 'ariza').length,
    },
  };

  return NextResponse.json({ data: summary });
}
