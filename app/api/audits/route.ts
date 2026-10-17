import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const module_type = searchParams.get('module');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  let query = supabase
    .from('audits')
    .select(`*, audit_type:audit_types(id, name, module), auditor:profiles!audits_auditor_id_fkey(id, full_name), facility:facilities(id, name, city), service_vehicle:service_vehicles(id, plate_number, route_name, brand, model)`, { count: 'exact' })
    .eq('company_id', profile.company_id)
    .order('audit_date', { ascending: false })
    .range((page-1)*limit, page*limit-1);

  if (!['super_admin','company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  }
  if (status) query = query.eq('status', status);
  if (module_type) query = query.eq('audit_types.module', module_type);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, page, totalPages: Math.ceil((count||0)/limit) });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin','facility_manager','facility_officer'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });

  const body = await request.json();
  const { title, audit_type_id, audit_date, notes, facility_id, service_vehicle_id, planned_date, auditor_id } = body;
  if (!audit_type_id || !audit_date) return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 });

  // Planlanan tarih (opsiyonel): doluysa denetim "planlı" sayılır ve
  // 7/3/1 gün kala + gecikmede otomatik hatırlatma üretilir.
  let resolvedPlannedDate: string | null = null;
  if (planned_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(planned_date))) {
      return NextResponse.json({ error: 'Planlanan tarih geçersiz (YYYY-AA-GG olmalı).' }, { status: 400 });
    }
    resolvedPlannedDate = String(planned_date);
  }

  // Denetçi ataması (opsiyonel): varsayılan, denetimi oluşturan kişidir.
  let resolvedAuditorId = user.id;
  if (auditor_id && auditor_id !== user.id) {
    const { data: auditorProfile } = await supabase
      .from('profiles')
      .select('id, role, company_id, is_active')
      .eq('id', auditor_id)
      .single();
    if (
      !auditorProfile ||
      auditorProfile.company_id !== profile!.company_id ||
      auditorProfile.is_active === false ||
      !['super_admin', 'company_admin', 'facility_manager', 'facility_officer'].includes(auditorProfile.role)
    ) {
      return NextResponse.json({ error: 'Seçilen denetçi bulunamadı veya yetkiniz yok.' }, { status: 400 });
    }
    resolvedAuditorId = auditorProfile.id;
  }

  const { data: auditType } = await supabase.from('audit_types').select('name, module, max_score').eq('id', audit_type_id).single();

  // Servis denetimleri araç bazlıdır: seçilen araç doğrulanır ve denetim araca bağlanır
  const isShuttleAudit = auditType?.module === 'servis' || auditType?.module === 'shuttle';
  let vehicle: {
    id: string;
    plate_number: string;
    route_name: string | null;
    brand: string | null;
    model: string | null;
    facility_id: string;
    company_id: string;
  } | null = null;

  if (service_vehicle_id) {
    const { data: veh } = await supabase
      .from('service_vehicles')
      .select('id, plate_number, route_name, brand, model, facility_id, company_id')
      .eq('id', service_vehicle_id)
      .single();

    if (!veh || veh.company_id !== profile!.company_id) {
      return NextResponse.json({ error: 'Seçilen servis aracı bulunamadı veya yetkiniz yok.' }, { status: 400 });
    }
    vehicle = veh;
  }

  if (isShuttleAudit && !vehicle) {
    return NextResponse.json({ error: 'Servis denetimi için denetlenecek araç seçilmelidir.' }, { status: 400 });
  }

  const resolvedFacilityId = vehicle?.facility_id || facility_id || profile!.facility_id;
  if (!resolvedFacilityId) {
    return NextResponse.json({ error: 'Denetim için tesis bilgisi gereklidir.' }, { status: 400 });
  }

  const auditTitle =
    title?.trim() ||
    (vehicle ? `${auditType?.name || 'Servis Denetimi'} - ${vehicle.plate_number}` : auditType?.name) ||
    'Denetim';

  const { data, error } = await supabase.from('audits').insert({
    company_id: profile!.company_id,
    facility_id: resolvedFacilityId,
    audit_type_id,
    auditor_id: resolvedAuditorId,
    title: auditTitle,
    audit_date,
    planned_date: resolvedPlannedDate,
    total_score: 0,
    max_possible_score: auditType?.max_score || 100,
    percentage: 0,
    status: 'draft',
    notes: notes || '',
    service_vehicle_id: vehicle?.id || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
