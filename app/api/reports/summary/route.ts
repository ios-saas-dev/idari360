import { createServerSupabaseClient } from '@/lib/supabase/server';
import { computeFacilityHealth } from '@/lib/facility-health';
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

  const paramCompanyId = searchParams.get('company_id');
  const cid = paramCompanyId || profile.company_id;
  const isSuperAdmin = profile.role === 'super_admin';
  
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
    `);

  if (cid) {
    reqQuery = reqQuery.eq('company_id', cid);
  }

  if (activeFacilityId) {
    reqQuery = reqQuery.eq('facility_id', activeFacilityId);
  }
  if (startDate) {
    reqQuery = reqQuery.gte('created_at', startDate.toISOString());
  }

  // 2. Aksiyonlar, Denetimler, Varlıklar (+ Şube 360 / trafik ışığı için kırılımlar)
  let actQuery = supabase.from('actions').select(`
    id, action_number, title, status, priority, created_at, due_date, closed_at, facility_id, responsible_user_id,
    facility:facilities!actions_facility_id_fkey(id, name, city),
    responsible:profiles!actions_responsible_user_id_fkey(id, full_name)
  `);
  if (cid) actQuery = actQuery.eq('company_id', cid);

  let audQuery = supabase.from('audits').select('id, status, percentage, audit_date, facility_id');
  if (cid) audQuery = audQuery.eq('company_id', cid);

  let astQuery = supabase.from('assets').select('id, status, category, facility_id');
  if (cid) astQuery = astQuery.eq('company_id', cid);

  let facQuery = supabase.from('facilities').select('id, name, city').eq('is_active', true);
  if (cid) facQuery = facQuery.eq('company_id', cid);

  // Memnuniyet değerlendirmeleri (talep kapanış anketleri)
  let satQuery = supabase
    .from('satisfaction_ratings')
    .select('id, score, request_id, created_at, facility_id, request:requests(assigned_to, facility_id)');
  if (cid) satQuery = satQuery.eq('company_id', cid);
  if (activeFacilityId) satQuery = satQuery.eq('facility_id', activeFacilityId);
  if (startDate) satQuery = satQuery.gte('created_at', startDate.toISOString());

  // Şube sağlık skoru için dönemden bağımsız son 90 gün pencereleri
  const since90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  let reqHealthQuery = supabase
    .from('requests')
    .select('id, facility_id, sla_response_minutes, created_at')
    .gte('created_at', since90.toISOString());
  if (cid) reqHealthQuery = reqHealthQuery.eq('company_id', cid);
  if (activeFacilityId) reqHealthQuery = reqHealthQuery.eq('facility_id', activeFacilityId);

  let satHealthQuery = supabase
    .from('satisfaction_ratings')
    .select('id, facility_id, score, created_at')
    .gte('created_at', since90.toISOString());
  if (cid) satHealthQuery = satHealthQuery.eq('company_id', cid);
  if (activeFacilityId) satHealthQuery = satHealthQuery.eq('facility_id', activeFacilityId);

  // Tedarikçiler (şirket kapsamı) — performans karnesi rapora girer
  let supQuery = supabase
    .from('suppliers')
    .select('id, name, service_type, is_active')
    .order('name');
  if (cid) supQuery = supQuery.eq('company_id', cid);

  if (activeFacilityId) {
    actQuery = actQuery.eq('facility_id', activeFacilityId);
    audQuery = audQuery.eq('facility_id', activeFacilityId);
    astQuery = astQuery.eq('facility_id', activeFacilityId);
  }

  const [requestsRes, actionsRes, auditsRes, assetsRes, facilitiesRes, satisfactionRes, reqHealthRes, satHealthRes, suppliersRes] = await Promise.all([
    reqQuery,
    actQuery,
    audQuery,
    astQuery,
    facQuery,
    satQuery,
    reqHealthQuery,
    satHealthQuery,
    supQuery,
  ]);

  const requests = requestsRes.data || [];
  const actions = actionsRes.data || [];
  const audits = auditsRes.data || [];
  const assets = assetsRes.data || [];
  const facilities = facilitiesRes.data || [];
  const satisfactionRatings = (satisfactionRes.data || []) as any[];
  const healthRequests = (reqHealthRes.data || []) as any[];
  const healthRatings = (satHealthRes.data || []) as any[];
  const suppliersList = (suppliersRes.data || []) as any[];

  // Tedarikçi puanları (son dönem + önceki dönem karşılaştırması)
  let supplierScores: any[] = [];
  if (suppliersList.length > 0) {
    const { data: scoreRows } = await supabase
      .from('supplier_scores')
      .select(
        'id, supplier_id, period_start, period_end, service_quality, timeliness, complaint_management, staff_suitability, audit_results, action_closure, overall_score'
      )
      .in('supplier_id', suppliersList.map((s: any) => s.id))
      .order('period_end', { ascending: false });
    supplierScores = (scoreRows || []) as any[];
  }

  // Bu ay tamamlanan işler (dönem filtresinden bağımsız, takvim ayı)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartIso = monthStart.toISOString();
  const monthStartDateStr = monthStartIso.slice(0, 10);

  const completionCounts = await Promise.all([
    (() => {
      let q = supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .in('status', ['cozumlendi', 'tamamlandi'])
        .gte('closed_at', monthStartIso);
      if (cid) q = q.eq('company_id', cid);
      if (activeFacilityId) q = q.eq('facility_id', activeFacilityId);
      return q;
    })(),
    (() => {
      let q = supabase
        .from('actions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'kapali')
        .gte('closed_at', monthStartIso);
      if (cid) q = q.eq('company_id', cid);
      if (activeFacilityId) q = q.eq('facility_id', activeFacilityId);
      return q;
    })(),
    (() => {
      let q = supabase
        .from('audits')
        .select('id', { count: 'exact', head: true })
        .in('status', ['completed', 'approved'])
        .gte('audit_date', monthStartDateStr);
      if (cid) q = q.eq('company_id', cid);
      if (activeFacilityId) q = q.eq('facility_id', activeFacilityId);
      return q;
    })(),
  ]);

  // =========================================================================
  // A0. MEMNUNİYET SKORU (talep kapanış anketleri, 1-5)
  // =========================================================================
  const satScores = satisfactionRatings
    .map((r) => Number(r.score))
    .filter((v) => Number.isFinite(v) && v >= 1 && v <= 5);

  const satisfactionAvg = satScores.length > 0
    ? Math.round((satScores.reduce((a, b) => a + b, 0) / satScores.length) * 10) / 10
    : null;

  const satisfactionByAssignee = new Map<string, number[]>();
  const satisfactionByFacility = new Map<string, number[]>();
  satisfactionRatings.forEach((r) => {
    const score = Number(r.score);
    if (!Number.isFinite(score) || score < 1 || score > 5) return;

    const assigneeId = r.request?.assigned_to;
    if (assigneeId) {
      if (!satisfactionByAssignee.has(assigneeId)) satisfactionByAssignee.set(assigneeId, []);
      satisfactionByAssignee.get(assigneeId)!.push(score);
    }

    const fid = r.request?.facility_id || r.facility_id;
    if (fid) {
      if (!satisfactionByFacility.has(fid)) satisfactionByFacility.set(fid, []);
      satisfactionByFacility.get(fid)!.push(score);
    }
  });

  const avgOf = (values?: number[]) =>
    values && values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10
      : null;

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
      target_badge: onTarget ? 'Hedefte (≤ 60 dk)' : 'Gecikmeli',
      satisfaction_avg: avgOf(satisfactionByFacility.get(f.facility_id)),
      satisfaction_count: satisfactionByFacility.get(f.facility_id)?.length || 0,
    };
  });

  // 5. Çözücü / Sorumlu Karnesi (Resolver & Manager Scorecard)
  // Kural: "Talebi üzerine aldıklarında ise kapanana kadar geçen süre (T3 - T2) o kişinin karnesine yazılsın."
  const resolverScorecardsMap: Record<string, {
    user_id: string;
    full_name: string;
    role: string;
    total_taken: number;
    solved_count: number;
    rejected_count: number;
    in_progress_count: number;
    resolution_times: number[];
  }> = {};

  requests.forEach((r: any) => {
    if (!r.assigned_to) return;
    const uid = r.assigned_to;
    const name = r.assignee?.full_name || 'Bilinmeyen Sorumlu';
    const role = r.assignee?.role || 'Sorumlu';

    if (!resolverScorecardsMap[uid]) {
      resolverScorecardsMap[uid] = {
        user_id: uid,
        full_name: name,
        role,
        total_taken: 0,
        solved_count: 0,
        rejected_count: 0,
        in_progress_count: 0,
        resolution_times: [],
      };
    }

    const item = resolverScorecardsMap[uid];
    item.total_taken += 1;
    if (r.status === 'cozumlendi' || r.status === 'tamamlandi') item.solved_count += 1;
    else if (r.status === 'reddedildi') item.rejected_count += 1;
    else if (r.status === 'islemde' || r.status === 'atandi') item.in_progress_count += 1;

    // T3 - T2 (Çözüm İşlem Süresi)
    if (r.sla_resolution_minutes != null && Number(r.sla_resolution_minutes) >= 0) {
      item.resolution_times.push(Number(r.sla_resolution_minutes));
    } else if (r.closed_at && r.assigned_at) {
      const diffMin = (new Date(r.closed_at).getTime() - new Date(r.assigned_at).getTime()) / 60000;
      if (diffMin >= 0) item.resolution_times.push(diffMin);
    }
  });

  const resolverScorecards = Object.values(resolverScorecardsMap).map((res) => {
    const avgResol = res.resolution_times.length > 0
      ? Math.round(res.resolution_times.reduce((a, b) => a + b, 0) / res.resolution_times.length)
      : 0;
    const successRate = res.total_taken > 0 ? Math.round((res.solved_count / res.total_taken) * 100) : 0;
    const onTarget = avgResol > 0 && avgResol <= RESOLUTION_TARGET_MINUTES;

    return {
      user_id: res.user_id,
      full_name: res.full_name,
      role: res.role,
      total_taken: res.total_taken,
      solved_count: res.solved_count,
      rejected_count: res.rejected_count,
      in_progress_count: res.in_progress_count,
      success_rate: successRate,
      avg_resolution_minutes: avgResol,
      on_target: onTarget,
      target_badge: onTarget ? 'Hedefte (≤ 4s)' : 'Gecikmeli',
      satisfaction_avg: avgOf(satisfactionByAssignee.get(res.user_id)),
      satisfaction_count: satisfactionByAssignee.get(res.user_id)?.length || 0,
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

  // =========================================================================
  // C. ŞUBE DURUM PANOSU (Trafik Işığı) — son 90 gün penceresi
  // =========================================================================
  const DONE_AUDIT_STATUSES = ['completed', 'approved'];
  const OPEN_ACTION_STATUSES = ['acik', 'devam_ediyor', 'gecikti'];
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const since90DateStr = since90.toISOString().slice(0, 10);

  const scopeFacilities = activeFacilityId
    ? facilities.filter((f: any) => f.id === activeFacilityId)
    : facilities;

  const facilityHealth = scopeFacilities.map((f: any) => {
    const fAudits = audits.filter(
      (a: any) =>
        a.facility_id === f.id &&
        DONE_AUDIT_STATUSES.includes(a.status) &&
        a.audit_date &&
        String(a.audit_date) >= since90DateStr
    );
    const auditScores = fAudits
      .map((a: any) => Number(a.percentage))
      .filter((v: number) => Number.isFinite(v));
    const auditAvg = auditScores.length
      ? Math.round((auditScores.reduce((x: number, y: number) => x + y, 0) / auditScores.length) * 10) / 10
      : null;

    const fRatings = healthRatings
      .filter((r: any) => r.facility_id === f.id)
      .map((r: any) => Number(r.score))
      .filter((v: number) => Number.isFinite(v) && v >= 1 && v <= 5);
    const satAvg = fRatings.length
      ? Math.round((fRatings.reduce((x: number, y: number) => x + y, 0) / fRatings.length) * 10) / 10
      : null;

    const fActions = actions.filter((a: any) => a.facility_id === f.id);
    const overdueActions = fActions.filter(
      (a: any) => OPEN_ACTION_STATUSES.includes(a.status) && a.due_date && a.due_date < todayStr
    ).length;

    const fReq = healthRequests.filter((r: any) => r.facility_id === f.id);
    const respSamples = fReq
      .map((r: any) => (r.sla_response_minutes != null ? Number(r.sla_response_minutes) : null))
      .filter((v: number | null): v is number => v != null && v >= 0);
    const avgResponse = respSamples.length
      ? Math.round(respSamples.reduce((x: number, y: number) => x + y, 0) / respSamples.length)
      : null;

    const health = computeFacilityHealth({
      audit_avg: auditAvg,
      audit_count: fAudits.length,
      satisfaction_avg: satAvg,
      satisfaction_count: fRatings.length,
      overdue_actions: overdueActions,
      avg_response_minutes: avgResponse,
      response_sample_count: respSamples.length,
      request_total: fReq.length,
    });

    return {
      facility_id: f.id,
      facility_name: f.name,
      city: f.city,
      score: health.score,
      color: health.color,
      label: health.label,
      parts: health.parts,
    };
  });

  // =========================================================================
  // D. TEDARİKÇİ PERFORMANS KARNESİ (son dönem + önceki dönem kıyası)
  // =========================================================================
  const suppliers = suppliersList.map((s: any) => {
    const scores = supplierScores.filter((sc: any) => sc.supplier_id === s.id);
    const latest = scores[0] || null;
    const previous = scores[1] || null;
    const avgOverall = scores.length
      ? Math.round((scores.reduce((x: number, sc: any) => x + Number(sc.overall_score || 0), 0) / scores.length) * 10) / 10
      : null;

    return {
      id: s.id,
      name: s.name,
      service_type: s.service_type,
      is_active: s.is_active,
      latest_period: latest?.period_end || null,
      overall: latest ? Number(latest.overall_score) : null,
      previous_overall: previous ? Number(previous.overall_score) : null,
      avg_overall: avgOverall,
      score_count: scores.length,
      criteria: latest
        ? {
            service_quality: Number(latest.service_quality || 0),
            timeliness: Number(latest.timeliness || 0),
            complaint_management: Number(latest.complaint_management || 0),
            staff_suitability: Number(latest.staff_suitability || 0),
            audit_results: Number(latest.audit_results || 0),
            action_closure: Number(latest.action_closure || 0),
          }
        : null,
    };
  });

  // =========================================================================
  // E. AÇIK AKSİYONLAR & BU AY TAMAMLANAN İŞLER
  // =========================================================================
  const openActionsList = actions
    .filter((a: any) => OPEN_ACTION_STATUSES.includes(a.status))
    .sort((a: any, b: any) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    })
    .slice(0, 12)
    .map((a: any) => ({
      id: a.id,
      action_number: a.action_number,
      title: a.title,
      priority: a.priority,
      status: a.status,
      due_date: a.due_date,
      overdue: !!a.due_date && a.due_date < todayStr,
      facility_name: a.facility?.name || null,
      responsible_name: a.responsible?.full_name || null,
    }));

  const completedThisMonth = {
    requests: completionCounts[0]?.count || 0,
    actions: completionCounts[1]?.count || 0,
    audits: completionCounts[2]?.count || 0,
  };

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
    resolver_scorecards: resolverScorecards,
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
    satisfaction: {
      avg: satisfactionAvg,
      count: satScores.length,
    },
    facility_health: facilityHealth,
    suppliers,
    open_actions: openActionsList,
    completed_this_month: completedThisMonth,
  };

  return NextResponse.json({ data: summary });
}
