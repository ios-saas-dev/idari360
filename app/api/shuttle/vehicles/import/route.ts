import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import {
  parseVehicleWorkbook,
  MAX_FILE_SIZE_MB,
  MAX_IMPORT_ROWS,
  type VehicleImportRecord,
} from '@/lib/shuttle-excel';

export const runtime = 'nodejs';

/** Araç ekleyebilen rollerle aynı */
const ALLOWED_ROLES = ['super_admin', 'company_admin', 'facility_manager'];

/** Toplu insert parça boyutu */
const INSERT_CHUNK_SIZE = 200;

interface ImportedIssue {
  row: number;
  plate: string;
  message: string;
}

/** Dosyanın gerçekten XLSX (ZIP) veya XLS (OLE2) imzası taşıdığını doğrular */
function hasValidSpreadsheetSignature(bytes: Uint8Array): boolean {
  const isZip =
    bytes.length > 3 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
  const isOle2 =
    bytes.length > 7 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0;
  return isZip || isOle2;
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
    if (!ALLOWED_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
    }

    /* 2) Dosya doğrulama */
    const formData = await request.formData();
    const file = formData.get('file');

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
    const parsed = parseVehicleWorkbook(buffer);

    if (parsed.fatalError) {
      return NextResponse.json({ error: parsed.fatalError }, { status: 400 });
    }

    if (parsed.totalRows === 0) {
      return NextResponse.json(
        { error: `Excel dosyasında doldurulmuş satır bulunamadı. Lütfen şablondaki "Araçlar" sekmesini doldurup tekrar deneyin. (En fazla ${MAX_IMPORT_ROWS} satır)` },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    /* 4) Sistemde kayıtlı plakalar (şirket kapsamında mükerrer kontrolü) */
    const { data: existingVehicles, error: existingError } = await admin
      .from('service_vehicles')
      .select('plate_number')
      .eq('company_id', profile.company_id);

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const existingKeys = new Set(
      (existingVehicles || []).map((v) => String(v.plate_number || '').replace(/\s+/g, ''))
    );

    const duplicates: ImportedIssue[] = [];
    const toInsert: VehicleImportRecord[] = [];

    for (const record of parsed.records) {
      const key = record.plate_number.replace(/\s+/g, '');
      if (existingKeys.has(key)) {
        duplicates.push({
          row: record.row,
          plate: record.plate_number,
          message: 'Bu plaka sistemde zaten kayıtlı; satır atlandı.',
        });
      } else {
        existingKeys.add(key);
        toInsert.push(record);
      }
    }

    /* 5) Tesis belirleme (service_vehicles.facility_id NOT NULL) */
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

    if (!facilityId && toInsert.length > 0) {
      return NextResponse.json(
        { error: 'Şirkete tanımlı bir tesis bulunamadı. Önce tesis tanımlayıp tekrar deneyin.' },
        { status: 400 }
      );
    }

    /* 6) Toplu insert (hata durumunda satır satır kurtarma) */
    const insertErrors: ImportedIssue[] = [];
    let importedCount = 0;

    const buildRow = (record: VehicleImportRecord) => ({
      company_id: profile.company_id,
      facility_id: facilityId,
      plate_number: record.plate_number,
      brand: record.brand,
      model: record.model,
      model_year: record.model_year,
      capacity: record.capacity,
      driver_name: record.driver_name,
      driver_phone: record.driver_phone,
      route_name: record.route_name,
      is_active: record.is_active,
    });

    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK_SIZE);
      const { data, error } = await admin
        .from('service_vehicles')
        .insert(chunk.map(buildRow))
        .select('id');

      if (!error) {
        importedCount += data?.length || 0;
        continue;
      }

      // Parça hata verirse satır satır deneyip geçerli olanları kurtar
      for (const record of chunk) {
        const { error: singleError } = await admin
          .from('service_vehicles')
          .insert(buildRow(record))
          .select('id')
          .single();

        if (singleError) {
          insertErrors.push({
            row: record.row,
            plate: record.plate_number,
            message:
              singleError.code === '23505'
                ? 'Bu plaka sistemde zaten kayıtlı.'
                : `Veritabanı hatası: ${singleError.message}`,
          });
        } else {
          importedCount += 1;
        }
      }
    }

    /* 7) Aktivite kaydı (en iyi çaba; başarısız olsa da işlemi etkilemez) */
    try {
      await admin.from('activity_logs').insert({
        company_id: profile.company_id,
        user_id: profile.id,
        action: 'SERVICE_VEHICLES_IMPORT',
        entity_type: 'service_vehicles',
        details: {
          file: file.name,
          total_rows: parsed.totalRows,
          imported: importedCount,
          duplicates: duplicates.length,
          invalid: parsed.errors.length + insertErrors.length,
        },
      });
    } catch {
      /* sessiz geç */
    }

    /* 8) Özet yanıtı */
    const allErrors = [...parsed.errors, ...insertErrors];
    const skipped = duplicates.length + allErrors.length;

    let message: string;
    if (importedCount > 0) {
      message = `${importedCount} servis aracı başarıyla eklendi.`;
      if (skipped > 0) message += ` ${skipped} satır atlandı (ayrıntılar aşağıda).`;
    } else if (duplicates.length > 0 && allErrors.length === 0) {
      message = 'Dosyadaki tüm plakalar sistemde zaten kayıtlı; yeni araç eklenmedi.';
    } else if (allErrors.length > 0) {
      message = 'Hiçbir satır eklenemedi. Lütfen hatalı satırları düzeltip tekrar deneyin.';
    } else {
      message = 'Dosyada eklenecek satır bulunamadı.';
    }

    return NextResponse.json({
      success: true,
      message,
      summary: {
        total: parsed.totalRows,
        imported: importedCount,
        duplicates: duplicates.length,
        invalid: allErrors.length,
      },
      duplicates,
      errors: allErrors,
    });
  } catch (err: any) {
    console.error('[shuttle/import] Unexpected error:', err);
    return NextResponse.json(
      { error: err?.message || 'Dosya işlenirken beklenmeyen bir hata oluştu.' },
      { status: 500 }
    );
  }
}
