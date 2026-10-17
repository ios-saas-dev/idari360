import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendAuditCompletedEmail } from '@/lib/email';

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
      service_vehicle:service_vehicles(id, plate_number, route_name, brand, model),
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
        action:actions!audit_answers_action_id_fkey(id, action_number, status, due_date)
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
  const { title, notes, status, answers = [], general_photos: generalPhotosInput, planned_date } = body;

  // Planlanan tarih güncellemesi (opsiyonel alan; gönderildiyse işlenir)
  let plannedDateUpdate: string | null | undefined = undefined;
  if (planned_date !== undefined) {
    if (planned_date === null || planned_date === '') {
      plannedDateUpdate = null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(String(planned_date))) {
      plannedDateUpdate = String(planned_date);
    } else {
      return NextResponse.json({ error: 'Planlanan tarih geçersiz (YYYY-AA-GG olmalı).' }, { status: 400 });
    }
  }

  // Genel görünüm fotoğrafları (opsiyonel gövde alanı; gönderildiyse senkronize edilir)
  const generalPhotoUrls: string[] | null = Array.isArray(generalPhotosInput)
    ? (generalPhotosInput as unknown[]).filter(
        (u): u is string => typeof u === 'string' && u.trim().length > 0
      )
    : null;

  // 1. Mevcut denetim kaydını çek
  const { data: currentAudit, error: fetchErr } = await supabase
    .from('audits')
    .select(`
      *,
      facility:facilities(id, name, city),
      service_vehicle:service_vehicles(id, plate_number, route_name, brand, model),
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
  //    Kısmi güncellemelerde (ör. yönetici onayı) kayıtlı cevaplar korunur: gövdede
  //    gönderilen cevap yoksa kayıtlı cevap, o da yoksa N/A (yanıtlanmadı) kabul edilir.
  const categories = currentAudit.audit_type?.categories || [];
  const answersMap = new Map<string, any>();
  for (const ans of answers) {
    answersMap.set(ans.question_id, ans);
  }

  const { data: existingAnswerRows } = await supabase
    .from('audit_answers')
    .select('question_id, answer, note, due_date, photo_url')
    .eq('audit_id', id);

  const existingAnswersMap = new Map<string, any>();
  for (const row of existingAnswerRows || []) {
    existingAnswersMap.set(row.question_id, row);
  }

  let totalAuditEarnedScore = 0;
  const calculatedAnswers: any[] = [];

  for (const cat of categories) {
    const questions = cat.questions || [];
    let catMaxPoints = 0;
    let catEarnedPoints = 0;

    for (const q of questions) {
      const ans = answersMap.get(q.id);
      const prev = existingAnswersMap.get(q.id);
      const answerVal = ans?.answer ?? prev?.answer ?? 'na';
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
        // N/A = yanıtlanmadı; puanlamaya dahil edilmez
        questionScore = 0;
      }

      calculatedAnswers.push({
        audit_id: id,
        question_id: q.id,
        answer: answerVal,
        score: questionScore,
        note: ans ? ans.note || null : prev?.note || null,
        due_date: ans ? ans.due_date || null : prev?.due_date || null,
        photo_url: ans ? ans.photo_url || null : prev?.photo_url || null,
      });
    }

    // Kategori Puanı = (Kazanılan Puan / Kategori Toplam Puanı) * Kategori Maksimum Ağırlığı
    const categoryMaxWeight = Number(cat.max_score) || 0;
    const catProportion = catMaxPoints > 0 ? catEarnedPoints / catMaxPoints : 1;
    const catScore = Math.round(catProportion * categoryMaxWeight * 100) / 100;
    totalAuditEarnedScore += catScore;
  }

  // 2.1 Tamamlama kuralı: Tüm sorular Evet/Hayır olarak yanıtlanmadan denetim tamamlanamaz.
  //     N/A (yanıtlanmadı) durumundaki sorular varken yalnızca taslak olarak kaydedilebilir.
  if (status === 'completed') {
    const unansweredCount = calculatedAnswers.filter(
      (a) => a.answer !== 'evet' && a.answer !== 'hayir'
    ).length;

    if (unansweredCount > 0) {
      return NextResponse.json(
        {
          error: `Denetim tamamlanamaz: ${unansweredCount} soru hâlâ N/A (yanıtlanmadı) durumunda. Tüm soruları Evet veya Hayır olarak yanıtlayın; ara kaydınızı "Taslak Kaydet" ile saklayabilirsiniz.`,
        },
        { status: 400 }
      );
    }

    // 2.2 "Hayır" (uygunsuzluk) maddelerinde açıklama zorunlu — Excel kuralı:
    //     "Eğer 'hayır' seçeneği seçildi ise açıklama yazma alanı ve deadline kutucuğu açılmalı."
    const missingNoteCount = calculatedAnswers.filter(
      (a) => a.answer === 'hayir' && !(a.note && String(a.note).trim())
    ).length;

    if (missingNoteCount > 0) {
      return NextResponse.json(
        {
          error: `Denetim tamamlanamaz: ${missingNoteCount} uygunsuzluk ("Hayır") maddesi için açıklama zorunludur. Lütfen her uygunsuzluğun tespit açıklamasını yazın.`,
        },
        { status: 400 }
      );
    }

    // 2.3 En az 1 genel görünüm fotoğrafı zorunlu — Excel kuralı: "En az 1 fotoğraf zorunlu"
    let generalPhotoCount = generalPhotoUrls ? generalPhotoUrls.length : 0;
    if (generalPhotoUrls === null) {
      const { count } = await supabase
        .from('audit_photos')
        .select('id', { count: 'exact', head: true })
        .eq('audit_id', id)
        .eq('photo_type', 'general');
      generalPhotoCount = count || 0;
    }

    if (generalPhotoCount < 1) {
      return NextResponse.json(
        {
          error:
            'Denetim tamamlanamaz: En az 1 genel görünüm fotoğrafı yüklemek zorunludur. Fotoğrafı denetim formundaki "Genel Görünüm Fotoğrafı" bölümünden ekleyin.',
        },
        { status: 400 }
      );
    }
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

  // 3.1 Genel görünüm fotoğraflarını senkronize et (gövdede gönderildiyse)
  if (generalPhotoUrls !== null) {
    await supabase
      .from('audit_photos')
      .delete()
      .eq('audit_id', id)
      .eq('photo_type', 'general');

    if (generalPhotoUrls.length > 0) {
      const { error: photoErr } = await supabase.from('audit_photos').insert(
        generalPhotoUrls.map((url) => ({
          audit_id: id,
          photo_url: url,
          photo_type: 'general' as const,
        }))
      );
      if (photoErr) {
        console.error('[Audit] Genel görünüm fotoğrafı kaydedilemedi:', photoErr.message);
      }
    }
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

          // Araç bilgisi: servis denetimlerinde aksiyon, denetlenen araca bağlanır
          const vehicle = currentAudit.service_vehicle || null;
          const vehicleTitlePrefix = vehicle ? `${vehicle.plate_number} • ` : '';
          const vehicleDescBlock = vehicle
            ? `\n\nAraç: ${vehicle.plate_number}${
                vehicle.brand || vehicle.model
                  ? ` (${[vehicle.brand, vehicle.model].filter(Boolean).join(' ')})`
                  : ''
              }${vehicle.route_name ? `\nHat / Güzergah: ${vehicle.route_name}` : ''}`
            : '';

          // Aksiyonu oluştur
          const { data: newAction } = await supabase
            .from('actions')
            .insert({
              company_id: currentAudit.company_id,
              facility_id: currentAudit.facility_id,
              audit_id: id,
              audit_question_id: ansItem.question_id,
              audit_answer_id: existingAnswer?.id || null,
              service_vehicle_id: vehicle?.id || null,
              action_number,
              title: `[Uygunsuzluk] ${vehicleTitlePrefix}${qText.slice(0, 140)}`,
              description: `Denetim sırasında uygunsuzluk tespit edildi.${vehicleDescBlock}\n\nBulgu / Not: ${
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
  if (plannedDateUpdate !== undefined) auditUpdates.planned_date = plannedDateUpdate;
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
      service_vehicle:service_vehicles(id, plate_number, route_name, brand, model),
      audit_type:audit_types(id, name, module)
    `)
    .single();

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // 6. Denetim ilk kez tamamlandığında/onaylandığında sonuç bildirimi:
  //    Excel kuralı — "Mail gönderimi: Yönetici, Denetim sonucu, Toplam puan"
  let notifiedCount = 0;
  const becameFinal =
    (status === 'completed' || status === 'approved') &&
    currentAudit.status !== 'completed' &&
    currentAudit.status !== 'approved';

  if (becameFinal) {
    try {
      const facilityName =
        (currentAudit as any).facility?.name ||
        (updatedAudit as any).facility?.name ||
        'Tesis';
      const auditTitle =
        updatedAudit?.title ||
        currentAudit.title ||
        currentAudit.audit_type?.name ||
        'Denetim';
      const bandLabel =
        percentage >= 80
          ? 'UYGUN'
          : percentage >= 60
          ? 'TAKİP GEREKİYOR'
          : 'KRİTİK UYGUNSUZLUK';
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://idari360.com';
      const auditUrl = `${baseUrl}/dashboard/audits/${id}`;

      // Alıcılar admin istemcisiyle bulunur: denetimi tamamlayan kullanıcının RLS
      // görünürlüğü (ör. saha sorumlusu başka profilleri göremez) sonucu etkilememeli.
      const admin = createAdminClient();

      // Tesis yöneticileri + şirket yöneticileri (aktif kullanıcılar)
      const { data: recipients } = await admin
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('company_id', currentAudit.company_id)
        .eq('is_active', true)
        .in('role', ['company_admin', 'facility_manager', 'facility_officer'])
        .or(
          `facility_id.eq.${currentAudit.facility_id},facility_id.is.null,role.eq.company_admin`
        );

      if (recipients && recipients.length > 0) {
        for (const recipient of recipients) {
          try {
            if (recipient.email) {
              await sendAuditCompletedEmail({
                to: recipient.email,
                recipientName: recipient.full_name,
                auditTitle,
                facilityName,
                module: currentAudit.audit_type?.module || 'denetim',
                score: finalScore,
                percentage,
                actionCount: createdActionsCount,
                auditUrl,
              });
            }

            const { error: notifErr } = await admin.from('notifications').insert({
              company_id: currentAudit.company_id,
              user_id: recipient.id,
              title: `[Denetim Sonucu] ${auditTitle}`,
              message: `${facilityName} — denetim tamamlandı. Puan: %${percentage} (${bandLabel})${
                createdActionsCount > 0
                  ? ` • ${createdActionsCount} yeni aksiyon açıldı`
                  : ''
              }`,
              type: 'bildirim',
              related_type: 'audit',
              related_id: id,
            });
            if (notifErr) {
              console.error('[Audit] Bildirim eklenemedi:', notifErr.message, '| alıcı:', recipient.id);
            }

            notifiedCount++;
          } catch (recipientErr) {
            console.error('[Audit] Alıcı bildirim hatası:', recipientErr);
          }
        }
      }
    } catch (notifyErr) {
      // Bildirim hatası denetim kaydını etkilemez
      console.error('[Audit] Sonuç bildirimi genel hatası:', notifyErr);
    }
  }

  return NextResponse.json({
    data: updatedAudit,
    score: finalScore,
    percentage,
    createdActionsCount,
    notifiedCount,
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
