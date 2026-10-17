import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// ─── Medya Yükleme API'si ──────────────────────────────────────────────────
// Yalnızca oturum açmış kullanıcılar, yalnızca kendi şirketlerine ait
// kayıtlar için dosya yükleyebilir.
//   Denetim / aksiyon kanıtı : yalnızca GÖRSEL (JPG, PNG, WEBP, GIF, HEIC/HEIF)
//   Talep ekleri             : GÖRSEL + PDF belge

const MAX_SIZE = 10 * 1024 * 1024; // Görsel: 10 MB
const MAX_PDF_SIZE = 4 * 1024 * 1024; // PDF: 4 MB (istek gövdesi sınırına güvenli mesafe)
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
  'application/pdf': 'pdf',
};

const EXT_TO_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  pdf: 'application/pdf',
};

// Dosya imzası (magic bytes) ile gerçek görsel türünü tespit eder.
// Beyan edilen MIME türüne güvenmek yerine dosya içeriği doğrulanır.
function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  // HEIC/HEIF: 4-7 bayt "ftyp", 8-11 bayt marka kutusu
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs'].includes(brand)) {
      return 'image/heic';
    }
    if (['mif1', 'msf1'].includes(brand)) {
      return 'image/heif';
    }
  }
  return null;
}

// PDF imzası: dosya "%PDF" ile başlamalı
function isPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46
  );
}

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
  const requestId = formData.get('request_id') ? String(formData.get('request_id')) : null;
  const planId = formData.get('plan_id') ? String(formData.get('plan_id')) : null;

  // PDF yalnızca talep eklerinde serbest
  const pdfAllowed = context === 'request';

  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ error: 'Yüklenecek dosya bulunamadı.' }, { status: 400 });
  }

  // MIME doğrulaması — bazı tarayıcılar HEIC/PDF için boş/octet-stream
  // gönderebilir; bu durumda dosya uzantısından tür türetilir.
  const rawExt = (file.name.split('.').pop() || '').toLowerCase();
  let mimeType = (file.type || '').toLowerCase();
  if (!mimeType || mimeType === 'application/octet-stream') {
    mimeType = EXT_TO_TYPE[rawExt] || '';
  }
  const declaredPdf = mimeType === 'application/pdf';

  // Boyut + tür kontrolü
  if (declaredPdf) {
    if (!pdfAllowed) {
      return NextResponse.json(
        { error: 'PDF belgeler yalnızca talep eklerinde yüklenebilir.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_PDF_SIZE) {
      return NextResponse.json(
        { error: 'PDF belge boyutu en fazla 4 MB olabilir.' },
        { status: 400 }
      );
    }
  } else {
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        {
          error: pdfAllowed
            ? 'Yalnızca görsel dosyaları (JPG, PNG, WEBP, GIF, HEIC) veya PDF belge yükleyebilirsiniz.'
            : 'Yalnızca görsel dosyaları yükleyebilirsiniz (JPG, PNG, WEBP, GIF, HEIC).',
        },
        { status: 400 }
      );
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Görsel boyutu en fazla 10 MB olabilir.' }, { status: 400 });
    }
  }

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
  } else if (context === 'cleaning') {
    if (!planId) {
      return NextResponse.json({ error: 'Temizlik planı bilgisi eksik.' }, { status: 400 });
    }
    const { data: plan } = await supabase
      .from('cleaning_plans')
      .select('id, company_id')
      .eq('id', planId)
      .single();
    if (!plan || plan.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Temizlik planı bulunamadı veya yetkiniz yok.' }, { status: 404 });
    }
    folder = `cleaning-plans/${profile.company_id}/${plan.id}`;
  } else if (context === 'request') {
    if (requestId) {
      const { data: reqRow } = await supabase
        .from('requests')
        .select('id, company_id')
        .eq('id', requestId)
        .single();
      if (!reqRow || reqRow.company_id !== profile.company_id) {
        return NextResponse.json({ error: 'Talep bulunamadı veya yetkiniz yok.' }, { status: 404 });
      }
      folder = `requests/${profile.company_id}/${reqRow.id}`;
    } else {
      // Talep henüz oluşturulmadı (yeni talep formu) — taslak klasörü
      folder = `requests/${profile.company_id}/draft`;
    }
  } else {
    return NextResponse.json({ error: 'Geçersiz yükleme bağlamı.' }, { status: 400 });
  }

  // Dosya içeriği doğrulaması: beyan edilen MIME türüne güvenmek yerine
  // dosyanın gerçek imzası (magic bytes) kontrol edilir ve tür buradan alınır.
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const detectedImage = detectImageType(bytes);
  const detectedPdf = pdfAllowed && isPdfSignature(bytes);
  if (!detectedImage && !detectedPdf) {
    return NextResponse.json(
      {
        error: pdfAllowed
          ? 'Dosya geçerli bir görsel veya PDF değil. Yalnızca JPG, PNG, WEBP, GIF, HEIC veya PDF yükleyebilirsiniz.'
          : 'Dosya geçerli bir görsel değil. Yalnızca JPG, PNG, WEBP, GIF veya HEIC yükleyebilirsiniz.',
      },
      { status: 400 }
    );
  }

  let finalMime: string;
  let finalExt: string;
  if (!detectedImage && detectedPdf) {
    finalMime = 'application/pdf';
    finalExt = 'pdf';
  } else {
    finalMime = ALLOWED_TYPES.includes(detectedImage as string) ? (detectedImage as string) : mimeType;
    finalExt = EXT_BY_TYPE[finalMime] || rawExt || 'jpg';
  }

  const objectPath = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${finalExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, arrayBuffer, { contentType: finalMime, upsert: false });

  if (uploadError) {
    return NextResponse.json(
      { error: `Dosya yüklenemedi: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({ url: publicUrlData.publicUrl, path: objectPath });
}
