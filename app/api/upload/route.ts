import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ─── Kanıt Fotoğrafı Yükleme API'si ────────────────────────────────────────
// Yalnızca oturum açmış kullanıcılar, yalnızca kendi şirketlerine ait
// denetim/aksiyon kayıtları için, yalnızca GÖRSEL dosya yükleyebilir.

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const BUCKET = 'evidence-photos';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
];

const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

const EXT_TO_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
};

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();
  if (!profile?.company_id) {
    return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }

  const file = formData.get('file');
  const context = String(formData.get('context') || '');
  const auditId = formData.get('audit_id') ? String(formData.get('audit_id')) : null;
  const questionId = formData.get('question_id') ? String(formData.get('question_id')) : null;
  const actionId = formData.get('action_id') ? String(formData.get('action_id')) : null;

  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: 'Yüklenecek dosya bulunamadı.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Görsel boyutu en fazla 10 MB olabilir.' }, { status: 400 });
  }

  // MIME doğrulaması — bazı tarayıcılar HEIC için boş/octet-stream gönderebilir;
  // bu durumda dosya uzantısından tür türetilir.
  const rawExt = (file.name.split('.').pop() || '').toLowerCase();
  let mimeType = (file.type || '').toLowerCase();
  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = EXT_TO_TYPE[rawExt] || '';
  }
  if (!ALLOWED_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: 'Yalnızca görsel dosyaları yükleyebilirsiniz (JPG, PNG, WEBP, GIF, HEIC).' },
      { status: 400 }
    );
  }
  const ext = EXT_BY_TYPE[mimeType];

  // Bağlam doğrulaması: kayıt kullanıcının şirketine ait olmalı
  let folder = '';
  if (context === 'audit') {
    if (!auditId) {
      return NextResponse.json({ error: 'Denetim bilgisi eksik.' }, { status: 400 });
    }
    const { data: audit } = await supabase
      .from('audits')
      .select('id, company_id')
      .eq('id', auditId)
      .single();
    if (!audit || audit.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Denetim bulunamadı veya yetkiniz yok.' }, { status: 404 });
    }
    const safeQuestionId = (questionId || 'genel').replace(/[^a-zA-Z0-9-]/g, '');
    folder = `audits/${profile.company_id}/${audit.id}/${safeQuestionId}`;
  } else if (context === 'action') {
    if (!actionId) {
      return NextResponse.json({ error: 'Aksiyon bilgisi eksik.' }, { status: 400 });
    }
    const { data: action } = await supabase
      .from('actions')
      .select('id, company_id')
      .eq('id', actionId)
      .single();
    if (!action || action.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Aksiyon bulunamadı veya yetkiniz yok.' }, { status: 404 });
    }
    folder = `actions/${profile.company_id}/${action.id}`;
  } else {
    return NextResponse.json({ error: 'Geçersiz yükleme bağlamı.' }, { status: 400 });
  }

  const objectPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, arrayBuffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: `Görsel yüklenemedi: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({ url: publicUrlData.publicUrl, path: objectPath });
}
