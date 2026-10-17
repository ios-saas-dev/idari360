import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendActionNotificationEmail } from '@/lib/email';

// Initialize admin Supabase client with SERVICE_ROLE_KEY to bypass RLS for background cron execution
function getAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export async function GET(request: NextRequest) {
  return handleActionOverdueCron(request);
}

export async function POST(request: NextRequest) {
  return handleActionOverdueCron(request);
}

/**
 * AKSİYON GECİKME BİLDİRİMİ (Excel kuralı)
 * ----------------------------------------------------------------
 * Termin tarihi geçmiş ve hâlâ kapatılmamış aksiyonlar için:
 *  - Sorumlu kişiye gecikme e-postası + uygulama içi bildirim
 *  - Tesis yöneticileri / şirket yöneticilerine uygulama içi bildirim
 *  - "Yemekhane 3 gündür açık aksiyonu kapatmadı" senaryosu
 *
 * Aynı aksiyon için bildirim tekrarlanmaz (overdue_notified_at damgası).
 */
async function handleActionOverdueCron(request: NextRequest) {
  // Security verification for Vercel Cron or admin invocation
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow Vercel's built-in cron header
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    if (!vercelCronHeader) {
      return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
    }
  }

  const supabase = getAdminSupabaseClient();
  const now = new Date();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://idari360.com';

  // Türkiye saatine göre "bugün" (YYYY-MM-DD) — termin günü dolmadan aksiyon gecikmiş sayılmaz
  const todayTR = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(now);

  const stats = {
    overdueProcessed: 0,
    emailsSent: 0,
    notificationsSent: 0,
    errors: [] as string[],
  };

  try {
    // Termin tarihi bugünden önce olan, kapatılmamış ve daha önce gecikme bildirimi
    // gönderilmemiş aksiyonlar
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
      .neq('status', 'kapali')
      .not('due_date', 'is', null)
      .lt('due_date', todayTR)
      .is('overdue_notified_at', null);

    if (queryError) {
      console.error('[Cron] Action overdue query error:', queryError);
      return NextResponse.json(
        {
          success: false,
          error: queryError.message,
          stats,
        },
        { status: 500 }
      );
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

        // Termin tarihini GG.AA.YYYY olarak biçimlendir
        const [dy, dm, dd] = String(action.due_date).split('-');
        const dueDateFormatted = dy && dm && dd ? `${dd}.${dm}.${dy}` : String(action.due_date);

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

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      today: todayTR,
      stats,
    });
  } catch (err: any) {
    console.error('[Cron] Fatal error in action-overdue cron:', err);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || 'Bilinmeyen cron hatası',
        stats,
      },
      { status: 500 }
    );
  }
}
