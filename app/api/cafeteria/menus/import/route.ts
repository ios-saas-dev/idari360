import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import {
  parseMenuWorkbook,
  hasValidSpreadsheetSignature,
  MAX_FILE_SIZE_MB,
  MAX_IMPORT_ROWS,
  MEAL_LABELS,
  type MenuImportRecord,
} from '@/lib/cafeteria-excel';

export const runtime = 'nodejs';

/** Menü ekleyebilen rollerle aynı */
const ALLOWED_ROLES = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'];

/** Toplu insert parça boyutu */
const INSERT_CHUNK_SIZE = 100;
/** Eşzamanlı güncelleme sayısı */
const UPDATE_CONCURRENCY = 15;

interface ImportedIssue {
  row: number;
  label: string;
  message: string;
}

/** Satırdan items jsonb'sini üretir */
function buildItems(record: MenuImportRecord): Record<string, string | number> {
  const items: Record<string, string | number> = { ana_yemek: record.ana_yemek };
  if (record.corba) items.corba = record.corba;
  if (record.yan_yemek) items.yan_yemek = record.yan_yemek;
  if (record.tatli_meyve) items.tatli_meyve = record.tatli_meyve;
  if (record.kalori !== null) items.kalori = record.kalori;
  return items;
}

function recordLabel(record: MenuImportRecord): string {
  return `${record.menu_date} · ${MEAL_LABELS[record.meal_type]}`;
}

