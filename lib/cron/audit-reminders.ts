import { getAdminSupabaseClient, getBaseUrl, todayInIstanbul, formatDateTR, CronJobResult } from './shared';
import {
  sendAuditUpcomingReminderEmail,
  sendAuditOverdueReminderEmail,
} from '@/lib/email';

/**
 * PLANLI DENETİM HATIRLATMA CRON'U (Excel kuralı)
 * ----------------------------------------------------------------
 * Planlanan denetim tarihine 7 / 3 / 1 gün kala denetçiye e-posta + uygulama
 * içi hatırlatma; planlanan tarih geçtiği hâlde tamamlanmadıysa denetçiye
 * e-posta + uygulama içi, yöneticilere uygulama içi gecikme bildirimi gider.
 *
 * Aynı hatırlatma türü aynı denetim için bir kez gönderilir
 * (audit_reminder_log üzerinde claim/upsert ile).
 */
export async function runAuditRemindersCron(): Promise<CronJobResult> {
  const supabase = getAdminSupabaseClient();
  const baseUrl = getBaseUrl();
  const todayTR = todayInIstanbul();
  const todayMs = Date.parse(todayTR);

  const REMINDER_DAYS = [7, 3, 1];

  const stats = {
    plannedProcessed: 0,
    upcomingSent: 0,
    overdueSent: 0,
    emailsSent: 0,
    notificationsSent: 0,
    errors: [] as string[],
  };

  try {
    const { data: audits, error: queryError } = await supabase
      .from('audits')
      .select(`
        id,
        title,
        company_id,
        facility_id,
        planned_date,
        status,
        auditor_id,
        facility:facilities(id, name),
        auditor:profiles!audits_auditor_id_fkey(id, email, full_name)
      `)
      .not('planned_date', 'is', null)
      .in('status', ['draft', 'in_progress']);

    if (queryError) {
      console.error('[Cron] Audit reminders query error:', queryError);
      return { job: 'audit-reminders', success: false, stats, error: queryError.message };
    }

    stats.plannedProcessed = audits?.length || 0;

    for (const audit of audits || []) {
      try {
        const plannedMs = Date.parse(String(audit.planned_date));
        const diffDays = Math.round((plannedMs - todayMs) / (1000 * 60 * 60 * 24));

        let kind: string | null = null;
        let isOverdue = false;

        if (diffDays > 0 && REMINDER_DAYS.includes(diffDays)) {
          kind = `upcoming_${diffDays}`;
        } else if (diffDays < 0) {
          kind = 'overdue';
          isOverdue = true;
        }

        if (!kind) continue;

        // Claim: aynı hatırlatma daha önce gönderildiyse atla (race-safe)
        const { data: claim, error: claimError } = await supabase
          .from('audit_reminder_log')
          .upsert(
            { audit_id: audit.id, kind },
            { onConflict: 'audit_id,kind', ignoreDuplicates: true }
          )
          .select('id');

        if (claimError) {
          console.error(`[Cron] Reminder claim error for audit ${audit.id}:`, claimError);
          stats.errors.push(`Audit ${audit.id}: claim — ${claimError.message}`);
          continue;
        }
        if (!claim || claim.length === 0) continue; // zaten gönderilmiş

        const facilityName = (audit.facility as { name?: string } | null)?.name || 'Tesis';
        const auditor = audit.auditor as
          | { id?: string; email?: string; full_name?: string }
          | null;
        const auditUrl = `${baseUrl}/dashboard/audits/${audit.id}`;
        const plannedFormatted = formatDateTR(String(audit.planned_date));
        const notifiedUserIds = new Set<string>();

        if (isOverdue) {
          const daysOverdue = Math.abs(diffDays);

          // 1) Denetçiye e-posta + uygulama içi bildirim
          if (auditor?.id) {
            if (auditor.email) {
              try {
                await sendAuditOverdueReminderEmail({
                  to: auditor.email,
                  recipientName: auditor.full_name,
                  auditTitle: audit.title,
                  facilityName,
                  plannedDate: plannedFormatted,
                  daysOverdue,
                  auditUrl,
                });
                stats.emailsSent++;
              } catch (mailErr: any) {
                console.error(`[Cron] Overdue audit mail error ${audit.id}:`, mailErr);
                stats.errors.push(`Audit ${audit.id}: mail — ${mailErr?.message || mailErr}`);
              }
            }

            await supabase.from('notifications').insert({
              company_id: audit.company_id,
              user_id: auditor.id,
              title: `[GECİKMİŞ DENETİM] ${audit.title}`,
              message: `${facilityName} — "${audit.title}" denetimi ${plannedFormatted} tarihinde planlanmıştı; ${daysOverdue} gündür tamamlanmadı. Lütfen denetimi tamamlayınız.`,
              type: 'uyari',
              related_type: 'audit',
              related_id: audit.id,
            });
            stats.notificationsSent++;
            notifiedUserIds.add(auditor.id);
          }

          // 2) Tesis / şirket yöneticilerine uygulama içi bildirim
          const { data: authorities } = await supabase
            .from('profiles')
            .select('id')
            .eq('company_id', audit.company_id)
            .eq('is_active', true)
            .in('role', ['company_admin', 'facility_manager'])
            .or(`facility_id.eq.${audit.facility_id},facility_id.is.null,role.eq.company_admin`);

          for (const authority of authorities || []) {
            if (notifiedUserIds.has(authority.id)) continue;

            await supabase.from('notifications').insert({
              company_id: audit.company_id,
              user_id: authority.id,
              title: `[GECİKMİŞ DENETİM] ${audit.title} — ${auditor?.full_name || 'Denetçi belirsiz'}`,
              message: `${facilityName} — "${audit.title}" denetimi ${daysOverdue} gündür gecikmede (planlanan: ${plannedFormatted}).`,
              type: 'uyari',
              related_type: 'audit',
              related_id: audit.id,
            });
            stats.notificationsSent++;
            notifiedUserIds.add(authority.id);
          }

          stats.overdueSent++;
        } else {
          // Yaklaşan denetim: denetçiye e-posta + uygulama içi bildirim
          if (auditor?.id) {
            if (auditor.email) {
              try {
                await sendAuditUpcomingReminderEmail({
                  to: auditor.email,
                  recipientName: auditor.full_name,
                  auditTitle: audit.title,
                  facilityName,
                  plannedDate: plannedFormatted,
                  daysLeft: diffDays,
                  auditUrl,
                });
                stats.emailsSent++;
              } catch (mailErr: any) {
                console.error(`[Cron] Upcoming audit mail error ${audit.id}:`, mailErr);
                stats.errors.push(`Audit ${audit.id}: mail — ${mailErr?.message || mailErr}`);
              }
            }

            await supabase.from('notifications').insert({
              company_id: audit.company_id,
              user_id: auditor.id,
              title: `[HATIRLATMA] ${diffDays} gün sonra denetim: ${audit.title}`,
              message: `${facilityName} — "${audit.title}" denetimi ${plannedFormatted} tarihinde planlandı. ${diffDays} gün kaldı.`,
              type: 'hatirlatma',
              related_type: 'audit',
              related_id: audit.id,
            });
            stats.notificationsSent++;
            notifiedUserIds.add(auditor.id);
          }

          stats.upcomingSent++;
        }
      } catch (itemErr: any) {
        console.error(`[Cron] Error processing audit reminder ${audit.id}:`, itemErr);
        stats.errors.push(`Audit ${audit.id}: ${itemErr?.message || itemErr}`);
      }
    }

    return { job: 'audit-reminders', success: true, stats };
  } catch (err: any) {
    console.error('[Cron] Fatal error in audit-reminders cron:', err);
    return {
      job: 'audit-reminders',
      success: false,
      stats,
      error: err?.message || 'Bilinmeyen cron hatası',
    };
  }
}
