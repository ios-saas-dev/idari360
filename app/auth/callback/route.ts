import { NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/auth/select-facility';

  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  const baseUrl = isLocalEnv
    ? requestUrl.origin
    : forwardedHost
    ? `https://${forwardedHost}`
    : requestUrl.origin;

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

        return NextResponse.redirect(`${baseUrl}${next}`);
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

        return NextResponse.redirect(`${baseUrl}${next}`);
      }
    }
  } catch (err) {
    console.error('[auth/callback] Error processing verification link:', err);
  }

  // 3. Hash parçası (#access_token=...) durumunda istemci tarafında oturum açma ve yönlendirme
  const htmlFallback = `
<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>Giriş Doğrulanıyor — İdari360</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #f1f5f9;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .card {
        background: #ffffff;
        padding: 32px 40px;
        border-radius: 16px;
        box-shadow: 0 4px 16px rgba(15, 28, 46, 0.08);
        text-align: center;
        max-width: 400px;
      }
      .spinner {
        width: 36px;
        height: 36px;
        border: 3px solid #e2e8f0;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 16px;
      }
      @keyframes spin { to { transform: rotate(360deg); } }
      h2 { color: #0f172a; margin: 0 0 8px; font-size: 18px; }
      p { color: #64748b; font-size: 14px; margin: 0; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="spinner"></div>
      <h2>Oturum Açılıyor</h2>
      <p>Lütfen bekleyin, İdari360 hesabınız doğrulanıyor...</p>
    </div>
    <script>
      (function() {
        if (window.location.hash && window.location.hash.includes('access_token')) {
          // Hash parçası varsa tesis seçim ekranına yönlendir
          window.location.href = '/auth/select-facility' + window.location.hash;
        } else {
          // Aksi halde onay rozeti ile login ekranına yönlendir
          window.location.href = '/auth/login?verified=true';
        }
      })();
    </script>
  </body>
</html>
  `.trim();

  return new Response(htmlFallback, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
