import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/auth/select-facility';

  try {
    const supabase = await createServerSupabaseClient();

    // 1. PKCE Authorization Code akışı
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data?.user) {
        const admin = createAdminClient();
        await admin
          .from('profiles')
          .update({ email_verified: true, updated_at: new Date().toISOString() })
          .eq('id', data.user.id);

        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }
    }

    // 2. Token hash ile doğrudan onay bağlantısı akışı
    if (token_hash && type) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash,
        type: type as any,
      });

      if (!error && data?.user) {
        const admin = createAdminClient();
        await admin
          .from('profiles')
          .update({ email_verified: true, updated_at: new Date().toISOString() })
          .eq('id', data.user.id);

        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }
    }
  } catch (err) {
    console.error('[auth/callback] Error processing verification link:', err);
  }

  // Bir sorun olursa login sayfasına yönlendir
  return NextResponse.redirect(new URL('/auth/login?verified=true', requestUrl.origin));
}
