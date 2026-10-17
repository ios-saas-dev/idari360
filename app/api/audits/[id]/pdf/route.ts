import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateAuditReportPdf,
  slugifyTR,
  type AuditReportData,
} from '@/lib/pdf/audit-report';

export const runtime = 'nodejs';

// GET /api/audits/[id]/pdf — Sunucu taraflı denetim PDF raporu
// Excel kuralı: "PDF raporu: tarih, denetçi, tüm sorular, cevaplar, fotoğraflar,
// açıklamalar; son sayfa: genel değerlendirme + açık aksiyonlar"
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // 1. Denetim + ilişkileri (kullanıcı istemcisi; RLS şirket/tesis izolasyonu sağlar)
  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .select(
      `
      *,
      facility:facilities(id, name, city),
      auditor:profiles!audits_auditor_id_fkey(id, full_name),
      service_vehicle:service_vehicles(id, plate_number, route_name, brand, model),
      audit_type:audit_types(
        id, name, module, max_score,
        categories:audit_categories(
          id, name, max_score, sort_order,
          questions:audit_questions(id, question_text, max_points, sort_order, is_active)
        )
      ),
      answers:audit_answers(
        id, question_id, answer, score, note, due_date, photo_url, action_id,
        action:actions!audit_answers_action_id_fkey(id, action_number, status, due_date)
      ),
      photos:audit_photos(id, photo_url, photo_type, caption, created_at)
    `
    )
    .eq('id', id)
    .single();

  if (auditError || !audit) {
    return NextResponse.json({ error: 'Denetim bulunamadı' }, { status: 404 });
  }

  // Şirket izolasyonu (detay GET ile birebir aynı kural)
  if (audit.company_id !== profile.company_id && profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 });
  }

  // Yalnızca tamamlanmış / onaylanmış denetimler için rapor üretilir
  if (audit.status !== 'completed' && audit.status !== 'approved') {
    return NextResponse.json(
      { error: 'Denetim tamamlanmadan PDF raporu oluşturulamaz.' },
      { status: 400 }
    );
  }

  // 2. Aksiyonlar — sistem raporlaması: admin istemcisi (profil görünürlüğünden bağımsız)
  const admin = createAdminClient();
  const { data: actions } = await admin
    .from('actions')
    .select(
      'action_number, title, status, priority, due_date, responsible:profiles!actions_responsible_user_id_fkey(full_name)'
    )
    .eq('audit_id', id)
    .order('action_number', { ascending: true });

  // 3. Rapor verisini hazırla
  const answers = (audit.answers || []) as Array<{
    question_id: string;
    answer: string;
    score: number | null;
    note: string | null;
    due_date: string | null;
    photo_url: string | null;
    action: { action_number: string | null; status: string } | null;
  }>;
  const answeredQuestionIds = new Set(answers.map((a) => a.question_id));

  const categories = ((audit.audit_type?.categories || []) as any[])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((cat) => ({
      id: cat.id as string,
      name: cat.name as string,
      max_score: (cat.max_score ?? null) as number | null,
      sort_order: (cat.sort_order ?? null) as number | null,
      questions: ((cat.questions || []) as any[])
        .filter((q) => q.is_active !== false || answeredQuestionIds.has(q.id))
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((q) => ({
          id: q.id as string,
          question_text: q.question_text as string,
          max_points: (q.max_points ?? null) as number | null,
          sort_order: (q.sort_order ?? null) as number | null,
        })),
    }))
    .filter((cat) => cat.questions.length > 0);

  const reportData: AuditReportData = {
    audit: {
      id: audit.id,
      title: audit.title,
      status: audit.status,
      audit_date: audit.audit_date,
      total_score: audit.total_score,
      max_possible_score: audit.max_possible_score,
      percentage: audit.percentage,
      notes: audit.notes,
    },
    auditTypeName: audit.audit_type?.name || 'Denetim',
    facility: audit.facility
      ? { name: audit.facility.name, city: audit.facility.city }
      : null,
    vehicle: audit.service_vehicle
      ? {
          plate_number: audit.service_vehicle.plate_number,
          route_name: audit.service_vehicle.route_name,
        }
      : null,
    auditorName: audit.auditor?.full_name || null,
    categories,
    answers: answers.map((a) => ({
      question_id: a.question_id,
      answer: a.answer,
      score: a.score,
      note: a.note,
      due_date: a.due_date,
      photo_url: a.photo_url,
      action: a.action,
    })),
    generalPhotos: ((audit.photos || []) as any[])
      .filter((p) => p.photo_type === 'general')
      .map((p) => ({ photo_url: p.photo_url as string, caption: (p.caption ?? null) as string | null })),
    actions: (actions || []).map((a: any) => ({
      action_number: a.action_number,
      title: a.title,
      status: a.status,
      priority: a.priority,
      due_date: a.due_date,
      responsible_name: a.responsible?.full_name || null,
    })),
  };

  // 4. PDF üret
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await generateAuditReportPdf(reportData);
  } catch (err) {
    console.error('[Audit PDF] Rapor üretilemedi:', err);
    return NextResponse.json(
      { error: 'PDF raporu üretilirken bir hata oluştu. Lütfen tekrar deneyin.' },
      { status: 500 }
    );
  }

  const filename = `Denetim-Raporu-${slugifyTR(
    audit.title || audit.audit_type?.name || 'denetim'
  )}-${String(audit.audit_date || '').slice(0, 10) || 'tarihsiz'}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
      'Cache-Control': 'no-store',
    },
  });
}
