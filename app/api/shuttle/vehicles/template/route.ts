import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { buildVehicleTemplateBuffer } from '@/lib/shuttle-excel';

export const runtime = 'nodejs';

/** Yetkili roller: araç ekleyebilenlerle aynı */
const ALLOWED_ROLES = ['super_admin', 'company_admin', 'facility_manager'];

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

  const buffer = buildVehicleTemplateBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition':
        'attachment; filename="servis-araci-sablonu.xlsx"; filename*=UTF-8\'\'servis-araci-sablonu.xlsx',
      'Cache-Control': 'no-store',
    },
  });
}
