import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildMenuTemplateBuffer } from '@/lib/cafeteria-excel';

export const runtime = 'nodejs';

/** Yetkili roller: menü ekleyebilenlerle aynı */
const ALLOWED_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!ALLOWED_ROLES.includes(profile?.role || '')) {
    return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  }

  const buffer = buildMenuTemplateBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        "attachment; filename*=UTF-8''yemekhane-menu-sablonu.xlsx",
      'Cache-Control': 'no-store',
    },
  });
}