/** Basit eşzamanlılık havuzu */
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> {
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

export async function POST(request: NextRequest) {
  try {
    /* 1) Kimlik ve yetki */
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, company_id, facility_id, role')
      .eq('id', user.id)
      .single();

    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!profile.company_id) {
      return NextResponse.json({ error: 'Profile incomplete' }, { status: 400 });
    }
    if (!ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
    }

    /* 2) Dosya doğrulama */
    const formData = await request.formData();
    const file = formData.get('file');
    const mode = formData.get('mode') === 'overwrite' ? 'overwrite' : 'skip';

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Excel dosyası bulunamadı.' }, { status: 400 });
    }

    const filename = (file.name || '').toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'Yalnızca .xlsx veya .xls uzantılı Excel dosyaları yüklenebilir.' },
        { status: 400 }
      );
    }

    const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      return NextResponse.json(
        { error: `Dosya boyutu en fazla ${MAX_FILE_SIZE_MB} MB olabilir.` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidSpreadsheetSignature(new Uint8Array(buffer.slice(0, 8)))) {
      return NextResponse.json(
        { error: 'Dosya içeriği geçerli bir Excel dosyası değil (imza doğrulaması başarısız).' },
        { status: 400 }
      );
    }

    /* 3) Ayrıştırma ve satır doğrulama */
    const parsed = parseMenuWorkbook(buffer);

    if (parsed.fatalError) {
      return NextResponse.json({ error: parsed.fatalError }, { status: 400 });
    }

    if (parsed.totalRows === 0) {
      return NextResponse.json(
        {
          error: `Excel dosyasında doldurulmuş satır bulunamadı. Lütfen şablondaki "Menüler" sekmesini doldurup tekrar deneyin. (En fazla ${MAX_IMPORT_ROWS} satır)`,
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    /* 4) Tesis belirleme (cafeteria_menus.facility_id NOT NULL) */
    let facilityId: string | null = profile.facility_id || null;
    if (!facilityId) {
      const { data: firstFacility } = await admin
        .from('facilities')
        .select('id')
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      facilityId = firstFacility?.id || null;
    }
    if (!facilityId) {
      return NextResponse.json(
        { error: 'Şirkete tanımlı bir tesis bulunamadı. Önce tesis tanımlayıp tekrar deneyin.' },
        { status: 400 }
      );
    }

    /* 5) Aralıktaki mevcut kayıtlar (gün + öğün bazında) */
    const dates = parsed.records.map((r) => r.menu_date).sort();
    const minDate = dates[0];
    const maxDate = dates[dates.length - 1];

    const { data: existingMenus, error: existingError } = await admin
      .from('cafeteria_menus')
      .select('id, menu_date, meal_type')
      .eq('company_id', profile.company_id)
      .eq('facility_id', facilityId)
      .gte('menu_date', minDate)
      .lte('menu_date', maxDate);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const existingByKey = new Map<string, string>();
    for (const m of existingMenus || []) {
      existingByKey.set(`${m.menu_date}|${m.meal_type}`, m.id);
    }

    /* 6) Satırları ayır: yeni / üzerine yazılacak / atlanan */
    const toInsert: MenuImportRecord[] = [];
    const toUpdate: Array<{ id: string; record: MenuImportRecord }> = [];
    const skipped: ImportedIssue[] = [];

    for (const record of parsed.records) {
      const key = `${record.menu_date}|${record.meal_type}`;
      const existingId = existingByKey.get(key);
      if (!existingId) {
        toInsert.push(record);
      } else if (mode === 'overwrite') {
        toUpdate.push({ id: existingId, record });
      } else {
        skipped.push({
          row: record.row,
          label: recordLabel(record),
          message: 'Bu gün ve öğün için kayıt zaten var; satır atlandı (üzerine yazmak için ilgili seçeneği işaretleyin).',
        });
      }
    }

    /* 7) Yeni kayıtları toplu ekle (hata durumunda satır satır kurtarma) */
    const insertErrors: ImportedIssue[] = [];
    let createdCount = 0;

    const buildRow = (record: MenuImportRecord) => ({
      company_id: profile.company_id,
      facility_id: facilityId,
      menu_date: record.menu_date,
      meal_type: record.meal_type,
      items: buildItems(record),
      planned_count: record.planned_count ?? 0,
      actual_count: 0,
      produced_kg: null,
      consumed_kg: null,
      waste_kg: null,
      unit_cost: record.unit_cost,
      created_by: profile.id,
    });

    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
      const { data, error } = await admin
        .from('cafeteria_menus')
        .insert(chunk.map(buildRow))
        .select('id');

      if (!error) {
        createdCount += data?.length || 0;
        continue;
      }

      for (const record of chunk) {
        const { error: singleError } = await admin
          .from('cafeteria_menus')
          .insert(buildRow(record))
          .select('id')
          .single();

        if (singleError) {
          insertErrors.push({
            row: record.row,
            label: recordLabel(record),
            message:
              singleError.code === '23505'
                ? 'Bu gün ve öğün sistemde zaten kayıtlı.'
                : `Veritabanı hatası: ${singleError.message}`,
          });
        } else {
          createdCount += 1;
        }
      }
    }

    /* 8) Mevcut kayıtların üzerine yaz (yalnızca plan alanları) */
    const updateErrors: ImportedIssue[] = [];
    let updatedCount = 0;

    await runWithConcurrency(toUpdate, UPDATE_CONCURRENCY, async ({ id, record }) => {
      // Üzerine yazma YALNIZCA menü içeriği + planlanan kişi + maliyeti günceller;
      // gerçekleşen kişi / üretim / tüketim / fire (saha verisi) korunur.
      // Excel'de boş bırakılan plan alanları mevcut değeri değiştirmez.
      const payload: Record<string, unknown> = { items: buildItems(record) };
      if (record.planned_count !== null) payload.planned_count = record.planned_count;
      if (record.unit_cost !== null) payload.unit_cost = record.unit_cost;

      const { error: updateError } = await admin
        .from('cafeteria_menus')
        .update(payload)
        .eq('id', id);

      if (updateError) {
        updateErrors.push({
          row: record.row,
          label: recordLabel(record),
          message: `Güncelleme hatası: ${updateError.message}`,
        });
      } else {
        updatedCount += 1;
      }
    });

    /* 9) Aktivite kaydı (en iyi çaba) */
    const allIssues = [...parsed.errors, ...skipped, ...insertErrors, ...updateErrors];
    try {
      await admin.from('activity_logs').insert({
        company_id: profile.company_id,
        user_id: profile.id,
        action: 'CAFETERIA_MENUS_IMPORT',
        entity_type: 'cafeteria_menus',
        details: {
          file: file.name,
          mode,
          total_rows: parsed.totalRows,
          created: createdCount,
          updated: updatedCount,
          skipped: skipped.length,
          invalid: parsed.errors.length + insertErrors.length + updateErrors.length,
        },
      });
    } catch {
      /* sessiz geç */
    }

    /* 10) Özet yanıtı */
    let message: string;
    if (createdCount > 0 || updatedCount > 0) {
      const parts: string[] = [];
      if (createdCount > 0) parts.push(`${createdCount} yeni menü eklendi`);
      if (updatedCount > 0) parts.push(`${updatedCount} mevcut menü güncellendi`);
      message = `${parts.join(', ')}.`;
      if (allIssues.length > 0) message += ` ${allIssues.length} satır atlandı (ayrıntılar aşağıda).`;
    } else if (skipped.length > 0 && parsed.errors.length + insertErrors.length + updateErrors.length === 0) {
      message =
        'Dosyadaki tüm menüler sistemde zaten kayıtlı; değişiklik yapılmadı. Güncellemek için "Mevcut kayıtların üzerine yaz" seçeneğini kullanın.';
    } else if (allIssues.length > 0) {
      message = 'Hiçbir satır işlenemedi. Lütfen hatalı satırları düzeltip tekrar deneyin.';
    } else {
      message = 'Dosyada işlenecek satır bulunamadı.';
    }

    return NextResponse.json({
      success: true,
      message,
      summary: {
        total: parsed.totalRows,
        created: createdCount,
        updated: updatedCount,
        skipped: skipped.length,
        invalid: parsed.errors.length + insertErrors.length + updateErrors.length,
      },
      issues: allIssues,
    });
  } catch (err: any) {
    console.error('[cafeteria/menus/import] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Dosya işlenirken beklenmeyen bir hata oluştu.' },
      { status: 500 }
    );
  }
}
