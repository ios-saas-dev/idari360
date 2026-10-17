import { getAdminSupabaseClient, getBaseUrl, CronJobResult } from './shared';
import {
  sendUnassignedRequestEscalationEmail,
  sendInProgressRequestReminderEmail,
} from '@/lib/email';

/**
 * TALEP SLA / HATIRLATMA CRON'U (Excel kuralı)
 * ----------------------------------------------------------------
 * 1) 24 saattir karşılanmayan (yeni statüsünde bekleyen) talepler:
 *    tesis yetkililerine e-posta + uygulama içi bildirim.
 * 2) 24 saattir işlemde olan ve kapatılmayan talepler:
 *    talebi karşılayan kişiye e-posta + uygulama içi bildirim.
 *
 * Tekrar gönderim: last_unassigned_reminder_at / last_in_progress_reminder_at
 * damgalarıyla günde bir kez.
 */
export async function runRequestEscalationCron(): Promise<CronJobResult> {
  const supabase = getAdminSupabaseClient();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const baseUrl = getBaseUrl();

  const stats = {
    unassignedProcessed: 0,
    unassignedEmailsSent: 0,
    inProgressProcessed: 0,
    inProgressEmailsSent: 0,
    errors: [] as string[],
  };

  try {
    // =========================================================================
    // 1. KURAL 1: 24 SAATTİR KARŞILANMAYAN (YENİ STATÜSÜNDE BEKLEYEN) TALEPLER
    // =========================================================================
    const { data: unassignedRequests, error: unassignedError } = await supabase
      .from('requests')
      .select(`
        id,
        request_number,
        title,
        category,
        company_id,
        facility_id,
        created_at,
        last_unassigned_reminder_at,
        facility:facilities(id, name, city)
      `)
      .eq('status', 'yeni')
      .lte('created_at', twentyFourHoursAgo)
      .or(`last_unassigned_reminder_at.is.null,last_unassigned_reminder_at.lte.${twentyFourHoursAgo}`);

    if (unassignedError) {
      console.error('[Cron] Unassigned requests query error:', unassignedError);
      stats.errors.push(`Unassigned query error: ${unassignedError.message}`);
    } else if (unassignedRequests && unassignedRequests.length > 0) {
      stats.unassignedProcessed = unassignedRequests.length;

      for (const req of unassignedRequests) {
        try {
          const createdAtDate = new Date(req.created_at);
          const waitingHours = Math.max(24, Math.floor((now.getTime() - createdAtDate.getTime()) / (1000 * 60 * 60)));
          const facilityName = (req.facility as { name?: string })?.name || 'Tesis';
          const actionUrl = `${baseUrl}/dashboard/requests/${req.id}`;

          // Tesis yetkililerini çek (facility_manager, facility_officer, company_admin)
          const { data: authorities } = await supabase
            .from('profiles')
            .select('id, email, full_name, role')
            .eq('company_id', req.company_id)
            .eq('is_active', true)
            .in('role', ['company_admin', 'facility_manager', 'facility_officer'])
            .or(`facility_id.eq.${req.facility_id},facility_id.is.null,role.eq.company_admin`);

          if (authorities && authorities.length > 0) {
            // E-posta gönderimi (her yetkiliye)
            for (const auth of authorities) {
              if (auth.email) {
                await sendUnassignedRequestEscalationEmail({
                  to: auth.email,
                  recipientName: auth.full_name,
                  requestNumber: req.request_number,
                  title: req.title,
                  category: req.category,
                  facilityName,
                  waitingHours,
                  actionUrl,
                });
                stats.unassignedEmailsSent++;
              }

              // In-app bildirim oluştur
              await supabase.from('notifications').insert({
                company_id: req.company_id,
                user_id: auth.id,
                title: `[ACİL] Karşılanmayan Talep (${waitingHours} Saat)`,
                message: `${facilityName} tesisinde ${req.request_number} numaralı talep ${waitingHours} saattir beklemede. Lütfen üzerinize alınız.`,
                type: 'uyari',
                related_type: 'request',
                related_id: req.id,
              });
            }
          }

          // Son hatırlatma zamanını güncelle
          await supabase
            .from('requests')
            .update({ last_unassigned_reminder_at: now.toISOString() })
            .eq('id', req.id);
        } catch (itemErr: any) {
          console.error(`[Cron] Error processing unassigned req ${req.id}:`, itemErr);
          stats.errors.push(`Unassigned req ${req.id}: ${itemErr?.message || itemErr}`);
        }
      }
    }

    // =========================================================================
    // 2. KURAL 2: 24 SAATTİR İŞLEMDE OLAN VE KAPATILMAYAN TALEPLER
    // =========================================================================
    const { data: inProgressRequests, error: inProgressError } = await supabase
      .from('requests')
      .select(`
        id,
        request_number,
        title,
        category,
        company_id,
        facility_id,
        assigned_to,
        assigned_at,
        last_in_progress_reminder_at,
        facility:facilities(id, name, city),
        assignee:profiles!requests_assigned_to_fkey(id, email, full_name)
      `)
      .eq('status', 'islemde')
      .not('assigned_to', 'is', null)
      .not('assigned_at', 'is', null)
      .lte('assigned_at', twentyFourHoursAgo)
      .or(`last_in_progress_reminder_at.is.null,last_in_progress_reminder_at.lte.${twentyFourHoursAgo}`);

    if (inProgressError) {
      console.error('[Cron] In-progress requests query error:', inProgressError);
      stats.errors.push(`In-progress query error: ${inProgressError.message}`);
    } else if (inProgressRequests && inProgressRequests.length > 0) {
      stats.inProgressProcessed = inProgressRequests.length;

      for (const req of inProgressRequests) {
        try {
          const assignedAtDate = new Date(req.assigned_at!);
          const inProgressHours = Math.max(24, Math.floor((now.getTime() - assignedAtDate.getTime()) / (1000 * 60 * 60)));
          const facilityName = (req.facility as { name?: string })?.name || 'Tesis';
          const actionUrl = `${baseUrl}/dashboard/requests/${req.id}`;
          const resolver = req.assignee as { id?: string; email?: string; full_name?: string } | null;

          if (resolver?.email) {
            // E-posta gönderimi (karşılayan kişiye)
            await sendInProgressRequestReminderEmail({
              to: resolver.email,
              recipientName: resolver.full_name,
              requestNumber: req.request_number,
              title: req.title,
              category: req.category,
              facilityName,
              inProgressHours,
              actionUrl,
            });
            stats.inProgressEmailsSent++;

            // In-app bildirim oluştur
            await supabase.from('notifications').insert({
              company_id: req.company_id,
              user_id: resolver.id || req.assigned_to,
              title: `[HATIRLATMA] Çözüm Bekleyen Talep (${inProgressHours} Saat)`,
              message: `Üzerinize aldığınız ${req.request_number} numaralı talep ${inProgressHours} saattir işlemde. Lütfen çözüme kavuşturup kapatınız.`,
              type: 'uyari',
              related_type: 'request',
              related_id: req.id,
            });
          }

          // Son hatırlatma zamanını güncelle
          await supabase
            .from('requests')
            .update({ last_in_progress_reminder_at: now.toISOString() })
            .eq('id', req.id);
        } catch (itemErr: any) {
          console.error(`[Cron] Error processing in-progress req ${req.id}:`, itemErr);
          stats.errors.push(`In-progress req ${req.id}: ${itemErr?.message || itemErr}`);
        }
      }
    }

    return { job: 'request-escalation', success: true, stats };
  } catch (err: any) {
    console.error('[Cron] Fatal error in request-escalation cron:', err);
    return {
      job: 'request-escalation',
      success: false,
      stats,
      error: err?.message || 'Bilinmeyen cron hatası',
    };
  }
}
