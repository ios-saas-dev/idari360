import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

/**
 * Varlık QR kodu (SVG).
 * İçerik: {origin}/dashboard/assets/{id} — telefonla okutunca varlık detayı açılır.
 * Görüntüleme yetkisi: varlığı görebilen kullanıcılar (RLS) + giriş zorunlu.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: asset, error } = await supabase
    .from('assets')
    .select('id, asset_code, name')
    .eq('id', id)
    .single();
  if (error || !asset) {
    return NextResponse.json({ error: 'Varlık bulunamadı veya yetkiniz yok.' }, { status: 404 });
  }

  // Origin: proxy başlıklarını tercih et (Vercel custom domain), yoksa istek origin'i
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';
  const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin;
  const content = `${origin}/dashboard/assets/${asset.id}`;

  const svg = await QRCode.toString(content, {
    type: 'svg',
    margin: 1,
    width: 256,
    errorCorrectionLevel: 'M',
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
