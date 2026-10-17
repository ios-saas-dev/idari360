import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/shared';
import { runRequestEscalationCron } from '@/lib/cron/request-escalation';
import { runActionOverdueCron } from '@/lib/cron/action-overdue';
import { runAuditRemindersCron } from '@/lib/cron/audit-reminders';

/**
 * GÜNLÜK CRON GİRİŞİ (tek Vercel cron tanımı)
 * ----------------------------------------------------------------
 * Hobby planı en fazla 2 cron tanımına izin verdiği için tüm günlük işler
 * buradan çalıştırılır; her iş kendi lib fonksiyonundadır ve biri hata
 * verse bile diğerleri çalışmaya devam eder.
 *
 * İşler:
 *  1. request-escalation : 24 saat SLA hatırlatmaları (talep)
 *  2. action-overdue     : termin geçen aksiyon gecikme bildirimleri
 *  3. audit-reminders    : planlı denetim 7/3/1 gün hatırlatmaları + gecikme
 */
export async function GET(request: NextRequest) {
  return handleDailyCron(request);
}

export async function POST(request: NextRequest) {
  return handleDailyCron(request);
}

async function handleDailyCron(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const startedAt = new Date();

  const results = [
    await runRequestEscalationCron(),
    await runActionOverdueCron(),
    await runAuditRemindersCron(),
  ];

  const success = results.every((r) => r.success);

  return NextResponse.json(
    {
      success,
      timestamp: startedAt.toISOString(),
      results,
    },
    { status: success ? 200 : 500 }
  );
}
