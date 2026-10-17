import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/shared';
import { runRequestEscalationCron } from '@/lib/cron/request-escalation';

/**
 * Talep SLA / hatırlatma cron'u — manuel/test çağrısı için ince sarmalayıcı.
 * Zamanlanmış çalıştırma /api/cron/daily üzerinden yapılır.
 */
export async function GET(request: NextRequest) {
  return handleCronEscalation(request);
}

export async function POST(request: NextRequest) {
  return handleCronEscalation(request);
}

async function handleCronEscalation(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const result = await runRequestEscalationCron();

  return NextResponse.json(
    { ...result, timestamp: new Date().toISOString() },
    { status: result.success ? 200 : 500 }
  );
}
