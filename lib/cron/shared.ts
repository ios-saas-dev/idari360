import { NextRequest } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Ortak cron yardımcıları.
 *
 * Vercel Hobby planı en fazla 2 cron tanımına izin verdiği için tüm günlük
 * işler tek bir /api/cron/daily girişinden çalıştırılır; her iş kendi lib
 * fonksiyonunda izole edilir.
 */

export interface CronJobResult {
  job: string;
  success: boolean;
  stats: Record<string, unknown>;
  error?: string;
}

// SERVICE_ROLE_KEY ile RLS'i baypas eden yönetici istemcisi (yalnızca cron sunucusu)
export function getAdminSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

// Vercel Cron veya yönetici çağrısı için güvenlik doğrulaması
export function isCronAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const vercelCronHeader = request.headers.get('x-vercel-cron');
    return Boolean(vercelCronHeader);
  }
  return true;
}

export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'https://idari360.com';
}

// Türkiye saatine göre "bugün" (YYYY-MM-DD)
export function todayInIstanbul(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul' }).format(new Date());
}

// YYYY-MM-DD → GG.AA.YYYY
export function formatDateTR(dateStr: string): string {
  const [y, m, d] = String(dateStr).split('-');
  return y && m && d ? `${d}.${m}.${y}` : String(dateStr);
}
