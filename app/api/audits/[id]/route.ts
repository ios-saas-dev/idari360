import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  // 1. Denetim kaydı ve ilişkilerini çek
  const { data: audit, error: auditError } = await supabase
    .from('audits')
    .select(`
      *,
      facility:facilities(id, name, city),
      auditor:profiles!audits_auditor_id_fkey(id, full_name, email),
      audit_type:audit_types(
        id,
        name,
        module,
        max_score,
        categories:audit_categories(
          id,
          name,
          max_score,
          sort_order,
          questions:audit_questions(
            id,
            question_text,
            max_points,
            sort_order,
            is_active
          )
        )
      ),
      answers:audit_answers(
        id,
        question_id,
        answer,
        score,
        note,
        due_date,
        photo_url,
        action_id,
        action:actions(id, action_number, status, due_date)
      ),
      photos:audit_photos(
        id,
        photo_url,
        photo_type,
        caption,
        created_at
      )
    `)
    .eq('id', id)
    .single();

  if (auditError || !audit) {
    return NextResponse.json({ error: 'Denetim bulunamadı' }, { status: 404 });
  }

  // Şirket izolasyonu
  if (audit.company_id !== profile.company_id && profile.role !== 'super_admin') {
    return NextResponse.json({ error: 'Yetkisiz erişim' }, { status: 403 });
  }

  return NextResponse.json({ data: audit });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, facility_id, role')
    .eq('id', user.id)
    .single();

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const body = await request.json();
  const { title, notes, status, answers = [] } = body;

  // 1. Mevcut denetim kaydını çek
  const { data: currentAudit, error: fetchErr } = await supabase
    .from('audits')
    .select(`
      *,
      audit_type:audit_types(
        id,
        module,
        max_score,
        categories:audit_categories(
          id,
          name,
          max_score,
          questions:audit_questions(id, question_text, max_points)
        )
      )
    `)
    .eq('id', id)
    .single();

  if (fetchErr || !currentAudit) {
    return NextResponse.json({ error: 'Denetim bulunamadı' }, { status: 404 });
  }

  // 2. Puan Hesaplama Algoritması (Excel kurallarına göre kategori ağırlıklı 100 puan üzerinden)
  const categories = currentAudit.audit_type?.categories || [];
  const answersMap = new Map<string, any>();
  for (const ans of answers) {
    answersMap.set(ans.question_id, ans);
  }

  let totalAuditEarnedScore = 0;
  const calculatedAnswers: any[] = [];

  for (const cat of categories) {
    const questions = cat.questions || [];
    let catMaxPoints = 0;
    let catEarnedPoints = 0;

    for (const q of questions) {
      const ans = answersMap.get(q.id);
      const answerVal = ans?.answer || 'evet';
      const questionWeight = Number(q.max_points) || 1;

      let questionScore = 0;
      if (answerVal === 'evet') {
        questionScore = questionWeight;
        catEarnedPoints += questionWeight;
        catMaxPoints += questionWeight;
      } else if (answerVal === 'hayir') {
        questionScore = 0;
        catMaxPoints += questionWeight;
      } else if (answerVal === 'na') {
        // N/A seçeneği paydaya dahil edilmez veya sıfır etki eder
        questionScore = 0;
      }

      calculatedAnswers.push({
        audit_id: id,
        question_id: q.id,
        answer: answerVal,
        score: questionScore,
        note: ans?.note || null,
        due_date: ans?.due_date || null,
        photo_url: ans?.photo_url || null,
      });
    }

    // Kategori Puanı = (Kazanılan Puan / Kategori Toplam Puanı) * Kategori Maksimum Ağırlığı
    const categoryMaxWeight = Number(cat.max_score) || 0;
    const catProportion = catMaxPoints > 0 ? catEarnedPoints / catMaxPoints : 1;
    const catScore = Math.round(catProportion * categoryMaxWeight * 100) / 100;
    totalAuditEarnedScore += catScore;
  }

  // 3. audit_answers tablosuna toplu upsert
  for (const ansItem of calculatedAnswers) {
    await supabase.from('audit_answers').upsert(
      {
        audit_id: id,
        question_id: ansItem.question_id,
        answer: ansItem.answer,
        score: ansItem.score,
        note: ansItem.note,
        due_date: ansItem.due_date,
        photo_url: ansItem.photo_url,
      },
      { onConflict: 'audit_id,question_id' }
    );
  }

  // 4. Eğer denetim tamamlandıysa ('completed' veya 'approved'):
  //    "Hayır" cevaplarından otomatik Aksiyon (ACT-...) üret!
  let createdActionsCount = 0;

  if (status === 'completed' || status === 'approved') {
    const year = new Date().getFullYear();

    for (const ansItem of calculatedAnswers) {
      if (ansItem.answer === 'hayir') {
        // Önce soru metnini bul
        let qText = 'Denetim Uygunsuzluğu';
        for (const cat of categories) {
          const matchQ = cat.questions?.find((q: any) => q.id === ansItem.question_id);
          if (matchQ) {
            qText = matchQ.question_text;
            break;
          }
        }

        // Mevcut aksiyon var mı kontrol et
        const { data: existingAnswer } = await supabase
          .from('audit_answers')
          .select('id, action_id')
          .eq('audit_id', id)
          .eq('question_id', ansItem.question_id)
          .single();

        if (!existingAnswer?.action_id) {
          // Sıradaki aksiyon numarasını üret (ACT-2026-XXXXX)
          const { data: lastAct } = await supabase
            .from('actions')
            .select('action_number')
            .eq('company_id', currentAudit.company_id)
            .like('action_number', `ACT-${year}-%`)
            .order('action_number', { ascending: false })
            .limit(1)
            .maybeSingle();

          let nextSeq = 1;
          if (lastAct?.action_number) {
            const parts = lastAct.action_number.split('-');
            nextSeq = (parseInt(parts[2] || '0', 10) || 0) + 1;
          }
          const action_number = `ACT-${year}-${String(nextSeq).padStart(5, '0')}`;

          // Termin tarihi varsayılan 7 gün
          const dueDate =
            ansItem.due_date ||
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

          // Aksiyonu oluştur
          const { data: newAction } = await supabase
            .from('actions')
            .insert({
              company_id: currentAudit.company_id,
              facility_id: currentAudit.facility_id,
              audit_id: id,
              audit_question_id: ansItem.question_id,
              audit_answer_id: existingAnswer?.id || null,
              action_number,
              title: `[Uygunsuzluk] ${qText.slice(0, 150)}`,
              description: `Denetim sırasında uygunsuzluk tespit edildi.\n\nBulgu / Not: ${
                ansItem.note || 'Açıklama belirtilmedi.'
              }`,
              category: currentAudit.audit_type?.module || 'diger',
              priority: 'yuksek',
              responsible_user_id: user.id,
              status: 'acik',
              due_date: dueDate,
              created_by: user.id,
            })
            .select()
            .single();

          if (newAction) {
            createdActionsCount++;
            // audit_answers tablosuna action_id bağla
            if (existingAnswer?.id) {
              await supabase
                .from('audit_answers')
                .update({ action_id: newAction.id })
                .eq('id', existingAnswer.id);
            }
          }
        }
      }
    }
  }

  // 5. Audits kaydını güncelle
  const finalScore = Math.min(100, Math.max(0, Math.round(totalAuditEarnedScore)));
  const percentage = finalScore; // 100 üzerinden olduğu için eşit

  const auditUpdates: any = {
    total_score: finalScore,
    percentage,
    updated_at: new Date().toISOString(),
  };

  if (title) auditUpdates.title = title;
  if (notes !== undefined) auditUpdates.notes = notes;
  if (status) {
    auditUpdates.status = status;
    if (status === 'completed' || status === 'approved') {
      auditUpdates.completed_at = new Date().toISOString();
    }
  }

  const { data: updatedAudit, error: updateErr } = await supabase
    .from('audits')
    .update(auditUpdates)
    .eq('id', id)
    .select(`
      *,
      facility:facilities(id, name, city),
      auditor:profiles!audits_auditor_id_fkey(id, full_name, email),
      audit_type:audit_types(id, name, module)
    `)
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    data: updatedAudit,
    score: finalScore,
    percentage,
    createdActionsCount,
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  const isPrivileged = ['super_admin', 'company_admin', 'facility_manager'].includes(
    profile?.role || ''
  );
  if (!isPrivileged) {
    return NextResponse.json({ error: 'Yetkisiz işlem' }, { status: 403 });
  }

  const { error } = await supabase
    .from('audits')
    .delete()
    .eq('id', id)
    .eq('company_id', profile!.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
