import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/shared';
import { runActionOverdueCron } from '@/lib/cron/action-overdue';

/**
 * Aksiyon gecikme cron'u — manuel/test çağrısı için ince sarmalayıcı.
 * Zamanlanmış çalıştırma /api/cron/daily üzerinden yapılır.
 */
export async function GET(request: NextRequest) {
  return handleActionOverdueCron(request);
}

export async function POST(request: NextRequest) {
  return handleActionOverdueCron(request);
}

async function handleActionOverdueCron(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const result = await runActionOverdueCron();

  return NextResponse.json(
    { ...result, timestamp: new Date().toISOString() },
    { status: result.success ? 200 : 500 }
  );
}
