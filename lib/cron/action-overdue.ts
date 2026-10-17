import { getAdminSupabaseClient, getBaseUrl, todayInIstanbul, formatDateTR, CronJobResult } from './shared';
import { sendActionNotificationEmail } from '@/lib/email';

/**
 * AKSİYON GECİKME BİLDİRİMİ (Excel kuralı)
 * ----------------------------------------------------------------
 * Termin tarihi geçmiş ve hâlâ kapatılmamış aksiyonlar için:
 *  - Sorumlu kişiye gecikme e-postası + uygulama içi bildirim
 *  - Tesis yöneticileri / şirket yöneticilerine uygulama içi bildirim
 *
 * "Onay bekleyen" (onay_bekliyor) aksiyonlar hariç tutulur: sorumlu işini
 * tamamlamıştır, top artık onaylayan yöneticidedir.
 *
 * Aynı aksiyon için bildirim tekrarlanmaz (overdue_notified_at damgası).
 */
export async function runActionOverdueCron(): Promise<CronJobResult> {
  const supabase = getAdminSupabaseClient();
  const now = new Date();
  const baseUrl = getBaseUrl();

  // Türkiye saatine göre "bugün" (YYYY-MM-DD) — termin günü dolmadan aksiyon gecikmiş sayılmaz
  const todayTR = todayInIstanbul();

  const stats = {
    overdueProcessed: 0,
    emailsSent: 0,
    notificationsSent: 0,
    errors: [] as string[],
  };

  try {
    // Termin tarihi bugünden önce olan, kapatılmamış/açık veya işlemde olan ve
    // daha önce gecikme bildirimi gönderilmemiş aksiyonlar
    const { data: overdueActions, error: queryError } = await supabase
      .from('actions')
      .select(`
        id,
        action_number,
        title,
        priority,
        due_date,
        status,
        company_id,
        facility_id,
        responsible_user_id,
        facility:facilities(id, name),
        responsible:profiles!actions_responsible_user_id_fkey(id, email, full_name)
      `)
      .in('status', ['acik', 'devam_ediyor', 'gecikti'])
      .not('due_date', 'is', null)
      .lt('due_date', todayTR)
      .is('overdue_notified_at', null);

    if (queryError) {
      console.error('[Cron] Action overdue query error:', queryError);
      return {
        job: 'action-overdue',
        success: false,
        stats,
        error: queryError.message,
      };
    }

    stats.overdueProcessed = overdueActions?.length || 0;

    for (const action of overdueActions || []) {
      try {
        const facilityName = (action.facility as { name?: string } | null)?.name || 'Tesis';
        const responsible = action.responsible as
          | { id?: string; email?: string; full_name?: string }
          | null;
        const actionUrl = `${baseUrl}/dashboard/actions/${action.id}`;

        // Gecikme gün sayısı (YYYY-MM-DD karşılaştırması)
        const daysOverdue = Math.max(
          1,
          Math.round(
            (Date.parse(todayTR) - Date.parse(String(action.due_date))) / (1000 * 60 * 60 * 24)
          )
        );

        const dueDateFormatted = formatDateTR(String(action.due_date));
        const notifiedUserIds = new Set<string>();

        // 1) Sorumlu kişiye e-posta + uygulama içi bildirim
        if (responsible?.id) {
          if (responsible.email) {
            await sendActionNotificationEmail({
              to: responsible.email,
              recipientName: responsible.full_name,
              actionNumber: action.action_number,
              title: action.title,
              priority: action.priority,
              dueDate: dueDateFormatted,
              facilityName,
              isOverdue: true,
              actionUrl,
            });
            stats.emailsSent++;
          }

          await supabase.from('notifications').insert({
            company_id: action.company_id,
            user_id: responsible.id,
            title: `[GECİKME] ${action.action_number}`,
            message: `${facilityName} — "${action.title}" aksiyonunun termini ${dueDateFormatted} tarihinde geçti (${daysOverdue} gündür gecikmede). Lütfen aksiyonu tamamlayıp kapatınız.`,
            type: 'uyari',
            related_type: 'action',
            related_id: action.id,
          });
          stats.notificationsSent++;
          notifiedUserIds.add(responsible.id);
        }

        // 2) Tesis / şirket yöneticilerine uygulama içi bildirim (sorumluya tekrar gitmesin)
        const { data: authorities } = await supabase
          .from('profiles')
          .select('id')
          .eq('company_id', action.company_id)
          .eq('is_active', true)
          .in('role', ['company_admin', 'facility_manager'])
          .or(`facility_id.eq.${action.facility_id},facility_id.is.null,role.eq.company_admin`);

        for (const authority of authorities || []) {
          if (notifiedUserIds.has(authority.id)) continue;

          await supabase.from('notifications').insert({
            company_id: action.company_id,
            user_id: authority.id,
            title: `[GECİKME] ${action.action_number} — ${
              responsible?.full_name || 'Sorumlu atanmadı'
            }`,
            message: `${facilityName} — "${action.title}" aksiyonu ${daysOverdue} gündür gecikmede ve henüz kapatılmadı.`,
            type: 'uyari',
            related_type: 'action',
            related_id: action.id,
          });
          stats.notificationsSent++;
          notifiedUserIds.add(authority.id);
        }

        // 3) Tekrar bildirim gitmemesi için damga
        await supabase
          .from('actions')
          .update({ overdue_notified_at: now.toISOString() })
          .eq('id', action.id);
      } catch (itemErr: any) {
        console.error(`[Cron] Error processing overdue action ${action.id}:`, itemErr);
        stats.errors.push(`Action ${action.id}: ${itemErr?.message || itemErr}`);
      }
    }

    return { job: 'action-overdue', success: true, stats };
  } catch (err: any) {
    console.error('[Cron] Fatal error in action-overdue cron:', err);
    return {
      job: 'action-overdue',
      success: false,
      stats,
      error: err?.message || 'Bilinmeyen cron hatası',
    };
  }
}
